import type { IncomingMessage } from 'node:http';

export interface JsonBodySource {
  /** Pre-parsed body (Vercel sets this for JSON requests). */
  body?: unknown;
  /** Read raw UTF-8 body from a Node request stream (local Vite middleware). */
  readRaw?: () => Promise<string>;
}

export type JsonBodyResult =
  | { ok: true; value: unknown }
  | { ok: false; message: string };

function parseRawJson(raw: string): JsonBodyResult {
  const trimmed = raw.trim();
  if (!trimmed) {
    return { ok: false, message: 'リクエスト形式が不正です' };
  }
  try {
    return { ok: true, value: JSON.parse(trimmed) as unknown };
  } catch {
    return { ok: false, message: 'リクエスト形式が不正です' };
  }
}

function parsePreparsedBody(body: unknown): JsonBodyResult {
  if (body === undefined || body === null) {
    return { ok: false, message: 'リクエスト形式が不正です' };
  }
  if (typeof body === 'object') {
    return { ok: true, value: body };
  }
  if (typeof body === 'string') {
    return parseRawJson(body);
  }
  return { ok: false, message: 'リクエスト形式が不正です' };
}

export function readBodyStream(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf8')));
    req.on('error', reject);
  });
}

/** Normalize JSON bodies from Vercel (parsed) and Vite (stream). */
export async function readJsonBody(source: JsonBodySource): Promise<JsonBodyResult> {
  if (source.body !== undefined) {
    return parsePreparsedBody(source.body);
  }
  if (source.readRaw) {
    const raw = await source.readRaw();
    return parseRawJson(raw);
  }
  return { ok: false, message: 'リクエスト形式が不正です' };
}

/** Safely read Vercel's parsed body getter (throws on malformed JSON). */
export function getVercelBody(body: unknown): JsonBodyResult {
  return parsePreparsedBody(body);
}
