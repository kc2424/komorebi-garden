import { describe, expect, it } from 'vitest';
import {
  addSoilTileAction,
  decorationFromStashAction,
  getAddableSoilPositions,
  moveDecorationAction,
  movePlantAction,
  placeDecorationAction,
  plantFlowerAction,
  plantFromStashAction,
  stashDecorationAction,
  stashPlantAction,
} from '../storage/gardenActions';
import { createEmptyState, normalizeGardenState } from '../storage/persistence';
import { hydrateState, toPersisted } from '../storage/serializableState';
import type { GardenState } from '../types';
import {
  canAddGardenTile,
  canPlaceGardenItem,
  GARDEN_LIMITS,
  GARDEN_PLACED_ITEM_MAX_ERROR,
  GARDEN_TILE_COORD_ERROR,
  GARDEN_TILE_MAX_ERROR,
  didRestoreStashedPlant,
  findNewlyPlacedPlantId,
  getGardenCapacity,
  isLegalSoilCoordinate,
} from '../utils/gardenLimits';

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

function emptyTileIds(state: GardenState): string[] {
  return state.soilTiles
    .filter(
      (tile) =>
        !state.plants.some((plant) => plant.tileId === tile.id) &&
        !state.decorations.some((decoration) => decoration.tileId === tile.id),
    )
    .map((tile) => tile.id);
}

function fillPlants(state: GardenState, count: number): GardenState {
  let next = state;
  const tiles = emptyTileIds(next);
  for (let index = 0; index < count && index < tiles.length; index += 1) {
    const placed = plantFlowerAction(next, tiles[index], 'cosmos', 'pink');
    expect(placed).not.toBe(next);
    next = placed;
  }
  return next;
}

function placedItemCount(state: GardenState): number {
  return state.plants.length + state.decorations.length;
}

/** 63 garden plants on expanded soil; one empty tile reserved for cap-edge actions. */
function gardenWith63Plants(tileBudget = 65): GardenState {
  const expanded = expandSoilToCount(createEmptyState(), tileBudget);
  return fillPlants(expanded, 63);
}

/** 64 placed items, stash holds one plant, one empty tile for restore attempts. */
function gardenAtCapWithStashedPlant(): {
  state: GardenState;
  stashedPlantId: string;
  emptyTileId: string;
} {
  let state = expandSoilToCount(createEmptyState(), 65);
  state = fillPlants(state, 64);
  expect(placedItemCount(state)).toBe(64);
  expect(emptyTileIds(state)).toHaveLength(1);

  const stashedPlantId = state.plants[0].id;
  const emptyTileId = state.plants[0].tileId;
  state = stashPlantAction(state, stashedPlantId);
  expect(placedItemCount(state)).toBe(63);

  const spareEmptyTile = emptyTileIds(state).find((id) => id !== emptyTileId)!;
  state = placeDecorationAction(state, spareEmptyTile, 'lantern');
  expect(placedItemCount(state)).toBe(64);
  expect(state.stashedPlants.some((plant) => plant.id === stashedPlantId)).toBe(true);
  expect(emptyTileIds(state)).toEqual([emptyTileId]);

  return { state, stashedPlantId, emptyTileId };
}

/** 64 placed items (63 plants + 1 decoration), stash holds one decoration, empty tile for restore attempts. */
function gardenAtCapWithStashedDecoration(): {
  state: GardenState;
  stashedDecorationId: string;
  emptyTileId: string;
} {
  let state = expandSoilToCount(createEmptyState(), 65);
  state = fillPlants(state, 63);
  const firstDecorTile = emptyTileIds(state)[0];
  state = placeDecorationAction(state, firstDecorTile, 'lantern');
  expect(placedItemCount(state)).toBe(64);
  expect(emptyTileIds(state)).toHaveLength(1);

  const stashedDecorationId = state.decorations[0].id;
  const emptyTileId = firstDecorTile;
  state = stashDecorationAction(state, stashedDecorationId);
  expect(placedItemCount(state)).toBe(63);

  const spareEmptyTile = emptyTileIds(state).find((id) => id !== emptyTileId)!;
  state = plantFlowerAction(state, spareEmptyTile, 'daisy', 'pink');
  expect(placedItemCount(state)).toBe(64);
  expect(state.stashedDecorations.some((item) => item.id === stashedDecorationId)).toBe(true);
  expect(emptyTileIds(state)).toEqual([emptyTileId]);

  return { state, stashedDecorationId, emptyTileId };
}

describe('gardenLimits placement transition helpers', () => {
  it('detects stash restore and new tile placement transitions', () => {
    let state = createEmptyState();
    const tileId = state.soilTiles[0].id;
    state = plantFlowerAction(state, tileId, 'cosmos', 'pink');
    const plant = state.plants[0];
    const stashed = stashPlantAction(state, plant.id);
    const restored = plantFromStashAction(stashed, plant.id, tileId);
    expect(didRestoreStashedPlant(stashed, restored, plant.id, tileId)).toBe(true);

    const before = createEmptyState();
    const after = plantFlowerAction(before, before.soilTiles[1].id, 'daisy', 'pink');
    expect(findNewlyPlacedPlantId(before, after, before.soilTiles[1].id)).toBe(
      after.plants[0].id,
    );
    expect(findNewlyPlacedPlantId(before, before, before.soilTiles[1].id)).toBeNull();
  });
});

describe('gardenLimits constants and capacity', () => {
  it('exports the agreed garden limit contract', () => {
    expect(GARDEN_LIMITS).toEqual({
      minCoordinate: -4,
      maxCoordinate: 4,
      maxTiles: 81,
      maxPlacedItems: 64,
      maxHeight: 3,
    });
  });

  it('reports counts, nonnegative remaining space, and legacy markers', () => {
    const state = createEmptyState();
    expect(getGardenCapacity(state)).toEqual({
      tileCount: 25,
      placedItemCount: 0,
      tilesRemaining: 56,
      itemsRemaining: 64,
      isLegacy: false,
    });

    const oversized = {
      ...state,
      soilTiles: [...state.soilTiles, { id: 'oob', x: 9, z: 0, surface: 'grass' as const, height: 0 }],
      plants: Array.from({ length: 65 }, (_, index) => ({
        id: `plant-${index}`,
        tileId: state.soilTiles[index % state.soilTiles.length].id,
        color: 'pink' as const,
        rotation: 0,
        modelType: 'cosmos' as const,
      })),
    };
    expect(getGardenCapacity(oversized)).toMatchObject({
      tileCount: 26,
      placedItemCount: 65,
      tilesRemaining: 55,
      itemsRemaining: 0,
      isLegacy: true,
    });
  });
});

describe('gardenLimits coordinate and tile guards', () => {
  it('rejects NaN, infinite, fractional, and out-of-range coordinates', () => {
    const state = createEmptyState();
    expect(isLegalSoilCoordinate(Number.NaN, 0)).toBe(false);
    expect(isLegalSoilCoordinate(0, Number.POSITIVE_INFINITY)).toBe(false);
    expect(isLegalSoilCoordinate(1.5, 0)).toBe(false);
    expect(canAddGardenTile(state, 5, 0)).toBe(false);
    expect(canAddGardenTile(state, -5, 0)).toBe(false);

    const blocked = addSoilTileAction(state, Number.NaN, 0);
    expect(blocked).toBe(state);
    expect(blocked.sync.revision).toBe(state.sync.revision);
  });

  it('allows the 80th expansion and blocks the 81st tile plus addable positions', () => {
    let state = expandSoilToCount(createEmptyState(), 80);
    expect(state.soilTiles).toHaveLength(80);
    const positionsAt80 = getAddableSoilPositions(state);
    expect(positionsAt80.length).toBeGreaterThan(0);
    const { x, z } = positionsAt80[0];
    const at81 = addSoilTileAction(state, x, z);
    expect(at81.soilTiles).toHaveLength(81);
    expect(getAddableSoilPositions(at81)).toEqual([]);
    const blocked = addSoilTileAction(at81, x, z);
    expect(blocked).toBe(at81);
    expect(blocked.sync.revision).toBe(at81.sync.revision);
  });

  it('does not surface illegal adjacencies from legacy out-of-bounds tiles', () => {
    const legacy = {
      ...createEmptyState(),
      soilTiles: [{ id: 'legacy', x: 10, z: 0, surface: 'grass' as const, height: 0 }],
    };
    expect(getGardenCapacity(legacy).isLegacy).toBe(true);
    expect(getAddableSoilPositions(legacy)).toEqual([]);
    expect(canAddGardenTile(legacy, 11, 0)).toBe(false);
    expect(GARDEN_TILE_COORD_ERROR).toBe('庭は最大9×9マスです。この外には広げられません。');
    expect(GARDEN_TILE_MAX_ERROR).toContain('81');
  });
});

describe('gardenLimits placed item guards', () => {
  it.each([
    {
      label: 'new plant',
      act: (state: GardenState) => plantFlowerAction(state, emptyTileIds(state)[0], 'pansy', 'pink'),
      expectPlants: 64,
      expectDecorations: 0,
    },
    {
      label: 'new decoration',
      act: (state: GardenState) => placeDecorationAction(state, emptyTileIds(state)[0], 'bench'),
      expectPlants: 63,
      expectDecorations: 1,
    },
  ])('allows 63 to 64 via $label', ({ act, expectPlants, expectDecorations }) => {
    const state = gardenWith63Plants();
    expect(canPlaceGardenItem(state)).toBe(true);
    expect(placedItemCount(state)).toBe(63);

    const next = act(state);
    expect(next).not.toBe(state);
    expect(placedItemCount(next)).toBe(64);
    expect(next.plants).toHaveLength(expectPlants);
    expect(next.decorations).toHaveLength(expectDecorations);
    expect(canPlaceGardenItem(next)).toBe(false);
  });

  it('allows 63 to 64 via stash plant restore', () => {
    let state = expandSoilToCount(createEmptyState(), 65);
    state = fillPlants(state, 64);
    const stashedPlantId = state.plants[0].id;
    const emptyTileId = state.plants[0].tileId;
    state = stashPlantAction(state, stashedPlantId);
    expect(placedItemCount(state)).toBe(63);

    const next = plantFromStashAction(state, stashedPlantId, emptyTileId);
    expect(next).not.toBe(state);
    expect(placedItemCount(next)).toBe(64);
    expect(next.plants).toHaveLength(64);
    expect(canPlaceGardenItem(next)).toBe(false);
  });

  it('blocks a 65th new plant and decoration when the garden already holds 64', () => {
    const state = gardenWith63Plants();
    const at64 = plantFlowerAction(state, emptyTileIds(state)[0], 'pansy', 'pink');
    expect(placedItemCount(at64)).toBe(64);

    const blockedPlant = plantFlowerAction(at64, emptyTileIds(at64)[0], 'daisy', 'pink');
    expect(blockedPlant).toBe(at64);

    const blockedDecor = placeDecorationAction(at64, emptyTileIds(at64)[0], 'bench');
    expect(blockedDecor).toBe(at64);
    expect(GARDEN_PLACED_ITEM_MAX_ERROR).toContain('64');
    expect(GARDEN_PLACED_ITEM_MAX_ERROR).toContain('収納');
  });

  it('blocks plant restore at the cap, then allows restore after freeing one placed slot', () => {
    const { state, stashedPlantId, emptyTileId } = gardenAtCapWithStashedPlant();
    expect(state.soilTiles.length).toBeGreaterThanOrEqual(65);
    expect(placedItemCount(state)).toBe(64);
    expect(state.stashedPlants.some((plant) => plant.id === stashedPlantId)).toBe(true);
    expect(state.plants.every((plant) => plant.id !== stashedPlantId)).toBe(true);
    expect(emptyTileIds(state)).toEqual([emptyTileId]);

    const blocked = plantFromStashAction(state, stashedPlantId, emptyTileId);
    expect(blocked).toBe(state);
    expect(placedItemCount(blocked)).toBe(64);
    expect(blocked.stashedPlants.some((plant) => plant.id === stashedPlantId)).toBe(true);

    const decorationToStash = state.decorations[0];
    const freed = stashDecorationAction(state, decorationToStash.id);
    expect(placedItemCount(freed)).toBe(63);
    expect(freed.stashedDecorations.some((item) => item.id === decorationToStash.id)).toBe(true);
    expect(emptyTileIds(freed)).toContain(emptyTileId);

    const restored = plantFromStashAction(freed, stashedPlantId, emptyTileId);
    expect(restored).not.toBe(freed);
    expect(placedItemCount(restored)).toBe(64);
    expect(restored.plants.some((plant) => plant.id === stashedPlantId)).toBe(true);
    expect(restored.stashedPlants.some((plant) => plant.id === stashedPlantId)).toBe(false);
    expect(restored.stashedDecorations.some((item) => item.id === decorationToStash.id)).toBe(true);
    expect(restored.decorations).toHaveLength(0);
    expect(restored.plants).toHaveLength(64);
  });

  it('blocks decoration restore at the cap, then allows restore after freeing one placed slot', () => {
    const { state, stashedDecorationId, emptyTileId } = gardenAtCapWithStashedDecoration();
    expect(state.soilTiles.length).toBeGreaterThanOrEqual(65);
    expect(placedItemCount(state)).toBe(64);
    expect(state.stashedDecorations.some((item) => item.id === stashedDecorationId)).toBe(true);
    expect(state.decorations.every((item) => item.id !== stashedDecorationId)).toBe(true);
    expect(emptyTileIds(state)).toEqual([emptyTileId]);

    const blocked = decorationFromStashAction(state, stashedDecorationId, emptyTileId);
    expect(blocked).toBe(state);
    expect(placedItemCount(blocked)).toBe(64);
    expect(blocked.stashedDecorations.some((item) => item.id === stashedDecorationId)).toBe(true);

    const plantToStash = state.plants[0];
    const freed = stashPlantAction(state, plantToStash.id);
    expect(placedItemCount(freed)).toBe(63);
    expect(freed.stashedPlants.some((plant) => plant.id === plantToStash.id)).toBe(true);
    expect(emptyTileIds(freed)).toContain(emptyTileId);

    const restored = decorationFromStashAction(freed, stashedDecorationId, emptyTileId);
    expect(restored).not.toBe(freed);
    expect(placedItemCount(restored)).toBe(64);
    expect(restored.decorations.some((item) => item.id === stashedDecorationId)).toBe(true);
    expect(restored.stashedDecorations.some((item) => item.id === stashedDecorationId)).toBe(
      false,
    );
    expect(restored.stashedPlants.some((plant) => plant.id === plantToStash.id)).toBe(true);
    expect(restored.plants).toHaveLength(63);
    expect(restored.decorations).toHaveLength(1);
  });

  it('keeps stash unbounded without trimming stored copies', () => {
    let state = gardenWith63Plants();
    for (let index = 0; index < 6; index += 1) {
      const plantId = state.plants[index]?.id;
      if (!plantId) break;
      state = stashPlantAction(state, plantId);
    }
    expect(state.stashedPlants.length).toBeGreaterThanOrEqual(6);
    expect(placedItemCount(state)).toBeLessThan(63);
  });

  it('allows moving plants and decorations at or above the placement cap', () => {
    let state = expandSoilToCount(createEmptyState(), 70);
    state = fillPlants(state, 64);
    const extraTile = emptyTileIds(state)[0];
    const legacyPlant = {
      id: 'legacy-extra',
      color: 'pink' as const,
      tileId: extraTile,
      rotation: 0,
      modelType: 'cosmos' as const,
    };
    state = { ...state, plants: [...state.plants, legacyPlant] };
    const plantDestination = emptyTileIds(state).find((id) => id !== extraTile)!;
    const relocatedPlant = movePlantAction(state, legacyPlant.id, plantDestination);
    expect(relocatedPlant).not.toBe(state);
    expect(relocatedPlant.plants).toHaveLength(65);

    let capped = gardenWith63Plants(66);
    const decorTile = emptyTileIds(capped)[0];
    capped = placeDecorationAction(capped, decorTile, 'garden-arch');
    const moveTarget = emptyTileIds(capped)[0];
    expect(placedItemCount(capped)).toBe(64);
    const movedDecoration = moveDecorationAction(capped, capped.decorations[0].id, moveTarget);
    expect(movedDecoration).not.toBe(capped);
    expect(movedDecoration.decorations[0].tileId).toBe(moveTarget);
    expect(placedItemCount(movedDecoration)).toBe(64);
  });
});

function legacy82TileGarden(): GardenState {
  const base = createEmptyState();
  const legacyTiles = Array.from({ length: 82 }, (_, index) => ({
    id: `tile-${index}`,
    x: index % 9 - 4,
    z: Math.floor(index / 9) - 4,
    surface: 'grass' as const,
    height: 0,
  }));
  return { ...base, soilTiles: legacyTiles };
}

describe('gardenLimits legacy preservation', () => {
  it('loads oversized legacy gardens without truncating data through pure actions', () => {
    const legacy = legacy82TileGarden();
    expect(getGardenCapacity(legacy).isLegacy).toBe(true);
    expect(addSoilTileAction(legacy, 0, 0)).toBe(legacy);
    expect(legacy.soilTiles).toHaveLength(82);
  });

  it('round-trips an 82-tile out-of-bounds legacy garden through persistence serialization', async () => {
    const legacy = legacy82TileGarden();
    expect(legacy.soilTiles.some((tile) => !isLegalSoilCoordinate(tile.x, tile.z))).toBe(true);
    expect(getGardenCapacity(legacy).isLegacy).toBe(true);

    const persisted = toPersisted(legacy);
    const reparsed = JSON.parse(JSON.stringify(persisted)) as typeof persisted;
    const hydrated = normalizeGardenState(await hydrateState(reparsed, async () => null));

    expect(hydrated.soilTiles).toHaveLength(82);
    expect(hydrated.soilTiles).toEqual(legacy.soilTiles);
    expect(getGardenCapacity(hydrated).isLegacy).toBe(true);
  });
});
