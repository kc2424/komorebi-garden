import * as THREE from 'three';
import { adjustTulipShade, tulipVertexColor } from './proceduralMaterials';

const PETAL_COUNT = 8;
const PETAL_WIDTH_SEGMENTS = 12;
const PETAL_LENGTH_SEGMENTS = 18;
export const COSMOS_BLOSSOM_CENTER_Y = 1.1;
const BLOSSOM_CENTER_Y = COSMOS_BLOSSOM_CENTER_Y;
const PETAL_ATTACH_RADIUS = 0.055;
const PETAL_LENGTH = 0.34;
const PETAL_BASE_WIDTH = 0.12;
const BLOSSOM_RADIUS = 0.36;

/** Stem base to petal tip — matches shallow bowl blossom at centerY 1.1. */
export const COSMOS_HEIGHT = 1.2;
export const COSMOS_BLOSSOM_WIDTH = 0.76;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function petalHalfWidthAt(t: number, petalIndex: number): number {
  const asym = 1 + Math.sin(petalIndex * 1.25) * 0.07;
  const swell = smoothstep(0, 0.2, t) * (1 - smoothstep(0.78, 1, t) * 0.42);
  const notch = 1 - smoothstep(0.82, 1, t) * 0.38;
  return PETAL_BASE_WIDTH * swell * notch * asym;
}

function buildCosmosPetalGeometry(petalIndex: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const baseHex = '#f2a8c4';
  const tipHex = '#f8d0dc';
  const baseColor = tulipVertexColor(baseHex);
  const tipColor = tulipVertexColor(tipHex);
  const veinColor = tulipVertexColor(adjustTulipShade(baseHex, -0.08, 0.02));

  for (let j = 0; j <= PETAL_LENGTH_SEGMENTS; j++) {
    const t = j / PETAL_LENGTH_SEGMENTS;
    const halfWidth = petalHalfWidthAt(t, petalIndex);
    const radial = PETAL_ATTACH_RADIUS + t * PETAL_LENGTH;
    const bowl = Math.sin(t * Math.PI) * 0.035;
    const overlapLift = (1 - t) * 0.018;
    const centerY = BLOSSOM_CENTER_Y + bowl + overlapLift;
    const centerZ = radial;

    for (let i = 0; i <= PETAL_WIDTH_SEGMENTS; i++) {
      const s = (i / PETAL_WIDTH_SEGMENTS) * 2 - 1;
      const edgeRound = Math.sqrt(Math.max(0, 1 - s * s));
      const ridge = (1 - s * s) * 0.007 * (1 - t * 0.35);
      const x = s * halfWidth;
      const y = centerY + ridge;
      const z = centerZ + s * halfWidth * 0.18 * edgeRound;

      positions.push(x, y, z);

      const veinMix = Math.exp(-s * s * 3.2) * (1 - t * 0.35);
      const color = baseColor.clone().lerp(tipColor, smoothstep(0.3, 1, t)).lerp(veinColor, veinMix * 0.22);
      colors.push(color.r, color.g, color.b);
    }
  }

  const row = PETAL_WIDTH_SEGMENTS + 1;
  for (let j = 0; j < PETAL_LENGTH_SEGMENTS; j++) {
    for (let i = 0; i < PETAL_WIDTH_SEGMENTS; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildCosmosCenterGeometry(): THREE.BufferGeometry {
  const latSegments = 14;
  const lonSegments = 24;
  const radius = 0.085;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const innerColor = tulipVertexColor('#f8d848');
  const outerColor = tulipVertexColor('#e8a830');
  const grainColor = tulipVertexColor('#d89820');

  for (let j = 0; j <= latSegments; j++) {
    const v = j / latSegments;
    const phi = v * (Math.PI / 2);
    const yLocal = Math.sin(phi) * radius;
    const ringRadius = Math.cos(phi) * radius;

    for (let i = 0; i <= lonSegments; i++) {
      const u = i / lonSegments;
      const theta = u * Math.PI * 2;
      const x = Math.cos(theta) * ringRadius;
      const z = Math.sin(theta) * ringRadius;
      const y = BLOSSOM_CENTER_Y - radius + yLocal;
      positions.push(x, y, z);

      const grain = Math.sin(theta * 9 + phi * 6) * 0.5 + 0.5;
      const color = innerColor.clone().lerp(outerColor, v * 0.45).lerp(grainColor, grain * 0.18 * (1 - v));
      colors.push(color.r, color.g, color.b);
    }
  }

  const row = lonSegments + 1;
  for (let j = 0; j < latSegments; j++) {
    for (let i = 0; i < lonSegments; i++) {
      const a = j * row + i;
      const b = a + 1;
      const c = a + row;
      const d = c + 1;
      indices.push(a, c, b, b, c, d);
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

function buildCosmosLeafPairGeometry(sideSign: number, stemAttachY: number, stemAttachX: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const leafColor = tulipVertexColor('#5a7848');
  const veinColor = tulipVertexColor('#7a9458');
  const pinnae = 5;
  const rachisLength = 0.34;

  for (let p = 0; p <= pinnae; p++) {
    const pt = p / pinnae;
    const rachisX = stemAttachX + sideSign * pt * rachisLength * 0.55;
    const rachisY = stemAttachY + pt * rachisLength * 0.18;
    const rachisZ = sideSign * pt * 0.04;

    const segments = 10;
    for (let j = 0; j <= segments; j++) {
      const t = j / segments;
      const half = 0.016 * (1 - smoothstep(0.65, 1, t)) * (1 - pt * 0.15);
      const leafletAngle = sideSign * (0.35 + pt * 0.55);
      const alongX = Math.cos(leafletAngle) * t * 0.11;
      const alongY = t * 0.045;
      const alongZ = Math.sin(leafletAngle) * t * 0.05;

      for (let i = 0; i <= 4; i++) {
        const s = (i / 4) * 2 - 1;
        const x = rachisX + alongX + s * half;
        const y = rachisY + alongY;
        const z = rachisZ + alongZ + s * half * 0.35;
        positions.push(x, y, z);
        const veinMix = Math.exp(-s * s * 2.2) * (1 - t * 0.35);
        const color = leafColor.clone().lerp(veinColor, veinMix * 0.28);
        colors.push(color.r, color.g, color.b);
      }
    }
  }

  const row = 5;
  const rowsPerPinna = 11;
  for (let p = 0; p < pinnae; p++) {
    const base = p * rowsPerPinna * row;
    for (let j = 0; j < 10; j++) {
      for (let i = 0; i < 4; i++) {
        const a = base + j * row + i;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        if (d < positions.length / 3) {
          indices.push(a, c, b, b, c, d);
        }
      }
    }
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  if (indices.length > 0) geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const petalCache = new Map<number, THREE.BufferGeometry>();
let centerGeometry: THREE.BufferGeometry | null = null;
let stemGeometry: THREE.BufferGeometry | null = null;
const leafCache = new Map<string, THREE.BufferGeometry>();

export function getCosmosPetalGeometry(petalIndex: number): THREE.BufferGeometry {
  const cached = petalCache.get(petalIndex);
  if (cached) return cached;
  const geometry = buildCosmosPetalGeometry(petalIndex);
  petalCache.set(petalIndex, geometry);
  return geometry;
}

export function getCosmosPetalRotations(): number[] {
  return Array.from({ length: PETAL_COUNT }, (_, i) => (i / PETAL_COUNT) * Math.PI * 2);
}

export function getCosmosCenterGeometry(): THREE.BufferGeometry {
  if (!centerGeometry) centerGeometry = buildCosmosCenterGeometry();
  return centerGeometry;
}

export function getCosmosStemGeometry(): THREE.BufferGeometry {
  if (!stemGeometry) {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, 0, 0),
      new THREE.Vector3(0.01, 0.32, 0.006),
      new THREE.Vector3(-0.006, 0.62, -0.003),
      new THREE.Vector3(0.004, 0.88, 0.002),
      new THREE.Vector3(0, BLOSSOM_CENTER_Y - 0.06, 0),
    ]);
    stemGeometry = new THREE.TubeGeometry(curve, 28, 0.007, 6, false);
  }
  return stemGeometry;
}

export interface CosmosLeafPlacement {
  side: 'left' | 'right';
  index: number;
  attachY: number;
  attachX: number;
}

export function getCosmosLeafPlacements(): CosmosLeafPlacement[] {
  return [
    { side: 'left', index: 0, attachY: 0.22, attachX: -0.004 },
    { side: 'right', index: 1, attachY: 0.48, attachX: 0.004 },
  ];
}

export function getCosmosLeafGeometry(
  side: 'left' | 'right',
  index: number,
  attachY: number,
  attachX: number,
): THREE.BufferGeometry {
  const key = `${side}-${index}-${attachY.toFixed(2)}`;
  const cached = leafCache.get(key);
  if (cached) return cached;
  const sideSign = side === 'left' ? -1 : 1;
  const geometry = buildCosmosLeafPairGeometry(sideSign, attachY, attachX);
  leafCache.set(key, geometry);
  return geometry;
}

export function getCosmosBlossomRadius(): number {
  return BLOSSOM_RADIUS;
}
