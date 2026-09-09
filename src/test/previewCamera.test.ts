import { describe, it, expect } from 'vitest';
import {
  PREVIEW_COMPACT_FRAME_HEIGHT,
  PREVIEW_COMPACT_FRAME_WIDTH,
  PREVIEW_FILL_FRACTION,
  PREVIEW_FRAME_HEIGHT,
  PREVIEW_FRAME_WIDTH,
  getPreviewCameraSetup,
  measurePreviewProjectedExtents,
} from '../utils/previewCamera';
import { MODEL_HEIGHTS } from '../utils/plantModel';

describe('previewCamera', () => {
  it('frames each catalog model to fill most of the preview height via projection', () => {
    for (const modelType of ['tulip', 'cosmos', 'pansy'] as const) {
      const extents = measurePreviewProjectedExtents(
        modelType,
        PREVIEW_FRAME_WIDTH,
        PREVIEW_FRAME_HEIGHT,
      );
      const fill = extents.heightPx / PREVIEW_FRAME_HEIGHT;
      expect(fill).toBeGreaterThanOrEqual(0.75);
      expect(fill).toBeLessThanOrEqual(0.93);

      const setup = getPreviewCameraSetup(modelType, PREVIEW_FRAME_WIDTH, PREVIEW_FRAME_HEIGHT);
      expect(setup.position[1]).toBeGreaterThan(setup.target[1] - 0.05);
    }
  });

  it('fills compact collapsed preview frames', () => {
    for (const modelType of ['tulip', 'cosmos', 'pansy'] as const) {
      const extents = measurePreviewProjectedExtents(
        modelType,
        PREVIEW_COMPACT_FRAME_WIDTH,
        PREVIEW_COMPACT_FRAME_HEIGHT,
      );
      const fill = extents.heightPx / PREVIEW_COMPACT_FRAME_HEIGHT;
      expect(fill).toBeGreaterThanOrEqual(0.72);
      expect(fill).toBeLessThanOrEqual(0.93);
    }
  });

  it('targets pansy lower than tulip for the shorter model', () => {
    const pansy = getPreviewCameraSetup('pansy');
    const tulip = getPreviewCameraSetup('tulip');
    expect(pansy.target[1]).toBeLessThan(tulip.target[1]);
    expect(MODEL_HEIGHTS.pansy).toBeLessThan(MODEL_HEIGHTS.tulip);
  });

  it('uses a fill fraction that maps to ~75–84px in a 96px frame', () => {
    const expectedPx = PREVIEW_FRAME_HEIGHT * PREVIEW_FILL_FRACTION;
    expect(expectedPx).toBeGreaterThanOrEqual(75);
    expect(expectedPx).toBeLessThanOrEqual(84);
  });
});
