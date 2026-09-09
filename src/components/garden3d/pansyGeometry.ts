import * as THREE from 'three';
import { tulipVertexColor } from './proceduralMaterials';

export const PANSY_HEIGHT = 0.55;
export const PANSY_BLOSSOM_WIDTH = 0.45;
export const PANSY_FLOWER_CENTER_Y = 0.3;

type PansyPetalRole = 'upper-left' | 'upper-right' | 'side-left' | 'side-right' | 'lower';

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

interface PetalSpec {
  role: PansyPetalRole;
  angleZ: number;
  baseHex: string;
  tipHex: string;
  veinHex: string;
  widthScale: number;
  lengthScale: number;
  zCurl: number;
}

const PETAL_SPECS: PetalSpec[] = [
  {
    role: 'upper-left',
    angleZ: 0.6,
    baseHex: '#9b6ec8',
    tipHex: '#c4a8e0',
    veinHex: '#5a3878',
    widthScale: 1.02,
    lengthScale: 0.72,
    zCurl: 0.024,
  },
  {
    role: 'upper-right',
    angleZ: -0.6,
    baseHex: '#9b6ec8',
    tipHex: '#c4a8e0',
    veinHex: '#5a3878',
    widthScale: 1.0,
    lengthScale: 0.7,
    zCurl: 0.024,
  },
  {
    role: 'side-left',
    angleZ: 1.65,
    baseHex: '#f5eed8',
    tipHex: '#fff8f0',
    veinHex: '#c8b8a0',
    widthScale: 0.96,
    lengthScale: 0.68,
    zCurl: 0.02,
  },
  {
    role: 'side-right',
    angleZ: -1.65,
    baseHex: '#f5eed8',
    tipHex: '#fff8f0',
    veinHex: '#c8b8a0',
    widthScale: 0.94,
    lengthScale: 0.66,
    zCurl: 0.02,
  },
  {
    role: 'lower',
    angleZ: Math.PI,
    baseHex: '#b888d0',
    tipHex: '#dcc8f0',
    veinHex: '#3a2050',
    widthScale: 1.08,
    lengthScale: 0.78,
    zCurl: 0.03,
  },
];

function petalZLayer(role: PansyPetalRole): number {
  if (role.startsWith('upper')) return 0.004;
  if (role.startsWith('side')) return 0.008;
  return 0.012;
}

function buildPansyPetalGeometry(spec: PetalSpec): THREE.BufferGeometry {
  const widthSegments = 14;
  const lengthSegments = 18;
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const baseColor = tulipVertexColor(spec.baseHex);
  const tipColor = tulipVertexColor(spec.tipHex);
  const veinColor = tulipVertexColor(spec.veinHex);
  const throatColor = tulipVertexColor('#f0c838');
  const blotchColor = tulipVertexColor('#4a2868');

  const baseLength = 0.11 * spec.lengthScale;
  const baseWidth = 0.14 * spec.widthScale;
  const zLayer = petalZLayer(spec.role);

  for (let j = 0; j <= lengthSegments; j++) {
    const t = j / lengthSegments;
    const lobeAlong = Math.sqrt(Math.max(0, 1 - (2 * t - 1) ** 2));
    const attachNarrow = smoothstep(0, 0.14, t) * (1 - smoothstep(0.88, 1, t) * 0.12);
    const halfWidth =
      baseWidth *
      lobeAlong *
      attachNarrow *
      (spec.role === 'lower' ? 1 + Math.sin(t * Math.PI) * 0.08 : 1);
    const alongY = t * baseLength;
    const curl = Math.pow(Math.sin(t * Math.PI * 0.9), 1.6) * spec.zCurl;

    for (let i = 0; i <= widthSegments; i++) {
      const s = (i / widthSegments) * 2 - 1;
      const edgeRound = Math.sqrt(Math.max(0, 1 - s * s));
      const ridge = (1 - s * s) * 0.004;
      const x = s * halfWidth;
      const y = alongY + ridge;
      const z = curl * edgeRound + zLayer;

      positions.push(x, y, z);

      const veinMix =
        Math.exp(-s * s * 2.6) *
        (spec.role === 'lower' ? smoothstep(0.15, 0.82, t) * 0.75 : smoothstep(0.25, 0.88, t) * 0.38);
      const throatMix =
        Math.exp(-((t - 0.06) ** 2) / 0.008 - s * s * 2.4) *
        (spec.role === 'lower' || spec.role.startsWith('side') ? 0.78 : 0.42);
      const blotchMix =
        t < 0.58
          ? Math.exp(-((t - 0.2) ** 2) / 0.032 - s * s * 1.35) *
            (spec.role === 'lower' ? 0.9 : spec.role.startsWith('side') ? 0.68 : 0.18)
          : 0;
      let color = baseColor.clone().lerp(tipColor, smoothstep(0.38, 1, t));
      color = color.lerp(veinColor, veinMix).lerp(throatColor, throatMix).lerp(blotchColor, blotchMix);
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

function buildPansyStemGeometry(): THREE.BufferGeometry {
  const curve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0.06, 0),
    new THREE.Vector3(0.004, 0.14, 0.008),
    new THREE.Vector3(-0.003, 0.22, 0.004),
    new THREE.Vector3(0, PANSY_FLOWER_CENTER_Y - 0.02, 0.01),
  ]);
  return new THREE.TubeGeometry(curve, 16, 0.006, 5, false);
}

function buildPansyCalyxGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];
  const segs = 5;
  const color = tulipVertexColor('#4a6840');

  for (let j = 0; j <= 3; j++) {
    const t = j / 3;
    const radius = 0.05 * (1 - t * 0.35);
    const y = -0.02 - t * 0.03;
    const z = -0.02 - t * 0.04;

    for (let i = 0; i <= segs; i++) {
      const theta = (i / segs) * Math.PI * 2;
      positions.push(Math.cos(theta) * radius, y, z + Math.sin(theta) * radius * 0.5);
      colors.push(color.r, color.g, color.b);
    }
  }

  const row = segs + 1;
  for (let j = 0; j < 3; j++) {
    for (let i = 0; i < segs; i++) {
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

function buildPansyFoliageGeometry(): THREE.BufferGeometry {
  const positions: number[] = [];
  const colors: number[] = [];
  const indices: number[] = [];

  const leafColor = tulipVertexColor('#4a6840');
  const highlight = tulipVertexColor('#6a8450');

  const leaves = [
    { cx: -0.12, cz: 0.06, rx: 0.14, ry: 0.08, rot: 0.3 },
    { cx: 0.1, cz: 0.08, rx: 0.13, ry: 0.07, rot: -0.4 },
    { cx: -0.04, cz: -0.1, rx: 0.15, ry: 0.09, rot: 0.1 },
    { cx: 0.14, cz: -0.06, rx: 0.12, ry: 0.08, rot: -0.2 },
  ];

  let vertexOffset = 0;
  for (const leaf of leaves) {
    const segs = 12;
    for (let j = 0; j <= segs; j++) {
      const t = j / segs;
      const half = (0.06 + t * 0.04) * (1 - smoothstep(0.75, 1, t));
      const y = 0.02 + t * 0.05;
      const cx = leaf.cx + Math.cos(leaf.rot) * t * leaf.rx;
      const cz = leaf.cz + Math.sin(leaf.rot) * t * leaf.ry;

      for (let i = 0; i <= 6; i++) {
        const s = (i / 6) * 2 - 1;
        const x = cx + s * half;
        const z = cz + s * half * 0.5;
        positions.push(x, y, z);
        const color = leafColor.clone().lerp(highlight, (1 - Math.abs(s)) * 0.2);
        colors.push(color.r, color.g, color.b);
      }
    }

    const row = 7;
    for (let j = 0; j < segs; j++) {
      for (let i = 0; i < 6; i++) {
        const a = vertexOffset + j * row + i;
        const b = a + 1;
        const c = a + row;
        const d = c + 1;
        indices.push(a, c, b, b, c, d);
      }
    }
    vertexOffset += (segs + 1) * row;
  }

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}

const petalCache = new Map<PansyPetalRole, THREE.BufferGeometry>();
let foliageGeometry: THREE.BufferGeometry | null = null;
let stemGeometry: THREE.BufferGeometry | null = null;
let calyxGeometry: THREE.BufferGeometry | null = null;

export function getPansyPetalSpecs(): PetalSpec[] {
  return PETAL_SPECS;
}

export function getPansyPetalGeometry(role: PansyPetalRole): THREE.BufferGeometry {
  const cached = petalCache.get(role);
  if (cached) return cached;
  const spec = PETAL_SPECS.find((s) => s.role === role)!;
  const geometry = buildPansyPetalGeometry(spec);
  petalCache.set(role, geometry);
  return geometry;
}

export function getPansyFoliageGeometry(): THREE.BufferGeometry {
  if (!foliageGeometry) foliageGeometry = buildPansyFoliageGeometry();
  return foliageGeometry;
}

export function getPansyStemGeometry(): THREE.BufferGeometry {
  if (!stemGeometry) stemGeometry = buildPansyStemGeometry();
  return stemGeometry;
}

export function getPansyCalyxGeometry(): THREE.BufferGeometry {
  if (!calyxGeometry) calyxGeometry = buildPansyCalyxGeometry();
  return calyxGeometry;
}
