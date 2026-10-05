import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { GardenMemoryPanel } from '../components/garden/GardenMemoryPanel';
import type { GardenStore } from '../hooks/useGardenStore';
import type { PlantObservation } from '../types';

const otherObservation: PlantObservation = {
  id: 'obs-other',
  plantType: 'other',
  commonNameJa: 'ヤマアジサイ',
  scientificName: 'Hydrangea serrata',
  familyName: 'アジサイ科',
  trait: '',
  color: null,
  imageRef: 'img-obs-other',
  imageDataUrl: 'data:image/jpeg;base64,x',
  takenAt: '2026-03-01T00:00:00.000Z',
  memo: '',
  isSample: false,
  identificationSource: 'plantnet',
  createdAt: '2026-03-01T00:00:00.000Z',
};

function mockStore(partial: Partial<GardenStore> = {}): GardenStore {
  return {
    state: {
      version: 3,
      soilTiles: [],
      plants: [],
      stashedPlants: [],
      observations: [otherObservation],
      tulipUnlocked: true,
      sync: {
        revision: 0,
        lastSyncedRevision: null,
        pendingChanges: false,
        lastSyncAt: null,
        lastError: null,
        tombstoneRevision: null,
      },
    },
    viewingPlantId: null,
    viewingObservationId: 'obs-other',
    setViewingPlantId: vi.fn(),
    setViewingObservationId: vi.fn(),
    setLastAdmiredPlantId: vi.fn(),
    closeMemoryView: vi.fn(),
    ...partial,
  } as GardenStore;
}

describe('GardenMemoryPanel', () => {
  it('shows an unsupported-garden note for other plant observations', () => {
    render(<GardenMemoryPanel store={mockStore()} />);

    expect(
      screen.getByText('この植物は庭には植えられませんが、観察記録として残ります。'),
    ).toBeInTheDocument();
    expect(
      screen.queryByText(/庭づくりで関連づけできます/),
    ).not.toBeInTheDocument();
  });

  it('introduces an unlinked sandbox plant without borrowing an unrelated photo', () => {
    const store = mockStore();
    store.state.plants = [{ id: 'cherry', tileId: 'soil-0-0', modelType: 'cherry', color: 'pink', rotation: 0 }];
    store.viewingPlantId = 'cherry';
    store.viewingObservationId = null;
    render(<GardenMemoryPanel store={store} />);
    expect(screen.getByRole('dialog', { name: '植物の紹介' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'サクラ' })).toBeInTheDocument();
    expect(screen.getByText('淡いピンクの花が、ふんわり枝を包む木')).toBeInTheDocument();
    expect(screen.queryByAltText('ヤマアジサイの写真')).not.toBeInTheDocument();
    expect(screen.queryByText('記録を選んで思い出を見られます。')).not.toBeInTheDocument();
  });

  it('retains the photo panel when the selected plant explicitly links an observation', () => {
    const store = mockStore();
    store.state.plants = [{ id: 'linked', tileId: 'soil-0-0', modelType: 'tulip', color: 'pink', rotation: 0, observationIds: [otherObservation.id] }];
    store.viewingPlantId = 'linked';
    store.viewingObservationId = null;
    render(<GardenMemoryPanel store={store} />);
    expect(screen.getByRole('dialog', { name: '花の思い出' })).toBeInTheDocument();
    expect(screen.getByAltText('ヤマアジサイの写真')).toHaveAttribute('src', otherObservation.imageDataUrl);
    expect(screen.queryByRole('dialog', { name: '植物の紹介' })).not.toBeInTheDocument();
  });

});
