import { describe, it, expect, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { FlowerCatalogSheet } from '../components/garden/FlowerCatalogSheet';
import type { GardenPlant } from '../types';

const stashedCosmos: GardenPlant = {
  id: 'stash-cosmos-1',
  modelType: 'cosmos',
  color: 'pink',
  tileId: 'soil-0-0',
  rotation: 1.1,
};

describe('FlowerCatalogSheet stash restoration', () => {
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

    expect(document.querySelectorAll('img')).toHaveLength(1);
    expect(document.querySelector('canvas')).toBeNull();
    expect(screen.getByText('コスモス')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /花を選び直す/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'チューリップ' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'パンジー' })).not.toBeInTheDocument();


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

  it('filters and searches twenty static plant previews without creating WebGL canvases', () => {
    render(<FlowerCatalogSheet expanded selectedModelType={null} displayModelType={null} displayColor="red" plantColor="red" tulipUnlocked={false} onSelect={vi.fn()} onReselect={vi.fn()} />);
    expect(document.querySelectorAll('img')).toHaveLength(20);
    expect(document.querySelector('canvas')).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: '木' }));
    expect(document.querySelectorAll('img')).toHaveLength(2);
    fireEvent.click(screen.getByRole('button', { name: 'すべて' }));
    fireEvent.change(screen.getByRole('searchbox', { name: '植物を探す' }), { target: { value: 'ちゅーりっぷ' } });
    expect(screen.getByRole('button', { name: 'チューリップ' })).toBeInTheDocument();
    expect(document.querySelectorAll('img')).toHaveLength(1);
  });

});
