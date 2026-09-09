export type TulipColor = 'red' | 'yellow' | 'pink' | 'white' | 'purple' | 'orange';

export type GardenModelType = 'tulip' | 'cosmos' | 'pansy';

export type PlantType = 'tulip' | 'other';

export type IdentificationSource = 'sample' | 'plantnet' | 'manual';

export type GardenEditMode = 'view' | 'add-soil' | 'remove-soil' | 'plant' | 'move' | 'remove-plant';

export interface SoilTile {
  id: string;
  x: number;
  z: number;
}

export interface GardenPlant {
  id: string;
  color: TulipColor;
  tileId: string;
  rotation: number;
  /** Omitted or undefined means tulip for v2 backward compatibility. */
  modelType?: GardenModelType;
  /** Explicit links to observation records; never inferred from color or species. */
  observationIds?: string[];
}

export type GardenScreenPhase = 'viewing' | 'building';

export interface PlantObservation {
  id: string;
  plantType: PlantType;
  commonNameJa: string;
  scientificName: string;
  familyName: string;
  color: TulipColor | null;
  imageDataUrl: string;
  takenAt: string;
  memo: string;
  isSample: boolean;
  identificationSource: IdentificationSource;
  createdAt: string;
}

/** Preserved read-only snapshot from the 2D prototype (v1). */
export interface LegacyV1Archive {
  version: 1;
  collections: LegacyCollection[];
  observations: LegacyObservation[];
  placements: LegacyPlacement[];
  gardenMode: 'photo' | 'storybook';
  previewState: string;
}

export interface LegacyCollection {
  speciesId: string;
  firstFoundAt: string;
  lastFoundAt: string;
  foundCount: number;
  memo: string;
}

export interface LegacyObservation {
  id: string;
  speciesId: string;
  imageDataUrl: string;
  takenAt: string;
  memo: string;
  isSample: boolean;
  createdAt: string;
}

export interface LegacyPlacement {
  speciesId: string;
  gridX: number;
  gridY: number;
}

export interface GardenState {
  version: 2;
  soilTiles: SoilTile[];
  plants: GardenPlant[];
  stashedPlants: GardenPlant[];
  observations: PlantObservation[];
  tulipUnlocked: boolean;
  legacyV1?: LegacyV1Archive;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export type Screen =
  | 'garden'
  | 'discover'
  | 'identify'
  | 'complete'
  | 'observations'
  | 'observation-detail'
  | 'credits';

export interface DiscoveryDraft {
  imageDataUrl: string;
  source: 'camera' | 'file' | 'sample';
  sampleKey?: string;
}

export interface IdentificationCandidate {
  plantType: PlantType;
  commonNameJa: string;
  scientificName: string;
  familyName: string;
  trait: string;
  score?: number;
  isTulipMatch: boolean;
  /** User-facing reject-all / unknown save option (not from API). */
  isUnknownOption?: boolean;
}

export interface IdentificationResult {
  status: 'ok' | 'not-configured' | 'error';
  candidates: IdentificationCandidate[];
  message?: string;
  provider?: 'plantnet';
}

export interface RegistrationResult {
  type: 'new' | 'rediscovery';
  observationId: string;
  plantType: PlantType;
  commonNameJa: string;
  tulipUnlocked: boolean;
  saved: boolean;
}
