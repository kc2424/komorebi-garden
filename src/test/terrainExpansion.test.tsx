import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { DECORATION_CATALOG } from '../data/decorationCatalog';
import { useGardenStore } from '../hooks/useGardenStore';
import { exportBackup, importBackup, validateBackup } from '../storage/backup';
import {
  changeTileHeightAction,
  decorationFromStashAction,
  moveDecorationAction,
  movePlantAction,
  paintSurfaceAction,
  placeDecorationAction,
  plantFlowerAction,
  removeSoilTileAction,
  saveObservationAction,
} from '../storage/gardenActions';
import { getLocalDb, GUEST_SCOPE, resetLocalDbForTests } from '../storage/localDb';
import { migrateV2ToV3 } from '../storage/migration';
import { createEmptyState, loadState, saveState } from '../storage/persistence';
import { hydrateState, toPersisted } from '../storage/serializableState';
import {
  canChangeTileHeight,
  getTileElevation,
  normalizeTerrainHeight,
  TILE_SURFACES,
} from '../utils/terrain';

describe('terraces and expanded decorations', () => {
  beforeEach(async () => {
    resetLocalDbForTests();
    localStorage.clear();
    const db = await getLocalDb();
    await db.delete('garden', GUEST_SCOPE);
  });

  afterEach(cleanup);

  it('bounds four discrete heights, leaves capped edits unchanged, and keeps tile contents intact', () => {
    let state = createEmptyState();
    const tileId = state.soilTiles[0].id;
    state = placeDecorationAction(state, tileId, 'garden-arch', 0.4);
    const decoration = state.decorations[0];
    state = changeTileHeightAction(state, tileId, 1);
    expect(state.soilTiles[0].height).toBe(1);
    expect(getTileElevation(state.soilTiles[0])).toBe(0.32);
    state = changeTileHeightAction(state, tileId, 90);
    expect(state.soilTiles[0].height).toBe(3);
    expect(getTileElevation(state.soilTiles[0])).toBe(0.96);
    expect(changeTileHeightAction(state, tileId, 1)).toBe(state);
    expect(changeTileHeightAction(state, tileId, Number.NaN)).toBe(state);
    expect(changeTileHeightAction(state, tileId, 0.5)).toBe(state);
    expect(changeTileHeightAction(state, 'missing', 1)).toBe(state);
    expect(canChangeTileHeight(state.soilTiles[0], 1)).toBe(false);
    expect(canChangeTileHeight(state.soilTiles[0], -1)).toBe(true);
    state = changeTileHeightAction(state, tileId, -99);
    expect(state.soilTiles[0].height).toBe(0);
    expect(state.decorations[0]).toEqual(decoration);
    expect(normalizeTerrainHeight(2.7)).toBe(3);
    expect(normalizeTerrainHeight(-2)).toBe(0);
    expect(normalizeTerrainHeight(Infinity)).toBe(0);
    expect(normalizeTerrainHeight(undefined)).toBe(0);
  });

  it('loads old v2 and v3 tiles at ground level while retaining explicit plant links', async () => {
    const plant = { id: 'legacy-plant', tileId: 'legacy-tile', color: 'red' as const, rotation: 0.7, modelType: 'tulip' as const, observationIds: ['explicit-observation'] };
    const legacy = {
      version: 2 as const,
      soilTiles: [{ id: 'legacy-tile', x: 4, z: -3 }],
      plants: [plant], stashedPlants: [], observations: [], tulipUnlocked: false,
    };
    const migrated = migrateV2ToV3(legacy);
    expect(migrated.soilTiles).toEqual([{ id: 'legacy-tile', x: 4, z: -3, height: 0 }]);
    expect(migrated.plants[0]).toEqual(plant);
    const persisted = toPersisted(migrated);
    delete persisted.soilTiles[0].height;
    const hydrated = await hydrateState(persisted, async () => null);
    expect(hydrated.soilTiles[0].height).toBe(0);
    expect(hydrated.plants[0].observationIds).toEqual(['explicit-observation']);
  });

  it('round-trips every surface and decoration, elevation, stash, and rotation through local save and backup', async () => {
    let state = createEmptyState();
    for (const [index, entry] of DECORATION_CATALOG.entries()) {
      const tileId = state.soilTiles[index].id;
      state = paintSurfaceAction(state, tileId, TILE_SURFACES[index % TILE_SURFACES.length]);
      state = changeTileHeightAction(state, tileId, index % 4);
      state = placeDecorationAction(state, tileId, entry.type, index * 0.4);
    }
    state = removeSoilTileAction(state, state.decorations.at(-1)!.tileId);
    expect((await saveState(state)).ok).toBe(true);
    const loaded = (await loadState()).state;
    expect(loaded.soilTiles).toEqual(state.soilTiles);
    expect(loaded.decorations).toEqual(state.decorations);
    expect(loaded.stashedDecorations).toEqual(state.stashedDecorations);
    const backup = await exportBackup(loaded);
    expect(validateBackup(backup).ok).toBe(true);
    const restored = await importBackup(JSON.parse(JSON.stringify(backup)));
    expect(restored.soilTiles).toEqual(state.soilTiles);
    expect(restored.decorations).toEqual(state.decorations);
    expect(restored.stashedDecorations).toEqual(state.stashedDecorations);
  });

  it('moving and restoring keeps item identity while using the destination elevation and occupancy', () => {
    let state = createEmptyState();
    const [a, b, c, d] = state.soilTiles;
    state = changeTileHeightAction(state, b.id, 3);
    state = changeTileHeightAction(state, c.id, 2);
    state = plantFlowerAction(state, a.id, 'tulip', 'red', undefined, 1.2);
    const plant = state.plants[0];
    state = movePlantAction(state, plant.id, b.id);
    expect(state.plants[0]).toEqual({ ...plant, tileId: b.id });
    expect(getTileElevation(state.soilTiles.find((tile) => tile.id === state.plants[0].tileId))).toBe(0.96);
    state = placeDecorationAction(state, a.id, 'fountain', 0.7);
    const decoration = state.decorations[0];
    expect(moveDecorationAction(state, decoration.id, b.id)).toBe(state);
    state = moveDecorationAction(state, decoration.id, c.id);
    expect(getTileElevation(state.soilTiles.find((tile) => tile.id === state.decorations[0].tileId))).toBe(0.64);
    state = removeSoilTileAction(state, c.id);
    expect(state.stashedDecorations[0]).toEqual({ ...decoration, tileId: c.id });
    state = decorationFromStashAction(state, decoration.id, d.id);
    expect(state.decorations[0]).toEqual({ ...decoration, tileId: d.id });
    expect(state.stashedDecorations).toHaveLength(0);
  });

  it('serializes rapid height edits and undoes the terrace without rewinding a later photo record', async () => {
    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    const tileId = result.current.state.soilTiles[0].id;
    await act(async () => {
      await Promise.all([
        result.current.changeTileHeight(tileId, 1),
        result.current.changeTileHeight(tileId, 1),
        result.current.changeTileHeight(tileId, 1),
      ]);
    });
    expect(result.current.state.soilTiles[0].height).toBe(3);
    const observationInput = {
      plantType: 'tulip' as const, commonNameJa: '保存した花', scientificName: 'Tulipa',
      familyName: 'ユリ科', color: 'yellow' as const, imageDataUrl: 'data:image/jpeg;base64,terrace',
      isSample: false, identificationSource: 'manual' as const,
    };
    await act(async () => {
      await result.current.saveObservation(observationInput);
      await result.current.undoGarden();
    });
    expect(result.current.state.soilTiles[0].height).toBe(2);
    expect(result.current.state.observations).toHaveLength(1);
    await act(async () => {
      await result.current.redoGarden();
    });
    expect(result.current.state.soilTiles[0].height).toBe(3);
    expect((await loadState()).state.soilTiles[0].height).toBe(3);
    expect(result.current.state.observations[0].imageDataUrl).toBe(observationInput.imageDataUrl);
  });

  it('raising linked plants never infers or changes observation relationships', () => {
    let state = saveObservationAction(createEmptyState(), {
      plantType: 'tulip', commonNameJa: '写真の花', scientificName: 'Tulipa', familyName: 'ユリ科',
      color: 'red', imageDataUrl: '', isSample: false, identificationSource: 'manual',
    }).nextState;
    const tileId = state.soilTiles[0].id;
    const observationId = state.observations[0].id;
    state = plantFlowerAction(state, tileId, 'tulip', 'red', observationId);
    state = changeTileHeightAction(state, tileId, 2);
    state = paintSurfaceAction(state, tileId, 'water');
    expect(state.plants[0].observationIds).toEqual([observationId]);
    expect(state.observations[0].id).toBe(observationId);
  });

  it('retains every item and photo link when removing a tile from an older overlapping garden', async () => {
    let state = saveObservationAction(createEmptyState(), {
      plantType: 'tulip', commonNameJa: '以前の写真', scientificName: 'Tulipa', familyName: 'ユリ科',
      color: 'red', imageDataUrl: 'data:image/jpeg;base64,preserved', isSample: false, identificationSource: 'manual',
    }).nextState;
    const [plantTile, decorationTile] = state.soilTiles;
    const observationId = state.observations[0].id;
    state.plants = ['older-a', 'older-b'].map((id) => ({
      id, tileId: plantTile.id, color: 'red', rotation: 0.3, modelType: 'tulip', observationIds: [observationId],
    }));
    state.decorations = ['older-c', 'older-d'].map((id) => ({
      id, tileId: decorationTile.id, type: 'lantern', rotation: 0.4,
    }));
    await saveState(state);
    state = (await loadState()).state;
    expect(state.plants).toHaveLength(2);
    expect(state.decorations).toHaveLength(2);
    state = removeSoilTileAction(state, plantTile.id);
    state = removeSoilTileAction(state, decorationTile.id);
    expect(state.plants).toHaveLength(0);
    expect(state.decorations).toHaveLength(0);
    expect(state.stashedPlants.map((plant) => plant.id)).toEqual(['older-a', 'older-b']);
    expect(state.stashedPlants.every((plant) => plant.observationIds?.[0] === observationId)).toBe(true);
    expect(state.stashedDecorations.map((item) => item.id)).toEqual(['older-c', 'older-d']);
    expect(state.observations[0].imageDataUrl).toBe('data:image/jpeg;base64,preserved');
    await saveState(state);
    const loaded = (await loadState()).state;
    expect(loaded.stashedPlants).toEqual(state.stashedPlants);
    expect(loaded.stashedDecorations).toEqual(state.stashedDecorations);
  });
});
