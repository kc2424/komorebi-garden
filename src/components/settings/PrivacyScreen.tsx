import { useScreenFocus } from '../../hooks/useScreenFocus';
import type { AppSession } from '../../hooks/useAppSession';
import styles from './SettingsScreen.module.css';

interface PrivacyScreenProps {
  session: AppSession;
  onBack: () => void;
}

export function PrivacyScreen({ session, onBack }: PrivacyScreenProps) {
  const titleRef = useScreenFocus(['privacy']);

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">← 戻る</button>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>プライバシー</h1>
      </header>

      <div className={styles.hint}>
        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>保存されるデータ</h2>
        <ul style={{ paddingLeft: '1.2rem', margin: '0 0 1rem' }}>
          <li>観察写真・植物名・日付・メモ</li>
          <li>庭の配置（土タイル・花の位置）</li>
          <li>ログイン時: 上記をアカウントに紐づけてクラウドに同期</li>
        </ul>

        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>外部送信</h2>
        <ul style={{ paddingLeft: '1.2rem', margin: '0 0 1rem' }}>
          <li>植物識別: 選択した写真を Pl@ntNet API（サーバー経由）に送信</li>
          <li>同期: ログイン時に Supabase（認証・DB・非公開ストレージ）</li>
        </ul>

        <h2 style={{ fontSize: '1rem', margin: '0 0 0.5rem' }}>問い合わせ</h2>
        <p>
          問い合わせ先は未設定です。ストア公開前に連絡先を掲載します。
        </p>

        {session.user && (
          <p style={{ marginTop: '1rem' }}>
            アカウント削除は設定 → ログイン画面から行えます（オンライン接続が必要）。
          </p>
        )}
      </div>
    </div>
  );
}
