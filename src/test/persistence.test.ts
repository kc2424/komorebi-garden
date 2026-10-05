import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createEmptyState,
  loadState,
  saveState,
} from '../storage/persistence';
import { getLocalDb, GUEST_SCOPE, resetLocalDbForTests } from '../storage/localDb';
import {
  saveObservationAction,
  addSoilTileAction,
  removeSoilTileAction,
  plantTulipAction,
  stashPlantAction,
  getAddableSoilPositions,
} from '../storage/gardenActions';

describe('persistence v3', () => {
  beforeEach(async () => {
    resetLocalDbForTests();
    localStorage.clear();
    const db = await getLocalDb();
    await db.delete('garden', GUEST_SCOPE);
  });

  it('creates empty state with default 5x5 grass', () => {
    const state = createEmptyState();
    expect(state.version).toBe(3);
    expect(state.soilTiles).toHaveLength(25);
    expect(state.soilTiles.every((tile) => tile.surface === 'grass')).toBe(true);
    expect(state.tulipUnlocked).toBe(false);
    expect(state.sync.revision).toBe(0);
  });

  it('saves and loads v3 state with separated images', async () => {
    const state = createEmptyState();
    const { nextState } = saveObservationAction(state, {
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,abc',
      trait: '',
      isSample: true,
      identificationSource: 'sample',
    });
    const result = await saveState(nextState);
    expect(result.ok).toBe(true);

    const loaded = await loadState();
    expect(loaded.state.observations).toHaveLength(1);
    expect(loaded.state.tulipUnlocked).toBe(true);
    expect(loaded.state.observations[0].imageDataUrl).toBe('data:image/jpeg;base64,abc');
  });

  it('migrates v1 observations without losing data', async () => {
    localStorage.setItem(
      'komorebi-garden-v1',
      JSON.stringify({
        version: 1,
        collections: [{
          speciesId: 'species-sakura',
          firstFoundAt: '2026-01-01',
          lastFoundAt: '2026-01-01',
          foundCount: 1,
          memo: '',
        }],
        observations: [{
          id: 'obs-1',
          speciesId: 'species-sakura',
          imageDataUrl: 'data:image/jpeg;base64,legacy',
          takenAt: '2026-01-01',
          memo: '',
          isSample: true,
          createdAt: '2026-01-01',
        }],
        placements: [],
        gardenMode: 'storybook',
        previewState: 'user',
      }),
    );

    const loaded = await loadState();
    expect(loaded.migrated).toBe(true);
    expect(loaded.state.observations).toHaveLength(1);
    expect(loaded.state.observations[0].commonNameJa).toBe('ソメイヨシノ');
    expect(loaded.state.legacyV1?.observations).toHaveLength(1);
    expect(localStorage.getItem('komorebi-garden-v1')).toBeTruthy();
  });

  it('reports save failure without false success', async () => {
    const dbModule = await import('../storage/localDb');
    const db = await dbModule.getLocalDb();
    const put = vi.spyOn(db, 'put').mockRejectedValue(new DOMException('QuotaExceededError'));
    const result = await saveState(createEmptyState());
    expect(result.ok).toBe(false);
    put.mockRestore();
  });
});

describe('gardenActions v3', () => {
  it('unlocks tulip on first tulip observation', () => {
    const state = createEmptyState();
    const { nextState } = saveObservationAction(state, {
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      color: 'yellow',
      imageDataUrl: 'data:image/jpeg;base64,x',
      trait: '',
      isSample: false,
      identificationSource: 'manual',
    });
    expect(nextState.tulipUnlocked).toBe(true);
    expect(nextState.sync.pendingChanges).toBe(true);
  });

  it('does not unlock tulip for other plants', () => {
    const state = createEmptyState();
    const { nextState } = saveObservationAction(state, {
      plantType: 'other',
      commonNameJa: '紫陽花',
      scientificName: 'Hydrangea macrophylla',
      familyName: 'アジサイ科',
      color: null,
      imageDataUrl: 'data:image/jpeg;base64,x',
      trait: '',
      isSample: false,
      identificationSource: 'manual',
    });
    expect(nextState.tulipUnlocked).toBe(false);
  });

  it('adds soil adjacent to existing tiles', () => {
    const state = createEmptyState();
    const positions = getAddableSoilPositions(state);
    expect(positions.length).toBeGreaterThan(0);
    const next = addSoilTileAction(state, positions[0].x, positions[0].z);
    expect(next.soilTiles.length).toBe(state.soilTiles.length + 1);
  });

  it('stashes plant when soil is removed', () => {
    let state = createEmptyState();
    state = { ...state, tulipUnlocked: true };
    const tile = state.soilTiles[0];
    state = plantTulipAction(state, tile.id, 'pink');
    expect(state.plants).toHaveLength(1);

    state = removeSoilTileAction(state, tile.id);
    expect(state.plants).toHaveLength(0);
    expect(state.stashedPlants).toHaveLength(1);
    expect(state.soilTiles.find((t) => t.id === tile.id)).toBeUndefined();
  });

  it('allows multiple tulips after unlock', () => {
    let state = createEmptyState();
    state = { ...state, tulipUnlocked: true };
    const [a, b] = state.soilTiles;
    state = plantTulipAction(state, a.id, 'red');
    state = plantTulipAction(state, b.id, 'yellow');
    expect(state.plants).toHaveLength(2);
  });

  it('stashes plant without deleting observation', () => {
    let state = createEmptyState();
    state = {
      ...state,
      tulipUnlocked: true,
      observations: [{
        id: 'obs-1',
        plantType: 'tulip',
        commonNameJa: 'チューリップ',
        scientificName: 'Tulipa gesneriana',
        familyName: 'ユリ科',
        color: 'red',
        imageRef: 'img-obs-1',
        imageDataUrl: 'data:image/jpeg;base64,x',
        trait: '',
        takenAt: '2026-01-01',
        memo: '',
        isSample: false,
        identificationSource: 'manual',
        createdAt: '2026-01-01',
      }],
    };
    const tile = state.soilTiles[0];
    state = plantTulipAction(state, tile.id, 'red');
    const plantId = state.plants[0].id;
    state = stashPlantAction(state, plantId);
    expect(state.plants).toHaveLength(0);
    expect(state.stashedPlants).toHaveLength(1);
    expect(state.observations).toHaveLength(1);
  });
});
