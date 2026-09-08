import { useState } from 'react';
import type { GardenStore } from '../../hooks/useGardenStore';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import { TULIP_COLORS } from '../../data/tulip';
import { Button } from '../ui/Button';
import styles from './ObservationDetailScreen.module.css';

interface ObservationDetailScreenProps {
  store: GardenStore;
  observationId: string;
  onBack: () => void;
}

export function ObservationDetailScreen({
  store,
  observationId,
  onBack,
}: ObservationDetailScreenProps) {
  const { state, updateObservationMemo } = store;
  const obs = state.observations.find((o) => o.id === observationId);
  const titleRef = useScreenFocus(['observation-detail', observationId]);
  const [memo, setMemo] = useState(obs?.memo ?? '');
  const [memoSaved, setMemoSaved] = useState(false);

  if (!obs) {
    return (
      <div className={styles.screen}>
        <p>観察が見つかりません</p>
        <Button onClick={onBack}>戻る</Button>
      </div>
    );
  }

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

  const sourceLabel = {
    sample: 'サンプル（体験用）',
    plantnet: 'Pl@ntNet API',
    manual: '手動選択',
  }[obs.identificationSource];

  const handleSaveMemo = () => {
    const result = updateObservationMemo(observationId, memo);
    setMemoSaved(result.ok);
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">
          ← 戻る
        </button>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>
          {obs.commonNameJa}
        </h1>
      </header>

      <div className={styles.photoSection}>
        <img src={obs.imageDataUrl} alt={`${obs.commonNameJa}の写真`} className={styles.photo} />
      </div>

      <dl className={styles.stats}>
        <div className={styles.stat}>
          <dt>観察日</dt>
          <dd>{formatDate(obs.takenAt)}</dd>
        </div>
        {obs.scientificName && (
          <div className={styles.stat}>
            <dt>学名</dt>
            <dd>{obs.scientificName}</dd>
          </div>
        )}
        {obs.familyName && (
          <div className={styles.stat}>
            <dt>科</dt>
            <dd>{obs.familyName}</dd>
          </div>
        )}
        {obs.color && (
          <div className={styles.stat}>
            <dt>色</dt>
            <dd>{TULIP_COLORS.find((c) => c.id === obs.color)?.label}</dd>
          </div>
        )}
        <div className={styles.stat}>
          <dt>識別方法</dt>
          <dd>{sourceLabel}</dd>
        </div>
        <div className={styles.stat}>
          <dt>庭への反映</dt>
          <dd>{obs.plantType === 'tulip' ? 'チューリップ（植えられる）' : '観察のみ'}</dd>
        </div>
      </dl>

      <section className={styles.memoSection}>
        <h2 className={styles.sectionTitle}>思い出メモ</h2>
        <textarea
          className={styles.memoInput}
          value={memo}
          onChange={(e) => {
            setMemo(e.target.value);
            setMemoSaved(false);
          }}
          placeholder="この植物との思い出を書き留めましょう"
          rows={3}
          aria-label="思い出メモ"
        />
        <Button variant="secondary" onClick={handleSaveMemo}>メモを保存</Button>
        {memoSaved && <p className={styles.savedNote} role="status">保存しました</p>}
      </section>
    </div>
  );
}
