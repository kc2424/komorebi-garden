import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGardenStore } from '../hooks/useGardenStore';
import {
  addSoilTileAction,
  getAddableSoilPositions,
  plantFlowerAction,
  stashPlantAction,
} from '../storage/gardenActions';
import { createEmptyState } from '../storage/persistence';
import type { GardenState, SaveResult } from '../types';
import {
  GARDEN_PLACED_ITEM_MAX_ERROR,
  GARDEN_PLACEMENT_BLOCKED_ERROR,
  getGardenCapacity,
} from '../utils/gardenLimits';

const persistenceMocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../storage/persistence', async () => {
  const actual = await vi.importActual<typeof import('../storage/persistence')>(
    '../storage/persistence',
  );
  return {
    ...actual,
    loadState: (...args: [userId?: string | null]) => persistenceMocks.load(...args),
    saveState: (...args: [state: GardenState, userId?: string | null]) =>
      persistenceMocks.save(...args),
  };
});

function expandSoilToCount(state: GardenState, target: number): GardenState {
  let next = state;
  while (next.soilTiles.length < target) {
    const positions = getAddableSoilPositions(next);
    if (positions.length === 0) break;
    const { x, z } = positions[0];
    const expanded = addSoilTileAction(next, x, z);
    if (expanded === next) break;
    next = expanded;
  }
  return next;
}

function fillPlacedItems(state: GardenState, count: number): GardenState {
  let next = state;
  const tiles = next.soilTiles
    .filter(
      (tile) =>
        !next.plants.some((plant) => plant.tileId === tile.id) &&
        !next.decorations.some((decoration) => decoration.tileId === tile.id),
    )
    .map((tile) => tile.id);
  for (let index = 0; index < count && index < tiles.length; index += 1) {
    next = plantFlowerAction(next, tiles[index], 'cosmos', 'pink');
  }
  return next;
}

describe('useGardenStore gardenLimits queue boundary', () => {
  beforeEach(() => {
    persistenceMocks.load.mockReset();
    persistenceMocks.save.mockReset();
    persistenceMocks.load.mockImplementation(async () => ({ state: createEmptyState() }));
    persistenceMocks.save.mockResolvedValue({ ok: true } satisfies SaveResult);
  });

  afterEach(() => {
    cleanup();
  });

  it('serializes rapid placements so the second call over the cap returns a Japanese error', async () => {
    let seeded = expandSoilToCount(createEmptyState(), 64);
    seeded = fillPlacedItems(seeded, 63);
    const openTile = seeded.soilTiles.find(
      (tile) =>
        !seeded.plants.some((plant) => plant.tileId === tile.id) &&
        !seeded.decorations.some((decoration) => decoration.tileId === tile.id),
    )!.id;

    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.replaceState(seeded);
    });

    let releaseSave!: (result: SaveResult) => void;
    persistenceMocks.save.mockImplementationOnce(
      () =>
        new Promise<SaveResult>((resolve) => {
          releaseSave = resolve;
        }),
    );

    let first!: Promise<SaveResult>;
    let second!: Promise<SaveResult>;
    act(() => {
      first = result.current.placeDecoration(openTile, 'bench');
      second = result.current.placeDecoration(openTile, 'lantern');
    });
    await waitFor(() => expect(persistenceMocks.save).toHaveBeenCalledTimes(2));

    await act(async () => {
      releaseSave({ ok: true });
      const firstResult = await first;
      const secondResult = await second;
      expect(firstResult.ok).toBe(true);
      expect(secondResult).toMatchObject({ ok: false, error: GARDEN_PLACED_ITEM_MAX_ERROR });
    });

    expect(result.current.state.decorations).toHaveLength(1);
    expect(result.current.saveError).toBe(GARDEN_PLACED_ITEM_MAX_ERROR);
    expect(result.current.saveStatus).toBe('saved');
    expect(persistenceMocks.save).toHaveBeenCalledTimes(2);
  });

  it('surfaces placementSaveError for capped confirmation without returning a stale plant id', async () => {
    let seeded = expandSoilToCount(createEmptyState(), 65);
    seeded = fillPlacedItems(seeded, 62);
    const existingPlantId = seeded.plants[0].id;

    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.replaceState(seeded);
    });
    await waitFor(() => expect(result.current.state.plants).toHaveLength(62));

    let pendingTile = '';
    let decorTileA = '';
    let decorTileB = '';
    act(() => {
      const openTiles = result.current.state.soilTiles
        .filter(
          (tile) =>
            !result.current.state.plants.some((plant) => plant.tileId === tile.id) &&
            !result.current.state.decorations.some((decoration) => decoration.tileId === tile.id),
        )
        .map((tile) => tile.id);
      expect(openTiles.length).toBeGreaterThanOrEqual(3);
      [pendingTile, decorTileA, decorTileB] = openTiles;
      result.current.selectFlowerModel('daisy');
    });
    act(() => {
      result.current.beginPendingPlacement(pendingTile);
    });
    await waitFor(() => expect(result.current.pendingPlacementTileId).toBe(pendingTile));

    await act(async () => {
      await result.current.placeDecoration(decorTileA, 'bench');
      await result.current.placeDecoration(decorTileB, 'lantern');
    });
    await waitFor(() => expect(result.current.state.decorations).toHaveLength(2));
    expect(result.current.pendingPlacementTileId).toBe(pendingTile);

    let placedId: string | null = null;
    await act(async () => {
      placedId = await result.current.confirmPendingPlacement();
    });

    expect(placedId).toBeNull();
    expect(result.current.placementSaveError).toBe(GARDEN_PLACED_ITEM_MAX_ERROR);
    expect(result.current.saveStatus).toBe('saved');
    expect(result.current.state.plants).toHaveLength(62);
    expect(result.current.state.plants[0].id).toBe(existingPlantId);
  });

  it('does not treat a no-op stash restore as a successful placement', async () => {
    let seeded = createEmptyState();
    const hostTile = seeded.soilTiles[0].id;
    seeded = plantFlowerAction(seeded, hostTile, 'cosmos', 'pink');
    const stashedPlantId = seeded.plants[0].id;
    seeded = stashPlantAction(seeded, stashedPlantId);

    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.replaceState(seeded);
    });
    await waitFor(() =>
      expect(result.current.state.stashedPlants.some((plant) => plant.id === stashedPlantId)).toBe(
        true,
      ),
    );

    act(() => {
      result.current.selectStashForPlanting(stashedPlantId);
    });
    act(() => {
      const emptyTileId = result.current.state.soilTiles.find(
        (tile) =>
          !result.current.state.plants.some((plant) => plant.tileId === tile.id) &&
          !result.current.state.decorations.some((decoration) => decoration.tileId === tile.id),
      )!.id;
      expect(emptyTileId).toBe(hostTile);
      result.current.beginPendingPlacement(emptyTileId);
    });
    await waitFor(() => expect(result.current.pendingPlacementTileId).toBe(hostTile));

    await act(async () => {
      await result.current.placeDecoration(hostTile, 'bench');
    });

    let restoredId: string | null = null;
    await act(async () => {
      restoredId = await result.current.confirmPendingPlacement();
    });

    expect(restoredId).toBeNull();
    expect(result.current.placementSaveError).toBe(GARDEN_PLACEMENT_BLOCKED_ERROR);
    expect(result.current.state.stashedPlants.some((plant) => plant.id === stashedPlantId)).toBe(
      true,
    );
    expect(result.current.state.plants).toHaveLength(0);
    expect(result.current.pendingFromStashPlantId).toBe(stashedPlantId);
  });

  it('restores undo snapshots without applying placement caps', async () => {
    let seeded = expandSoilToCount(createEmptyState(), 64);
    seeded = fillPlacedItems(seeded, 63);
    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.replaceState(seeded);
    });

    const openTile = seeded.soilTiles.find(
      (tile) =>
        !seeded.plants.some((plant) => plant.tileId === tile.id) &&
        !seeded.decorations.some((decoration) => decoration.tileId === tile.id),
    )!.id;

    await act(async () => {
      await result.current.placeDecoration(openTile, 'bench');
    });
    expect(result.current.state.decorations).toHaveLength(1);

    await act(async () => {
      await result.current.undoGarden();
    });
    expect(result.current.state.decorations).toHaveLength(0);
    expect(result.current.state.plants).toHaveLength(63);

    await act(async () => {
      await result.current.redoGarden();
    });
    expect(result.current.state.decorations).toHaveLength(1);
    expect(result.current.state.plants).toHaveLength(63);
  });

  it('restores an over-limit legacy snapshot through undo and redo unchanged', async () => {
    let seeded = expandSoilToCount(createEmptyState(), 70);
    seeded = fillPlacedItems(seeded, 64);
    const extraTile = seeded.soilTiles.find(
      (tile) =>
        !seeded.plants.some((plant) => plant.tileId === tile.id) &&
        !seeded.decorations.some((decoration) => decoration.tileId === tile.id),
    )!.id;
    seeded = {
      ...seeded,
      plants: [
        ...seeded.plants,
        {
          id: 'legacy-over-cap',
          color: 'pink',
          tileId: extraTile,
          rotation: 0,
          modelType: 'cosmos',
        },
      ],
    };
    expect(getGardenCapacity(seeded).isLegacy).toBe(true);
    expect(seeded.plants).toHaveLength(65);

    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));
    await act(async () => {
      await result.current.replaceState(seeded);
    });

    const paintedTileId = result.current.state.soilTiles[0].id;
    await act(async () => {
      await result.current.paintSurface(paintedTileId, 'stone');
    });
    expect(result.current.state.soilTiles[0].surface).toBe('stone');
    expect(result.current.state.plants).toHaveLength(65);

    await act(async () => {
      await result.current.undoGarden();
    });
    expect(result.current.state.soilTiles[0].surface).toBe('grass');
    expect(result.current.state.plants).toHaveLength(65);
    expect(getGardenCapacity(result.current.state).isLegacy).toBe(true);

    await act(async () => {
      await result.current.redoGarden();
    });
    expect(result.current.state.soilTiles[0].surface).toBe('stone');
    expect(result.current.state.plants).toHaveLength(65);
    expect(result.current.state.plants.some((plant) => plant.id === 'legacy-over-cap')).toBe(true);
  });
});
