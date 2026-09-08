import { ASSET_CREDITS } from '../../data/assetCredits';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import styles from './CreditsScreen.module.css';

interface CreditsScreenProps {
  onBack: () => void;
}

export function CreditsScreen({ onBack }: CreditsScreenProps) {
  const titleRef = useScreenFocus(['credits']);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">
          ← 戻る
        </button>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>写真のクレジット</h1>
      </header>

      <p className={styles.intro}>
        サンプル写真は Wikimedia Commons の著作権者が Creative Commons ライセンスで公開した画像を使用しています。
        アプリ内表示用にリサイズ・JPEG圧縮しています。
      </p>

      <ul className={styles.list}>
        {ASSET_CREDITS.map((credit) => (
          <li key={credit.illustrationId} className={styles.item}>
            <h2 className={styles.plantName}>{credit.plantName}</h2>
            <dl className={styles.meta}>
              <div>
                <dt>作者</dt>
                <dd>{credit.creator}</dd>
              </div>
              <div>
                <dt>ライセンス</dt>
                <dd>
                  <a href={credit.licenseUrl} target="_blank" rel="noopener noreferrer">
                    {credit.license}
                  </a>
                </dd>
              </div>
              <div>
                <dt>加工</dt>
                <dd>{credit.modifications}</dd>
              </div>
            </dl>
            <a
              href={credit.sourcePage}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.sourceLink}
            >
              元ファイルを見る
            </a>
          </li>
        ))}
      </ul>
    </div>
  );
}
