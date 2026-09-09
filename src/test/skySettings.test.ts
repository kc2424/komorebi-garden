import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_SKY_SETTINGS,
  parseSkySettings,
  readSkySettings,
  writeSkySettings,
  SKY_SETTINGS_STORAGE_KEY,
} from '../utils/skySettings';

describe('skySettings storage', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('returns defaults for missing or malformed values', () => {
    expect(parseSkySettings(null)).toEqual(DEFAULT_SKY_SETTINGS);
    expect(parseSkySettings('{not-json')).toEqual(DEFAULT_SKY_SETTINGS);
    expect(parseSkySettings(JSON.stringify({ mode: 'invalid', motion: 'yes' }))).toEqual({
      mode: 'auto',
      motion: true,
    });
  });

  it('reads and writes valid settings', () => {
    writeSkySettings({ mode: 'dusk', motion: false });
    expect(readSkySettings()).toEqual({ mode: 'dusk', motion: false });
    expect(localStorage.getItem(SKY_SETTINGS_STORAGE_KEY)).toBe(
      JSON.stringify({ mode: 'dusk', motion: false }),
    );
  });

  it('falls back safely when localStorage read throws', () => {
    const storage = {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: vi.fn(),
    } as unknown as Storage;

    expect(readSkySettings(storage)).toEqual(DEFAULT_SKY_SETTINGS);
  });

  it('falls back safely when default localStorage getter throws on read', () => {
    const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });

    expect(readSkySettings()).toEqual(DEFAULT_SKY_SETTINGS);

    if (storageDescriptor) {
      Object.defineProperty(window, 'localStorage', storageDescriptor);
    }
  });

  it('does not throw when localStorage write fails', () => {
    const storage = {
      getItem: () => null,
      setItem: () => {
        throw new Error('quota');
      },
    } as unknown as Storage;

    expect(writeSkySettings({ mode: 'night', motion: true }, storage)).toBe(false);
  });

  it('returns false when default localStorage getter throws on write', () => {
    const storageDescriptor = Object.getOwnPropertyDescriptor(window, 'localStorage');
    Object.defineProperty(window, 'localStorage', {
      configurable: true,
      get() {
        throw new DOMException('blocked', 'SecurityError');
      },
    });

    expect(writeSkySettings({ mode: 'day', motion: false })).toBe(false);

    if (storageDescriptor) {
      Object.defineProperty(window, 'localStorage', storageDescriptor);
    }
  });
});
