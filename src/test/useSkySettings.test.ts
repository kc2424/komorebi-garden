import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useSkySettings } from '../hooks/useSkySettings';
import { SKY_SETTINGS_STORAGE_KEY } from '../utils/skySettings';

function mockMatchMedia(reducedMotion: boolean) {
  window.matchMedia = vi.fn().mockImplementation((query: string) => ({
    matches: query === '(prefers-reduced-motion: reduce)' ? reducedMotion : false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('useSkySettings', () => {
  beforeEach(() => {
    localStorage.clear();
    mockMatchMedia(false);
    vi.useFakeTimers();
    vi.setSystemTime(new Date(2026, 8, 10, 11, 0, 0, 0));
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.restoreAllMocks();
  });

  it('resolves auto mode from the current local time', () => {
    const { result } = renderHook(() => useSkySettings());
    expect(result.current.activePeriod).toBe('day');
    expect(result.current.periodLabel).toBe('昼');
  });

  it('persists fixed mode changes separately from garden storage', () => {
    const { result } = renderHook(() => useSkySettings());

    act(() => {
      result.current.setMode('night');
    });

    expect(result.current.settings.mode).toBe('night');
    expect(result.current.activePeriod).toBe('night');
    expect(localStorage.getItem(SKY_SETTINGS_STORAGE_KEY)).toBe(
      JSON.stringify({ mode: 'night', motion: true }),
    );
    expect(localStorage.getItem('komorebi-garden-v1')).toBeNull();
  });

  it('pauses cloud motion when the user turns motion off', () => {
    const { result } = renderHook(() => useSkySettings());
    expect(result.current.cloudMotionEnabled).toBe(true);

    act(() => {
      result.current.setMotion(false);
    });
    expect(result.current.cloudMotionEnabled).toBe(false);
  });

  it('disables transitions and cloud motion when reduced motion is preferred', () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useSkySettings());
    expect(result.current.transitionsEnabled).toBe(false);
    expect(result.current.cloudMotionEnabled).toBe(false);
  });

  it('pauses cloud motion while the document is hidden', () => {
    const { result } = renderHook(() => useSkySettings());
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.cloudMotionEnabled).toBe(false);
  });

  it('refreshes time on visibility return and ticks once per minute while visible', () => {
    const { result } = renderHook(() => useSkySettings());
    expect(result.current.activePeriod).toBe('day');

    vi.setSystemTime(new Date(2026, 8, 10, 16, 30, 0, 0));
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: true,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });

    act(() => {
      vi.advanceTimersByTime(120_000);
    });
    expect(result.current.activePeriod).toBe('day');

    Object.defineProperty(document, 'hidden', {
      configurable: true,
      value: false,
    });
    act(() => {
      document.dispatchEvent(new Event('visibilitychange'));
    });
    expect(result.current.activePeriod).toBe('dusk');

    vi.setSystemTime(new Date(2026, 8, 10, 17, 0, 0, 0));
    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(result.current.activePeriod).toBe('dusk');
  });
});
