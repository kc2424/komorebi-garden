import { useScreenFocus } from '../../hooks/useScreenFocus';
import styles from './SettingsScreen.module.css';

interface HelpScreenProps {
  onBack: () => void;
  onShowOnboarding: () => void;
}

export function HelpScreen({ onBack, onShowOnboarding }: HelpScreenProps) {
  const titleRef = useScreenFocus(['help']);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">← 戻る</button>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>使い方</h1>
      </header>

      <div className={styles.hint}>
        <p><strong>1. 植物を選ぶ</strong> — 「庭づくり」から花・葉もの・木の20種類を選べます。名前で探したり、種類で絞り込めます。</p>
        <p><strong>2. 庭に置く</strong> — 空いた場所をタップして仮置きし、向きを決めて確定します。同じ植物や飾りを続けて置けます。</p>
        <p><strong>3. 地面をつくる</strong> — 草・土・小径・砂利・デッキ・水辺を組み合わせ、「高くする」「低くする」で小さな段差をつくれます。</p>
        <p><strong>4. 直す・眺める</strong> — 移動や収納、取り消しでいつでも直せます。「眺める」で庭を回して楽しみ、「全景」で庭全体へ戻れます。</p>
        <p><strong>5. 思い出を残す</strong> — 写真の記録も続けて使えます。チューリップは記録と結びつけられ、花を選ぶと写真を振り返れます。庭はこの端末に自動保存されます。</p>
        <p><strong>6. 庭へおでかけ</strong> — 見本の庭を訪ねたり、招待状コードで庭の配置を見せ合えます。訪問先は見るだけで、自分の庭は変わりません。招待状は作成時点の配置だけを含み、写真・メモ・アカウント情報は含みません。</p>
        <p><strong>庭の広さ</strong> — 土地は9×9の範囲で81枚まで、庭に置く植物と飾りは合わせて64個まで、高さは0〜3の4段です。以前の範囲外データがある場合も自動では削除しません。</p>
      </div>

      <button type="button" className={styles.menuBtn} onClick={onShowOnboarding} style={{ marginTop: '1rem' }}>
        初回案内をもう一度見る
      </button>
    </div>
  );
}
