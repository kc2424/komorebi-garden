import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  getNativeIdentificationApiOrigin,
  isNativeIdentificationContext,
  requestIdentificationHealth,
  requestIdentificationIdentify,
  IDENTIFICATION_NOT_CONFIGURED_MESSAGE,
} from '../platform/identificationApi';
import { identifyPlantImage } from '../services/identification';

const fetchMock = vi.fn();
const capacitorGetMock = vi.fn();
const capacitorPostMock = vi.fn();

vi.stubGlobal('fetch', fetchMock);

vi.mock('@capacitor/core', async () => {
  const actual = await vi.importActual<typeof import('@capacitor/core')>('@capacitor/core');
  return {
    ...actual,
    Capacitor: {
      ...actual.Capacitor,
      isNativePlatform: vi.fn(() => false),
    },
    CapacitorHttp: {
      get: (...args: unknown[]) => capacitorGetMock(...args),
      post: (...args: unknown[]) => capacitorPostMock(...args),
    },
  };
});

import { Capacitor } from '@capacitor/core';

describe('identification API transport (G5)', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(false);
    vi.stubEnv('VITE_IDENTIFICATION_API_BASE_URL', '');
    fetchMock.mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ plantnetConfigured: true }),
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('uses same-origin fetch on web', async () => {
    await requestIdentificationHealth();
    expect(fetchMock.mock.calls[0]?.[0]).toBe('/api/health');
    expect(capacitorGetMock).not.toHaveBeenCalled();
  });

  it('uses CapacitorHttp on native with configured HTTPS origin', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.stubEnv('VITE_IDENTIFICATION_API_BASE_URL', 'https://komorebi-garden.vercel.app/');
    capacitorGetMock.mockResolvedValue({
      status: 200,
      data: { plantnetConfigured: true },
    });

    const result = await requestIdentificationHealth();
    expect(result).toEqual({ configured: true });
    expect(capacitorGetMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://komorebi-garden.vercel.app/api/health',
      }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('rejects non-HTTPS native base URLs', () => {
    vi.stubEnv('VITE_IDENTIFICATION_API_BASE_URL', 'http://komorebi-garden.vercel.app');
    expect(getNativeIdentificationApiOrigin()).toBeNull();
  });

  it('reports not configured on native when base URL is missing', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const result = await requestIdentificationIdentify('data:image/jpeg;base64,abc');
    expect(result.notConfigured).toBe(true);
    expect(capacitorPostMock).not.toHaveBeenCalled();
  });

  it('posts identify requests natively with JSON imageDataUrl', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    vi.stubEnv('VITE_IDENTIFICATION_API_BASE_URL', 'https://komorebi-garden.vercel.app');
    capacitorPostMock.mockResolvedValue({
      status: 200,
      data: {
        status: 'ok',
        candidates: [{ commonNameJa: 'チューリップ', plantType: 'tulip' }],
        provider: 'plantnet',
      },
    });

    const imageDataUrl = 'data:image/jpeg;base64,abc';
    const result = await requestIdentificationIdentify(imageDataUrl);
    expect(result.ok).toBe(true);
    expect(capacitorPostMock).toHaveBeenCalledWith(
      expect.objectContaining({
        url: 'https://komorebi-garden.vercel.app/api/identify',
        data: { imageDataUrl },
      }),
    );
  });

  it('returns manual fallback when native identify is not configured', async () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    const result = await identifyPlantImage('data:image/jpeg;base64,abc', 'camera');
    expect(result.status).toBe('error');
    expect(result.message).toBe(IDENTIFICATION_NOT_CONFIGURED_MESSAGE);
    expect(result.candidates.length).toBeGreaterThan(0);
  });

  it('does not call network for sample identification', async () => {
    const result = await identifyPlantImage('data:image/jpeg;base64,abc', 'sample');
    expect(result.status).toBe('ok');
    expect(fetchMock).not.toHaveBeenCalled();
    expect(capacitorPostMock).not.toHaveBeenCalled();
  });

  it('maps web connection failures to manual fallback', async () => {
    fetchMock.mockRejectedValueOnce(new Error('network'));
    const result = await identifyPlantImage('data:image/jpeg;base64,abc', 'file');
    expect(result.status).toBe('error');
    expect(result.message).toContain('接続できませんでした');
  });

  it('exposes native context helper', () => {
    vi.mocked(Capacitor.isNativePlatform).mockReturnValue(true);
    expect(isNativeIdentificationContext()).toBe(true);
  });
});
