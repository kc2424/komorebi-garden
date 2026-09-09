import type { GardenModelType, GardenState, GardenPlant, SaveResult, SoilTile } from '../types';
import { resolvePlantModelType } from '../utils/plantModel';
import {
  createEmptyState,
  migrateV1ToV2,
  tryLoadV1FromStorage,
} from './migration';

export { createEmptyState };

const STORAGE_KEY = 'komorebi-garden-v2';
/** Recognition path: research 10 — long edge 1280px, JPEG q90 before Pl@ntNet. */
const MAX_IMAGE_DIMENSION = 1280;
const JPEG_QUALITY = 0.9;

export interface LoadResult {
  state: GardenState;
  migrated?: boolean;
  error?: string;
}

function isValidSoilTile(value: unknown): value is SoilTile {
  if (!value || typeof value !== 'object') return false;
  const t = value as SoilTile;
  return (
    typeof t.id === 'string' &&
    typeof t.x === 'number' &&
    typeof t.z === 'number' &&
    Number.isInteger(t.x) &&
    Number.isInteger(t.z)
  );
}

const GARDEN_MODEL_TYPES: GardenModelType[] = ['tulip', 'cosmos', 'pansy'];

function isValidPlant(value: unknown): value is GardenPlant {
  if (!value || typeof value !== 'object') return false;
  const p = value as GardenPlant;
  const colors = ['red', 'yellow', 'pink', 'white', 'purple', 'orange'];
  const observationIdsValid =
    p.observationIds === undefined ||
    (Array.isArray(p.observationIds) && p.observationIds.every((id) => typeof id === 'string'));
  const modelTypeValid =
    p.modelType === undefined || GARDEN_MODEL_TYPES.includes(p.modelType);
  return (
    typeof p.id === 'string' &&
    colors.includes(p.color) &&
    typeof p.tileId === 'string' &&
    typeof p.rotation === 'number' &&
    observationIdsValid &&
    modelTypeValid
  );
}

export function normalizeGardenState(state: GardenState): GardenState {
  const normalizePlant = (plant: GardenPlant): GardenPlant => {
    const modelType = resolvePlantModelType(plant);
    const observationIds =
      modelType === 'tulip' ? plant.observationIds : undefined;
    return {
      ...plant,
      modelType: plant.modelType ?? undefined,
      observationIds,
    };
  };

  return {
    ...state,
    plants: state.plants.map(normalizePlant),
    stashedPlants: state.stashedPlants.map(normalizePlant),
  };
}

function isValidGardenState(value: unknown): value is GardenState {
  if (!value || typeof value !== 'object') return false;
  const s = value as GardenState;
  if (s.version !== 2) return false;
  if (!Array.isArray(s.soilTiles) || !s.soilTiles.every(isValidSoilTile)) return false;
  if (!Array.isArray(s.plants) || !s.plants.every(isValidPlant)) return false;
  if (!Array.isArray(s.stashedPlants) || !s.stashedPlants.every(isValidPlant)) return false;
  if (!Array.isArray(s.observations)) return false;
  if (typeof s.tulipUnlocked !== 'boolean') return false;

  const tileIds = new Set(s.soilTiles.map((t) => t.id));
  const placedIds = new Set<string>();
  for (const plant of s.plants) {
    if (!tileIds.has(plant.tileId)) return false;
    if (placedIds.has(plant.id)) return false;
    placedIds.add(plant.id);
  }
  for (const plant of s.stashedPlants) {
    if (placedIds.has(plant.id)) return false;
    placedIds.add(plant.id);
  }

  return true;
}

export function loadState(): LoadResult {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      const v1 = tryLoadV1FromStorage();
      if (v1) {
        const migrated = migrateV1ToV2(v1);
        saveState(migrated);
        return { state: migrated, migrated: true };
      }
      return { state: createEmptyState() };
    }

    const parsed: unknown = JSON.parse(raw);
    if (!isValidGardenState(parsed)) {
      const v1 = tryLoadV1FromStorage();
      if (v1) {
        return {
          state: migrateV1ToV2(v1),
          migrated: true,
          error: 'v2データが不正だったため、v1から再移行しました。',
        };
      }
      return {
        state: createEmptyState(),
        error: '保存データの形式が不正です。既存のv1データは保持されています。',
      };
    }

    return { state: normalizeGardenState(parsed) };
  } catch {
    return {
      state: createEmptyState(),
      error: '保存データの読み込みに失敗しました。',
    };
  }
}

export function saveState(state: GardenState): SaveResult {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : '不明なエラー';
    if (message.includes('quota') || message.includes('QuotaExceeded')) {
      return {
        ok: false,
        error: '保存容量が不足しています。古い記録を削除するか、写真の枚数を減らしてください。',
      };
    }
    return { ok: false, error: `保存に失敗しました: ${message}` };
  }
}

export async function compressImage(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('画像の読み込みに失敗しました'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('画像の表示に失敗しました'));
      img.onload = () => {
        try {
          let { width, height } = img;
          if (width > MAX_IMAGE_DIMENSION || height > MAX_IMAGE_DIMENSION) {
            const ratio = Math.min(MAX_IMAGE_DIMENSION / width, MAX_IMAGE_DIMENSION / height);
            width = Math.round(width * ratio);
            height = Math.round(height * ratio);
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          if (!ctx) {
            reject(new Error('画像の処理に失敗しました'));
            return;
          }
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
        } catch (e) {
          reject(e instanceof Error ? e : new Error('画像の圧縮に失敗しました'));
        }
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

export async function loadImageFromUrl(url: string): Promise<string> {
  const response = await fetch(url);
  if (!response.ok) throw new Error('サンプル画像の読み込みに失敗しました');
  const blob = await response.blob();
  if (!blob.type.startsWith('image/')) {
    throw new Error('サンプル画像の形式が不正です');
  }
  const file = new File([blob], 'sample.jpg', { type: blob.type || 'image/jpeg' });
  return compressImage(file);
}

export function getTileAt(state: GardenState, x: number, z: number): SoilTile | undefined {
  return state.soilTiles.find((t) => t.x === x && t.z === z);
}

export function getPlantOnTile(state: GardenState, tileId: string): GardenPlant | undefined {
  return state.plants.find((p) => p.tileId === tileId);
}

export function countTulipObservations(state: GardenState): number {
  return state.observations.filter((o) => o.plantType === 'tulip').length;
}
