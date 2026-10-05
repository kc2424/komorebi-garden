import type { GardenModelType } from '../types';

/** Root-to-tip bounds used by both the mesh builder and camera framing. */
export const PLANT_SHAPES: Record<GardenModelType, { height: number; width: number }> = {
  tulip: { height: 1.4, width: 0.6 },
  cosmos: { height: 1.2, width: 0.78 },
  pansy: { height: 0.55, width: 0.65 },
  daisy: { height: 0.74, width: 0.66 },
  sunflower: { height: 1.72, width: 0.86 },
  lavender: { height: 1.08, width: 0.72 },
  rose: { height: 1.05, width: 0.7 },
  hydrangea: { height: 0.92, width: 0.92 },
  marigold: { height: 0.65, width: 0.72 },
  daffodil: { height: 0.94, width: 0.66 },
  lily: { height: 1.32, width: 0.8 },
  poppy: { height: 1.1, width: 0.74 },
  bluebell: { height: 0.92, width: 0.62 },
  'forget-me-not': { height: 0.46, width: 0.66 },
  allium: { height: 1.42, width: 0.62 },
  fern: { height: 0.74, width: 0.92 },
  hosta: { height: 0.55, width: 0.88 },
  'ornamental-grass': { height: 1.15, width: 0.82 },
  maple: { height: 2.28, width: 1.32 },
  cherry: { height: 2.18, width: 1.4 },
};
