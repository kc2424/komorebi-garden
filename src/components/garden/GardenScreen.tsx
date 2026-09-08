import type { GardenStore } from '../../hooks/useGardenStore';
import type { GardenEditMode } from '../../types';
import { TULIP_COLORS } from '../../data/tulip';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import { Garden3DCanvas } from '../garden3d/Garden3DCanvas';
import { Button } from '../ui/Button';
import styles from './GardenScreen.module.css';

interface GardenScreenProps {
  store: GardenStore;
  onDiscover: () => void;
  onObservations: () => void;
  onCredits: () => void;
}

const EDIT_MODES: { mode: GardenEditMode; label: string }[] = [
  { mode: 'view', label: '見る' },
  { mode: 'add-soil', label: '土を足す' },
  { mode: 'remove-soil', label: '土を外す' },
  { mode: 'plant', label: '植える' },
  { mode: 'move', label: '移す' },
  { mode: 'remove-plant', label: 'しまう' },
];

export function GardenScreen({
  store,
  onDiscover,
  onObservations,
  onCredits,
}: GardenScreenProps) {
  const {
    state,
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
    tulipUnlocked,
    observationCount,
    addSoilTile,
    removeSoilTile,
    plantTulip,
    plantFromStash,
    movePlant,
    stashPlant,
    resetEditSelection,
  } = store;

  const titleRef = useScreenFocus(['garden']);

  const handleTileClick = (tileId: string) => {
    if (editMode === 'remove-soil') {
      removeSoilTile(tileId);
      resetEditSelection();
      return;
    }
    if (editMode === 'plant' && tulipUnlocked) {
      if (selectedStashPlantId) {
        plantFromStash(selectedStashPlantId, tileId);
        setSelectedStashPlantId(null);
      } else {
        plantTulip(tileId, plantColor);
      }
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
    if (editMode === 'add-soil') {
      addSoilTile(x, z);
    }
  };

  const handlePlantClick = (plantId: string) => {
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

  const editHint = (() => {
    switch (editMode) {
      case 'add-soil':
        return '光っている位置をタップして土を足します';
      case 'remove-soil':
        return '空の土タイルをタップして外します（花はしまわれます）';
      case 'plant':
        return tulipUnlocked
          ? '土タイルをタップしてチューリップを植えます'
          : 'チューリップを観察として保存すると植えられるようになります';
      case 'move':
        return '花を選んでから移したい土をタップします';
      case 'remove-plant':
        return '花をタップして庭からしまいます';
      default:
        return '指で回して、裏側まで眺められます';
    }
  })();

  return (
    <div className={styles.screen}>
      <div className={styles.scrollArea}>
        <header className={styles.header}>
          <div className={styles.titleBlock}>
            <h1 className={styles.title} ref={titleRef} tabIndex={-1}>
              こもれび植物園
            </h1>
            <p className={styles.count} aria-live="polite">
              観察 {observationCount}件
              {tulipUnlocked ? ' · チューリップ解放済み' : ' · チューリップ未解放'}
            </p>
          </div>
          <div className={styles.headerActions}>
            <button type="button" className={styles.headerBtn} onClick={onObservations}>
              観察記録
            </button>
            <button type="button" className={styles.headerBtn} onClick={onCredits}>
              クレジット
            </button>
          </div>
        </header>

        <Garden3DCanvas
          soilTiles={state.soilTiles}
          plants={state.plants}
          editMode={editMode}
          selectedTileId={selectedTileId}
          selectedPlantId={selectedPlantId}
          plantColor={plantColor}
          addablePositions={addablePositions}
          tulipUnlocked={tulipUnlocked}
          onTileClick={handleTileClick}
          onGhostTileClick={handleGhostTileClick}
          onPlantClick={handlePlantClick}
        />

        <p className={styles.editHint} role="status">{editHint}</p>

        <div className={styles.modeRow} role="group" aria-label="庭の編集モード">
          {EDIT_MODES.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              className={`${styles.modeBtn} ${editMode === mode ? styles.modeActive : ''}`}
              onClick={() => handleModeChange(mode)}
              aria-pressed={editMode === mode}
            >
              {label}
            </button>
          ))}
        </div>

        {editMode === 'plant' && tulipUnlocked && (
          <section className={styles.colorSection} aria-label="チューリップの色">
            <p className={styles.colorLabel}>植える色</p>
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

        {state.stashedPlants.length > 0 && (
          <section className={styles.stashSection}>
            <h2 className={styles.stashTitle}>しまった花 ({state.stashedPlants.length})</h2>
            <div className={styles.stashRow}>
              {state.stashedPlants.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  className={`${styles.stashChip} ${selectedStashPlantId === p.id ? styles.stashSelected : ''}`}
                  onClick={() => {
                    setSelectedStashPlantId(p.id);
                    setEditMode('plant');
                  }}
                >
                  {TULIP_COLORS.find((c) => c.id === p.color)?.label ?? p.color}
                </button>
              ))}
            </div>
            <p className={styles.stashHint}>選んでから「植える」モードで土をタップ</p>
          </section>
        )}
      </div>

      <div className={styles.bottomBar}>
        <Button fullWidth onClick={onDiscover}>
          植物を見つけた
        </Button>
      </div>
    </div>
  );
}
