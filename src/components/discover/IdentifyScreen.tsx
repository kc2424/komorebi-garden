import { useEffect, useState } from 'react';
import type { DiscoveryDraft, IdentificationCandidate, TulipColor } from '../../types';
import { TULIP_COLORS, defaultTulipColor } from '../../data/tulip';
import { getSamplePhoto } from '../../data/sampleIdentification';
import { identifyPlantImage } from '../../services/identification';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import { ScreenFrame } from '../ui/ScreenFrame';
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

function pendingProvenanceLabel(isSample: boolean): string {
  return isSample ? 'サンプル写真・固定候補' : '写真から候補を確認しています';
}

function provenanceLabel(
  status: 'sample' | 'plantnet' | 'manual' | 'not-configured' | 'error',
): string {
  switch (status) {
    case 'sample':
      return 'サンプル写真・固定候補';
    case 'plantnet':
      return 'Pl@ntNet の候補';
    case 'not-configured':
      return 'API未設定 — 手動で選んで保存できます';
    case 'error':
      return '識別に失敗 — 手動で選んで保存できます';
    default:
      return '手動で選んで保存';
  }
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
  const showErrorBanner = identStatus === 'error' && statusMessage;

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
        setStatusMessage(null);
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
        setStatusMessage(null);
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

  const footer = (
    <Button
      fullWidth
      onClick={handleSave}
      loading={submitting}
      disabled={submitting || loading || !selected}
    >
      記録を残す
    </Button>
  );

  return (
    <ScreenFrame title="写真を確認" onBack={onBack} footer={footer} tone="discovery">
      {showErrorBanner && (
        <Banner variant="error" message={statusMessage!} />
      )}

      <div className={styles.photoPreview}>
        <img src={draft.imageDataUrl} alt="選択した植物の写真" className={styles.photo} />
      </div>

      <p className={styles.provenance}>
        {loading ? pendingProvenanceLabel(isSample) : provenanceLabel(identStatus)}
      </p>
      {identStatus === 'not-configured' && statusMessage && (
        <p className={styles.provenanceDetail}>{statusMessage}</p>
      )}

      {loading ? (
        <p className={styles.loadingText} role="status">候補を読み込み中…</p>
      ) : (
        <>
          <section aria-labelledby="candidates-heading">
            <h2 id="candidates-heading" className={styles.sectionTitle}>候補を確認</h2>
            {identStatus === 'plantnet' && (
              <p className={styles.hint}>
                スコア順ですが必ずしも正しくありません。写真と合う名前を選んでください。
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
                    <span className={styles.candidateMain}>
                      <span className={styles.candidateName}>{c.commonNameJa}</span>
                      {selectedIndex === i && (
                        <span className={styles.candidateMark} aria-hidden="true">✓</span>
                      )}
                    </span>
                    {(c.scientificName || c.familyName) && (
                      <span className={styles.candidateMeta}>
                        {[c.scientificName, c.familyName].filter(Boolean).join(' · ')}
                      </span>
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

          {selected && (
            <section className={styles.traitSection} aria-labelledby="trait-heading">
              <h2 id="trait-heading" className={styles.sectionTitle}>特徴</h2>
              <p className={styles.trait}>{selected.trait}</p>
            </section>
          )}

          {isTulip && (
            <section className={styles.colorSection} aria-labelledby="color-heading">
              <h2 id="color-heading" className={styles.sectionTitle}>チューリップの色</h2>
              <p className={styles.hint}>見た色を選んでください。</p>
              <div className={styles.colorRow} role="group" aria-label="チューリップの色">
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

          <section className={styles.nameSection}>
            <label className={styles.nameLabel} htmlFor="custom-name">
              名前（任意）
            </label>
            <input
              id="custom-name"
              className={styles.nameInput}
              value={customName}
              onChange={(e) => setCustomName(e.target.value)}
              placeholder={selected?.commonNameJa ?? '植物名'}
            />
          </section>
        </>
      )}
    </ScreenFrame>
  );
}

export { provenanceLabel };
