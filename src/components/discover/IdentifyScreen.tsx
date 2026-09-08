import { useEffect, useState } from 'react';
import type { DiscoveryDraft, IdentificationCandidate, TulipColor } from '../../types';
import { TULIP_COLORS, defaultTulipColor } from '../../data/tulip';
import { getSamplePhoto } from '../../data/sampleIdentification';
import { identifyPlantImage } from '../../services/identification';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import styles from './IdentifyScreen.module.css';

interface IdentifyScreenProps {
  draft: DiscoveryDraft;
  onBack: () => void;
  onSave: (input: {
    plantType: 'tulip' | 'other';
    commonNameJa: string;
    scientificName: string;
    familyName: string;
    color: TulipColor | null;
    isSample: boolean;
    identificationSource: 'sample' | 'plantnet' | 'manual';
  }) => boolean;
}

export function IdentifyScreen({ draft, onBack, onSave }: IdentifyScreenProps) {
  const [loading, setLoading] = useState(true);
  const [candidates, setCandidates] = useState<IdentificationCandidate[]>([]);
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [identStatus, setIdentStatus] = useState<'sample' | 'plantnet' | 'manual' | 'not-configured' | 'error'>('manual');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const [providerCandidateCount, setProviderCandidateCount] = useState(0);
  const [color, setColor] = useState<TulipColor>(defaultTulipColor());
  const [customName, setCustomName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const isSample = draft.source === 'sample';
  const selected = candidates[selectedIndex];
  const isTulip = selected?.plantType === 'tulip';

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const result = await identifyPlantImage(draft.imageDataUrl, draft.source, draft.sampleKey);
      if (cancelled) return;

      if (isSample) {
        const sample = draft.sampleKey ? getSamplePhoto(draft.sampleKey) : undefined;
        setCandidates(sample?.candidates ?? result.candidates);
        setIdentStatus('sample');
        setProviderCandidateCount(0);
        setSelectedIndex(0);
        setStatusMessage('体験用サンプル：判定結果は固定候補です。');
      } else if (result.status === 'not-configured') {
        setCandidates(result.candidates);
        setIdentStatus('not-configured');
        setProviderCandidateCount(0);
        setSelectedIndex(0);
        setStatusMessage(result.message ?? 'API未設定');
      } else if (result.status === 'error') {
        setCandidates(result.candidates);
        setIdentStatus('error');
        setProviderCandidateCount(0);
        setSelectedIndex(0);
        setStatusMessage(result.message ?? '識別に失敗しました');
      } else {
        const providerCount = result.candidates.filter((c) => !c.isUnknownOption).length;
        setCandidates(result.candidates);
        setIdentStatus('plantnet');
        setProviderCandidateCount(providerCount);
        setSelectedIndex(0);
        setStatusMessage('Pl@ntNet API による識別候補です。必ず確認してください。');
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [draft, isSample]);

  const handleSave = () => {
    if (!selected || submitting) return;
    setSubmitting(true);
    const commonNameJa = customName.trim() || selected.commonNameJa;
    const isProviderPick =
      identStatus === 'plantnet' &&
      !selected.isUnknownOption &&
      selectedIndex < providerCandidateCount;
    const saved = onSave({
      plantType: selected.plantType,
      commonNameJa,
      scientificName: selected.scientificName,
      familyName: selected.familyName,
      color: selected.plantType === 'tulip' ? color : null,
      isSample,
      identificationSource: isSample ? 'sample' : isProviderPick ? 'plantnet' : 'manual',
    });
    if (!saved) setSubmitting(false);
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">
          ← 戻る
        </button>
        <h1 className={styles.title}>確認して保存</h1>
      </header>

      {identStatus === 'sample' && (
        <Banner variant="sample" message="体験版：サンプル写真の固定候補です。実際のAI識別ではありません。" />
      )}
      {identStatus === 'not-configured' && statusMessage && (
        <Banner variant="sample" message={statusMessage} />
      )}
      {identStatus === 'error' && statusMessage && (
        <Banner variant="error" message={statusMessage} />
      )}
      {identStatus === 'plantnet' && statusMessage && (
        <Banner variant="sample" message={statusMessage} />
      )}
      {(identStatus === 'error' || identStatus === 'not-configured') && (
        <Banner variant="sample" message="API候補はありません。不明として保存するか、手動で選んでください。" />
      )}

      <div className={styles.photoPreview}>
        <img src={draft.imageDataUrl} alt="選択した植物の写真" className={styles.photo} />
      </div>

      {loading ? (
        <p className={styles.loadingText} role="status">識別候補を取得中…</p>
      ) : (
        <>
          <section aria-labelledby="candidates-heading">
            <h2 id="candidates-heading" className={styles.sectionTitle}>植物名の候補</h2>
            <p className={styles.hint}>当てはまるものを選んでください。チューリップ以外は観察のみ保存されます。</p>
            {identStatus === 'plantnet' && (
              <p className={styles.hint}>
                候補スコアが高い順に並んでいますが、上位だから正しいとは限りません。写真と合う名前を選んで保存してください。
              </p>
            )}

            <ul className={styles.candidateList} role="radiogroup" aria-label="植物名の候補">
              {candidates.map((c, i) => (
                <li key={`${c.scientificName}-${i}`}>
                  <button
                    type="button"
                    className={`${styles.candidate} ${selectedIndex === i ? styles.candidateSelected : ''}`}
                    onClick={() => setSelectedIndex(i)}
                    role="radio"
                    aria-checked={selectedIndex === i}
                  >
                    <span className={styles.candidateName}>
                      {c.commonNameJa}
                      {c.plantType === 'tulip' ? '（庭に植えられる）' : ''}
                    </span>
                    {c.scientificName && (
                      <span className={styles.candidateSci}>{c.scientificName}</span>
                    )}
                    {c.familyName && (
                      <span className={styles.candidateFamily}>{c.familyName}</span>
                    )}
                    {c.score !== undefined && (
                      <span className={styles.candidateScore}>
                        候補スコア {c.score.toFixed(2)}
                      </span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </section>

          <section className={styles.manualSection}>
            <label className={styles.manualLabel} htmlFor="custom-name">
              名前を変更（任意）
            </label>
            <input
              id="custom-name"
              className={styles.manualInput}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={selected?.commonNameJa ?? '植物名'}
            />
          </section>

          {selected && (
            <section className={styles.traitSection} aria-labelledby="trait-heading">
              <h2 id="trait-heading" className={styles.sectionTitle}>特徴</h2>
              <p className={styles.trait}>{selected.trait}</p>
            </section>
          )}

          {isTulip && (
            <section className={styles.colorSection} aria-labelledby="color-heading">
              <h2 id="color-heading" className={styles.sectionTitle}>チューリップの色</h2>
              <p className={styles.hint}>色は自動判定しません。見た色を選んでください。</p>
              <div className={styles.colorRow}>
                {TULIP_COLORS.map((c) => (
                  <button
                    key={c.id}
                    type="button"
                    className={`${styles.colorSwatch} ${color === c.id ? styles.colorSelected : ''}`}
                    style={{ backgroundColor: c.hex }}
                    onClick={() => setColor(c.id)}
                    aria-label={c.label}
                    aria-pressed={color === c.id}
                  />
                ))}
              </div>
            </section>
          )}
        </>
      )}

      <div className={styles.actions}>
        <Button
          fullWidth
          onClick={handleSave}
          loading={submitting}
          disabled={submitting || loading || !selected}
        >
          観察として保存
        </Button>
        <Button variant="ghost" fullWidth onClick={onBack} disabled={submitting}>
          キャンセル
        </Button>
      </div>
    </div>
  );
}
