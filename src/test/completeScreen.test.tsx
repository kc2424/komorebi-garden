import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { CompleteScreen } from '../components/discover/CompleteScreen';
import type { PlantObservation, RegistrationResult } from '../types';

const observation: PlantObservation = {
  id: 'obs-complete-1',
  plantType: 'tulip',
  commonNameJa: 'チューリップ',
  scientificName: 'Tulipa gesneriana',
  familyName: 'ユリ科',
  color: 'red',
  imageDataUrl: 'data:image/jpeg;base64,complete-photo',
  takenAt: '2026-09-01T03:00:00.000Z',
  memo: '',
  isSample: true,
  identificationSource: 'sample',
  createdAt: '2026-09-01T03:00:00.000Z',
};

const result: RegistrationResult = {
  type: 'new',
  observationId: 'obs-complete-1',
  plantType: 'tulip',
  commonNameJa: 'チューリップ',
  tulipUnlocked: true,
  saved: true,
};

describe('CompleteScreen', () => {
  it('shows the saved observation photo, name, date and sample label', () => {
    render(
      <CompleteScreen
        result={result}
        observation={observation}
        onGoGarden={vi.fn()}
        onViewRecord={vi.fn()}
      />,
    );

    const photo = screen.getByRole('img', { name: 'チューリップの写真' });
    expect(photo).toHaveAttribute('src', observation.imageDataUrl);
    expect(screen.getByText('チューリップ')).toBeInTheDocument();
    expect(screen.getByText('2026年9月1日')).toBeInTheDocument();
    expect(screen.getByText('サンプル写真・固定候補')).toBeInTheDocument();
  });

  it('navigates to the same observation detail via secondary action', () => {
    const onViewRecord = vi.fn();
    render(
      <CompleteScreen
        result={result}
        observation={observation}
        onGoGarden={vi.fn()}
        onViewRecord={onViewRecord}
      />,
    );

    fireEvent.click(screen.getByRole('button', { name: '記録を見る' }));
    expect(onViewRecord).toHaveBeenCalledTimes(1);
  });
});
