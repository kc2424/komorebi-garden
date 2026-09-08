import { useCallback, useEffect, useMemo, useState } from 'react';
import type { GardenState, GardenEditMode, RegistrationResult, SaveResult, TulipColor } from '../types';
import {
  attachSaveResult,
  addSoilTileAction,
  getAddableSoilPositions,
  movePlantAction,
  plantFromStashAction,
  plantTulipAction,
  removeSoilTileAction,
  saveObservationAction,
  stashPlantAction,
  updateObservationMemoAction,
} from '../storage/gardenActions';
import { loadState, saveState } from '../storage/persistence';

export function useGardenStore() {
  const [state, setState] = useState<GardenState>(() => loadState().state);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [editMode, setEditMode] = useState<GardenEditMode>('view');
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [plantColor, setPlantColor] = useState<TulipColor>('red');
  const [selectedStashPlantId, setSelectedStashPlantId] = useState<string | null>(null);

  useEffect(() => {
    const result = loadState();
    setState(result.state);
    if (result.error) setLoadError(result.error);
    setHydrated(true);
  }, []);

  const persist = useCallback((next: GardenState): SaveResult => {
    const result = saveState(next);
    if (!result.ok) {
      setSaveError(result.error ?? '保存に失敗しました');
    } else {
      setSaveError(null);
    }
    return result;
  }, []);

  const applyState = useCallback(
    (next: GardenState): SaveResult => {
      const result = persist(next);
      if (result.ok) setState(next);
      return result;
    },
    [persist],
  );

  const addablePositions = useMemo(() => getAddableSoilPositions(state), [state]);

  const saveObservation = useCallback(
    (
      input: Parameters<typeof saveObservationAction>[1],
    ): RegistrationResult => {
      const { nextState, result } = saveObservationAction(state, input);
      const save = applyState(nextState);
      return attachSaveResult(result, save);
    },
    [state, applyState],
  );

  const addSoilTile = useCallback(
    (x: number, z: number) => applyState(addSoilTileAction(state, x, z)),
    [state, applyState],
  );

  const removeSoilTile = useCallback(
    (tileId: string) => applyState(removeSoilTileAction(state, tileId)),
    [state, applyState],
  );

  const plantTulip = useCallback(
    (tileId: string, color: TulipColor) => applyState(plantTulipAction(state, tileId, color)),
    [state, applyState],
  );

  const plantFromStash = useCallback(
    (plantId: string, tileId: string) => applyState(plantFromStashAction(state, plantId, tileId)),
    [state, applyState],
  );

  const movePlant = useCallback(
    (plantId: string, tileId: string) => applyState(movePlantAction(state, plantId, tileId)),
    [state, applyState],
  );

  const stashPlant = useCallback(
    (plantId: string) => applyState(stashPlantAction(state, plantId)),
    [state, applyState],
  );

  const updateObservationMemo = useCallback(
    (observationId: string, memo: string) =>
      applyState(updateObservationMemoAction(state, observationId, memo)),
    [state, applyState],
  );

  const clearSaveError = useCallback(() => setSaveError(null), []);
  const clearLoadError = useCallback(() => setLoadError(null), []);

  const resetEditSelection = useCallback(() => {
    setSelectedTileId(null);
    setSelectedPlantId(null);
    setSelectedStashPlantId(null);
  }, []);

  return {
    state,
    hydrated,
    saveError,
    loadError,
    editMode,
    setEditMode,
    selectedTileId,
    setSelectedTileId,
    selectedPlantId,
    setSelectedPlantId,
    plantColor,
    setPlantColor,
    selectedStashPlantId,
    setSelectedStashPlantId,
    addablePositions,
    observationCount: state.observations.length,
    tulipUnlocked: state.tulipUnlocked,
    clearSaveError,
    clearLoadError,
    saveObservation,
    addSoilTile,
    removeSoilTile,
    plantTulip,
    plantFromStash,
    movePlant,
    stashPlant,
    updateObservationMemo,
    resetEditSelection,
  };
}

export type GardenStore = ReturnType<typeof useGardenStore>;
