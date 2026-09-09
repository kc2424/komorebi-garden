import { useEffect, useMemo, useRef, useState } from 'react';
import type { GardenStore } from '../../hooks/useGardenStore';
import { useSkySettings } from '../../hooks/useSkySettings';
import type { GardenEditMode } from '../../types';
import { getPlantDisplayName } from '../../data/flowerCatalog';
import { TULIP_COLORS } from '../../data/tulip';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import { resolveCameraFocusPlantId } from '../../utils/gardenCamera';
import { getModelPreviewLabel, resolvePlantModelType } from '../../utils/plantModel';
import { cycleEmptyTileId } from '../../utils/plantingFlow';
import { getLinkedObservations } from '../../utils/plantObservationLink';
import { Garden3DCanvas } from '../garden3d/Garden3DCanvas';
import { FlowerCatalogSheet } from './FlowerCatalogSheet';
import { GardenMemoryPanel } from './GardenMemoryPanel';
import { SkySettingsDialog } from './SkySettingsDialog';
import styles from './GardenScreen.module.css';

interface GardenScreenProps {
  store: GardenStore;
  onDiscover: () => void;
  onObservations: () => void;
  onCredits: () => void;
}

const BUILD_EDIT_MODES: { mode: GardenEditMode; label: string; icon: 'add' | 'remove' | 'move' | 'stash' }[] = [
  { mode: 'add-soil', label: '土を足す', icon: 'add' },
  { mode: 'remove-soil', label: '土を外す', icon: 'remove' },
  { mode: 'move', label: '移す', icon: 'move' },
  { mode: 'remove-plant', label: 'しまう', icon: 'stash' },
];

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

function ModeIcon({ kind }: { kind: 'add' | 'remove' | 'move' | 'stash' }) {
  switch (kind) {
    case 'add':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.modeIcon}>
          <path d="M12 5v14M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'remove':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.modeIcon}>
          <path d="M5 12h14" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
        </svg>
      );
    case 'move':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.modeIcon}>
          <path
            d="M12 4v16M4 12h16M8 8l4-4 4 4M8 16l4 4 4-4"
            stroke="currentColor"
            strokeWidth="1.4"
            strokeLinecap="round"
            strokeLinejoin="round"
            fill="none"
          />
        </svg>
      );
    case 'stash':
      return (
        <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.modeIcon}>
          <path
            d="M6 8h12v10a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8zM4 8h16M9 12h6"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
            fill="none"
          />
        </svg>
      );
    default:
      return null;
  }
}

export function GardenScreen({
  store,
  onDiscover,
  onObservations,
  onCredits,
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
    plantingFlowActive,
    catalogExpanded,
    selectedModelType,
    pendingPlacementTileId,
    pendingFromStashPlantId,
    pendingRotation,
    placementSaveError,
    emptySoilTiles,
    addablePositions,
    tulipUnlocked,
    addSoilTile,
    removeSoilTile,
    movePlant,
    stashPlant,
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
    resetEditSelection,
  } = store;

  const titleRef = useScreenFocus(['garden']);
  const plantingKeyboardRef = useRef<HTMLDivElement>(null);
  const [skySettingsOpen, setSkySettingsOpen] = useState(false);
  const [obsSectionOpen, setObsSectionOpen] = useState(false);
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
  const memoryOpen = Boolean(viewingPlantId || viewingObservationId);

  const tulipObservations = useMemo(
    () => state.observations.filter((o) => o.plantType === 'tulip'),
    [state.observations],
  );

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

  const hasPlantingSelection = Boolean(selectedModelType || pendingFromStashPlantId);
  const noEmptySoil = plantingFlowActive && hasPlantingSelection && emptySoilTiles.length === 0;

  const handleTileClick = (tileId: string) => {
    if (!isBuilding) return;

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
    if (editMode === 'move' && selectedPlantId) {
      movePlant(selectedPlantId, tileId);
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
      setSelectedPlantId(plantId);
      return;
    }
    setSelectedPlantId(plantId);
  };

  const handleModeChange = (mode: GardenEditMode) => {
    setEditMode(mode);
    resetEditSelection();
  };

  const handleAddSoilFromPlanting = () => {
    clearPlantingFlow();
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
        confirmPendingPlacement();
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
    confirmPendingPlacement,
    setSelectedTileId,
  ]);

  const editHint = (() => {
    if (isViewing) return '花をタップして思い出を見られます。指で回して眺められます';
    if (plantingFlowActive) {
      if (catalogExpanded) return '見本をタップして選びます';
      if (!hasPlantingSelection) return '花を選んでから、空いている土をタップします';
      if (noEmptySoil) return '空きがありません。土を足す';
      if (!pendingPlacementTileId) return '光っている土をタップして仮置きします';
      return '位置を確認して「ここに植える」で確定します';
    }
    switch (editMode) {
      case 'add-soil':
        return '光っている位置をタップして土を足します';
      case 'remove-soil':
        return '空の土タイルをタップして外します（花はしまわれます）';
      case 'move':
        return '花を選んでから移したい土をタップします';
      case 'remove-plant':
        return '花をタップして庭からしまいます';
      default:
        return '庭全体を見渡して編集できます';
    }
  })();

  const handlePlantingBack = () => {
    if (pendingPlacementTileId) {
      cancelPendingPlacement();
      return;
    }
    if (catalogExpanded) {
      clearPlantingFlow();
      return;
    }
    reopenFlowerCatalog();
  };

  const plantingFlowTitle = catalogExpanded
    ? '花を選ぶ'
    : hasPlantingSelection
      ? '花を植える'
      : '花を選ぶ';

  const plantingKeyboardHint =
    emptySoilTiles.length > 0 && hasPlantingSelection && !catalogExpanded
      ? '左右キーで空き土を選び、Enterで確定'
      : undefined;

  return (
    <div className={styles.screen}>
      <div className={styles.sceneLayer}>
        <Garden3DCanvas
          soilTiles={state.soilTiles}
          plants={state.plants}
          gardenPhase={gardenPhase}
          editMode={isBuilding ? editMode : 'view'}
          selectedTileId={selectedTileId}
          selectedPlantId={selectedPlantId}
          focusPlantId={cameraFocusPlantId}
          highlightPlantId={highlightPlantId}
          plantColor={plantColor}
          addablePositions={addablePositions}
          tulipUnlocked={tulipUnlocked}
          plantingFlowActive={plantingFlowActive && hasPlantingSelection}
          pendingPlacementTileId={pendingPlacementTileId}
          pendingPlacementPreview={pendingPlacementPreview}
          memoryPanelOpen={memoryOpen}
          skyPeriod={activePeriod}
          skyCloudMotionEnabled={cloudMotionEnabled}
          skyTransitionsEnabled={transitionsEnabled}
          onTileClick={handleTileClick}
          onGhostTileClick={handleGhostTileClick}
          onPlantClick={handlePlantClick}
        />
      </div>

      <div className={styles.overlay}>
        <header className={styles.header}>
          {isBuilding ? (
            <button type="button" className={styles.doneBtn} onClick={exitBuildingPhase}>
              完了
            </button>
          ) : (
            <button
              type="button"
              className={styles.creditsBtn}
              onClick={onCredits}
              aria-label="クレジット"
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
            <p className={styles.caption}>わたしの小さな庭</p>
          </div>

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
              <p className={styles.gardenCaptionEmpty}>
                写真を撮って、最初の花を庭に迎えましょう
              </p>
            )}
          </div>
        )}

        {isViewing && <GardenMemoryPanel store={store} />}

        {isBuilding && (
          <div className={styles.buildingTray}>
            <div className={styles.buildingPanel}>
              {plantingFlowActive ? (
                <div
                  ref={plantingKeyboardRef}
                  className={styles.plantingFlowHeader}
                  tabIndex={-1}
                  role="region"
                  aria-label={plantingFlowTitle}
                >
                  <button
                    type="button"
                    className={styles.plantingBackBtn}
                    onClick={handlePlantingBack}
                  >
                    戻る
                  </button>
                  <h2 className={styles.plantingFlowTitle}>{plantingFlowTitle}</h2>
                  {plantingKeyboardHint && (
                    <p className={styles.plantingKeyboardHint}>{plantingKeyboardHint}</p>
                  )}
                </div>
              ) : (
                <>
                  <button
                    type="button"
                    className={styles.plantEntryBtn}
                    onClick={enterPlantingFlow}
                  >
                    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.plantEntryIcon}>
                      <path
                        d="M12 20V10M8 14c-3-1-4-5-2-7 2-2 5-1 6 1M16 14c3-1 4-5 2-7-2-2-5-1-6 1"
                        stroke="currentColor"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        fill="none"
                      />
                    </svg>
                    <span>花を植える</span>
                  </button>

                  <div className={styles.modeRow} role="group" aria-label="庭の編集道具">
                    {BUILD_EDIT_MODES.map(({ mode, label, icon }) => (
                      <button
                        key={mode}
                        type="button"
                        className={`${styles.modeBtn} ${editMode === mode ? styles.modeActive : ''}`}
                        onClick={() => handleModeChange(mode)}
                        aria-pressed={editMode === mode}
                      >
                        <ModeIcon kind={icon} />
                        <span className={styles.modeLabel}>{label}</span>
                      </button>
                    ))}
                  </div>
                </>
              )}

              <div
                className={`${styles.buildingScroll} ${plantingFlowActive ? styles.buildingScrollCompact : ''}`}
              >
                <p className={styles.editHint} role="status">{editHint}</p>

                {plantingFlowActive && (
                  <div className={styles.plantingFlowBody}>
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

                    {selectedModelType === 'tulip' &&
                      !catalogExpanded &&
                      !isStashRestoration &&
                      tulipUnlocked && (
                      <section className={styles.colorSection} aria-label="チューリップの色">
                        <p className={styles.fieldLabel}>植える色</p>
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
                      tulipUnlocked &&
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

                    {!catalogExpanded && state.stashedPlants.length > 0 && (
                      <section className={styles.stashSection} aria-label="しまった花">
                        <p className={styles.fieldLabel}>しまった花 ({state.stashedPlants.length})</p>
                        <div className={styles.stashRow}>
                          {state.stashedPlants.map((p) => (
                            <button
                              key={p.id}
                              type="button"
                              className={`${styles.stashChip} ${pendingFromStashPlantId === p.id ? styles.stashSelected : ''}`}
                              onClick={() => selectStashForPlanting(p.id)}
                            >
                              {getPlantDisplayName(p)}
                            </button>
                          ))}
                        </div>
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
                              onClick={() => confirmPendingPlacement()}
                            >
                              ここに植える
                            </button>
                            <button
                              type="button"
                              className={styles.cancelBtn}
                              onClick={cancelPendingPlacement}
                            >
                              やり直す
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
