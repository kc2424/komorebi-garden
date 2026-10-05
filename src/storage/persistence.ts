import type {
  GardenDecoration,
  GardenState,
  GardenPlant,
  SaveResult,
  SoilTile,
  TileSurface,
} from '../types';
import { resolvePlantModelType } from '../utils/plantModel';
import { DECORATION_CATALOG } from '../data/decorationCatalog';
import { FLOWER_CATALOG } from '../data/flowerCatalog';
import { normalizeTerrainHeight, TILE_SURFACES } from '../utils/terrain';
import {
  createEmptyState,
  migrateV1ToV2,
  migrateV2ToV3,
  tryLoadV1FromStorage,
  tryLoadV2FromStorage,
} from './migration';
import { getLocalDb, scopeForUser, GUEST_SCOPE } from './localDb';
import { deleteImages, loadImage, saveImage, imageRefForObservation } from './imageStore';
import {
  hydrateState,
  toPersisted,
  type PersistedGardenState,
} from './serializableState';

export { createEmptyState };

const LEGACY_V2_KEY = 'komorebi-garden-v2';

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
    Number.isInteger(t.z) &&
    (t.surface === undefined || TILE_SURFACES.includes(t.surface)) &&
    (t.height === undefined || (typeof t.height === 'number' && Number.isFinite(t.height)))
  );
}

function isValidPlant(value: unknown): value is GardenPlant {
  if (!value || typeof value !== 'object') return false;
  const p = value as GardenPlant;
  const colors = ['red', 'yellow', 'pink', 'white', 'purple', 'orange'];
  const observationIdsValid =
    p.observationIds === undefined ||
    (Array.isArray(p.observationIds) && p.observationIds.every((id) => typeof id === 'string'));
  const modelTypeValid =
    p.modelType === undefined || FLOWER_CATALOG.some((entry) => entry.modelType === p.modelType);
  return (
    typeof p.id === 'string' &&
    colors.includes(p.color) &&
    typeof p.tileId === 'string' &&
    typeof p.rotation === 'number' &&
    observationIdsValid &&
    modelTypeValid
  );
}

function isValidDecoration(value: unknown): value is GardenDecoration {
  if (!value || typeof value !== 'object') return false;
  const d = value as GardenDecoration;
  return (
    typeof d.id === 'string' &&
    DECORATION_CATALOG.some((entry) => entry.type === d.type) &&
    typeof d.tileId === 'string' &&
    typeof d.rotation === 'number'
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
    soilTiles: state.soilTiles.map((tile) => ({
      ...tile,
      surface: (tile.surface ?? 'grass') as TileSurface,
      height: normalizeTerrainHeight(tile.height),
    })),
    plants: state.plants.map(normalizePlant),
    stashedPlants: state.stashedPlants.map(normalizePlant),
    decorations: state.decorations ?? [],
    stashedDecorations: state.stashedDecorations ?? [],
  };
}

function isValidPersistedState(value: unknown): value is PersistedGardenState {
  if (!value || typeof value !== 'object') return false;
  const s = value as PersistedGardenState;
  if (s.version !== 3) return false;
  if (!Array.isArray(s.soilTiles) || !s.soilTiles.every(isValidSoilTile)) return false;
  if (!Array.isArray(s.plants) || !s.plants.every(isValidPlant)) return false;
  if (!Array.isArray(s.stashedPlants) || !s.stashedPlants.every(isValidPlant)) return false;
  if (s.decorations !== undefined && (!Array.isArray(s.decorations) || !s.decorations.every(isValidDecoration))) return false;
  if (
    s.stashedDecorations !== undefined &&
    (!Array.isArray(s.stashedDecorations) || !s.stashedDecorations.every(isValidDecoration))
  ) return false;
  if (!Array.isArray(s.observations)) return false;
  if (typeof s.tulipUnlocked !== 'boolean') return false;
  if (!s.sync || typeof s.sync.revision !== 'number') return false;

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
  for (const decoration of s.decorations ?? []) {
    if (!tileIds.has(decoration.tileId)) return false;
    if (placedIds.has(decoration.id)) return false;
    if (s.plants.some((plant) => plant.tileId === decoration.tileId)) return false;
    placedIds.add(decoration.id);
  }
  for (const decoration of s.stashedDecorations ?? []) {
    if (placedIds.has(decoration.id)) return false;
    placedIds.add(decoration.id);
  }
  return true;
}

async function readPersisted(scope: string): Promise<PersistedGardenState | null> {
  const db = await getLocalDb();
  const row = await db.get('garden', scope);
  if (!row) return null;
  try {
    const parsed = JSON.parse(row.stateJson) as unknown;
    if (!isValidPersistedState(parsed)) return null;
    return parsed;
  } catch {
    return null;
  }
}

async function writePersisted(scope: string, persisted: PersistedGardenState): Promise<SaveResult> {
  try {
    const db = await getLocalDb();
    await db.put('garden', {
      userScope: scope,
      stateJson: JSON.stringify(persisted),
      updatedAt: new Date().toISOString(),
    });
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

async function migrateLegacyStorage(): Promise<LoadResult | null> {
  const v2 = tryLoadV2FromStorage();
  if (v2) {
    const v3 = migrateV2ToV3(v2);
    for (const obs of v3.observations) {
      if (obs.imageDataUrl) {
        await saveImage(obs.imageRef, obs.imageDataUrl);
      }
    }
    const save = await saveState(v3, GUEST_SCOPE);
    if (!save.ok) {
      return { state: v3, migrated: true, error: save.error };
    }
    return { state: v3, migrated: true };
  }

  const v1 = tryLoadV1FromStorage();
  if (v1) {
    const v2state = migrateV1ToV2(v1);
    const v3 = migrateV2ToV3(v2state);
    for (const obs of v3.observations) {
      if (obs.imageDataUrl) {
        await saveImage(obs.imageRef, obs.imageDataUrl);
      }
    }
    const save = await saveState(v3, GUEST_SCOPE);
    return {
      state: v3,
      migrated: true,
      error: save.ok ? undefined : save.error,
    };
  }

  return null;
}

export async function loadState(userId: string | null = null): Promise<LoadResult> {
  const scope = scopeForUser(userId);
  try {
    const persisted = await readPersisted(scope);
    if (persisted) {
      const state = normalizeGardenState(await hydrateState(persisted, loadImage));
      return { state };
    }

    if (scope === GUEST_SCOPE) {
      const migrated = await migrateLegacyStorage();
      if (migrated) return migrated;
    }

    return { state: createEmptyState() };
  } catch {
    return {
      state: createEmptyState(),
      error: '保存データの読み込みに失敗しました。',
    };
  }
}

export async function saveState(
  state: GardenState,
  userId: string | null = null,
): Promise<SaveResult> {
  try {
    const scope = scopeForUser(userId);

    for (const obs of state.observations) {
      if (obs.imageDataUrl) {
        await saveImage(obs.imageRef || imageRefForObservation(obs.id), obs.imageDataUrl);
      }
    }

    const persisted = toPersisted(state);
    return writePersisted(scope, persisted);
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

/** Remove photos, shelved copies, and legacy guest storage without deleting the garden row. */
export async function clearScopeWipeArtifacts(userId: string | null): Promise<void> {
  const scope = scopeForUser(userId);
  const db = await getLocalDb();
  const imageRefs = new Set<string>();

  const row = await db.get('garden', scope);
  if (row) {
    try {
      const parsed = JSON.parse(row.stateJson) as PersistedGardenState;
      for (const obs of parsed.observations) {
        if (obs.imageRef) imageRefs.add(obs.imageRef);
      }
    } catch {
      /* ignore parse errors */
    }
  }

  const shelved = await db.getAll('shelved');
  const shelvedTx = db.transaction('shelved', 'readwrite');
  for (const entry of shelved) {
    if (entry.userScope !== scope) continue;
    try {
      const parsed = JSON.parse(entry.stateJson) as PersistedGardenState;
      for (const obs of parsed.observations) {
        if (obs.imageRef) imageRefs.add(obs.imageRef);
      }
    } catch {
      /* ignore parse errors */
    }
    await shelvedTx.store.delete(entry.id);
  }
  await shelvedTx.done;

  if (imageRefs.size > 0) {
    await deleteImages([...imageRefs]);
  }

  if (scope === GUEST_SCOPE) {
    try {
      localStorage.removeItem('komorebi-garden-v1');
      localStorage.removeItem(LEGACY_V2_KEY);
    } catch {
      /* ignore */
    }
  }
}

export async function clearScopeData(userId: string | null): Promise<void> {
  const scope = scopeForUser(userId);
  const db = await getLocalDb();
  const row = await db.get('garden', scope);
  if (row) {
    try {
      const parsed = JSON.parse(row.stateJson) as PersistedGardenState;
      const refs = parsed.observations.map((o) => o.imageRef);
      await deleteImages(refs);
    } catch {
      /* ignore parse errors */
    }
    await db.delete('garden', scope);
  }
  if (scope === GUEST_SCOPE) {
    try {
      localStorage.removeItem('komorebi-garden-v1');
      localStorage.removeItem(LEGACY_V2_KEY);
    } catch {
      /* ignore */
    }
  }
}

export async function shelveGarden(
  userId: string,
  label: string,
  state: GardenState,
): Promise<void> {
  const db = await getLocalDb();
  const id = `shelved-${Date.now()}`;
  await db.put('shelved', {
    id,
    userScope: scopeForUser(userId),
    label,
    stateJson: JSON.stringify(toPersisted(state)),
    savedAt: new Date().toISOString(),
  });
}

export async function listShelved(userId: string): Promise<
  { id: string; label: string; savedAt: string }[]
> {
  const db = await getLocalDb();
  const all = await db.getAll('shelved');
  return all
    .filter((s) => s.userScope === scopeForUser(userId))
    .map((s) => ({ id: s.id, label: s.label, savedAt: s.savedAt }));
}

export async function restoreShelved(id: string, userId: string): Promise<GardenState | null> {
  const db = await getLocalDb();
  const row = await db.get('shelved', id);
  if (!row || row.userScope !== scopeForUser(userId)) return null;
  try {
    const parsed = JSON.parse(row.stateJson) as PersistedGardenState;
    if (!isValidPersistedState(parsed)) return null;
    return normalizeGardenState(await hydrateState(parsed, loadImage));
  } catch {
    return null;
  }
}

export function bumpRevision(state: GardenState): GardenState {
  return {
    ...state,
    sync: {
      ...state.sync,
      revision: state.sync.revision + 1,
      pendingChanges: true,
    },
  };
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

/** @deprecated v2 key kept for migration only */
export { LEGACY_V2_KEY };
