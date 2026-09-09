import * as THREE from 'three';
import { adjustTulipShade, tulipVertexColor } from './proceduralMaterials';

const PETAL_WIDTH_SEGMENTS = 14;
const PETAL_HEIGHT_SEGMENTS = 24;
const BLOSSOM_BASE_Y = 0.85;
const PETAL_HEIGHT = 0.62;
const BLOSSOM_RADIAL_SCALE = 0.85;
const OUTER_PETAL_COUNT = 3;
const INNER_PETAL_COUNT = 3;

export const TULIP_HEIGHT = 1.4;
export const TULIP_BLOSSOM_WIDTH = 0.62 * BLOSSOM_RADIAL_SCALE;

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

function petalRadiusAt(v: number, layerScale: number, petalIndex: number): number {
  const t = 1 - v;
  const bowl = (0.008 + 0.24 * Math.sqrt(Math.max(0, 1 - t * t))) * BLOSSOM_RADIAL_SCALE;
  const tipPinch = 0.025 * smoothstep(0.75, 1, v);
  const asym = 1 + (petalIndex - 1) * 0.012;
  return (bowl - tipPinch) * layerScale * asym;
}

function petalHalfAngleAt(v: number): number {
  const minAngle = 0.8;
  const curve = Math.sin((Math.PI * v) / 2) * 1.1;
  if (v < 0.08) {
    return minAngle;
  }
  return Math.max(minAngle, curve);
}

function buildPetalGeometry(
  layer: 'outer' | 'inner',
  petalIndex: number,
  baseHex: string,
): THREE.BufferGeometry {
  const widthSegments = PETAL_WIDTH_SEGMENTS;
  const heightSegments = PETAL_HEIGHT_SEGMENTS;
  const layerScale = layer === 'outer' ? 1 : 0.9;
  const heightBias = layer === 'outer' ? petalIndex * 0.008 : 0.02 + petalIndex * 0.006;
  const radialBias = layer === 'outer' ? 1 + petalIndex * 0.01 : 0.96 + petalIndex * 0.008;

  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const baseColor = tulipVertexColor(baseHex);
  const rimColor = tulipVertexColor(adjustTulipShade(baseHex, 0.22, -0.04));
  const footColor = tulipVertexColor(adjustTulipShade(baseHex, -0.28, 0.1));
  const innerShade = tulipVertexColor(adjustTulipShade(baseHex, -0.18, 0.06));
  const midWarm = tulipVertexColor(adjustTulipShade(baseHex, -0.06, 0.04));
  const warmUpperColor = tulipVertexColor(adjustTulipShade(baseHex, 0.16, 0.08));

  for (let j = 0; j <= heightSegments; j++) {
    const v = j / heightSegments;
    const radius = petalRadiusAt(v, layerScale * radialBias, petalIndex);
    const halfAngle = petalHalfAngleAt(v);
    const tipRound = 0.1 * v * v * (1 + Math.abs(Math.sin(petalIndex * 1.7)) * 0.15);

    for (let i = 0; i <= widthSegments; i++) {
      const u = (i / widthSegments) * 2 - 1;
      const theta = u * halfAngle;
      const cupPull = 0.025 * (1 - Math.cos(theta)) * v * layerScale;
      const x = radius * Math.sin(theta);
      const z = radius * Math.cos(theta) - cupPull;
      const lobeDip = 0.012 * Math.pow(Math.abs(u), 2.2) * smoothstep(0.62, 1, v);
      const y = BLOSSOM_BASE_Y + v * PETAL_HEIGHT - tipRound * u * u - lobeDip + heightBias;

      positions.push(x, y, z);

      const heightMix = v;
      const edgeMix = Math.pow(Math.abs(u), 1.4);
      const longitudinalVein =
        Math.sin(u * Math.PI * 5 + petalIndex * 0.6) * 0.006 +
        Math.exp(-u * u * 3.5) * 0.004;
      let color = baseColor
        .clone()
        .lerp(footColor, (1 - heightMix) * 0.55)
        .lerp(midWarm, heightMix * 0.35)
        .lerp(rimColor, heightMix * edgeMix * 0.55)
        .lerp(warmUpperColor, smoothstep(0.4, 1, v) * 0.2);
      color.offsetHSL(0, 0, Math.max(-0.02, Math.min(0.02, longitudinalVein)));
      if (layer === 'inner') {
        color.lerp(innerShade, 0.22 + v * 0.18);
      }
      colors.push(color.r, color.g, color.b);
    }
  }

  const row = widthSegments + 1;
  for (let j = 0; j < heightSegments; j++) {
    for (let i = 0; i < widthSegments; i++) {
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

const petalGeometryCache = new Map<string, THREE.BufferGeometry>();

export function getTulipPetalGeometry(
  layer: 'outer' | 'inner',
  petalIndex: number,
  baseHex: string,
): THREE.BufferGeometry {
  const key = `${layer}-${petalIndex}-${baseHex}`;
  const cached = petalGeometryCache.get(key);
  if (cached) return cached;
  const geometry = buildPetalGeometry(layer, petalIndex, baseHex);
  petalGeometryCache.set(key, geometry);
  return geometry;
}

export function getTulipPetalRotations(): { layer: 'outer' | 'inner'; index: number; rotation: number }[] {
  const rotations: { layer: 'outer' | 'inner'; index: number; rotation: number }[] = [];
  for (let i = 0; i < OUTER_PETAL_COUNT; i++) {
    rotations.push({ layer: 'outer', index: i, rotation: (i / OUTER_PETAL_COUNT) * Math.PI * 2 });
  }
  for (let i = 0; i < INNER_PETAL_COUNT; i++) {
    rotations.push({
      layer: 'inner',
      index: i,
      rotation: (i / INNER_PETAL_COUNT) * Math.PI * 2 + Math.PI / OUTER_PETAL_COUNT,
    });
  }
  return rotations;
}

function leafHalfWidthAt(t: number): number {
  const peak = 0.42;
  const maxHalf = 0.15;
  const swell = smoothstep(0, peak, t);
  const taper = 1 - smoothstep(peak, 1, t);
  const envelope = swell * taper;
  const tipNarrow = 1 - smoothstep(0.78, 1, t) * 0.28;
  return maxHalf * envelope * tipNarrow + 0.005 * (1 - envelope);
}

function buildLeafGeometry(side: 'left' | 'right'): THREE.BufferGeometry {
  const lengthSegments = 28;
  const widthSegments = 14;
  const sideSign = side === 'left' ? -1 : 1;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const frontColor = tulipVertexColor('#6f854e');
  const backColor = tulipVertexColor('#566c40');
  const veinColor = tulipVertexColor('#a0aa70');

  for (let j = 0; j <= lengthSegments; j++) {
    const t = j / lengthSegments;
    const halfWidth = leafHalfWidthAt(t);
    const sweep = t * t * 0.22;
    const centerX = sideSign * (0.05 + t * 0.38 + sweep * 0.12);
    const centerY = t * 0.9 + Math.sin(t * Math.PI * 0.7) * 0.06;
    const centerZ = Math.sin(t * Math.PI) * 0.1 * sideSign;
    const curl = Math.pow(t, 1.6) * 0.18;
    const tipBend = smoothstep(0.72, 1, t) * 0.08;

    for (let i = 0; i <= widthSegments; i++) {
      const s = (i / widthSegments) * 2 - 1;
      const edgeRound = Math.sqrt(Math.max(0, 1 - s * s));
      const ridge = (1 - s * s) * (0.024 + t * 0.012);
      const x = centerX + sideSign * s * halfWidth;
      const y = centerY + ridge + curl * edgeRound - tipBend * Math.abs(s);
      const z = centerZ + s * halfWidth * 0.5 * edgeRound;

      positions.push(x, y, z);

      const veinMix = Math.exp(-s * s * 4.2) * (1 - t * 0.25);
      const faceMix = s > 0 ? 0.16 : 0;
      const color = frontColor.clone().lerp(backColor, faceMix).lerp(veinColor, veinMix * 0.28);
      colors.push(color.r, color.g, color.b);
    }
  }

  const row = widthSegments + 1;
  for (let j = 0; j < lengthSegments; j++) {
    for (let i = 0; i < widthSegments; i++) {
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

const leafGeometryCache = new Map<'left' | 'right', THREE.BufferGeometry>();

export function getTulipLeafGeometry(side: 'left' | 'right'): THREE.BufferGeometry {
  const cached = leafGeometryCache.get(side);
  if (cached) return cached;
  const geometry = buildLeafGeometry(side);
  leafGeometryCache.set(side, geometry);
  return geometry;
}

let stemGeometry: THREE.BufferGeometry | null = null;

export function getTulipStemGeometry(): THREE.BufferGeometry {
  if (stemGeometry) return stemGeometry;

  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0),
    new THREE.Vector3(0.016, 0.26, 0.01),
    new THREE.Vector3(-0.01, 0.52, -0.006),
    new THREE.Vector3(0.008, 0.68, 0.003),
    new THREE.Vector3(0, BLOSSOM_BASE_Y, 0),
  ]);

  stemGeometry = new THREE.TubeGeometry(curve, 32, 0.011, 8, false);
  return stemGeometry;
}
