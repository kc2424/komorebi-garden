import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { localDateInputValue, resolveTakenAtOnSave } from '../utils/observationDate';

describe('observationDate (JST)', () => {
  beforeEach(() => {
    vi.stubEnv('TZ', 'Asia/Tokyo');
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it('shows Sept 10 in date input for UTC evening timestamp on Sept 10 JST', () => {
    const iso = '2026-09-09T15:00:00.000Z';
    expect(localDateInputValue(iso)).toBe('2026-09-10');
  });

  it('preserves takenAt when only name/memo change and date input unchanged', () => {
    const iso = '2026-09-09T15:00:00.000Z';
    expect(resolveTakenAtOnSave(iso, '2026-09-10')).toBe(iso);
  });

  it('updates takenAt when user changes the local date', () => {
    const iso = '2026-09-09T15:00:00.000Z';
    const next = resolveTakenAtOnSave(iso, '2026-09-11');
    expect(localDateInputValue(next)).toBe('2026-09-11');
    expect(next).not.toBe(iso);
  });
});
