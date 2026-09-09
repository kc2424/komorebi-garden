export type SkyPeriod = 'morning' | 'day' | 'dusk' | 'night';
export type SkyMode = 'auto' | SkyPeriod;

export const SKY_PERIOD_LABELS: Record<SkyPeriod, string> = {
  morning: '朝',
  day: '昼',
  dusk: '夕',
  night: '夜',
};

export const SKY_MODE_OPTIONS: { mode: SkyMode; label: string }[] = [
  { mode: 'auto', label: '自動' },
  { mode: 'morning', label: '朝' },
  { mode: 'day', label: '昼' },
  { mode: 'dusk', label: '夕' },
  { mode: 'night', label: '夜' },
];

/** Local-time period: 05:00–09:59 morning, 10:00–15:59 day, 16:00–18:59 dusk, 19:00–04:59 night. */
export function getSkyPeriodFromDate(date: Date): SkyPeriod {
  const totalMinutes = date.getHours() * 60 + date.getMinutes();
  if (totalMinutes >= 300 && totalMinutes < 600) return 'morning';
  if (totalMinutes >= 600 && totalMinutes < 960) return 'day';
  if (totalMinutes >= 960 && totalMinutes < 1140) return 'dusk';
  return 'night';
}

export function resolveSkyPeriod(mode: SkyMode, date: Date): SkyPeriod {
  if (mode === 'auto') return getSkyPeriodFromDate(date);
  return mode;
}

export const SKY_ASSETS: Record<SkyPeriod, string> = {
  morning: '/art/komorebi-sky-morning-v1.png',
  day: '/art/komorebi-sky-day-v1.png',
  dusk: '/art/komorebi-dusk-v1.png',
  night: '/art/komorebi-sky-night-v1.png',
};

export const SKY_FALLBACK_COLORS: Record<SkyPeriod, string> = {
  morning: '#e8c8b0',
  day: '#b8d0e8',
  dusk: '#c9a8b8',
  night: '#2a2438',
};

export const CLOUDS_ASSET = '/art/komorebi-clouds-v1.png';
