import { useEffect, useRef } from 'react';
import type { SkyMode } from '../../utils/skyTime';
import { SKY_MODE_OPTIONS } from '../../utils/skyTime';
import type { SkySettings } from '../../utils/skySettings';
import styles from './SkySettingsDialog.module.css';

interface SkySettingsDialogProps {
  open: boolean;
  settings: SkySettings;
  onClose: () => void;
  onModeChange: (mode: SkyMode) => void;
  onMotionChange: (motion: boolean) => void;
}

export function SkySettingsDialog({
  open,
  settings,
  onClose,
  onModeChange,
  onMotionChange,
}: SkySettingsDialogProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const closeBtnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog) return;

    if (open) {
      returnFocusRef.current = document.activeElement as HTMLElement | null;
      if (!dialog.open) {
        dialog.showModal();
      }
      closeBtnRef.current?.focus();
      return;
    }

    if (dialog.open) {
      dialog.close();
    }
    returnFocusRef.current?.focus();
    returnFocusRef.current = null;
  }, [open]);

  const handleRequestClose = () => {
    if (open) {
      onClose();
    }
  };

  const handleCancel = (event: React.SyntheticEvent) => {
    event.preventDefault();
    handleRequestClose();
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLDialogElement>) => {
    event.stopPropagation();
  };

  const handleBackdropClick = (event: React.MouseEvent<HTMLDialogElement>) => {
    if (event.target !== event.currentTarget) return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const rect = dialog.getBoundingClientRect();
    const inDialog =
      event.clientX >= rect.left &&
      event.clientX <= rect.right &&
      event.clientY >= rect.top &&
      event.clientY <= rect.bottom;
    if (!inDialog) {
      handleRequestClose();
    }
  };

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby="sky-settings-title"
      aria-modal="true"
      onCancel={handleCancel}
      onClose={handleRequestClose}
      onKeyDown={handleKeyDown}
      onClick={handleBackdropClick}
    >
      <div className={styles.sheet}>
        <header className={styles.header}>
          <h2 id="sky-settings-title" className={styles.title}>空の設定</h2>
          <button
            ref={closeBtnRef}
            type="button"
            className={styles.closeBtn}
            onClick={handleRequestClose}
            aria-label="閉じる"
          >
            ×
          </button>
        </header>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>時間帯</legend>
          <div className={styles.optionRow} role="radiogroup" aria-label="時間帯">
            {SKY_MODE_OPTIONS.map(({ mode, label }) => {
              const inputId = `sky-mode-${mode}`;
              return (
                <label
                  key={mode}
                  htmlFor={inputId}
                  className={`${styles.optionBtn} ${settings.mode === mode ? styles.optionActive : ''}`}
                >
                  <input
                    id={inputId}
                    type="radio"
                    name="sky-mode"
                    value={mode}
                    checked={settings.mode === mode}
                    onChange={() => onModeChange(mode)}
                    className={styles.visuallyHiddenRadio}
                  />
                  {label}
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className={styles.fieldset}>
          <legend className={styles.legend}>雲の動き</legend>
          <div className={styles.toggleRow} role="group" aria-label="雲の動き">
            <button
              type="button"
              className={`${styles.toggleBtn} ${settings.motion ? styles.optionActive : ''}`}
              aria-pressed={settings.motion}
              onClick={() => onMotionChange(true)}
            >
              オン
            </button>
            <button
              type="button"
              className={`${styles.toggleBtn} ${!settings.motion ? styles.optionActive : ''}`}
              aria-pressed={!settings.motion}
              onClick={() => onMotionChange(false)}
            >
              オフ
            </button>
          </div>
        </fieldset>
      </div>
    </dialog>
  );
}
