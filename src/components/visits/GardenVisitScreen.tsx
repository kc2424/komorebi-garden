import { useEffect, useMemo, useState } from 'react';
import { getFlowerCatalogEntry, getPlantDisplayName } from '../../data/flowerCatalog';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import type { GardenPlant } from '../../types';
import type { GardenVisit } from '../../utils/gardenInvite';
import { resolvePlantModelType } from '../../utils/plantModel';
import { Garden3DCanvas } from '../garden3d/Garden3DCanvas';
import styles from './Visits.module.css';

interface GardenVisitScreenProps {
  visit: GardenVisit;
  onBack: () => void;
  onGoGarden: () => void;
}

export function GardenVisitScreen({ visit, onBack, onGoGarden }: GardenVisitScreenProps) {
  const titleRef = useScreenFocus(['garden-visit']);
  const [selectedPlantId, setSelectedPlantId] = useState<string | null>(null);
  const [cameraResetKey, setCameraResetKey] = useState(0);
  const selectedPlant = useMemo(
    () => visit.plants.find((plant) => plant.id === selectedPlantId) ?? null,
    [selectedPlantId, visit.plants],
  );

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (selectedPlantId) setSelectedPlantId(null);
      else onBack();
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [onBack, selectedPlantId]);

  const showPlant = (plantId: string) => {
    setSelectedPlantId(plantId);
  };

  const resetCamera = () => {
    setSelectedPlantId(null);
    setCameraResetKey((value) => value + 1);
  };

  return (
    <div className={styles.visitScreen}>
      <div className={styles.visitScene}>
        <Garden3DCanvas
          soilTiles={visit.soilTiles}
          plants={visit.plants}
          decorations={visit.decorations}
          gardenPhase="viewing"
          editMode="view"
          selectedTileId={null}
          selectedPlantId={null}
          selectedDecorationId={null}
          focusPlantId={selectedPlantId}
          highlightPlantId={selectedPlantId}
          plantColor="red"
          addablePositions={[]}
          tulipUnlocked
          memoryPanelOpen={Boolean(selectedPlant)}
          cameraResetKey={cameraResetKey}
          bottomInsetPx={selectedPlant ? 190 : 108}
          skyPeriod="day"
          skyCloudMotionEnabled
          skyTransitionsEnabled={false}
          onTileClick={() => undefined}
          onGhostTileClick={() => undefined}
          onPlantClick={showPlant}
          onDecorationClick={() => undefined}
        />
      </div>

      <div className={styles.visitOverlay}>
        <header className={styles.visitHeader}>
          <button type="button" className={styles.translucentButton} onClick={onBack}>← 戻る</button>
          <div className={styles.visitTitleBlock}>
            <span>{visit.source === 'sample' ? '見本の庭へ訪問中' : '招待状の庭へ訪問中'}</span>
            <h1 ref={titleRef} tabIndex={-1}>{visit.title}</h1>
            <p>{visit.author}</p>
          </div>
          <button type="button" className={styles.homeButton} onClick={resetCamera}>
            <svg viewBox="0 0 24 24" aria-hidden="true">
              <path d="M8 3H3v5m13-5h5v5M3 16v5h5m13-5v5h-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
              <path d="m12 7 6 5-6 5-6-5Z" fill="none" stroke="currentColor" strokeWidth="1.5" />
            </svg>
            庭全体を見る
          </button>
        </header>

        <div className={styles.visitSpacer} />

        {selectedPlant && (
          <PlantCard plant={selectedPlant} onClose={() => setSelectedPlantId(null)} />
        )}

        <footer className={styles.visitFooter}>
          <span className={styles.visitorBadge}>見るだけの訪問</span>
          <button type="button" onClick={onGoGarden}>自分の庭へ</button>
        </footer>
      </div>
    </div>
  );
}

function PlantCard({ plant, onClose }: { plant: GardenPlant; onClose: () => void }) {
  const modelType = resolvePlantModelType(plant);
  const catalog = getFlowerCatalogEntry(modelType);
  return (
    <section className={styles.plantCard} aria-label="植物の紹介">
      <div>
        <p className={styles.plantLabel}>この植物</p>
        <h2>{getPlantDisplayName(plant)}</h2>
        <p className={styles.scientificName}>{catalog.scientificName}</p>
        <p>{catalog.description}</p>
      </div>
      <button type="button" aria-label="植物の紹介を閉じる" onClick={onClose}>×</button>
    </section>
  );
}
