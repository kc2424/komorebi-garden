import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ObservationsScreen } from '../components/observations/ObservationsScreen';
import type { GardenStore } from '../hooks/useGardenStore';
import type { PlantObservation } from '../types';

const observation: PlantObservation = {
  id: 'obs-journal-1',
  plantType: 'tulip',
  commonNameJa: '赤いチューリップ',
  scientificName: 'Tulipa gesneriana',
  familyName: 'ユリ科',
  color: 'red',
  imageDataUrl: 'data:image/jpeg;base64,journal',
  takenAt: '2026-08-15T00:00:00.000Z',
  memo: '',
  isSample: false,
  identificationSource: 'manual',
  createdAt: '2026-08-15T00:00:00.000Z',
};

function mockStore(): GardenStore {
  return {
    state: {
      version: 2,
      soilTiles: [],
      plants: [],
      stashedPlants: [],
      observations: [observation],
      tulipUnlocked: true,
    },
  } as unknown as GardenStore;
}

describe('ObservationsScreen', () => {
  it('opens detail navigation for a journal entry', () => {
    const onSelect = vi.fn();
    render(
      <ObservationsScreen
        store={mockStore()}
        onBack={vi.fn()}
        onDiscover={vi.fn()}
        onSelect={onSelect}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: /赤いチューリップ/ }));
    expect(onSelect).toHaveBeenCalledWith('obs-journal-1');
  });
});
