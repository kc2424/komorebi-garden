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
  color: null,
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
      version: 2,
      soilTiles: [],
      plants: [],
      stashedPlants: [],
      observations: [otherObservation],
      tulipUnlocked: true,
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
});
