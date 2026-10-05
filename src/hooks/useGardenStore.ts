import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GardenState,
  GardenEditMode,
  GardenDecorationType,
  GardenModelType,
  GardenScreenPhase,
  RegistrationResult,
  SaveResult,
  TulipColor,
  TileSurface,
} from '../types';
import {
  attachSaveResult,
  addSoilTileAction,
  changeTileHeightAction,
  deleteObservationAction,
  getAddableSoilPositions,
  linkPlantObservationAction,
  movePlantAction,
  moveDecorationAction,
  paintSurfaceAction,
  placeDecorationAction,
  plantFlowerAction,
  plantFromStashAction,
  decorationFromStashAction,
  removeSoilTileAction,
  rotateGardenItemAction,
  saveObservationAction,
  stashPlantAction,
  stashDecorationAction,
  unlinkPlantObservationAction,
  updateObservationMemoAction,
  updateObservationAction,
} from '../storage/gardenActions';
import { bumpRevision, createEmptyState, loadState, saveState } from '../storage/persistence';
import { deleteImage } from '../storage/imageStore';
import { canBeginPendingPlacement, getEmptySoilTiles } from '../utils/plantingFlow';
import { canPlantObservationInGarden } from '../utils/plantObservationLink';
import { defaultTulipColor } from '../data/tulip';
import {
  didRestoreStashedPlant,
  findNewlyPlacedPlantId,
  GARDEN_PLACEMENT_BLOCKED_ERROR,
  getAddSoilTileBlockError,
  getPlacedItemBlockError,
} from '../utils/gardenLimits';

type GardenSnapshot = Pick<
  GardenState,
  'soilTiles' | 'plants' | 'stashedPlants' | 'decorations' | 'stashedDecorations'
>;

const SCOPE_CHANGED_ERROR = '保存先が変更されたため、操作を完了できませんでした。';

function snapshotGarden(state: GardenState): GardenSnapshot {
  return {
    soilTiles: structuredClone(state.soilTiles),
    plants: structuredClone(state.plants),
    stashedPlants: structuredClone(state.stashedPlants),
    decorations: structuredClone(state.decorations),
    stashedDecorations: structuredClone(state.stashedDecorations),
  };
}

function restoreGardenSnapshot(state: GardenState, snapshot: GardenSnapshot): GardenState {
  const currentPlants = new Map(
    [...state.plants, ...state.stashedPlants].map((plant) => [plant.id, plant]),
  );
  const observationIds = new Set(state.observations.map((observation) => observation.id));
  const restorePlantLinks = (plant: GardenState['plants'][number]) => {
    const source = currentPlants.get(plant.id) ?? plant;
    const validLinks =
      (source.modelType ?? 'tulip') === 'tulip'
        ? source.observationIds?.filter((id) => observationIds.has(id))
        : undefined;
    return {
      ...plant,
      observationIds: validLinks && validLinks.length > 0 ? validLinks : undefined,
    };
  };

  return bumpRevision({
    ...state,
    soilTiles: structuredClone(snapshot.soilTiles),
    plants: snapshot.plants.map((plant) => restorePlantLinks(structuredClone(plant))),
    stashedPlants: snapshot.stashedPlants.map((plant) =>
      restorePlantLinks(structuredClone(plant))),
    decorations: structuredClone(snapshot.decorations),
    stashedDecorations: structuredClone(snapshot.stashedDecorations),
  });
}

export function useGardenStore(userId: string | null = null) {
  const [state, setState] = useState<GardenState>(() => createEmptyState());
  const latestStateRef = useRef(state);
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
  const [placementSaving, setPlacementSaving] = useState(false);
  const placementBusyRef = useRef(false);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const saveChainRef = useRef<Promise<void>>(Promise.resolve());
  const undoStackRef = useRef<GardenSnapshot[]>([]);
  const redoStackRef = useRef<GardenSnapshot[]>([]);
  const [historyVersion, setHistoryVersion] = useState(0);
  const userIdRef = useRef(userId);
  const scopeGenerationRef = useRef(0);
  const scopeReadyRef = useRef(true);

  type OperationScope = {
    generation: number;
    userId: string | null;
  };

  const isCurrentScope = useCallback(
    (scope: OperationScope) =>
      scopeGenerationRef.current === scope.generation &&
      userIdRef.current === scope.userId,
    [],
  );

  const clearHistory = useCallback(() => {
    undoStackRef.current = [];
    redoStackRef.current = [];
    setHistoryVersion((value) => value + 1);
  }, []);

  const setUserScope = useCallback((uid: string | null) => {
    if (userIdRef.current === uid) return;
    userIdRef.current = uid;
    scopeGenerationRef.current += 1;
    scopeReadyRef.current = false;
    saveChainRef.current = Promise.resolve();
    clearHistory();
    setSaveError(null);
    setSaveStatus('idle');
  }, [clearHistory]);

  const reload = useCallback(async (uid: string | null = userIdRef.current) => {
    if (userIdRef.current !== uid) {
      setUserScope(uid);
    }
    const scope: OperationScope = {
      generation: scopeGenerationRef.current,
      userId: uid,
    };
    const operation = saveChainRef.current
      .catch(() => undefined)
      .then(async () => {
        if (!isCurrentScope(scope)) return latestStateRef.current;
        try {
          const result = await loadState(scope.userId);
          if (!isCurrentScope(scope)) return latestStateRef.current;
          latestStateRef.current = result.state;
          setState(result.state);
          scopeReadyRef.current = true;
          clearHistory();
          setLoadError(result.error ?? null);
          setHydrated(true);
          return result.state;
        } catch {
          if (isCurrentScope(scope)) {
            setLoadError('保存データの読み込みに失敗しました。');
            setHydrated(true);
          }
          return latestStateRef.current;
        }
      });
    saveChainRef.current = operation.then(
      () => undefined,
      () => undefined,
    );
    return operation;
  }, [clearHistory, isCurrentScope, setUserScope]);

  useEffect(() => {
    void reload(userId);
  }, [userId, reload]);

  const persist = useCallback(
    async (next: GardenState, scope: OperationScope): Promise<SaveResult> => {
      let result: SaveResult;
      try {
        result = await saveState(next, scope.userId);
      } catch (error) {
        const detail = error instanceof Error ? error.message : '不明なエラー';
        result = { ok: false, error: `保存に失敗しました: ${detail}` };
      }
      if (isCurrentScope(scope)) {
        setSaveError(result.ok ? null : (result.error ?? '保存に失敗しました'));
      }
      return result;
    },
    [isCurrentScope],
  );

  const applyStateAction = useCallback(
    (
      action: (current: GardenState) => GardenState,
      options: {
        gardenHistory?: boolean;
        replacement?: boolean;
        preflight?: (current: GardenState) => string | null;
        onPreflightError?: (error: string) => void;
      } = {},
    ): Promise<SaveResult> => {
      const scope: OperationScope = {
        generation: scopeGenerationRef.current,
        userId: userIdRef.current,
      };
      const operation = saveChainRef.current
        .catch(() => undefined)
        .then(async (): Promise<SaveResult> => {
          if (!isCurrentScope(scope)) {
            return { ok: false, error: SCOPE_CHANGED_ERROR };
          }
          if (!scopeReadyRef.current && !options.replacement) {
            const result = { ok: false, error: SCOPE_CHANGED_ERROR };
            setSaveError(result.error);
            if (options.gardenHistory) setSaveStatus('error');
            return result;
          }

          const before = latestStateRef.current;
          const preflightError = options.preflight?.(before) ?? null;
          if (preflightError) {
            if (isCurrentScope(scope)) {
              if (options.onPreflightError) {
                options.onPreflightError(preflightError);
              } else {
                setSaveError(preflightError);
              }
            }
            return { ok: false, error: preflightError };
          }

          const next = action(before);
          if (next === before) {
            if (options.replacement) {
              scopeReadyRef.current = true;
              clearHistory();
            }
            return { ok: true };
          }

          if (options.gardenHistory) setSaveStatus('saving');
          const result = await persist(next, scope);
          if (!isCurrentScope(scope)) {
            return { ok: false, error: SCOPE_CHANGED_ERROR };
          }

          if (result.ok) {
            if (options.gardenHistory) {
              undoStackRef.current = [
                ...undoStackRef.current,
                snapshotGarden(before),
              ].slice(-20);
              redoStackRef.current = [];
            }
            latestStateRef.current = next;
            setState(next);
            scopeReadyRef.current = true;
            if (options.replacement) {
              clearHistory();
            } else if (options.gardenHistory) {
              setHistoryVersion((value) => value + 1);
            }
            if (options.gardenHistory) setSaveStatus('saved');
          } else if (options.gardenHistory) {
            setSaveStatus('error');
          }
          return result;
        });
      saveChainRef.current = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    [clearHistory, isCurrentScope, persist],
  );

  const applyGardenAction = useCallback(
    (
      action: (current: GardenState) => GardenState,
      options: {
        preflight?: (current: GardenState) => string | null;
        onPreflightError?: (error: string) => void;
      } = {},
    ): Promise<SaveResult> =>
      applyStateAction(action, { gardenHistory: true, ...options }),
    [applyStateAction],
  );

  const undoGarden = useCallback(
    (): Promise<SaveResult> => {
      const scope: OperationScope = {
        generation: scopeGenerationRef.current,
        userId: userIdRef.current,
      };
      const operation = saveChainRef.current
        .catch(() => undefined)
        .then(async (): Promise<SaveResult> => {
          if (!isCurrentScope(scope) || !scopeReadyRef.current) {
            return { ok: false, error: SCOPE_CHANGED_ERROR };
          }
          const snapshot = undoStackRef.current.at(-1);
          if (!snapshot) return { ok: true };
          const current = latestStateRef.current;
          const next = restoreGardenSnapshot(current, snapshot);
          setSaveStatus('saving');
          const result = await persist(next, scope);
          if (!isCurrentScope(scope)) {
            return { ok: false, error: SCOPE_CHANGED_ERROR };
          }
          if (result.ok) {
            undoStackRef.current = undoStackRef.current.slice(0, -1);
            redoStackRef.current = [...redoStackRef.current, snapshotGarden(current)].slice(-20);
            latestStateRef.current = next;
            setState(next);
            setHistoryVersion((value) => value + 1);
            setSaveStatus('saved');
          } else {
            setSaveStatus('error');
          }
          return result;
        });
      saveChainRef.current = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    [isCurrentScope, persist],
  );

  const redoGarden = useCallback(
    (): Promise<SaveResult> => {
      const scope: OperationScope = {
        generation: scopeGenerationRef.current,
        userId: userIdRef.current,
      };
      const operation = saveChainRef.current
        .catch(() => undefined)
        .then(async (): Promise<SaveResult> => {
          if (!isCurrentScope(scope) || !scopeReadyRef.current) {
            return { ok: false, error: SCOPE_CHANGED_ERROR };
          }
          const snapshot = redoStackRef.current.at(-1);
          if (!snapshot) return { ok: true };
          const current = latestStateRef.current;
          const next = restoreGardenSnapshot(current, snapshot);
          setSaveStatus('saving');
          const result = await persist(next, scope);
          if (!isCurrentScope(scope)) {
            return { ok: false, error: SCOPE_CHANGED_ERROR };
          }
          if (result.ok) {
            redoStackRef.current = redoStackRef.current.slice(0, -1);
            undoStackRef.current = [...undoStackRef.current, snapshotGarden(current)].slice(-20);
            latestStateRef.current = next;
            setState(next);
            setHistoryVersion((value) => value + 1);
            setSaveStatus('saved');
          } else {
            setSaveStatus('error');
          }
          return result;
        });
      saveChainRef.current = operation.then(
        () => undefined,
        () => undefined,
      );
      return operation;
    },
    [isCurrentScope, persist],
  );

  const getLatestState = useCallback(() => latestStateRef.current, []);

  const replaceState = useCallback(
    (next: GardenState): Promise<SaveResult> =>
      applyStateAction(() => next, { replacement: true }),
    [applyStateAction],
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
    async (
      input: Parameters<typeof saveObservationAction>[1],
    ): Promise<RegistrationResult> => {
      let registration = saveObservationAction(latestStateRef.current, input).result;
      const saveResult = await applyStateAction((current) => {
        const actionResult = saveObservationAction(current, input);
        registration = actionResult.result;
        return actionResult.nextState;
      });
      return attachSaveResult(registration, saveResult);
    },
    [applyStateAction],
  );

  const addSoilTile = useCallback(
    (x: number, z: number) =>
      void applyGardenAction(
        (current) => addSoilTileAction(current, x, z),
        { preflight: (current) => getAddSoilTileBlockError(current, x, z) },
      ),
    [applyGardenAction],
  );

  const removeSoilTile = useCallback(
    (tileId: string) => void applyGardenAction((current) => removeSoilTileAction(current, tileId)),
    [applyGardenAction],
  );

  const plantFlower = useCallback(
    (
      tileId: string,
      modelType: GardenModelType,
      color: TulipColor,
      observationId?: string | null,
      rotation?: number,
    ) =>
      applyGardenAction(
        (current) =>
          plantFlowerAction(current, tileId, modelType, color, observationId, rotation),
        { preflight: getPlacedItemBlockError },
      ),
    [applyGardenAction],
  );

  const plantFromStash = useCallback(
    (plantId: string, tileId: string) =>
      void applyGardenAction(
        (current) => plantFromStashAction(current, plantId, tileId),
        { preflight: getPlacedItemBlockError },
      ),
    [applyGardenAction],
  );

  const movePlant = useCallback(
    (plantId: string, tileId: string) =>
      void applyGardenAction((current) => movePlantAction(current, plantId, tileId)),
    [applyGardenAction],
  );

  const stashPlant = useCallback(
    (plantId: string) => void applyGardenAction((current) => stashPlantAction(current, plantId)),
    [applyGardenAction],
  );

  const paintSurface = useCallback(
    (tileId: string, surface: TileSurface) =>
      void applyGardenAction((current) => paintSurfaceAction(current, tileId, surface)),
    [applyGardenAction],
  );

  const changeTileHeight = useCallback(
    (tileId: string, delta: number): Promise<SaveResult> =>
      applyGardenAction((current) => changeTileHeightAction(current, tileId, delta)),
    [applyGardenAction],
  );

  const placeDecoration = useCallback(
    (tileId: string, type: GardenDecorationType, rotation = 0) =>
      applyGardenAction(
        (current) => placeDecorationAction(current, tileId, type, rotation),
        { preflight: getPlacedItemBlockError },
      ),
    [applyGardenAction],
  );

  const moveDecoration = useCallback(
    (decorationId: string, tileId: string) =>
      void applyGardenAction((current) => moveDecorationAction(current, decorationId, tileId)),
    [applyGardenAction],
  );

  const stashDecoration = useCallback(
    (decorationId: string) =>
      void applyGardenAction((current) => stashDecorationAction(current, decorationId)),
    [applyGardenAction],
  );

  const restoreDecoration = useCallback(
    (decorationId: string, tileId: string, rotation?: number) =>
      applyGardenAction(
        (current) => decorationFromStashAction(current, decorationId, tileId, rotation),
        { preflight: getPlacedItemBlockError },
      ),
    [applyGardenAction],
  );

  const rotateGardenItem = useCallback(
    (itemId: string) =>
      void applyGardenAction((current) => rotateGardenItemAction(current, itemId)),
    [applyGardenAction],
  );

  const updateObservation = useCallback(
    async (
      observationId: string,
      input: Parameters<typeof updateObservationAction>[2],
    ): Promise<SaveResult> =>
      applyStateAction((current) => updateObservationAction(current, observationId, input)),
    [applyStateAction],
  );

  const updateObservationMemo = useCallback(
    async (observationId: string, memo: string): Promise<SaveResult> =>
      applyStateAction((current) => updateObservationMemoAction(current, observationId, memo)),
    [applyStateAction],
  );

  const deleteObservation = useCallback(
    async (observationId: string) => {
      let imageRef: string | undefined;
      const result = await applyStateAction((current) => {
        imageRef = current.observations.find((o) => o.id === observationId)?.imageRef;
        return deleteObservationAction(current, observationId);
      });
      if (result.ok && imageRef) {
        try {
          await deleteImage(imageRef);
        } catch {
          // The state deletion is already durable; orphan cleanup can be retried separately.
        }
      }
      return result;
    },
    [applyStateAction],
  );

  const linkPlantObservation = useCallback(
    (plantId: string, observationId: string) =>
      void applyStateAction((current) =>
        linkPlantObservationAction(current, plantId, observationId)),
    [applyStateAction],
  );

  const unlinkPlantObservation = useCallback(
    (plantId: string, observationId: string) =>
      void applyStateAction((current) =>
        unlinkPlantObservationAction(current, plantId, observationId)),
    [applyStateAction],
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
    setPlantObservationId(null);
    clearPendingPlacement();
    setEditMode('view');
    resetEditSelection();
  }, [clearPendingPlacement, resetEditSelection]);

  const enterPlantingFlowForObservation = useCallback(
    (observationId: string): boolean => {
      if (
        !canPlantObservationInGarden(
          observationId,
          state.observations,
          state.plants,
          state.stashedPlants,
          state.tulipUnlocked,
        )
      ) {
        return false;
      }
      const observation = state.observations.find((o) => o.id === observationId);
      if (!observation) return false;

      setGardenPhase('building');
      setPlantingFlowActive(true);
      setCatalogExpanded(false);
      setSelectedModelType('tulip');
      setPlantColor(observation.color ?? defaultTulipColor());
      setPlantObservationId(observationId);
      clearPendingPlacement();
      setEditMode('view');
      resetEditSelection();
      return true;
    },
    [state, clearPendingPlacement, resetEditSelection],
  );

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

  const confirmPendingPlacement = useCallback(async (): Promise<string | null> => {
    if (!pendingPlacementTileId || placementBusyRef.current) return null;
    const operationGeneration = scopeGenerationRef.current;
    placementBusyRef.current = true;
    setPlacementSaving(true);

    try {
      if (pendingFromStashPlantId) {
        const stashPlantId = pendingFromStashPlantId;
        const targetTileId = pendingPlacementTileId;
        let restoredPlantId: string | null = null;
        const result = await applyGardenAction(
          (current) => {
            const nextState = plantFromStashAction(
              current,
              stashPlantId,
              targetTileId,
              pendingRotation,
            );
            if (
              didRestoreStashedPlant(current, nextState, stashPlantId, targetTileId)
            ) {
              restoredPlantId = stashPlantId;
            }
            return nextState;
          },
          {
            preflight: getPlacedItemBlockError,
            onPreflightError: setPlacementSaveError,
          },
        );
        if (scopeGenerationRef.current !== operationGeneration) return null;
        if (!result.ok) {
          setPlacementSaveError(result.error ?? '保存に失敗しました');
          return null;
        }
        if (!restoredPlantId) {
          setPlacementSaveError(GARDEN_PLACEMENT_BLOCKED_ERROR);
          return null;
        }
        setPendingFromStashPlantId(null);
        setPendingPlacementTileId(null);
        setSelectedStashPlantId(null);
        setCatalogExpanded(true);
        setPlacementSaveError(null);
        return restoredPlantId;
      }

      if (!selectedModelType) return null;
      const targetTileId = pendingPlacementTileId;
      let newPlantId: string | null = null;
      const result = await applyGardenAction(
        (current) => {
          const nextState = plantFlowerAction(
            current,
            targetTileId,
            selectedModelType,
            plantColor,
            plantObservationId,
            pendingRotation,
          );
          newPlantId = findNewlyPlacedPlantId(current, nextState, targetTileId);
          return nextState;
        },
        {
          preflight: getPlacedItemBlockError,
          onPreflightError: setPlacementSaveError,
        },
      );
      if (scopeGenerationRef.current !== operationGeneration) return null;
      if (!result.ok) {
        setPlacementSaveError(result.error ?? '保存に失敗しました');
        return null;
      }
      if (!newPlantId) {
        setPlacementSaveError(GARDEN_PLACEMENT_BLOCKED_ERROR);
        return null;
      }
      setPendingPlacementTileId(null);
      setPlacementSaveError(null);
      return newPlantId;
    } finally {
      placementBusyRef.current = false;
      setPlacementSaving(false);
    }
  }, [
    pendingPlacementTileId,
    pendingFromStashPlantId,
    selectedModelType,
    applyGardenAction,
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
    const stashPlantItem = state.stashedPlants.find((p) => p.id === plantId);
    clearPendingPlacementTile();
    setPendingFromStashPlantId(plantId);
    setSelectedModelType(null);
    setCatalogExpanded(false);
    setSelectedStashPlantId(plantId);
    if (stashPlantItem) {
      setPendingRotation(stashPlantItem.rotation);
    }
  }, [clearPendingPlacementTile, state.stashedPlants]);

  const enterBuildingPhase = useCallback(() => {
    setGardenPhase('building');
    setEditMode('view');
    setViewingPlantId(null);
    setViewingObservationId(null);
    resetEditSelection();
    setPlantingFlowActive(true);
    setCatalogExpanded(true);
    setSelectedModelType(null);
    setPlantObservationId(null);
    clearPendingPlacement();
  }, [resetEditSelection, clearPendingPlacement]);

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
      if (mode !== editMode) {
        resetEditSelection();
      }
    },
    [clearPlantingFlow, editMode, resetEditSelection],
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

  const finishPlantingAndView = useCallback(
    (plantId: string, observationId?: string | null) => {
      const linkedObservationId = observationId ?? plantObservationId;
      clearPlantingFlow();
      setGardenPhase('viewing');
      setEditMode('view');
      resetEditSelection();
      openMemoryView(plantId, linkedObservationId);
      setPlantObservationId(null);
    },
    [clearPlantingFlow, resetEditSelection, openMemoryView, plantObservationId],
  );

  const canUndo = historyVersion >= 0 && undoStackRef.current.length > 0;
  const canRedo = historyVersion >= 0 && redoStackRef.current.length > 0;

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
    placementSaving,
    saveStatus,
    canUndo,
    canRedo,
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
    paintSurface,
    changeTileHeight,
    placeDecoration,
    moveDecoration,
    stashDecoration,
    restoreDecoration,
    rotateGardenItem,
    undoGarden,
    redoGarden,
    updateObservation,
    updateObservationMemo,
    deleteObservation,
    linkPlantObservation,
    unlinkPlantObservation,
    enterBuildingPhase,
    exitBuildingPhase,
    enterPlantingFlow,
    enterPlantingFlowForObservation,
    selectFlowerModel,
    reopenFlowerCatalog,
    beginPendingPlacement,
    confirmPendingPlacement,
    cancelPendingPlacement,
    rotatePendingPlacement,
    clearPlantingFlow,
    selectStashForPlanting,
    openMemoryView,
    finishPlantingAndView,
    closeMemoryView,
    resetEditSelection,
    reload,
    replaceState,
    getLatestState,
    setUserScope,
  };
}

export type GardenStore = ReturnType<typeof useGardenStore>;
