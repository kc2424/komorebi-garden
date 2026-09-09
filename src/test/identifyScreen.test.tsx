import { describe, it, expect, vi, beforeEach } from 'vitest';
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
      <IdentifyScreen draft={draft} onBack={vi.fn()} onSave={vi.fn()} />,
    );

    expect(screen.getByText('写真から候補を確認しています')).toBeInTheDocument();
    expect(screen.queryByText('手動で選んで保存')).not.toBeInTheDocument();
    expect(screen.getByText('候補を読み込み中…')).toBeInTheDocument();
  });

  it('shows sample provenance while sample candidates are loading', () => {
    vi.mocked(identifyPlantImage).mockImplementation(() => new Promise(() => {}));

    render(
      <IdentifyScreen draft={sampleDraft} onBack={vi.fn()} onSave={vi.fn()} />,
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
      <IdentifyScreen draft={draft} onBack={vi.fn()} onSave={vi.fn()} />,
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
      <IdentifyScreen draft={draft} onBack={vi.fn()} onSave={vi.fn()} />,
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
      <IdentifyScreen draft={draft} onBack={vi.fn()} onSave={onSave} />,
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
      <IdentifyScreen draft={draft} onBack={vi.fn()} onSave={onSave} />,
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
      color: 'yellow',
      isSample: false,
      identificationSource: 'manual',
    });
  });
});
