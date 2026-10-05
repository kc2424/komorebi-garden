import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useGardenStore } from '../hooks/useGardenStore';
import { useAppSession } from '../hooks/useAppSession';
import { saveObservationAction } from '../storage/gardenActions';
import { createEmptyState, loadState, saveState } from '../storage/persistence';
import { saveDraft } from '../storage/appMeta';
import { applyPulledState, applySyncedState } from '../sync/syncLogic';
import type { User } from '@supabase/supabase-js';
import type { GardenState } from '../types';

const mockUser: User = {
  id: 'user-aaa',
  app_metadata: {},
  user_metadata: {},
  aud: 'authenticated',
  created_at: '',
} as User;

const verifyOtpMock = vi.fn();
const getCurrentUserMock = vi.fn();
const signOutMock = vi.fn();
const syncGardenMock = vi.fn();
const pullCloudStateMock = vi.fn();
const pushCloudStateMock = vi.fn().mockResolvedValue({ ok: true, newRevision: 1 });
let authCallback: ((event: string, session: { user: User | null } | null) => void) | null = null;

const sendOtpMock = vi.fn<(email: string) => Promise<{ ok: boolean }>>(async () => ({ ok: true }));

vi.mock('../sync/authService', () => ({
  sendOtp: (email: string) => sendOtpMock(email),
  verifyOtp: (...args: unknown[]) => verifyOtpMock(...args),
  getCurrentUser: (...args: unknown[]) => getCurrentUserMock(...args),
  signOut: (...args: unknown[]) => signOutMock(...args),
  deleteAccount: vi.fn(async () => ({ ok: true })),
  isAuthEmailDeliveryReady: () => true,
  getAuthPhase: (user: User | null, otpSent: boolean) => {
    if (!user && !otpSent) return 'idle';
    if (!user && otpSent) return 'otp_sent';
    return 'authenticated';
  },
}));

vi.mock('../sync/syncService', () => ({
  syncGarden: (...args: unknown[]) => syncGardenMock(...args),
  pullCloudState: (...args: unknown[]) => pullCloudStateMock(...args),
  pushCloudState: (...args: unknown[]) => pushCloudStateMock(...args),
}));

vi.mock('../sync/supabaseClient', () => ({
  isSupabaseConfigured: () => true,
  getSupabase: () => ({
    auth: {
      onAuthStateChange: (cb: (event: string, session: { user: User | null } | null) => void) => {
        authCallback = cb;
        return { data: { subscription: { unsubscribe: vi.fn() } } };
      },
    },
  }),
}));

function useTestHarness() {
  const store = useGardenStore();
  const session = useAppSession(store);
  return { store, session };
}

describe('useAppSession integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    sendOtpMock.mockResolvedValue({ ok: true });
    localStorage.clear();
    authCallback = null;
    getCurrentUserMock.mockResolvedValue(null);
    syncGardenMock.mockImplementation(async (_uid, state) => ({
      status: 'synced',
      mode: 'noop',
      state: { ...state, sync: { ...state.sync, pendingChanges: false } },
    }));
    pullCloudStateMock.mockResolvedValue({ ok: true, exists: false });
    pushCloudStateMock.mockResolvedValue({ ok: true, newRevision: 1 });
    signOutMock.mockResolvedValue({ ok: true });
  });

  it('sets importPending before verifyOtp resolves so auth callback cannot auto-sync', async () => {
    let resolveVerify: (v: { ok: boolean; user?: User }) => void;
    verifyOtpMock.mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveVerify = resolve;
        }),
    );
    pullCloudStateMock.mockResolvedValue({ ok: true, exists: false });

    const { result } = renderHook(() => useTestHarness());

    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));

    await act(async () => {
      await result.current.session.handleSendOtp('a@test.local');
    });

    let verifyPromise: Promise<unknown>;
    act(() => {
      verifyPromise = result.current.session.handleVerifyOtp('123456');
    });

    await waitFor(() => expect(result.current.session.importPending).toBe(true));
    expect(syncGardenMock).not.toHaveBeenCalled();

    act(() => {
      authCallback?.('SIGNED_IN', { user: mockUser });
    });
    expect(syncGardenMock).not.toHaveBeenCalled();

    await act(async () => {
      resolveVerify!({ ok: true, user: mockUser });
      await verifyPromise!;
    });

    await waitFor(() => expect(result.current.session.importPending).toBe(false));
  });

  it('shows import choice for guest data on empty cloud instead of auto-import', async () => {
    const guest = saveObservationAction(createEmptyState(), {
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa',
      familyName: 'ユリ科',
      trait: 'ゲスト',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,guest',
      isSample: false,
      identificationSource: 'manual',
    }).nextState;
    await saveState(guest, null);

    verifyOtpMock.mockResolvedValue({ ok: true, user: mockUser });
    pullCloudStateMock.mockResolvedValue({ ok: true, exists: false });

    const { result } = renderHook(() => useTestHarness());
    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));

    await act(async () => {
      await result.current.session.handleSendOtp('a@test.local');
      await result.current.session.handleVerifyOtp('123456');
    });

    expect(result.current.session.conflict).not.toBeNull();
    expect(result.current.session.conflict?.info.localObservationCount).toBe(1);
    expect(result.current.session.conflict?.info.cloudObservationCount).toBe(0);
    expect(result.current.session.importPending).toBe(true);
    expect(syncGardenMock).not.toHaveBeenCalled();

    const guestStill = await loadState(null);
    expect(guestStill.state.observations).toHaveLength(1);
  });

  it('persists to user scope after setUserScope', async () => {
    const guest = saveObservationAction(createEmptyState(), {
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa',
      familyName: 'ユリ科',
      trait: 'ゲスト',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,guest',
      isSample: false,
      identificationSource: 'manual',
    }).nextState;

    const { result } = renderHook(() => useGardenStore());
    await act(async () => {
      result.current.setUserScope('user-aaa');
      await result.current.replaceState(guest);
    });

    const userState = await loadState('user-aaa');
    expect(userState.state.observations).toHaveLength(1);
  });

  it('imports guest data after user chooses local on empty cloud', async () => {
    pushCloudStateMock.mockResolvedValue({ ok: true, newRevision: 1 });
    const guest = saveObservationAction(createEmptyState(), {
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa',
      familyName: 'ユリ科',
      trait: 'ゲスト',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,guest',
      isSample: false,
      identificationSource: 'manual',
    }).nextState;
    await saveState(guest, null);

    verifyOtpMock.mockResolvedValue({ ok: true, user: mockUser });
    pullCloudStateMock.mockResolvedValue({ ok: true, exists: false });

    const { result } = renderHook(() => useTestHarness());
    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));

    await act(async () => {
      await result.current.session.handleSendOtp('a@test.local');
      await result.current.session.handleVerifyOtp('123456');
    });

    await waitFor(() => expect(result.current.session.conflict).not.toBeNull());

    await act(async () => {
      await result.current.session.resolveConflict('local');
    });

    expect(pushCloudStateMock).toHaveBeenCalledWith('user-aaa', expect.anything(), null);
    expect(result.current.store.state.observations).toHaveLength(1);
    const userState = await loadState('user-aaa');
    expect(userState.state.observations).toHaveLength(1);

    const clearedGuest = await loadState(null);
    expect(clearedGuest.state.observations).toHaveLength(0);
  });

  it('re-queues sync when local edits happen during runSync', async () => {
    getCurrentUserMock.mockResolvedValue(mockUser);
    const base = createEmptyState();
    base.sync.pendingChanges = true;

    let call = 0;
    syncGardenMock.mockImplementation(async () => {
      call += 1;
      if (call === 1) {
        const bumped = saveObservationAction(createEmptyState(), {
          plantType: 'tulip',
          commonNameJa: '途中編集',
          scientificName: 'Tulipa',
          familyName: 'ユリ科',
          trait: '',
          color: 'red',
          imageDataUrl: 'data:image/jpeg;base64,x',
          isSample: false,
          identificationSource: 'manual',
        }).nextState;
        await resultRef.current.store.replaceState(bumped);
        return { status: 'synced', mode: 'push', state: createEmptyState() };
      }
      return { status: 'synced', mode: 'noop', state: createEmptyState() };
    });

    const resultRef: { current: ReturnType<typeof useTestHarness> } = { current: null! };
    const { result } = renderHook(() => {
      resultRef.current = useTestHarness();
      return resultRef.current;
    });

    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));
    await act(async () => {
      await result.current.store.replaceState(base);
    });

    await act(async () => {
      await result.current.session.runSync();
    });

    expect(syncGardenMock.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it('does not false-conflict after acknowledging a successful push', async () => {
    getCurrentUserMock.mockResolvedValue(mockUser);
    const local = saveObservationAction(createEmptyState(), {
      plantType: 'tulip',
      commonNameJa: '引き継ぎ確認 9/10',
      scientificName: 'Tulipa',
      familyName: 'ユリ科',
      trait: '',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,x',
      isSample: false,
      identificationSource: 'manual',
    }).nextState;
    local.sync.lastSyncedRevision = 1;

    syncGardenMock.mockImplementation(async (_uid, state) => ({
      status: 'synced',
      mode: 'push',
      state: applySyncedState(
        {
          ...state,
          observations: state.observations.map((obs: (typeof state.observations)[number]) => ({
            ...obs,
            storagePath: `user-aaa/${obs.id}.jpg`,
            syncState: 'synced' as const,
          })),
        },
        2,
        null,
      ),
    }));

    const { result } = renderHook(() => useTestHarness());
    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));

    await act(async () => {
      await result.current.store.replaceState(local);
    });

    await waitFor(() => {
      expect(result.current.session.conflict).toBeNull();
      expect(result.current.store.state.sync.pendingChanges).toBe(false);
      expect(result.current.store.state.sync.lastSyncedRevision).toBe(2);
      expect(result.current.store.state.observations[0]?.storagePath).toBe(
        `user-aaa/${local.observations[0].id}.jpg`,
      );
    });
  });

  it('pull on empty device retains cloud observations and plants', async () => {
    getCurrentUserMock.mockResolvedValue(mockUser);
    const cloud = saveObservationAction(createEmptyState(), {
      plantType: 'tulip',
      commonNameJa: '引き継ぎ確認 9/10',
      scientificName: 'Tulipa',
      familyName: 'ユリ科',
      trait: '',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,cloud',
      isSample: false,
      identificationSource: 'manual',
    }).nextState;
    cloud.observations[0].storagePath = 'user-aaa/cloud.jpg';
    cloud.observations[0].syncState = 'synced';

    syncGardenMock.mockImplementation(async () => ({
      status: 'synced',
      mode: 'pull',
      state: applyPulledState(cloud, 2, null),
    }));

    const { result } = renderHook(() => useTestHarness());
    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));

    await waitFor(() => {
      expect(result.current.store.state.observations).toHaveLength(1);
      expect(result.current.store.state.observations[0]?.commonNameJa).toBe('引き継ぎ確認 9/10');
      expect(result.current.store.state.observations[0]?.storagePath).toBe('user-aaa/cloud.jpg');
      expect(result.current.store.state.sync.lastSyncedRevision).toBe(2);
      expect(result.current.session.syncStatus).toBe('synced');
    });
  });

  it('preserves concurrent edits during push acknowledgement and re-queues sync', async () => {
    getCurrentUserMock.mockResolvedValue(mockUser);
    const local = saveObservationAction(createEmptyState(), {
      plantType: 'tulip',
      commonNameJa: '同期前',
      scientificName: 'Tulipa',
      familyName: 'ユリ科',
      trait: '',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,x',
      isSample: false,
      identificationSource: 'manual',
    }).nextState;
    local.sync.lastSyncedRevision = 1;
    local.sync.pendingChanges = true;

    let pushed = false;
    syncGardenMock.mockImplementation(async (_uid, state: GardenState) => {
      const shouldPush = state.observations.some((o) => o.commonNameJa === '同期前');
      if (shouldPush && !pushed) {
        pushed = true;
        const edited = saveObservationAction(state, {
          plantType: 'tulip',
          commonNameJa: '途中編集',
          scientificName: 'Tulipa',
          familyName: 'ユリ科',
          trait: '',
          color: 'yellow',
          imageDataUrl: 'data:image/jpeg;base64,y',
          isSample: false,
          identificationSource: 'manual',
        }).nextState;
        await resultRef.current.store.replaceState(edited);
        return {
          status: 'synced',
          mode: 'push',
          state: applySyncedState(
            {
              ...state,
              observations: state.observations.map((obs: (typeof state.observations)[number]) => ({
                ...obs,
                storagePath: `user-aaa/${obs.id}.jpg`,
                syncState: 'synced' as const,
              })),
            },
            2,
            null,
          ),
        };
      }
      return { status: 'synced', mode: 'noop', state: applySyncedState(state, 2, null) };
    });

    const resultRef: { current: ReturnType<typeof useTestHarness> } = { current: null! };
    const { result } = renderHook(() => {
      resultRef.current = useTestHarness();
      return resultRef.current;
    });

    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));
    await act(async () => {
      await result.current.store.replaceState(local);
      await result.current.session.runSync();
    });

    await waitFor(() => {
      expect(syncGardenMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(result.current.store.state.observations).toHaveLength(2);
      expect(result.current.store.state.observations.some((o) => o.commonNameJa === '途中編集')).toBe(true);
      expect(result.current.store.state.sync.lastSyncedRevision).toBe(2);
      expect(result.current.store.state.observations[0]?.storagePath).toBe(
        `user-aaa/${local.observations[0].id}.jpg`,
      );
    });
  });

  it('preserves concurrent edits during noop acknowledgement and re-queues push', async () => {
    getCurrentUserMock.mockResolvedValue(mockUser);
    const local = saveObservationAction(createEmptyState(), {
      plantType: 'tulip',
      commonNameJa: '同期済み',
      scientificName: 'Tulipa',
      familyName: 'ユリ科',
      trait: '',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,x',
      isSample: false,
      identificationSource: 'manual',
    }).nextState;
    local.sync.lastSyncedRevision = 2;
    local.sync.pendingChanges = false;

    let pushed = false;
    syncGardenMock.mockImplementation(async (_uid, state: GardenState) => {
      const isSyncedBaseline = state.observations.some((o) => o.commonNameJa === '同期済み');
      if (!pushed && isSyncedBaseline && !state.sync.pendingChanges) {
        const edited = saveObservationAction(state, {
          plantType: 'tulip',
          commonNameJa: '途中編集',
          scientificName: 'Tulipa',
          familyName: 'ユリ科',
          trait: '',
          color: 'yellow',
          imageDataUrl: 'data:image/jpeg;base64,y',
          isSample: false,
          identificationSource: 'manual',
        }).nextState;
        await resultRef.current.store.replaceState(edited);
        return { status: 'synced', mode: 'noop', state: applySyncedState(state, 2, null) };
      }
      if (!pushed && state.observations.some((o) => o.commonNameJa === '途中編集')) {
        pushed = true;
        return {
          status: 'synced',
          mode: 'push',
          state: applySyncedState(
            {
              ...state,
              observations: state.observations.map((obs) => ({
                ...obs,
                storagePath: `user-aaa/${obs.id}.jpg`,
                syncState: 'synced' as const,
              })),
            },
            3,
            null,
          ),
        };
      }
      return { status: 'synced', mode: 'noop', state: applySyncedState(state, 3, null) };
    });

    const resultRef: { current: ReturnType<typeof useTestHarness> } = { current: null! };
    const { result } = renderHook(() => {
      resultRef.current = useTestHarness();
      return resultRef.current;
    });

    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));
    await act(async () => {
      await result.current.store.replaceState(local);
      await result.current.session.runSync();
    });

    await waitFor(() => {
      expect(syncGardenMock.mock.calls.length).toBeGreaterThanOrEqual(2);
      expect(result.current.store.state.observations).toHaveLength(2);
      expect(result.current.store.state.observations.some((o) => o.commonNameJa === '途中編集')).toBe(true);
      expect(result.current.store.state.sync.pendingChanges).toBe(false);
      expect(result.current.store.state.sync.lastSyncedRevision).toBe(3);
      expect(
        result.current.store.state.observations.find((o) => o.commonNameJa === '途中編集')?.storagePath,
      ).toBe(`user-aaa/${result.current.store.state.observations[1]?.id}.jpg`);
    });
  });

  it('ignores stale conflict when local revision changed during sync', async () => {
    getCurrentUserMock.mockResolvedValue(mockUser);
    const local = saveObservationAction(createEmptyState(), {
      plantType: 'tulip',
      commonNameJa: '競合テスト',
      scientificName: 'Tulipa',
      familyName: 'ユリ科',
      trait: '',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,x',
      isSample: false,
      identificationSource: 'manual',
    }).nextState;
    local.sync.lastSyncedRevision = 1;
    local.sync.pendingChanges = true;

    syncGardenMock.mockImplementation(async (_uid, state: GardenState) => {
      if (!state.observations.some((o) => o.commonNameJa === '競合テスト')) {
        return { status: 'synced', mode: 'noop', state: applySyncedState(state, 1, null) };
      }
      const edited = saveObservationAction(state, {
        plantType: 'tulip',
        commonNameJa: '途中編集',
        scientificName: 'Tulipa',
        familyName: 'ユリ科',
        trait: '',
        color: 'yellow',
        imageDataUrl: 'data:image/jpeg;base64,y',
        isSample: false,
        identificationSource: 'manual',
      }).nextState;
      await resultRef.current.store.replaceState(edited);
      return {
        status: 'conflict',
        info: {
          cloudRevision: 3,
          localRevision: state.sync.revision,
          cloudObservationCount: 0,
          localObservationCount: 1,
          cloudPlantCount: 0,
          localPlantCount: 0,
        },
        cloudState: createEmptyState(),
        localState: state,
      };
    });

    const resultRef: { current: ReturnType<typeof useTestHarness> } = { current: null! };
    const { result } = renderHook(() => {
      resultRef.current = useTestHarness();
      return resultRef.current;
    });

    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));
    await act(async () => {
      await result.current.store.replaceState(local);
      await result.current.session.runSync();
    });

    await waitFor(() => {
      expect(result.current.session.conflict).toBeNull();
      expect(result.current.store.state.observations).toHaveLength(2);
    });
  });

  it('pulls on resume even when pendingChanges is false', async () => {
    getCurrentUserMock.mockResolvedValue(mockUser);
    syncGardenMock.mockResolvedValue({
      status: 'synced',
      mode: 'noop',
      state: { ...createEmptyState(), sync: { revision: 0, lastSyncedRevision: 2, pendingChanges: false, lastSyncAt: null, lastError: null, tombstoneRevision: null } },
    });

    const { result } = renderHook(() => useTestHarness());
    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));
    await waitFor(() => expect(syncGardenMock).toHaveBeenCalled());
  });

  it('ignores stale OTP send after resetOtpFlow', async () => {
    let resolveSend: (v: { ok: boolean }) => void;
    sendOtpMock.mockImplementationOnce(
      () =>
        new Promise((resolve) => {
          resolveSend = resolve;
        }),
    );

    const { result } = renderHook(() => useTestHarness());
    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));

    let sendPromise: Promise<unknown>;
    act(() => {
      sendPromise = result.current.session.handleSendOtp('old@test.local');
      result.current.session.resetOtpFlow();
    });

    await act(async () => {
      resolveSend!({ ok: true });
      await sendPromise!;
    });

    expect(result.current.session.otpEmail).toBeNull();
    expect(result.current.session.authPhase).toBe('idle');
  });

  it('clears draft and conflict on logout', async () => {
    getCurrentUserMock.mockResolvedValue(mockUser);
    const { result } = renderHook(() => useTestHarness());
    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));

    await act(async () => {
      await saveDraft({ step: 'photo-confirm', source: 'camera', imageDataUrl: 'data:image/jpeg;base64,x' });
      await result.current.session.persistDraft({
        step: 'photo-confirm',
        source: 'camera',
        imageDataUrl: 'data:image/jpeg;base64,x',
      });
    });
    expect(result.current.session.draft).not.toBeNull();

    syncGardenMock.mockResolvedValueOnce({
      status: 'conflict',
      info: {
        cloudRevision: 2,
        localRevision: 1,
        cloudObservationCount: 0,
        localObservationCount: 1,
        cloudPlantCount: 0,
        localPlantCount: 0,
      },
      cloudState: createEmptyState(),
      localState: createEmptyState(),
    });

    await act(async () => {
      await result.current.session.runSync();
    });
    expect(result.current.session.conflict).not.toBeNull();

    await act(async () => {
      await result.current.session.handleSignOut(true);
    });

    expect(result.current.session.draft).toBeNull();
    expect(result.current.session.conflict).toBeNull();
    expect(result.current.session.user).toBeNull();
  });

  it('keeps draft, user scope, and garden when signOut fails; retry succeeds', async () => {
    getCurrentUserMock.mockResolvedValue(mockUser);
    const guest = saveObservationAction(createEmptyState(), {
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa',
      familyName: 'ユリ科',
      trait: 'ログアウト保護',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,logout',
      isSample: false,
      identificationSource: 'manual',
    }).nextState;

    const { result } = renderHook(() => useTestHarness());
    await waitFor(() => expect(result.current.session.metaLoaded).toBe(true));

    await act(async () => {
      await result.current.store.replaceState(guest);
      await saveDraft({ step: 'photo-confirm', source: 'camera', imageDataUrl: 'data:image/jpeg;base64,x' });
      await result.current.session.persistDraft({
        step: 'photo-confirm',
        source: 'camera',
        imageDataUrl: 'data:image/jpeg;base64,x',
      });
    });

    const userStateBefore = await loadState('user-aaa');
    expect(userStateBefore.state.observations).toHaveLength(1);
    expect(result.current.session.draft).not.toBeNull();
    expect(result.current.session.user?.id).toBe('user-aaa');

    signOutMock.mockResolvedValueOnce({
      ok: false,
      error: '通信に失敗しました。接続を確認してからもう一度お試しください。',
    });

    const failedResult = await act(async () => result.current.session.handleSignOut(true));

    expect(failedResult).toEqual({
      needsConfirm: false,
      ok: false,
      error: '通信に失敗しました。接続を確認してからもう一度お試しください。',
    });
    expect(result.current.session.user?.id).toBe('user-aaa');
    expect(result.current.session.draft).not.toBeNull();
    const userStateAfterFail = await loadState('user-aaa');
    expect(userStateAfterFail.state.observations).toHaveLength(1);
    const guestAfterFail = await loadState(null);
    expect(guestAfterFail.state.observations).toHaveLength(0);

    signOutMock.mockResolvedValueOnce({ ok: true });
    await act(async () => {
      const retryResult = await result.current.session.handleSignOut(true);
      expect(retryResult).toEqual({ needsConfirm: false, ok: true });
    });

    expect(result.current.session.user).toBeNull();
    expect(result.current.session.draft).toBeNull();
    const clearedUser = await loadState('user-aaa');
    expect(clearedUser.state.observations).toHaveLength(0);
  });
});
