import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen } from '@testing-library/react';
import { FlowerCatalogSheet } from '../components/garden/FlowerCatalogSheet';
import type { GardenPlant } from '../types';

const previewSlotsSpy = vi.fn();

vi.mock('../components/garden/FlowerPreviewCanvas', () => ({
  FlowerPreviewCanvas: ({ slots }: { slots: unknown[] }) => {
    previewSlotsSpy(slots);
    return <div data-testid="flower-preview-canvas" data-slot-count={slots.length} />;
  },
}));

const stashedCosmos: GardenPlant = {
  id: 'stash-cosmos-1',
  modelType: 'cosmos',
  color: 'pink',
  tileId: 'soil-0-0',
  rotation: 1.1,
};

describe('FlowerCatalogSheet stash restoration', () => {
  beforeEach(() => {
    previewSlotsSpy.mockClear();
  });

  it('shows compact cosmos preview when restoring a stashed plant, not the full catalog', () => {
    render(
      <FlowerCatalogSheet
        expanded={false}
        selectedModelType={null}
        displayModelType="cosmos"
        displayColor="pink"
        plantColor="red"
        tulipUnlocked={false}
        stashedPlants={[stashedCosmos]}
        selectedStashPlantId={stashedCosmos.id}
        onSelect={vi.fn()}
        onSelectStash={vi.fn()}
        onReselect={vi.fn()}
      />,
    );

    expect(screen.getByTestId('flower-preview-canvas')).toHaveAttribute('data-slot-count', '1');
    expect(screen.getByText('コスモス')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /花を選び直す/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'チューリップ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'パンジー' })).not.toBeInTheDocument();

    expect(previewSlotsSpy).toHaveBeenCalledWith([
      expect.objectContaining({
        modelType: 'cosmos',
        color: 'pink',
      }),
    ]);
  });

  it('lists stashed plants in the expanded catalog disclosure', () => {
    render(
      <FlowerCatalogSheet
        expanded={true}
        selectedModelType={null}
        displayModelType={null}
        displayColor="red"
        plantColor="red"
        tulipUnlocked={false}
        stashedPlants={[stashedCosmos]}
        selectedStashPlantId={null}
        onSelect={vi.fn()}
        onSelectStash={vi.fn()}
        onReselect={vi.fn()}
      />,
    );

    expect(screen.getByText('しまった花 (1)')).toBeInTheDocument();
    const stashButton = screen.getByRole('button', { name: 'しまった花: コスモス' });
    expect(stashButton).toBeInTheDocument();
    expect(stashButton).toHaveAttribute('aria-pressed', 'false');
  });
});
