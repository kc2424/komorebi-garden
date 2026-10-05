import { useEffect, useRef, useState } from 'react';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import type { AppSession } from '../../hooks/useAppSession';
import { OTP_RESEND_COOLDOWN_SEC } from '../../sync/authErrors';
import { Button } from '../ui/Button';
import { Banner } from '../ui/Banner';
import styles from './SettingsScreen.module.css';

interface AuthScreenProps {
  session: AppSession;
  onBack: () => void;
}

export function AuthScreen({ session, onBack }: AuthScreenProps) {
  const titleRef = useScreenFocus(['auth']);
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [logoutConfirm, setLogoutConfirm] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(false);
  const [deletePhrase, setDeletePhrase] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const resendDeadlineRef = useRef<number | null>(null);
  const [resendTimerKey, setResendTimerKey] = useState(0);

  const startResendCooldown = () => {
    resendDeadlineRef.current = Date.now() + OTP_RESEND_COOLDOWN_SEC * 1000;
    setResendCooldown(OTP_RESEND_COOLDOWN_SEC);
    setResendTimerKey((key) => key + 1);
  };

  const clearResendCooldown = () => {
    resendDeadlineRef.current = null;
    setResendCooldown(0);
  };

  useEffect(() => {
    if (session.authPhase === 'otp_sent' && resendDeadlineRef.current === null) {
      startResendCooldown();
    }
    if (session.authPhase !== 'otp_sent') {
      clearResendCooldown();
    }
  }, [session.authPhase]);

  useEffect(() => {
    if (resendDeadlineRef.current === null) return;

    const tick = () => {
      const deadline = resendDeadlineRef.current;
      if (deadline === null) return;
      const remaining = Math.max(0, Math.ceil((deadline - Date.now()) / 1000));
      setResendCooldown(remaining);
    };

    tick();
    const intervalId = setInterval(tick, 1000);
    return () => clearInterval(intervalId);
  }, [session.authPhase, resendTimerKey]);

  if (!session.isSupabaseConfigured) {
    return (
      <div className={styles.screen}>
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">← 戻る</button>
          <h1 className={styles.title} ref={titleRef} tabIndex={-1}>ログイン</h1>
        </header>
        <Banner
          variant="error"
          message="同期サービスが未設定です。接続情報が環境変数で設定されるまで、端末内保存のみ利用できます。"
        />
      </div>
    );
  }

  const handleSend = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const result = await session.handleSendOtp(email.trim());
    if (!result.ok) setError(result.error ?? '送信に失敗しました');
    else startResendCooldown();
    setLoading(false);
  };

  const handleResend = async () => {
    if (loading || resendCooldown > 0 || !session.otpEmail) return;
    setLoading(true);
    setError(null);
    const result = await session.handleSendOtp(session.otpEmail);
    if (!result.ok) setError(result.error ?? '再送に失敗しました');
    else startResendCooldown();
    setLoading(false);
  };

  const handleVerify = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    const result = await session.handleVerifyOtp(code.trim());
    if (!result.ok) setError(result.error ?? '認証に失敗しました');
    else onBack();
    setLoading(false);
  };

  const handleChangeEmail = () => {
    session.resetOtpFlow();
    setCode('');
    setError(null);
    clearResendCooldown();
  };

  const handleLogout = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    try {
      const result = await session.handleSignOut(logoutConfirm);
      if (result.needsConfirm) {
        setLogoutConfirm(true);
        return;
      }
      if (!result.ok) {
        setError(result.error ?? 'ログアウトに失敗しました。接続を確認してからもう一度お試しください。');
        return;
      }
      onBack();
    } finally {
      setLoading(false);
    }
  };

  if (session.user) {
    return (
      <div className={styles.screen}>
        <header className={styles.header}>
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">← 戻る</button>
          <h1 className={styles.title} ref={titleRef} tabIndex={-1}>アカウント</h1>
        </header>
        <p className={styles.hint}>ログイン中: {session.user.email}</p>
        <p className={styles.hint}>
          同期状態: {session.syncStatus === 'synced' ? '同期済み' : '未同期または未接続'}
        </p>
        {session.syncError && (
          <Banner variant="error" message={session.syncError} />
        )}
        {error && <Banner variant="error" message={error} onDismiss={() => setError(null)} />}
        {logoutConfirm && (
          <Banner
            variant="error"
            message="未同期の変更があります。破棄してログアウトしますか？"
          />
        )}
        <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <Button
            variant="secondary"
            onClick={() => void session.runSync()}
            loading={session.syncStatus === 'syncing'}
            disabled={loading || session.syncStatus === 'syncing'}
          >
            今すぐ同期
          </Button>
          <Button variant="secondary" onClick={() => void handleLogout()} loading={loading} disabled={loading}>
            {logoutConfirm ? '破棄してログアウト' : 'ログアウト'}
          </Button>
          <Button variant="secondary" onClick={() => setDeleteConfirm(true)} disabled={loading}>
            アカウントを削除
          </Button>
        </div>
        {deleteConfirm && (
          <div style={{ marginTop: '1rem' }}>
            <Banner
              variant="error"
              message="オンライン接続が必要です。庭・観察・写真をクラウドから削除し、アカウントを完全に削除します。元に戻せません。"
            />
            <label className={styles.hint}>
              確認のため「削除する」と入力
              <input
                value={deletePhrase}
                onChange={(e) => setDeletePhrase(e.target.value)}
                style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem' }}
              />
            </label>
            <Button
              variant="secondary"
              loading={loading}
              disabled={deletePhrase !== '削除する' || !session.online || loading}
              onClick={async () => {
                setLoading(true);
                setError(null);
                try {
                  const result = await session.handleDeleteAccount();
                  if (!result.ok) setError(result.error ?? '削除に失敗しました');
                  else onBack();
                } finally {
                  setLoading(false);
                }
              }}
            >
              完全に削除する
            </Button>
            <Button variant="secondary" onClick={() => { setDeleteConfirm(false); setDeletePhrase(''); }}>
              キャンセル
            </Button>
          </div>
        )}
      </div>
    );
  }

  const emailReady = session.isAuthEmailDeliveryReady;
  const otpPhase = session.authPhase === 'otp_sent';
  const displayEmail = session.otpEmail ?? email.trim();

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">← 戻る</button>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>ログイン</h1>
      </header>

      {!emailReady && (
        <Banner
          variant="error"
          message="引き継ぎの準備中です。この端末で記録を始められます。メール送信が利用可能になるまでお待ちください。"
        />
      )}

      {!otpPhase ? (
        <p className={styles.hint}>
          メールアドレスに認証コードを送ります。届いた6桁のコードを入力してログインしてください。
        </p>
      ) : (
        <p className={styles.hint}>
          <strong>{displayEmail}</strong> に認証コードを送りました。届いた6桁のコードを入力してください。
        </p>
      )}

      {!otpPhase && (
        <label className={styles.hint}>
          メールアドレス
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem' }}
            autoComplete="email"
          />
        </label>
      )}

      {otpPhase && (
        <label className={styles.hint} style={{ marginTop: '1rem' }}>
          認証コード
          <input
            type="text"
            inputMode="numeric"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            style={{ display: 'block', width: '100%', marginTop: '0.25rem', padding: '0.5rem' }}
            autoComplete="one-time-code"
          />
        </label>
      )}

      <div style={{ marginTop: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
        {!otpPhase ? (
          <Button
            fullWidth
            loading={loading}
            onClick={() => void handleSend()}
            disabled={!email.trim() || !emailReady || loading}
          >
            認証コードを送信
          </Button>
        ) : (
          <>
            <Button fullWidth loading={loading} onClick={() => void handleVerify()} disabled={!code.trim() || loading}>
              ログイン
            </Button>
            <Button
              variant="secondary"
              fullWidth
              onClick={() => void handleResend()}
              disabled={resendCooldown > 0 || loading}
            >
              {resendCooldown > 0 ? `再送（${resendCooldown}秒）` : '認証コードを再送'}
            </Button>
            <Button variant="secondary" fullWidth onClick={handleChangeEmail} disabled={loading}>
              メールアドレスを変更
            </Button>
            <Button variant="secondary" fullWidth onClick={handleChangeEmail} disabled={loading}>
              戻る
            </Button>
          </>
        )}
      </div>

      {error && <Banner variant="error" message={error} onDismiss={() => setError(null)} />}
    </div>
  );
}
