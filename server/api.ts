import type { IncomingMessage, ServerResponse } from 'node:http';
import { identifyWithPlantNet, notConfiguredResult, manualCandidates } from './plantnet';

interface IdentifyBody {
  imageDataUrl?: string;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

function parseImageDataUrl(dataUrl: string): { buffer: Buffer; mimeType: string } | null {
  const match = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/.exec(dataUrl);
  if (!match) return null;
  return {
    mimeType: match[1],
    buffer: Buffer.from(match[2], 'base64'),
  };
}

export async function handleIdentifyRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const apiKey = process.env.PLANTNET_API_KEY?.trim();
  if (!apiKey) {
    sendJson(res, 503, notConfiguredResult());
    return;
  }

  try {
    const raw = await readBody(req);
    const body = JSON.parse(raw) as IdentifyBody;
    if (!body.imageDataUrl) {
      sendJson(res, 400, { status: 'error', message: '画像データがありません', candidates: [] });
      return;
    }

    const parsed = parseImageDataUrl(body.imageDataUrl);
    if (!parsed) {
      sendJson(res, 400, { status: 'error', message: '画像形式が不正です', candidates: [] });
      return;
    }

    const result = await identifyWithPlantNet(apiKey, parsed.buffer, parsed.mimeType);
    const status = result.status === 'ok' ? 200 : 502;
    sendJson(res, status, result);
  } catch (err) {
    const message = err instanceof Error ? err.message : '識別に失敗しました';
    sendJson(res, 500, {
      status: 'error',
      message,
      candidates: manualCandidates(),
      provider: 'plantnet',
    });
  }
}

export function handleHealthRequest(_req: IncomingMessage, res: ServerResponse): void {
  const configured = Boolean(process.env.PLANTNET_API_KEY?.trim());
  sendJson(res, 200, {
    plantnetConfigured: configured,
    provider: 'plantnet',
  });
}

export function createApiMiddleware() {
  return async (req: IncomingMessage, res: ServerResponse, next: () => void) => {
    const url = req.url?.split('?')[0] ?? '';
    if (url === '/api/health') {
      handleHealthRequest(req, res);
      return;
    }
    if (url === '/api/identify') {
      await handleIdentifyRequest(req, res);
      return;
    }
    next();
  };
}
