import type { GardenState } from '../types';
import type { ConflictInfo } from '../types/sync';

export interface CloudSnapshot {
  revision: number;
  tombstoneRevision: number | null;
  state: GardenState;
}

export type SyncDecision =
  | { action: 'push'; expectedRevision: number | null }
  | { action: 'pull'; cloudRevision: number }
  | { action: 'noop'; cloudRevision: number }
  | { action: 'conflict'; info: ConflictInfo; cloudRevision: number };

export function buildConflictInfo(
  local: GardenState,
  cloud: GardenState,
  cloudRevision: number,
): ConflictInfo {
  return {
    cloudRevision,
    localRevision: local.sync.revision,
    cloudObservationCount: cloud.observations.length,
    localObservationCount: local.observations.length,
    cloudPlantCount: cloud.plants.length,
    localPlantCount: local.plants.length,
  };
}

export function isBelowTombstone(local: GardenState, tombstoneRevision: number | null): boolean {
  if (tombstoneRevision == null) return false;
  const base = local.sync.lastSyncedRevision ?? 0;
  return base < tombstoneRevision;
}

export function decideSync(
  local: GardenState,
  cloud: CloudSnapshot | null,
): SyncDecision {
  if (!cloud) {
    return { action: 'push', expectedRevision: null };
  }

  const { revision: cloudRevision, tombstoneRevision, state: cloudState } = cloud;
  const lastSynced = local.sync.lastSyncedRevision;

  if (tombstoneRevision != null && (lastSynced ?? 0) < tombstoneRevision && local.sync.pendingChanges) {
    return {
      action: 'conflict',
      info: buildConflictInfo(local, cloudState, cloudRevision),
      cloudRevision,
    };
  }

  if (!local.sync.pendingChanges && lastSynced === cloudRevision) {
    return { action: 'noop', cloudRevision };
  }

  const localChanged = local.sync.pendingChanges;
  const cloudChanged = lastSynced == null ? cloudRevision > 0 : cloudRevision > lastSynced;

  if (localChanged && cloudChanged) {
    return {
      action: 'conflict',
      info: buildConflictInfo(local, cloudState, cloudRevision),
      cloudRevision,
    };
  }

  if (cloudChanged && !local.sync.pendingChanges) {
    return { action: 'pull', cloudRevision };
  }

  if (local.sync.pendingChanges) {
    return { action: 'push', expectedRevision: lastSynced };
  }

  return { action: 'noop', cloudRevision };
}

export function applySyncedState(
  state: GardenState,
  serverRevision: number,
  tombstoneRevision?: number | null,
): GardenState {
  return {
    ...state,
    sync: {
      ...state.sync,
      lastSyncedRevision: serverRevision,
      pendingChanges: false,
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      tombstoneRevision: tombstoneRevision ?? state.sync.tombstoneRevision ?? null,
    },
  };
}

export type SyncAckMode = 'pull' | 'noop' | 'push';

/** Apply a successful sync result to local state, respecting pull vs push acknowledgement rules. */
export function applySyncAcknowledgement(
  mode: SyncAckMode,
  current: GardenState,
  acknowledged: GardenState,
  serverRevision: number,
  tombstoneRevision?: number | null,
): GardenState {
  if (mode === 'pull') {
    return acknowledged;
  }
  if (mode === 'noop') {
    return applySyncedState(current, serverRevision, tombstoneRevision);
  }
  return mergeSyncAcknowledgement(current, acknowledged, serverRevision, tombstoneRevision);
}

/** Keep in-flight local edits while recording a successful server revision and upload metadata. */
export function mergeSyncAcknowledgement(
  current: GardenState,
  acknowledged: GardenState,
  serverRevision: number,
  tombstoneRevision?: number | null,
): GardenState {
  const uploadedMeta = new Map(
    acknowledged.observations
      .filter((obs) => obs.storagePath)
      .map((obs) => [obs.id, { storagePath: obs.storagePath!, syncState: obs.syncState ?? ('synced' as const) }]),
  );

  const observations = current.observations.map((obs) => {
    const uploaded = uploadedMeta.get(obs.id);
    if (!uploaded) return obs;
    return {
      ...obs,
      storagePath: uploaded.storagePath,
      syncState: uploaded.syncState,
    };
  });

  const concurrentLocalEdits = current.sync.revision > acknowledged.sync.revision;

  return {
    ...current,
    observations,
    sync: {
      ...current.sync,
      lastSyncedRevision: serverRevision,
      pendingChanges: concurrentLocalEdits,
      lastSyncAt: new Date().toISOString(),
      lastError: null,
      tombstoneRevision: tombstoneRevision ?? current.sync.tombstoneRevision ?? null,
    },
  };
}

export function applyPulledState(
  cloudState: GardenState,
  cloudRevision: number,
  tombstoneRevision?: number | null,
): GardenState {
  const tombstone = tombstoneRevision ?? cloudState.sync.tombstoneRevision ?? null;
  return applySyncedState(cloudState, cloudRevision, tombstone);
}
