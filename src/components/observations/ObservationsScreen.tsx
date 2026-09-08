import type { GardenStore } from '../../hooks/useGardenStore';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import { TULIP_COLORS } from '../../data/tulip';
import styles from './ObservationsScreen.module.css';

interface ObservationsScreenProps {
  store: GardenStore;
  onBack: () => void;
  onSelect: (observationId: string) => void;
}

export function ObservationsScreen({ store, onBack, onSelect }: ObservationsScreenProps) {
  const { state } = store;
  const titleRef = useScreenFocus(['observations']);
  const sorted = [...state.observations].sort(
    (a, b) => new Date(b.takenAt).getTime() - new Date(a.takenAt).getTime(),
  );

  const formatDate = (iso: string) => {
    try {
      return new Date(iso).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      });
    } catch {
      return iso;
    }
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">
          ← 戻る
        </button>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>観察記録</h1>
      </header>

      {state.legacyV1 && (
        <p className={styles.legacyNote}>
          2D体験版の記録 {state.legacyV1.observations.length}件を引き継ぎ済みです。
        </p>
      )}

      {sorted.length === 0 ? (
        <p className={styles.empty}>まだ観察がありません。「植物を見つけた」から始めましょう。</p>
      ) : (
        <ul className={styles.list}>
          {sorted.map((obs) => (
            <li key={obs.id}>
              <button type="button" className={styles.card} onClick={() => onSelect(obs.id)}>
                <img src={obs.imageDataUrl} alt="" className={styles.thumb} />
                <div className={styles.meta}>
                  <span className={styles.name}>{obs.commonNameJa}</span>
                  <span className={styles.date}>{formatDate(obs.takenAt)}</span>
                  <span className={styles.tags}>
                    {obs.plantType === 'tulip' ? 'チューリップ' : '観察のみ'}
                    {obs.color && (
                      <span className={styles.colorTag}>
                        {TULIP_COLORS.find((c) => c.id === obs.color)?.label}
                      </span>
                    )}
                    {obs.isSample && <span className={styles.sampleTag}>サンプル</span>}
                  </span>
                </div>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
