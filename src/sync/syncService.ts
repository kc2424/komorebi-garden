import type { GardenState } from '../types';
import type { ConflictInfo } from '../types/sync';
import { toPersisted, hydrateState, type PersistedGardenState } from '../storage/serializableState';
import { loadImage, saveImage } from '../storage/imageStore';
import { getSupabase, isSupabaseConfigured } from './supabaseClient';
import {
  decideSync,
  applySyncedState,
  applyPulledState,
  buildConflictInfo,
  type CloudSnapshot,
} from './syncLogic';

export type SyncAckMode = 'pull' | 'noop' | 'push';

export type SyncResult =
  | { status: 'not_configured' }
  | { status: 'not_authenticated' }
  | { status: 'halted' }
  | { status: 'synced'; mode: SyncAckMode; state: GardenState }
  | { status: 'conflict'; info: ConflictInfo; cloudState: GardenState; localState: GardenState }
  | { status: 'error'; error: string };

interface CloudRow {
  revision: number;
  tombstone_revision: number | null;
  state_json: PersistedGardenState;
}

const BUCKET = 'observation-photos';
const PAGE_SIZE = 100;

export { buildConflictInfo };

function dataUrlToBlob(dataUrl: string): Blob {
  const [header, base64] = dataUrl.split(',');
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/jpeg';
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes], { type: mime });
}

export async function uploadPendingImages(
  userId: string,
  state: GardenState,
): Promise<{ state: GardenState; allUploaded: boolean; errors: string[] }> {
  const supabase = getSupabase();
  if (!supabase) return { state, allUploaded: false, errors: ['未設定'] };

  let allUploaded = true;
  const errors: string[] = [];
  const observations = [];
  for (const obs of state.observations) {
    if (obs.syncState === 'synced' && obs.storagePath) {
      observations.push(obs);
      continue;
    }
    const dataUrl = obs.imageDataUrl || (await loadImage(obs.imageRef));
    if (!dataUrl) {
      allUploaded = false;
      errors.push(`写真 ${obs.id} が端末にありません`);
      observations.push({ ...obs, syncState: 'pending_upload' as const });
      continue;
    }
    const path = `${userId}/${obs.id}.jpg`;
    const blob = dataUrlToBlob(dataUrl);
    const { error } = await supabase.storage.from(BUCKET).upload(path, blob, {
      upsert: true,
      contentType: 'image/jpeg',
    });
    if (error) {
      allUploaded = false;
      errors.push(error.message);
      observations.push({ ...obs, syncState: 'pending_upload' as const });
    } else {
      observations.push({ ...obs, storagePath: path, syncState: 'synced' as const });
    }
  }
  return { state: { ...state, observations }, allUploaded, errors };
}

export async function downloadCloudImages(persisted: PersistedGardenState): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) throw new Error('同期サービスが未設定です');

  const failures: string[] = [];
  for (const obs of persisted.observations) {
    if (!obs.storagePath) continue;
    const { data, error } = await supabase.storage.from(BUCKET).download(obs.storagePath);
    if (error || !data) {
      failures.push(obs.storagePath);
      continue;
    }
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(new Error('画像の読み込みに失敗'));
      reader.readAsDataURL(data);
    });
    await saveImage(obs.imageRef, dataUrl);
  }
  if (failures.length > 0) {
    throw new Error(`クラウド写真の取得に失敗しました（${failures.length}件）`);
  }
}

export type PullResult =
  | { ok: true; exists: false }
  | { ok: true; exists: true; snapshot: CloudSnapshot }
  | { ok: false; error: string };

export async function pullCloudState(_userId: string): Promise<PullResult> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: '未設定' };

  const { data, error } = await supabase
    .from('garden_snapshots')
    .select('revision, tombstone_revision, state_json')
    .maybeSingle();

  if (error) return { ok: false, error: error.message };
  if (!data) return { ok: true, exists: false };

  const row = data as CloudRow;
  try {
    await downloadCloudImages(row.state_json);
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : '写真の取得に失敗' };
  }
  const state = await hydrateState(row.state_json, loadImage);
  const normalized = applyPulledState(
    {
      ...state,
      sync: {
        ...state.sync,
        tombstoneRevision: row.tombstone_revision,
      },
    },
    row.revision,
  );
  return {
    ok: true,
    exists: true,
    snapshot: {
      revision: row.revision,
      tombstoneRevision: row.tombstone_revision,
      state: normalized,
    },
  };
}

export async function pushCloudState(
  userId: string,
  state: GardenState,
  expectedRevision: number | null,
): Promise<{ ok: boolean; conflict?: boolean; newRevision?: number; state?: GardenState; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: '未設定' };

  const { state: withImages, allUploaded, errors } = await uploadPendingImages(userId, state);
  if (!allUploaded) {
    return { ok: false, error: errors[0] ?? '写真のアップロードが完了していません。' };
  }

  const persisted = toPersisted(withImages);
  const { data, error } = await supabase.rpc('upsert_garden_snapshot', {
    p_expected_revision: expectedRevision,
    p_state_json: persisted,
  });

  if (error) {
    if (error.message.includes('revision_conflict')) {
      return { ok: false, conflict: true, error: error.message };
    }
    return { ok: false, error: error.message };
  }

  const row = data as CloudRow | null;
  return { ok: true, newRevision: row?.revision, state: withImages };
}

export async function syncGarden(
  userId: string,
  localState: GardenState,
  syncHalted: boolean,
): Promise<SyncResult> {
  if (!isSupabaseConfigured()) return { status: 'not_configured' };
  if (syncHalted) return { status: 'halted' };

  const pulled = await pullCloudState(userId);
  if (!pulled.ok) return { status: 'error', error: pulled.error };

  const cloud: CloudSnapshot | null = pulled.exists ? pulled.snapshot : null;
  const decision = decideSync(localState, cloud);

  if (decision.action === 'conflict') {
    return {
      status: 'conflict',
      info: decision.info,
      cloudState: cloud!.state,
      localState,
    };
  }

  if (decision.action === 'pull') {
    const synced = applyPulledState(cloud!.state, decision.cloudRevision);
    return { status: 'synced', mode: 'pull', state: synced };
  }

  if (decision.action === 'noop') {
    const synced = applySyncedState(localState, decision.cloudRevision, cloud?.tombstoneRevision);
    return { status: 'synced', mode: 'noop', state: synced };
  }

  const push = await pushCloudState(userId, localState, decision.expectedRevision);
  if (push.conflict && cloud) {
    const refreshed = await pullCloudState(userId);
    if (refreshed.ok && refreshed.exists) {
      return {
        status: 'conflict',
        info: buildConflictInfo(localState, refreshed.snapshot.state, refreshed.snapshot.revision),
        cloudState: refreshed.snapshot.state,
        localState,
      };
    }
  }
  if (!push.ok) {
    return { status: 'error', error: push.error ?? '同期に失敗しました。' };
  }

  const pushedState = push.state ?? localState;
  const synced = applySyncedState(pushedState, push.newRevision!, cloud?.tombstoneRevision);
  return { status: 'synced', mode: 'push', state: synced };
}

export async function wipeCloudGarden(
  userId: string,
  expectedRevision: number | null,
): Promise<{ ok: boolean; revision?: number; tombstoneRevision?: number; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: '未設定' };

  const { data, error } = await supabase.rpc('wipe_garden_snapshot', {
    p_expected_revision: expectedRevision,
  });
  if (error) return { ok: false, error: error.message };

  const row = data as CloudRow;
  await removeAllUserPhotos(userId);

  return {
    ok: true,
    revision: row.revision,
    tombstoneRevision: row.tombstone_revision ?? row.revision,
  };
}

export async function removeAllUserPhotos(userId: string): Promise<{ ok: boolean; error?: string }> {
  const supabase = getSupabase();
  if (!supabase) return { ok: false, error: '未設定' };

  let offset = 0;
  const paths: string[] = [];
  for (;;) {
    const { data, error } = await supabase.storage.from(BUCKET).list(userId, {
      limit: PAGE_SIZE,
      offset,
    });
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) break;
    paths.push(...data.map((f) => `${userId}/${f.name}`));
    if (data.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }

  if (paths.length > 0) {
    const { error } = await supabase.storage.from(BUCKET).remove(paths);
    if (error) return { ok: false, error: error.message };
  }
  return { ok: true };
}
