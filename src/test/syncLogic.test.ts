import { describe, it, expect } from 'vitest';
import { createEmptyState } from '../storage/migration';
import { saveObservationAction } from '../storage/gardenActions';
import {
  decideSync,
  applySyncedState,
  applyPulledState,
  applySyncAcknowledgement,
  mergeSyncAcknowledgement,
  isBelowTombstone,
  buildConflictInfo,
} from '../sync/syncLogic';

function stateWithObservation() {
  const { nextState } = saveObservationAction(createEmptyState(), {
    plantType: 'tulip',
    commonNameJa: 'チューリップ',
    scientificName: 'Tulipa',
    familyName: 'ユリ科',
    trait: '花弁が6枚',
    color: 'red',
    imageDataUrl: 'data:image/jpeg;base64,x',
    isSample: false,
    identificationSource: 'manual',
  });
  return nextState;
}

describe('syncLogic decideSync', () => {
  it('pushes when cloud is empty', () => {
    const local = stateWithObservation();
    expect(decideSync(local, null)).toEqual({ action: 'push', expectedRevision: null });
  });

  it('detects conflict when both sides changed', () => {
    const local = stateWithObservation();
    const cloudState = createEmptyState();
    const decision = decideSync(local, {
      revision: 5,
      tombstoneRevision: null,
      state: cloudState,
    });
    expect(decision.action).toBe('conflict');
    if (decision.action === 'conflict') {
      expect(decision.info.cloudRevision).toBe(5);
    }
  });

  it('pulls when only cloud changed', () => {
    const local = createEmptyState();
    local.sync.lastSyncedRevision = 3;
    const cloudState = stateWithObservation();
    const decision = decideSync(local, {
      revision: 5,
      tombstoneRevision: null,
      state: cloudState,
    });
    expect(decision.action).toBe('pull');
  });

  it('noops when already in sync', () => {
    const local = createEmptyState();
    local.sync.lastSyncedRevision = 4;
    local.sync.pendingChanges = false;
    const decision = decideSync(local, {
      revision: 4,
      tombstoneRevision: null,
      state: local,
    });
    expect(decision.action).toBe('noop');
  });

  it('flags tombstone against stale local pending', () => {
    const local = stateWithObservation();
    local.sync.lastSyncedRevision = 2;
    const decision = decideSync(local, {
      revision: 5,
      tombstoneRevision: 5,
      state: createEmptyState(),
    });
    expect(decision.action).toBe('conflict');
  });
});

describe('syncLogic helpers', () => {
  it('applySyncedState records server revision', () => {
    const local = stateWithObservation();
    const synced = applySyncedState(local, 7, 5);
    expect(synced.sync.lastSyncedRevision).toBe(7);
    expect(synced.sync.pendingChanges).toBe(false);
    expect(synced.sync.tombstoneRevision).toBe(5);
  });

  it('applyPulledState normalizes lastSyncedRevision and clears pending', () => {
    const cloud = stateWithObservation();
    cloud.sync.pendingChanges = true;
    cloud.sync.lastSyncedRevision = null;
    const pulled = applyPulledState(cloud, 9, 4);
    expect(pulled.sync.lastSyncedRevision).toBe(9);
    expect(pulled.sync.pendingChanges).toBe(false);
    expect(pulled.sync.tombstoneRevision).toBe(4);
  });

  it('isBelowTombstone detects stale client', () => {
    const local = createEmptyState();
    local.sync.lastSyncedRevision = 2;
    expect(isBelowTombstone(local, 5)).toBe(true);
    local.sync.lastSyncedRevision = 5;
    expect(isBelowTombstone(local, 5)).toBe(false);
  });

  it('buildConflictInfo counts observations', () => {
    const local = stateWithObservation();
    const info = buildConflictInfo(local, createEmptyState(), 3);
    expect(info.localObservationCount).toBe(1);
    expect(info.cloudObservationCount).toBe(0);
  });

  it('applySyncAcknowledgement pull replaces empty local with cloud content', () => {
    const local = createEmptyState();
    local.sync.lastSyncedRevision = 1;
    const cloud = stateWithObservation();
    const pulled = applyPulledState(cloud, 2, null);

    const merged = applySyncAcknowledgement('pull', local, pulled, 2, null);
    expect(merged.observations).toHaveLength(1);
    expect(merged.observations[0].commonNameJa).toBe('チューリップ');
    expect(merged.sync.lastSyncedRevision).toBe(2);
    expect(merged.sync.pendingChanges).toBe(false);
  });

  it('applySyncAcknowledgement noop updates sync metadata without discarding local data', () => {
    const local = stateWithObservation();
    local.sync.lastSyncedRevision = 2;
    local.sync.pendingChanges = false;
    const acknowledged = applySyncedState(local, 2, null);

    const merged = applySyncAcknowledgement('noop', local, acknowledged, 2, null);
    expect(merged.observations).toHaveLength(1);
    expect(merged.sync.lastSyncedRevision).toBe(2);
    expect(merged.sync.pendingChanges).toBe(false);
  });

  it('mergeSyncAcknowledgement preserves upload metadata and concurrent local edits', () => {
    const local = stateWithObservation();
    local.sync.revision = 2;
    local.sync.pendingChanges = true;

    const acknowledged = applySyncedState(
      {
        ...local,
        sync: { ...local.sync, revision: 1 },
        observations: local.observations.map((obs) => ({
          ...obs,
          storagePath: 'user-1/obs.jpg',
          syncState: 'synced' as const,
        })),
      },
      4,
      null,
    );

    const merged = mergeSyncAcknowledgement(local, acknowledged, 4, null);
    expect(merged.sync.lastSyncedRevision).toBe(4);
    expect(merged.sync.pendingChanges).toBe(true);
    expect(merged.observations[0].storagePath).toBe('user-1/obs.jpg');
    expect(merged.observations[0].syncState).toBe('synced');
    expect(merged.observations[0].commonNameJa).toBe(local.observations[0].commonNameJa);
  });

  it('mergeSyncAcknowledgement clears pending when no concurrent local edits', () => {
    const local = stateWithObservation();
    const acknowledged = applySyncedState(
      {
        ...local,
        observations: local.observations.map((obs) => ({
          ...obs,
          storagePath: 'user-1/obs.jpg',
          syncState: 'synced' as const,
        })),
      },
      2,
      null,
    );

    const merged = mergeSyncAcknowledgement(local, acknowledged, 2, null);
    expect(merged.sync.pendingChanges).toBe(false);
    expect(merged.observations[0].storagePath).toBe('user-1/obs.jpg');
  });

  it('does not false-conflict after server revision is acknowledged', () => {
    const local = stateWithObservation();
    local.sync.lastSyncedRevision = 1;
    const acknowledged = applySyncedState(
      {
        ...local,
        observations: local.observations.map((obs) => ({
          ...obs,
          storagePath: 'user-1/obs.jpg',
          syncState: 'synced' as const,
        })),
      },
      2,
      null,
    );

    const unacked = local;
    expect(
      decideSync(unacked, {
        revision: 2,
        tombstoneRevision: null,
        state: acknowledged,
      }).action,
    ).toBe('conflict');

    const merged = mergeSyncAcknowledgement(unacked, acknowledged, 2, null);
    expect(
      decideSync(merged, {
        revision: 2,
        tombstoneRevision: null,
        state: acknowledged,
      }).action,
    ).toBe('noop');
  });
});
