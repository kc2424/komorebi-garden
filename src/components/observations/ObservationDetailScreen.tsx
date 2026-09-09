import { useState } from 'react';
import type { GardenStore } from '../../hooks/useGardenStore';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import { TULIP_COLORS } from '../../data/tulip';
import { Button } from '../ui/Button';
import { ScreenFrame } from '../ui/ScreenFrame';
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
      <ScreenFrame title="記録" onBack={onBack} tone="journal">
        <p className={styles.notFound}>記録が見つかりません</p>
        <Button onClick={onBack}>戻る</Button>
      </ScreenFrame>
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

  const gardenLabel =
    obs.plantType === 'tulip' ? 'チューリップ（植えられる）' : '観察のみ（庭未対応）';

  const handleSaveMemo = () => {
    const result = updateObservationMemo(observationId, memo);
    setMemoSaved(result.ok);
  };

  return (
    <ScreenFrame title="記録" titleRef={titleRef} onBack={onBack} tone="journal">
      <div className={styles.photoSection}>
        <img src={obs.imageDataUrl} alt={`${obs.commonNameJa}の写真`} className={styles.photo} />
      </div>

      <div className={styles.heroMeta}>
        <h2 className={styles.plantName}>{obs.commonNameJa}</h2>
        <p className={styles.date}>{formatDate(obs.takenAt)}</p>
        {obs.isSample && <p className={styles.sampleNote}>サンプル写真・固定候補</p>}
      </div>

      <section className={styles.memoSection}>
        <h3 className={styles.sectionTitle}>思い出メモ</h3>
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

      <dl className={styles.metaList}>
        {obs.scientificName && (
          <div className={styles.metaRow}>
            <dt>学名</dt>
            <dd>{obs.scientificName}</dd>
          </div>
        )}
        {obs.familyName && (
          <div className={styles.metaRow}>
            <dt>科</dt>
            <dd>{obs.familyName}</dd>
          </div>
        )}
        {obs.color && (
          <div className={styles.metaRow}>
            <dt>色</dt>
            <dd>{TULIP_COLORS.find((c) => c.id === obs.color)?.label}</dd>
          </div>
        )}
        <div className={styles.metaRow}>
          <dt>識別方法</dt>
          <dd>{sourceLabel}</dd>
        </div>
        <div className={styles.metaRow}>
          <dt>庭への反映</dt>
          <dd>{gardenLabel}</dd>
        </div>
      </dl>
    </ScreenFrame>
  );
}
