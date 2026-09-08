import { describe, it, expect } from 'vitest';
import { readJsonBody, getVercelBody } from '../../server/request';
import { identifyHandler } from '../../server/handlers';

describe('readJsonBody', () => {
  it('accepts a pre-parsed object body (Vercel-style)', async () => {
    const result = await readJsonBody({
      body: { imageDataUrl: 'data:image/jpeg;base64,abc' },
    });
    expect(result).toEqual({
      ok: true,
      value: { imageDataUrl: 'data:image/jpeg;base64,abc' },
    });
  });

  it('rejects invalid JSON from a raw stream (Vite-style)', async () => {
    const result = await readJsonBody({
      readRaw: async () => '{not-json',
    });
    expect(result).toEqual({ ok: false, message: 'リクエスト形式が不正です' });
  });

  it('reads valid JSON from a raw stream', async () => {
    const result = await readJsonBody({
      readRaw: async () => JSON.stringify({ imageDataUrl: 'data:image/png;base64,xyz' }),
    });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value).toEqual({ imageDataUrl: 'data:image/png;base64,xyz' });
    }
  });
});

describe('getVercelBody', () => {
  it('rejects null/undefined body', () => {
    expect(getVercelBody(undefined)).toEqual({ ok: false, message: 'リクエスト形式が不正です' });
    expect(getVercelBody(null)).toEqual({ ok: false, message: 'リクエスト形式が不正です' });
  });
});

describe('identifyHandler validation', () => {
  it('returns 400 when imageDataUrl is missing', async () => {
    const result = await identifyHandler({ ok: true, value: {} });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      status: 'error',
      message: '画像データがありません',
    });
  });

  it('returns 400 for malformed image data URL', async () => {
    const result = await identifyHandler({
      ok: true,
      value: { imageDataUrl: 'not-a-data-url' },
    });
    expect(result.status).toBe(400);
    expect(result.body).toMatchObject({
      status: 'error',
      message: '画像形式が不正です',
    });
  });
});
