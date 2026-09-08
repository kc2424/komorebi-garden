import styles from './Banner.module.css';

interface BannerProps {
  variant: 'info' | 'error' | 'sample';
  message: string;
  onDismiss?: () => void;
}

export function Banner({ variant, message, onDismiss }: BannerProps) {
  return (
    <div className={`${styles.banner} ${styles[variant]}`} role={variant === 'error' ? 'alert' : 'status'}>
      <p className={styles.message}>{message}</p>
      {onDismiss && (
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="閉じる">
          ×
        </button>
      )}
    </div>
  );
}
