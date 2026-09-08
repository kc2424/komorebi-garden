import type { IdentificationResult } from '../types';
import { manualCandidates, withUnknownOption } from '../data/identificationCandidates';
import { getSamplePhoto, getTulipSampleCandidates } from '../data/sampleIdentification';

export async function checkIdentificationHealth(): Promise<boolean> {
  try {
    const res = await fetch('/api/health');
    if (!res.ok) return false;
    const json = (await res.json()) as { plantnetConfigured?: boolean };
    return Boolean(json.plantnetConfigured);
  } catch {
    return false;
  }
}

export async function identifyPlantImage(
  imageDataUrl: string,
  source: 'camera' | 'file' | 'sample',
  sampleKey?: string,
): Promise<IdentificationResult> {
  if (source === 'sample' && sampleKey) {
    const sample = getSamplePhoto(sampleKey);
    if (sample) {
      return {
        status: 'ok',
        candidates: sample.candidates,
        provider: undefined,
      };
    }
  }

  if (source === 'sample') {
    return {
      status: 'ok',
      candidates: getTulipSampleCandidates(),
      provider: undefined,
    };
  }

  try {
    const res = await fetch('/api/identify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ imageDataUrl }),
    });
    const json = (await res.json()) as IdentificationResult;
    if (json.status === 'ok' && json.candidates.length > 0) {
      return { ...json, candidates: withUnknownOption(json.candidates) };
    }
    return json;
  } catch {
    return {
      status: 'error',
      candidates: manualCandidates(),
      message: '識別サービスに接続できませんでした。手動で選んで保存できます。',
      provider: 'plantnet',
    };
  }
}
