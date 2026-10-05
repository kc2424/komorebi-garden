import type { GardenState, PlantObservation } from '../types';
import type { SyncMeta } from '../types/sync';
import { normalizeTerrainHeight } from '../utils/terrain';

/** Persisted observation: image stored separately in imageStore. */
export interface PersistedObservation {
  id: string;
  plantType: PlantObservation['plantType'];
  commonNameJa: string;
  scientificName: string;
  familyName: string;
  trait: string;
  color: PlantObservation['color'];
  imageRef: string;
  takenAt: string;
  memo: string;
  isSample: boolean;
  identificationSource: PlantObservation['identificationSource'];
  createdAt: string;
  storagePath?: string;
  syncState?: 'local' | 'pending_upload' | 'synced';
}

export interface PersistedGardenState {
  version: 3;
  soilTiles: GardenState['soilTiles'];
  plants: GardenState['plants'];
  stashedPlants: GardenState['stashedPlants'];
  /** Optional only for v3 saves written before the sandbox update. */
  decorations?: GardenState['decorations'];
  /** Optional only for v3 saves written before the sandbox update. */
  stashedDecorations?: GardenState['stashedDecorations'];
  observations: PersistedObservation[];
  tulipUnlocked: boolean;
  legacyV1?: GardenState['legacyV1'];
  sync: SyncMeta;
}

export function toPersisted(state: GardenState): PersistedGardenState {
  const observations: PersistedObservation[] = state.observations.map((o) => ({
    id: o.id,
    plantType: o.plantType,
    commonNameJa: o.commonNameJa,
    scientificName: o.scientificName,
    familyName: o.familyName,
    trait: o.trait,
    color: o.color,
    imageRef: o.imageRef,
    takenAt: o.takenAt,
    memo: o.memo,
    isSample: o.isSample,
    identificationSource: o.identificationSource,
    createdAt: o.createdAt,
    storagePath: o.storagePath,
    syncState: o.syncState,
  }));

  return {
    version: 3,
    soilTiles: state.soilTiles.map((tile) => ({ ...tile, height: normalizeTerrainHeight(tile.height) })),
    plants: state.plants,
    stashedPlants: state.stashedPlants,
    decorations: state.decorations,
    stashedDecorations: state.stashedDecorations,
    observations,
    tulipUnlocked: state.tulipUnlocked,
    legacyV1: state.legacyV1,
    sync: state.sync,
  };
}

export async function hydrateState(
  persisted: PersistedGardenState,
  loadImage: (ref: string) => Promise<string | null>,
): Promise<GardenState> {
  const observations: PlantObservation[] = [];
  for (const o of persisted.observations) {
    const imageDataUrl = (await loadImage(o.imageRef)) ?? '';
    observations.push({
      id: o.id,
      plantType: o.plantType,
      commonNameJa: o.commonNameJa,
      scientificName: o.scientificName,
      familyName: o.familyName,
      trait: o.trait ?? '',
      color: o.color,
      imageRef: o.imageRef,
      imageDataUrl,
      takenAt: o.takenAt,
      memo: o.memo,
      isSample: o.isSample,
      identificationSource: o.identificationSource,
      createdAt: o.createdAt,
      storagePath: o.storagePath,
      syncState: o.syncState,
    });
  }

  return {
    version: 3,
    soilTiles: persisted.soilTiles.map((tile) => ({ ...tile, height: normalizeTerrainHeight(tile.height) })),
    plants: persisted.plants,
    stashedPlants: persisted.stashedPlants,
    decorations: persisted.decorations ?? [],
    stashedDecorations: persisted.stashedDecorations ?? [],
    observations,
    tulipUnlocked: persisted.tulipUnlocked,
    legacyV1: persisted.legacyV1,
    sync: persisted.sync,
  };
}

export function defaultSyncMeta(): SyncMeta {
  return {
    revision: 0,
    lastSyncedRevision: null,
    pendingChanges: false,
    lastSyncAt: null,
    lastError: null,
    tombstoneRevision: null,
  };
}
