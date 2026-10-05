import { describe, it, expect, vi, beforeEach } from 'vitest';
import { StrictMode } from 'react';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import { IdentifyScreen, provenanceLabel } from '../components/discover/IdentifyScreen';
import { manualCandidates, TULIP_TRAIT, UNKNOWN_CANDIDATE } from '../data/identificationCandidates';
import { TULIP_COMMON_NAME, TULIP_FAMILY, TULIP_SCIENTIFIC_NAME } from '../data/tulip';
import type { DiscoveryDraft } from '../types';

vi.mock('../services/identification', () => ({
  identifyPlantImage: vi.fn(),
}));

import { identifyPlantImage } from '../services/identification';

const draft: DiscoveryDraft = {
  imageDataUrl: 'data:image/jpeg;base64,user-photo',
  source: 'file',
};

const sampleDraft: DiscoveryDraft = {
  imageDataUrl: 'data:image/jpeg;base64,sample-photo',
  source: 'sample',
  sampleKey: 'sample-tulip',
};

describe('provenanceLabel', () => {
  it('describes manual and failure states honestly', () => {
    expect(provenanceLabel('not-configured')).toContain('API未設定');
    expect(provenanceLabel('error')).toContain('識別に失敗');
    expect(provenanceLabel('plantnet')).toBe('Pl@ntNet の候補');
  });
});

describe('IdentifyScreen manual/error branches', () => {
  beforeEach(() => {
    vi.mocked(identifyPlantImage).mockReset();
  });

  it('shows pending provenance during lookup without manual fallback copy', () => {
    vi.mocked(identifyPlantImage).mockImplementation(() => new Promise(() => {}));

    render(
      <IdentifyScreen draft={draft} autoStart onBack={vi.fn()} onSave={vi.fn()} />,
    );

    expect(screen.getByText('写真から候補を確認しています')).toBeInTheDocument();
    expect(screen.queryByText('手動で選んで保存')).not.toBeInTheDocument();
    expect(screen.getByText('候補を読み込み中…')).toBeInTheDocument();
  });

  it('shows sample provenance while sample candidates are loading', () => {
    vi.mocked(identifyPlantImage).mockImplementation(() => new Promise(() => {}));

    render(
      <IdentifyScreen draft={sampleDraft} autoStart onBack={vi.fn()} onSave={vi.fn()} />,
    );

    expect(screen.getByText('サンプル写真・固定候補')).toBeInTheDocument();
    expect(screen.queryByText('手動で選んで保存')).not.toBeInTheDocument();
  });

  it('shows one error banner and manual candidates when identification fails', async () => {
    vi.mocked(identifyPlantImage).mockResolvedValue({
      status: 'error',
      candidates: manualCandidates(),
      message: '識別サービスに接続できませんでした。手動で選んで保存できます。',
      provider: 'plantnet',
    });

    render(
      <IdentifyScreen draft={draft} autoStart onBack={vi.fn()} onSave={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('alert')).toHaveTextContent('識別サービスに接続できませんでした');
    });

    expect(screen.getByText('識別に失敗 — 手動で選んで保存できます')).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: /不明・判別できない/ })).toBeInTheDocument();
    expect(screen.queryAllByRole('alert')).toHaveLength(1);
  });

  it('shows not-configured provenance without an error banner', async () => {
    vi.mocked(identifyPlantImage).mockResolvedValue({
      status: 'not-configured',
      candidates: manualCandidates(),
      message: 'Pl@ntNet API が未設定です',
    });

    render(
      <IdentifyScreen draft={draft} autoStart onBack={vi.fn()} onSave={vi.fn()} />,
    );

    await waitFor(() => {
      expect(screen.getByText('API未設定 — 手動で選んで保存できます')).toBeInTheDocument();
    });

    expect(screen.getByText('Pl@ntNet API が未設定です')).toBeInTheDocument();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('saves unknown manual pick as other with null color and manual source', async () => {
    vi.mocked(identifyPlantImage).mockResolvedValue({
      status: 'error',
      candidates: manualCandidates(),
      message: '識別に失敗しました',
      provider: 'plantnet',
    });

    const onSave = vi.fn(() => true);

    render(
      <IdentifyScreen draft={draft} autoStart onBack={vi.fn()} onSave={onSave} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /不明・判別できない/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('button', { name: '記録を残す' }));

    expect(onSave).toHaveBeenCalledWith({
      plantType: UNKNOWN_CANDIDATE.plantType,
      commonNameJa: UNKNOWN_CANDIDATE.commonNameJa,
      scientificName: UNKNOWN_CANDIDATE.scientificName,
      familyName: UNKNOWN_CANDIDATE.familyName,
      trait: UNKNOWN_CANDIDATE.trait,
      color: null,
      isSample: false,
      identificationSource: 'manual',
    });
  });

  it('saves manually chosen tulip with manual source and selected color', async () => {
    const tulipCandidate = {
      plantType: 'tulip' as const,
      commonNameJa: TULIP_COMMON_NAME,
      scientificName: TULIP_SCIENTIFIC_NAME,
      familyName: TULIP_FAMILY,
      trait: TULIP_TRAIT,
      isTulipMatch: true,
    };

    vi.mocked(identifyPlantImage).mockResolvedValue({
      status: 'not-configured',
      candidates: [tulipCandidate, ...manualCandidates()],
      message: 'API未設定',
    });

    const onSave = vi.fn(() => true);

    render(
      <IdentifyScreen draft={draft} autoStart onBack={vi.fn()} onSave={onSave} />,
    );

    await waitFor(() => {
      expect(screen.getByRole('radio', { name: /チューリップ/ })).toBeInTheDocument();
    });

    fireEvent.click(screen.getByRole('radio', { name: /チューリップ/ }));
    fireEvent.click(screen.getByRole('button', { name: '黄', pressed: false }));

    fireEvent.click(screen.getByRole('button', { name: '記録を残す' }));

    expect(onSave).toHaveBeenCalledWith({
      plantType: 'tulip',
      commonNameJa: TULIP_COMMON_NAME,
      scientificName: TULIP_SCIENTIFIC_NAME,
      familyName: TULIP_FAMILY,
      trait: TULIP_TRAIT,
      color: 'yellow',
      isSample: false,
      identificationSource: 'manual',
    });
  });
});

describe('IdentifyScreen resume and stale requests', () => {
  beforeEach(() => {
    vi.mocked(identifyPlantImage).mockReset();
  });

  it('does not auto-identify when resumed without completed results', () => {
    vi.mocked(identifyPlantImage).mockResolvedValue({
      status: 'error',
      candidates: manualCandidates(),
      message: 'should not run',
      provider: 'plantnet',
    });

    render(
      <IdentifyScreen
        draft={{ ...draft, step: 'identify' }}
        autoStart={false}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(identifyPlantImage).not.toHaveBeenCalled();
    expect(screen.getByText('識別結果を取得できませんでした')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'もう一度識別する' })).toBeInTheDocument();
  });

  it('restores completed candidates on resume without calling the provider', () => {
    const savedDraft: DiscoveryDraft = {
      ...draft,
      step: 'identify',
      identificationAttempted: true,
      candidates: manualCandidates(),
      identStatus: 'error',
      statusMessage: '識別に失敗しました',
      selectedIndex: 0,
    };

    render(
      <IdentifyScreen
        draft={savedDraft}
        autoStart={false}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    expect(identifyPlantImage).not.toHaveBeenCalled();
    expect(screen.getByRole('radio', { name: /不明・判別できない/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'もう一度識別する' })).not.toBeInTheDocument();
  });

  it('retries identification once and blocks repeated clicks while loading', async () => {
    let resolveIdentify: (value: Awaited<ReturnType<typeof identifyPlantImage>>) => void = () => {};
    vi.mocked(identifyPlantImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveIdentify = resolve;
        }),
    );

    render(
      <IdentifyScreen
        draft={{ ...draft, step: 'identify' }}
        autoStart={false}
        onBack={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    const retryButton = screen.getByRole('button', { name: 'もう一度識別する' });
    fireEvent.click(retryButton);
    fireEvent.click(retryButton);
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

  it('applies autoStart result once under StrictMode effect replay', async () => {
    let resolveIdentify: (value: Awaited<ReturnType<typeof identifyPlantImage>>) => void = () => {};
    vi.mocked(identifyPlantImage).mockImplementation(
      () =>
        new Promise((resolve) => {
          resolveIdentify = resolve;
        }),
    );

    render(
      <StrictMode>
        <IdentifyScreen draft={draft} autoStart onBack={vi.fn()} onSave={vi.fn()} />
      </StrictMode>,
    );

    expect(identifyPlantImage).toHaveBeenCalledTimes(1);
    expect(screen.getByText('候補を読み込み中…')).toBeInTheDocument();

    resolveIdentify({
      status: 'not-configured',
      candidates: manualCandidates(),
      message: 'API未設定',
    });

    await waitFor(() => {
      expect(screen.getByText('API未設定 — 手動で選んで保存できます')).toBeInTheDocument();
    });
    expect(identifyPlantImage).toHaveBeenCalledTimes(1);
  });

  it('ignores stale provider responses after unmount or photo change', async () => {
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
        message: 'second photo',
      });

    const onDraftChange = vi.fn();
    const { unmount } = render(
      <IdentifyScreen
        draft={draft}
        autoStart
        onBack={vi.fn()}
        onDraftChange={onDraftChange}
        onSave={vi.fn()}
      />,
    );

    unmount();

    render(
      <IdentifyScreen
        draft={{ ...draft, imageDataUrl: 'data:image/jpeg;base64,another-photo' }}
        autoStart
        onBack={vi.fn()}
        onSave={vi.fn()}
      />,
    );

    resolveFirst({
      status: 'error',
      candidates: manualCandidates(),
      message: 'stale result',
      provider: 'plantnet',
    });

    await waitFor(() => {
      expect(identifyPlantImage).toHaveBeenCalledTimes(2);
    });

    expect(screen.queryByText('stale result')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByText('API未設定 — 手動で選んで保存できます')).toBeInTheDocument();
    });
  });
});
