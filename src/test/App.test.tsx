import { afterEach, beforeEach, describe, expect, it, vi, type MockInstance } from 'vitest';
import { act, fireEvent, render, screen } from '@testing-library/react';
import App from '../App';
import { resetLocalDbForTests } from '../storage/localDb';
import { setOnboardingComplete } from '../storage/appMeta';
import { saveState } from '../storage/persistence';
import { saveObservationAction } from '../storage/gardenActions';
import { createEmptyState } from '../storage/migration';

let historyBackSpy: MockInstance<typeof history.back> | null = null;

function restoreTrackedHistorySpies() {
  historyBackSpy?.mockRestore();
  historyBackSpy = null;
}

function mockHistoryBack() {
  historyBackSpy?.mockRestore();
  historyBackSpy = vi.spyOn(history, 'back').mockImplementation(() => undefined);
  return historyBackSpy;
}

describe('App', () => {
  beforeEach(async () => {
    resetLocalDbForTests();
    localStorage.clear();
    history.replaceState({}, '');
    await setOnboardingComplete(true);
  });

  afterEach(() => {
    restoreTrackedHistorySpies();
  });

  it('renders garden screen with Japanese title after hydration', async () => {
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'こもれび植物園' })).toBeInTheDocument();
  });

  it('shows main garden entrances on viewing home', async () => {
    render(<App />);
    expect(await screen.findByRole('button', { name: '撮る' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '庭づくり' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '記録' })).toBeInTheDocument();
  });

  it('opens the sandbox toolbox with flowers, surfaces, decorations, and history', async () => {
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: '庭づくり' }));
    expect(screen.getByRole('tab', { name: '植物' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('tab', { name: '道・地面' })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: '飾り' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /取り消す/ })).toBeDisabled();
    expect(screen.getByRole('button', { name: '眺める' })).toBeInTheDocument();
  });

  it('shows onboarding for first-time users', async () => {
    await setOnboardingComplete(false);
    render(<App />);
    expect(await screen.findByRole('heading', { name: 'こもれび植物園' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '庭づくりをはじめる' })).toBeInTheDocument();
    expect(screen.getByText('庭づくりの作例')).toBeInTheDocument();
    expect(
      screen.getByRole('img', { name: /庭の作例/ }),
    ).toHaveAttribute('src', '/samples/expanded-garden-example.png');
    expect(screen.getByRole('button', { name: '設定と引き継ぎ' })).toBeInTheDocument();
  });

  it('skips onboarding when existing garden data is present', async () => {
    await setOnboardingComplete(false);
    const { nextState } = saveObservationAction(createEmptyState(), {
      plantType: 'tulip',
      commonNameJa: 'チューリップ',
      scientificName: 'Tulipa gesneriana',
      familyName: 'ユリ科',
      color: 'red',
      imageDataUrl: 'data:image/jpeg;base64,existing',
      trait: '',
      isSample: true,
      identificationSource: 'sample',
    });
    await saveState(nextState);
    render(<App />);
    expect(await screen.findByRole('button', { name: '撮る' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '庭づくりをはじめる' })).not.toBeInTheDocument();
  });

  it('navigates to settings', async () => {
    render(<App />);
    await screen.findByRole('button', { name: '撮る' });
    fireEvent.click(screen.getByRole('button', { name: '設定' }));
    expect(await screen.findByRole('heading', { name: '設定' })).toBeInTheDocument();
  });

  it('returns from outings with explicit back without leaving a revisit marker', async () => {
    history.replaceState({ appSeed: true }, '');
    render(<App />);
    fireEvent.click(await screen.findByRole('button', { name: 'おでかけ' }));
    expect(history.state).toMatchObject({ appSeed: true });

    const backSpy = mockHistoryBack();
    fireEvent.click(screen.getByRole('button', { name: '← 自分の庭' }));
    expect(backSpy).toHaveBeenCalledTimes(1);

    act(() => {
      history.replaceState({ appSeed: true }, '');
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    });
    expect(await screen.findByRole('button', { name: 'おでかけ' })).toBeInTheDocument();

    act(() => {
      history.replaceState({ appSeed: true }, '');
      window.dispatchEvent(new PopStateEvent('popstate', { state: history.state }));
    });
    expect(screen.queryByRole('heading', { name: 'おでかけ', level: 1 })).not.toBeInTheDocument();
  });
});
