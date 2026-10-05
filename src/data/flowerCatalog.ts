import type { GardenModelType, TulipColor } from '../types';
import { TULIP_COLORS } from './tulip';

export type PlantCategory = 'flower' | 'foliage' | 'tree';

export interface FlowerCatalogEntry {
  modelType: GardenModelType;
  commonNameJa: string;
  scientificName: string;
  description: string;
  category: PlantCategory;
  /** Static preview generated from the same low-poly geometry as the garden. */
  thumbnail: string;
  /** Kept for backward-compatible catalog metadata; sandbox plants are freely placeable. */
  requiresTulipUnlock: boolean;
  supportsColor: boolean;
  isModelPreview: boolean;
}

export function getPlantThumbnailUrl(modelType: GardenModelType, color: TulipColor = 'red'): string {
  const name = modelType === 'tulip' && color !== 'red' ? `tulip-${color}` : modelType;
  return `${import.meta.env.BASE_URL}art/plants/${name}.svg`;
}

function entry(modelType: GardenModelType, commonNameJa: string, scientificName: string, description: string, category: PlantCategory = 'flower'): FlowerCatalogEntry {
  return {
    modelType, commonNameJa, scientificName, description, category,
    thumbnail: getPlantThumbnailUrl(modelType),
    requiresTulipUnlock: false,
    supportsColor: modelType === 'tulip',
    isModelPreview: false,
  };
}

export const FLOWER_CATALOG: FlowerCatalogEntry[] = [
  entry('tulip', 'チューリップ', 'Tulipa gesneriana', 'すっと伸びる茎と、6色のカップ形の花'),
  entry('cosmos', 'コスモス', 'Cosmos bipinnatus', '細い茎に広がる、軽やかなピンクの花'),
  entry('pansy', 'パンジー', 'Viola × wittrockiana', '足元を彩る、重なり合った紫の花びら'),
  entry('daisy', 'デイジー', 'Bellis perennis', '白い花びらが輪になった小さな花'),
  entry('sunflower', 'ヒマワリ', 'Helianthus annuus', '大きな黄色い花と、背の高い茎'),
  entry('lavender', 'ラベンダー', 'Lavandula angustifolia', '銀緑の葉から伸びる、細長い紫の花穂'),
  entry('rose', 'バラ', 'Rosa', '花びらを幾重にも重ねた、やわらかな花'),
  entry('hydrangea', 'アジサイ', 'Hydrangea macrophylla', '青い小花が集まる、こんもりした花房'),
  entry('marigold', 'マリーゴールド', 'Tagetes patula', '丸いオレンジの花が、低くまとまる'),
  entry('daffodil', 'スイセン', 'Narcissus', '細長い葉と、ラッパのような黄色い花'),
  entry('lily', 'ユリ', 'Lilium', '大きく開く白い花びらと、すらりとした茎'),
  entry('poppy', 'ポピー', 'Papaver rhoeas', '薄いコーラル色の花びらと、丸いつぼみ'),
  entry('bluebell', 'ブルーベル', 'Hyacinthoides non-scripta', '小さな青紫のベルが、茎に連なる'),
  entry('forget-me-not', 'ワスレナグサ', 'Myosotis', '淡い青の小花が集まる、足元の彩り'),
  entry('allium', 'アリウム', 'Allium', '長い一本の茎に浮かぶ、まん丸の紫の花'),
  entry('fern', 'シダ', 'Polypodiopsida', '細かく分かれた葉が、放射状に広がる', 'foliage'),
  entry('hosta', 'ギボウシ', 'Hosta', '淡い縁取りのある、大きく重なる葉', 'foliage'),
  entry('ornamental-grass', 'ススキ', 'Miscanthus sinensis', '細い葉の束と、穏やかに伸びる穂', 'foliage'),
  entry('maple', 'モミジ', 'Acer palmatum', '枝を横に広げる、秋色の小さな木', 'tree'),
  entry('cherry', 'サクラ', 'Prunus', '淡いピンクの花が、ふんわり枝を包む木', 'tree'),
];

export function getFlowerCatalogEntry(modelType: GardenModelType): FlowerCatalogEntry {
  return FLOWER_CATALOG.find((flower) => flower.modelType === modelType) ?? FLOWER_CATALOG[0];
}

export function isFlowerPlantable(modelType: GardenModelType, _tulipUnlocked: boolean): boolean {
  return FLOWER_CATALOG.some((flower) => flower.modelType === modelType);
}

export function getPlantDisplayName(plant: { modelType?: GardenModelType; color: TulipColor }): string {
  const modelType = plant.modelType ?? 'tulip';
  const catalogEntry = getFlowerCatalogEntry(modelType);
  if (modelType === 'tulip') {
    const colorLabel = TULIP_COLORS.find((color) => color.id === plant.color)?.label;
    return colorLabel ? `${catalogEntry.commonNameJa}（${colorLabel}）` : catalogEntry.commonNameJa;
  }
  return catalogEntry.commonNameJa;
}
