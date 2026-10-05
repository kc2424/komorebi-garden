import type {
  GardenModelType,
  GardenDecoration,
  GardenDecorationType,
  GardenState,
  GardenPlant,
  PlantObservation,
  RegistrationResult,
  SaveResult,
  SoilTile,
  TulipColor,
  TileSurface,
} from '../types';
import { defaultTulipColor } from '../data/tulip';
import { isTulipModelPlant } from '../utils/plantModel';
import { getPlantOnTile, bumpRevision } from './persistence';
import { imageRefForObservation } from './imageStore';
import { canChangeTileHeight, normalizeTerrainHeight } from '../utils/terrain';
import {
  canAddGardenTile,
  canPlaceGardenItem,
  GARDEN_LIMITS,
  isLegalSoilCoordinate,
} from '../utils/gardenLimits';

function newId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function isLinkableTulipObservation(state: GardenState, observationId: string): boolean {
  const observation = state.observations.find((o) => o.id === observationId);
  return observation !== undefined && observation.plantType === 'tulip';
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
  trait?: string;
  memo?: string;
}

export function saveObservationAction(
  state: GardenState,
  input: SaveObservationInput,
): { nextState: GardenState; result: Omit<RegistrationResult, 'saved'> } {
  const now = new Date().toISOString();
  const priorTulipObs = state.observations.some((o) => o.plantType === 'tulip');
  const obsId = newId('obs');
  const observation: PlantObservation = {
    id: obsId,
    plantType: input.plantType,
    commonNameJa: input.commonNameJa,
    scientificName: input.scientificName,
    familyName: input.familyName,
    trait: input.trait ?? '',
    color: input.plantType === 'tulip' ? (input.color ?? defaultTulipColor()) : null,
    imageRef: imageRefForObservation(obsId),
    imageDataUrl: input.imageDataUrl,
    takenAt: now,
    memo: input.memo ?? '',
    isSample: input.isSample,
    identificationSource: input.identificationSource,
    createdAt: now,
    syncState: 'local',
  };

  const tulipUnlocked = state.tulipUnlocked || input.plantType === 'tulip';
  const isRediscovery =
    input.plantType === 'tulip'
      ? priorTulipObs
      : state.observations.some(
          (o) => o.plantType === 'other' && o.commonNameJa === input.commonNameJa,
        );

  const nextState = bumpRevision({
    ...state,
    observations: [...state.observations, observation],
    tulipUnlocked,
  });

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
  if (!canAddGardenTile(state, x, z)) return state;
  const tile: SoilTile = { id: newId('soil'), x, z, surface: 'grass', height: 0 };
  return bumpRevision({ ...state, soilTiles: [...state.soilTiles, tile] });
}

export function removeSoilTileAction(state: GardenState, tileId: string): GardenState {
  const tile = state.soilTiles.find((t) => t.id === tileId);
  if (!tile) return state;

  // Older/imported gardens may already contain overlapping items. Removing their
  // tile must retain every saved item and its explicit observation links.
  const plantsOnTile = state.plants.filter((p) => p.tileId === tileId);
  const decorationsOnTile = state.decorations.filter((d) => d.tileId === tileId);
  const remainingTiles = state.soilTiles.filter((t) => t.id !== tileId);
  const remainingPlants = state.plants.filter((p) => p.tileId !== tileId);
  const stashedPlants = plantsOnTile.length > 0
    ? [...state.stashedPlants, ...plantsOnTile]
    : state.stashedPlants;
  const remainingDecorations = state.decorations.filter((d) => d.tileId !== tileId);
  const stashedDecorations = decorationsOnTile.length > 0
    ? [...state.stashedDecorations, ...decorationsOnTile]
    : state.stashedDecorations;

  return bumpRevision({
    ...state,
    soilTiles: remainingTiles,
    plants: remainingPlants,
    stashedPlants,
    decorations: remainingDecorations,
    stashedDecorations,
  });
}

export function plantFlowerAction(
  state: GardenState,
  tileId: string,
  modelType: GardenModelType,
  color: TulipColor,
  observationId?: string | null,
  rotation?: number,
): GardenState {
  if (getPlantOnTile(state, tileId) || state.decorations.some((d) => d.tileId === tileId)) return state;
  if (!state.soilTiles.some((t) => t.id === tileId)) return state;
  if (!canPlaceGardenItem(state)) return state;

  const linkedObservationId =
    modelType === 'tulip' &&
    observationId &&
    isLinkableTulipObservation(state, observationId)
      ? observationId
      : undefined;

  const plant: GardenPlant = {
    id: newId('plant'),
    color: modelType === 'tulip' ? color : 'pink',
    tileId,
    rotation: rotation ?? Math.random() * Math.PI * 2,
    modelType,
    ...(linkedObservationId ? { observationIds: [linkedObservationId] } : {}),
  };

  return bumpRevision({ ...state, plants: [...state.plants, plant] });
}

export function plantTulipAction(
  state: GardenState,
  tileId: string,
  color: TulipColor,
  observationId?: string | null,
): GardenState {
  return plantFlowerAction(state, tileId, 'tulip', color, observationId);
}

export function plantFromStashAction(
  state: GardenState,
  plantId: string,
  tileId: string,
  rotation?: number,
): GardenState {
  const stashPlant = state.stashedPlants.find((p) => p.id === plantId);
  if (!stashPlant || getPlantOnTile(state, tileId) || state.decorations.some((d) => d.tileId === tileId)) return state;
  if (!state.soilTiles.some((t) => t.id === tileId)) return state;
  if (!canPlaceGardenItem(state)) return state;

  const plant: GardenPlant = {
    ...stashPlant,
    tileId,
    ...(rotation !== undefined ? { rotation } : {}),
  };
  return bumpRevision({
    ...state,
    plants: [...state.plants, plant],
    stashedPlants: state.stashedPlants.filter((p) => p.id !== plantId),
  });
}

export function movePlantAction(state: GardenState, plantId: string, tileId: string): GardenState {
  if (getPlantOnTile(state, tileId) || state.decorations.some((d) => d.tileId === tileId)) return state;
  if (!state.soilTiles.some((t) => t.id === tileId)) return state;

  return bumpRevision({
    ...state,
    plants: state.plants.map((p) => (p.id === plantId ? { ...p, tileId } : p)),
  });
}

export function stashPlantAction(state: GardenState, plantId: string): GardenState {
  const plant = state.plants.find((p) => p.id === plantId);
  if (!plant) return state;

  return bumpRevision({
    ...state,
    plants: state.plants.filter((p) => p.id !== plantId),
    stashedPlants: [...state.stashedPlants, plant],
  });
}

export function paintSurfaceAction(
  state: GardenState,
  tileId: string,
  surface: TileSurface,
): GardenState {
  const tile = state.soilTiles.find((item) => item.id === tileId);
  if (!tile || (tile.surface ?? 'grass') === surface) return state;
  return bumpRevision({
    ...state,
    soilTiles: state.soilTiles.map((item) =>
      item.id === tileId ? { ...item, surface } : item,
    ),
  });
}

export function changeTileHeightAction(
  state: GardenState,
  tileId: string,
  delta: number,
): GardenState {
  const tile = state.soilTiles.find((item) => item.id === tileId);
  if (!tile || !canChangeTileHeight(tile, delta)) return state;
  const height = normalizeTerrainHeight(normalizeTerrainHeight(tile.height) + Math.trunc(delta));
  return bumpRevision({
    ...state,
    soilTiles: state.soilTiles.map((item) => item.id === tileId ? { ...item, height } : item),
  });
}

export function placeDecorationAction(
  state: GardenState,
  tileId: string,
  type: GardenDecorationType,
  rotation = 0,
): GardenState {
  if (!state.soilTiles.some((tile) => tile.id === tileId)) return state;
  if (getPlantOnTile(state, tileId) || state.decorations.some((d) => d.tileId === tileId)) return state;
  if (!canPlaceGardenItem(state)) return state;
  const decoration: GardenDecoration = {
    id: newId('decor'),
    type,
    tileId,
    rotation,
  };
  return bumpRevision({ ...state, decorations: [...state.decorations, decoration] });
}

export function moveDecorationAction(
  state: GardenState,
  decorationId: string,
  tileId: string,
): GardenState {
  if (!state.soilTiles.some((tile) => tile.id === tileId)) return state;
  if (getPlantOnTile(state, tileId) || state.decorations.some((d) => d.tileId === tileId)) return state;
  if (!state.decorations.some((d) => d.id === decorationId)) return state;
  return bumpRevision({
    ...state,
    decorations: state.decorations.map((d) => d.id === decorationId ? { ...d, tileId } : d),
  });
}

export function rotateGardenItemAction(
  state: GardenState,
  itemId: string,
  amount = Math.PI / 4,
): GardenState {
  if (state.plants.some((plant) => plant.id === itemId)) {
    return bumpRevision({
      ...state,
      plants: state.plants.map((plant) =>
        plant.id === itemId ? { ...plant, rotation: plant.rotation + amount } : plant,
      ),
    });
  }
  if (state.decorations.some((decoration) => decoration.id === itemId)) {
    return bumpRevision({
      ...state,
      decorations: state.decorations.map((decoration) =>
        decoration.id === itemId
          ? { ...decoration, rotation: decoration.rotation + amount }
          : decoration,
      ),
    });
  }
  return state;
}

export function stashDecorationAction(state: GardenState, decorationId: string): GardenState {
  const decoration = state.decorations.find((item) => item.id === decorationId);
  if (!decoration) return state;
  return bumpRevision({
    ...state,
    decorations: state.decorations.filter((item) => item.id !== decorationId),
    stashedDecorations: [...state.stashedDecorations, decoration],
  });
}

export function decorationFromStashAction(
  state: GardenState,
  decorationId: string,
  tileId: string,
  rotation?: number,
): GardenState {
  const decoration = state.stashedDecorations.find((item) => item.id === decorationId);
  if (!decoration || !state.soilTiles.some((tile) => tile.id === tileId)) return state;
  if (getPlantOnTile(state, tileId) || state.decorations.some((d) => d.tileId === tileId)) return state;
  if (!canPlaceGardenItem(state)) return state;
  return bumpRevision({
    ...state,
    decorations: [
      ...state.decorations,
      { ...decoration, tileId, rotation: rotation ?? decoration.rotation },
    ],
    stashedDecorations: state.stashedDecorations.filter((item) => item.id !== decorationId),
  });
}

export function deleteObservationAction(state: GardenState, observationId: string): GardenState {
  const obs = state.observations.find((o) => o.id === observationId);
  if (!obs) return state;
  return bumpRevision({
    ...state,
    observations: state.observations.filter((o) => o.id !== observationId),
  });
}

export function updateObservationMemoAction(
  state: GardenState,
  observationId: string,
  memo: string,
): GardenState {
  return bumpRevision({
    ...state,
    observations: state.observations.map((o) =>
      o.id === observationId ? { ...o, memo } : o,
    ),
  });
}

export interface UpdateObservationInput {
  commonNameJa?: string;
  takenAt?: string;
  color?: TulipColor | null;
  memo?: string;
}

export function updateObservationAction(
  state: GardenState,
  observationId: string,
  input: UpdateObservationInput,
): GardenState {
  return bumpRevision({
    ...state,
    observations: state.observations.map((o) => {
      if (o.id !== observationId) return o;
      return {
        ...o,
        commonNameJa: input.commonNameJa ?? o.commonNameJa,
        takenAt: input.takenAt ?? o.takenAt,
        color: input.color !== undefined ? input.color : o.color,
        memo: input.memo ?? o.memo,
      };
    }),
  });
}

export function linkPlantObservationAction(
  state: GardenState,
  plantId: string,
  observationId: string,
): GardenState {
  const plant = [...state.plants, ...state.stashedPlants].find((p) => p.id === plantId);
  if (!plant) return state;
  if (!isTulipModelPlant(plant)) return state;
  if (!isLinkableTulipObservation(state, observationId)) return state;

  const existing = plant.observationIds ?? [];
  if (existing.includes(observationId)) return state;

  const updatePlant = (p: GardenPlant): GardenPlant =>
    p.id === plantId ? { ...p, observationIds: [...existing, observationId] } : p;

  return bumpRevision({
    ...state,
    plants: state.plants.map(updatePlant),
    stashedPlants: state.stashedPlants.map(updatePlant),
  });
}

export function unlinkPlantObservationAction(
  state: GardenState,
  plantId: string,
  observationId: string,
): GardenState {
  const updatePlant = (p: GardenPlant): GardenPlant => {
    if (p.id !== plantId || !p.observationIds) return p;
    const nextIds = p.observationIds.filter((id) => id !== observationId);
    return {
      ...p,
      observationIds: nextIds.length > 0 ? nextIds : undefined,
    };
  };

  return bumpRevision({
    ...state,
    plants: state.plants.map(updatePlant),
    stashedPlants: state.stashedPlants.map(updatePlant),
  });
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
  if (state.soilTiles.length >= GARDEN_LIMITS.maxTiles) return [];
  if (state.soilTiles.length === 0) return [{ x: 0, z: 0 }];

  const existing = new Set(state.soilTiles.map((t) => `${t.x},${t.z}`));
  const candidates = new Set<string>();

  for (const tile of state.soilTiles) {
    for (const adj of getAdjacentCoords(tile.x, tile.z)) {
      if (!isLegalSoilCoordinate(adj.x, adj.z)) continue;
      const key = `${adj.x},${adj.z}`;
      if (!existing.has(key)) candidates.add(key);
    }
  }

  return Array.from(candidates).map((key) => {
    const [x, z] = key.split(',').map(Number);
    return { x, z };
  });
}
