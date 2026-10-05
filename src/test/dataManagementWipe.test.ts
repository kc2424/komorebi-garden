import { describe, it, expect, beforeEach } from 'vitest';
import { createEmptyState } from '../storage/migration';
import { saveObservationAction } from '../storage/gardenActions';
import {
  clearScopeData,
  clearScopeWipeArtifacts,
  loadState,
  saveState,
} from '../storage/persistence';
import { createWipeState } from '../storage/backup';
import { loadAppMeta, setOnboardingComplete } from '../storage/appMeta';
import { loadImage } from '../storage/imageStore';
import { toPersisted } from '../storage/serializableState';
import { getLocalDb, GUEST_SCOPE, resetLocalDbForTests } from '../storage/localDb';

const V2_KEY = 'komorebi-garden-v2';

/** Mirrors DataManagementScreen handleWipe local persistence (post-cloud wipe). */
async function applyLocalWipePersistence(
  userId: string | null,
  wiped: ReturnType<typeof createWipeState>,
): Promise<{ ok: boolean; error?: string }> {
  await clearScopeWipeArtifacts(userId);
  const result = await saveState(wiped, userId);
  if (!result.ok) return { ok: false, error: result.error };
  if (!userId) {
    await setOnboardingComplete(false);
  }
  return { ok: true };
}

describe('data management wipe persistence', () => {
  beforeEach(async () => {
    resetLocalDbForTests();
    localStorage.clear();
  });

  it('keeps tombstone-bearing empty garden after authenticated wipe reload', async () => {
    const userId = 'user-wipe-test';
    let state = createEmptyState();
    const { nextState } = saveObservationAction(state, {
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,wipe-test',
      trait: 'テスト',
      isSample: true,
      identificationSource: 'sample',
    });
    state = nextState;
    await saveState(state, userId);

    const imageRef = state.observations[0].imageRef;
    expect(await loadImage(imageRef)).toBeTruthy();

    const wiped = createWipeState(12, 11);
    const applied = await applyLocalWipePersistence(userId, wiped);
    expect(applied.ok).toBe(true);
    expect(await loadImage(imageRef)).toBeNull();

    const loaded = await loadState(userId);
    expect(loaded.state.observations).toHaveLength(0);
    expect(loaded.state.plants).toHaveLength(0);
    expect(loaded.state.sync.revision).toBe(12);
    expect(loaded.state.sync.lastSyncedRevision).toBe(12);
    expect(loaded.state.sync.tombstoneRevision).toBe(11);
    expect(loaded.state.sync.pendingChanges).toBe(false);
  });

  it('regression: clearScopeData after save deletes the wipe baseline', async () => {
    const userId = 'user-wipe-regression';
    const wiped = createWipeState(12, 11);
    await saveState(wiped, userId);
    await clearScopeData(userId);

    const loaded = await loadState(userId);
    expect(loaded.state.sync.tombstoneRevision).toBeNull();
    expect(loaded.state.sync.revision).toBe(0);
    expect(loaded.state.sync.lastSyncedRevision).toBeNull();
  });

  it('guest wipe clears shelved and legacy v2 without resurrecting on reload', async () => {
    localStorage.setItem(
      V2_KEY,
      JSON.stringify({
        version: 2,
        soilTiles: [{ id: 'soil-0-0', x: 0, z: 0 }],
        plants: [{
          id: 'legacy-plant',
          color: 'red',
          tileId: 'soil-0-0',
          rotation: 0,
        }],
        stashedPlants: [],
        observations: [{
          id: 'legacy-obs',
          plantType: 'tulip',
          commonNameJa: '旧データ',
          scientificName: 'Tulipa gesneriana',
          familyName: 'ユリ科',
          color: 'red',
          imageDataUrl: 'data:image/jpeg;base64,legacy',
          takenAt: '2026-09-01T00:00:00.000Z',
          memo: '',
          isSample: true,
          identificationSource: 'sample',
          createdAt: '2026-09-01T00:00:00.000Z',
        }],
        tulipUnlocked: true,
      }),
    );

    let state = createEmptyState();
    const { nextState } = saveObservationAction(state, {
      plantType: 'tulip',
      commonNameJa: '現行',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      color: 'yellow',
      imageDataUrl: 'data:image/jpeg;base64,current',
      trait: '',
      isSample: true,
      identificationSource: 'sample',
    });
    state = nextState;
    await saveState(state, null);
    await setOnboardingComplete(true);

    const db = await getLocalDb();
    await db.put('shelved', {
      id: 'shelved-guest',
      userScope: GUEST_SCOPE,
      label: '退避',
      stateJson: JSON.stringify(toPersisted(state)),
      savedAt: new Date().toISOString(),
    });

    const wiped = createWipeState();
    const applied = await applyLocalWipePersistence(null, wiped);
    expect(applied.ok).toBe(true);

    const meta = await loadAppMeta();
    expect(meta.onboardingComplete).toBe(false);

    const shelvedAfter = await db.getAll('shelved');
    expect(shelvedAfter.filter((row) => row.userScope === GUEST_SCOPE)).toHaveLength(0);
    expect(localStorage.getItem(V2_KEY)).toBeNull();

    const loaded = await loadState(null);
    expect(loaded.migrated).toBeUndefined();
    expect(loaded.state.observations).toHaveLength(0);
    expect(loaded.state.plants).toHaveLength(0);
    expect(loaded.state.tulipUnlocked).toBe(false);
  });
});
