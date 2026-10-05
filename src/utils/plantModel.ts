import type { GardenModelType, GardenPlant, TulipColor } from '../types';
import { PLANT_SHAPES } from '../data/plantShapes';
import { getFlowerCatalogEntry } from '../data/flowerCatalog';

export const MODEL_HEIGHTS = Object.fromEntries(
  Object.entries(PLANT_SHAPES).map(([modelType, shape]) => [modelType, shape.height]),
) as Record<GardenModelType, number>;

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
  if (modelType === 'tulip' || modelType === 'poppy') return 'red';
  if (modelType === 'daisy' || modelType === 'lily') return 'white';
  if (modelType === 'sunflower' || modelType === 'daffodil') return 'yellow';
  if (modelType === 'lavender' || modelType === 'allium' || modelType === 'bluebell') return 'purple';
  if (modelType === 'marigold' || modelType === 'maple') return 'orange';
  return 'pink';
}

export function getModelPreviewLabel(modelType: GardenModelType): string {
  const entry = getFlowerCatalogEntry(modelType);
  if (!entry.isModelPreview) return '';
  return 'モデル見本（写真未連携）';
}
