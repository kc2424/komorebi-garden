import { useRef } from 'react';
import type { GardenModelType, GardenPlant, TulipColor } from '../../types';
import { FLOWER_CATALOG, getPlantDisplayName, isFlowerPlantable } from '../../data/flowerCatalog';
import {
  PREVIEW_COMPACT_FRAME_HEIGHT,
  PREVIEW_COMPACT_FRAME_WIDTH,
  PREVIEW_FRAME_HEIGHT,
  PREVIEW_FRAME_WIDTH,
} from '../../utils/previewCamera';
import { FlowerPreviewCanvas } from './FlowerPreviewCanvas';
import styles from './FlowerCatalogSheet.module.css';

interface FlowerCatalogSheetProps {
  expanded: boolean;
  selectedModelType: GardenModelType | null;
  /** Effective model for collapsed preview (includes stash restoration). */
  displayModelType: GardenModelType | null;
  displayColor: TulipColor;
  plantColor: TulipColor;
  tulipUnlocked: boolean;
  stashedPlants?: GardenPlant[];
  selectedStashPlantId?: string | null;
  onSelect: (modelType: GardenModelType) => void;
  onSelectStash?: (plantId: string) => void;
  onReselect: () => void;
}

export function FlowerCatalogSheet({
  expanded,
  selectedModelType,
  displayModelType,
  displayColor,
  plantColor,
  tulipUnlocked,
  stashedPlants = [],
  selectedStashPlantId = null,
  onSelect,
  onSelectStash,
  onReselect,
}: FlowerCatalogSheetProps) {
  const tulipRef = useRef<HTMLDivElement>(null);
  const cosmosRef = useRef<HTMLDivElement>(null);
  const pansyRef = useRef<HTMLDivElement>(null);
  const trackRefs: Record<GardenModelType, React.RefObject<HTMLDivElement | null>> = {
    tulip: tulipRef,
    cosmos: cosmosRef,
    pansy: pansyRef,
  };

  const entries = FLOWER_CATALOG.map((entry) => ({
    ...entry,
    trackRef: trackRefs[entry.modelType],
    plantable: isFlowerPlantable(entry.modelType, tulipUnlocked),
  }));

  const previewSlots = entries.map((entry) => ({
    id: entry.modelType,
    modelType: entry.modelType,
    color: entry.modelType === 'tulip' ? plantColor : 'pink',
    trackRef: entry.trackRef,
    frameWidth: PREVIEW_FRAME_WIDTH,
    frameHeight: PREVIEW_FRAME_HEIGHT,
  }));

  if (!expanded && displayModelType) {
    const selected = entries.find((e) => e.modelType === displayModelType);
    if (!selected) return null;
    const previewRef = trackRefs[displayModelType];
    const collapsedLabel = selectedStashPlantId
      ? getPlantDisplayName(
          stashedPlants.find((p) => p.id === selectedStashPlantId) ?? {
            modelType: displayModelType,
            color: displayColor,
          },
        )
      : selected.commonNameJa;
    return (
      <>
        <FlowerPreviewCanvas
          slots={[
            {
              id: displayModelType,
              modelType: displayModelType,
              color: displayColor,
              trackRef: previewRef,
              frameWidth: PREVIEW_COMPACT_FRAME_WIDTH,
              frameHeight: PREVIEW_COMPACT_FRAME_HEIGHT,
            },
          ]}
        />
        <div className={styles.collapsed}>
          <button type="button" className={styles.collapsedCard} onClick={onReselect}>
            <div ref={previewRef} className={styles.collapsedPreviewFrame} />
            <div className={styles.collapsedText}>
              <span className={styles.collapsedName}>{collapsedLabel}</span>
              <span className={styles.collapsedAction}>花を選び直す</span>
            </div>
          </button>
        </div>
      </>
    );
  }

  return (
    <>
      <FlowerPreviewCanvas slots={previewSlots} />
      <section className={styles.sheet} aria-label="花を選ぶ">
        <div className={styles.cardGrid}>
          {entries.map((entry) => {
            const isSelected = selectedModelType === entry.modelType;
            const locked = !entry.plantable;
            return (
              <button
                key={entry.modelType}
                type="button"
                className={`${styles.card} ${isSelected ? styles.cardSelected : ''} ${locked ? styles.cardLocked : ''}`}
                onClick={() => !locked && onSelect(entry.modelType)}
                disabled={locked}
                aria-pressed={isSelected}
                aria-label={`${entry.commonNameJa}${locked ? '（未解放）' : ''}`}
              >
                <div ref={entry.trackRef} className={styles.previewFrame} />
                <div className={styles.cardBody}>
                  <span className={styles.cardName}>{entry.commonNameJa}</span>
                  <span className={styles.cardScience}>{entry.scientificName}</span>
                  {entry.isModelPreview && (
                    <span className={styles.cardBadge}>モデル見本</span>
                  )}
                  {locked && (
                    <span className={styles.cardLockNote}>
                      チューリップを観察すると植えられます
                    </span>
                  )}
                </div>
              </button>
            );
          })}
        </div>
        {stashedPlants.length > 0 && (
          <details className={styles.stashDisclosure}>
            <summary className={styles.stashSummary}>
              しまった花 ({stashedPlants.length})
            </summary>
            <div className={styles.stashRow}>
              {stashedPlants.map((plant) => (
                <button
                  key={plant.id}
                  type="button"
                  className={`${styles.stashChip} ${selectedStashPlantId === plant.id ? styles.stashSelected : ''}`}
                  onClick={() => onSelectStash?.(plant.id)}
                  aria-pressed={selectedStashPlantId === plant.id}
                  aria-label={`しまった花: ${getPlantDisplayName(plant)}`}
                >
                  {getPlantDisplayName(plant)}
                </button>
              ))}
            </div>
          </details>
        )}
      </section>
    </>
  );
}
