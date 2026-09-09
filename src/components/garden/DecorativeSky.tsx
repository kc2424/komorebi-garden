import { useEffect, useState } from 'react';
import {
  CLOUDS_ASSET,
  SKY_ASSETS,
  SKY_FALLBACK_COLORS,
  type SkyPeriod,
} from '../../utils/skyTime';
import styles from './DecorativeSky.module.css';

const SKY_PERIODS: SkyPeriod[] = ['morning', 'day', 'dusk', 'night'];

interface DecorativeSkyProps {
  period: SkyPeriod;
  cloudMotionEnabled: boolean;
  transitionsEnabled: boolean;
}

function useAssetLoadState(src: string): 'loading' | 'loaded' | 'error' {
  const [state, setState] = useState<'loading' | 'loaded' | 'error'>('loading');

  useEffect(() => {
    setState('loading');
    const img = new Image();
    img.onload = () => setState('loaded');
    img.onerror = () => setState('error');
    img.src = src;
    return () => {
      img.onload = null;
      img.onerror = null;
    };
  }, [src]);

  return state;
}

export function DecorativeSky({
  period,
  cloudMotionEnabled,
  transitionsEnabled,
}: DecorativeSkyProps) {
  const morningLoad = useAssetLoadState(SKY_ASSETS.morning);
  const dayLoad = useAssetLoadState(SKY_ASSETS.day);
  const duskLoad = useAssetLoadState(SKY_ASSETS.dusk);
  const nightLoad = useAssetLoadState(SKY_ASSETS.night);
  const cloudsLoadState = useAssetLoadState(CLOUDS_ASSET);

  const skyLoadStates: Record<SkyPeriod, 'loading' | 'loaded' | 'error'> = {
    morning: morningLoad,
    day: dayLoad,
    dusk: duskLoad,
    night: nightLoad,
  };

  return (
    <div className={styles.sky} aria-hidden="true">
      <div className={styles.layers}>
        {SKY_PERIODS.map((layerPeriod) => {
          const isActive = layerPeriod === period;
          const loadState = skyLoadStates[layerPeriod];
          const showImage = loadState === 'loaded';

          return (
            <div
              key={layerPeriod}
              className={[
                styles.layer,
                isActive ? styles.layerActive : styles.layerInactive,
                layerPeriod === 'dusk' ? styles.layerDusk : '',
                layerPeriod === 'night' ? styles.layerNight : '',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                backgroundColor: SKY_FALLBACK_COLORS[layerPeriod],
                backgroundImage: showImage ? `url(${SKY_ASSETS[layerPeriod]})` : undefined,
                transition: transitionsEnabled ? undefined : 'none',
              }}
            />
          );
        })}
      </div>

      <div className={styles.lowerHaze} />

      {cloudsLoadState === 'loaded' && (
        <div
          className={`${styles.clouds} ${cloudMotionEnabled ? styles.cloudsMotionRunning : ''}`}
          style={{
            WebkitMaskImage: `url(${CLOUDS_ASSET})`,
            maskImage: `url(${CLOUDS_ASSET})`,
          }}
        />
      )}
    </div>
  );
}
