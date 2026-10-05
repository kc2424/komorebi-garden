import type { GardenModelType, GardenPlant, GardenState, SoilTile, TulipColor } from '../types';
import { isFlowerPlantable } from '../data/flowerCatalog';
import { getPlantOnTile } from '../storage/persistence';
import { resolvePlantModelType } from './plantModel';

export interface PendingPlacement {
  modelType: GardenModelType;
  color: TulipColor;
  tileId: string;
  rotation: number;
  observationId?: string | null;
  fromStashPlantId?: string;
}

export function getEmptySoilTiles(state: GardenState): SoilTile[] {
  return state.soilTiles.filter(
    (tile) =>
      !getPlantOnTile(state, tile.id) &&
      !state.decorations.some((decoration) => decoration.tileId === tile.id),
  );
}

export function canSelectFlowerModel(modelType: GardenModelType, tulipUnlocked: boolean): boolean {
  return isFlowerPlantable(modelType, tulipUnlocked);
}

export function canBeginPendingPlacement(
  state: GardenState,
  tileId: string,
  modelType: GardenModelType,
  tulipUnlocked: boolean,
): boolean {
  if (!canSelectFlowerModel(modelType, tulipUnlocked)) return false;
  if (!state.soilTiles.some((t) => t.id === tileId)) return false;
  if (
    getPlantOnTile(state, tileId) ||
    state.decorations.some((decoration) => decoration.tileId === tileId)
  ) return false;
  return true;
}

export function cycleEmptyTileId(
  emptyTiles: SoilTile[],
  currentTileId: string | null,
  direction: 1 | -1,
): string | null {
  if (emptyTiles.length === 0) return null;
  if (!currentTileId) return emptyTiles[0].id;
  const index = emptyTiles.findIndex((t) => t.id === currentTileId);
  if (index < 0) return emptyTiles[0].id;
  const next = (index + direction + emptyTiles.length) % emptyTiles.length;
  return emptyTiles[next].id;
}

export function buildPlacedPlant(
  pending: PendingPlacement,
  existingId?: string,
): GardenPlant {
  const id = existingId ?? `plant-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  const modelType = resolvePlantModelType({ modelType: pending.modelType });
  const linkedObservationId =
    modelType === 'tulip' && pending.observationId ? pending.observationId : undefined;

  return {
    id,
    color: pending.color,
    tileId: pending.tileId,
    rotation: pending.rotation,
    modelType,
    ...(linkedObservationId ? { observationIds: [linkedObservationId] } : {}),
  };
}

export function stashPlantLabel(plant: GardenPlant): string {
  const modelType = resolvePlantModelType(plant);
  if (modelType === 'tulip') {
    return 'tulip';
  }
  return modelType;
}
