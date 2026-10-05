import { act, cleanup, renderHook, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useGardenStore } from '../hooks/useGardenStore';
import {
  paintSurfaceAction,
  plantFlowerAction,
  saveObservationAction,
} from '../storage/gardenActions';
import { createEmptyState } from '../storage/persistence';
import type { GardenState, SaveResult } from '../types';

const persistenceMocks = vi.hoisted(() => ({
  load: vi.fn(),
  save: vi.fn(),
}));

vi.mock('../storage/persistence', async () => {
  const actual = await vi.importActual<typeof import('../storage/persistence')>(
    '../storage/persistence',
  );
  return {
    ...actual,
    loadState: (...args: [userId?: string | null]) => persistenceMocks.load(...args),
    saveState: (...args: [state: GardenState, userId?: string | null]) =>
      persistenceMocks.save(...args),
  };
});

describe('useGardenStore reliability boundaries', () => {
  beforeEach(() => {
    persistenceMocks.load.mockReset();
    persistenceMocks.save.mockReset();
    persistenceMocks.load.mockImplementation(async () => ({ state: createEmptyState() }));
    persistenceMocks.save.mockResolvedValue({ ok: true } satisfies SaveResult);
  });

  afterEach(() => {
    cleanup();
  });

  it('does not publish a pending guest edit or history after switching scope and reloading', async () => {
    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let releaseSave!: (result: SaveResult) => void;
    persistenceMocks.save.mockImplementationOnce(
      () =>
        new Promise<SaveResult>((resolve) => {
          releaseSave = resolve;
        }),
    );

    let pending!: Promise<SaveResult>;
    act(() => {
      pending = result.current.placeDecoration(
        result.current.state.soilTiles[0].id,
        'bench',
      );
    });
    await waitFor(() => expect(persistenceMocks.save).toHaveBeenCalledTimes(1));

    await act(async () => {
      result.current.setUserScope('other-account');
      await result.current.reload('other-account');
    });
    expect(result.current.state.decorations).toHaveLength(0);

    let pendingResult!: SaveResult;
    await act(async () => {
      releaseSave({ ok: true });
      pendingResult = await pending;
    });

    expect(persistenceMocks.save.mock.calls[0]?.[1]).toBeNull();
    expect(pendingResult).toMatchObject({ ok: false });
    expect(result.current.state.decorations).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);
  });

  it('preserves a later explicit photo link when undoing and redoing geometry', async () => {
    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let seeded = saveObservationAction(createEmptyState(), {
      plantType: 'tulip',
      commonNameJa: '記録',
      scientificName: 'Tulipa',
      familyName: 'ユリ科',
      color: 'red',
      imageDataUrl: '',
      isSample: false,
      identificationSource: 'manual',
    }).nextState;
    seeded = plantFlowerAction(seeded, seeded.soilTiles[0].id, 'tulip', 'red');
    await act(async () => {
      await result.current.replaceState(seeded);
    });

    const plantId = result.current.state.plants[0].id;
    const observationId = result.current.state.observations[0].id;
    await act(async () => {
      await result.current.placeDecoration(
        result.current.state.soilTiles[1].id,
        'bench',
      );
    });
    act(() => {
      result.current.linkPlantObservation(plantId, observationId);
    });
    await waitFor(() =>
      expect(result.current.state.plants[0].observationIds).toEqual([observationId]),
    );

    await act(async () => {
      await result.current.undoGarden();
    });
    expect(result.current.state.decorations).toHaveLength(0);
    expect(result.current.state.plants[0].observationIds).toEqual([observationId]);

    await act(async () => {
      await result.current.redoGarden();
    });
    expect(result.current.state.decorations).toHaveLength(1);
    expect(result.current.state.plants[0].observationIds).toEqual([observationId]);
  });

  it('settles a rejected save with a Japanese error and permits a successful retry', async () => {
    persistenceMocks.save.mockRejectedValueOnce(new Error('QuotaExceededError'));
    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let outcome: SaveResult | 'pending' = 'pending';
    await act(async () => {
      outcome = await result.current.placeDecoration(
        result.current.state.soilTiles[0].id,
        'lantern',
      );
    });

    expect(outcome).toMatchObject({ ok: false });
    expect(result.current.saveStatus).toBe('error');
    expect(result.current.saveError).toContain('保存に失敗しました');
    expect(result.current.state.decorations).toHaveLength(0);
    expect(result.current.canUndo).toBe(false);

    await act(async () => {
      outcome = await result.current.placeDecoration(
        result.current.state.soilTiles[0].id,
        'lantern',
      );
    });
    expect(outcome).toEqual({ ok: true });
    expect(result.current.saveStatus).toBe('saved');
    expect(result.current.saveError).toBeNull();
    expect(result.current.state.decorations).toHaveLength(1);
  });

  it('releases placement busy state after a thrown save and allows confirmation retry', async () => {
    persistenceMocks.save.mockRejectedValueOnce(new Error('image write failed'));
    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    act(() => {
      result.current.enterPlantingFlow();
      result.current.selectFlowerModel('cosmos');
    });
    act(() => {
      result.current.beginPendingPlacement(result.current.state.soilTiles[0].id);
    });

    await act(async () => {
      expect(await result.current.confirmPendingPlacement()).toBeNull();
    });
    expect(result.current.placementSaving).toBe(false);
    expect(result.current.placementSaveError).toContain('保存に失敗しました');
    expect(result.current.pendingPlacementTileId).not.toBeNull();

    let plantId: string | null = null;
    await act(async () => {
      plantId = await result.current.confirmPendingPlacement();
    });
    expect(plantId).not.toBeNull();
    expect(result.current.placementSaving).toBe(false);
    expect(result.current.state.plants).toHaveLength(1);
  });

  it('serializes fast edits from the committed latest state despite saving-status renders', async () => {
    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let first!: Promise<SaveResult>;
    let second!: Promise<SaveResult>;
    act(() => {
      first = result.current.placeDecoration(
        result.current.state.soilTiles[0].id,
        'bench',
      );
      second = result.current.placeDecoration(
        result.current.state.soilTiles[1].id,
        'lantern',
      );
    });
    await act(async () => {
      await Promise.all([first, second]);
    });

    expect(result.current.state.decorations.map((item) => item.type)).toEqual([
      'bench',
      'lantern',
    ]);
    expect(persistenceMocks.save).toHaveBeenCalledTimes(2);
    expect(persistenceMocks.save.mock.calls[1]?.[0].decorations).toHaveLength(2);
  });

  it('orders replacement after a pending edit and clears the superseded history', async () => {
    const { result } = renderHook(() => useGardenStore());
    await waitFor(() => expect(result.current.hydrated).toBe(true));

    let releaseSave!: (result: SaveResult) => void;
    persistenceMocks.save.mockImplementationOnce(
      () =>
        new Promise<SaveResult>((resolve) => {
          releaseSave = resolve;
        }),
    );

    const pendingEdit = result.current.placeDecoration(
      result.current.state.soilTiles[0].id,
      'bench',
    );
    await waitFor(() => expect(persistenceMocks.save).toHaveBeenCalledTimes(1));

    const replacementBase = createEmptyState();
    const replacement = paintSurfaceAction(
      replacementBase,
      replacementBase.soilTiles[0].id,
      'stone',
    );
    const pendingReplacement = result.current.replaceState(replacement);
    expect(persistenceMocks.save).toHaveBeenCalledTimes(1);

    await act(async () => {
      releaseSave({ ok: true });
      await Promise.all([pendingEdit, pendingReplacement]);
    });

    expect(persistenceMocks.save).toHaveBeenCalledTimes(2);
    expect(persistenceMocks.save.mock.calls[1]?.[0]).toEqual(replacement);
    expect(result.current.state).toEqual(replacement);
    expect(result.current.canUndo).toBe(false);
    expect(result.current.canRedo).toBe(false);
  });
});
