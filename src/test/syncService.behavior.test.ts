import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createEmptyState } from '../storage/migration';
import { saveObservationAction } from '../storage/gardenActions';
import * as supabaseClient from '../sync/supabaseClient';
import * as imageStore from '../storage/imageStore';
import { syncGarden, pullCloudState, uploadPendingImages, wipeCloudGarden } from '../sync/syncService';
import { toPersisted } from '../storage/serializableState';

function makeLocal() {
  const { nextState } = saveObservationAction(createEmptyState(), {
    plantType: 'tulip',
    commonNameJa: 'チューリップ',
    scientificName: 'Tulipa',
    familyName: 'ユリ科',
    trait: 'テスト',
    color: 'red',
    imageDataUrl: 'data:image/jpeg;base64,abcd',
    isSample: false,
    identificationSource: 'manual',
  });
  return nextState;
}

describe('syncService behavior', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.spyOn(supabaseClient, 'isSupabaseConfigured').mockReturnValue(true);
    vi.spyOn(imageStore, 'loadImage').mockResolvedValue('data:image/jpeg;base64,abcd');
    vi.spyOn(imageStore, 'saveImage').mockResolvedValue();
  });

  it('returns error when cloud DB fetch fails (not treated as empty)', async () => {
    const mockFrom = vi.fn().mockReturnValue({
      select: () => ({
        maybeSingle: async () => ({ data: null, error: { message: 'network' } }),
      }),
    });
    vi.spyOn(supabaseClient, 'getSupabase').mockReturnValue({
      from: mockFrom,
    } as never);

    const result = await pullCloudState('user-1');
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('network');
  });

  it('normalizes pulled state revision and pending flags', async () => {
    const persisted = toPersisted(makeLocal());
    const mockFrom = vi.fn().mockReturnValue({
      select: () => ({
        maybeSingle: async () => ({
          data: { revision: 5, tombstone_revision: 3, state_json: persisted },
          error: null,
        }),
      }),
    });
    vi.spyOn(supabaseClient, 'getSupabase').mockReturnValue({
      from: mockFrom,
      storage: { from: () => ({ download: async () => ({ data: null, error: null }) }) },
    } as never);

    const result = await pullCloudState('user-1');
    expect(result.ok).toBe(true);
    if (result.ok && result.exists) {
      expect(result.snapshot.state.sync.lastSyncedRevision).toBe(5);
      expect(result.snapshot.state.sync.pendingChanges).toBe(false);
      expect(result.snapshot.state.sync.tombstoneRevision).toBe(3);
    }
  });

  it('returns error when cloud image download fails', async () => {
    const persisted = toPersisted(makeLocal());
    persisted.observations[0].storagePath = 'user-1/obs-1.jpg';
    const mockFrom = vi.fn().mockReturnValue({
      select: () => ({
        maybeSingle: async () => ({
          data: { revision: 1, tombstone_revision: null, state_json: persisted },
          error: null,
        }),
      }),
    });
    const mockStorage = {
      from: () => ({
        download: async () => ({ data: null, error: { message: 'missing' } }),
      }),
    };
    vi.spyOn(supabaseClient, 'getSupabase').mockReturnValue({
      from: mockFrom,
      storage: mockStorage,
    } as never);

    const result = await pullCloudState('user-1');
    expect(result.ok).toBe(false);
  });

  it('reports photo upload failure without marking synced', async () => {
    const mockStorage = {
      from: () => ({
        upload: async () => ({ error: { message: 'upload failed' } }),
      }),
    };
    vi.spyOn(supabaseClient, 'getSupabase').mockReturnValue({
      storage: mockStorage,
    } as never);

    const local = makeLocal();
    const result = await uploadPendingImages('user-1', local);
    expect(result.allUploaded).toBe(false);
    expect(result.errors.length).toBeGreaterThan(0);
    expect(result.state.observations[0].syncState).toBe('pending_upload');
  });

  it('pushes local garden when cloud snapshot is empty', async () => {
    const local = makeLocal();
    const mockRpc = vi.fn().mockResolvedValue({
      data: { revision: 1, tombstone_revision: null },
      error: null,
    });
    const mockFrom = vi.fn().mockReturnValue({
      select: () => ({
        maybeSingle: async () => ({ data: null, error: null }),
      }),
    });
    const mockStorage = {
      from: () => ({
        upload: async () => ({ error: null }),
      }),
    };
    vi.spyOn(supabaseClient, 'getSupabase').mockReturnValue({
      from: mockFrom,
      rpc: mockRpc,
      storage: mockStorage,
    } as never);

    const result = await syncGarden('user-1', local, false);
    expect(result.status).toBe('synced');
    expect(mockRpc).toHaveBeenCalledWith('upsert_garden_snapshot', {
      p_expected_revision: null,
      p_state_json: expect.any(Object),
    });
  });

  it('returns synced state with uploaded storage metadata after push', async () => {
    const local = makeLocal();
    const obsId = local.observations[0].id;
    const mockRpc = vi.fn().mockResolvedValue({
      data: { revision: 2, tombstone_revision: null },
      error: null,
    });
    const mockFrom = vi.fn().mockReturnValue({
      select: () => ({
        maybeSingle: async () => ({
          data: { revision: 1, tombstone_revision: null, state_json: toPersisted(createEmptyState()) },
          error: null,
        }),
      }),
    });
    const mockStorage = {
      from: () => ({
        upload: async () => ({ error: null }),
        download: async () => ({ data: null, error: null }),
      }),
    };
    vi.spyOn(supabaseClient, 'getSupabase').mockReturnValue({
      from: mockFrom,
      rpc: mockRpc,
      storage: mockStorage,
    } as never);

    local.sync.lastSyncedRevision = 1;
    const result = await syncGarden('user-1', local, false);
    expect(result.status).toBe('synced');
    if (result.status === 'synced') {
      expect(result.state.observations[0].storagePath).toBe(`user-1/${obsId}.jpg`);
      expect(result.state.observations[0].syncState).toBe('synced');
      expect(result.state.sync.lastSyncedRevision).toBe(2);
      expect(result.state.sync.pendingChanges).toBe(false);
    }
  });

  it('rejects wipe when expected revision is stale', async () => {
    const mockRpc = vi.fn().mockResolvedValue({
      data: null,
      error: { message: 'revision_conflict: expected 2 but found 3' },
    });
    vi.spyOn(supabaseClient, 'getSupabase').mockReturnValue({
      rpc: mockRpc,
      storage: { from: () => ({ list: async () => ({ data: [], error: null }) }) },
    } as never);

    const result = await wipeCloudGarden('user-1', 2);
    expect(result.ok).toBe(false);
    expect(result.error).toContain('revision_conflict');
  });

  it('detects conflict on concurrent cloud revision during sync', async () => {
    const local = makeLocal();
    local.sync.lastSyncedRevision = 2;
    const cloudPersisted = toPersisted(createEmptyState());

    const mockRpc = vi.fn()
      .mockResolvedValueOnce({ data: null, error: { message: 'revision_conflict: expected 2 but found 3' } });

    const mockStorage = {
      from: () => ({
        upload: async () => ({ error: null }),
        download: async () => {
          const blob = new Blob(['x'], { type: 'image/jpeg' });
          return { data: blob, error: null };
        },
        list: async () => ({ data: [], error: null }),
        remove: async () => ({ error: null }),
      }),
    };

    let call = 0;
    const mockFromPull = vi.fn().mockImplementation(() => ({
      select: () => ({
        maybeSingle: async () => {
          call += 1;
          if (call === 1) {
            return {
              data: { revision: 3, tombstone_revision: null, state_json: cloudPersisted },
              error: null,
            };
          }
          return {
            data: { revision: 3, tombstone_revision: null, state_json: cloudPersisted },
            error: null,
          };
        },
      }),
    }));

    vi.spyOn(supabaseClient, 'getSupabase').mockReturnValue({
      from: mockFromPull,
      rpc: mockRpc,
      storage: mockStorage,
    } as never);

    const result = await syncGarden('user-1', local, false);
    expect(result.status).toBe('conflict');
  });
});
