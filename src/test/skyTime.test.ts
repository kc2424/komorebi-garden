import { describe, it, expect } from 'vitest';
import {
  getSkyPeriodFromDate,
  resolveSkyPeriod,
} from '../utils/skyTime';

function at(hours: number, minutes = 0): Date {
  const date = new Date(2026, 8, 10, hours, minutes, 0, 0);
  return date;
}

describe('getSkyPeriodFromDate', () => {
  it('maps morning from 05:00 through 09:59', () => {
    expect(getSkyPeriodFromDate(at(5, 0))).toBe('morning');
    expect(getSkyPeriodFromDate(at(9, 59))).toBe('morning');
  });

  it('maps day from 10:00 through 15:59', () => {
    expect(getSkyPeriodFromDate(at(10, 0))).toBe('day');
    expect(getSkyPeriodFromDate(at(15, 59))).toBe('day');
  });

  it('maps dusk from 16:00 through 18:59', () => {
    expect(getSkyPeriodFromDate(at(16, 0))).toBe('dusk');
    expect(getSkyPeriodFromDate(at(18, 59))).toBe('dusk');
  });

  it('maps night from 19:00 through 04:59', () => {
    expect(getSkyPeriodFromDate(at(19, 0))).toBe('night');
    expect(getSkyPeriodFromDate(at(23, 59))).toBe('night');
    expect(getSkyPeriodFromDate(at(0, 0))).toBe('night');
    expect(getSkyPeriodFromDate(at(4, 59))).toBe('night');
  });
});

describe('resolveSkyPeriod', () => {
  it('uses local time in auto mode', () => {
    expect(resolveSkyPeriod('auto', at(11, 30))).toBe('day');
  });

  it('keeps a fixed mode regardless of clock time', () => {
    expect(resolveSkyPeriod('night', at(11, 30))).toBe('night');
    expect(resolveSkyPeriod('morning', at(22, 0))).toBe('morning');
  });
});
