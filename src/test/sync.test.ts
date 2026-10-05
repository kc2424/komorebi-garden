import { describe, it, expect } from 'vitest';
import { createEmptyState } from '../storage/migration';
import { saveObservationAction, plantTulipAction } from '../storage/gardenActions';
import { buildConflictInfo } from '../sync/syncLogic';
import { isSupabaseConfigured } from '../sync/supabaseClient';

describe('sync', () => {
  it('detects conflict info between local and cloud', () => {
    let local = createEmptyState();
    const { nextState } = saveObservationAction(local, {
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,x',
      isSample: false,
      identificationSource: 'manual',
    });
    local = nextState;
    local = plantTulipAction(local, local.soilTiles[0].id, 'red');

    const cloud = createEmptyState();
    const info = buildConflictInfo(local, cloud, 5);
    expect(info.localObservationCount).toBe(1);
    expect(info.cloudObservationCount).toBe(0);
    expect(info.localPlantCount).toBe(1);
    expect(info.cloudRevision).toBe(5);
  });

  it('reports unconfigured supabase in test env', () => {
    expect(isSupabaseConfigured()).toBe(false);
  });
});
