import { useRef, useState } from 'react';
import { SHOWCASE_GARDENS } from '../../data/showcaseGardens';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import type { GardenState } from '../../types';
import {
  createGardenInvite,
  GARDEN_INVITE_MAX_LENGTH,
  parseGardenInvite,
  type GardenVisit,
} from '../../utils/gardenInvite';
import styles from './Visits.module.css';

interface OutingsScreenProps {
  garden: Pick<GardenState, 'soilTiles' | 'plants' | 'decorations'>;
  onBack: () => void;
  onVisit: (garden: GardenVisit) => void;
}

export function OutingsScreen({ garden, onBack, onVisit }: OutingsScreenProps) {
  const titleRef = useScreenFocus(['outings']);
  const codeRef = useRef<HTMLTextAreaElement>(null);
  const [tab, setTab] = useState<'samples' | 'invite'>('samples');
  const [gardenTitle, setGardenTitle] = useState('わたしの庭');
  const [author, setAuthor] = useState('わたし');
  const [createdCode, setCreatedCode] = useState('');
  const [pastedCode, setPastedCode] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const selectCreatedCode = () => {
    codeRef.current?.focus();
    codeRef.current?.select();
    codeRef.current?.setSelectionRange(0, createdCode.length);
  };

  const generate = () => {
    setError('');
    setMessage('');
    try {
      setCreatedCode(createGardenInvite(garden, gardenTitle, author));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '招待状を作れませんでした。');
    }
  };

  const copy = async () => {
    if (!createdCode) return;
    setError('');
    try {
      if (!navigator.clipboard?.writeText) throw new Error('Clipboard unavailable');
      await navigator.clipboard.writeText(createdCode);
      setMessage('招待状をコピーしました。');
    } catch {
      selectCreatedCode();
      setMessage('自動でコピーできませんでした。コードを選択したので、端末のコピー操作を使ってください。');
    }
  };

  const share = async () => {
    if (!createdCode || !navigator.share) return;
    setError('');
    try {
      await navigator.share({ title: gardenTitle || '庭の招待状', text: createdCode });
      setMessage('共有画面を開きました。');
    } catch (caught) {
      if (caught instanceof DOMException && caught.name === 'AbortError') return;
      selectCreatedCode();
      setMessage('共有できませんでした。コードを選択したので、コピーして送れます。');
    }
  };

  const openInvite = () => {
    setError('');
    setMessage('');
    try {
      onVisit(parseGardenInvite(pastedCode));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : '招待状を読み込めませんでした。');
    }
  };

  return (
    <div className={styles.galleryScreen}>
      <header className={styles.galleryHeader}>
        <button type="button" className={styles.backButton} onClick={onBack}>← 自分の庭</button>
        <div>
          <p className={styles.eyebrow}>庭のアイデアを見つける</p>
          <h1 ref={titleRef} tabIndex={-1}>おでかけ</h1>
        </div>
      </header>

      <div className={styles.tabs} role="tablist" aria-label="おでかけの種類">
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'samples'}
          onClick={() => setTab('samples')}
        >
          見本の庭
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === 'invite'}
          onClick={() => setTab('invite')}
        >
          招待状
        </button>
      </div>

      <main className={styles.galleryContent}>
        {tab === 'samples' ? (
          <>
            <div className={styles.intro}>
              <h2>見本の庭へ遊びに行く</h2>
              <p>植物や小径の組み合わせを、自由に回して眺められます。実在する利用者の庭ではありません。</p>
            </div>
            <div className={styles.showcaseGrid}>
              {SHOWCASE_GARDENS.map((sample) => (
                <article className={styles.showcaseCard} key={sample.id}>
                  {sample.thumbnail && (
                    <img src={sample.thumbnail} alt={`${sample.title}の見本`} />
                  )}
                  <div className={styles.cardBody}>
                    <span className={styles.sampleBadge}>見本の庭</span>
                    <h2>{sample.title}</h2>
                    <p>{sample.description}</p>
                    <dl className={styles.cardCounts}>
                      <div><dt>土地</dt><dd>{sample.soilTiles.length}</dd></div>
                      <div><dt>植物</dt><dd>{sample.plants.length}</dd></div>
                      <div><dt>飾り</dt><dd>{sample.decorations.length}</dd></div>
                    </dl>
                    <button type="button" className={styles.visitButton} onClick={() => onVisit(sample)}>
                      庭に遊びに行く
                    </button>
                  </div>
                </article>
              ))}
            </div>
          </>
        ) : (
          <div className={styles.inviteColumns}>
            <section className={styles.invitePanel}>
              <h2>自分の庭の招待状を作る</h2>
              <p>今の配置だけをコードにします。写真・メモ・観察記録・アカウント情報は含みません。</p>
              <label>
                庭の名前
                <input
                  value={gardenTitle}
                  maxLength={40}
                  onChange={(event) => setGardenTitle(event.target.value)}
                />
              </label>
              <label>
                作者名
                <input
                  value={author}
                  maxLength={24}
                  onChange={(event) => setAuthor(event.target.value)}
                />
              </label>
              <button type="button" className={styles.primaryButton} onClick={generate}>今の庭で招待状を作る</button>
              {createdCode && (
                <div className={styles.codeBlock}>
                  <label htmlFor="created-invite">招待状コード</label>
                  <textarea
                    id="created-invite"
                    ref={codeRef}
                    value={createdCode}
                    readOnly
                    rows={5}
                    onFocus={(event) => event.currentTarget.select()}
                  />
                  <div className={styles.codeActions}>
                    <button type="button" onClick={() => void copy()}>コードをコピー</button>
                    {typeof navigator.share === 'function' && (
                      <button type="button" onClick={() => void share()}>共有する</button>
                    )}
                  </div>
                </div>
              )}
            </section>

            <section className={styles.invitePanel}>
              <h2>届いた招待状で訪ねる</h2>
              <p>招待状を作った時の庭を見に行けます。写真・メモは含みません。変更した庭を見せたいときは、新しい招待状を作って渡してください。</p>
              <label htmlFor="pasted-invite">招待状コード</label>
              <textarea
                id="pasted-invite"
                value={pastedCode}
                maxLength={GARDEN_INVITE_MAX_LENGTH + 1}
                rows={7}
                placeholder="KG1. から始まるコードを貼り付け"
                onChange={(event) => {
                  setPastedCode(event.target.value);
                  setError('');
                }}
              />
              <div className={styles.characterCount}>
                {pastedCode.length.toLocaleString()} / {GARDEN_INVITE_MAX_LENGTH.toLocaleString()}文字
              </div>
              <button type="button" className={styles.primaryButton} onClick={openInvite}>この庭を訪ねる</button>
            </section>
          </div>
        )}

        {error && <p className={styles.errorMessage} role="alert">{error}</p>}
        {message && <p className={styles.statusMessage} role="status">{message}</p>}
      </main>
    </div>
  );
}
