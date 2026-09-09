import type { GardenModelType, TulipColor } from '../types';
import { TULIP_COLORS } from './tulip';

export interface FlowerCatalogEntry {
  modelType: GardenModelType;
  commonNameJa: string;
  scientificName: string;
  description: string;
  /** Tulip requires observation unlock; cosmos and pansy are always available as model previews. */
  requiresTulipUnlock: boolean;
  supportsColor: boolean;
  isModelPreview: boolean;
}

export const FLOWER_CATALOG: FlowerCatalogEntry[] = [
  {
    modelType: 'tulip',
    commonNameJa: 'チューリップ',
    scientificName: 'Tulipa gesneriana',
    description: '観察記録と色を選んで植えられます',
    requiresTulipUnlock: true,
    supportsColor: true,
    isModelPreview: false,
  },
  {
    modelType: 'cosmos',
    commonNameJa: 'コスモス',
    scientificName: 'Cosmos bipinnatus',
    description: '薄く開いた一重咲きの見本',
    requiresTulipUnlock: false,
    supportsColor: false,
    isModelPreview: true,
  },
  {
    modelType: 'pansy',
    commonNameJa: 'パンジー',
    scientificName: 'Viola × wittrockiana',
    description: '低い株立ちの見本',
    requiresTulipUnlock: false,
    supportsColor: false,
    isModelPreview: true,
  },
];

export function getFlowerCatalogEntry(modelType: GardenModelType): FlowerCatalogEntry {
  const entry = FLOWER_CATALOG.find((f) => f.modelType === modelType);
  if (!entry) {
    return FLOWER_CATALOG[0];
  }
  return entry;
}

export function isFlowerPlantable(
  modelType: GardenModelType,
  tulipUnlocked: boolean,
): boolean {
  const entry = getFlowerCatalogEntry(modelType);
  if (entry.requiresTulipUnlock) return tulipUnlocked;
  return true;
}

export function getPlantDisplayName(
  plant: { modelType?: GardenModelType; color: TulipColor },
): string {
  const modelType = plant.modelType ?? 'tulip';
  const entry = getFlowerCatalogEntry(modelType);
  if (modelType === 'tulip') {
    const colorLabel = TULIP_COLORS.find((c) => c.id === plant.color)?.label;
    return colorLabel ? `${entry.commonNameJa}（${colorLabel}）` : entry.commonNameJa;
  }
  return entry.commonNameJa;
}
