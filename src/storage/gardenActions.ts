import type {
  GardenState,
  GardenPlant,
  PlantObservation,
  RegistrationResult,
  SaveResult,
  SoilTile,
  TulipColor,
} from '../types';
import { defaultTulipColor } from '../data/tulip';
import { getPlantOnTile, getTileAt } from './persistence';

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function attachSaveResult(
  result: Omit<RegistrationResult, 'saved'>,
  save: SaveResult,
): RegistrationResult {
  return { ...result, saved: save.ok };
}

export interface SaveObservationInput {
  plantType: 'tulip' | 'other';
  commonNameJa: string;
  scientificName: string;
  familyName: string;
  color: TulipColor | null;
  imageDataUrl: string;
  isSample: boolean;
  identificationSource: PlantObservation['identificationSource'];
  memo?: string;
}

export function saveObservationAction(
  state: GardenState,
  input: SaveObservationInput,
): { nextState: GardenState; result: Omit<RegistrationResult, 'saved'> } {
  const now = new Date().toISOString();
  const priorTulipObs = state.observations.some((o) => o.plantType === 'tulip');
  const observation: PlantObservation = {
    id: newId('obs'),
    plantType: input.plantType,
    commonNameJa: input.commonNameJa,
    scientificName: input.scientificName,
    familyName: input.familyName,
    color: input.plantType === 'tulip' ? (input.color ?? defaultTulipColor()) : null,
    imageDataUrl: input.imageDataUrl,
    takenAt: now,
    memo: input.memo ?? '',
    isSample: input.isSample,
    identificationSource: input.identificationSource,
    createdAt: now,
  };

  const tulipUnlocked = state.tulipUnlocked || input.plantType === 'tulip';
  const isRediscovery =
    input.plantType === 'tulip'
      ? priorTulipObs
      : state.observations.some(
          (o) => o.plantType === 'other' && o.commonNameJa === input.commonNameJa,
        );

  const nextState: GardenState = {
    ...state,
    observations: [...state.observations, observation],
    tulipUnlocked,
  };

  return {
    nextState,
    result: {
      type: isRediscovery ? 'rediscovery' : 'new',
      observationId: observation.id,
      plantType: input.plantType,
      commonNameJa: input.commonNameJa,
      tulipUnlocked,
    },
  };
}

export function addSoilTileAction(state: GardenState, x: number, z: number): GardenState {
  if (getTileAt(state, x, z)) return state;
  const tile: SoilTile = { id: newId('soil'), x, z };
  return { ...state, soilTiles: [...state.soilTiles, tile] };
}

export function removeSoilTileAction(state: GardenState, tileId: string): GardenState {
  const tile = state.soilTiles.find((t) => t.id === tileId);
  if (!tile) return state;

  const plantOnTile = getPlantOnTile(state, tileId);
  const remainingTiles = state.soilTiles.filter((t) => t.id !== tileId);
  const remainingPlants = state.plants.filter((p) => p.tileId !== tileId);
  const stashedPlants = plantOnTile
    ? [...state.stashedPlants, plantOnTile]
    : state.stashedPlants;

  return {
    ...state,
    soilTiles: remainingTiles,
    plants: remainingPlants,
    stashedPlants,
  };
}

export function plantTulipAction(
  state: GardenState,
  tileId: string,
  color: TulipColor,
): GardenState {
  if (!state.tulipUnlocked) return state;
  if (getPlantOnTile(state, tileId)) return state;
  if (!state.soilTiles.some((t) => t.id === tileId)) return state;

  const plant: GardenPlant = {
    id: newId('plant'),
    color,
    tileId,
    rotation: Math.random() * Math.PI * 2,
  };

  return { ...state, plants: [...state.plants, plant] };
}

export function plantFromStashAction(state: GardenState, plantId: string, tileId: string): GardenState {
  const stashPlant = state.stashedPlants.find((p) => p.id === plantId);
  if (!stashPlant || getPlantOnTile(state, tileId)) return state;
  if (!state.soilTiles.some((t) => t.id === tileId)) return state;

  const plant: GardenPlant = { ...stashPlant, tileId };
  return {
    ...state,
    plants: [...state.plants, plant],
    stashedPlants: state.stashedPlants.filter((p) => p.id !== plantId),
  };
}

export function movePlantAction(state: GardenState, plantId: string, tileId: string): GardenState {
  if (getPlantOnTile(state, tileId)) return state;
  if (!state.soilTiles.some((t) => t.id === tileId)) return state;

  return {
    ...state,
    plants: state.plants.map((p) => (p.id === plantId ? { ...p, tileId } : p)),
  };
}

export function stashPlantAction(state: GardenState, plantId: string): GardenState {
  const plant = state.plants.find((p) => p.id === plantId);
  if (!plant) return state;

  return {
    ...state,
    plants: state.plants.filter((p) => p.id !== plantId),
    stashedPlants: [...state.stashedPlants, plant],
  };
}

export function updateObservationMemoAction(
  state: GardenState,
  observationId: string,
  memo: string,
): GardenState {
  return {
    ...state,
    observations: state.observations.map((o) =>
      o.id === observationId ? { ...o, memo } : o,
    ),
  };
}

export function getAdjacentCoords(x: number, z: number): { x: number; z: number }[] {
  return [
    { x: x + 1, z },
    { x: x - 1, z },
    { x, z: z + 1 },
    { x, z: z - 1 },
  ];
}

export function getAddableSoilPositions(state: GardenState): { x: number; z: number }[] {
  if (state.soilTiles.length === 0) return [{ x: 0, z: 0 }];

  const existing = new Set(state.soilTiles.map((t) => `${t.x},${t.z}`));
  const candidates = new Set<string>();

  for (const tile of state.soilTiles) {
    for (const adj of getAdjacentCoords(tile.x, tile.z)) {
      const key = `${adj.x},${adj.z}`;
      if (!existing.has(key)) candidates.add(key);
    }
  }

  return Array.from(candidates).map((key) => {
    const [x, z] = key.split(',').map(Number);
    return { x, z };
  });
}
