import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyState } from '../storage/migration';
import { saveObservationAction } from '../storage/gardenActions';
import { exportBackup, importBackup, mergeRestoredState, validateBackup, parseBackupFile, createWipeState } from '../storage/backup';
import { resetLocalDbForTests } from '../storage/localDb';

describe('backup', () => {
  beforeEach(() => {
    resetLocalDbForTests();
  });

  it('exports and imports backup with images', async () => {
    let state = createEmptyState();
    const { nextState } = saveObservationAction(state, {
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,testdata',
      trait: 'テスト特徴',
      isSample: true,
      identificationSource: 'sample',
    });
    state = nextState;

    const backup = await exportBackup(state);
    expect(validateBackup(backup).ok).toBe(true);
    expect(backup.images).toHaveLength(1);

    const restored = await importBackup(backup);
    expect(restored.observations).toHaveLength(1);
    expect(restored.observations[0].imageDataUrl).toBe('data:image/jpeg;base64,testdata');
  });

  it('rejects corrupted backup', () => {
    const result = parseBackupFile('{ invalid json');
    expect(result.error).toBeTruthy();
  });

  it('mergeRestoredState keeps current CAS baseline and marks pending local revision', () => {
    const current = createEmptyState();
    current.sync = {
      revision: 5,
      lastSyncedRevision: 4,
      tombstoneRevision: 3,
      pendingChanges: false,
      lastSyncAt: '2026-09-01T00:00:00.000Z',
      lastError: null,
    };

    const restored = createEmptyState();
    restored.observations = [{
      id: 'obs-1',
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      trait: '',
      color: 'red',
      imageRef: 'img-obs-1',
      imageDataUrl: 'data:image/jpeg;base64,testdata',
      takenAt: '2026-09-10T00:00:00.000Z',
      memo: '',
      isSample: true,
      identificationSource: 'sample',
      createdAt: '2026-09-10T00:00:00.000Z',
    }];
    restored.sync = {
      revision: 99,
      lastSyncedRevision: 88,
      tombstoneRevision: 77,
      pendingChanges: false,
      lastSyncAt: '2026-01-01T00:00:00.000Z',
      lastError: 'old',
    };

    const merged = mergeRestoredState(current, restored);
    expect(merged.observations).toHaveLength(1);
    expect(merged.sync.lastSyncedRevision).toBe(4);
    expect(merged.sync.tombstoneRevision).toBe(3);
    expect(merged.sync.revision).toBe(100);
    expect(merged.sync.pendingChanges).toBe(true);
    expect(merged.sync.lastSyncAt).toBe('2026-09-01T00:00:00.000Z');
    expect(merged.sync.lastError).toBeNull();
  });

  it('createWipeState keeps server tombstone after cloud wipe', () => {
    const wiped = createWipeState(12, 11);
    expect(wiped.sync.revision).toBe(12);
    expect(wiped.sync.lastSyncedRevision).toBe(12);
    expect(wiped.sync.tombstoneRevision).toBe(11);
    expect(wiped.sync.pendingChanges).toBe(false);
  });
});
