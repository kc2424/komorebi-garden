import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FLOWER_CATALOG, getPlantDisplayName, getPlantThumbnailUrl, isFlowerPlantable } from '../data/flowerCatalog';
import { PLANT_SHAPES } from '../data/plantShapes';
import { TULIP_COLORS } from '../data/tulip';
import { getLightweightPlantGeometry, getLightweightPlantStats } from '../components/garden3d/lightweightPlantGeometry';
import { getModelHeight, resolvePlantModelType } from '../utils/plantModel';
import { getPreviewCameraSetup } from '../utils/previewCamera';

const expectedModels = [
  'tulip', 'cosmos', 'pansy', 'daisy', 'sunflower', 'lavender', 'rose', 'hydrangea',
  'marigold', 'daffodil', 'lily', 'poppy', 'bluebell', 'forget-me-not', 'allium',
  'fern', 'hosta', 'ornamental-grass', 'maple', 'cherry',
] as const;

describe('lightweight sandbox plant collection', () => {
  it('offers 20 freely placeable species across flowers, foliage, and trees', () => {
    expect(FLOWER_CATALOG.map((entry) => entry.modelType)).toEqual(expectedModels);
    expect(FLOWER_CATALOG.filter((entry) => entry.category === 'flower')).toHaveLength(15);
    expect(FLOWER_CATALOG.filter((entry) => entry.category === 'foliage')).toHaveLength(3);
    expect(FLOWER_CATALOG.filter((entry) => entry.category === 'tree')).toHaveLength(2);
    for (const modelType of expectedModels) {
      expect(isFlowerPlantable(modelType, false)).toBe(true);
      expect(isFlowerPlantable(modelType, true)).toBe(true);
    }
  });

  it('keeps every plant in one finite, bounded mesh within the mobile geometry budget', () => {
    const silhouettes = new Set<string>();
    for (const modelType of expectedModels) {
      const geometry = getLightweightPlantGeometry(modelType);
      const positions = geometry.getAttribute('position');
      const stats = getLightweightPlantStats(modelType);
      const bounds = geometry.boundingBox!;
      expect(stats.drawCalls).toBe(1);
      expect(geometry.groups).toHaveLength(0);
      expect(stats.triangles).toBeGreaterThan(100);
      expect(stats.triangles).toBeLessThanOrEqual(1500);
      expect(stats.vertices).toBeLessThanOrEqual(2100);
      for (const attribute of ['position', 'normal', 'color']) {
        const values = geometry.getAttribute(attribute);
        expect(values.count).toBe(positions.count);
        expect(Array.from(values.array).every(Number.isFinite)).toBe(true);
      }
      expect(bounds.min.y).toBeGreaterThan(-0.01);
      expect(bounds.max.y).toBeCloseTo(getModelHeight(modelType), 2);
      expect(bounds.max.x - bounds.min.x).toBeLessThanOrEqual(PLANT_SHAPES[modelType].width + 0.001);
      expect(bounds.max.z - bounds.min.z).toBeLessThanOrEqual(PLANT_SHAPES[modelType].width + 0.001);
      expect(Math.max(...geometry.index!.array)).toBeLessThan(positions.count);
      silhouettes.add(Array.from(positions.array).map((value) => value.toFixed(4)).join(','));
      const setup = getPreviewCameraSetup(modelType);
      expect([...setup.position, ...setup.target, setup.zoom].every(Number.isFinite)).toBe(true);
    }
    // A new species must bring a new shape, rather than reusing a recolored mesh.
    expect(silhouettes.size).toBe(20);
  });

  it('shares cached geometry for repeated placements and ignores unused color slots', () => {
    for (const modelType of expectedModels) {
      expect(getLightweightPlantGeometry(modelType)).toBe(getLightweightPlantGeometry(modelType));
      if (modelType !== 'tulip') {
        expect(getLightweightPlantGeometry(modelType, 'red')).toBe(getLightweightPlantGeometry(modelType, 'purple'));
      }
    }
    const red = getLightweightPlantGeometry('tulip', 'red');
    const white = getLightweightPlantGeometry('tulip', 'white');
    expect(red).not.toBe(white);
    expect(Array.from(red.getAttribute('position').array)).toEqual(Array.from(white.getAttribute('position').array));
    expect(Array.from(red.getAttribute('color').array)).not.toEqual(Array.from(white.getAttribute('color').array));
  });

  it('ships a local static preview for every model and all six tulip colors', () => {
    const urls = [
      ...FLOWER_CATALOG.map((entry) => entry.thumbnail),
      ...TULIP_COLORS.map((color) => getPlantThumbnailUrl('tulip', color.id)),
    ];
    for (const url of new Set(urls)) {
      const svg = readFileSync(resolve('public', url.replace(/^\//, '')), 'utf8');
      expect(svg.startsWith('<svg ')).toBe(true);
      expect(svg).toContain('viewBox="0 0 160 128"');
      expect(svg).not.toMatch(/<script|<foreignObject|href=/i);
    }
  });

  it('retains saved tulip fallback, existing model identifiers, and explicit color labels', () => {
    expect(resolvePlantModelType({})).toBe('tulip');
    expect(resolvePlantModelType({ modelType: 'cosmos' })).toBe('cosmos');
    expect(resolvePlantModelType({ modelType: 'pansy' })).toBe('pansy');
    expect(getPlantDisplayName({ color: 'red' })).toBe('チューリップ（赤）');
    expect(getPlantDisplayName({ modelType: 'cherry', color: 'red' })).toBe('サクラ');
    expect(getModelHeight('pansy')).toBeLessThan(getModelHeight('tulip'));
    expect(getModelHeight('cherry')).toBeGreaterThan(getModelHeight('sunflower'));
  });
});
