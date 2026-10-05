import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { GardenStore } from '../../hooks/useGardenStore';
import type { SyncUiStatus } from '../../hooks/useAppSession';
import { useSkySettings } from '../../hooks/useSkySettings';
import type { GardenDecorationType, GardenEditMode, TileSurface } from '../../types';
import { getPlantDisplayName } from '../../data/flowerCatalog';
import { DECORATION_CATALOG, getDecorationCatalogEntry, type DecorationCategory } from '../../data/decorationCatalog';
import { MAX_TERRAIN_HEIGHT, TILE_SURFACES } from '../../utils/terrain';
import { TULIP_COLORS } from '../../data/tulip';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import { resolveCameraFocusPlantId } from '../../utils/gardenCamera';
import { getModelPreviewLabel, resolvePlantModelType } from '../../utils/plantModel';
import { cycleEmptyTileId } from '../../utils/plantingFlow';
import { getLinkedObservations } from '../../utils/plantObservationLink';
import { getEmptyGardenContext } from '../../utils/emptyGarden';
import { GARDEN_LIMITS, getGardenCapacity } from '../../utils/gardenLimits';
import { Garden3DCanvas } from '../garden3d/Garden3DCanvas';
import { FlowerCatalogSheet } from './FlowerCatalogSheet';
import { GardenMemoryPanel } from './GardenMemoryPanel';
import { SkySettingsDialog } from './SkySettingsDialog';
import styles from './GardenScreen.module.css';

interface GardenScreenProps {
  store: GardenStore;
  onDiscover: () => void;
  onObservations: () => void;
  onSettings: () => void;
  onOutings?: () => void;
  onViewTulipObservations?: () => void;
  plantObservationId?: string | null;
  onPlantObservationHandled?: () => void;
  syncStatus?: SyncUiStatus;
}

function formatCaptionDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ja-JP', {
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

export function GardenScreen({
  store,
  onDiscover,
  onObservations,
  onSettings,
  onOutings,
  onViewTulipObservations: _onViewTulipObservations,
  plantObservationId: pendingPlantObservationId,
  onPlantObservationHandled,
  syncStatus,
}: GardenScreenProps) {
  const {
    state,
    gardenPhase,
    editMode,
    setEditMode,
    selectedTileId,
    setSelectedTileId,
    selectedPlantId,
    setSelectedPlantId,
    plantColor,
    setPlantColor,
    plantObservationId,
    setPlantObservationId,
    selectedStashPlantId,
    viewingPlantId,
    viewingObservationId,
    lastAdmiredPlantId,
    setLastAdmiredPlantId,
    closeMemoryView,
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
    tulipUnlocked,
    addSoilTile,
    removeSoilTile,
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
    resetEditSelection,
  } = store;

  const titleRef = useScreenFocus(['garden']);
  const plantingKeyboardRef = useRef<HTMLDivElement>(null);
  const [skySettingsOpen, setSkySettingsOpen] = useState(false);
  const [obsSectionOpen, setObsSectionOpen] = useState(false);
  const [toolCategory, setToolCategory] = useState<'flowers' | 'surfaces' | 'decorations'>('flowers');
  const [selectedSurface, setSelectedSurface] = useState<TileSurface>('stone');
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const buildingTrayRef = useRef<HTMLDivElement>(null);
  const [trayHeight, setTrayHeight] = useState(330);
  const [memoryCardHeight, setMemoryCardHeight] = useState<number | undefined>();
  const [decorationCatalogExpanded, setDecorationCatalogExpanded] = useState(true);
  const [decorationQuery, setDecorationQuery] = useState('');
  const [decorationCategory, setDecorationCategory] = useState<DecorationCategory | 'all'>('all');
  const [selectedDecorationType, setSelectedDecorationType] =
    useState<GardenDecorationType | null>(null);
  const [selectedDecorationId, setSelectedDecorationId] = useState<string | null>(null);
  const [pendingDecorationTileId, setPendingDecorationTileId] = useState<string | null>(null);
  const [pendingDecorationRotation, setPendingDecorationRotation] = useState(0);
  const [pendingStashDecorationId, setPendingStashDecorationId] = useState<string | null>(null);
  const [decorationSaving, setDecorationSaving] = useState(false);
  const decorationBusyRef = useRef(false);
  const {
    settings: skySettings,
    activePeriod,
    periodLabel,
    transitionsEnabled,
    cloudMotionEnabled,
    setMode: setSkyMode,
    setMotion: setSkyMotion,
  } = useSkySettings();
  const isViewing = gardenPhase === 'viewing';
  const brightSkyHeader = activePeriod === 'morning' || activePeriod === 'day';
  const isBuilding = gardenPhase === 'building';

  useEffect(() => {
    if (!isBuilding || !plantingFlowActive) return;
    setToolCategory('flowers');
    setSelectedDecorationId(null);
    setSelectedDecorationType(null);
    setPendingStashDecorationId(null);
    setPendingDecorationTileId(null);
  }, [isBuilding, plantingFlowActive]);
  useEffect(() => {
    if (!isBuilding) return;
    const node = buildingTrayRef.current;
    if (!node) return;
    const measure = () => {
      const height = Math.round(node.getBoundingClientRect().height);
      if (height > 0) setTrayHeight(height);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [isBuilding]);

  const resetCamera = () => {
    closeMemoryView();
    setLastAdmiredPlantId(null);
    setCameraResetKey((key) => key + 1);
  };

  const memoryOpen = Boolean(viewingPlantId || viewingObservationId);

  const tulipObservations = useMemo(
    () => state.observations.filter((o) => o.plantType === 'tulip'),
    [state.observations],
  );

  const emptyGarden = useMemo(
    () => getEmptyGardenContext(state),
    [state],
  );
  const gardenCapacity = useMemo(() => getGardenCapacity(state), [state]);

  const plantingObservation = useMemo(
    () => (plantObservationId ? state.observations.find((o) => o.id === plantObservationId) : null),
    [plantObservationId, state.observations],
  );

  useEffect(() => {
    if (!pendingPlantObservationId) return;
    enterPlantingFlowForObservation(pendingPlantObservationId);
    onPlantObservationHandled?.();
  }, [pendingPlantObservationId, enterPlantingFlowForObservation, onPlantObservationHandled]);

  const handleConfirmPlacement = useCallback(async () => {
    const linkedObservationId = plantObservationId;
    const plantId = await confirmPendingPlacement();
    if (!plantId) return;
    if (linkedObservationId) {
      finishPlantingAndView(plantId, linkedObservationId);
    }
  }, [plantObservationId, confirmPendingPlacement, finishPlantingAndView]);

  const linkTargetPlant = useMemo(() => {
    if (selectedPlantId) {
      return state.plants.find((p) => p.id === selectedPlantId);
    }
    if (selectedStashPlantId) {
      return state.stashedPlants.find((p) => p.id === selectedStashPlantId);
    }
    return undefined;
  }, [selectedPlantId, selectedStashPlantId, state.plants, state.stashedPlants]);

  const cameraFocusPlantId = isViewing
    ? resolveCameraFocusPlantId(state.plants, {
        viewingPlantId,
        viewingObservationId,
        lastAdmiredPlantId,
      })
    : null;
  const highlightPlantId = isViewing ? viewingPlantId : null;

  const focusPlant = cameraFocusPlantId
    ? state.plants.find((p) => p.id === cameraFocusPlantId)
    : undefined;

  const captionObservation = useMemo(() => {
    if (!focusPlant) return null;
    const linked = getLinkedObservations(focusPlant, state.observations);
    if (viewingObservationId) {
      const viewing = linked.find((o) => o.id === viewingObservationId) ?? linked[0];
      return viewing ?? null;
    }
    return linked[0] ?? null;
  }, [focusPlant, state.observations, viewingObservationId]);

  const pendingStashPlant = pendingFromStashPlantId
    ? state.stashedPlants.find((p) => p.id === pendingFromStashPlantId)
    : undefined;

  const displayModelType =
    selectedModelType ??
    (pendingStashPlant ? resolvePlantModelType(pendingStashPlant) : null);
  const displayColor = pendingStashPlant?.color ?? plantColor;
  const isStashRestoration = Boolean(pendingFromStashPlantId);

  const pendingPlacementPreview = useMemo(() => {
    if (!pendingPlacementTileId) return null;
    if (pendingStashPlant) {
      return {
        modelType: resolvePlantModelType(pendingStashPlant),
        color: pendingStashPlant.color,
        rotation: pendingRotation,
      };
    }
    if (!selectedModelType) return null;
    return {
      modelType: selectedModelType,
      color: plantColor,
      rotation: pendingRotation,
    };
  }, [
    pendingPlacementTileId,
    pendingStashPlant,
    selectedModelType,
    plantColor,
    pendingRotation,
  ]);

  const pendingDecoration = pendingStashDecorationId
    ? state.stashedDecorations.find((item) => item.id === pendingStashDecorationId)
    : null;
  const activeDecorationType = pendingDecoration?.type ?? selectedDecorationType;
  const occupiedTileIds = useMemo(
    () =>
      new Set([
        ...state.plants.map((plant) => plant.tileId),
        ...state.decorations.map((decoration) => decoration.tileId),
      ]),
    [state.plants, state.decorations],
  );

  const hasPlantingSelection = Boolean(selectedModelType || pendingFromStashPlantId);
  const noEmptySoil = plantingFlowActive && hasPlantingSelection && emptySoilTiles.length === 0;

  const handleTileClick = (tileId: string) => {
    if (!isBuilding) return;

    if (toolCategory === 'decorations' && activeDecorationType && !decorationCatalogExpanded) {
      if (!occupiedTileIds.has(tileId)) {
        setPendingDecorationTileId(tileId);
        setSelectedTileId(tileId);
      }
      return;
    }

    if (plantingFlowActive && hasPlantingSelection && !catalogExpanded) {
      beginPendingPlacement(tileId);
      setSelectedTileId(tileId);
      return;
    }

    if (editMode === 'remove-soil') {
      removeSoilTile(tileId);
      resetEditSelection();
      return;
    }
    if (editMode === 'raise-terrain' || editMode === 'lower-terrain') {
      void changeTileHeight(tileId, editMode === 'raise-terrain' ? 1 : -1);
      setSelectedTileId(tileId);
      return;
    }
    if (editMode === 'paint-surface') {
      paintSurface(tileId, selectedSurface);
      setSelectedTileId(tileId);
      return;
    }
    if (editMode === 'move' && selectedPlantId) {
      movePlant(selectedPlantId, tileId);
      resetEditSelection();
      return;
    }
    if (editMode === 'move' && selectedDecorationId) {
      moveDecoration(selectedDecorationId, tileId);
      setSelectedDecorationId(null);
      resetEditSelection();
      return;
    }
    setSelectedTileId(tileId);
  };

  const handleGhostTileClick = (x: number, z: number) => {
    if (isBuilding && editMode === 'add-soil') {
      addSoilTile(x, z);
    }
  };

  const handlePlantClick = (plantId: string) => {
    if (isViewing) {
      const plant = state.plants.find((p) => p.id === plantId);
      if (!plant) return;
      const linked = getLinkedObservations(plant, state.observations);
      openMemoryView(plantId, linked[0]?.id ?? null);
      return;
    }

    if (editMode === 'remove-plant') {
      stashPlant(plantId);
      resetEditSelection();
      return;
    }
    if (editMode === 'move') {
      setSelectedDecorationId(null);
      setSelectedPlantId(plantId);
      return;
    }
    clearPlantingFlow();
    setSelectedDecorationType(null);
    setPendingStashDecorationId(null);
    setPendingDecorationTileId(null);
    setSelectedPlantId(plantId);
    setSelectedDecorationId(null);
  };

  const handleDecorationClick = (decorationId: string) => {
    if (!isBuilding) return;
    if (editMode === 'remove-plant') {
      stashDecoration(decorationId);
      setSelectedDecorationId(null);
      return;
    }
    clearPlantingFlow();
    setSelectedDecorationType(null);
    setPendingStashDecorationId(null);
    setPendingDecorationTileId(null);
    setSelectedDecorationId(decorationId);
    setSelectedPlantId(null);
  };

  const selectCategory = (category: 'flowers' | 'surfaces' | 'decorations') => {
    setToolCategory(category);
    setDecorationCatalogExpanded(true);
    setSelectedDecorationId(null);
    setPendingDecorationTileId(null);
    setPendingStashDecorationId(null);
    setSelectedDecorationType(null);
    resetEditSelection();
    if (category === 'flowers') {
      enterPlantingFlow();
    } else {
      clearPlantingFlow();
      setEditMode(category === 'surfaces' ? 'paint-surface' : 'place-decoration');
    }
  };

  const confirmDecorationPlacement = async () => {
    if (!pendingDecorationTileId || !activeDecorationType || decorationBusyRef.current) return;
    decorationBusyRef.current = true;
    setDecorationSaving(true);
    try {
      const result = pendingStashDecorationId
        ? await restoreDecoration(
            pendingStashDecorationId,
            pendingDecorationTileId,
            pendingDecorationRotation,
          )
        : await placeDecoration(
            pendingDecorationTileId,
            activeDecorationType,
            pendingDecorationRotation,
          );
      if (!result.ok) return;
      setPendingDecorationTileId(null);
      if (pendingStashDecorationId) {
        setPendingStashDecorationId(null);
        setSelectedDecorationType(null);
        setDecorationCatalogExpanded(true);
      }
    } finally {
      decorationBusyRef.current = false;
      setDecorationSaving(false);
    }
  };

  const handleModeChange = (mode: GardenEditMode) => {
    setSelectedDecorationId(null);
    if (mode === 'move' || mode === 'remove-plant') {
      setSelectedDecorationType(null);
      setPendingStashDecorationId(null);
      setPendingDecorationTileId(null);
    }
    setEditMode(mode);
    resetEditSelection();
  };

  const moveSelectedItem = () => {
    const plantId = selectedPlantId;
    const decorationId = selectedDecorationId;
    setSelectedDecorationType(null);
    setPendingStashDecorationId(null);
    setPendingDecorationTileId(null);
    setEditMode('move');
    setSelectedPlantId(plantId);
    setSelectedDecorationId(decorationId);
  };

  const handleAddSoilFromPlanting = () => {
    clearPlantingFlow();
    setToolCategory('surfaces');
    setEditMode('add-soil');
  };

  useEffect(() => {
    if (!isBuilding || !plantingFlowActive) return;

    const region = plantingKeyboardRef.current;
    if (!region) return;

    const isInteractiveControl = (target: EventTarget | null): boolean => {
      if (!(target instanceof HTMLElement)) return false;
      const tag = target.tagName;
      return (
        tag === 'INPUT' ||
        tag === 'TEXTAREA' ||
        tag === 'SELECT' ||
        tag === 'BUTTON' ||
        target.isContentEditable
      );
    };

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInteractiveControl(e.target)) return;

      if (e.key === 'Escape') {
        if (pendingPlacementTileId) {
          e.preventDefault();
          cancelPendingPlacement();
          return;
        }
        if (catalogExpanded) {
          e.preventDefault();
          clearPlantingFlow();
          return;
        }
        if (hasPlantingSelection) {
          e.preventDefault();
          reopenFlowerCatalog();
        }
        return;
      }

      if (!hasPlantingSelection || emptySoilTiles.length === 0) return;

      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault();
        const direction = e.key === 'ArrowRight' ? 1 : -1;
        const nextId = cycleEmptyTileId(emptySoilTiles, pendingPlacementTileId, direction);
        if (nextId) {
          beginPendingPlacement(nextId);
          setSelectedTileId(nextId);
        }
        return;
      }

      if (e.key === 'Enter' && pendingPlacementTileId) {
        e.preventDefault();
        void handleConfirmPlacement();
      }
    };

    region.addEventListener('keydown', handleKeyDown);
    if (hasPlantingSelection && !catalogExpanded) {
      region.focus({ preventScroll: true });
    }
    return () => region.removeEventListener('keydown', handleKeyDown);
  }, [
    isBuilding,
    plantingFlowActive,
    hasPlantingSelection,
    catalogExpanded,
    emptySoilTiles,
    pendingPlacementTileId,
    beginPendingPlacement,
    cancelPendingPlacement,
    clearPlantingFlow,
    reopenFlowerCatalog,
    handleConfirmPlacement,
    setSelectedTileId,
  ]);

  const editHint = (() => {
    if (isViewing) return '花をタップして思い出を見られます。指で回して眺められます';
    if (toolCategory === 'decorations' && activeDecorationType) {
      return pendingDecorationTileId
        ? '位置を確認して確定します。続けて同じ飾りを置けます'
        : '空いているタイルをタップして仮置きします';
    }
    if (plantingFlowActive) {
      if (catalogExpanded) return '好きな植物を選んで、庭に迎えましょう';
      if (!hasPlantingSelection) return '花を選んでから、空いている土をタップします';
      if (noEmptySoil) return '空きがありません。土を足す';
      if (!pendingPlacementTileId) return '光っている土をタップして仮置きします';
      return '位置を確認して「ここに植える」で確定します';
    }
    switch (editMode) {
      case 'add-soil':
        return '光っている位置をタップして土を足します';
      case 'remove-soil':
        return 'タイルを外します。載っている花や飾りは収納へ移ります';
      case 'raise-terrain':
        return `タイルをタップして高くします（最大${MAX_TERRAIN_HEIGHT}段）`;
      case 'lower-terrain':
        return 'タイルをタップして1段低くします';
      case 'paint-surface':
        return 'タイルをタップして表面を塗ります';
      case 'move':
        return selectedPlantId || selectedDecorationId
          ? '移したい空きタイルをタップしてください'
          : '移したい花か飾りをタップしてください';
      case 'remove-plant':
        return '花か飾りをタップして収納します';
      default:
        return '庭全体を見渡して編集できます';
    }
  })();

  const plantingFlowTitle = catalogExpanded
    ? '植物を選ぶ'
    : hasPlantingSelection
      ? '植物を植える'
      : '植物を選ぶ';

  const plantingKeyboardHint =
    emptySoilTiles.length > 0 && hasPlantingSelection && !catalogExpanded
      ? '左右キーで空き土を選び、Enterで確定'
      : undefined;

  const filteredDecorations = DECORATION_CATALOG.filter((entry) =>
    (decorationCategory === 'all' || entry.category === decorationCategory)
    && (!decorationQuery.trim() || `${entry.label} ${entry.description}`.includes(decorationQuery.trim())));
  const activeDecorationEntry = activeDecorationType ? getDecorationCatalogEntry(activeDecorationType) : null;
  const surfaceLabels: Record<TileSurface, string> = {
    grass: '草', soil: '土', stone: '石の小径', gravel: '砂利', wood: '木のデッキ', water: '水辺',
  };

  return (
    <div className={styles.screen}>
      <div className={styles.sceneLayer}>
        <Garden3DCanvas
          soilTiles={state.soilTiles}
          plants={state.plants}
          decorations={state.decorations}
          gardenPhase={gardenPhase}
          editMode={isBuilding ? editMode : 'view'}
          selectedTileId={selectedTileId}
          selectedPlantId={selectedPlantId}
          selectedDecorationId={isBuilding ? selectedDecorationId : null}
          focusPlantId={cameraFocusPlantId}
          highlightPlantId={highlightPlantId}
          plantColor={plantColor}
          addablePositions={addablePositions}
          tulipUnlocked={tulipUnlocked}
          plantingFlowActive={plantingFlowActive && hasPlantingSelection}
          pendingPlacementTileId={isBuilding ? pendingDecorationTileId ?? pendingPlacementTileId : null}
          pendingPlacementPreview={isBuilding ? pendingPlacementPreview : null}
          pendingDecorationPreview={
            isBuilding && activeDecorationType
              ? { type: activeDecorationType, rotation: pendingDecorationRotation }
              : null
          }
          memoryPanelOpen={memoryOpen}
          cameraResetKey={cameraResetKey}
          bottomInsetPx={isBuilding ? trayHeight : memoryOpen ? memoryCardHeight : 122}
          skyPeriod={activePeriod}
          skyCloudMotionEnabled={cloudMotionEnabled}
          skyTransitionsEnabled={transitionsEnabled}
          onTileClick={handleTileClick}
          onGhostTileClick={handleGhostTileClick}
          onPlantClick={handlePlantClick}
          onDecorationClick={handleDecorationClick}
        />
      </div>

      <div className={styles.overlay}>
        <header className={styles.header}>
          {isBuilding ? (
            <button type="button" className={styles.doneBtn} onClick={exitBuildingPhase}>
              眺める
            </button>
          ) : (
            <button
              type="button"
              className={styles.creditsBtn}
              onClick={onSettings}
              aria-label="設定"
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="6" r="1.4" fill="currentColor" />
                <circle cx="12" cy="12" r="1.4" fill="currentColor" />
                <circle cx="12" cy="18" r="1.4" fill="currentColor" />
              </svg>
            </button>
          )}

          <div className={`${styles.titleBlock} ${brightSkyHeader ? styles.titleBlockBright : ''}`}>
            <h1 className={styles.title} ref={titleRef} tabIndex={-1}>
              こもれび植物園
            </h1>
            <p className={styles.caption}>
              わたしの小さな庭
              {syncStatus === 'synced' ? ' · 同期済み' : syncStatus === 'pending' ? ' · 未同期' : ''}
              {isBuilding
                ? saveStatus === 'saving'
                  ? ' · 保存中…'
                  : saveStatus === 'error'
                    ? ' · 保存失敗'
                    : saveStatus === 'saved'
                      ? ' · 保存済み'
                      : ''
                : ''}
            </p>
          </div>

          <button type="button" className={styles.homeViewBtn} onClick={resetCamera} aria-label="庭全体を見る" title="庭全体を見る">
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /><path d="m12 7 6 5-6 5-6-5Z" fill="none" stroke="currentColor" strokeWidth="1.5" /></svg>
            <span>全景</span>
          </button>
          <button
            type="button"
            className={styles.skySettingsBtn}
            onClick={() => setSkySettingsOpen(true)}
            aria-label={`空の設定、現在は${periodLabel}`}
          >
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path
                d="M6 14a5 5 0 0 1 10 0c0 1.2-.4 2.3-1.1 3.2M8.5 18.5h7"
                stroke="currentColor"
                strokeWidth="1.5"
                fill="none"
                strokeLinecap="round"
              />
              <circle cx="9" cy="9" r="2.2" fill="currentColor" opacity="0.85" />
              <circle cx="15.5" cy="10.5" r="1.6" fill="currentColor" opacity="0.7" />
            </svg>
          </button>
        </header>

        <SkySettingsDialog
          open={skySettingsOpen}
          settings={skySettings}
          onClose={() => setSkySettingsOpen(false)}
          onModeChange={setSkyMode}
          onMotionChange={setSkyMotion}
        />

        {isViewing && state.plants.length > 0 && (
          <nav className={styles.flowerNav} aria-label="庭の花を選ぶ">
            <span className={styles.flowerNavLabel}>庭の花</span>
            <div className={styles.flowerNavList}>
              {state.plants.map((plant, index) => {
                const linked = getLinkedObservations(plant, state.observations);
                const label =
                  linked[0]?.commonNameJa ??
                  getPlantDisplayName(plant) ??
                  `花${index + 1}`;
                return (
                  <button
                    key={plant.id}
                    type="button"
                    className={`${styles.flowerNavDot} ${viewingPlantId === plant.id ? styles.flowerNavActive : ''}`}
                    onClick={() => openMemoryView(plant.id, linked[0]?.id ?? null)}
                    aria-current={viewingPlantId === plant.id ? 'true' : undefined}
                    aria-label={`${label}の思い出を見る`}
                    title={label}
                  />
                );
              })}
            </div>
          </nav>
        )}

        {isViewing && !memoryOpen && (
          <div className={styles.gardenCaption} aria-live="polite">
            {focusPlant && captionObservation ? (
              <>
                <p className={styles.gardenCaptionName}>{captionObservation.commonNameJa}</p>
                <p className={styles.gardenCaptionDate}>
                  {formatCaptionDate(captionObservation.takenAt)}
                </p>
              </>
            ) : focusPlant ? (
              <>
                <p className={styles.gardenCaptionName}>{getPlantDisplayName(focusPlant)}</p>
                {getModelPreviewLabel(resolvePlantModelType(focusPlant)) && (
                  <p className={styles.gardenCaptionDate}>
                    {getModelPreviewLabel(resolvePlantModelType(focusPlant))}
                  </p>
                )}
              </>
            ) : (
              <div className={styles.gardenCaptionEmpty}>
                <p>{emptyGarden.message}</p>
                {emptyGarden.scenario === 'plantable_available' &&
                  emptyGarden.plantObservationId && (
                  <button
                    type="button"
                    className={styles.emptyGardenPlantBtn}
                    onClick={() => enterPlantingFlowForObservation(emptyGarden.plantObservationId!)}
                  >
                    {emptyGarden.plantObservationName}を庭に植える
                  </button>
                )}
                {emptyGarden.scenario === 'stashed_only' && (
                  <button
                    type="button"
                    className={styles.emptyGardenPlantBtn}
                    onClick={enterBuildingPhase}
                  >
                    庭づくりを開く
                  </button>
                )}
              </div>
            )}
          </div>
        )}

        {isViewing && <GardenMemoryPanel store={store} onCompactHeightChange={setMemoryCardHeight} />}

        {isBuilding && (
          <div className={styles.buildingTray} ref={buildingTrayRef}>
            <div className={styles.buildingPanel}>
              <div className={styles.toolboxTop}>
                <div className={styles.categoryRow} role="tablist" aria-label="置くもの">
                  {([
                    ['flowers', '植物'],
                    ['surfaces', '道・地面'],
                    ['decorations', '飾り'],
                  ] as const).map(([category, label]) => (
                    <button
                      key={category}
                      type="button"
                      role="tab"
                      aria-selected={toolCategory === category}
                      className={`${styles.categoryBtn} ${toolCategory === category ? styles.categoryActive : ''}`}
                      onClick={() => selectCategory(category)}
                    >
                      {label}
                    </button>
                  ))}
                </div>
                <div className={styles.historyRow}>
                  <button type="button" aria-pressed={editMode === 'move'} onClick={() => handleModeChange('move')}>
                    移動
                  </button>
                  <button type="button" aria-pressed={editMode === 'remove-plant'} onClick={() => handleModeChange('remove-plant')}>
                    収納
                  </button>
                  <button type="button" disabled={!canUndo || saveStatus === 'saving'} onClick={() => void undoGarden()}>
                    ↶ 取り消す
                  </button>
                  <button type="button" disabled={!canRedo || saveStatus === 'saving'} onClick={() => void redoGarden()}>
                    ↷ やり直す
                  </button>
                </div>
                <p className={styles.capacityLine}>
                  土地 {gardenCapacity.tileCount}/{GARDEN_LIMITS.maxTiles}
                  <span aria-hidden="true"> · </span>
                  配置 {gardenCapacity.placedItemCount}/{GARDEN_LIMITS.maxPlacedItems}
                  <span aria-hidden="true"> · </span>
                  高さ {GARDEN_LIMITS.maxHeight + 1}段
                  <span aria-hidden="true"> · </span>
                  9×9内
                </p>
                {gardenCapacity.isLegacy && (
                  <p className={styles.legacyCapacityWarning} role="status">
                    以前の庭が現在の範囲を超えています。今ある配置は消さず、移動・収納できます。
                  </p>
                )}
              </div>

              <div
                ref={plantingKeyboardRef}
                className={`${styles.buildingScroll} ${plantingFlowActive ? styles.buildingScrollCompact : ''}`}
                tabIndex={plantingFlowActive ? -1 : undefined}
                role={plantingFlowActive ? 'region' : undefined}
                aria-label={plantingFlowActive ? plantingFlowTitle : undefined}
              >
                {plantingKeyboardHint && <span className={styles.keyboardOnlyHint}>{plantingKeyboardHint}</span>}
                <p className={styles.editHint} role="status">{editHint}</p>

                {plantingFlowActive && (
                  <div className={styles.plantingFlowBody}>
                    {plantingObservation && !catalogExpanded && (
                      <section className={styles.obsPlantContext} aria-label="植える観察">
                        <img
                          src={plantingObservation.imageDataUrl}
                          alt=""
                          className={styles.obsPlantThumb}
                        />
                        <div>
                          <p className={styles.obsPlantName}>{plantingObservation.commonNameJa}</p>
                          <p className={styles.obsPlantHint}>この記録の写真と結びつけて植えます</p>
                        </div>
                      </section>
                    )}

                    {!plantObservationId && (
                      <FlowerCatalogSheet
                        expanded={catalogExpanded}
                        selectedModelType={selectedModelType}
                        displayModelType={displayModelType}
                        displayColor={displayColor}
                        plantColor={plantColor}
                        tulipUnlocked={tulipUnlocked}
                        stashedPlants={state.stashedPlants}
                        selectedStashPlantId={pendingFromStashPlantId}
                        onSelect={selectFlowerModel}
                        onSelectStash={selectStashForPlanting}
                        onReselect={reopenFlowerCatalog}
                      />
                    )}

                    {selectedModelType === 'tulip' &&
                      !catalogExpanded &&
                      !isStashRestoration &&
                      !plantObservationId && (
                      <section className={styles.colorSection} aria-label="チューリップの色">
                        <div className={styles.colorRow}>
                          {TULIP_COLORS.map((c) => (
                            <button
                              key={c.id}
                              type="button"
                              className={`${styles.colorSwatch} ${plantColor === c.id ? styles.colorSelected : ''}`}
                              style={{ backgroundColor: c.hex }}
                              onClick={() => setPlantColor(c.id)}
                              aria-label={c.label}
                              aria-pressed={plantColor === c.id}
                            />
                          ))}
                        </div>
                      </section>
                    )}

                    {selectedModelType === 'tulip' &&
                      !catalogExpanded &&
                      !isStashRestoration &&
                      !plantObservationId &&
                      tulipObservations.length > 0 && (
                        <section className={styles.obsPickSection}>
                          <button
                            type="button"
                            className={styles.obsToggle}
                            onClick={() => setObsSectionOpen((open) => !open)}
                            aria-expanded={obsSectionOpen}
                          >
                            関連する記録（任意）
                          </button>
                          {obsSectionOpen && (
                            <div className={styles.obsPickList}>
                              <button
                                type="button"
                                className={`${styles.obsPickItem} ${!plantObservationId ? styles.obsPickSelected : ''}`}
                                onClick={() => setPlantObservationId(null)}
                              >
                                <span className={styles.obsPickName}>なし</span>
                              </button>
                              {tulipObservations.map((obs) => (
                                <button
                                  key={obs.id}
                                  type="button"
                                  className={`${styles.obsPickItem} ${plantObservationId === obs.id ? styles.obsPickSelected : ''}`}
                                  onClick={() => setPlantObservationId(obs.id)}
                                >
                                  <img src={obs.imageDataUrl} alt="" className={styles.obsPickThumb} />
                                  <span className={styles.obsPickText}>
                                    <span className={styles.obsPickName}>{obs.commonNameJa}</span>
                                    <span className={styles.obsPickDate}>
                                      {formatCaptionDate(obs.takenAt)}
                                    </span>
                                  </span>
                                  {obs.isSample && (
                                    <span className={styles.obsPickSample}>サンプル</span>
                                  )}
                                </button>
                              ))}
                            </div>
                          )}
                        </section>
                      )}

                    {noEmptySoil && (
                      <div className={styles.emptySoilGuide}>
                        <p>空きがありません。土を足す</p>
                        <button type="button" className={styles.addSoilLink} onClick={handleAddSoilFromPlanting}>
                          土を足すモードへ
                        </button>
                      </div>
                    )}

                    {hasPlantingSelection && !catalogExpanded && (
                      <div className={styles.placementActions}>
                        <button
                          type="button"
                          className={styles.rotateBtn}
                          onClick={rotatePendingPlacement}
                          aria-label="花の向きを45度回す"
                        >
                          向きを回す
                        </button>
                        {pendingPlacementTileId && (
                          <div className={styles.confirmRow}>
                            <button
                              type="button"
                              className={styles.confirmBtn}
                              disabled={placementSaving}
                              onClick={() => void handleConfirmPlacement()}
                            >
                              {placementSaving ? '保存中…' : 'ここに植える'}
                            </button>
                            <button
                              type="button"
                              className={styles.cancelBtn}
                              onClick={cancelPendingPlacement}
                            >
                              キャンセル
                            </button>
                          </div>
                        )}
                      </div>
                    )}

                    {placementSaveError && (
                      <p className={styles.placementError} role="alert">{placementSaveError}</p>
                    )}
                  </div>
                )}

                {toolCategory === 'surfaces' && !plantingFlowActive && (
                  <div className={styles.sandboxSection}>
                    <div className={styles.optionGrid} role="group" aria-label="地面の表面">
                      {TILE_SURFACES.map((surface) => (
                        <button
                          key={surface}
                          type="button"
                          className={`${styles.optionBtn} ${editMode === 'paint-surface' && selectedSurface === surface ? styles.optionActive : ''}`}
                          onClick={() => {
                            setSelectedDecorationId(null);
                            resetEditSelection();
                            setSelectedSurface(surface);
                            setEditMode('paint-surface');
                          }}
                        >
                          <span className={`${styles.surfaceDot} ${styles[`surface_${surface}`]}`} />
                          {surfaceLabels[surface]}
                        </button>
                      ))}
                    </div>
                    <div className={styles.shapeTools} role="group" aria-label="地面の高さ">
                      <button type="button" className={editMode === 'raise-terrain' ? styles.optionActive : ''} onClick={() => handleModeChange('raise-terrain')}>↟ 高くする</button>
                      <button type="button" className={editMode === 'lower-terrain' ? styles.optionActive : ''} onClick={() => handleModeChange('lower-terrain')}>↡ 低くする</button>
                    </div>
                    <div className={styles.shapeTools} role="group" aria-label="庭の形">
                      <button type="button" className={editMode === 'add-soil' ? styles.optionActive : ''} onClick={() => handleModeChange('add-soil')}>
                        ＋ 土台を足す
                      </button>
                      <button type="button" className={editMode === 'remove-soil' ? styles.optionActive : ''} onClick={() => handleModeChange('remove-soil')}>
                        − 土台を外す
                      </button>
                    </div>
                  </div>
                )}

                {toolCategory === 'decorations' && !plantingFlowActive && !selectedPlantId && !selectedDecorationId && (
                  <div className={styles.sandboxSection}>
                    {decorationCatalogExpanded || !activeDecorationEntry ? (
                      <>
                        <input type="search" className={styles.paletteSearch} aria-label="飾りを探す" placeholder="飾りを探す" value={decorationQuery} onChange={(event) => setDecorationQuery(event.target.value)} />
                        <div className={styles.paletteFilters} role="group" aria-label="飾りの種類">
                          {([['all', 'すべて'], ['rest', 'くつろぎ'], ['path', '小径'], ['water', '水辺'], ['growing', '園芸'], ['ornament', 'アクセント']] as const).map(([category, label]) => (
                            <button key={category} type="button" aria-pressed={decorationCategory === category} onClick={() => setDecorationCategory(category)}>{label}</button>
                          ))}
                        </div>
                        <div className={styles.decorationGrid} role="group" aria-label="飾りを選ぶ">
                          {filteredDecorations.map((entry) => (
                            <button key={entry.type} type="button" className={styles.decorationCard} onClick={() => {
                              setSelectedDecorationId(null);
                              resetEditSelection();
                              setSelectedDecorationType(entry.type);
                              setPendingStashDecorationId(null);
                              setPendingDecorationTileId(null);
                              setPendingDecorationRotation(entry.type === 'bench' ? Math.PI / 2 : 0);
                              setDecorationCatalogExpanded(false);
                              setEditMode('place-decoration');
                            }}>
                              <img src={entry.thumbnail} alt="" loading="lazy" />
                              <span>{entry.label}</span>
                            </button>
                          ))}
                        </div>
                        {filteredDecorations.length === 0 && <p className={styles.paletteEmpty}>別の名前や種類で探してみてください。</p>}
                        {state.stashedDecorations.length > 0 && (
                          <details className={styles.stashSection}>
                            <summary className={styles.stashSummary}>収納した飾り ({state.stashedDecorations.length})</summary>
                            <div className={styles.stashRow}>
                              {state.stashedDecorations.map((decoration) => (
                                <button key={decoration.id} type="button" className={styles.stashChip} onClick={() => {
                                  setSelectedDecorationId(null);
                                  resetEditSelection();
                                  setPendingStashDecorationId(decoration.id);
                                  setSelectedDecorationType(null);
                                  setPendingDecorationTileId(null);
                                  setPendingDecorationRotation(decoration.rotation);
                                  setDecorationCatalogExpanded(false);
                                }}>{getDecorationCatalogEntry(decoration.type).label}</button>
                              ))}
                            </div>
                          </details>
                        )}
                      </>
                    ) : (
                      <button type="button" className={styles.selectedDecorationCard} onClick={() => {
                        setDecorationCatalogExpanded(true);
                        setPendingDecorationTileId(null);
                      }}>
                        <img src={activeDecorationEntry.thumbnail} alt="" />
                        <span>{activeDecorationEntry.label}</span>
                        <small>選び直す</small>
                      </button>
                    )}
                    {activeDecorationType && !decorationCatalogExpanded && (
                      <div className={styles.placementActions}>
                        <button type="button" className={styles.rotateBtn} onClick={() => setPendingDecorationRotation((value) => value + Math.PI / 4)}>向きを回す</button>
                        {pendingDecorationTileId && (
                          <div className={styles.confirmRow}>
                            <button type="button" className={styles.confirmBtn} disabled={decorationSaving} onClick={() => void confirmDecorationPlacement()}>{decorationSaving ? '保存中…' : 'ここに置く'}</button>
                            <button type="button" className={styles.cancelBtn} onClick={() => setPendingDecorationTileId(null)}>キャンセル</button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {!plantingFlowActive && !activeDecorationType && (selectedPlantId || selectedDecorationId) && (
                  <section className={styles.selectedActions} aria-label="選んだものの操作">
                    <p>選んだものを操作</p>
                    <button type="button" onClick={() => rotateGardenItem(selectedPlantId ?? selectedDecorationId!)}>向きを回す</button>
                    <button type="button" onClick={moveSelectedItem}>移動する</button>
                    <button
                      type="button"
                      onClick={() => {
                        if (selectedPlantId) stashPlant(selectedPlantId);
                        if (selectedDecorationId) stashDecoration(selectedDecorationId);
                        setSelectedDecorationId(null);
                        resetEditSelection();
                      }}
                    >
                      収納する
                    </button>
                  </section>
                )}

                {!plantingFlowActive &&
                  linkTargetPlant &&
                  resolvePlantModelType(linkTargetPlant) === 'tulip' &&
                  tulipObservations.length > 0 && (
                  <section className={styles.linkSection} aria-label="記録の関連づけ">
                    <p className={styles.fieldLabel}>選んだ花の記録</p>
                    <div className={styles.obsPickList}>
                      {tulipObservations.map((obs) => {
                        const linked = linkTargetPlant.observationIds?.includes(obs.id);
                        return (
                          <button
                            key={obs.id}
                            type="button"
                            className={`${styles.obsPickItem} ${linked ? styles.obsPickSelected : ''}`}
                            onClick={() => {
                              const plantId = linkTargetPlant.id;
                              if (linked) {
                                unlinkPlantObservation(plantId, obs.id);
                              } else {
                                linkPlantObservation(plantId, obs.id);
                              }
                            }}
                          >
                            <img src={obs.imageDataUrl} alt="" className={styles.obsPickThumb} />
                            <span className={styles.obsPickText}>
                              <span className={styles.obsPickName}>
                                {linked ? '✓ ' : ''}{obs.commonNameJa}
                              </span>
                              <span className={styles.obsPickDate}>{formatCaptionDate(obs.takenAt)}</span>
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </section>
                )}
              </div>
            </div>
          </div>
        )}

        {isViewing && !memoryOpen && (
          <nav className={styles.bottomNav} aria-label="庭のメインメニュー">
            <button type="button" className={styles.navAction} onClick={onDiscover}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.navIcon}>
                <path
                  d="M4 7h4l2-3h4l2 3h4v12H4V7z"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinejoin="round"
                />
                <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.5" fill="none" />
              </svg>
              <span>撮る</span>
            </button>
            <button type="button" className={styles.navAction} onClick={enterBuildingPhase}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.navIcon}>
                <path
                  d="M12 20V9M8 13c-3-1-4-5-2-7 2-2 5-1-6 1M16 13c3-1 4-5 2-7-2-2-5-1-6 1"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
              <span>庭づくり</span>
            </button>
            <button type="button" className={styles.navAction} onClick={onOutings}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.navIcon}>
                <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.5" fill="none" />
                <path d="m15.5 8.5-2 5-5 2 2-5Z" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinejoin="round" />
              </svg>
              <span>おでかけ</span>
            </button>
            <button type="button" className={styles.navAction} onClick={onObservations}>
              <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.navIcon}>
                <path
                  d="M6 5h12v14H6zM9 9h6M9 13h4"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  fill="none"
                  strokeLinecap="round"
                />
              </svg>
              <span>記録</span>
            </button>
          </nav>
        )}
      </div>
    </div>
  );
}
