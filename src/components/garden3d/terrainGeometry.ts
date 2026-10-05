import * as THREE from 'three';
import { tulipVertexColor } from './proceduralMaterials';

/** A bounded shape palette: expanding and repainting the garden cannot grow this cache forever. */
export const GRASS_GEOMETRY_VARIANTS = 64;
const grassGeometryCache = new Map<number, THREE.BufferGeometry>();

function seededRandom(seed: number): () => number {
  let state = seed;
  return () => {
    state = (state * 1664525 + 1013904223) % 4294967296;
    return state / 4294967296;
  };
}

export const TURF_HALF = 0.49;
export const TURF_BORDER = 0.49;
export const TURF_CORNER_RADIUS = 0.085;
export const TURF_CENTER_Y = 0.115;
export const TURF_EDGE_Y = 0.045;
export const TURF_BOTTOM_Y = 0.04;
/** Y for editor selection rings — just above the grass cap surface. */
export const TURF_RING_Y = 0.132;

const GRASS_PALETTE = ['#718544', '#788d4b', '#819350', '#6c8145', '#8a9c58'];

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Normalized 0 at center → 1 at rounded-square border (continuous Chebyshev + corner arc). */
export function turfBorderNorm(x: number, z: number): number {
  const ax = Math.abs(x);
  const az = Math.abs(z);
  const inner = TURF_BORDER - TURF_CORNER_RADIUS;

  let dist: number;
  if (ax <= inner && az <= inner) {
    dist = Math.max(ax, az);
  } else {
    const cx = Math.max(ax - inner, 0);
    const cz = Math.max(az - inner, 0);
    dist = inner + Math.hypot(cx, cz);
  }
  return dist / TURF_BORDER;
}

const TURF_ROOT_BASE_Y = 0.058;
/** Broad rises sit outside the selection-ring clearance (r > 0.302). */
const TURF_RISES = [
  { cx: 0.34, cz: 0.3, amp: 0.102, radius: 0.22 },
  { cx: -0.36, cz: -0.26, amp: 0.1, radius: 0.2 },
  { cx: -0.18, cz: 0.38, amp: 0.097, radius: 0.24 },
] as const;
const TURF_RING_CLEAR_START = 0.3;
const TURF_RING_CLEAR_END = 0.42;

function broadGaussianBump(
  x: number,
  z: number,
  cx: number,
  cz: number,
  amp: number,
  radius: number,
): number {
  const dx = x - cx;
  const dz = z - cz;
  const distSq = dx * dx + dz * dz;
  const sigma = radius * 0.55;
  return amp * Math.exp(-distSq / (2 * sigma * sigma));
}

export function turfSurfaceY(x: number, z: number): number {
  const norm = turfBorderNorm(x, z);
  const edgeBlend = smoothstep(0, 1, norm);
  const base = TURF_ROOT_BASE_Y + (TURF_EDGE_Y - TURF_ROOT_BASE_Y) * edgeBlend;

  const rootR = Math.hypot(x, z);
  const ringClearance = smoothstep(TURF_RING_CLEAR_START, TURF_RING_CLEAR_END, rootR);
  const edgeSuppression = 1 - smoothstep(0.72, 0.98, norm) * 0.95;

  let rises = 0;
  for (const rise of TURF_RISES) {
    rises += broadGaussianBump(x, z, rise.cx, rise.cz, rise.amp, rise.radius);
  }

  return base + rises * ringClearance * edgeSuppression;
}

function isInsideTurf(x: number, z: number): boolean {
  return turfBorderNorm(x, z) <= 1.001;
}

function grassColor(rand: () => number): THREE.Color {
  const hex = GRASS_PALETTE[Math.floor(rand() * GRASS_PALETTE.length)];
  const color = tulipVertexColor(hex);
  const variation = 0.96 + rand() * 0.08;
  color.multiplyScalar(variation);
  return color;
}

function buildTurfCapGeometry(): THREE.BufferGeometry {
  const gridSize = 16;
  const positions: number[] = [];
  const uvs: number[] = [];
  const indices: number[] = [];

  const topVerts: number[] = [];
  for (let j = 0; j <= gridSize; j++) {
    for (let i = 0; i <= gridSize; i++) {
      const u = i / gridSize;
      const v = j / gridSize;
      const x = (u * 2 - 1) * TURF_HALF;
      const z = (v * 2 - 1) * TURF_HALF;
      const y = isInsideTurf(x, z) ? turfSurfaceY(x, z) : TURF_EDGE_Y;
      topVerts.push(x, y, z);
      positions.push(x, y, z);
      uvs.push(u, v);
    }
  }

  const row = gridSize + 1;
  for (let j = 0; j < gridSize; j++) {
    for (let i = 0; i < gridSize; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      const ax = topVerts[a * 3];
      const az = topVerts[a * 3 + 2];
      const bx = topVerts[b * 3];
      const bz = topVerts[b * 3 + 2];
      const cx = topVerts[c * 3];
      const cz = topVerts[c * 3 + 2];
      const dx = topVerts[d * 3];
      const dz = topVerts[d * 3 + 2];
      if (!isInsideTurf(ax, az) && !isInsideTurf(bx, bz) && !isInsideTurf(cx, cz) && !isInsideTurf(dx, dz)) {
        continue;
      }
      // Grid i→+x, j→+z: (a,d,b) and (a,c,d) yield +Y face normals.
      indices.push(a, d, b, a, c, d);
    }
  }

  const perimeterSegments = 64;
  const profile = buildRoundedSquareProfile(TURF_HALF, TURF_CORNER_RADIUS, perimeterSegments);
  const bottomStart = positions.length / 3;
  for (let i = 0; i < perimeterSegments; i++) {
    const p = profile[i];
    positions.push(p.x, TURF_BOTTOM_Y, p.y);
    uvs.push(0.5 + p.x, 0.5 + p.y);
  }

  for (let i = 0; i < perimeterSegments; i++) {
    const next = (i + 1) % perimeterSegments;
    const topA = findNearestTopVertex(topVerts, profile[i].x, profile[i].y, row, gridSize);
    const topB = findNearestTopVertex(topVerts, profile[next].x, profile[next].y, row, gridSize);
    const botA = bottomStart + i;
    const botB = bottomStart + next;
    // Perimeter CCW from +Y: outward skirt faces use (topA,topB,botB) and (topA,botB,botA).
    indices.push(topA, topB, botB, topA, botB, botA);
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function findNearestTopVertex(
  topVerts: number[],
  x: number,
  z: number,
  row: number,
  gridSize: number,
): number {
  let best = 0;
  let bestDist = Infinity;
  for (let j = 0; j <= gridSize; j++) {
    for (let i = 0; i <= gridSize; i++) {
      const idx = j * row + i;
      const vx = topVerts[idx * 3];
      const vz = topVerts[idx * 3 + 2];
      const d = (vx - x) ** 2 + (vz - z) ** 2;
      if (d < bestDist) {
        bestDist = d;
        best = idx;
      }
    }
  }
  return best;
}

function pointOnRoundedSquarePerimeter(
  dist: number,
  half: number,
  cornerRadius: number,
): THREE.Vector2 {
  const inner = half - cornerRadius;
  const edgeLen = 2 * inner;
  const arcLen = (Math.PI / 2) * cornerRadius;
  let d = dist;

  if (d < edgeLen) {
    const u = d / edgeLen;
    return new THREE.Vector2(-inner + u * edgeLen, -half);
  }
  d -= edgeLen;

  if (d < arcLen) {
    const u = d / arcLen;
    const angle = -Math.PI / 2 + u * (Math.PI / 2);
    return new THREE.Vector2(
      inner + cornerRadius * Math.cos(angle),
      -inner + cornerRadius * Math.sin(angle),
    );
  }
  d -= arcLen;

  if (d < edgeLen) {
    const u = d / edgeLen;
    return new THREE.Vector2(half, -inner + u * edgeLen);
  }
  d -= arcLen;

  if (d < arcLen) {
    const u = d / arcLen;
    const angle = u * (Math.PI / 2);
    return new THREE.Vector2(
      inner + cornerRadius * Math.cos(angle),
      inner + cornerRadius * Math.sin(angle),
    );
  }
  d -= arcLen;

  if (d < edgeLen) {
    const u = d / edgeLen;
    return new THREE.Vector2(inner - u * edgeLen, half);
  }
  d -= arcLen;

  if (d < arcLen) {
    const u = d / arcLen;
    const angle = Math.PI / 2 + u * (Math.PI / 2);
    return new THREE.Vector2(
      -inner + cornerRadius * Math.cos(angle),
      inner + cornerRadius * Math.sin(angle),
    );
  }
  d -= arcLen;

  if (d < edgeLen) {
    const u = d / edgeLen;
    return new THREE.Vector2(-half, inner - u * edgeLen);
  }
  d -= arcLen;

  const u = d / arcLen;
  const angle = Math.PI + u * (Math.PI / 2);
  return new THREE.Vector2(
    -inner + cornerRadius * Math.cos(angle),
    -inner + cornerRadius * Math.sin(angle),
  );
}

function buildRoundedSquareProfile(
  half: number,
  cornerRadius: number,
  segments: number,
): THREE.Vector2[] {
  const inner = half - cornerRadius;
  const edgeLen = 2 * inner;
  const arcLen = (Math.PI / 2) * cornerRadius;
  const perimeter = 4 * edgeLen + 4 * arcLen;
  const profile: THREE.Vector2[] = [];

  for (let i = 0; i < segments; i++) {
    const dist = (i / segments) * perimeter;
    profile.push(pointOnRoundedSquarePerimeter(dist, half, cornerRadius));
  }

  return profile;
}

let turfCapGeometry: THREE.BufferGeometry | null = null;

export function getTurfCapGeometry(): THREE.BufferGeometry {
  if (!turfCapGeometry) {
    turfCapGeometry = buildTurfCapGeometry();
  }
  return turfCapGeometry;
}

function pushColor(colors: number[], color: THREE.Color): void {
  colors.push(color.r, color.g, color.b);
}

function isGrassPlacementAllowed(x: number, z: number): boolean {
  if (!isInsideTurf(x, z)) return false;
  const r = Math.hypot(x, z);
  if (r <= 0.302) return false;
  if (r >= 0.2 && r <= 0.28) return false;
  return true;
}

type BladeVertex = [number, number, number];

/** Slightly inset from placement rules so widened blades clear r<=0.302 after float error. */
function isGrassBladeVertexAllowed(x: number, z: number): boolean {
  if (!isGrassPlacementAllowed(x, z)) return false;
  return Math.hypot(x, z) > 0.302 + 1e-5;
}

function fitBladeHorizontal(
  verts: BladeVertex[],
  anchorX: number,
  anchorZ: number,
): BladeVertex[] {
  let scale = 1;
  for (const [vx, , vz] of verts) {
    if (isGrassBladeVertexAllowed(vx, vz)) continue;
    const dx = vx - anchorX;
    const dz = vz - anchorZ;
    if (Math.abs(dx) < 1e-9 && Math.abs(dz) < 1e-9) continue;

    let lo = 0;
    let hi = 1;
    for (let iter = 0; iter < 24; iter++) {
      const mid = (lo + hi) / 2;
      const tx = anchorX + dx * mid;
      const tz = anchorZ + dz * mid;
      if (isGrassBladeVertexAllowed(tx, tz)) lo = mid;
      else hi = mid;
    }
    scale = Math.min(scale, lo);
  }

  if (scale >= 1 - 1e-9) {
    if (verts.every(([vx, , vz]) => isGrassBladeVertexAllowed(vx, vz))) return verts;
    scale = 1 - 1e-4;
  }
  return verts.map(([vx, vy, vz]) => [
    anchorX + (vx - anchorX) * scale,
    vy,
    anchorZ + (vz - anchorZ) * scale,
  ]);
}

type GrassDensityBias = {
  phaseX: number;
  phaseZ: number;
  patchScale: number;
  quietCenterX: number;
  quietCenterZ: number;
  quietCenter2X: number | null;
  quietCenter2Z: number | null;
};

function buildGrassDensityBias(seed: number): GrassDensityBias {
  const biasRand = seededRandom((seed ^ 0x9e3779b9) >>> 0);
  const quietCenterX = (biasRand() * 2 - 1) * TURF_HALF * 0.55;
  const quietCenterZ = (biasRand() * 2 - 1) * TURF_HALF * 0.55;
  const hasSecondQuiet = biasRand() > 0.4;
  return {
    phaseX: biasRand() * Math.PI * 2,
    phaseZ: biasRand() * Math.PI * 2,
    patchScale: 4.5 + biasRand() * 2.5,
    quietCenterX,
    quietCenterZ,
    quietCenter2X: hasSecondQuiet ? (biasRand() * 2 - 1) * TURF_HALF * 0.5 : null,
    quietCenter2Z: hasSecondQuiet ? (biasRand() * 2 - 1) * TURF_HALF * 0.5 : null,
  };
}

function grassPlacementDensity(bias: GrassDensityBias, x: number, z: number): number {
  const patch =
    0.5 +
    0.5 *
      Math.sin(x * bias.patchScale + bias.phaseX) *
      Math.sin(z * bias.patchScale * 0.9 + bias.phaseZ);
  const q1r = Math.hypot(x - bias.quietCenterX, z - bias.quietCenterZ);
  const quiet1 = smoothstep(0.08, 0.32, q1r);
  let density = 0.35 + 0.65 * patch * quiet1;
  if (bias.quietCenter2X !== null && bias.quietCenter2Z !== null) {
    const q2r = Math.hypot(x - bias.quietCenter2X, z - bias.quietCenter2Z);
    const quiet2 = smoothstep(0.08, 0.28, q2r);
    density *= 0.3 + 0.7 * quiet2;
  }
  return Math.min(1, Math.max(0.05, density));
}

function sampleGrassPosition(
  rand: () => number,
  densityBias: GrassDensityBias,
): [number, number] | null {
  const extent = TURF_HALF * 0.92;
  for (let attempt = 0; attempt < 48; attempt++) {
    const x = (rand() * 2 - 1) * extent;
    const z = (rand() * 2 - 1) * extent;
    if (!isGrassPlacementAllowed(x, z)) continue;
    if (rand() > grassPlacementDensity(densityBias, x, z)) continue;
    return [x, z];
  }
  return null;
}

function buildGrassTuftsGeometry(seed: number): THREE.BufferGeometry {
  const rand = seededRandom(seed);
  const densityBias = buildGrassDensityBias(seed);
  const clusterCount = 18 + Math.floor(rand() * 11);
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  let vertex = 0;

  for (let c = 0; c < clusterCount; c++) {
    if (rand() < 0.14) continue;

    const placement = sampleGrassPosition(rand, densityBias);
    if (!placement) continue;
    const [cx, cz] = placement;

    const clusterSeed = (seed + c * 7919 + 104729) >>> 0;
    const clusterRand = seededRandom(clusterSeed);
    const bladesInCluster = 3 + Math.floor(clusterRand() * 4);
    const clusterSpread = 0.008 + clusterRand() * 0.014;
    const clusterLeanBias = 0.2 + clusterRand() * 0.22;
    const clusterHeightBias = 0.025 + clusterRand() * 0.012;

    for (let b = 0; b < bladesInCluster; b++) {
      const ox = (clusterRand() * 2 - 1) * clusterSpread;
      const oz = (clusterRand() * 2 - 1) * clusterSpread;
      const x = cx + ox;
      const z = cz + oz;
      if (!isGrassPlacementAllowed(x, z)) continue;

      const yBase = turfSurfaceY(x, z);
      const origHeight = clusterHeightBias + clusterRand() * (0.055 - clusterHeightBias);
      const yaw = clusterRand() * Math.PI * 2;
      const leanFactor = clusterLeanBias + clusterRand() * 0.1;
      const origHalfW = 0.0045 + clusterRand() * 0.0035;
      const curve = 0.28 + clusterRand() * 0.34;
      const origLean = origHeight * leanFactor;

      const perpX = Math.cos(yaw);
      const perpZ = -Math.sin(yaw);
      const origLeanX = Math.sin(yaw) * origLean;
      const origLeanZ = Math.cos(yaw) * origLean;

      const midT = 0.55;
      const origMidY = yBase + origHeight * midT;
      const origMidX = x + origLeanX * midT * curve;
      const origMidZ = z + origLeanZ * midT * curve;
      const origTipX = x + origLeanX;
      const origTipY = yBase + origHeight;
      const origTipZ = z + origLeanZ;

      const origBladeVerts: BladeVertex[] = [
        [x - perpX * origHalfW, yBase, z - perpZ * origHalfW],
        [x + perpX * origHalfW, yBase, z + perpZ * origHalfW],
        [origMidX - perpX * origHalfW * 0.45, origMidY, origMidZ - perpZ * origHalfW * 0.45],
        [origMidX + perpX * origHalfW * 0.45, origMidY, origMidZ + perpZ * origHalfW * 0.45],
        [origTipX, origTipY, origTipZ],
      ];
      if (!origBladeVerts.every(([vx, , vz]) => isGrassPlacementAllowed(vx, vz))) continue;

      const widthT = (origHalfW - 0.0045) / 0.0035;
      const halfW = 0.01 + widthT * 0.006;
      const heightSpan = 0.055 - clusterHeightBias;
      const heightT = heightSpan > 1e-9 ? (origHeight - clusterHeightBias) / heightSpan : 0;
      const height = 0.045 + heightT * 0.03;
      const lean = height * leanFactor;
      const leanX = Math.sin(yaw) * lean;
      const leanZ = Math.cos(yaw) * lean;
      const midY = yBase + height * midT;
      const midX = x + leanX * midT * curve;
      const midZ = z + leanZ * midT * curve;
      const tipX = x + leanX;
      const tipY = yBase + height;
      const tipZ = z + leanZ;

      const bladeVerts = fitBladeHorizontal(
        [
          [x - perpX * halfW, yBase, z - perpZ * halfW],
          [x + perpX * halfW, yBase, z + perpZ * halfW],
          [midX - perpX * halfW * 0.45, midY, midZ - perpZ * halfW * 0.45],
          [midX + perpX * halfW * 0.45, midY, midZ + perpZ * halfW * 0.45],
          [tipX, tipY, tipZ],
        ],
        x,
        z,
      );

      const baseColor = grassColor(clusterRand);
      const tipColor = baseColor.clone().multiplyScalar(1.02 + clusterRand() * 0.04);

      const verts = bladeVerts;
      for (const v of verts) {
        positions.push(v[0], v[1], v[2]);
      }
      pushColor(colors, baseColor);
      pushColor(colors, baseColor);
      pushColor(colors, baseColor.clone().lerp(tipColor, 0.32));
      pushColor(colors, baseColor.clone().lerp(tipColor, 0.32));
      pushColor(colors, tipColor);

      indices.push(vertex, vertex + 1, vertex + 4);
      indices.push(vertex, vertex + 4, vertex + 2);
      indices.push(vertex + 1, vertex + 3, vertex + 4);
      indices.push(vertex + 2, vertex + 4, vertex + 3);
      vertex += 5;
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

export function getGrassTuftsGeometry(tileX: number, tileZ: number): THREE.BufferGeometry {
  const tileSeed = ((tileX * 73856093) ^ (tileZ * 19349663)) >>> 0;
  const key = ((tileSeed ^ (tileSeed >>> 16)) >>> 0) % GRASS_GEOMETRY_VARIANTS;
  const cached = grassGeometryCache.get(key);
  if (cached) return cached;
  const geometry = buildGrassTuftsGeometry(Math.imul(key, 2654435761) >>> 0);
  grassGeometryCache.set(key, geometry);
  return geometry;
}
