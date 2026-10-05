import { describe, expect, it } from 'vitest';
import { DECORATION_CATALOG } from '../../data/decorationCatalog';
import { getDecorationGeometry } from './decorationGeometry';

describe('decoration geometry', () => {
  it.each(DECORATION_CATALOG)('$type fits one tile at every rotation with finite geometry and a conservative camera height', (entry) => {
    const parts = getDecorationGeometry(entry.type);
    expect(parts.length).toBeGreaterThan(0);
    expect(parts.length).toBeLessThanOrEqual(9);
    let triangles = 0;
    let highestPoint = 0;
    for (const part of parts) {
      const positions = part.geometry.getAttribute('position');
      const normals = part.geometry.getAttribute('normal');
      expect(normals.count).toBe(positions.count);
      triangles += positions.count / 3;
      for (let index = 0; index < positions.count; index += 1) {
        const x = positions.getX(index);
        const y = positions.getY(index);
        const z = positions.getZ(index);
        expect(Number.isFinite(x + y + z)).toBe(true);
        expect(Math.hypot(x, z)).toBeLessThan(0.49);
        expect(y).toBeGreaterThanOrEqual(-0.002);
        highestPoint = Math.max(highestPoint, y);
      }
    }
    expect(highestPoint).toBeLessThanOrEqual(entry.height);
    expect(highestPoint).toBeGreaterThan(0.05);
    expect(triangles).toBeLessThan(7000);
    expect(getDecorationGeometry(entry.type)).toBe(parts);
  });
});
