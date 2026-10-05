import { useScreenFocus } from '../../hooks/useScreenFocus';
import type { DiscoveryDraft } from '../../types';
import { Banner } from '../ui/Banner';
import { Button } from '../ui/Button';
import layout from './DiscoverScreen.module.css';
import styles from './IdentifyScreen.module.css';

interface PhotoConfirmScreenProps {
  draft: DiscoveryDraft;
  onRetake: () => void;
  onContinue: () => void;
}

export function PhotoConfirmScreen({ draft, onRetake, onContinue }: PhotoConfirmScreenProps) {
  const titleRef = useScreenFocus(['photo-confirm']);

  const willSendExternally = draft.source !== 'sample';

  return (
    <div className={layout.screen}>
      <header className={layout.header}>
        <button type="button" className={layout.backBtn} onClick={onRetake} aria-label="戻る">
          ← 戻る
        </button>
        <h1 className={layout.title} ref={titleRef} tabIndex={-1}>写真の確認</h1>
      </header>

      <div className={styles.photoPreview}>
        <img src={draft.imageDataUrl} alt="選択した植物の写真" className={styles.photo} />
      </div>

      {willSendExternally ? (
        <Banner
          variant="sample"
          message="この写真は植物識別のため、サーバー経由で Pl@ntNet API に送信されます。キー未設定の場合は手動確認になります。送信前にいつでも撮り直せます。"
        />
      ) : (
        <Banner variant="sample" message="サンプル写真は外部送信されません。固定候補で体験できます。" />
      )}

      <div className={layout.sourceButtons}>
        <Button fullWidth onClick={onContinue}>
          {willSendExternally ? '識別を始める' : '候補を見る'}
        </Button>
        <Button variant="secondary" fullWidth onClick={onRetake}>
          撮り直す／別の写真
        </Button>
      </div>
    </div>
  );
}
