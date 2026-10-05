import type { SyncMeta } from './sync.js';

export type TulipColor = 'red' | 'yellow' | 'pink' | 'white' | 'purple' | 'orange';

export type GardenModelType =
  | 'tulip' | 'cosmos' | 'pansy' | 'daisy' | 'sunflower'
  | 'lavender' | 'rose' | 'hydrangea' | 'marigold' | 'daffodil'
  | 'lily' | 'poppy' | 'bluebell' | 'forget-me-not' | 'allium'
  | 'fern' | 'hosta' | 'ornamental-grass' | 'maple' | 'cherry';

export type TileSurface = 'soil' | 'grass' | 'stone' | 'gravel' | 'wood' | 'water';

export type GardenDecorationType =
  | 'bench' | 'round-stone' | 'lantern' | 'wood-fence'
  | 'birdbath' | 'fountain' | 'flower-pot' | 'watering-can'
  | 'signpost' | 'garden-arch' | 'stepping-stones' | 'mushroom';

export type PlantType = 'tulip' | 'other';

export type IdentificationSource = 'sample' | 'plantnet' | 'manual';

export type GardenEditMode =
  | 'view'
  | 'add-soil'
  | 'remove-soil'
  | 'plant'
  | 'paint-surface'
  | 'place-decoration'
  | 'raise-terrain'
  | 'lower-terrain'
  | 'move'
  | 'remove-plant';

export interface SoilTile {
  id: string;
  x: number;
  z: number;
  /** Missing in older v3 saves; normalized to grass when loaded. */
  surface?: TileSurface;
  /** Discrete elevation 0–3; missing in older saves means ground level. */
  height?: number;
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

export interface GardenDecoration {
  id: string;
  type: GardenDecorationType;
  tileId: string;
  rotation: number;
}

export type GardenScreenPhase = 'viewing' | 'building';

export interface PlantObservation {
  id: string;
  plantType: PlantType;
  commonNameJa: string;
  scientificName: string;
  familyName: string;
  /** Candidate trait text preserved from identification (read-only after save). */
  trait: string;
  color: TulipColor | null;
  /** Local image store reference (persisted). */
  imageRef: string;
  /** Hydrated at runtime from imageStore; not persisted in state JSON. */
  imageDataUrl: string;
  takenAt: string;
  memo: string;
  isSample: boolean;
  identificationSource: IdentificationSource;
  createdAt: string;
  /** Supabase Storage path when synced (private, not a public URL). */
  storagePath?: string;
  syncState?: 'local' | 'pending_upload' | 'synced';
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
  version: 3;
  soilTiles: SoilTile[];
  plants: GardenPlant[];
  stashedPlants: GardenPlant[];
  decorations: GardenDecoration[];
  stashedDecorations: GardenDecoration[];
  observations: PlantObservation[];
  tulipUnlocked: boolean;
  legacyV1?: LegacyV1Archive;
  sync: SyncMeta;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export type Screen =
  | 'onboarding'
  | 'garden'
  | 'outings'
  | 'garden-visit'
  | 'discover'
  | 'photo-confirm'
  | 'identify'
  | 'complete'
  | 'observations'
  | 'observation-detail'
  | 'settings'
  | 'data-management'
  | 'auth'
  | 'help'
  | 'privacy'
  | 'credits';

export type DraftIdentStatus = 'sample' | 'plantnet' | 'manual' | 'not-configured' | 'error' | 'idle';

export interface DiscoveryDraft {
  imageDataUrl: string;
  source: 'camera' | 'file' | 'sample';
  sampleKey?: string;
  step?: 'photo-confirm' | 'identify';
  /** True after first identify attempt; resume does not auto-retry API. */
  identificationAttempted?: boolean;
  candidates?: IdentificationCandidate[];
  selectedIndex?: number;
  color?: TulipColor;
  customName?: string;
  identStatus?: DraftIdentStatus;
  providerCandidateCount?: number;
  statusMessage?: string;
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
