import { describe, it, expect } from 'vitest';
import type { GardenPlant, PlantObservation } from '../types';
import {
  getNavigableObservations,
  resolveMemoryNavigationTarget,
} from '../utils/plantObservationLink';

const observation = (id: string, takenAt: string): PlantObservation => ({
  id,
  plantType: 'tulip',
  commonNameJa: 'チューリップ',
  scientificName: 'Tulipa gesneriana',
  familyName: 'ユリ科',
  trait: '',
  color: 'red',
  imageRef: `img-${id}`,
  imageDataUrl: 'data:image/jpeg;base64,x',
  takenAt,
  memo: '',
  isSample: false,
  identificationSource: 'manual',
  createdAt: takenAt,
});

describe('garden memory navigation', () => {
  it('navigates across all observations in stable newest-first order', () => {
    const observations = [
      observation('obs-old', '2026-01-01'),
      observation('obs-new', '2026-02-01'),
    ];
    const navigationList = getNavigableObservations(observations);
    expect(navigationList.map((o) => o.id)).toEqual(['obs-new', 'obs-old']);
  });

  it('clears garden focus for unlinked observations while keeping link status', () => {
    const plants: GardenPlant[] = [
      { id: 'plant-a', color: 'red', tileId: 't1', rotation: 0, observationIds: ['obs-linked'] },
    ];
    const target = resolveMemoryNavigationTarget(
      observation('obs-unlinked', '2026-03-01'),
      plants,
      [],
    );
    expect(target.plantId).toBeNull();
    expect(target.linkStatus).toBe('unlinked');
  });

  it('reports stashed flowers without focusing an in-garden plant', () => {
    const stashedPlants: GardenPlant[] = [
      { id: 'plant-stash', color: 'pink', tileId: 't9', rotation: 0, observationIds: ['obs-stash'] },
    ];
    const target = resolveMemoryNavigationTarget(
      observation('obs-stash', '2026-03-01'),
      [],
      stashedPlants,
    );
    expect(target.plantId).toBeNull();
    expect(target.linkStatus).toBe('stashed');
  });

  it('moves focus to another flower when its observation is selected', () => {
    const plants: GardenPlant[] = [
      { id: 'plant-a', color: 'red', tileId: 't1', rotation: 0, observationIds: ['obs-a'] },
      { id: 'plant-b', color: 'yellow', tileId: 't2', rotation: 0, observationIds: ['obs-b'] },
    ];
    const target = resolveMemoryNavigationTarget(
      observation('obs-b', '2026-03-01'),
      plants,
      [],
      'plant-a',
    );
    expect(target.plantId).toBe('plant-b');
    expect(target.linkStatus).toBe('linked');
  });
});
