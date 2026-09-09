import { useEffect, useMemo } from 'react';
import type { GardenStore } from '../../hooks/useGardenStore';
import type { PlantObservation } from '../../types';
import { getPlantDisplayName } from '../../data/flowerCatalog';
import { getModelPreviewLabel, resolvePlantModelType } from '../../utils/plantModel';
import {
  getLinkedObservations,
  getNavigableObservations,
  resolveMemoryNavigationTarget,
} from '../../utils/plantObservationLink';
import styles from './GardenMemoryPanel.module.css';

interface GardenMemoryPanelProps {
  store: GardenStore;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString('ja-JP', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  } catch {
    return iso;
  }
}

function sourceLabel(source: PlantObservation['identificationSource']): string {
  return {
    sample: 'サンプル（体験用）',
    plantnet: 'Pl@ntNet API',
    manual: '手動選択',
  }[source];
}

export function GardenMemoryPanel({ store }: GardenMemoryPanelProps) {
  const {
    state,
    viewingPlantId,
    viewingObservationId,
    setViewingPlantId,
    setViewingObservationId,
    setLastAdmiredPlantId,
    closeMemoryView,
  } = store;

  const viewingPlant = viewingPlantId
    ? state.plants.find((p) => p.id === viewingPlantId)
    : undefined;

  const linkedObservations = useMemo(() => {
    if (!viewingPlant) return [];
    return getLinkedObservations(viewingPlant, state.observations);
  }, [viewingPlant, state.observations]);

  const navigationList = useMemo(
    () => getNavigableObservations(state.observations),
    [state.observations],
  );

  const currentObservation = useMemo(() => {
    if (viewingObservationId) {
      const found = state.observations.find((o) => o.id === viewingObservationId);
      if (found) return found;
    }
    if (viewingPlant) {
      return linkedObservations[0] ?? null;
    }
    return null;
  }, [viewingObservationId, state.observations, viewingPlant, linkedObservations]);

  const currentLinkStatus = currentObservation
    ? resolveMemoryNavigationTarget(
        currentObservation,
        state.plants,
        state.stashedPlants,
        viewingPlantId,
      ).linkStatus
    : 'unlinked';

  const currentIndex = currentObservation
    ? navigationList.findIndex((o) => o.id === currentObservation.id)
    : -1;

  const goToObservation = (observation: PlantObservation) => {
    setViewingObservationId(observation.id);
    const { plantId } = resolveMemoryNavigationTarget(
      observation,
      state.plants,
      state.stashedPlants,
      viewingPlantId,
    );
    if (plantId) {
      setViewingPlantId(plantId);
      setLastAdmiredPlantId(plantId);
    } else {
      setViewingPlantId(null);
    }
  };

  const goPrev = () => {
    if (navigationList.length === 0 || currentIndex < 0) return;
    const nextIndex = currentIndex <= 0 ? navigationList.length - 1 : currentIndex - 1;
    goToObservation(navigationList[nextIndex]);
  };

  const goNext = () => {
    if (navigationList.length === 0 || currentIndex < 0) return;
    const nextIndex = currentIndex >= navigationList.length - 1 ? 0 : currentIndex + 1;
    goToObservation(navigationList[nextIndex]);
  };

  useEffect(() => {
    if (!viewingPlantId && !viewingObservationId) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        closeMemoryView();
        return;
      }
      if (navigationList.length === 0 || currentIndex < 0) return;
      if (e.key === 'ArrowLeft') {
        e.preventDefault();
        goPrev();
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        goNext();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [
    viewingPlantId,
    viewingObservationId,
    navigationList,
    currentIndex,
    closeMemoryView,
  ]);

  if (!viewingPlantId && !viewingObservationId) return null;

  const modelPreviewNote =
    viewingPlant && !currentObservation
      ? getModelPreviewLabel(resolvePlantModelType(viewingPlant))
      : '';

  const linkNote = (() => {
    if (modelPreviewNote) {
      return `${getPlantDisplayName(viewingPlant!)}の${modelPreviewNote}`;
    }
    if (currentObservation?.plantType === 'other') {
      return 'この植物は庭には植えられませんが、観察記録として残ります。';
    }
    if (currentLinkStatus === 'stashed') {
      return 'この記録に関連づいた花はしまわれています。庭づくりで戻せます。';
    }
    if (currentLinkStatus === 'unlinked') {
      return 'この記録はまだ庭の花と関連づけられていません。庭づくりで関連づけできます。';
    }
    return null;
  })();

  return (
    <section
      className={styles.panel}
      role="dialog"
      aria-label="花の思い出"
      aria-modal="false"
    >
      <div className={styles.handle} aria-hidden="true" />

      <div className={styles.scrollArea}>
        <div className={styles.header}>
          <h2 className={styles.title}>
            {currentObservation?.commonNameJa ??
              (viewingPlant ? getPlantDisplayName(viewingPlant) : '思い出')}
          </h2>
          <button
            type="button"
            className={styles.closeBtn}
            onClick={closeMemoryView}
            aria-label="閉じる"
          >
            ×
          </button>
        </div>

        {currentObservation ? (
          <>
            <div className={styles.metaRow}>
              <p className={styles.date}>{formatDate(currentObservation.takenAt)}</p>
              <p className={styles.source}>{sourceLabel(currentObservation.identificationSource)}</p>
            </div>

            <img
              src={currentObservation.imageDataUrl}
              alt={`${currentObservation.commonNameJa}の写真`}
              className={styles.photo}
            />

            {currentObservation.memo && (
              <p className={styles.memo}>{currentObservation.memo}</p>
            )}

            {linkNote && (
              <p className={styles.unlinkedNote}>{linkNote}</p>
            )}

            {navigationList.length > 1 && (
              <div className={styles.navRow}>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={goPrev}
                  aria-label="前の記録"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M14 6l-6 6 6 6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                  </svg>
                </button>
                <span className={styles.navCount} aria-live="polite">
                  {currentIndex + 1} / {navigationList.length}
                </span>
                <button
                  type="button"
                  className={styles.navBtn}
                  onClick={goNext}
                  aria-label="次の記録"
                >
                  <svg viewBox="0 0 24 24" aria-hidden="true">
                    <path d="M10 6l6 6-6 6" stroke="currentColor" strokeWidth="1.8" fill="none" strokeLinecap="round" />
                  </svg>
                </button>
              </div>
            )}
          </>
        ) : viewingPlant ? (
          <>
            {modelPreviewNote && (
              <p className={styles.unlinkedNote}>{linkNote}</p>
            )}
            {!modelPreviewNote && (
              <p className={styles.empty}>記録を選んで思い出を見られます。</p>
            )}
          </>
        ) : (
          <p className={styles.empty}>
            記録を選んで思い出を見られます。
          </p>
        )}
      </div>
    </section>
  );
}
