import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { DiscoveryDraft, RegistrationResult, Screen } from './types';
import type { GardenVisit } from './utils/gardenInvite';
import { SHOWCASE_GARDENS } from './data/showcaseGardens';
import {
  clearVisitsHistoryMarker,
  consumeVisitsHistoryBack,
  consumeVisitsHistoryToGarden,
  pushVisitsHistory,
  readVisitsMarker,
  replaceVisitsHistory,
} from './utils/visitsHistory';
import { useGardenStore } from './hooks/useGardenStore';
import { useAppSession } from './hooks/useAppSession';
import { OnboardingScreen } from './components/onboarding/OnboardingScreen';
import { GardenScreen } from './components/garden/GardenScreen';
import { DiscoverScreen } from './components/discover/DiscoverScreen';
import { PhotoConfirmScreen } from './components/discover/PhotoConfirmScreen';
import { IdentifyScreen } from './components/discover/IdentifyScreen';
import { CompleteScreen } from './components/discover/CompleteScreen';
import { ObservationsScreen } from './components/observations/ObservationsScreen';
import { ObservationDetailScreen } from './components/observations/ObservationDetailScreen';
import { SettingsScreen } from './components/settings/SettingsScreen';
import { DataManagementScreen } from './components/settings/DataManagementScreen';
import { AuthScreen } from './components/settings/AuthScreen';
import { HelpScreen } from './components/settings/HelpScreen';
import { PrivacyScreen } from './components/settings/PrivacyScreen';
import { CreditsScreen } from './components/credits/CreditsScreen';
import { OutingsScreen } from './components/visits/OutingsScreen';
import { GardenVisitScreen } from './components/visits/GardenVisitScreen';
import { Banner } from './components/ui/Banner';
import { ConfirmModal } from './components/ui/ConfirmModal';
import { ConflictModal } from './components/ui/ConflictModal';
import { registerBackButton } from './platform/native';
import { canPlantObservationInGarden } from './utils/plantObservationLink';
import styles from './App.module.css';

export default function App() {
  const store = useGardenStore();
  const session = useAppSession(store);
  const [screen, setScreen] = useState<Screen>('garden');
  const [draft, setDraft] = useState<DiscoveryDraft | null>(null);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);
  const [tulipFilter, setTulipFilter] = useState(false);
  const [showDraftResume, setShowDraftResume] = useState(false);
  const [showDiscardConfirm, setShowDiscardConfirm] = useState(false);
  const [plantFromObservationId, setPlantFromObservationId] = useState<string | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [identifyAutoStart, setIdentifyAutoStart] = useState(false);
  const [selectedVisit, setSelectedVisit] = useState<GardenVisit | null>(null);
  const visitSessionCacheRef = useRef(new Map<string, GardenVisit>());
  const visitsHistoryNormalizedRef = useRef(false);
  const accountScope = session.user?.id ?? 'guest';
  const previousAccountScopeRef = useRef(accountScope);

  const resolveVisitFromMarker = useCallback((visitId?: string): GardenVisit | null => {
    if (!visitId) return null;
    const cached = visitSessionCacheRef.current.get(visitId);
    if (cached) return cached;
    return SHOWCASE_GARDENS.find((garden) => garden.id === visitId) ?? null;
  }, []);

  const applyVisitsHistoryMarker = useCallback(() => {
    const marker = readVisitsMarker(history.state);
    if (!marker) {
      setSelectedVisit(null);
      setScreen('garden');
      return;
    }
    if (marker.layer === 'outings') {
      setSelectedVisit(null);
      setScreen('outings');
      return;
    }
    const visit = resolveVisitFromMarker(marker.visitId);
    if (visit) {
      visitSessionCacheRef.current.set(visit.id, visit);
      setSelectedVisit(visit);
      setScreen('garden-visit');
      return;
    }
    setSelectedVisit(null);
    setScreen('outings');
    replaceVisitsHistory({ layer: 'outings' });
  }, [resolveVisitFromMarker]);

  useEffect(() => {
    if (store.hydrated && session.metaLoaded && !initialized) {
      const hasExistingData =
        store.state.observations.length > 0 ||
        store.state.plants.length > 0 ||
        store.state.stashedPlants.length > 0 ||
        store.state.decorations.length > 0 ||
        store.state.stashedDecorations.length > 0 ||
        store.state.soilTiles.length !== 25 ||
        store.state.soilTiles.some((tile) => (tile.surface ?? 'grass') !== 'grass') ||
        store.state.tulipUnlocked ||
        Boolean(store.state.legacyV1);
      if (!session.onboardingComplete && hasExistingData) {
        void session.completeOnboarding();
      }
      setScreen(session.onboardingComplete || hasExistingData ? 'garden' : 'onboarding');
      if (session.draft) setShowDraftResume(true);
      setInitialized(true);
    }
  }, [store.hydrated, session.metaLoaded, session.onboardingComplete, session.draft, initialized, store.state, session]);

  const goGarden = useCallback(() => {
    clearVisitsHistoryMarker();
    setSelectedVisit(null);
    setScreen('garden');
    setDraft(null);
    setRegistrationResult(null);
    setSelectedObservationId(null);
    setTulipFilter(false);
  }, []);

  const openOutings = useCallback(() => {
    pushVisitsHistory({ layer: 'outings' });
    setSelectedVisit(null);
    setScreen('outings');
  }, []);

  const openGardenVisit = useCallback((visit: GardenVisit) => {
    visitSessionCacheRef.current.set(visit.id, visit);
    pushVisitsHistory({ layer: 'garden-visit', visitId: visit.id });
    setSelectedVisit(visit);
    setScreen('garden-visit');
  }, []);

  const leaveGardenVisit = useCallback(() => {
    if (!consumeVisitsHistoryBack('garden-visit')) {
      setSelectedVisit(null);
      setScreen('outings');
    }
  }, []);

  const leaveOutings = useCallback(() => {
    if (!consumeVisitsHistoryBack('outings')) {
      goGarden();
    }
  }, [goGarden]);

  const leaveVisitForOwnGarden = useCallback(() => {
    const closingVisitId = selectedVisit?.id;
    setSelectedVisit(null);
    if (closingVisitId) {
      visitSessionCacheRef.current.delete(closingVisitId);
    }
    if (!consumeVisitsHistoryToGarden()) {
      goGarden();
    }
  }, [goGarden, selectedVisit]);

  useEffect(() => {
    if (!initialized || visitsHistoryNormalizedRef.current) return;
    visitsHistoryNormalizedRef.current = true;
    if (readVisitsMarker(history.state)) {
      clearVisitsHistoryMarker();
      setSelectedVisit(null);
      setScreen('garden');
    }
  }, [initialized]);

  useEffect(() => {
    const onPopState = () => {
      applyVisitsHistoryMarker();
    };
    window.addEventListener('popstate', onPopState);
    return () => window.removeEventListener('popstate', onPopState);
  }, [applyVisitsHistoryMarker]);

  useEffect(() => {
    store.clearSaveError();
  }, [screen, store.clearSaveError]);

  useEffect(() => {
    if (previousAccountScopeRef.current === accountScope) return;
    previousAccountScopeRef.current = accountScope;
    setSelectedVisit(null);
    clearVisitsHistoryMarker();
    if (screen === 'garden-visit' || screen === 'outings') setScreen('garden');
  }, [accountScope, screen]);

  const savedObservation = useMemo(() => {
    if (!registrationResult) return null;
    return store.state.observations.find((o) => o.id === registrationResult.observationId) ?? null;
  }, [registrationResult, store.state.observations]);

  const handleSaveObservation = useCallback(
    async (input: {
      plantType: 'tulip' | 'other';
      commonNameJa: string;
      scientificName: string;
      familyName: string;
      trait: string;
      color: import('./types').TulipColor | null;
      isSample: boolean;
      identificationSource: 'sample' | 'plantnet' | 'manual';
    }): Promise<boolean> => {
      if (!draft) return false;
      const result = await store.saveObservation({
        ...input,
        imageDataUrl: draft.imageDataUrl,
      });
      if (!result.saved) return false;
      void session.persistDraft(null);
      setShowDraftResume(false);
      setRegistrationResult(result);
      setScreen('complete');
      if (session.user) void session.runSync();
      return true;
    },
    [draft, store, session],
  );

  const startDiscover = useCallback(async () => {
    if (session.draft && !draft) {
      setShowDraftResume(true);
      return;
    }
    setScreen('discover');
  }, [session.draft, draft]);

  const resumeDraft = useCallback(() => {
    if (session.draft) {
      setDraft(session.draft);
      setIdentifyAutoStart(false);
      setScreen(session.draft.step === 'identify' ? 'identify' : 'photo-confirm');
      setShowDraftResume(false);
    }
  }, [session.draft]);

  const dismissDraftResume = useCallback(() => {
    setShowDraftResume(false);
  }, []);

  const discardDraft = useCallback(async () => {
    await session.persistDraft(null);
    setShowDraftResume(false);
    setShowDiscardConfirm(false);
    setDraft(null);
  }, [session]);

  const handlePlantObservation = useCallback((observationId: string) => {
    setPlantFromObservationId(observationId);
    setRegistrationResult(null);
    setScreen('garden');
  }, []);

  useEffect(() => {
    return registerBackButton(() => {
      if (showDiscardConfirm) {
        setShowDiscardConfirm(false);
        return true;
      }
      if (showDraftResume && session.draft) {
        dismissDraftResume();
        return true;
      }
      if (session.conflict) {
        session.dismissConflict();
        return true;
      }
      if (screen === 'garden' || screen === 'onboarding') return false;
      if (screen === 'photo-confirm') { setScreen('discover'); return true; }
      if (screen === 'identify') { setScreen('photo-confirm'); return true; }
      if (screen === 'discover' || screen === 'complete') { goGarden(); return true; }
      if (screen === 'observation-detail') { setScreen('observations'); return true; }
      if (screen === 'observations') { goGarden(); return true; }
      if (screen === 'garden-visit') {
        leaveGardenVisit();
        return true;
      }
      if (screen === 'outings') {
        leaveOutings();
        return true;
      }
      if (['settings', 'data-management', 'auth', 'help', 'privacy', 'credits'].includes(screen)) {
        setScreen(screen === 'settings' ? 'garden' : 'settings');
        return true;
      }
      goGarden();
      return true;
    });
  }, [
    screen,
    goGarden,
    leaveGardenVisit,
    leaveOutings,
    showDiscardConfirm,
    showDraftResume,
    session.draft,
    session.conflict,
    session.dismissConflict,
    dismissDraftResume,
  ]);

  if (!store.hydrated || !session.metaLoaded || !initialized) {
    return (
      <div className={styles.loading} role="status" aria-live="polite">
        読み込み中…
      </div>
    );
  }

  return (
    <main className={styles.app}>
      {(store.saveError || store.loadError) && (
        <div className={styles.errorBar}>
          {store.loadError && (
            <Banner variant="error" message={store.loadError} onDismiss={store.clearLoadError} />
          )}
          {store.saveError && (
            <Banner variant="error" message={store.saveError} onDismiss={store.clearSaveError} />
          )}
        </div>
      )}

      {showDraftResume && session.draft && screen === 'garden' && !showDiscardConfirm && (
        <ConfirmModal
          title="途中の観察があります"
          message="前回の観察を再開しますか？識別は自動で再送信されません。"
          confirmLabel="再開する"
          cancelLabel="あとで"
          onConfirm={resumeDraft}
          onCancel={dismissDraftResume}
          onDismiss={dismissDraftResume}
          extraAction={{
            label: '下書きを破棄',
            onClick: () => setShowDiscardConfirm(true),
          }}
        />
      )}

      {showDiscardConfirm && (
        <ConfirmModal
          title="下書きを破棄"
          message="保存前の観察データを削除します。元に戻せません。"
          confirmLabel="破棄する"
          cancelLabel="キャンセル"
          destructive
          onConfirm={() => void discardDraft()}
          onCancel={() => setShowDiscardConfirm(false)}
        />
      )}

      {session.conflict && (
        <ConflictModal
          info={session.conflict.info}
          onChooseCloud={() => void session.resolveConflict('cloud')}
          onChooseLocal={() => void session.resolveConflict('local')}
          onCancel={session.dismissConflict}
        />
      )}

      {screen === 'onboarding' && (
        <OnboardingScreen
          onDiscover={async () => {
            await session.completeOnboarding();
            setScreen('discover');
          }}
          onViewGarden={async () => {
            await session.completeOnboarding();
            store.enterBuildingPhase();
            setScreen('garden');
          }}
          onLoginTransfer={async () => {
            await session.completeOnboarding();
            setScreen('auth');
          }}
        />
      )}

      {screen === 'garden' && (
        <GardenScreen
          store={store}
          onDiscover={() => void startDiscover()}
          onObservations={() => {
            setTulipFilter(false);
            setScreen('observations');
          }}
          onSettings={() => setScreen('settings')}
          onOutings={openOutings}
          onViewTulipObservations={() => {
            setTulipFilter(true);
            setScreen('observations');
          }}
          plantObservationId={plantFromObservationId}
          onPlantObservationHandled={() => setPlantFromObservationId(null)}
          syncStatus={session.syncStatus}
        />
      )}

      {screen === 'outings' && (
        <OutingsScreen
          garden={store.state}
          onBack={leaveOutings}
          onVisit={openGardenVisit}
        />
      )}

      {screen === 'garden-visit' && selectedVisit && (
        <GardenVisitScreen
          key={selectedVisit.id}
          visit={selectedVisit}
          onBack={leaveGardenVisit}
          onGoGarden={leaveVisitForOwnGarden}
        />
      )}

      {screen === 'discover' && (
        <DiscoverScreen
          onBack={goGarden}
          onContinue={async (d) => {
            await session.persistDraft(d);
            setDraft(d);
            setScreen('photo-confirm');
          }}
        />
      )}

      {screen === 'photo-confirm' && draft && (
        <PhotoConfirmScreen
          draft={draft}
          onRetake={() => setScreen('discover')}
          onContinue={async () => {
            const next = { ...draft, step: 'identify' as const };
            await session.persistDraft(next);
            setDraft(next);
            setIdentifyAutoStart(true);
            setScreen('identify');
          }}
        />
      )}

      {screen === 'identify' && draft && (
        <IdentifyScreen
          draft={draft}
          autoStart={identifyAutoStart}
          onBack={() => setScreen('photo-confirm')}
          onDraftChange={async (d) => {
            setDraft(d);
            await session.persistDraft(d);
          }}
          onSave={handleSaveObservation}
        />
      )}

      {screen === 'complete' && registrationResult && savedObservation && (
        <CompleteScreen
          result={registrationResult}
          observation={savedObservation}
          canPlantInGarden={canPlantObservationInGarden(
            registrationResult.observationId,
            store.state.observations,
            store.state.plants,
            store.state.stashedPlants,
            store.state.tulipUnlocked,
          )}
          onPlantInGarden={() => handlePlantObservation(registrationResult.observationId)}
          onGoGarden={goGarden}
          onViewRecord={() => {
            setSelectedObservationId(registrationResult.observationId);
            setScreen('observation-detail');
          }}
        />
      )}

      {screen === 'observations' && (
        <ObservationsScreen
          store={store}
          tulipOnly={tulipFilter}
          onBack={goGarden}
          onDiscover={() => setScreen('discover')}
          onSelect={(id) => {
            setSelectedObservationId(id);
            setScreen('observation-detail');
          }}
        />
      )}

      {screen === 'observation-detail' && selectedObservationId && (
        <ObservationDetailScreen
          store={store}
          observationId={selectedObservationId}
          onBack={() => setScreen('observations')}
          onPlantInGarden={handlePlantObservation}
        />
      )}

      {screen === 'settings' && (
        <SettingsScreen
          session={session}
          onBack={goGarden}
          onHelp={() => setScreen('help')}
          onDataManagement={() => setScreen('data-management')}
          onAuth={() => setScreen('auth')}
          onPrivacy={() => setScreen('privacy')}
          onCredits={() => setScreen('credits')}
        />
      )}

      {screen === 'data-management' && (
        <DataManagementScreen store={store} session={session} onBack={() => setScreen('settings')} />
      )}

      {screen === 'auth' && (
        <AuthScreen session={session} onBack={() => setScreen('settings')} />
      )}

      {screen === 'help' && (
        <HelpScreen
          onBack={() => setScreen('settings')}
          onShowOnboarding={() => setScreen('onboarding')}
        />
      )}

      {screen === 'privacy' && (
        <PrivacyScreen session={session} onBack={() => setScreen('settings')} />
      )}

      {screen === 'credits' && <CreditsScreen onBack={() => setScreen('settings')} />}

    </main>
  );
}
