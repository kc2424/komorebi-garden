import type {
  GardenState,
  LegacyV1Archive,
  PlantObservation,
  SoilTile,
} from '../types';
import { getLegacySpeciesById } from '../data/speciesCatalog';

const V1_STORAGE_KEY = 'komorebi-garden-v1';

interface RawV1State {
  version: 1;
  collections: LegacyV1Archive['collections'];
  observations: LegacyV1Archive['observations'];
  placements: LegacyV1Archive['placements'];
  gardenMode: 'photo' | 'storybook';
  previewState: string;
}

function createDefaultSoilTiles(): SoilTile[] {
  const tiles: SoilTile[] = [];
  for (let x = -1; x <= 1; x += 1) {
    for (let z = -1; z <= 1; z += 1) {
      tiles.push({ id: `soil-${x}-${z}`, x, z });
    }
  }
  return tiles;
}

function migrateObservationsFromV1(v1: RawV1State): PlantObservation[] {
  return v1.observations.map((obs) => {
    const species = getLegacySpeciesById(obs.speciesId);
    return {
      id: obs.id,
      plantType: 'other',
      commonNameJa: species?.commonNameJa ?? '不明な植物',
      scientificName: species?.scientificName ?? '',
      familyName: species?.familyName ?? '',
      color: null,
      imageDataUrl: obs.imageDataUrl,
      takenAt: obs.takenAt,
      memo: obs.memo,
      isSample: obs.isSample,
      identificationSource: obs.isSample ? 'sample' : 'manual',
      createdAt: obs.createdAt,
    };
  });
}

export function createEmptyState(): GardenState {
  return {
    version: 2,
    soilTiles: createDefaultSoilTiles(),
    plants: [],
    stashedPlants: [],
    observations: [],
    tulipUnlocked: false,
  };
}

export function migrateV1ToV2(v1: RawV1State): GardenState {
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
    observations: migrateObservationsFromV1(v1),
    tulipUnlocked: false,
    legacyV1: legacyArchive,
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

export { createDefaultSoilTiles };
