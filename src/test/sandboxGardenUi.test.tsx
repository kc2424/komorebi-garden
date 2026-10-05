import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { GardenScreen } from '../components/garden/GardenScreen';
import { useGardenStore } from '../hooks/useGardenStore';
import { createEmptyState, saveState } from '../storage/persistence';
import { placeDecorationAction, plantFlowerAction } from '../storage/gardenActions';
import type { GardenState } from '../types';

vi.mock('../components/garden/FlowerPreviewCanvas', () => ({ FlowerPreviewCanvas: () => null }));
vi.mock('../components/garden3d/Garden3DCanvas', () => ({
  Garden3DCanvas: ({ soilTiles, plants, decorations, pendingPlacementTileId, focusPlantId, cameraResetKey, memoryPanelOpen, onTileClick, onPlantClick, onDecorationClick }: {
    soilTiles: GardenState['soilTiles'];
    plants: GardenState['plants'];
    decorations: GardenState['decorations'];
    pendingPlacementTileId: string | null;
    focusPlantId: string | null;
    cameraResetKey: number;
    memoryPanelOpen: boolean;
    onTileClick: (id: string) => void;
    onPlantClick: (id: string) => void;
    onDecorationClick: (id: string) => void;
  }) => (
    <div data-testid="scene-camera" data-focus={focusPlantId ?? ''} data-reset={cameraResetKey} data-memory={memoryPanelOpen}>
      {pendingPlacementTileId && <span data-testid="scene-preview">仮置き</span>}
      {soilTiles.map((tile) => <button key={tile.id} onClick={() => onTileClick(tile.id)}>{`地面 ${tile.id}`}</button>)}
      {plants.map((plant) => <button key={plant.id} data-testid="scene-flower" data-tile={plant.tileId} onClick={() => onPlantClick(plant.id)}>庭の花を選択</button>)}
      {decorations.map((item) => <button key={item.id} data-testid={`scene-${item.type}`} onClick={() => onDecorationClick(item.id)}>{`庭の飾り ${item.type}`}</button>)}
    </div>
  ),
}));

function Harness() {
  const store = useGardenStore();
  if (!store.hydrated) return null;
  return <GardenScreen store={store} onDiscover={vi.fn()} onObservations={vi.fn()} onSettings={vi.fn()} />;
}

describe('sandbox item editing', () => {
  beforeEach(() => localStorage.clear());

  it('moves the already selected flower without asking the user to select it again', async () => {
    let state = createEmptyState();
    state = plantFlowerAction(state, state.soilTiles[0].id, 'tulip', 'red');
    const destinationId = state.soilTiles[1].id;
    await saveState(state);
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: '庭づくり' }));
    fireEvent.click(screen.getByRole('button', { name: '庭の花を選択' }));
    fireEvent.click(screen.getByRole('button', { name: '移動する' }));
    fireEvent.click(screen.getByRole('button', { name: `地面 ${destinationId}` }));
    await waitFor(() => expect(screen.getByTestId('scene-flower')).toHaveAttribute('data-tile', destinationId));
  });

  it('replaces selected-item actions with placement controls when another decoration is chosen', async () => {
    let state = createEmptyState();
    state = placeDecorationAction(state, state.soilTiles[0].id, 'round-stone');
    await saveState(state);
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: '庭づくり' }));
    fireEvent.click(screen.getByRole('tab', { name: '飾り' }));
    fireEvent.click(screen.getByRole('button', { name: '庭の飾り round-stone' }));
    expect(screen.getByRole('button', { name: '移動する' })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('tab', { name: '飾り' }));
    fireEvent.click(screen.getByRole('button', { name: 'ランタン' }));
    expect(screen.queryByRole('button', { name: '移動する' })).not.toBeInTheDocument();
    expect(screen.getAllByRole('button', { name: '向きを回す' })).toHaveLength(1);
    fireEvent.click(screen.getByRole('button', { name: `地面 ${state.soilTiles[1].id}` }));
    fireEvent.click(screen.getByRole('button', { name: 'ここに置く' }));
    expect(await screen.findByTestId('scene-lantern')).toBeInTheDocument();
    expect(screen.getByTestId('scene-round-stone')).toBeInTheDocument();
  });

  it('removes an unconfirmed decoration preview when returning to viewing', async () => {
    const state = createEmptyState();
    await saveState(state);
    render(<Harness />);
    fireEvent.click(await screen.findByRole('button', { name: '庭づくり' }));
    fireEvent.click(screen.getByRole('tab', { name: '飾り' }));
    fireEvent.click(screen.getByRole('button', { name: '木のベンチ' }));
    fireEvent.click(screen.getByRole('button', { name: `地面 ${state.soilTiles[0].id}` }));
    expect(screen.getByTestId('scene-preview')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '眺める' }));
    expect(screen.queryByTestId('scene-preview')).not.toBeInTheDocument();
    expect(screen.queryByTestId('scene-bench')).not.toBeInTheDocument();
  });


  it('always returns from an intentionally focused plant to the overview, and repeats a reset', async () => {
    let state = createEmptyState();
    state = plantFlowerAction(state, state.soilTiles[0].id, 'tulip', 'red');
    await saveState(state);
    render(<Harness />);
    const scene = await screen.findByTestId('scene-camera');
    expect(scene).toHaveAttribute('data-focus', '');
    fireEvent.click(screen.getByRole('button', { name: '庭の花を選択' }));
    expect(scene).toHaveAttribute('data-focus', state.plants[0].id);
    expect(scene).toHaveAttribute('data-memory', 'true');
    fireEvent.click(screen.getByRole('button', { name: '庭全体を見る' }));
    expect(scene).toHaveAttribute('data-focus', '');
    expect(scene).toHaveAttribute('data-memory', 'false');
    expect(scene).toHaveAttribute('data-reset', '1');
    fireEvent.click(screen.getByRole('button', { name: '庭全体を見る' }));
    expect(scene).toHaveAttribute('data-reset', '2');
  });

});
