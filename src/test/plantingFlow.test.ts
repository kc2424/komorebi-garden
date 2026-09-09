import { describe, it, expect } from 'vitest';
import {
  plantFlowerAction,
  plantFromStashAction,
  stashPlantAction,
  linkPlantObservationAction,
} from '../storage/gardenActions';
import { createEmptyState, loadState, saveState } from '../storage/persistence';
import {
  buildPlacedPlant,
  canBeginPendingPlacement,
  canSelectFlowerModel,
  cycleEmptyTileId,
  getEmptySoilTiles,
} from '../utils/plantingFlow';
import { resolvePlantModelType } from '../utils/plantModel';

describe('plantingFlow helpers', () => {
  it('lists only empty soil tiles', () => {
    let state = createEmptyState();
    state = { ...state, tulipUnlocked: true };
    const tile = state.soilTiles[0];
    state = plantFlowerAction(state, tile.id, 'cosmos', 'pink');
    const empty = getEmptySoilTiles(state);
    expect(empty.some((t) => t.id === tile.id)).toBe(false);
    expect(empty.length).toBe(state.soilTiles.length - 1);
  });

  it('allows cosmos and pansy without tulip unlock', () => {
    const state = createEmptyState();
    expect(canSelectFlowerModel('cosmos', false)).toBe(true);
    expect(canSelectFlowerModel('pansy', false)).toBe(true);
    expect(canSelectFlowerModel('tulip', false)).toBe(false);
    const tile = state.soilTiles[0];
    expect(canBeginPendingPlacement(state, tile.id, 'cosmos', false)).toBe(true);
    expect(canBeginPendingPlacement(state, tile.id, 'tulip', false)).toBe(false);
  });

  it('cycles empty tile selection for keyboard navigation', () => {
    const state = createEmptyState();
    const empty = getEmptySoilTiles(state);
    const first = empty[0].id;
    const second = cycleEmptyTileId(empty, first, 1);
    expect(second).not.toBe(first);
    expect(cycleEmptyTileId(empty, null, 1)).toBe(first);
  });

  it('buildPlacedPlant keeps the pending preview rotation', () => {
    const plant = buildPlacedPlant({
      modelType: 'pansy',
      color: 'pink',
      tileId: 'soil-0-0',
      rotation: 1.25,
    });
    expect(plant.rotation).toBe(1.25);
    expect(plant.modelType).toBe('pansy');
  });

  it('plantFlowerAction stores an explicit rotation instead of randomizing', () => {
    let state = createEmptyState();
    const tile = state.soilTiles[0];
    const rotation = 0.875;
    state = plantFlowerAction(state, tile.id, 'cosmos', 'pink', null, rotation);
    expect(state.plants[0].rotation).toBe(rotation);
  });
});

describe('flower model persistence', () => {
  it('keeps unspecified modelType as tulip on read', () => {
    const state = createEmptyState();
    const legacyPlant = {
      id: 'legacy',
      color: 'white' as const,
      tileId: state.soilTiles[0].id,
      rotation: 0,
    };
    const saved = {
      ...state,
      tulipUnlocked: true,
      plants: [legacyPlant],
    };
    saveState(saved);
    const loaded = loadState();
    expect(resolvePlantModelType(loaded.state.plants[0])).toBe('tulip');
    expect(loaded.state.plants[0].modelType).toBeUndefined();
  });

  it('round-trips cosmos and pansy through save/load', () => {
    let state = createEmptyState();
    const [a, b] = state.soilTiles;
    state = plantFlowerAction(state, a.id, 'cosmos', 'pink');
    state = plantFlowerAction(state, b.id, 'pansy', 'purple');
    saveState(state);
    const loaded = loadState();
    expect(loaded.state.plants.map((p) => resolvePlantModelType(p))).toEqual(['cosmos', 'pansy']);
  });

  it('preserves modelType through stash and restore', () => {
    let state = createEmptyState();
    const tile = state.soilTiles[0];
    state = plantFlowerAction(state, tile.id, 'cosmos', 'pink');
    const plantId = state.plants[0].id;
    state = stashPlantAction(state, plantId);
    expect(state.stashedPlants[0].modelType).toBe('cosmos');

    const target = state.soilTiles[1];
    state = plantFromStashAction(state, plantId, target.id);
    expect(state.plants[0].modelType).toBe('cosmos');
    expect(state.plants[0].tileId).toBe(target.id);
  });

  it('strips observation links from non-tulip models on normalize', () => {
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
    state = plantFlowerAction(state, tile.id, 'cosmos', 'pink');
    state = {
      ...state,
      plants: [{
        ...state.plants[0],
        observationIds: ['obs-1'],
      }],
    };
    saveState(state);
    const loaded = loadState();
    expect(loaded.state.plants[0].observationIds).toBeUndefined();
  });

  it('rejects linking tulip observations to cosmos plants', () => {
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
    state = plantFlowerAction(state, tile.id, 'cosmos', 'pink');
    const plantId = state.plants[0].id;
    state = linkPlantObservationAction(state, plantId, 'obs-1');
    expect(state.plants[0].observationIds).toBeUndefined();
  });
});
