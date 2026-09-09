import type { GardenStore } from '../../hooks/useGardenStore';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import { Button } from '../ui/Button';
import { ScreenFrame } from '../ui/ScreenFrame';
import styles from './ObservationsScreen.module.css';

interface ObservationsScreenProps {
  store: GardenStore;
  onBack: () => void;
  onDiscover: () => void;
  onSelect: (observationId: string) => void;
}

export function ObservationsScreen({ store, onBack, onDiscover, onSelect }: ObservationsScreenProps) {
  const { state } = store;
  const titleRef = useScreenFocus(['observations']);
  const sorted = [...state.observations].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
  );

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('ja-JP', {
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  const monthGroups: { label: string; items: typeof sorted }[] = [];
  for (const obs of sorted) {
    let monthLabel: string;
    try {
      monthLabel = new Date(obs.takenAt).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
      });
    } catch {
      monthLabel = '';
    }
    const last = monthGroups[monthGroups.length - 1];
    if (last && last.label === monthLabel) {
      last.items.push(obs);
    } else {
      monthGroups.push({ label: monthLabel, items: [obs] });
    }
  }

  return (
    <ScreenFrame title="記録" titleRef={titleRef} onBack={onBack} tone="journal">
      {state.legacyV1 && (
        <p className={styles.legacyNote}>
          2D体験版の記録 {state.legacyV1.observations.length}件を引き継ぎ済みです。
        </p>
      )}

      {sorted.length === 0 ? (
        <div className={styles.empty}>
          <p className={styles.emptyText}>まだ記録がありません。</p>
          <Button onClick={onDiscover}>最初の花を記録する</Button>
        </div>
      ) : (
        monthGroups.map((group) => (
          <section key={group.label} className={styles.monthSection} aria-label={group.label}>
            <h2 className={styles.monthHeading}>{group.label}</h2>
            <ul className={styles.grid}>
              {group.items.map((obs) => (
                <li key={obs.id}>
                  <button type="button" className={styles.entry} onClick={() => onSelect(obs.id)}>
                    <img src={obs.imageDataUrl} alt="" className={styles.thumb} />
                    <span className={styles.name}>{obs.commonNameJa}</span>
                    <span className={styles.date}>{formatDate(obs.takenAt)}</span>
                    {obs.isSample && (
                      <span className={styles.sampleLabel}>サンプル</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))
      )}
    </ScreenFrame>
  );
}
