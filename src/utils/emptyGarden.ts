import type { GardenState } from '../types';
import { getPlantableTulipObservations } from './plantObservationLink';

export type EmptyGardenScenario =
  | 'no_observations'
  | 'plantable_available'
  | 'non_tulip_only'
  | 'stashed_only'
  | 'default';

export interface EmptyGardenContext {
  scenario: EmptyGardenScenario;
  message: string;
  plantObservationId?: string;
  plantObservationName?: string;
}

export function getEmptyGardenContext(state: GardenState): EmptyGardenContext {
  if (state.plants.length > 0 || state.decorations.length > 0) {
    return { scenario: 'default', message: '' };
  }
  if (
    state.soilTiles.length !== 25 ||
    state.soilTiles.some((tile) => (tile.surface ?? 'grass') !== 'grass')
  ) {
    return { scenario: 'default', message: '庭づくりから花や飾りを加えられます' };
  }

  const plantable = getPlantableTulipObservations(
    state.observations,
    state.plants,
    state.stashedPlants,
  );

  if (plantable.length > 0) {
    const latest = plantable[0];
    return {
      scenario: 'plantable_available',
      message: `「${latest.commonNameJa}」を庭に植えられます`,
      plantObservationId: latest.id,
      plantObservationName: latest.commonNameJa,
    };
  }

  if (state.stashedPlants.length > 0 || state.stashedDecorations.length > 0) {
    return {
      scenario: 'stashed_only',
      message: '収納した花や飾りがあります。庭づくりから戻せます',
    };
  }

  if (state.observations.length > 0) {
    return {
      scenario: 'non_tulip_only',
      message: '記録はありますが、庭に植えられるチューリップの観察はまだありません',
    };
  }

  return {
    scenario: 'no_observations',
    message: '庭づくりから、好きな花や飾りを置いてみましょう',
  };
}
