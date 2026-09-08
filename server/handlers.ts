import type { IdentificationResult } from '../src/types';
import { MAX_IMAGE_BYTES } from './constants';
import { identifyWithPlantNet, manualCandidates, notConfiguredResult } from './plantnet';
import type { JsonBodyResult } from './request';

interface IdentifyBody {
  imageDataUrl?: string;
}

export interface HealthPayload {
  plantnetConfigured: boolean;
  provider: 'plantnet';
}

export interface HandlerResult {
  status: number;
  body: IdentificationResult | HealthPayload | { error: string };
}

function parseImageDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export function healthHandler(): HandlerResult {
  const configured = Boolean(process.env.PLANTNET_API_KEY?.trim());
  return {
    status: 200,
    body: {
      plantnetConfigured: configured,
      provider: 'plantnet',
    },
  };
}

export async function identifyHandler(parsedBody: JsonBodyResult): Promise<HandlerResult> {
  if (!parsedBody.ok) {
    return {
      status: 400,
      body: {
        status: 'error',
        message: parsedBody.message,
        candidates: [],
        provider: 'plantnet',
      },
    };
  }

  const body = parsedBody.value as IdentifyBody;
  if (!body.imageDataUrl) {
    return {
      status: 400,
      body: {
        status: 'error',
        message: '画像データがありません',
        candidates: [],
        provider: 'plantnet',
      },
    };
  }

  const parsed = parseImageDataUrl(body.imageDataUrl);
  if (!parsed) {
    return {
      status: 400,
      body: {
        status: 'error',
        message: '画像形式が不正です',
        candidates: [],
        provider: 'plantnet',
      },
    };
  }

  if (parsed.buffer.length > MAX_IMAGE_BYTES) {
    return {
      status: 413,
      body: {
        status: 'error',
        message: '画像サイズが大きすぎます（4MB以下にしてください）',
        candidates: manualCandidates(),
        provider: 'plantnet',
      },
    };
  }

  const apiKey = process.env.PLANTNET_API_KEY?.trim();
  if (!apiKey) {
    return { status: 503, body: notConfiguredResult() };
  }

  try {
    const result = await identifyWithPlantNet(apiKey, parsed.buffer, parsed.mimeType);
    const status = result.status === 'ok' ? 200 : 502;
    return { status, body: result };
  } catch {
    return {
      status: 500,
      body: {
        status: 'error',
        message: '識別に失敗しました',
        candidates: manualCandidates(),
        provider: 'plantnet',
      },
    };
  }
}
