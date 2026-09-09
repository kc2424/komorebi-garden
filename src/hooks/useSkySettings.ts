import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  DEFAULT_SKY_SETTINGS,
  readSkySettings,
  writeSkySettings,
  type SkySettings,
} from '../utils/skySettings';
import {
  resolveSkyPeriod,
  SKY_PERIOD_LABELS,
  type SkyMode,
  type SkyPeriod,
} from '../utils/skyTime';

const TICK_MS = 60_000;

export interface UseSkySettingsResult {
  settings: SkySettings;
  activePeriod: SkyPeriod;
  periodLabel: string;
  transitionsEnabled: boolean;
  cloudMotionEnabled: boolean;
  setMode: (mode: SkyMode) => void;
  setMotion: (motion: boolean) => void;
}

export function useSkySettings(): UseSkySettingsResult {
  const [settings, setSettings] = useState<SkySettings>(() => readSkySettings());
  const [now, setNow] = useState(() => new Date());
  const [reducedMotion, setReducedMotion] = useState(false);
  const [documentVisible, setDocumentVisible] = useState(
    () => typeof document !== 'undefined' && !document.hidden,
  );

  const activePeriod = useMemo(
    () => resolveSkyPeriod(settings.mode, now),
    [settings.mode, now],
  );

  const transitionsEnabled = !reducedMotion;
  const cloudMotionEnabled = settings.motion && !reducedMotion && documentVisible;

  const setMode = useCallback((mode: SkyMode) => {
    setSettings((prev) => {
      const next = { ...prev, mode };
      writeSkySettings(next);
      return next;
    });
  }, []);

  const setMotion = useCallback((motion: boolean) => {
    setSettings((prev) => {
      const next = { ...prev, motion };
      writeSkySettings(next);
      return next;
    });
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (event: MediaQueryListEvent) => setReducedMotion(event.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const handleVisibility = () => {
      const visible = !document.hidden;
      setDocumentVisible(visible);
      if (visible) {
        setNow(new Date());
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);
    return () => document.removeEventListener('visibilitychange', handleVisibility);
  }, []);

  useEffect(() => {
    if (!documentVisible) return undefined;
    const id = window.setInterval(() => setNow(new Date()), TICK_MS);
    return () => window.clearInterval(id);
  }, [documentVisible]);

  return {
    settings,
    activePeriod,
    periodLabel: SKY_PERIOD_LABELS[activePeriod],
    transitionsEnabled,
    cloudMotionEnabled,
    setMode,
    setMotion,
  };
}

export { DEFAULT_SKY_SETTINGS };
