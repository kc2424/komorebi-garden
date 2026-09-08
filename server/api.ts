import type { IncomingMessage, ServerResponse } from 'node:http';
import { healthHandler, identifyHandler } from './handlers';
import { readBodyStream, readJsonBody } from './request';

function sendJson(res: ServerResponse, status: number, body: unknown): void {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json');
  res.end(JSON.stringify(body));
}

export async function handleIdentifyRequest(
  req: IncomingMessage,
  res: ServerResponse,
): Promise<void> {
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }

  const parsed = await readJsonBody({ readRaw: () => readBodyStream(req) });
  const result = await identifyHandler(parsed);
  sendJson(res, result.status, result.body);
}

export function handleHealthRequest(_req: IncomingMessage, res: ServerResponse): void {
  const result = healthHandler();
  sendJson(res, result.status, result.body);
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
