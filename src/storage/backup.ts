import type { GardenState } from '../types';
import { loadImage, saveImage } from './imageStore';
import { toPersisted, hydrateState, type PersistedGardenState } from './serializableState';
import { createEmptyState } from './migration';

export const BACKUP_SCHEMA_VERSION = 1;

export interface BackupPayload {
  schemaVersion: number;
  exportedAt: string;
  garden: PersistedGardenState;
  images: { ref: string; dataUrl: string }[];
}

export interface BackupValidation {
  ok: boolean;
  error?: string;
  observationCount?: number;
  plantCount?: number;
  imageCount?: number;
}

export function validateBackup(raw: unknown): BackupValidation {
  if (!raw || typeof raw !== 'object') {
    return { ok: false, error: 'ファイルの形式が不正です。' };
  }
  const b = raw as BackupPayload;
  if (b.schemaVersion !== BACKUP_SCHEMA_VERSION) {
    return { ok: false, error: `未対応のバックアップ形式（v${b.schemaVersion}）です。` };
  }
  if (!b.garden || b.garden.version !== 3) {
    return { ok: false, error: '庭データの形式が不正です。' };
  }
  if (!Array.isArray(b.images)) {
    return { ok: false, error: '写真データが見つかりません。' };
  }

  const obsRefs = new Set(b.garden.observations.map((o) => o.imageRef));
  for (const img of b.images) {
    if (!obsRefs.has(img.ref)) {
      return { ok: false, error: '写真と観察の参照が一致しません。' };
    }
  }
  for (const ref of obsRefs) {
    if (!b.images.some((i) => i.ref === ref)) {
      return { ok: false, error: `観察写真（${ref}）がバックアップに含まれていません。` };
    }
  }

  return {
    ok: true,
    observationCount: b.garden.observations.length,
    plantCount: b.garden.plants.length,
    imageCount: b.images.length,
  };
}

export async function exportBackup(state: GardenState): Promise<BackupPayload> {
  const persisted = toPersisted(state);
  const images: { ref: string; dataUrl: string }[] = [];
  for (const obs of persisted.observations) {
    const runtime = state.observations.find((o) => o.id === obs.id);
    const dataUrl = runtime?.imageDataUrl || (await loadImage(obs.imageRef));
    if (!dataUrl) {
      throw new Error(`観察写真（${obs.imageRef}）が見つかりません。`);
    }
    images.push({ ref: obs.imageRef, dataUrl });
  }
  return {
    schemaVersion: BACKUP_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    garden: persisted,
    images,
  };
}

export async function importBackup(payload: BackupPayload): Promise<GardenState> {
  for (const img of payload.images) {
    await saveImage(img.ref, img.dataUrl);
  }
  return hydrateState(payload.garden, loadImage);
}

/** Apply restored garden data while keeping the signed-in account CAS baseline. */
export function mergeRestoredState(current: GardenState, restored: GardenState): GardenState {
  const nextRevision = Math.max(current.sync.revision, restored.sync.revision) + 1;
  return {
    ...restored,
    sync: {
      lastSyncedRevision: current.sync.lastSyncedRevision,
      tombstoneRevision: current.sync.tombstoneRevision ?? null,
      revision: nextRevision,
      pendingChanges: true,
      lastSyncAt: current.sync.lastSyncAt,
      lastError: null,
    },
  };
}

export function parseBackupFile(text: string): { payload?: BackupPayload; error?: string } {
  try {
    const parsed = JSON.parse(text) as unknown;
    const validation = validateBackup(parsed);
    if (!validation.ok) return { error: validation.error };
    return { payload: parsed as BackupPayload };
  } catch {
    return { error: 'JSONの解析に失敗しました。' };
  }
}

export function createWipeState(
  cloudRevision?: number,
  tombstoneRevision?: number | null,
): GardenState {
  const empty = createEmptyState();
  if (cloudRevision == null) {
    return {
      ...empty,
      sync: {
        revision: 1,
        lastSyncedRevision: null,
        pendingChanges: true,
        lastSyncAt: null,
        lastError: null,
        tombstoneRevision: null,
      },
    };
  }

  const tombstone = tombstoneRevision ?? cloudRevision;
  return {
    ...empty,
    sync: {
      revision: cloudRevision,
      lastSyncedRevision: cloudRevision,
      pendingChanges: false,
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      tombstoneRevision: tombstone,
    },
  };
}
