import { useState } from 'react';
import type { GardenModelType, GardenPlant, TulipColor } from '../../types';
import { FLOWER_CATALOG, getFlowerCatalogEntry, getPlantDisplayName, getPlantThumbnailUrl } from '../../data/flowerCatalog';
import styles from './FlowerCatalogSheet.module.css';

interface FlowerCatalogSheetProps {
  expanded: boolean;
  selectedModelType: GardenModelType | null;
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

function searchableName(value: string): string {
  return value.normalize('NFKC').toLocaleLowerCase('ja-JP').replace(/[ァ-ヶ]/g, (letter) =>
    String.fromCharCode(letter.charCodeAt(0) - 0x60));
}

export function FlowerCatalogSheet({
  expanded,
  selectedModelType,
  displayModelType,
  displayColor,
  plantColor,
  stashedPlants = [],
  selectedStashPlantId = null,
  onSelect,
  onSelectStash,
  onReselect,
}: FlowerCatalogSheetProps) {
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<'all' | 'flower' | 'foliage' | 'tree'>('all');

  if (!expanded && displayModelType) {
    const selected = getFlowerCatalogEntry(displayModelType);
    const collapsedLabel = selectedStashPlantId
      ? getPlantDisplayName(stashedPlants.find((plant) => plant.id === selectedStashPlantId)
          ?? { modelType: displayModelType, color: displayColor })
      : selected.commonNameJa;
    return (
      <button type="button" className={styles.collapsedCard} onClick={onReselect} aria-label={`${collapsedLabel}、花を選び直す`}>
        <img src={getPlantThumbnailUrl(displayModelType, displayColor)} alt="" className={styles.collapsedPreviewFrame} />
        <span className={styles.collapsedName}>{collapsedLabel}</span>
        <span className={styles.collapsedAction}>選び直す</span>
      </button>
    );
  }

  const search = searchableName(query.trim());
  const entries = FLOWER_CATALOG.filter((entry) =>
    (category === 'all' || entry.category === category)
    && (!search || searchableName(`${entry.commonNameJa} ${entry.scientificName} ${entry.description}`).includes(search)));

  return (
    <section className={styles.sheet} aria-label="植物を選ぶ">
      <div className={styles.searchRow}>
        <input type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="植物を探す" aria-label="植物を探す" className={styles.searchInput} />
        <span className={styles.resultCount} aria-live="polite">{entries.length}種類</span>
      </div>
      <div className={styles.filters} role="group" aria-label="植物の種類">
        {([['all', 'すべて'], ['flower', '花'], ['foliage', '葉もの'], ['tree', '木']] as const).map(([value, label]) => (
          <button key={value} type="button" aria-pressed={category === value} onClick={() => setCategory(value)}>{label}</button>
        ))}
      </div>
      <div className={styles.cardGrid}>
        {entries.map((entry) => (
          <button key={entry.modelType} type="button" className={`${styles.card} ${selectedModelType === entry.modelType ? styles.cardSelected : ''}`} onClick={() => onSelect(entry.modelType)} aria-pressed={selectedModelType === entry.modelType} aria-label={entry.commonNameJa}>
            <img src={getPlantThumbnailUrl(entry.modelType, plantColor)} alt="" className={styles.previewFrame} loading="lazy" />
            <span className={styles.cardName}>{entry.commonNameJa}</span>
          </button>
        ))}
      </div>
      {entries.length === 0 && <p className={styles.emptyResult}>見つかりませんでした。別の名前で探してみてください。</p>}
      {stashedPlants.length > 0 && (
        <details className={styles.stashDisclosure}>
          <summary className={styles.stashSummary}>しまった花 ({stashedPlants.length})</summary>
          <div className={styles.stashRow}>
            {stashedPlants.map((plant) => (
              <button key={plant.id} type="button" className={`${styles.stashChip} ${selectedStashPlantId === plant.id ? styles.stashSelected : ''}`} onClick={() => onSelectStash?.(plant.id)} aria-pressed={selectedStashPlantId === plant.id} aria-label={`しまった花: ${getPlantDisplayName(plant)}`}>
                {getPlantDisplayName(plant)}
              </button>
            ))}
          </div>
        </details>
      )}
    </section>
  );
}
