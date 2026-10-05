import { useScreenFocus } from '../../hooks/useScreenFocus';
import { Button } from '../ui/Button';
import styles from './OnboardingScreen.module.css';

interface OnboardingScreenProps {
  onDiscover: () => void;
  onViewGarden: () => void;
  onLoginTransfer: () => void;
}

export function OnboardingScreen({ onDiscover, onViewGarden, onLoginTransfer }: OnboardingScreenProps) {
  const titleRef = useScreenFocus(['onboarding']);

  return (
    <div className={styles.screen}>
      <div className={styles.content}>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>こもれび植物園</h1>
        <p className={styles.lead}>
          花を並べて、小径をつないで。<br />あなただけの小さな庭を。
        </p>
        <figure className={styles.example}>
          <img
            src="/samples/expanded-garden-example.png"
            alt="20種類の植物に小径、水辺、ベンチ、段差を組み合わせた庭の作例"
            className={styles.hero}
          />
          <figcaption>庭づくりの作例</figcaption>
        </figure>
        <ol className={styles.steps} aria-label="庭づくりの流れ">
          <li>植物を選ぶ</li>
          <li>小径をつなぐ</li>
          <li>飾って眺める</li>
        </ol>
        <Button fullWidth onClick={onViewGarden}>庭づくりをはじめる</Button>
        <p className={styles.saveNote}>庭はこの端末に自動保存されます</p>
        <div className={styles.secondaryActions}>
          <button type="button" onClick={onDiscover}>植物の写真を記録する</button>
          <button type="button" onClick={onLoginTransfer}>設定と引き継ぎ</button>
        </div>
      </div>
    </div>
  );
}
