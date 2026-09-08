import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  createEmptyState,
  loadState,
  saveState,
} from '../storage/persistence';
import {
  saveObservationAction,
  addSoilTileAction,
  removeSoilTileAction,
  plantTulipAction,
  stashPlantAction,
  getAddableSoilPositions,
} from '../storage/gardenActions';

describe('persistence v2', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates empty state with default 3x3 soil', () => {
    const state = createEmptyState();
    expect(state.version).toBe(2);
    expect(state.soilTiles).toHaveLength(9);
    expect(state.tulipUnlocked).toBe(false);
  });

  it('saves and loads v2 state', () => {
    const state = createEmptyState();
    const { nextState } = saveObservationAction(state, {
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,abc',
      isSample: true,
      identificationSource: 'sample',
    });
    const result = saveState(nextState);
    expect(result.ok).toBe(true);

    const loaded = loadState();
    expect(loaded.state.observations).toHaveLength(1);
    expect(loaded.state.tulipUnlocked).toBe(true);
  });

  it('migrates v1 observations without losing data', () => {
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

    const loaded = loadState();
    expect(loaded.migrated).toBe(true);
    expect(loaded.state.observations).toHaveLength(1);
    expect(loaded.state.observations[0].commonNameJa).toBe('ソメイヨシノ');
    expect(loaded.state.legacyV1?.observations).toHaveLength(1);
    expect(localStorage.getItem('komorebi-garden-v1')).toBeTruthy();
  });

  it('reports save failure without false success', () => {
    const setItem = vi.spyOn(Storage.prototype, 'setItem');
    setItem.mockImplementation(() => {
      throw new DOMException('QuotaExceededError');
    });
    const result = saveState(createEmptyState());
    expect(result.ok).toBe(false);
    setItem.mockRestore();
  });
});

describe('gardenActions v2', () => {
  it('unlocks tulip on first tulip observation', () => {
    const state = createEmptyState();
    const { nextState } = saveObservationAction(state, {
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      color: 'yellow',
      imageDataUrl: 'data:image/jpeg;base64,x',
      isSample: false,
      identificationSource: 'manual',
    });
    expect(nextState.tulipUnlocked).toBe(true);
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
        imageDataUrl: 'data:image/jpeg;base64,x',
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
