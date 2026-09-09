import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import {
  getGrassTuftsGeometry,
  getTurfCapGeometry,
  TURF_BORDER,
  TURF_BOTTOM_Y,
  TURF_CORNER_RADIUS,
  TURF_RING_Y,
  turfBorderNorm,
  turfSurfaceY,
} from './terrainGeometry';

function triangleNormalY(
  positions: THREE.BufferAttribute,
  ia: number,
  ib: number,
  ic: number,
): number {
  const va = new THREE.Vector3(positions.getX(ia), positions.getY(ia), positions.getZ(ia));
  const vb = new THREE.Vector3(positions.getX(ib), positions.getY(ib), positions.getZ(ib));
  const vc = new THREE.Vector3(positions.getX(ic), positions.getY(ic), positions.getZ(ic));
  const edge1 = new THREE.Vector3().subVectors(vb, va);
  const edge2 = new THREE.Vector3().subVectors(vc, va);
  return new THREE.Vector3().crossVectors(edge1, edge2).y;
}

function isTopCapTriangle(
  positions: THREE.BufferAttribute,
  ia: number,
  ib: number,
  ic: number,
): boolean {
  const minTopY = TURF_BOTTOM_Y + 0.001;
  return (
    positions.getY(ia) > minTopY &&
    positions.getY(ib) > minTopY &&
    positions.getY(ic) > minTopY
  );
}

function isInteriorTopTriangle(
  positions: THREE.BufferAttribute,
  ia: number,
  ib: number,
  ic: number,
): boolean {
  const cx = (positions.getX(ia) + positions.getX(ib) + positions.getX(ic)) / 3;
  const cz = (positions.getZ(ia) + positions.getZ(ib) + positions.getZ(ic)) / 3;
  return turfBorderNorm(cx, cz) < 0.85;
}

describe('terrainGeometry', () => {
  it('turfBorderNorm is continuous across flat-edge and corner boundaries', () => {
    const inner = TURF_BORDER - TURF_CORNER_RADIUS;
    const eps = 0.00001;

    const xEdgeInside = turfBorderNorm(inner - eps, 0);
    const xEdgeOutside = turfBorderNorm(inner + eps, 0);
    expect(Math.abs(xEdgeInside - xEdgeOutside)).toBeLessThan(0.001);

    const zEdgeInside = turfBorderNorm(0, inner - eps);
    const zEdgeOutside = turfBorderNorm(0, inner + eps);
    expect(Math.abs(zEdgeInside - zEdgeOutside)).toBeLessThan(0.001);

    const diag = inner / Math.SQRT2;
    const diagInside = turfBorderNorm(diag - eps, diag - eps);
    const diagOutside = turfBorderNorm(diag + eps, diag + eps);
    expect(Math.abs(diagInside - diagOutside)).toBeLessThan(0.001);
  });

  it('getTurfCapGeometry top cap triangles face +Y away from the lawn interior', () => {
    const geometry = getTurfCapGeometry();
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const index = geometry.getIndex();
    expect(index).not.toBeNull();

    const indices = index!.array;
    let checked = 0;

    for (let t = 0; t < indices.length / 3; t++) {
      const ia = indices[t * 3];
      const ib = indices[t * 3 + 1];
      const ic = indices[t * 3 + 2];

      if (!isTopCapTriangle(positions, ia, ib, ic)) {
        continue;
      }
      if (!isInteriorTopTriangle(positions, ia, ib, ic)) {
        continue;
      }

      expect(triangleNormalY(positions, ia, ib, ic)).toBeGreaterThan(0);
      checked += 1;
    }

    expect(checked).toBeGreaterThan(0);
  });

  it('turf cap respects root, ring clearance, and outer peak heights', () => {
    const geometry = getTurfCapGeometry();
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    const floatTol = 0.003;
    let maxY = -Infinity;
    let rootMaxY = -Infinity;
    let ringMaxY = -Infinity;
    let outerMaxY = -Infinity;

    for (let i = 0; i < positions.count; i++) {
      const y = positions.getY(i);
      const x = positions.getX(i);
      const z = positions.getZ(i);
      if (y <= TURF_BOTTOM_Y + 0.001) continue;

      const r = Math.hypot(x, z);
      maxY = Math.max(maxY, y);
      if (r <= 0.12) rootMaxY = Math.max(rootMaxY, y);
      if (r <= 0.302) ringMaxY = Math.max(ringMaxY, y);
      if (r > 0.302) outerMaxY = Math.max(outerMaxY, y);
    }

    expect(rootMaxY).toBeLessThanOrEqual(0.058 + floatTol);
    expect(ringMaxY).toBeLessThan(0.12);
    expect(maxY).toBeLessThanOrEqual(0.155 + floatTol);
    expect(outerMaxY).toBeGreaterThanOrEqual(0.14);
    expect(maxY).toBeGreaterThan(TURF_RING_Y);
  });

  it('turfSurfaceY settles to edge height and forms broad low rises', () => {
    const edgeY = turfSurfaceY(TURF_BORDER, 0);
    expect(edgeY).toBeCloseTo(0.045, 2);

    const centerY = turfSurfaceY(0, 0);
    expect(centerY).toBeGreaterThanOrEqual(0.055);
    expect(centerY).toBeLessThanOrEqual(0.068);

    const riseY = turfSurfaceY(0.34, 0.3);
    expect(riseY).toBeGreaterThan(centerY + 0.04);
    expect(riseY).toBeLessThanOrEqual(0.155);
    expect(Math.hypot(0.34, 0.3)).toBeGreaterThan(0.302);
  });

  it('turf cap vertex normals are finite', () => {
    const geometry = getTurfCapGeometry();
    const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
    expect(normals).toBeDefined();

    for (let i = 0; i < normals.count; i++) {
      const nx = normals.getX(i);
      const ny = normals.getY(i);
      const nz = normals.getZ(i);
      expect(Number.isFinite(nx)).toBe(true);
      expect(Number.isFinite(ny)).toBe(true);
      expect(Number.isFinite(nz)).toBe(true);
    }
  });

  it('grass tufts stay inside footprint and clear root and ring zones', () => {
    const tileSeeds = [
      [0, 0],
      [2, -1],
      [-3, 4],
      [7, 7],
    ];

    for (const [tileX, tileZ] of tileSeeds) {
      const geometry = getGrassTuftsGeometry(tileX, tileZ);
      const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
      expect(positions.count).toBeGreaterThan(0);

      for (let i = 0; i < positions.count; i++) {
        const x = positions.getX(i);
        const z = positions.getZ(i);
        const r = Math.hypot(x, z);

        expect(turfBorderNorm(x, z)).toBeLessThanOrEqual(1.001);
        expect(r).toBeGreaterThan(0.302);
        expect(r < 0.2 || r > 0.28).toBe(true);
      }

      const normals = geometry.getAttribute('normal') as THREE.BufferAttribute;
      for (let i = 0; i < normals.count; i++) {
        expect(Number.isFinite(normals.getX(i))).toBe(true);
        expect(Number.isFinite(normals.getY(i))).toBe(true);
        expect(Number.isFinite(normals.getZ(i))).toBe(true);
      }
    }
  });

  it('grass blades keep sample tile count and use widened readable dimensions', () => {
    const geometry = getGrassTuftsGeometry(0, 0);
    const positions = geometry.getAttribute('position') as THREE.BufferAttribute;
    expect(positions.count / 5).toBe(88);

    let minW = Infinity;
    let maxW = 0;
    let minH = Infinity;
    let maxH = 0;
    for (let v = 0; v < positions.count; v += 5) {
      const width = Math.hypot(
        positions.getX(v) - positions.getX(v + 1),
        positions.getZ(v) - positions.getZ(v + 1),
      );
      const height = positions.getY(v + 4) - positions.getY(v);
      minW = Math.min(minW, width);
      maxW = Math.max(maxW, width);
      minH = Math.min(minH, height);
      maxH = Math.max(maxH, height);
    }

    expect(minW).toBeGreaterThanOrEqual(0.018);
    expect(maxW).toBeLessThanOrEqual(0.034);
    expect(minH).toBeGreaterThanOrEqual(0.042);
    expect(maxH).toBeLessThanOrEqual(0.078);
  });

  it('grass tuft geometry is deterministic per tile and varies across tiles', async () => {
    const a = getGrassTuftsGeometry(1, 2);
    const posA = (a.getAttribute('position') as THREE.BufferAttribute).array;

    vi.resetModules();
    const { getGrassTuftsGeometry: getGrassTuftsGeometryFresh } = await import('./terrainGeometry');
    const aFresh = getGrassTuftsGeometryFresh(1, 2);
    const posAFresh = (aFresh.getAttribute('position') as THREE.BufferAttribute).array;

    expect(posA.length).toBeGreaterThan(0);
    expect(posAFresh.length).toBe(posA.length);
    for (let i = 0; i < posA.length; i++) {
      expect(posAFresh[i]).toBeCloseTo(posA[i], 6);
    }

    const b = getGrassTuftsGeometryFresh(-4, 3);
    const posB = (b.getAttribute('position') as THREE.BufferAttribute).array;

    let differs = posA.length !== posB.length;
    if (!differs) {
      for (let i = 0; i < posA.length; i++) {
        if (Math.abs(posA[i] - posB[i]) > 1e-4) {
          differs = true;
          break;
        }
      }
    }
    expect(differs).toBe(true);
  });
});
