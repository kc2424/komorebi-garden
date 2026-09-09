import type { PlantObservation, RegistrationResult } from '../../types';
import { Button } from '../ui/Button';
import { ScreenFrame } from '../ui/ScreenFrame';
import styles from './CompleteScreen.module.css';

interface CompleteScreenProps {
  result: RegistrationResult;
  observation: PlantObservation;
  onGoGarden: () => void;
  onViewRecord: () => void;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

export function CompleteScreen({
  result,
  observation,
  onGoGarden,
  onViewRecord,
}: CompleteScreenProps) {
  const isNew = result.type === 'new';

  const statusMessage = (() => {
    if (result.plantType === 'tulip') {
      if (result.tulipUnlocked) {
        return isNew
          ? 'チューリップが庭に植えられるようになりました。庭で植えてみましょう。'
          : '新しい観察が追加されました。庭の本数とは別に記録されます。';
      }
      return 'チューリップの記録を保存しました。';
    }
    return 'この植物は庭には植えられませんが、記録として残ります。';
  })();

  const footer = (
    <>
      <Button fullWidth onClick={onGoGarden}>
        庭を見る
      </Button>
      <Button variant="secondary" fullWidth onClick={onViewRecord}>
        記録を見る
      </Button>
    </>
  );

  return (
    <ScreenFrame title="記録しました" footer={footer} tone="discovery">
      <div className={styles.content} role="status" aria-live="polite">
        <div className={styles.photoWrap}>
          <img
            src={observation.imageDataUrl}
            alt={`${observation.commonNameJa}の写真`}
            className={styles.photo}
          />
        </div>

        <p className={styles.name}>{observation.commonNameJa}</p>
        <p className={styles.date}>{formatDate(observation.takenAt)}</p>

        {observation.isSample && (
          <p className={styles.sampleLabel}>サンプル写真・固定候補</p>
        )}

        <p className={styles.message}>{statusMessage}</p>
      </div>
    </ScreenFrame>
  );
}
