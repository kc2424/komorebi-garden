import { useScreenFocus } from '../../hooks/useScreenFocus';
import type { AppSession } from '../../hooks/useAppSession';
import styles from './SettingsScreen.module.css';

interface SettingsScreenProps {
  session: AppSession;
  onBack: () => void;
  onHelp: () => void;
  onDataManagement: () => void;
  onAuth: () => void;
  onPrivacy: () => void;
  onCredits: () => void;
}

function syncLabel(status: AppSession['syncStatus']): string {
  switch (status) {
    case 'synced': return '同期済み';
    case 'syncing': return '同期中…';
    case 'pending': return '未同期あり';
    case 'error': return '同期エラー';
    case 'offline': return 'オフライン';
    case 'not_configured': return '未接続';
    default: return 'この端末に保存';
  }
}

function syncClass(status: AppSession['syncStatus']): string {
  if (status === 'synced') return styles.statusSynced;
  if (status === 'pending' || status === 'syncing') return styles.statusPending;
  if (status === 'error') return styles.statusError;
  return '';
}

export function SettingsScreen({
  session,
  onBack,
  onHelp,
  onDataManagement,
  onAuth,
  onPrivacy,
  onCredits,
}: SettingsScreenProps) {
  const titleRef = useScreenFocus(['settings']);

  const storageHint = session.user
    ? 'ログイン中のデータはクラウドと同期されます。写真は非公開ストレージに保存されます。'
    : session.isSupabaseConfigured && !session.isAuthEmailDeliveryReady
      ? '引き継ぎの準備中です。この端末で記録を始められます。メール送信が利用可能になるまでお待ちください。'
      : '現在はこの端末にのみ保存されています。ログインすると別の端末でも引き継げます。';

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">
          ← 戻る
        </button>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>設定</h1>
      </header>

      <section className={styles.section} aria-labelledby="storage-heading">
        <h2 id="storage-heading" className={styles.sectionTitle}>保存先</h2>
        <ul className={styles.menuList}>
          <li className={styles.menuItem}>
            <button type="button" className={styles.menuBtn} onClick={onAuth}>
              <span>{session.user ? `ログイン中: ${session.user.email}` : 'ログインして引き継ぐ'}</span>
              <span className={`${styles.statusBadge} ${syncClass(session.syncStatus)}`}>
                {syncLabel(session.syncStatus)}
              </span>
            </button>
          </li>
        </ul>
        <p className={styles.hint}>{storageHint}</p>
        {session.syncError && (
          <p className={styles.hint} role="alert">{session.syncError}</p>
        )}
      </section>

      <section className={styles.section} aria-labelledby="app-heading">
        <h2 id="app-heading" className={styles.sectionTitle}>アプリ</h2>
        <ul className={styles.menuList}>
          <li className={styles.menuItem}>
            <button type="button" className={styles.menuBtn} onClick={onHelp}>
              使い方
            </button>
          </li>
          <li className={styles.menuItem}>
            <button type="button" className={styles.menuBtn} onClick={onDataManagement}>
              データ管理
            </button>
          </li>
          <li className={styles.menuItem}>
            <button type="button" className={styles.menuBtn} onClick={onPrivacy}>
              プライバシー
            </button>
          </li>
          <li className={styles.menuItem}>
            <button type="button" className={styles.menuBtn} onClick={onCredits}>
              クレジット
            </button>
          </li>
        </ul>
      </section>

      <p className={styles.version}>こもれび植物園 v0.1.0</p>
    </div>
  );
}
