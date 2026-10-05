import { describe, it, expect, beforeEach } from 'vitest';
import { plantFlowerAction } from '../storage/gardenActions';
import { migrateV2ToV3 } from '../storage/migration';
import { loadState, saveState } from '../storage/persistence';
import { exportBackup, importBackup } from '../storage/backup';
import { toPersisted, hydrateState } from '../storage/serializableState';
import { saveImage } from '../storage/imageStore';
import { getLocalDb, GUEST_SCOPE, resetLocalDbForTests } from '../storage/localDb';

const V2_KEY = 'komorebi-garden-v2';

describe('v2 modelType and observationIds across migration and roundtrip', () => {
  beforeEach(async () => {
    resetLocalDbForTests();
    localStorage.clear();
    const db = await getLocalDb();
    await db.delete('garden', GUEST_SCOPE);
  });

  it('migrates v2 localStorage plants with modelType and observationIds into v3', async () => {
    const tileId = 'soil-0-0';
    localStorage.setItem(
      V2_KEY,
      JSON.stringify({
        version: 2,
        soilTiles: [{ id: tileId, x: 0, z: 0 }],
        plants: [
          {
            id: 'plant-cosmos',
            color: 'pink',
            tileId,
            rotation: 1.1,
            modelType: 'cosmos',
          },
          {
            id: 'plant-tulip',
            color: 'red',
            tileId: 'soil-0-1',
            rotation: 0.5,
            modelType: 'tulip',
            observationIds: ['obs-linked'],
          },
        ],
        stashedPlants: [{
          id: 'plant-stash',
          color: 'purple',
          tileId: 'soil-0-2',
          rotation: 0,
          modelType: 'pansy',
        }],
        observations: [{
          id: 'obs-linked',
          plantType: 'tulip',
          commonNameJa: 'チューリップ',
          scientificName: 'Tulipa gesneriana',
          familyName: 'ユリ科',
          color: 'red',
          imageDataUrl: 'data:image/jpeg;base64,migrated',
          takenAt: '2026-09-01T00:00:00.000Z',
          memo: '',
          isSample: false,
          identificationSource: 'manual',
          createdAt: '2026-09-01T00:00:00.000Z',
        }],
        tulipUnlocked: true,
      }),
    );

    const loaded = await loadState();
    expect(loaded.migrated).toBe(true);
    expect(loaded.state.version).toBe(3);
    expect(loaded.state.plants.find((p) => p.id === 'plant-cosmos')?.modelType).toBe('cosmos');
    expect(loaded.state.plants.find((p) => p.id === 'plant-tulip')?.observationIds).toEqual(['obs-linked']);
    expect(loaded.state.stashedPlants[0].modelType).toBe('pansy');
    expect(loaded.state.observations[0].imageDataUrl).toBe('data:image/jpeg;base64,migrated');
  });

  it('round-trips modelType and observationIds through IndexedDB save/load', async () => {
    let state = migrateV2ToV3({
      version: 2,
      soilTiles: [{ id: 'soil-0-0', x: 0, z: 0 }, { id: 'soil-0-1', x: 0, z: 1 }],
      plants: [],
      stashedPlants: [],
      observations: [{
        id: 'obs-1',
        plantType: 'tulip',
        commonNameJa: 'チューリップ',
        scientificName: 'Tulipa gesneriana',
        familyName: 'ユリ科',
        color: 'yellow',
        imageDataUrl: 'data:image/jpeg;base64,roundtrip',
        takenAt: '2026-09-01T00:00:00.000Z',
        memo: '',
        isSample: false,
        identificationSource: 'manual',
        createdAt: '2026-09-01T00:00:00.000Z',
      }],
      tulipUnlocked: true,
    });
    state = plantFlowerAction(state, 'soil-0-0', 'cosmos', 'pink');
    state = plantFlowerAction(state, 'soil-0-1', 'tulip', 'yellow', 'obs-1', 0.75);

    await saveState(state);
    const loaded = await loadState();
    expect(loaded.state.plants.map((p) => p.modelType)).toEqual(['cosmos', 'tulip']);
    expect(loaded.state.plants[1].observationIds).toEqual(['obs-1']);
    expect(loaded.state.plants[1].rotation).toBe(0.75);
  });

  it('preserves modelType and observationIds through backup export/import', async () => {
    let state = migrateV2ToV3({
      version: 2,
      soilTiles: [{ id: 'soil-0-0', x: 0, z: 0 }],
      plants: [],
      stashedPlants: [],
      observations: [{
        id: 'obs-backup',
        plantType: 'tulip',
        commonNameJa: 'チューリップ',
        scientificName: 'Tulipa gesneriana',
        familyName: 'ユリ科',
        color: 'pink',
        imageDataUrl: 'data:image/jpeg;base64,backup',
        takenAt: '2026-09-01T00:00:00.000Z',
        memo: '',
        isSample: false,
        identificationSource: 'manual',
        createdAt: '2026-09-01T00:00:00.000Z',
      }],
      tulipUnlocked: true,
    });
    state = plantFlowerAction(state, 'soil-0-0', 'tulip', 'pink', 'obs-backup');

    const backup = await exportBackup(state);
    const restored = await importBackup(backup);
    expect(restored.plants[0].modelType).toBe('tulip');
    expect(restored.plants[0].observationIds).toEqual(['obs-backup']);
  });

  it('serializes modelType and observationIds for sync payload hydration', async () => {
    let state = migrateV2ToV3({
      version: 2,
      soilTiles: [{ id: 'soil-0-0', x: 0, z: 0 }],
      plants: [],
      stashedPlants: [],
      observations: [{
        id: 'obs-sync',
        plantType: 'tulip',
        commonNameJa: 'チューリップ',
        scientificName: 'Tulipa gesneriana',
        familyName: 'ユリ科',
        color: 'orange',
        imageDataUrl: 'data:image/jpeg;base64,sync',
        takenAt: '2026-09-01T00:00:00.000Z',
        memo: '',
        isSample: false,
        identificationSource: 'manual',
        createdAt: '2026-09-01T00:00:00.000Z',
      }],
      tulipUnlocked: true,
    });
    state = plantFlowerAction(state, 'soil-0-0', 'tulip', 'orange', 'obs-sync');
    await saveImage(state.observations[0].imageRef, state.observations[0].imageDataUrl);

    const persisted = toPersisted(state);
    expect(persisted.plants[0].modelType).toBe('tulip');
    expect(persisted.plants[0].observationIds).toEqual(['obs-sync']);

    const hydrated = await hydrateState(persisted, async (ref) =>
      ref === state.observations[0].imageRef ? 'data:image/jpeg;base64,sync' : null,
    );
    expect(hydrated.plants[0].modelType).toBe('tulip');
    expect(hydrated.plants[0].observationIds).toEqual(['obs-sync']);
  });
});
