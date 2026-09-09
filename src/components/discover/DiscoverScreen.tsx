import { useId, useRef, useState } from 'react';
import { SAMPLE_PHOTOS } from '../../data/sampleIdentification';
import { compressImage, loadImageFromUrl } from '../../storage/persistence';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import type { DiscoveryDraft } from '../../types';
import { Banner } from '../ui/Banner';
import { ScreenFrame } from '../ui/ScreenFrame';
import styles from './DiscoverScreen.module.css';

interface DiscoverScreenProps {
  onBack: () => void;
  onContinue: (draft: DiscoveryDraft) => void;
}

function CameraIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIcon}>
      <path
        d="M4 7h4l2-3h4l2 3h4v12H4V7z"
        stroke="currentColor"
        strokeWidth="1.5"
        fill="none"
        strokeLinejoin="round"
      />
      <circle cx="12" cy="13" r="3.2" stroke="currentColor" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

function LibraryIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className={styles.actionIcon}>
      <rect x="4" y="5" width="16" height="14" rx="2" stroke="currentColor" strokeWidth="1.5" fill="none" />
      <circle cx="9" cy="10" r="1.5" fill="currentColor" />
      <path d="M4 16l4-4 3 3 5-6 4 5" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function DiscoverScreen({ onBack, onContinue }: DiscoverScreenProps) {
  const cameraId = useId();
  const fileId = useId();
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const inFlightRef = useRef(false);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const titleRef = useScreenFocus(['discover']);

  const handleFile = async (file: File | undefined, input: HTMLInputElement | null) => {
    if (!file || inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const dataUrl = await compressImage(file);
      onContinue({ imageDataUrl: dataUrl, source: 'file' });
    } catch (e) {
      setError(e instanceof Error ? e.message : '画像の読み込みに失敗しました');
    } finally {
      if (input) input.value = '';
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  const handleSample = async (key: string, imagePath: string) => {
    if (inFlightRef.current) return;
    inFlightRef.current = true;
    setError(null);
    setLoading(true);
    try {
      const dataUrl = await loadImageFromUrl(imagePath);
      onContinue({ imageDataUrl: dataUrl, source: 'sample', sampleKey: key });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'サンプル画像の読み込みに失敗しました');
    } finally {
      inFlightRef.current = false;
      setLoading(false);
    }
  };

  return (
    <ScreenFrame title="花を記録" titleRef={titleRef} onBack={onBack} tone="discovery">
      <p className={styles.intro}>今日出会った花を、庭の思い出に。</p>

      <input
        ref={cameraRef}
        id={cameraId}
        type="file"
        accept="image/*"
        capture="environment"
        className={styles.hiddenInput}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => handleFile(e.target.files?.[0], e.target)}
      />
      <input
        ref={fileRef}
        id={fileId}
        type="file"
        accept="image/*"
        className={styles.hiddenInput}
        tabIndex={-1}
        aria-hidden="true"
        onChange={(e) => handleFile(e.target.files?.[0], e.target)}
      />

      <div className={styles.sourceCards}>
        <button
          type="button"
          className={styles.sourceCard}
          onClick={() => cameraRef.current?.click()}
          disabled={loading}
          aria-busy={loading || undefined}
        >
          <span className={`${styles.sourceIconFace} ${styles.sourceIconCamera}`}>
            <CameraIcon />
          </span>
          <span className={styles.sourceText}>
            <span className={styles.sourceLabel}>カメラで撮影</span>
            {loading && <span className={styles.sourceStatus}>処理中…</span>}
          </span>
        </button>
        <button
          type="button"
          className={styles.sourceCard}
          onClick={() => fileRef.current?.click()}
          disabled={loading}
          aria-busy={loading || undefined}
        >
          <span className={`${styles.sourceIconFace} ${styles.sourceIconLibrary}`}>
            <LibraryIcon />
          </span>
          <span className={styles.sourceText}>
            <span className={styles.sourceLabel}>写真を選ぶ</span>
            {loading && <span className={styles.sourceStatus}>処理中…</span>}
          </span>
        </button>
      </div>

      <section className={styles.sampleSection} aria-labelledby="sample-heading">
        <h2 id="sample-heading" className={styles.sampleHeading}>サンプルで試す</h2>
        <p className={styles.sampleHint}>サンプル写真・固定候補</p>
        <ul className={styles.sampleGrid}>
          {SAMPLE_PHOTOS.map((sample) => (
            <li key={sample.key}>
              <button
                type="button"
                className={styles.sampleCard}
                onClick={() => handleSample(sample.key, sample.imagePath)}
                disabled={loading}
                aria-label={sample.label}
              >
                <div className={styles.samplePhotoFrame}>
                  <img
                    src={sample.imagePath}
                    alt=""
                    className={styles.sampleImg}
                    loading="lazy"
                  />
                </div>
                <span className={styles.sampleLabel}>{sample.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {error && <Banner variant="error" message={error} onDismiss={() => setError(null)} />}
    </ScreenFrame>
  );
}
