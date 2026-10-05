import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import App from '../App';
import { GardenVisitScreen } from '../components/visits/GardenVisitScreen';
import { OutingsScreen } from '../components/visits/OutingsScreen';
import { SHOWCASE_GARDENS } from '../data/showcaseGardens';
import { setOnboardingComplete } from '../storage/appMeta';
import { plantFlowerAction, saveObservationAction } from '../storage/gardenActions';
import { createEmptyState } from '../storage/migration';
import { loadState, saveState } from '../storage/persistence';
import { createGardenInvite } from '../utils/gardenInvite';
import {
  readVisitsMarker,
  VISITS_HISTORY_STATE_KEY,
  type VisitsHistoryMarker,
} from '../utils/visitsHistory';

const HISTORY_SEED = { appSeed: true } as const;

function buildHistoryState(
  marker: VisitsHistoryMarker | null,
  seed: Record<string, unknown> = { ...HISTORY_SEED },
): Record<string, unknown> {
  if (marker === null) {
    return { ...seed };
  }
  return {
    ...seed,
    [VISITS_HISTORY_STATE_KEY]: marker,
  };
}

/** Models the history entry the browser has already moved to (no go/back/forward). */
function simulateBrowserPopState(targetState: Record<string, unknown>) {
  act(() => {
    history.replaceState(targetState, '');
    window.dispatchEvent(new PopStateEvent('popstate', { state: targetState }));
  });
}

/** Unavailable invite visit id (not in showcase catalog, not session cache). */
const STALE_INVITE_VISIT_ID = 'kg1-stale-invite-entry-not-recoverable';

let historyBackSpy: MockInstance<typeof history.back> | null = null;
let historyGoSpy: MockInstance<typeof history.go> | null = null;

function restoreTrackedHistorySpies() {
  historyBackSpy?.mockRestore();
  historyBackSpy = null;
  historyGoSpy?.mockRestore();
  historyGoSpy = null;
}

function mockHistoryBack() {
  historyBackSpy?.mockRestore();
  historyBackSpy = vi.spyOn(history, 'back').mockImplementation(() => undefined);
  return historyBackSpy;
}

function mockHistoryGo() {
  historyGoSpy?.mockRestore();
  historyGoSpy = vi.spyOn(history, 'go').mockImplementation(() => undefined);
  return historyGoSpy;
}

vi.mock('../components/garden3d/Garden3DCanvas', () => ({
  Garden3DCanvas: ({
    plants,
    cameraResetKey,
    onPlantClick,
  }: {
    plants: Array<{ id: string }>;
    cameraResetKey: number;
    onPlantClick: (id: string) => void;
  }) => (
    <div data-testid="visit-canvas" data-camera-reset={cameraResetKey}>
      {plants.map((plant) => (
        <button key={plant.id} type="button" onClick={() => onPlantClick(plant.id)}>
          {`見本の植物 ${plant.id}`}
        </button>
      ))}
    </div>
  ),
}));

describe('garden outings and read-only visits', () => {
  beforeEach(async () => {
    localStorage.clear();
    history.replaceState({}, '');
    await setOnboardingComplete(true);
    Object.defineProperty(navigator, 'clipboard', {
      configurable: true,
      value: { writeText: vi.fn().mockRejectedValue(new Error('denied')) },
    });
  });

  afterEach(() => {
    restoreTrackedHistorySpies();
  });

  it('shows three labeled samples and opens a selected garden', () => {
    const onVisit = vi.fn();
    render(<OutingsScreen garden={createEmptyState()} onBack={vi.fn()} onVisit={onVisit} />);
    expect(screen.getAllByText('見本の庭')).toHaveLength(4);
    expect(screen.getAllByRole('button', { name: '庭に遊びに行く' })).toHaveLength(3);
    fireEvent.click(screen.getAllByRole('button', { name: '庭に遊びに行く' })[1]!);
    expect(onVisit).toHaveBeenCalledWith(SHOWCASE_GARDENS[1]);
  });

  it('recovers from invalid import and visits a valid snapshot', () => {
    const ownGarden = createEmptyState();
    const onVisit = vi.fn();
    render(<OutingsScreen garden={ownGarden} onBack={vi.fn()} onVisit={onVisit} />);
    fireEvent.click(screen.getByRole('tab', { name: '招待状' }));
    const importBox = screen.getByLabelText('招待状コード', { selector: '#pasted-invite' });
    fireEvent.change(importBox, { target: { value: 'not-an-invite' } });
    fireEvent.click(screen.getByRole('button', { name: 'この庭を訪ねる' }));
    expect(screen.getByRole('alert')).toHaveTextContent('招待状を読み込めません');

    const valid = createGardenInvite(ownGarden, '友だちの庭', '友だち');
    fireEvent.change(importBox, { target: { value: valid } });
    fireEvent.click(screen.getByRole('button', { name: 'この庭を訪ねる' }));
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
    expect(onVisit).toHaveBeenCalledWith(expect.objectContaining({ title: '友だちの庭', source: 'invite' }));
  });

  it('keeps the code manually accessible when clipboard permission is denied', async () => {
    render(<OutingsScreen garden={createEmptyState()} onBack={vi.fn()} onVisit={vi.fn()} />);
    fireEvent.click(screen.getByRole('tab', { name: '招待状' }));
    fireEvent.click(screen.getByRole('button', { name: '今の庭で招待状を作る' }));
    const codeBox = screen.getByLabelText('招待状コード', { selector: '#created-invite' });
    expect((codeBox as HTMLTextAreaElement).value).toMatch(/^KG1\./);
    fireEvent.click(screen.getByRole('button', { name: 'コードをコピー' }));
    expect(await screen.findByRole('status')).toHaveTextContent('コードを選択');
    expect(codeBox).toHaveFocus();
    expect((codeBox as HTMLTextAreaElement).selectionEnd).toBe((codeBox as HTMLTextAreaElement).value.length);
  });

  it('focuses the visitor title, identifies tapped plants, closes the card with Escape, and resets home view', async () => {
    const onBack = vi.fn();
    render(<GardenVisitScreen visit={SHOWCASE_GARDENS[1]!} onBack={onBack} onGoGarden={vi.fn()} />);
    const heading = screen.getByRole('heading', { name: SHOWCASE_GARDENS[1]!.title, level: 1 });
    await waitFor(() => expect(heading).toHaveFocus());
    fireEvent.click(screen.getAllByRole('button', { name: /見本の植物/ })[0]!);
    expect(screen.getByRole('region', { name: '植物の紹介' })).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(screen.queryByRole('region', { name: '植物の紹介' })).not.toBeInTheDocument();
    expect(onBack).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole('button', { name: '庭全体を見る' }));
    expect(screen.getByTestId('visit-canvas')).toHaveAttribute('data-camera-reset', '1');
    fireEvent.keyDown(window, { key: 'Escape' });
    expect(onBack).toHaveBeenCalledOnce();
  });

  it('returns to the saved own garden without changing photo IDs or links', async () => {
    const observationResult = saveObservationAction(createEmptyState(), {
      plantType: 'tulip',
      commonNameJa: '思い出のチューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      trait: '庭の記録',
      color: 'pink',
      imageDataUrl: 'data:image/jpeg;base64,visit-own-photo',
      isSample: false,
      identificationSource: 'manual',
    });
    const observationId = observationResult.result.observationId;
    const ownState = plantFlowerAction(
      observationResult.nextState,
      observationResult.nextState.soilTiles[0]!.id,
      'tulip',
      'pink',
      observationId,
      0,
    );
    const imageRef = ownState.observations[0]!.imageRef;
    await saveState(ownState);

    history.replaceState(buildHistoryState(null), '');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'おでかけ' }));
    fireEvent.click(screen.getAllByRole('button', { name: '庭に遊びに行く' })[0]!);
    expect(await screen.findByRole('heading', { name: '丘と水辺の植物園', level: 1 })).toBeInTheDocument();

    const visitBackSpy = mockHistoryBack();
    fireEvent.click(screen.getByRole('button', { name: '← 戻る' }));
    expect(visitBackSpy).toHaveBeenCalledTimes(1);
    simulateBrowserPopState(buildHistoryState({ layer: 'outings' }));
    expect(await screen.findByRole('heading', { name: 'おでかけ', level: 1 })).toBeInTheDocument();

    const outingsBackSpy = mockHistoryBack();
    fireEvent.click(screen.getByRole('button', { name: '← 自分の庭' }));
    expect(outingsBackSpy).toHaveBeenCalledTimes(1);
    simulateBrowserPopState(buildHistoryState(null));
    expect(await screen.findByRole('button', { name: 'おでかけ' })).toBeInTheDocument();

    const reloaded = await loadState();
    expect(reloaded.state.observations[0]!.id).toBe(observationId);
    expect(reloaded.state.observations[0]!.imageRef).toBe(imageRef);
    expect(reloaded.state.plants[0]!.observationIds).toEqual([observationId]);
  });

  it('consumes history.back when leaving a visit explicitly, then popstate shows outings', async () => {
    history.replaceState(buildHistoryState(null), '');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'おでかけ' }));
    fireEvent.click(screen.getAllByRole('button', { name: '庭に遊びに行く' })[0]!);
    expect(await screen.findByRole('heading', { name: '丘と水辺の植物園', level: 1 })).toBeInTheDocument();

    const backSpy = mockHistoryBack();
    fireEvent.click(screen.getByRole('button', { name: '← 戻る' }));
    expect(backSpy).toHaveBeenCalledTimes(1);

    simulateBrowserPopState(buildHistoryState({ layer: 'outings' }));
    expect(await screen.findByRole('heading', { name: 'おでかけ', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '丘と水辺の植物園', level: 1 })).not.toBeInTheDocument();
    expect(history.state).toMatchObject(HISTORY_SEED);
    expect(readVisitsMarker(history.state)?.layer).toBe('outings');
  });

  it('consumes history.back when leaving outings explicitly, then popstate shows own garden', async () => {
    history.replaceState(buildHistoryState(null), '');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'おでかけ' }));
    expect(await screen.findByRole('heading', { name: 'おでかけ', level: 1 })).toBeInTheDocument();

    const backSpy = mockHistoryBack();
    fireEvent.click(screen.getByRole('button', { name: '← 自分の庭' }));
    expect(backSpy).toHaveBeenCalledTimes(1);

    simulateBrowserPopState(buildHistoryState(null));
    expect(await screen.findByRole('button', { name: 'おでかけ' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'おでかけ', level: 1 })).not.toBeInTheDocument();
    expect(history.state).toMatchObject(HISTORY_SEED);
    expect(readVisitsMarker(history.state)).toBeNull();
  });

  it('consumes history.go(-2) from a visit to own garden, then popstate lands on home', async () => {
    history.replaceState(buildHistoryState(null), '');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'おでかけ' }));
    fireEvent.click(screen.getAllByRole('button', { name: '庭に遊びに行く' })[0]!);
    expect(await screen.findByRole('heading', { name: '丘と水辺の植物園', level: 1 })).toBeInTheDocument();

    const goSpy = mockHistoryGo();
    fireEvent.click(screen.getByRole('button', { name: '自分の庭へ' }));
    expect(goSpy).toHaveBeenCalledWith(-2);

    simulateBrowserPopState(buildHistoryState(null));
    expect(await screen.findByRole('button', { name: 'おでかけ' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '丘と水辺の植物園', level: 1 })).not.toBeInTheDocument();
  });

  it('walks browser history from visit to outings to own garden via popstate', async () => {
    history.replaceState(buildHistoryState(null), '');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'おでかけ' }));
    expect(readVisitsMarker(history.state)?.layer).toBe('outings');
    expect(history.state).toMatchObject(HISTORY_SEED);

    fireEvent.click(screen.getAllByRole('button', { name: '庭に遊びに行く' })[0]!);
    expect(await screen.findByRole('heading', { name: '丘と水辺の植物園', level: 1 })).toBeInTheDocument();
    expect(readVisitsMarker(history.state)?.layer).toBe('garden-visit');

    simulateBrowserPopState(buildHistoryState({ layer: 'outings' }));
    expect(await screen.findByRole('heading', { name: 'おでかけ', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '丘と水辺の植物園', level: 1 })).not.toBeInTheDocument();
    expect(history.state).toMatchObject(HISTORY_SEED);

    simulateBrowserPopState(buildHistoryState(null));
    expect(await screen.findByRole('button', { name: 'おでかけ' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'おでかけ', level: 1 })).not.toBeInTheDocument();
    expect(readVisitsMarker(history.state)).toBeNull();
    expect(history.state).toMatchObject(HISTORY_SEED);
  });

  it('does not reopen a cleared visit when simulated back hits a stale invite marker', async () => {
    history.replaceState(buildHistoryState(null), '');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'おでかけ' }));
    fireEvent.click(screen.getAllByRole('button', { name: '庭に遊びに行く' })[0]!);
    expect(await screen.findByRole('heading', { name: '丘と水辺の植物園', level: 1 })).toBeInTheDocument();

    const goSpy = mockHistoryGo();
    fireEvent.click(screen.getByRole('button', { name: '自分の庭へ' }));
    expect(goSpy).toHaveBeenCalledWith(-2);
    simulateBrowserPopState(buildHistoryState(null));
    expect(await screen.findByRole('button', { name: 'おでかけ' })).toBeInTheDocument();

    simulateBrowserPopState(
      buildHistoryState({ layer: 'garden-visit', visitId: STALE_INVITE_VISIT_ID }),
    );
    expect(await screen.findByRole('heading', { name: 'おでかけ', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '丘と水辺の植物園', level: 1 })).not.toBeInTheDocument();
  });

  it('falls back to outings when forward hits an unavailable transient invite marker', async () => {
    history.replaceState(buildHistoryState(null), '');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'おでかけ' }));
    fireEvent.click(screen.getAllByRole('button', { name: '庭に遊びに行く' })[0]!);
    expect(await screen.findByRole('heading', { name: '丘と水辺の植物園', level: 1 })).toBeInTheDocument();

    const goSpy = mockHistoryGo();
    fireEvent.click(screen.getByRole('button', { name: '自分の庭へ' }));
    expect(goSpy).toHaveBeenCalledWith(-2);
    simulateBrowserPopState(buildHistoryState(null));
    expect(await screen.findByRole('button', { name: 'おでかけ' })).toBeInTheDocument();

    simulateBrowserPopState(
      buildHistoryState({ layer: 'garden-visit', visitId: STALE_INVITE_VISIT_ID }),
    );
    expect(await screen.findByRole('heading', { name: 'おでかけ', level: 1 })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: '丘と水辺の植物園', level: 1 })).not.toBeInTheDocument();
    expect(readVisitsMarker(history.state)?.layer).toBe('outings');
  });

  it('normalizes stale visit markers on first load to own garden', async () => {
    history.replaceState({ [VISITS_HISTORY_STATE_KEY]: { layer: 'garden-visit', visitId: 'missing' } }, '');
    render(<App />);
    expect(await screen.findByRole('button', { name: 'おでかけ' })).toBeInTheDocument();
    expect(readVisitsMarker(history.state)).toBeNull();
  });
});
