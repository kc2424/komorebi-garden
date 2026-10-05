import { describe, expect, it } from 'vitest';
import { getSoilColumnGeometry, getTileSurfaceGeometry, getTileSurfaceMaterial } from './surfaceGeometry';
import { getGrassTuftsGeometry, GRASS_GEOMETRY_VARIANTS } from './terrainGeometry';

describe('shared terrain geometry', () => {
  it.each(['soil', 'stone', 'gravel', 'wood', 'water'] as const)('%s is one bounded, vertex-colored draw with a reusable geometry', (surface) => {
    const geometry = getTileSurfaceGeometry(surface);
    const positions = geometry.getAttribute('position');
    const colors = geometry.getAttribute('color');
    const normals = geometry.getAttribute('normal');
    expect(geometry.groups).toHaveLength(0);
    expect(colors.count).toBe(positions.count);
    expect(normals.count).toBe(positions.count);
    expect(positions.count / 3).toBeLessThan(700);
    for (let index = 0; index < positions.count; index += 1) {
      expect(Math.abs(positions.getX(index))).toBeLessThan(0.5);
      expect(Math.abs(positions.getZ(index))).toBeLessThan(0.5);
      expect(positions.getY(index)).toBeGreaterThanOrEqual(0);
      expect(positions.getY(index)).toBeLessThan(0.1);
      expect(Number.isFinite(normals.getX(index) + normals.getY(index) + normals.getZ(index))).toBe(true);
      expect(Number.isFinite(colors.getX(index) + colors.getY(index) + colors.getZ(index))).toBe(true);
    }
    expect(getTileSurfaceGeometry(surface)).toBe(geometry);
    const material = getTileSurfaceMaterial(surface);
    expect(material.vertexColors).toBe(true);
    expect(material.transparent).toBe(false);
    expect(getTileSurfaceMaterial(surface)).toBe(material);
  });

  it('uses four compact rounded columns whose bottoms stay grounded and tops follow elevation', () => {
    for (let height = 0; height <= 3; height += 1) {
      const geometry = getSoilColumnGeometry(height);
      expect(geometry.boundingBox?.min.y).toBeCloseTo(-0.3, 6);
      expect(geometry.boundingBox?.max.y).toBeCloseTo(0.04 + height * 0.32, 6);
      expect(geometry.getAttribute('position').count / 3).toBeLessThanOrEqual(300);
      expect(getSoilColumnGeometry(height)).toBe(geometry);
    }
    expect(getSoilColumnGeometry(50)).toBe(getSoilColumnGeometry(3));
    expect(getSoilColumnGeometry(-50)).toBe(getSoilColumnGeometry(0));
  });

  it('reuses a finite palette of grass shapes as the garden grows', () => {
    const shapes = new Set();
    for (let index = -256; index < 256; index += 1) {
      shapes.add(getGrassTuftsGeometry(index, index * 3 + 17));
    }
    expect(shapes.size).toBeGreaterThan(8);
    expect(shapes.size).toBeLessThanOrEqual(GRASS_GEOMETRY_VARIANTS);
    expect(getGrassTuftsGeometry(0, 0)).toBe(getGrassTuftsGeometry(0, 0));
  });
});
