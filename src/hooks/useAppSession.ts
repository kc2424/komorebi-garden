import { useCallback, useEffect, useRef, useState } from 'react';
import type { User } from '@supabase/supabase-js';
import type { GardenState } from '../types';
import type { ConflictInfo } from '../types/sync';
import {
  loadAppMeta,
  setCurrentUserId,
  setSyncHalted,
  saveDraft,
  setOnboardingComplete,
  clearDraftForScope,
} from '../storage/appMeta';
import { clearScopeData, shelveGarden, loadState, createEmptyState } from '../storage/persistence';
import {
  getCurrentUser,
  sendOtp,
  verifyOtp,
  signOut,
  deleteAccount,
  getAuthPhase,
  isAuthEmailDeliveryReady,
} from '../sync/authService';
import { syncGarden, pullCloudState, pushCloudState } from '../sync/syncService';
import { applyPulledState, applySyncedState, applySyncAcknowledgement } from '../sync/syncLogic';
import { isSupabaseConfigured, getSupabase } from '../sync/supabaseClient';
import type { GardenStore } from './useGardenStore';
import type { DiscoveryDraft, Screen } from '../types';

export type SyncUiStatus = 'idle' | 'syncing' | 'synced' | 'pending' | 'error' | 'offline' | 'not_configured';

export type SignOutResult =
  | { needsConfirm: true }
  | { needsConfirm: false; ok: true }
  | { needsConfirm: false; ok: false; error: string };

export function useAppSession(store: GardenStore) {
  const [user, setUser] = useState<User | null>(null);
  const [otpSent, setOtpSent] = useState(false);
  const [otpEmail, setOtpEmail] = useState<string | null>(null);
  const [onboardingComplete, setOnboardingDone] = useState(false);
  const [draft, setDraft] = useState<DiscoveryDraft | null>(null);
  const [syncStatus, setSyncStatus] = useState<SyncUiStatus>(
    isSupabaseConfigured() ? 'idle' : 'not_configured',
  );
  const [syncError, setSyncError] = useState<string | null>(null);
  const [conflict, setConflict] = useState<{
    info: ConflictInfo;
    cloudState: GardenState;
    localState: GardenState;
  } | null>(null);
  const conflictRef = useRef(conflict);
  conflictRef.current = conflict;
  const [syncHalted, setSyncHaltedState] = useState(false);
  const [metaLoaded, setMetaLoaded] = useState(false);
  const [importPending, setImportPending] = useState(false);
  const [online, setOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true);

  const syncLock = useRef(false);
  const syncQueuedRef = useRef(false);
  const authGeneration = useRef(0);
  const otpSendGeneration = useRef(0);
  const otpEmailRef = useRef<string | null>(null);
  const userIdRef = useRef<string | null>(null);
  const storeRef = useRef(store);
  storeRef.current = store;
  const syncBaseStateRef = useRef(store.getLatestState());
  syncBaseStateRef.current = store.getLatestState();

  const readSyncBaseState = useCallback(() => {
    const latest = storeRef.current.getLatestState();
    return latest.sync.revision >= syncBaseStateRef.current.sync.revision
      ? latest
      : syncBaseStateRef.current;
  }, []);

  const resetUiSession = useCallback(() => {
    setDraft(null);
    setConflict(null);
    setSyncError(null);
    setOtpSent(false);
    setOtpEmail(null);
    otpEmailRef.current = null;
    setImportPending(false);
  }, []);

  useEffect(() => {
    const onOnline = () => setOnline(true);
    const onOffline = () => setOnline(false);
    window.addEventListener('online', onOnline);
    window.addEventListener('offline', onOffline);
    return () => {
      window.removeEventListener('online', onOnline);
      window.removeEventListener('offline', onOffline);
    };
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const meta = await loadAppMeta();
      if (cancelled) return;
      setOnboardingDone(meta.onboardingComplete);
      setDraft(meta.draft);
      setSyncHaltedState(meta.syncHalted);
      const current = await getCurrentUser();
      if (cancelled) return;
      setUser(current);
      userIdRef.current = current?.id ?? null;
      if (current) {
        storeRef.current.setUserScope(current.id);
        await setCurrentUserId(current.id);
        await storeRef.current.reload(current.id);
      }
      setMetaLoaded(true);
    })();
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;
    const { data: sub } = supabase.auth.onAuthStateChange((_event, sess) => {
      const u = sess?.user ?? null;
      userIdRef.current = u?.id ?? null;
      setUser(u);
      storeRef.current.setUserScope(u?.id ?? null);
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const completeOnboarding = useCallback(async () => {
    await setOnboardingComplete(true);
    setOnboardingDone(true);
  }, []);

  const persistDraft = useCallback(async (d: DiscoveryDraft | null) => {
    setDraft(d);
    await saveDraft(d);
  }, []);

  const applySyncResult = useCallback(
    async (
      result: Awaited<ReturnType<typeof syncGarden>>,
      revisionAtStart: number,
      gen: number,
      uid: string,
    ): Promise<'applied' | 'stale' | 'stopped'> => {
      if (authGeneration.current !== gen || userIdRef.current !== uid) return 'stopped';

      const current = readSyncBaseState();
      const concurrentEditDuringSync =
        current.sync.revision !== revisionAtStart && current.sync.pendingChanges;

      switch (result.status) {
        case 'not_configured':
          setSyncStatus('not_configured');
          break;
        case 'halted':
          setSyncStatus('pending');
          setSyncError('全削除後の未同期データがあります。設定で確認してください。');
          break;
        case 'synced': {
          const serverRevision = result.state.sync.lastSyncedRevision;
          if (serverRevision == null) break;
          if (concurrentEditDuringSync && result.mode !== 'push') return 'stale';
          const merged = applySyncAcknowledgement(
            result.mode,
            current,
            result.state,
            serverRevision,
            result.state.sync.tombstoneRevision,
          );
          syncBaseStateRef.current = merged;
          await storeRef.current.replaceState(merged);
          setSyncStatus('synced');
          if (concurrentEditDuringSync) return 'stale';
          break;
        }
        case 'conflict':
          if (concurrentEditDuringSync) return 'stale';
          setConflict({
            info: result.info,
            cloudState: result.cloudState,
            localState: result.localState,
          });
          setSyncStatus('pending');
          break;
        case 'error':
          if (concurrentEditDuringSync) return 'stale';
          setSyncStatus('error');
          setSyncError(result.error);
          break;
        default:
          break;
      }
      return 'applied';
    },
    [readSyncBaseState],
  );

  const runSync = useCallback(async () => {
    const uid = userIdRef.current;
    if (!uid || importPending) return;
    if (!online) {
      setSyncStatus('offline');
      return;
    }
    if (!isSupabaseConfigured()) {
      setSyncStatus('not_configured');
      return;
    }

    if (syncLock.current) {
      syncQueuedRef.current = true;
      return;
    }

    syncLock.current = true;
    setSyncError(null);

    try {
      let keepRunning = true;
      while (keepRunning) {
        syncQueuedRef.current = false;
        const gen = authGeneration.current;
        const baseState = readSyncBaseState();
        const revisionAtStart = baseState.sync.revision;

        setSyncStatus('syncing');
        const result = await syncGarden(uid, baseState, syncHalted);
        const outcome = await applySyncResult(result, revisionAtStart, gen, uid);

        if (outcome === 'stopped') break;

        keepRunning =
          (outcome === 'stale' || syncQueuedRef.current)
          && authGeneration.current === gen
          && userIdRef.current === uid
          && !importPending
          && readSyncBaseState().sync.pendingChanges;
      }
    } finally {
      syncLock.current = false;
      if (syncQueuedRef.current && userIdRef.current && !importPending) {
        void runSync();
      }
    }
  }, [online, syncHalted, importPending, applySyncResult, readSyncBaseState]);

  const pendingChanges = store.state.sync.pendingChanges;
  useEffect(() => {
    if (user && store.hydrated && metaLoaded && !importPending) {
      void runSync();
    }
  }, [user, store.hydrated, metaLoaded, pendingChanges, importPending, runSync]);

  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible' && userIdRef.current && !importPending) {
        void runSync();
      }
    };
    document.addEventListener('visibilitychange', onVisible);
    return () => document.removeEventListener('visibilitychange', onVisible);
  }, [runSync, importPending]);

  const resetOtpFlow = useCallback(() => {
    otpSendGeneration.current += 1;
    setOtpSent(false);
    setOtpEmail(null);
    otpEmailRef.current = null;
  }, []);

  const handleSendOtp = useCallback(async (email: string) => {
    const trimmed = email.trim();
    const sendGen = otpSendGeneration.current;
    const result = await sendOtp(trimmed);
    if (otpSendGeneration.current !== sendGen) {
      return { ok: false, error: '送信がキャンセルされました。' };
    }
    if (result.ok) {
      otpEmailRef.current = trimmed;
      setOtpEmail(trimmed);
      setOtpSent(true);
    }
    return result;
  }, []);

  const handleVerifyOtp = useCallback(async (token: string) => {
    const verifyEmail = otpEmailRef.current;
    if (!verifyEmail) {
      return { ok: false, error: 'メールアドレスを入力してコードを送信してください。' };
    }
    authGeneration.current += 1;
    const gen = authGeneration.current;
    setImportPending(true);

    const result = await verifyOtp(verifyEmail, token);
    if (!result.ok || !result.user) {
      setImportPending(false);
      return result;
    }

    const uid = result.user.id;
    userIdRef.current = uid;
    storeRef.current.setUserScope(uid);
    await setCurrentUserId(uid);

    const guestLoad = await loadState(null);
    const localGuest = guestLoad.state;
    const cloud = await pullCloudState(uid);
    if (authGeneration.current !== gen) return result;

    if (!cloud.ok) {
      setSyncError(cloud.error);
      setImportPending(false);
      setUser(result.user);
      setOtpSent(false);
      return result;
    }

    const guestHasData = localGuest.observations.length > 0 || localGuest.plants.length > 0;

    if (!cloud.exists && guestHasData) {
      setConflict({
        info: {
          cloudRevision: 0,
          localRevision: localGuest.sync.revision,
          cloudObservationCount: 0,
          localObservationCount: localGuest.observations.length,
          cloudPlantCount: 0,
          localPlantCount: localGuest.plants.length,
        },
        cloudState: createEmptyState(),
        localState: localGuest,
      });
      setImportPending(true);
      setUser(result.user);
      setOtpSent(false);
      return result;
    }

    if (cloud.exists && guestHasData) {
      setConflict({
        info: {
          cloudRevision: cloud.snapshot.revision,
          localRevision: localGuest.sync.revision,
          cloudObservationCount: cloud.snapshot.state.observations.length,
          localObservationCount: localGuest.observations.length,
          cloudPlantCount: cloud.snapshot.state.plants.length,
          localPlantCount: localGuest.plants.length,
        },
        cloudState: cloud.snapshot.state,
        localState: localGuest,
      });
      setImportPending(true);
    } else if (cloud.exists) {
      syncBaseStateRef.current = cloud.snapshot.state;
      await storeRef.current.replaceState(cloud.snapshot.state);
      if (guestHasData) await clearScopeData(null);
      setImportPending(false);
    } else {
      await storeRef.current.reload(uid);
      setImportPending(false);
    }

    setUser(result.user);
    setOtpSent(false);
    setOtpEmail(null);
    otpEmailRef.current = null;
    return result;
  }, []);

  const dismissConflict = useCallback(() => setConflict(null), []);

  const resolveConflict = useCallback(
    async (choice: 'cloud' | 'local') => {
      const uid = userIdRef.current;
      const active = conflictRef.current;
      if (!active || !uid) return;
      storeRef.current.setUserScope(uid);
      const gen = authGeneration.current;
      const { info, cloudState, localState } = active;

      const isEmptyCloudChoice = info.cloudRevision === 0
        && info.cloudObservationCount === 0
        && info.cloudPlantCount === 0;

      if (choice === 'cloud') {
        await shelveGarden(uid, 'この端末の庭（退避）', localState);
        if (isEmptyCloudChoice) {
          const empty = createEmptyState();
          syncBaseStateRef.current = empty;
          await storeRef.current.replaceState(empty);
        } else {
          const applied = applyPulledState(cloudState, info.cloudRevision);
          syncBaseStateRef.current = applied;
          await storeRef.current.replaceState(applied);
        }
        await clearScopeData(null);
        setImportPending(false);
      } else {
        if (!isEmptyCloudChoice) {
          await shelveGarden(uid, 'クラウドの庭（退避）', cloudState);
        }
        syncBaseStateRef.current = localState;
        await storeRef.current.replaceState(localState);
        const expectedRevision = info.cloudRevision > 0 ? info.cloudRevision : null;
        const push = await pushCloudState(uid, localState, expectedRevision);
        if (authGeneration.current !== gen) return;
        if (push.ok && push.newRevision != null) {
          const synced = applySyncedState(localState, push.newRevision, cloudState.sync.tombstoneRevision);
          syncBaseStateRef.current = synced;
          await storeRef.current.replaceState(synced);
        }
        await clearScopeData(null);
        setImportPending(false);
        if (!push.ok) setSyncError(push.error ?? '同期に失敗しました');
      }
      setConflict(null);
    },
    [runSync],
  );

  const handleSignOut = useCallback(
    async (discardPending = false): Promise<SignOutResult> => {
      if (!discardPending && storeRef.current.state.sync.pendingChanges) {
        return { needsConfirm: true };
      }
      const uid = userIdRef.current;
      const signOutResult = await signOut();
      if (!signOutResult.ok) {
        return {
          needsConfirm: false,
          ok: false,
          error: signOutResult.error ?? 'ログアウトに失敗しました。接続を確認してからもう一度お試しください。',
        };
      }
      authGeneration.current += 1;
      await clearDraftForScope(uid);
      storeRef.current.setUserScope(null);
      await setCurrentUserId(null);
      userIdRef.current = null;
      resetUiSession();
      setUser(null);
      if (uid) await clearScopeData(uid);
      await storeRef.current.reload(null);
      setSyncStatus(isSupabaseConfigured() ? 'idle' : 'not_configured');
      return { needsConfirm: false, ok: true };
    },
    [resetUiSession],
  );

  const handleDeleteAccount = useCallback(async () => {
    const uid = userIdRef.current;
    const result = await deleteAccount();
    if (result.ok) {
      authGeneration.current += 1;
      await setCurrentUserId(null);
      userIdRef.current = null;
      resetUiSession();
      setUser(null);
      if (uid) await clearScopeData(uid);
      await clearDraftForScope(null);
      await storeRef.current.reload(null);
      setSyncStatus(isSupabaseConfigured() ? 'idle' : 'not_configured');
    }
    return result;
  }, [resetUiSession]);

  const authPhase = getAuthPhase(user, otpSent);
  const initialScreen: Screen = onboardingComplete ? 'garden' : 'onboarding';

  return {
    user,
    authPhase,
    onboardingComplete,
    completeOnboarding,
    draft,
    persistDraft,
    syncStatus,
    syncError,
    conflict,
    dismissConflict,
    resolveConflict,
    runSync,
    otpEmail,
    resetOtpFlow,
    handleSendOtp,
    handleVerifyOtp,
    handleSignOut,
    handleDeleteAccount,
    isAuthEmailDeliveryReady: isAuthEmailDeliveryReady(),
    syncHalted,
    importPending,
    setSyncHalted: async (v: boolean) => {
      await setSyncHalted(v);
      setSyncHaltedState(v);
    },
    online,
    initialScreen,
    metaLoaded,
    isSupabaseConfigured: isSupabaseConfigured(),
  };
}

export type AppSession = ReturnType<typeof useAppSession>;
