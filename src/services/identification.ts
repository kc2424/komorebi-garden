import type { IdentificationResult } from '../types';
import { manualCandidates, withUnknownOption } from '../data/identificationCandidates';
import { getSamplePhoto, getTulipSampleCandidates } from '../data/sampleIdentification';
import {
  IDENTIFICATION_CONNECTION_ERROR_MESSAGE,
  IDENTIFICATION_NOT_CONFIGURED_MESSAGE,
  requestIdentificationHealth,
  requestIdentificationIdentify,
} from '../platform/identificationApi';

export async function checkIdentificationHealth(): Promise<boolean> {
  const result = await requestIdentificationHealth();
  return result.configured;
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

  const result = await requestIdentificationIdentify(imageDataUrl);

  if (result.notConfigured) {
    return {
      status: 'error',
      candidates: manualCandidates(),
      message: IDENTIFICATION_NOT_CONFIGURED_MESSAGE,
      provider: 'plantnet',
    };
  }

  if (!result.ok || !result.data) {
    return {
      status: 'error',
      candidates: manualCandidates(),
      message: IDENTIFICATION_CONNECTION_ERROR_MESSAGE,
      provider: 'plantnet',
    };
  }

  const json = result.data;
  if (json.status === 'ok' && json.candidates.length > 0) {
    return { ...json, candidates: withUnknownOption(json.candidates) };
  }
  return json;
}
