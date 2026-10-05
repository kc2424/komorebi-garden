import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompleteScreen } from '../components/discover/CompleteScreen';
import { useGardenStore } from '../hooks/useGardenStore';
import { renderHook, act } from '@testing-library/react';
import { saveObservationAction } from '../storage/gardenActions';
import { createEmptyState } from '../storage/persistence';
import type { PlantObservation, RegistrationResult } from '../types';
import {
  canPlantObservationInGarden,
  getPlantableTulipObservations,
} from '../utils/plantObservationLink';

const observation: PlantObservation = {
  id: 'obs-plant-1',
  plantType: 'tulip',
  commonNameJa: '赤いチューリップ',
  scientificName: 'Tulipa gesneriana',
  familyName: 'ユリ科',
  trait: '',
  color: 'red',
  imageRef: 'img-obs-plant-1',
  imageDataUrl: 'data:image/jpeg;base64,plant-photo',
  takenAt: '2026-09-01T03:00:00.000Z',
  memo: '',
  isSample: false,
  identificationSource: 'manual',
  createdAt: '2026-09-01T03:00:00.000Z',
};

const result: RegistrationResult = {
  type: 'new',
  observationId: 'obs-plant-1',
  plantType: 'tulip',
  commonNameJa: '赤いチューリップ',
  tulipUnlocked: true,
  saved: true,
};

describe('direct planting from observation (G2)', () => {
  it('shows primary plant CTA for tulip', () => {
    const onPlant = vi.fn();
    render(
      <CompleteScreen
        result={result}
        observation={observation}
        canPlantInGarden
        onPlantInGarden={onPlant}
        onGoGarden={vi.fn()}
        onViewRecord={vi.fn()}
      />,
    );
    fireEvent.click(screen.getByRole('button', { name: 'この花を庭に植える' }));
    expect(onPlant).toHaveBeenCalledTimes(1);
  });

  it('hides plant CTA and makes view-record primary for non-tulip observations', () => {
    const onViewRecord = vi.fn();
    const onGoGarden = vi.fn();
    render(
      <CompleteScreen
        result={{ ...result, plantType: 'other', observationId: 'obs-other' }}
        observation={{ ...observation, id: 'obs-other', plantType: 'other' }}
        canPlantInGarden={false}
        onGoGarden={onGoGarden}
        onViewRecord={onViewRecord}
      />,
    );
    expect(screen.queryByRole('button', { name: 'この花を庭に植える' })).not.toBeInTheDocument();

    const buttons = screen.getAllByRole('button');
    expect(buttons[0]).toHaveTextContent('記録を見る');
    fireEvent.click(screen.getByRole('button', { name: '記録を見る' }));
    expect(onViewRecord).toHaveBeenCalledTimes(1);
    expect(onGoGarden).not.toHaveBeenCalled();
  });

  it('prefills tulip model, color, and explicit observationId', async () => {
    const base = createEmptyState();
    const { nextState } = saveObservationAction(base, {
      plantType: 'tulip',
      commonNameJa: '赤いチューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      trait: '',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,x',
      isSample: false,
      identificationSource: 'manual',
    });
    const obsId = nextState.observations[0].id;

    const { result: store } = renderHook(() => useGardenStore());
    await act(async () => {
      await store.current.replaceState(nextState);
    });

    act(() => {
      const started = store.current.enterPlantingFlowForObservation(obsId);
      expect(started).toBe(true);
    });

    expect(store.current.selectedModelType).toBe('tulip');
    expect(store.current.plantColor).toBe('red');
    expect(store.current.plantObservationId).toBe(obsId);
    expect(store.current.catalogExpanded).toBe(false);
  });

  it('links planted flower with exact observationId and cancels without adding plant', async () => {
    const base = createEmptyState();
    const { nextState } = saveObservationAction(base, {
      plantType: 'tulip',
      commonNameJa: '赤いチューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      trait: '',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,x',
      isSample: false,
      identificationSource: 'manual',
    });
    const obsId = nextState.observations[0].id;

    const { result: store } = renderHook(() => useGardenStore());
    await act(async () => {
      await store.current.replaceState(nextState);
    });

    act(() => {
      store.current.enterPlantingFlowForObservation(obsId);
    });
    const tileId = store.current.state.soilTiles[0].id;
    act(() => {
      store.current.beginPendingPlacement(tileId);
    });
    act(() => {
      store.current.cancelPendingPlacement();
    });
    expect(store.current.state.plants).toHaveLength(0);

    act(() => {
      store.current.beginPendingPlacement(tileId);
    });
    await act(async () => {
      await store.current.confirmPendingPlacement();
    });
    expect(store.current.state.plants).toHaveLength(1);
    expect(store.current.state.plants[0].observationIds).toEqual([obsId]);
    expect(store.current.state.plants[0].color).toBe('red');
  });

  it('rejects invalid or already-linked observations', () => {
    const base = createEmptyState();
    const { nextState } = saveObservationAction(base, {
      plantType: 'tulip',
      commonNameJa: '赤いチューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      trait: '',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,x',
      isSample: false,
      identificationSource: 'manual',
    });
    const obsId = nextState.observations[0].id;
    const tileId = nextState.soilTiles[0].id;
    const planted = saveObservationAction(nextState, {
      plantType: 'tulip',
      commonNameJa: '二つ目',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      trait: '',
      color: 'yellow',
      imageDataUrl: 'data:image/jpeg;base64,y',
      isSample: false,
      identificationSource: 'manual',
    }).nextState;
    const linked = {
      ...planted,
      plants: [
        {
          id: 'plant-linked',
          color: 'red' as const,
          tileId,
          rotation: 0,
          modelType: 'tulip' as const,
          observationIds: [obsId],
        },
      ],
    };

    expect(canPlantObservationInGarden(obsId, linked.observations, linked.plants, linked.stashedPlants, true)).toBe(false);
    expect(canPlantObservationInGarden('missing', linked.observations, linked.plants, linked.stashedPlants, true)).toBe(false);
    expect(getPlantableTulipObservations(linked.observations, linked.plants, linked.stashedPlants)).toHaveLength(1);
  });
});
