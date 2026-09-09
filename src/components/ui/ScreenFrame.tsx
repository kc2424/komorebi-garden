import type { ReactNode, Ref } from 'react';
import styles from './ScreenFrame.module.css';

export type ScreenFrameTone = 'neutral' | 'discovery' | 'journal';

interface ScreenFrameProps {
  title: string;
  titleRef?: Ref<HTMLHeadingElement>;
  onBack?: () => void;
  footer?: ReactNode;
  children: ReactNode;
  bodyClassName?: string;
  noBodyPadding?: boolean;
  tone?: ScreenFrameTone;
}

function BackIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path
        d="M14 6l-6 6 6 6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

const TONE_CLASS: Record<ScreenFrameTone, string | undefined> = {
  neutral: undefined,
  discovery: styles.toneDiscovery,
  journal: styles.toneJournal,
};

export function ScreenFrame({
  title,
  titleRef,
  onBack,
  footer,
  children,
  bodyClassName,
  noBodyPadding,
  tone = 'neutral',
}: ScreenFrameProps) {
  const bodyClass = [
    styles.body,
    noBodyPadding && styles.bodyNoPad,
    bodyClassName,
  ]
    .filter(Boolean)
    .join(' ');

  const frameClass = [styles.frame, TONE_CLASS[tone]].filter(Boolean).join(' ');

  return (
    <div className={frameClass}>
      <header className={styles.header}>
        {onBack ? (
          <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">
            <BackIcon />
          </button>
        ) : (
          <div className={styles.headerSpacer} aria-hidden="true" />
        )}
        <h1 className={styles.title} ref={titleRef} tabIndex={onBack ? -1 : undefined}>
          {title}
        </h1>
        <div className={styles.headerSpacer} aria-hidden="true" />
      </header>

      <div className={bodyClass}>{children}</div>

      {footer && <footer className={styles.footer}>{footer}</footer>}
    </div>
  );
}
