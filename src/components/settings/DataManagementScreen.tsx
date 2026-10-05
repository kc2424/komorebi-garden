import { useRef, useState } from 'react';
import type { GardenStore } from '../../hooks/useGardenStore';
import type { AppSession } from '../../hooks/useAppSession';
import { useScreenFocus } from '../../hooks/useScreenFocus';
import { exportBackup, importBackup, mergeRestoredState, parseBackupFile, createWipeState } from '../../storage/backup';
import { writeBackupFile, isNativePlatform } from '../../platform/native';
import { setOnboardingComplete } from '../../storage/appMeta';
import { clearScopeWipeArtifacts } from '../../storage/persistence';
import { wipeCloudGarden } from '../../sync/syncService';
import { Button } from '../ui/Button';
import { Banner } from '../ui/Banner';
import { ConfirmModal } from '../ui/ConfirmModal';
import styles from './SettingsScreen.module.css';

interface DataManagementScreenProps {
  store: GardenStore;
  session: AppSession;
  onBack: () => void;
}

export function DataManagementScreen({ store, session, onBack }: DataManagementScreenProps) {
  const titleRef = useScreenFocus(['data-management']);
  const fileRef = useRef<HTMLInputElement>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);
  const [confirmRestore, setConfirmRestore] = useState<{
    observationCount: number;
    plantCount: number;
    payload: ReturnType<typeof parseBackupFile>['payload'];
  } | null>(null);
  const [loading, setLoading] = useState(false);

  const handleExport = async () => {
    setLoading(true);
    try {
      const backup = await exportBackup(store.state);
      const json = JSON.stringify(backup, null, 2);
      const filename = `komorebi-backup-${new Date().toISOString().slice(0, 10)}.json`;
      if (isNativePlatform()) {
        const uri = await writeBackupFile(filename, json);
        setMessage(uri ? `バックアップを書き出しました（${filename}）。` : '書き出しに失敗しました。');
      } else {
        const blob = new Blob([json], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        setMessage('バックアップを書き出しました。');
      }
    } catch {
      setError('書き出しに失敗しました。');
    }
    setLoading(false);
  };

  const handleFileSelect = async (file: File) => {
    const text = await file.text();
    const parsed = parseBackupFile(text);
    if (!parsed.payload) {
      setError(parsed.error ?? '復元できません。');
      return;
    }
    const validation = parsed.payload;
    setConfirmRestore({
      observationCount: validation.garden.observations.length,
      plantCount: validation.garden.plants.length,
      payload: parsed.payload,
    });
  };

  const handleRestore = async () => {
    if (!confirmRestore?.payload) return;
    setLoading(true);
    const previous = store.state;
    try {
      const restored = await importBackup(confirmRestore.payload);
      const merged = mergeRestoredState(previous, restored);
      const result = await store.replaceState(merged);
      if (!result.ok) {
        await store.replaceState(previous);
        setError('復元に失敗しました。元のデータを保持しています。');
      } else {
        setMessage('バックアップから復元しました。');
        if (session.user) void session.runSync();
      }
    } catch {
      await store.replaceState(previous);
      setError('復元に失敗しました。');
    }
    setConfirmRestore(null);
    setLoading(false);
  };

  const handleWipe = async () => {
    setLoading(true);
    setError(null);

    if (session.user && !session.online) {
      setError('オフラインのため削除できません。接続を確認してからもう一度お試しください。');
      setLoading(false);
      return;
    }

    const scopeUserId = session.user?.id ?? null;

    let wiped = createWipeState();
    if (session.user) {
      const expected = store.state.sync.lastSyncedRevision;
      const cloud = await wipeCloudGarden(session.user.id, expected);
      if (!cloud.ok) {
        setError(cloud.error ?? 'クラウドの削除に失敗しました。');
        setLoading(false);
        return;
      }
      wiped = createWipeState(cloud.revision, cloud.tombstoneRevision);
    }

    try {
      await clearScopeWipeArtifacts(scopeUserId);
    } catch {
      setError('削除に失敗しました。');
      setLoading(false);
      return;
    }

    const result = await store.replaceState(wiped);
    if (!result.ok) {
      setError(result.error ?? '削除に失敗しました。');
      setLoading(false);
      return;
    }

    await session.persistDraft(null);
    if (session.user) {
      await session.setSyncHalted(true);
    } else {
      await setOnboardingComplete(false);
    }
    setConfirmWipe(false);
    setMessage('すべてのデータを削除しました。');
    setLoading(false);
  };

  return (
    <div className={styles.screen}>
      <header className={styles.header}>
        <button type="button" className={styles.backBtn} onClick={onBack} aria-label="戻る">← 戻る</button>
        <h1 className={styles.title} ref={titleRef} tabIndex={-1}>データ管理</h1>
      </header>

      <p className={styles.hint}>
        端末のデータ削除・再インストールで失う可能性があります。バックアップを書き出して手動で引き継ぐこともできます。
        {session.user ? ' ログイン中はクラウド同期も利用できます。' : ''}
      </p>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
        <Button variant="secondary" loading={loading} onClick={() => void handleExport()}>
          バックアップを書き出す
        </Button>
        <Button variant="secondary" onClick={() => fileRef.current?.click()}>
          バックアップから復元
        </Button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          style={{ display: 'none' }}
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void handleFileSelect(f);
            e.target.value = '';
          }}
        />
        <Button variant="secondary" onClick={() => setConfirmWipe(true)}>
          すべてのデータを削除
        </Button>
      </div>

      {message && <p className={styles.hint} role="status">{message}</p>}
      {error && <Banner variant="error" message={error} onDismiss={() => setError(null)} />}

      {confirmRestore && (
        <ConfirmModal
          title="バックアップを復元"
          message={`観察${confirmRestore.observationCount}件・花${confirmRestore.plantCount}本のデータで現在のデータを置き換えます。`}
          confirmLabel="復元する"
          cancelLabel="キャンセル"
          onConfirm={() => void handleRestore()}
          onCancel={() => setConfirmRestore(null)}
        />
      )}

      {confirmWipe && (
        <ConfirmModal
          title="すべてのデータを削除"
          message="庭・観察・写真・下書き・初回案内状態を削除します。アプリ外に書き出したバックアップは削除されません。元に戻せません。"
          confirmLabel="削除する"
          cancelLabel="キャンセル"
          destructive
          onConfirm={() => void handleWipe()}
          onCancel={() => setConfirmWipe(false)}
        />
      )}
    </div>
  );
}
