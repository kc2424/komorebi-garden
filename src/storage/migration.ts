import type {
  GardenState,
  LegacyV1Archive,
  PlantObservation,
  SoilTile,
} from '../types';
import { getLegacySpeciesById } from '../data/speciesCatalog';
import { defaultSyncMeta } from './serializableState';
import { imageRefForObservation } from './imageStore';
import { normalizeTerrainHeight } from '../utils/terrain';

const V1_STORAGE_KEY = 'komorebi-garden-v1';
const V2_STORAGE_KEY = 'komorebi-garden-v2';

interface RawV1State {
  version: 1;
  collections: LegacyV1Archive['collections'];
  observations: LegacyV1Archive['observations'];
  placements: LegacyV1Archive['placements'];
  gardenMode: 'photo' | 'storybook';
  previewState: string;
}

interface RawV2Observation {
  id: string;
  plantType: PlantObservation['plantType'];
  commonNameJa: string;
  scientificName: string;
  familyName: string;
  color: PlantObservation['color'];
  imageDataUrl: string;
  takenAt: string;
  memo: string;
  isSample: boolean;
  identificationSource: PlantObservation['identificationSource'];
  createdAt: string;
}

interface RawV2State {
  version: 2;
  soilTiles: SoilTile[];
  plants: GardenState['plants'];
  stashedPlants: GardenState['stashedPlants'];
  observations: RawV2Observation[];
  tulipUnlocked: boolean;
  legacyV1?: LegacyV1Archive;
}

function createDefaultSoilTiles(): SoilTile[] {
  const tiles: SoilTile[] = [];
  for (let x = -2; x <= 2; x += 1) {
    for (let z = -2; z <= 2; z += 1) {
      tiles.push({ id: `soil-${x}-${z}`, x, z, surface: 'grass', height: 0 });
    }
  }
  return tiles;
}

function migrateObservationsFromV1(v1: RawV1State): PlantObservation[] {
  return v1.observations.map((obs) => {
    const species = getLegacySpeciesById(obs.speciesId);
    const id = obs.id;
    return {
      id,
      plantType: 'other',
      commonNameJa: species?.commonNameJa ?? '不明な植物',
      scientificName: species?.scientificName ?? '',
      familyName: species?.familyName ?? '',
      color: null,
      imageRef: imageRefForObservation(id),
      imageDataUrl: obs.imageDataUrl,
      takenAt: obs.takenAt,
      memo: obs.memo,
      isSample: obs.isSample,
      identificationSource: obs.isSample ? 'sample' : 'manual',
      trait: '',
      createdAt: obs.createdAt,
      syncState: 'local',
    };
  });
}

export function createEmptyState(): GardenState {
  return {
    version: 3,
    soilTiles: createDefaultSoilTiles(),
    plants: [],
    stashedPlants: [],
    decorations: [],
    stashedDecorations: [],
    observations: [],
    tulipUnlocked: false,
    sync: defaultSyncMeta(),
  };
}

export function migrateV1ToV2(v1: RawV1State): RawV2State {
  const legacyArchive: LegacyV1Archive = {
    version: 1,
    collections: v1.collections,
    observations: v1.observations,
    placements: v1.placements,
    gardenMode: v1.gardenMode,
    previewState: v1.previewState,
  };

  return {
    version: 2,
    soilTiles: createDefaultSoilTiles(),
    plants: [],
    stashedPlants: [],
    observations: migrateObservationsFromV1(v1).map((o) => ({
      ...o,
      imageDataUrl: o.imageDataUrl,
    })),
    tulipUnlocked: false,
    legacyV1: legacyArchive,
  };
}

export function migrateV2ToV3(v2: RawV2State): GardenState {
  const observations: PlantObservation[] = v2.observations.map((o) => ({
    id: o.id,
    plantType: o.plantType,
    commonNameJa: o.commonNameJa,
    scientificName: o.scientificName,
    familyName: o.familyName,
    color: o.color,
    imageRef: imageRefForObservation(o.id),
    imageDataUrl: o.imageDataUrl,
    takenAt: o.takenAt,
    memo: o.memo,
    isSample: o.isSample,
    identificationSource: o.identificationSource,
    trait: '',
    createdAt: o.createdAt,
    syncState: 'local',
  }));

  return {
    version: 3,
    soilTiles: v2.soilTiles.map((tile) => ({ ...tile, height: normalizeTerrainHeight(tile.height) })),
    plants: v2.plants,
    stashedPlants: v2.stashedPlants,
    decorations: [],
    stashedDecorations: [],
    observations,
    tulipUnlocked: v2.tulipUnlocked,
    legacyV1: v2.legacyV1,
    sync: defaultSyncMeta(),
  };
}

export function tryLoadV1FromStorage(): RawV1State | null {
  try {
    const raw = localStorage.getItem(V1_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RawV1State;
    if (parsed.version !== 1) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function tryLoadV2FromStorage(): RawV2State | null {
  try {
    const raw = localStorage.getItem(V2_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as RawV2State;
    if (parsed.version !== 2) return null;
    return parsed;
  } catch {
    return null;
  }
}

export { createDefaultSoilTiles, V1_STORAGE_KEY, V2_STORAGE_KEY };
