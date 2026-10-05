import { Modal } from './Modal';
import { Button } from './Button';
import styles from './ConfirmModal.module.css';

interface ConfirmModalProps {
  title: string;
  message: string;
  confirmLabel: string;
  cancelLabel: string;
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
  /** × / Escape / backdrop — defaults to onCancel when omitted */
  onDismiss?: () => void;
  extraAction?: { label: string; onClick: () => void };
}

export function ConfirmModal({
  title,
  message,
  confirmLabel,
  cancelLabel,
  destructive,
  onConfirm,
  onCancel,
  onDismiss,
  extraAction,
}: ConfirmModalProps) {
  const handleDismiss = onDismiss ?? onCancel;
  return (
    <Modal title={title} onClose={handleDismiss}>
      <p className={styles.message}>{message}</p>
      <div className={styles.actions}>
        <Button variant={destructive ? 'primary' : 'primary'} onClick={onConfirm}>
          {confirmLabel}
        </Button>
        <Button variant="secondary" onClick={onCancel}>{cancelLabel}</Button>
        {extraAction && (
          <Button variant="secondary" onClick={extraAction.onClick}>{extraAction.label}</Button>
        )}
      </div>
    </Modal>
  );
}
