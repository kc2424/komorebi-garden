import { act, renderHook, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it } from 'vitest';
import { useGardenStore } from '../hooks/useGardenStore';
import {
  paintSurfaceAction,
  placeDecorationAction,
  plantFlowerAction,
  removeSoilTileAction,
  rotateGardenItemAction,
  saveObservationAction,
} from '../storage/gardenActions';
import { getLocalDb, GUEST_SCOPE, resetLocalDbForTests } from '../storage/localDb';
import { createEmptyState, loadState, saveState } from '../storage/persistence';
import { hydrateState, toPersisted } from '../storage/serializableState';

describe('playable sandbox garden', () => {
  beforeEach(async () => {
    resetLocalDbForTests();
    localStorage.clear();
    const db = await getLocalDb();
    await db.delete('garden', GUEST_SCOPE);
  });

  it('starts with a 5x5 grass canvas and allows all flowers without changing unlock metadata', () => {
    let state = createEmptyState();
    expect(state.soilTiles).toHaveLength(25);
    expect(state.soilTiles.every((tile) => tile.surface === 'grass')).toBe(true);
    expect(state.tulipUnlocked).toBe(false);

    state = plantFlowerAction(state, state.soilTiles[0].id, 'tulip', 'purple');
    state = plantFlowerAction(state, state.soilTiles[1].id, 'cosmos', 'pink');
    state = plantFlowerAction(state, state.soilTiles[2].id, 'pansy', 'pink');
    expect(state.plants.map((plant) => plant.modelType)).toEqual([
      'tulip',
      'cosmos',
      'pansy',
    ]);
    expect(state.tulipUnlocked).toBe(false);
  });

  it('paints surfaces, enforces single-item occupancy, and stashes decoration on tile removal', () => {
    let state = createEmptyState();
    const tile = state.soilTiles[0];
    state = paintSurfaceAction(state, tile.id, 'stone');
    expect(state.soilTiles[0].surface).toBe('stone');

    state = placeDecorationAction(state, tile.id, 'bench', Math.PI / 2);
    expect(state.decorations).toHaveLength(1);
    const blocked = plantFlowerAction(state, tile.id, 'cosmos', 'pink');
    expect(blocked).toBe(state);

    state = rotateGardenItemAction(state, state.decorations[0].id);
    expect(state.decorations[0].rotation).toBeCloseTo(Math.PI * 0.75);
    state = removeSoilTileAction(state, tile.id);
    expect(state.decorations).toHaveLength(0);
    expect(state.stashedDecorations).toHaveLength(1);
  });

  it('round-trips surfaces, decorations, rotation, and stash through serialization', async () => {
    let state = createEmptyState();
    state = paintSurfaceAction(state, state.soilTiles[4].id, 'soil');
    state = placeDecorationAction(state, state.soilTiles[5].id, 'lantern', 1.25);
    state = placeDecorationAction(state, state.soilTiles[6].id, 'round-stone', 0);
    state = removeSoilTileAction(state, state.soilTiles[6].id);

    const hydrated = await hydrateState(toPersisted(state), async () => null);
    expect(hydrated.soilTiles.find((tile) => tile.id === state.soilTiles[4].id)?.surface).toBe('soil');
    expect(hydrated.decorations[0]).toMatchObject({ type: 'lantern', rotation: 1.25 });
    expect(hydrated.stashedDecorations[0].type).toBe('round-stone');
  });

  it('respects an observation-free v3 sandbox save even when a legacy v2 key remains', async () => {
    let state = createEmptyState();
    state = paintSurfaceAction(state, state.soilTiles[0].id, 'stone');
    state = placeDecorationAction(state, state.soilTiles[1].id, 'bench', 0);
    await saveState(state);
    localStorage.setItem(
      'komorebi-garden-v2',
      JSON.stringify({
        version: 2,
        soilTiles: [{ id: 'legacy-tile', x: 99, z: 99 }],
        plants: [],
        stashedPlants: [],
        observations: [],
        tulipUnlocked: false,
      }),
    );

    const loaded = await loadState();
    expect(loaded.migrated).not.toBe(true);
    expect(loaded.state.decorations[0].type).toBe('bench');
    expect(loaded.state.soilTiles.some((tile) => tile.surface === 'stone')).toBe(true);
    expect(loaded.state.soilTiles.some((tile) => tile.id === 'legacy-tile')).toBe(false);
  });

  it('undoes only garden data and keeps observations and their explicit photo link', async () => {
    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    const withObservation = saveObservationAction(result.current.state, {
      plantType: 'tulip',
      commonNameJa: '思い出のチューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,photo',
      isSample: false,
      identificationSource: 'manual',
    }).nextState;
    await act(async () => {
      await result.current.replaceState(withObservation);
    });
    const observationId = result.current.state.observations[0].id;
    const tileId = result.current.state.soilTiles[0].id;

    await act(async () => {
      await result.current.plantFlower(tileId, 'tulip', 'red', observationId, 0.5);
    });
    expect(result.current.state.plants[0].observationIds).toEqual([observationId]);

    await act(async () => {
      await result.current.undoGarden();
    });
    expect(result.current.state.plants).toHaveLength(0);
    expect(result.current.state.observations).toHaveLength(1);
    expect(result.current.state.observations[0].imageDataUrl).toBe('data:image/jpeg;base64,photo');

    await act(async () => {
      await result.current.redoGarden();
    });
    expect(result.current.state.plants[0].observationIds).toEqual([observationId]);
  });
});
