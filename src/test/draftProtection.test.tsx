import { describe, it, expect, beforeEach, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import App from '../App';
import { resetLocalDbForTests } from '../storage/localDb';
import { loadAppMeta, saveDraft, setOnboardingComplete } from '../storage/appMeta';
import { manualCandidates } from '../data/identificationCandidates';

vi.mock('../services/identification', () => ({
  identifyPlantImage: vi.fn(),
}));

import { identifyPlantImage } from '../services/identification';

let simulateAndroidBack: (() => boolean) | null = null;

vi.mock('../platform/native', async () => {
  const actual = await vi.importActual<typeof import('../platform/native')>('../platform/native');
  return {
    ...actual,
    registerBackButton: (handler: () => boolean) => {
      simulateAndroidBack = handler;
      return () => {
        simulateAndroidBack = null;
      };
    },
  };
});

const sampleDraft = {
  step: 'photo-confirm' as const,
  source: 'camera' as const,
  imageDataUrl: 'data:image/jpeg;base64,draft-test',
};

describe('draft protection (G1)', () => {
  beforeEach(async () => {
    resetLocalDbForTests();
    localStorage.clear();
    vi.mocked(identifyPlantImage).mockReset();
    await setOnboardingComplete(true);
    await saveDraft(sampleDraft);
  });

  async function waitForGarden() {
    await screen.findByRole('heading', { name: 'こもれび植物園' });
    await screen.findByRole('dialog', { name: '途中の観察があります' });
  }

  it('keeps draft when closing with ×, Escape, or あとで', async () => {
    render(<App />);
    await waitForGarden();

    fireEvent.click(screen.getByRole('button', { name: '閉じる' }));
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '途中の観察があります' })).not.toBeInTheDocument();
    });
    let meta = await loadAppMeta();
    expect(meta.draft).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '撮る' }));
    await screen.findByRole('dialog', { name: '途中の観察があります' });

    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '途中の観察があります' })).not.toBeInTheDocument();
    });
    meta = await loadAppMeta();
    expect(meta.draft).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '撮る' }));
    await screen.findByRole('dialog', { name: '途中の観察があります' });
    fireEvent.click(screen.getByRole('button', { name: 'あとで' }));
    meta = await loadAppMeta();
    expect(meta.draft).not.toBeNull();
  });

  it('dismisses draft resume modal on Android back without discarding draft', async () => {
    render(<App />);
    await waitForGarden();
    expect(simulateAndroidBack).not.toBeNull();

    simulateAndroidBack!();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '途中の観察があります' })).not.toBeInTheDocument();
    });

    const meta = await loadAppMeta();
    expect(meta.draft).not.toBeNull();
  });

  it('dismisses discard confirmation on Android back and keeps draft', async () => {
    render(<App />);
    await waitForGarden();

    fireEvent.click(screen.getByRole('button', { name: '下書きを破棄' }));
    await screen.findByRole('dialog', { name: '下書きを破棄' });
    expect(simulateAndroidBack).not.toBeNull();

    simulateAndroidBack!();
    await waitFor(() => {
      expect(screen.queryByRole('dialog', { name: '下書きを破棄' })).not.toBeInTheDocument();
    });

    const meta = await loadAppMeta();
    expect(meta.draft).not.toBeNull();
  });

  it('removes draft only after explicit discard confirmation', async () => {
    render(<App />);
    await waitForGarden();

    fireEvent.click(screen.getByRole('button', { name: '下書きを破棄' }));
    await screen.findByRole('dialog', { name: '下書きを破棄' });
    fireEvent.click(screen.getByRole('button', { name: 'キャンセル' }));
    let meta = await loadAppMeta();
    expect(meta.draft).not.toBeNull();

    fireEvent.click(screen.getByRole('button', { name: '下書きを破棄' }));
    await screen.findByRole('dialog', { name: '下書きを破棄' });
    fireEvent.click(screen.getByRole('button', { name: '破棄する' }));

    await waitFor(async () => {
      meta = await loadAppMeta();
      expect(meta.draft).toBeNull();
    });
  });

  it('does not auto-resubmit identification when resuming an interrupted identify draft', async () => {
    let resolveIdentify: (value: Awaited<ReturnType<typeof identifyPlantImage>>) => void = () => {};
    vi.mocked(identifyPlantImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveIdentify = resolve;
        }),
    );

    await saveDraft({
      step: 'identify',
      source: 'file',
      imageDataUrl: 'data:image/jpeg;base64,in-flight-draft',
    });

    const view = render(<App />);
    await screen.findByRole('heading', { name: 'こもれび植物園' });
    await screen.findByRole('dialog', { name: '途中の観察があります' });
    fireEvent.click(screen.getByRole('button', { name: '再開する' }));

    await screen.findByText('識別結果を取得できませんでした');
    expect(identifyPlantImage).not.toHaveBeenCalled();

    view.unmount();
    render(<App />);
    await screen.findByRole('heading', { name: 'こもれび植物園' });
    await screen.findByRole('dialog', { name: '途中の観察があります' });
    fireEvent.click(screen.getByRole('button', { name: '再開する' }));

    await screen.findByText('識別結果を取得できませんでした');
    expect(identifyPlantImage).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole('button', { name: 'もう一度識別する' }));
    expect(identifyPlantImage).toHaveBeenCalledTimes(1);

    resolveIdentify({
      status: 'not-configured',
      candidates: manualCandidates(),
      message: 'API未設定',
    });

    await waitFor(() => {
      expect(screen.getByText('API未設定 — 手動で選んで保存できます')).toBeInTheDocument();
    });
  });

  it('restores completed identification on resume without calling the provider', async () => {
    vi.mocked(identifyPlantImage).mockResolvedValue({
      status: 'error',
      candidates: manualCandidates(),
      message: 'should not run',
      provider: 'plantnet',
    });

    await saveDraft({
      step: 'identify',
      source: 'file',
      imageDataUrl: 'data:image/jpeg;base64,completed-draft',
      identificationAttempted: true,
      candidates: manualCandidates(),
      identStatus: 'error',
      statusMessage: '識別に失敗しました',
      selectedIndex: 0,
    });

    render(<App />);
    await screen.findByRole('heading', { name: 'こもれび植物園' });
    await screen.findByRole('dialog', { name: '途中の観察があります' });
    fireEvent.click(screen.getByRole('button', { name: '再開する' }));

    await screen.findByRole('radio', { name: /不明・判別できない/ });
    expect(identifyPlantImage).not.toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: 'もう一度識別する' })).not.toBeInTheDocument();
  });

  it('does not apply a stale in-flight response after remounting with another photo', async () => {
    let resolveFirst: (value: Awaited<ReturnType<typeof identifyPlantImage>>) => void = () => {};
    vi.mocked(identifyPlantImage)
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            resolveFirst = resolve;
          }),
      )
      .mockResolvedValueOnce({
        status: 'not-configured',
        candidates: manualCandidates(),
        message: 'second photo result',
      });

    await saveDraft({
      step: 'identify',
      source: 'file',
      imageDataUrl: 'data:image/jpeg;base64,first-photo',
    });

    const view = render(<App />);
    await screen.findByRole('heading', { name: 'こもれび植物園' });
    fireEvent.click(screen.getByRole('button', { name: '再開する' }));
    await screen.findByText('識別結果を取得できませんでした');

    fireEvent.click(screen.getByRole('button', { name: 'もう一度識別する' }));
    expect(identifyPlantImage).toHaveBeenCalledTimes(1);

    view.unmount();

    await saveDraft({
      step: 'identify',
      source: 'file',
      imageDataUrl: 'data:image/jpeg;base64,second-photo',
    });

    render(<App />);
    await screen.findByRole('heading', { name: 'こもれび植物園' });
    fireEvent.click(screen.getByRole('button', { name: '再開する' }));
    fireEvent.click(screen.getByRole('button', { name: 'もう一度識別する' }));

    resolveFirst({
      status: 'error',
      candidates: manualCandidates(),
      message: 'stale first-photo result',
      provider: 'plantnet',
    });

    await waitFor(() => {
      expect(identifyPlantImage).toHaveBeenCalledTimes(2);
      expect(screen.getByText('API未設定 — 手動で選んで保存できます')).toBeInTheDocument();
    });
    expect(screen.queryByText('stale first-photo result')).not.toBeInTheDocument();
  });
});
