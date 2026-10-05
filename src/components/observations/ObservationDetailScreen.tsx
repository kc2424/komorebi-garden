import { useState } from 'react';
import { ConfirmModal } from '../ui/ConfirmModal';
import type { GardenStore } from '../../hooks/useGardenStore';
import type { TulipColor } from '../../types';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import { TULIP_COLORS } from '../../data/tulip';
import { Button } from '../ui/Button';
import { Banner } from '../ui/Banner';
import { ScreenFrame } from '../ui/ScreenFrame';
import { localDateInputValue, resolveTakenAtOnSave } from '../../utils/observationDate';
import { canPlantObservationInGarden } from '../../utils/plantObservationLink';
import styles from './ObservationDetailScreen.module.css';

interface ObservationDetailScreenProps {
  store: GardenStore;
  observationId: string;
  onBack: () => void;
  onPlantInGarden?: (observationId: string) => void;
}

export function ObservationDetailScreen({
  store,
  observationId,
  onBack,
  onPlantInGarden,
}: ObservationDetailScreenProps) {
  const { state, updateObservation, deleteObservation } = store;
  const obs = state.observations.find((o) => o.id === observationId);
  const titleRef = useScreenFocus(['observation-detail', observationId]);
  const [displayName, setDisplayName] = useState(obs?.commonNameJa ?? '');
  const [takenAt, setTakenAt] = useState(obs?.takenAt ? localDateInputValue(obs.takenAt) : '');
  const [color, setColor] = useState<TulipColor | null>(obs?.color ?? null);
  const [memo, setMemo] = useState(obs?.memo ?? '');
  const [saved, setSaved] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

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
  const canPlant = canPlantObservationInGarden(
    observationId,
    state.observations,
    state.plants,
    state.stashedPlants,
    state.tulipUnlocked,
  );

  const handleSave = async () => {
    if (submitting) return;
    setSubmitting(true);
    setSaveError(null);
    setSaved(false);
    const result = await updateObservation(observationId, {
      commonNameJa: displayName.trim() || obs.commonNameJa,
      takenAt: resolveTakenAtOnSave(obs.takenAt, takenAt),
      color: obs.plantType === 'tulip' ? color : null,
      memo,
    });
    if (result.ok) {
      setSaved(true);
    } else {
      setSaveError(result.error ?? store.saveError ?? '保存に失敗しました。');
    }
    setSubmitting(false);
  };

  return (
    <ScreenFrame title="記録" titleRef={titleRef} onBack={onBack} tone="journal">
      {saveError && (
        <Banner variant="error" message={saveError} onDismiss={() => setSaveError(null)} />
      )}

      <div className={styles.photoSection}>
        <img src={obs.imageDataUrl} alt={`${obs.commonNameJa}の写真`} className={styles.photo} />
      </div>

      <div className={styles.heroMeta}>
        <h2 className={styles.plantName}>{obs.commonNameJa}</h2>
        <p className={styles.date}>{formatDate(obs.takenAt)}</p>
        {obs.isSample && <p className={styles.sampleNote}>サンプル写真・固定候補</p>}
      </div>

      <section className={styles.memoSection}>
        <label className={styles.sectionTitle} htmlFor="display-name">表示名</label>
        <input
          id="display-name"
          className={styles.memoInput}
          value={displayName}
          onChange={(e) => {
            setDisplayName(e.target.value);
            setSaved(false);
          }}
        />
        <p className={styles.savedNote}>学名・識別履歴は変更されません（{obs.scientificName || '—'}）</p>
      </section>

      <section className={styles.memoSection}>
        <label className={styles.sectionTitle} htmlFor="taken-at">観察日</label>
        <input
          id="taken-at"
          type="date"
          className={styles.memoInput}
          value={takenAt}
          onChange={(e) => {
            setTakenAt(e.target.value);
            setSaved(false);
          }}
        />
      </section>

      {obs.plantType === 'tulip' && (
        <section className={styles.memoSection} aria-label="チューリップの色">
          <h2 className={styles.sectionTitle}>色</h2>
          <div className={styles.colorRow} role="group" aria-label="チューリップの色">
            {TULIP_COLORS.map((c) => (
              <button
                key={c.id}
                type="button"
                className={`${styles.colorSwatch} ${color === c.id ? styles.colorSelected : ''}`}
                style={{ backgroundColor: c.hex }}
                onClick={() => {
                  setColor(c.id);
                  setSaved(false);
                }}
                aria-label={c.label}
                aria-pressed={color === c.id}
              />
            ))}
          </div>
        </section>
      )}

      <section className={styles.memoSection}>
        <h2 className={styles.sectionTitle}>特徴（識別時）</h2>
        <p>{obs.trait || '説明はまだありません'}</p>
      </section>

      <section className={styles.memoSection}>
        <h2 className={styles.sectionTitle}>思い出メモ</h2>
        <textarea
          className={styles.memoInput}
          value={memo}
          onChange={(e) => {
            setMemo(e.target.value);
            setSaved(false);
          }}
          placeholder="この植物との思い出を書き留めましょう"
          rows={3}
          aria-label="思い出メモ"
        />
        <Button variant="secondary" loading={submitting} disabled={submitting} onClick={() => void handleSave()}>
          変更を保存
        </Button>
        {saved && <p className={styles.savedNote} role="status">保存しました</p>}
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

      {canPlant && onPlantInGarden && (
        <section className={styles.memoSection}>
          <Button fullWidth onClick={() => onPlantInGarden(observationId)}>
            この花を庭に植える
          </Button>
        </section>
      )}

      <section className={styles.memoSection}>
        <Button variant="secondary" onClick={() => setConfirmDelete(true)}>観察を削除</Button>
      </section>

      {confirmDelete && (
        <ConfirmModal
          title="観察を削除"
          message="この観察と写真を削除します。庭の花は残ります。"
          confirmLabel="削除する"
          cancelLabel="キャンセル"
          destructive
          onConfirm={() => void deleteObservation(observationId).then(() => onBack())}
          onCancel={() => setConfirmDelete(false)}
        />
      )}
    </ScreenFrame>
  );
}
