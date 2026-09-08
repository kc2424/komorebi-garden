import { useId, useRef, useState } from 'react';
import { SAMPLE_PHOTOS } from '../../data/sampleIdentification';
import { compressImage, loadImageFromUrl } from '../../storage/persistence';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import type { DiscoveryDraft } from '../../types';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import styles from './DiscoverScreen.module.css';

interface DiscoverScreenProps {
  onBack: () => void;
  onContinue: (draft: DiscoveryDraft) => void;
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
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">
          ← 戻る
        </button>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>植物を見つけた</h1>
      </header>

      <Banner variant="sample" message="サンプル写真は固定候補です。自分の写真は識別APIまたは手動確認になります。" />

      <section className={styles.section} aria-labelledby="photo-source-heading">
        <h2 id="photo-source-heading" className={styles.sectionTitle}>写真を選ぶ</h2>

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

        <div className={styles.sourceButtons}>
          <Button
            variant="primary"
            fullWidth
            loading={loading}
            disabled={loading}
            onClick={() => cameraRef.current?.click()}
          >
            カメラで撮影
          </Button>
          <Button
            variant="secondary"
            fullWidth
            loading={loading}
            disabled={loading}
            onClick={() => fileRef.current?.click()}
          >
            写真を選ぶ
          </Button>
        </div>
      </section>

      <section className={styles.section} aria-labelledby="sample-heading">
        <h2 id="sample-heading" className={styles.sectionTitle}>サンプル写真</h2>
        <p className={styles.sectionHint}>端末に写真がなくても体験できます</p>
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
                <img
                  src={sample.imagePath}
                  alt=""
                  className={styles.sampleImg}
                  loading="lazy"
                />
                <span className={styles.sampleLabel}>{sample.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {error && (
        <Banner variant="error" message={error} onDismiss={() => setError(null)} />
      )}
    </div>
  );
}
