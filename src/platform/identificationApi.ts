import { Capacitor, CapacitorHttp } from '@capacitor/core';
import type { IdentificationResult } from '../types';

const IDENTIFY_TIMEOUT_MS = 20_000;

export const IDENTIFICATION_NOT_CONFIGURED_MESSAGE =
  '識別サービスの接続先が未設定です。手動で植物を選んで保存できます。';

export const IDENTIFICATION_CONNECTION_ERROR_MESSAGE =
  '識別サービスに接続できませんでした。手動で選んで保存できます。';

type JsonResult<T> = {
  ok: boolean;
  status: number;
  data: T | null;
  notConfigured?: boolean;
};

export function isNativeIdentificationContext(): boolean {
  return Capacitor.isNativePlatform();
}

export function getNativeIdentificationApiOrigin(): string | null {
  const raw = import.meta.env.VITE_IDENTIFICATION_API_BASE_URL?.trim();
  if (!raw) return null;
  try {
    const url = new URL(raw);
    if (url.protocol !== 'https:') return null;
    return url.origin;
  } catch {
    return null;
  }
}

function parseResponseData<T>(data: unknown): T | null {
  if (data == null) return null;
  if (typeof data === 'string') {
    try {
      return JSON.parse(data) as T;
    } catch {
      return null;
    }
  }
  return data as T;
}

async function requestWeb<T>(path: string, init?: RequestInit): Promise<JsonResult<T>> {
  try {
    const res = await fetch(path, init);
    let data: T | null = null;
    try {
      data = (await res.json()) as T;
    } catch {
      data = null;
    }
    return { ok: res.ok, status: res.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

async function requestNative<T>(
  path: string,
  method: 'GET' | 'POST',
  body?: unknown,
): Promise<JsonResult<T>> {
  const origin = getNativeIdentificationApiOrigin();
  if (!origin) {
    return { ok: false, status: 0, data: null, notConfigured: true };
  }

  try {
    const response =
      method === 'GET'
        ? await CapacitorHttp.get({
            url: `${origin}${path}`,
            headers: { Accept: 'application/json' },
            connectTimeout: IDENTIFY_TIMEOUT_MS,
            readTimeout: IDENTIFY_TIMEOUT_MS,
          })
        : await CapacitorHttp.post({
            url: `${origin}${path}`,
            headers: {
              Accept: 'application/json',
              'Content-Type': 'application/json',
            },
            data: body,
            connectTimeout: IDENTIFY_TIMEOUT_MS,
            readTimeout: IDENTIFY_TIMEOUT_MS,
          });

    const data = parseResponseData<T>(response.data);
    const ok = response.status >= 200 && response.status < 300;
    return { ok, status: response.status, data };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

export async function requestIdentificationHealth(): Promise<{
  configured: boolean;
  notConfigured?: boolean;
}> {
  if (isNativeIdentificationContext()) {
    const result = await requestNative<{ plantnetConfigured?: boolean }>('/api/health', 'GET');
    if (result.notConfigured) return { configured: false, notConfigured: true };
    if (!result.ok || !result.data) return { configured: false };
    return { configured: Boolean(result.data.plantnetConfigured) };
  }

  const result = await requestWeb<{ plantnetConfigured?: boolean }>('/api/health');
  if (!result.ok || !result.data) return { configured: false };
  return { configured: Boolean(result.data.plantnetConfigured) };
}

export async function requestIdentificationIdentify(
  imageDataUrl: string,
): Promise<JsonResult<IdentificationResult>> {
  if (isNativeIdentificationContext()) {
    return requestNative<IdentificationResult>('/api/identify', 'POST', { imageDataUrl });
  }

  return requestWeb<IdentificationResult>('/api/identify', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ imageDataUrl }),
  });
}
