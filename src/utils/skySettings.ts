import type { SkyMode } from './skyTime';

export const SKY_SETTINGS_STORAGE_KEY = 'komorebi-sky-settings-v1';

export interface SkySettings {
  mode: SkyMode;
  motion: boolean;
}

export const DEFAULT_SKY_SETTINGS: SkySettings = {
  mode: 'auto',
  motion: true,
};

const VALID_MODES: SkyMode[] = ['auto', 'morning', 'day', 'dusk', 'night'];

export function validateSkyMode(value: unknown): SkyMode {
  if (typeof value === 'string' && (VALID_MODES as string[]).includes(value)) {
    return value as SkyMode;
  }
  return DEFAULT_SKY_SETTINGS.mode;
}

export function parseSkySettings(raw: string | null): SkySettings {
  if (!raw) return DEFAULT_SKY_SETTINGS;
  try {
    const parsed = JSON.parse(raw) as { mode?: unknown; motion?: unknown };
    return {
      mode: validateSkyMode(parsed?.mode),
      motion: typeof parsed?.motion === 'boolean' ? parsed.motion : DEFAULT_SKY_SETTINGS.motion,
    };
  } catch {
    return DEFAULT_SKY_SETTINGS;
  }
}

export function readSkySettings(storage?: Storage): SkySettings {
  try {
    const target = storage ?? localStorage;
    return parseSkySettings(target.getItem(SKY_SETTINGS_STORAGE_KEY));
  } catch {
    return DEFAULT_SKY_SETTINGS;
  }
}

export function writeSkySettings(settings: SkySettings, storage?: Storage): boolean {
  try {
    const target = storage ?? localStorage;
    target.setItem(SKY_SETTINGS_STORAGE_KEY, JSON.stringify(settings));
    return true;
  } catch {
    return false;
  }
}
