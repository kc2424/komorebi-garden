export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'error' | 'offline';

export type ItemSyncState = 'local' | 'pending_upload' | 'synced';

export interface SyncMeta {
  /** Local edit counter (client-side). */
  revision: number;
  /** Last server revision successfully synced. */
  lastSyncedRevision: number | null;
  pendingChanges: boolean;
  lastSyncAt: string | null;
  lastError: string | null;
  /** Server tombstone revision after wipe; older clients must not push below this. */
  tombstoneRevision?: number | null;
}

export interface AuthState {
  userId: string | null;
  email: string | null;
  isGuest: boolean;
  otpSent: boolean;
}

export type ConflictChoice = 'cloud' | 'local' | 'pending';

export interface ConflictInfo {
  cloudRevision: number;
  localRevision: number;
  cloudObservationCount: number;
  localObservationCount: number;
  cloudPlantCount: number;
  localPlantCount: number;
}

export interface ShelvedGarden {
  id: string;
  userId: string;
  savedAt: string;
  label: string;
  stateJson: string;
}
