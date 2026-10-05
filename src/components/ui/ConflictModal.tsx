import type { ConflictInfo } from '../../types/sync';
import { ConfirmModal } from './ConfirmModal';

interface ConflictModalProps {
  info: ConflictInfo;
  onChooseCloud: () => void;
  onChooseLocal: () => void;
  onCancel: () => void;
}

export function ConflictModal({ info, onChooseCloud, onChooseLocal, onCancel }: ConflictModalProps) {
  return (
    <ConfirmModal
      title="庭のデータが異なります"
      message={`クラウド: 観察${info.cloudObservationCount}件・花${info.cloudPlantCount}本 / この端末: 観察${info.localObservationCount}件・花${info.localPlantCount}本。選ばなかった側は退避として保持されます。`}
      confirmLabel="クラウドの庭を使う"
      cancelLabel="この端末の庭を使う"
      onConfirm={onChooseCloud}
      onCancel={onChooseLocal}
      extraAction={{ label: 'あとで決める', onClick: onCancel }}
    />
  );
}
