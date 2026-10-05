import type { GardenState } from '../types';

export const GARDEN_LIMITS = {
  minCoordinate: -4,
  maxCoordinate: 4,
  maxTiles: 81,
  maxPlacedItems: 64,
  maxHeight: 3,
} as const;

export interface GardenCapacity {
  tileCount: number;
  placedItemCount: number;
  tilesRemaining: number;
  itemsRemaining: number;
  isLegacy: boolean;
}

export const GARDEN_TILE_MAX_ERROR = `地面は${GARDEN_LIMITS.maxTiles}枚まで追加できます。`;

export const GARDEN_TILE_COORD_ERROR = '庭は最大9×9マスです。この外には広げられません。';

export const GARDEN_PLACED_ITEM_MAX_ERROR =
  `庭に置ける植物と飾りは合わせて${GARDEN_LIMITS.maxPlacedItems}個までです。収納の中は数に含みません。`;

export const GARDEN_PLACEMENT_BLOCKED_ERROR =
  'ここには置けませんでした。空いているタイルを選ぶか、しばらくしてからもう一度お試しください。';

export function didRestoreStashedPlant(
  before: GardenState,
  after: GardenState,
  plantId: string,
  tileId: string,
): boolean {
  if (!before.stashedPlants.some((plant) => plant.id === plantId)) return false;
  if (after.stashedPlants.some((plant) => plant.id === plantId)) return false;
  const placed = after.plants.find((plant) => plant.id === plantId);
  return placed?.tileId === tileId;
}

export function findNewlyPlacedPlantId(
  before: GardenState,
  after: GardenState,
  tileId: string,
): string | null {
  const placed = after.plants.find((plant) => plant.tileId === tileId);
  if (!placed || before.plants.some((plant) => plant.id === placed.id)) return null;
  return placed.id;
}

export function isLegalSoilCoordinate(x: number, z: number): boolean {
  return (
    Number.isFinite(x) &&
    Number.isFinite(z) &&
    Number.isInteger(x) &&
    Number.isInteger(z) &&
    x >= GARDEN_LIMITS.minCoordinate &&
    x <= GARDEN_LIMITS.maxCoordinate &&
    z >= GARDEN_LIMITS.minCoordinate &&
    z <= GARDEN_LIMITS.maxCoordinate
  );
}

function tileHasInvalidCoordinates(state: GardenState): boolean {
  return state.soilTiles.some((tile) => !isLegalSoilCoordinate(tile.x, tile.z));
}

export function getGardenCapacity(state: GardenState): GardenCapacity {
  const tileCount = state.soilTiles.length;
  const placedItemCount = state.plants.length + state.decorations.length;
  const tilesRemaining = Math.max(0, GARDEN_LIMITS.maxTiles - tileCount);
  const itemsRemaining = Math.max(0, GARDEN_LIMITS.maxPlacedItems - placedItemCount);
  const isLegacy =
    tileCount > GARDEN_LIMITS.maxTiles ||
    placedItemCount > GARDEN_LIMITS.maxPlacedItems ||
    tileHasInvalidCoordinates(state);

  return {
    tileCount,
    placedItemCount,
    tilesRemaining,
    itemsRemaining,
    isLegacy,
  };
}

export function canAddGardenTile(state: GardenState, x: number, z: number): boolean {
  if (!isLegalSoilCoordinate(x, z)) return false;
  if (state.soilTiles.length >= GARDEN_LIMITS.maxTiles) return false;
  if (state.soilTiles.some((tile) => tile.x === x && tile.z === z)) return false;
  return true;
}

export function canPlaceGardenItem(state: GardenState): boolean {
  return state.plants.length + state.decorations.length < GARDEN_LIMITS.maxPlacedItems;
}

export function getAddSoilTileBlockError(state: GardenState, x: number, z: number): string | null {
  if (!isLegalSoilCoordinate(x, z)) return GARDEN_TILE_COORD_ERROR;
  if (state.soilTiles.length >= GARDEN_LIMITS.maxTiles) return GARDEN_TILE_MAX_ERROR;
  return null;
}

export function getPlacedItemBlockError(state: GardenState): string | null {
  if (!canPlaceGardenItem(state)) return GARDEN_PLACED_ITEM_MAX_ERROR;
  return null;
}
