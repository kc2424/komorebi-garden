import type { GardenPlant, PlantObservation } from '../types';

export type ObservationPlantLinkStatus = 'linked' | 'stashed' | 'unlinked';

export function getNavigableObservations(observations: PlantObservation[]): PlantObservation[] {
  return [...observations].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
  );
}

function collectLinkedObservationIds(
  plants: GardenPlant[],
  stashedPlants: GardenPlant[],
): Set<string> {
  const linked = new Set<string>();
  for (const plant of [...plants, ...stashedPlants]) {
    for (const id of plant.observationIds ?? []) {
      linked.add(id);
    }
  }
  return linked;
}

/** Tulip observations not yet linked to any garden or stashed plant */
export function getPlantableTulipObservations(
  observations: PlantObservation[],
  plants: GardenPlant[],
  stashedPlants: GardenPlant[],
): PlantObservation[] {
  const linked = collectLinkedObservationIds(plants, stashedPlants);
  return getNavigableObservations(observations).filter(
    (o) => o.plantType === 'tulip' && !linked.has(o.id),
  );
}

export function canPlantObservationInGarden(
  observationId: string,
  observations: PlantObservation[],
  plants: GardenPlant[],
  stashedPlants: GardenPlant[],
  tulipUnlocked: boolean,
): boolean {
  if (!tulipUnlocked) return false;
  const observation = observations.find((o) => o.id === observationId);
  if (!observation || observation.plantType !== 'tulip') return false;
  return getPlantableTulipObservations(observations, plants, stashedPlants).some(
    (o) => o.id === observationId,
  );
}

export function getLinkedObservations(
  plant: GardenPlant,
  observations: PlantObservation[],
): PlantObservation[] {
  if (!plant.observationIds?.length) return [];
  const byId = new Map(observations.map((o) => [o.id, o]));
  return plant.observationIds
    .map((id) => byId.get(id))
    .filter((o): o is PlantObservation => o !== undefined);
}

export function resolvePlantForObservation(
  observationId: string,
  plants: GardenPlant[],
  preferredPlantId?: string | null,
  stashedPlants: GardenPlant[] = [],
): GardenPlant | undefined {
  const inGarden = plants.filter((p) => p.observationIds?.includes(observationId));
  if (inGarden.length > 0) {
    if (preferredPlantId) {
      const preferred = inGarden.find((p) => p.id === preferredPlantId);
      if (preferred) return preferred;
    }
    return [...inGarden].sort((a, b) => a.id.localeCompare(b.id))[0];
  }

  const stashed = stashedPlants.filter((p) => p.observationIds?.includes(observationId));
  if (stashed.length === 0) return undefined;
  if (preferredPlantId) {
    const preferred = stashed.find((p) => p.id === preferredPlantId);
    if (preferred) return preferred;
  }
  return [...stashed].sort((a, b) => a.id.localeCompare(b.id))[0];
}

export function getObservationPlantLinkStatus(
  observationId: string,
  plants: GardenPlant[],
  stashedPlants: GardenPlant[],
): ObservationPlantLinkStatus {
  if (plants.some((p) => p.observationIds?.includes(observationId))) return 'linked';
  if (stashedPlants.some((p) => p.observationIds?.includes(observationId))) return 'stashed';
  return 'unlinked';
}

export function resolveMemoryNavigationTarget(
  observation: PlantObservation,
  plants: GardenPlant[],
  stashedPlants: GardenPlant[],
  preferredPlantId?: string | null,
): { plantId: string | null; linkStatus: ObservationPlantLinkStatus } {
  const linkStatus = getObservationPlantLinkStatus(observation.id, plants, stashedPlants);
  if (linkStatus === 'unlinked') {
    return { plantId: null, linkStatus };
  }
  const plant = resolvePlantForObservation(
    observation.id,
    plants,
    preferredPlantId,
    stashedPlants,
  );
  return {
    plantId: linkStatus === 'linked' ? plant?.id ?? null : null,
    linkStatus,
  };
}

export function isPlantInGarden(plantId: string, plants: GardenPlant[]): boolean {
  return plants.some((p) => p.id === plantId);
}

export function isPlantStashed(
  plantId: string,
  stashedPlants: GardenPlant[],
): boolean {
  return stashedPlants.some((p) => p.id === plantId);
}
