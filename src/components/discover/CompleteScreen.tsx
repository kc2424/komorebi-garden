import type { RegistrationResult } from '../../types';
import { Button } from '../ui/Button';
import styles from './CompleteScreen.module.css';

interface CompleteScreenProps {
  result: RegistrationResult;
  onGoGarden: () => void;
}

export function CompleteScreen({ result, onGoGarden }: CompleteScreenProps) {
  const isNew = result.type === 'new';

  return (
    <div className={styles.screen}>
      <div className={styles.content} role="status" aria-live="polite">
        <div className={styles.emoji} aria-hidden="true">
          {result.plantType === 'tulip' ? '🌷' : '🌿'}
        </div>

        <h1 className={styles.heading}>
          {isNew ? '観察を保存しました' : 'また見つけました'}
        </h1>

        <p className={styles.name}>{result.commonNameJa}</p>

        <p className={styles.message}>
          {result.plantType === 'tulip'
            ? result.tulipUnlocked
              ? isNew
                ? 'チューリップが庭に植えられるようになりました。庭で自由に植えてみましょう。'
                : '新しい観察が追加されました。庭の本数とは別に記録されます。'
              : 'チューリップの観察を保存しました。'
            : 'この植物は庭には植えられませんが、観察記録として残ります。'}
        </p>
      </div>

      <div className={styles.actions}>
        <Button fullWidth onClick={onGoGarden}>
          庭を見る
        </Button>
      </div>
    </div>
  );
}
