import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  GardenState,
  GardenEditMode,
  GardenModelType,
  GardenScreenPhase,
  RegistrationResult,
  SaveResult,
  TulipColor,
} from '../types';
import {
  attachSaveResult,
  addSoilTileAction,
  getAddableSoilPositions,
  linkPlantObservationAction,
  movePlantAction,
  plantFlowerAction,
  plantFromStashAction,
  removeSoilTileAction,
  saveObservationAction,
  stashPlantAction,
  unlinkPlantObservationAction,
  updateObservationMemoAction,
} from '../storage/gardenActions';
import { loadState, saveState } from '../storage/persistence';
import { canBeginPendingPlacement, getEmptySoilTiles } from '../utils/plantingFlow';

export function useGardenStore() {
  const [state, setState] = useState<GardenState>(() => loadState().state);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [hydrated, setHydrated] = useState(false);
  const [gardenPhase, setGardenPhase] = useState<GardenScreenPhase>('viewing');
  const [editMode, setEditMode] = useState<GardenEditMode>('view');
  const [selectedTileId, setSelectedTileId] = useState<string | null>(null);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [plantColor, setPlantColor] = useState<TulipColor>('red');
  const [selectedStashPlantId, setSelectedStashPlantId] = useState<string | null>(null);
  const [plantObservationId, setPlantObservationId] = useState<string | null>(null);
  const [viewingPlantId, setViewingPlantId] = useState<string | null>(null);
  const [viewingObservationId, setViewingObservationId] = useState<string | null>(null);
  const [lastAdmiredPlantId, setLastAdmiredPlantId] = useState<string | null>(null);
  const [plantingFlowActive, setPlantingFlowActive] = useState(false);
  const [catalogExpanded, setCatalogExpanded] = useState(false);
  const [selectedModelType, setSelectedModelType] = useState<GardenModelType | null>(null);
  const [pendingPlacementTileId, setPendingPlacementTileId] = useState<string | null>(null);
  const [pendingFromStashPlantId, setPendingFromStashPlantId] = useState<string | null>(null);
  const [pendingRotation, setPendingRotation] = useState(() => Math.random() * Math.PI * 2);
  const [placementSaveError, setPlacementSaveError] = useState<string | null>(null);

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
  const emptySoilTiles = useMemo(() => getEmptySoilTiles(state), [state]);

  const clearPendingPlacementTile = useCallback(() => {
    setPendingPlacementTileId(null);
    setPlacementSaveError(null);
  }, []);

  const clearPendingPlacement = useCallback(() => {
    clearPendingPlacementTile();
    setPendingFromStashPlantId(null);
  }, [clearPendingPlacementTile]);

  const clearPlantingFlow = useCallback(() => {
    setPlantingFlowActive(false);
    setCatalogExpanded(false);
    setSelectedModelType(null);
    clearPendingPlacement();
  }, [clearPendingPlacement]);

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

  const plantFlower = useCallback(
    (
      tileId: string,
      modelType: GardenModelType,
      color: TulipColor,
      observationId?: string | null,
      rotation?: number,
    ) => applyState(plantFlowerAction(state, tileId, modelType, color, observationId, rotation)),
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

  const linkPlantObservation = useCallback(
    (plantId: string, observationId: string) =>
      applyState(linkPlantObservationAction(state, plantId, observationId)),
    [state, applyState],
  );

  const unlinkPlantObservation = useCallback(
    (plantId: string, observationId: string) =>
      applyState(unlinkPlantObservationAction(state, plantId, observationId)),
    [state, applyState],
  );

  const resetEditSelection = useCallback(() => {
    setSelectedTileId(null);
    setSelectedPlantId(null);
    setSelectedStashPlantId(null);
  }, []);

  const enterPlantingFlow = useCallback(() => {
    setPlantingFlowActive(true);
    setCatalogExpanded(true);
    setSelectedModelType(null);
    clearPendingPlacement();
    setEditMode('view');
    resetEditSelection();
  }, [clearPendingPlacement, resetEditSelection]);

  const selectFlowerModel = useCallback((modelType: GardenModelType) => {
    setSelectedModelType(modelType);
    setCatalogExpanded(false);
    clearPendingPlacement();
    setSelectedStashPlantId(null);
    setPendingRotation(
      modelType === 'pansy' ? Math.PI / 4 : Math.random() * Math.PI * 2,
    );
  }, [clearPendingPlacement]);

  const reopenFlowerCatalog = useCallback(() => {
    setCatalogExpanded(true);
    clearPendingPlacement();
  }, [clearPendingPlacement]);

  const beginPendingPlacement = useCallback(
    (tileId: string) => {
      if (catalogExpanded) return;
      if (pendingFromStashPlantId) {
        if (getEmptySoilTiles(state).some((t) => t.id === tileId)) {
          setPendingPlacementTileId(tileId);
          setPlacementSaveError(null);
        }
        return;
      }
      if (!selectedModelType) return;
      if (
        !canBeginPendingPlacement(state, tileId, selectedModelType, state.tulipUnlocked)
      ) {
        return;
      }
      setPendingPlacementTileId(tileId);
      setPlacementSaveError(null);
    },
    [catalogExpanded, pendingFromStashPlantId, selectedModelType, state],
  );

  const confirmPendingPlacement = useCallback(() => {
    if (!pendingPlacementTileId) return false;

    if (pendingFromStashPlantId) {
      const result = applyState(
        plantFromStashAction(
          state,
          pendingFromStashPlantId,
          pendingPlacementTileId,
          pendingRotation,
        ),
      );
      if (!result.ok) {
        setPlacementSaveError(result.error ?? '保存に失敗しました');
        return false;
      }
      setPendingFromStashPlantId(null);
      setPendingPlacementTileId(null);
      setSelectedStashPlantId(null);
      setCatalogExpanded(true);
      setPlacementSaveError(null);
      return true;
    }

    if (!selectedModelType) return false;
    const result = applyState(
      plantFlowerAction(
        state,
        pendingPlacementTileId,
        selectedModelType,
        plantColor,
        plantObservationId,
        pendingRotation,
      ),
    );
    if (!result.ok) {
      setPlacementSaveError(result.error ?? '保存に失敗しました');
      return false;
    }
    setPendingPlacementTileId(null);
    setPlacementSaveError(null);
    return true;
  }, [
    pendingPlacementTileId,
    pendingFromStashPlantId,
    selectedModelType,
    state,
    applyState,
    plantColor,
    plantObservationId,
    pendingRotation,
  ]);

  const cancelPendingPlacement = useCallback(() => {
    clearPendingPlacementTile();
  }, [clearPendingPlacementTile]);

  const rotatePendingPlacement = useCallback(() => {
    setPendingRotation((rotation) => rotation + Math.PI / 4);
  }, []);

  const selectStashForPlanting = useCallback((plantId: string) => {
    const stashPlant = state.stashedPlants.find((p) => p.id === plantId);
    clearPendingPlacementTile();
    setPendingFromStashPlantId(plantId);
    setSelectedModelType(null);
    setCatalogExpanded(false);
    setSelectedStashPlantId(plantId);
    if (stashPlant) {
      setPendingRotation(stashPlant.rotation);
    }
  }, [clearPendingPlacementTile, state.stashedPlants]);

  const enterBuildingPhase = useCallback(() => {
    setGardenPhase('building');
    setEditMode('add-soil');
    setViewingPlantId(null);
    setViewingObservationId(null);
    resetEditSelection();
    clearPlantingFlow();
  }, [resetEditSelection, clearPlantingFlow]);

  const exitBuildingPhase = useCallback(() => {
    setGardenPhase('viewing');
    setEditMode('view');
    resetEditSelection();
    clearPlantingFlow();
  }, [resetEditSelection, clearPlantingFlow]);

  const setBuildingEditMode = useCallback(
    (mode: GardenEditMode) => {
      if (mode !== 'view') {
        clearPlantingFlow();
      }
      setEditMode(mode);
      resetEditSelection();
    },
    [clearPlantingFlow, resetEditSelection],
  );

  const clearSaveError = useCallback(() => setSaveError(null), []);
  const clearLoadError = useCallback(() => setLoadError(null), []);

  const closeMemoryView = useCallback(() => {
    setViewingPlantId(null);
    setViewingObservationId(null);
  }, []);

  const openMemoryView = useCallback((plantId: string, observationId?: string | null) => {
    setViewingPlantId(plantId);
    setViewingObservationId(observationId ?? null);
    setLastAdmiredPlantId(plantId);
  }, []);

  return {
    state,
    hydrated,
    saveError,
    loadError,
    gardenPhase,
    setGardenPhase,
    editMode,
    setEditMode: setBuildingEditMode,
    selectedTileId,
    setSelectedTileId,
    selectedPlantId,
    setSelectedPlantId,
    plantColor,
    setPlantColor,
    plantObservationId,
    setPlantObservationId,
    selectedStashPlantId,
    setSelectedStashPlantId,
    viewingPlantId,
    setViewingPlantId,
    viewingObservationId,
    setViewingObservationId,
    lastAdmiredPlantId,
    setLastAdmiredPlantId,
    plantingFlowActive,
    catalogExpanded,
    selectedModelType,
    pendingPlacementTileId,
    pendingFromStashPlantId,
    pendingRotation,
    placementSaveError,
    emptySoilTiles,
    addablePositions,
    observationCount: state.observations.length,
    tulipUnlocked: state.tulipUnlocked,
    clearSaveError,
    clearLoadError,
    saveObservation,
    addSoilTile,
    removeSoilTile,
    plantFlower,
    plantFromStash,
    movePlant,
    stashPlant,
    updateObservationMemo,
    linkPlantObservation,
    unlinkPlantObservation,
    enterBuildingPhase,
    exitBuildingPhase,
    enterPlantingFlow,
    selectFlowerModel,
    reopenFlowerCatalog,
    beginPendingPlacement,
    confirmPendingPlacement,
    cancelPendingPlacement,
    rotatePendingPlacement,
    clearPlantingFlow,
    selectStashForPlanting,
    openMemoryView,
    closeMemoryView,
    resetEditSelection,
  };
}

export type GardenStore = ReturnType<typeof useGardenStore>;
