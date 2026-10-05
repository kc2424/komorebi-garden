import { describe, it, expect } from 'vitest';
import type { GardenPlant, PlantObservation } from '../types';
import {
  getLinkedObservations,
  resolvePlantForObservation,
} from '../utils/plantObservationLink';
import {
  plantTulipAction,
  linkPlantObservationAction,
} from '../storage/gardenActions';
import { createEmptyState, loadState, saveState } from '../storage/persistence';

const baseObservation = (id: string): PlantObservation => ({
  id,
  plantType: 'tulip',
  commonNameJa: 'チューリップ',
  scientificName: 'Tulipa gesneriana',
  familyName: 'ユリ科',
  trait: '',
  color: 'red',
  imageRef: `img-${id}`,
  imageDataUrl: 'data:image/jpeg;base64,x',
  takenAt: '2026-01-01',
  memo: '',
  isSample: false,
  identificationSource: 'manual',
  createdAt: '2026-01-01',
});

describe('plantObservationLink', () => {
  it('returns only explicitly linked observations', () => {
    const plant: GardenPlant = {
      id: 'plant-a',
      color: 'red',
      tileId: 'soil-0-0',
      rotation: 0,
      observationIds: ['obs-1'],
    };
    const observations = [baseObservation('obs-1'), baseObservation('obs-2')];
    const linked = getLinkedObservations(plant, observations);
    expect(linked).toHaveLength(1);
    expect(linked[0].id).toBe('obs-1');
  });

  it('prefers the currently selected plant when multiple share a record', () => {
    const plants: GardenPlant[] = [
      { id: 'plant-b', color: 'yellow', tileId: 't1', rotation: 0, observationIds: ['obs-1'] },
      { id: 'plant-a', color: 'red', tileId: 't2', rotation: 0, observationIds: ['obs-1'] },
    ];
    const resolved = resolvePlantForObservation('obs-1', plants, 'plant-b');
    expect(resolved?.id).toBe('plant-b');
  });

  it('falls back to a stable plant when no preference is given', () => {
    const plants: GardenPlant[] = [
      { id: 'plant-b', color: 'yellow', tileId: 't1', rotation: 0, observationIds: ['obs-1'] },
      { id: 'plant-a', color: 'red', tileId: 't2', rotation: 0, observationIds: ['obs-1'] },
    ];
    const resolved = resolvePlantForObservation('obs-1', plants);
    expect(resolved?.id).toBe('plant-a');
  });

  it('returns undefined when no plant is linked', () => {
    const plants: GardenPlant[] = [
      { id: 'plant-a', color: 'red', tileId: 't1', rotation: 0 },
    ];
    expect(resolvePlantForObservation('obs-1', plants)).toBeUndefined();
  });
});

describe('observation link persistence', () => {
  it('stores optional observationIds on new plants without breaking old saves', async () => {
    let state = createEmptyState();
    state = {
      ...state,
      tulipUnlocked: true,
      observations: [baseObservation('obs-99')],
    };
    const tile = state.soilTiles[0];
    state = plantTulipAction(state, tile.id, 'pink', 'obs-99');
    expect(state.plants[0].observationIds).toEqual(['obs-99']);

    const legacyPlant: GardenPlant = {
      id: 'legacy',
      color: 'white',
      tileId: tile.id,
      rotation: 0,
    };
    const legacyState = {
      ...state,
      plants: [legacyPlant],
    };
    const result = await saveState(legacyState);
    expect(result.ok).toBe(true);
    const loaded = await loadState();
    expect(loaded.state.plants[0].observationIds).toBeUndefined();
  });

  it('rejects linking non-tulip observations to garden flowers', () => {
    let state = createEmptyState();
    state = {
      ...state,
      tulipUnlocked: true,
      observations: [{
        ...baseObservation('obs-other'),
        plantType: 'other',
        color: null,
        commonNameJa: 'シロツメクサ',
      }],
      plants: [{
        id: 'plant-1',
        color: 'yellow',
        tileId: state.soilTiles[0].id,
        rotation: 0,
      }],
    };
    state = linkPlantObservationAction(state, 'plant-1', 'obs-other');
    expect(state.plants[0].observationIds).toBeUndefined();
  });

  it('does not attach invalid observation ids when planting', () => {
    let state = createEmptyState();
    state = { ...state, tulipUnlocked: true };
    const tile = state.soilTiles[0];
    state = plantTulipAction(state, tile.id, 'pink', 'missing-obs');
    expect(state.plants[0].observationIds).toBeUndefined();
  });

  it('links observations explicitly without inferring from color', () => {
    let state = createEmptyState();
    state = {
      ...state,
      tulipUnlocked: true,
      observations: [baseObservation('obs-1')],
      plants: [{
        id: 'plant-1',
        color: 'yellow',
        tileId: state.soilTiles[0].id,
        rotation: 0,
      }],
    };
    state = linkPlantObservationAction(state, 'plant-1', 'obs-1');
    expect(state.plants[0].observationIds).toEqual(['obs-1']);
  });
});
