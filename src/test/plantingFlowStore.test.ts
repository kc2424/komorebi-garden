import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useGardenStore } from '../hooks/useGardenStore';
import { createEmptyState } from '../storage/persistence';
import type { GardenState, SaveResult } from '../types';

const saveStateMock = vi.fn((_state: GardenState): SaveResult => ({ ok: true }));

vi.mock('../storage/persistence', async () => {
  const actual = await vi.importActual<typeof import('../storage/persistence')>(
    '../storage/persistence',
  );
  return {
    ...actual,
    loadState: () => ({ state: createEmptyState() }),
    saveState: (state: GardenState) => saveStateMock(state),
  };
});

describe('useGardenStore planting flow', () => {
  beforeEach(() => {
    saveStateMock.mockReset();
    saveStateMock.mockReturnValue({ ok: true });
  });

  it('cancel pending placement does not save a plant', () => {
    const { result } = renderHook(() => useGardenStore());
    const tileId = result.current.state.soilTiles[0].id;

    act(() => {
      result.current.enterPlantingFlow();
      result.current.selectFlowerModel('cosmos');
    });

    act(() => {
      result.current.beginPendingPlacement(tileId);
    });

    expect(result.current.pendingPlacementTileId).toBe(tileId);

    act(() => {
      result.current.cancelPendingPlacement();
    });

    expect(result.current.state.plants).toHaveLength(0);
    expect(result.current.pendingPlacementTileId).toBeNull();
    expect(saveStateMock).not.toHaveBeenCalled();
  });

  it('confirm pending placement saves with the preview rotation', () => {
    const { result } = renderHook(() => useGardenStore());

    act(() => {
      result.current.enterPlantingFlow();
      result.current.selectFlowerModel('pansy');
    });

    const previewRotation = result.current.pendingRotation;
    const tileId = result.current.state.soilTiles[0].id;

    act(() => {
      result.current.beginPendingPlacement(tileId);
    });

    act(() => {
      result.current.confirmPendingPlacement();
    });

    expect(result.current.state.plants).toHaveLength(1);
    expect(result.current.state.plants[0].modelType).toBe('pansy');
    expect(result.current.state.plants[0].rotation).toBe(previewRotation);
    expect(result.current.pendingPlacementTileId).toBeNull();
    expect(saveStateMock).toHaveBeenCalled();
  });

  it('stash restore: select, place, cancel, retry, confirm keeps id type rotation', () => {
    const { result } = renderHook(() => useGardenStore());

    act(() => {
      result.current.enterBuildingPhase();
      result.current.enterPlantingFlow();
      result.current.selectFlowerModel('cosmos');
    });

    const plantTileId = result.current.state.soilTiles[0].id;
    act(() => {
      result.current.beginPendingPlacement(plantTileId);
    });
    act(() => {
      result.current.confirmPendingPlacement();
    });
    expect(result.current.state.plants).toHaveLength(1);

    const plantId = result.current.state.plants[0].id;
    const originalRotation = result.current.state.plants[0].rotation;
    const observationCount = result.current.state.observations.length;

    act(() => {
      result.current.stashPlant(plantId);
    });

    act(() => {
      result.current.enterPlantingFlow();
      result.current.selectStashForPlanting(plantId);
    });

    expect(result.current.pendingFromStashPlantId).toBe(plantId);

    const firstTile = result.current.state.soilTiles[0].id;
    act(() => {
      result.current.beginPendingPlacement(firstTile);
    });
    expect(result.current.pendingPlacementTileId).toBe(firstTile);

    act(() => {
      result.current.cancelPendingPlacement();
    });
    expect(result.current.pendingFromStashPlantId).toBe(plantId);
    expect(result.current.pendingPlacementTileId).toBeNull();
    expect(result.current.pendingRotation).toBe(originalRotation);

    act(() => {
      result.current.beginPendingPlacement(firstTile);
    });
    act(() => {
      result.current.confirmPendingPlacement();
    });

    expect(result.current.state.plants).toHaveLength(1);
    expect(result.current.state.plants[0].id).toBe(plantId);
    expect(result.current.state.plants[0].modelType).toBe('cosmos');
    expect(result.current.state.plants[0].rotation).toBe(originalRotation);
    expect(result.current.state.stashedPlants).toHaveLength(0);
    expect(result.current.state.observations).toHaveLength(observationCount);
    expect(result.current.pendingFromStashPlantId).toBeNull();
    expect(result.current.catalogExpanded).toBe(true);
    expect(result.current.selectedModelType).toBeNull();
  });

  it('does not begin placement while the flower catalog is expanded', () => {
    const { result } = renderHook(() => useGardenStore());

    act(() => {
      result.current.enterBuildingPhase();
      result.current.enterPlantingFlow();
      result.current.selectFlowerModel('pansy');
      result.current.reopenFlowerCatalog();
    });

    const tileId = result.current.state.soilTiles[0].id;
    act(() => {
      result.current.beginPendingPlacement(tileId);
    });

    expect(result.current.pendingPlacementTileId).toBeNull();
  });

  it('keeps pending placement when save fails', () => {
    saveStateMock.mockReturnValue({ ok: false, error: 'disk full' });
    const { result } = renderHook(() => useGardenStore());

    act(() => {
      result.current.enterPlantingFlow();
      result.current.selectFlowerModel('cosmos');
    });

    const tileId = result.current.state.soilTiles[0].id;

    act(() => {
      result.current.beginPendingPlacement(tileId);
    });

    act(() => {
      result.current.confirmPendingPlacement();
    });

    expect(result.current.state.plants).toHaveLength(0);
    expect(result.current.pendingPlacementTileId).toBe(tileId);
    expect(result.current.placementSaveError).toBe('disk full');
  });
});
