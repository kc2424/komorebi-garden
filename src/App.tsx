import { useCallback, useEffect, useState } from 'react';
import type { DiscoveryDraft, RegistrationResult, Screen } from './types';
import { useGardenStore } from './hooks/useGardenStore';
import { GardenScreen } from './components/garden/GardenScreen';
import { DiscoverScreen } from './components/discover/DiscoverScreen';
import { IdentifyScreen } from './components/discover/IdentifyScreen';
import { CompleteScreen } from './components/discover/CompleteScreen';
import { ObservationsScreen } from './components/observations/ObservationsScreen';
import { ObservationDetailScreen } from './components/observations/ObservationDetailScreen';
import { CreditsScreen } from './components/credits/CreditsScreen';
import { Banner } from './components/ui/Banner';
import styles from './App.module.css';

export default function App() {
  const store = useGardenStore();
  const [screen, setScreen] = useState<Screen>('garden');
  const [draft, setDraft] = useState<DiscoveryDraft | null>(null);
  const [registrationResult, setRegistrationResult] = useState<RegistrationResult | null>(null);
  const [selectedObservationId, setSelectedObservationId] = useState<string | null>(null);

  const goGarden = useCallback(() => {
    setScreen('garden');
    setDraft(null);
    setRegistrationResult(null);
    setSelectedObservationId(null);
  }, []);

  useEffect(() => {
    store.clearSaveError();
  }, [screen, store.clearSaveError]);

  const handleSaveObservation = useCallback(
    (input: {
      plantType: 'tulip' | 'other';
      commonNameJa: string;
      scientificName: string;
      familyName: string;
      color: import('./types').TulipColor | null;
      isSample: boolean;
      identificationSource: 'sample' | 'plantnet' | 'manual';
    }): boolean => {
      if (!draft) return false;
      const result = store.saveObservation({
        ...input,
        imageDataUrl: draft.imageDataUrl,
      });
      if (!result.saved) return false;
      setRegistrationResult(result);
      setScreen('complete');
      return true;
    },
    [draft, store],
  );

  if (!store.hydrated) {
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

      {screen === 'garden' && (
        <GardenScreen
          store={store}
          onDiscover={() => setScreen('discover')}
          onObservations={() => setScreen('observations')}
          onCredits={() => setScreen('credits')}
        />
      )}

      {screen === 'discover' && (
        <DiscoverScreen
          onBack={goGarden}
          onContinue={(d) => {
            setDraft(d);
            setScreen('identify');
          }}
        />
      )}

      {screen === 'identify' && draft && (
        <IdentifyScreen
          draft={draft}
          onBack={() => {
            setDraft(null);
            setScreen('discover');
          }}
          onSave={handleSaveObservation}
        />
      )}

      {screen === 'complete' && registrationResult && (
        <CompleteScreen result={registrationResult} onGoGarden={goGarden} />
      )}

      {screen === 'observations' && (
        <ObservationsScreen
          store={store}
          onBack={goGarden}
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
        />
      )}

      {screen === 'credits' && <CreditsScreen onBack={goGarden} />}
    </main>
  );
}
