import type { GardenModelType, GardenPlant, TulipColor } from '../types';
import { COSMOS_HEIGHT } from '../components/garden3d/cosmosGeometry';
import { PANSY_HEIGHT } from '../components/garden3d/pansyGeometry';
import { getFlowerCatalogEntry } from '../data/flowerCatalog';

export const MODEL_HEIGHTS: Record<GardenModelType, number> = {
  tulip: 1.4,
  cosmos: COSMOS_HEIGHT,
  pansy: PANSY_HEIGHT,
};

export function resolvePlantModelType(plant: Pick<GardenPlant, 'modelType'>): GardenModelType {
  return plant.modelType ?? 'tulip';
}

export function isTulipModelPlant(plant: Pick<GardenPlant, 'modelType'>): boolean {
  return resolvePlantModelType(plant) === 'tulip';
}

export function getModelHeight(modelType: GardenModelType): number {
  return MODEL_HEIGHTS[modelType];
}

export function getPlantModelHeight(plant: Pick<GardenPlant, 'modelType'>): number {
  return getModelHeight(resolvePlantModelType(plant));
}

export function normalizeGardenPlant(plant: GardenPlant): GardenPlant {
  const modelType = resolvePlantModelType(plant);
  if (plant.modelType === modelType) return plant;
  return { ...plant, modelType };
}

export function defaultColorForModel(modelType: GardenModelType): TulipColor {
  if (modelType === 'tulip') return 'red';
  return 'pink';
}

export function getModelPreviewLabel(modelType: GardenModelType): string {
  const entry = getFlowerCatalogEntry(modelType);
  if (!entry.isModelPreview) return '';
  return 'モデル見本（写真未連携）';
}
