import * as THREE from 'three';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { GardenDecorationType } from '../../types';

export const DECORATION_PALETTE = {
  wood: '#b88c61',
  woodDark: '#916a4b',
  woodLight: '#d1ad7b',
  metal: '#596750',
  stone: '#acae9d',
  stoneLight: '#c8c3ab',
  moss: '#829465',
  water: '#8fbbb6',
  waterLight: '#b9d7c9',
  glow: '#efd18a',
  terracotta: '#bd8261',
  terracottaLight: '#dba079',
  soil: '#68503d',
  sage: '#91a58a',
  sageLight: '#b8c6a4',
  leaf: '#778f52',
  leafLight: '#9bab6b',
  petal: '#dfa78e',
  cream: '#e6d8b9',
} as const;

export type DecorationMaterial = keyof typeof DECORATION_PALETTE;
export interface DecorationGeometryPart {
  material: DecorationMaterial;
  geometry: THREE.BufferGeometry;
}

type Vec3 = [number, number, number];
const geometryCache = new Map<GardenDecorationType, readonly DecorationGeometryPart[]>();

// Each primitive is transformed into an item-local shape, then merged per material.
// A placed decoration therefore uses a handful of draw calls rather than one per detail.
class DecorationBuilder {
  private parts = new Map<DecorationMaterial, THREE.BufferGeometry[]>();

  add(
    material: DecorationMaterial,
    geometry: THREE.BufferGeometry,
    position: Vec3,
    scale: Vec3 = [1, 1, 1],
    rotation: Vec3 = [0, 0, 0],
  ) {
    const matrix = new THREE.Matrix4().compose(
      new THREE.Vector3(...position),
      new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
      new THREE.Vector3(...scale),
    );
    const part = geometry.index ? geometry.toNonIndexed() : geometry;
    if (part !== geometry) geometry.dispose();
    part.applyMatrix4(matrix);
    const bucket = this.parts.get(material) ?? [];
    bucket.push(part);
    this.parts.set(material, bucket);
  }

  box(material: DecorationMaterial, position: Vec3, scale: Vec3, rotation?: Vec3) {
    this.add(material, new THREE.BoxGeometry(1, 1, 1), position, scale, rotation);
  }

  sphere(material: DecorationMaterial, position: Vec3, scale: Vec3, rotation?: Vec3) {
    this.add(material, new THREE.SphereGeometry(1, 12, 8), position, scale, rotation);
  }

  cylinder(
    material: DecorationMaterial,
    position: Vec3,
    top: number,
    bottom: number,
    height: number,
    rotation?: Vec3,
    segments = 12,
  ) {
    this.add(material, new THREE.CylinderGeometry(top, bottom, height, segments), position, undefined, rotation);
  }

  ring(material: DecorationMaterial, position: Vec3, radius: number, tube: number, rotation: Vec3 = [Math.PI / 2, 0, 0], arc = Math.PI * 2) {
    this.add(material, new THREE.TorusGeometry(radius, tube, 6, 24, arc), position, undefined, rotation);
  }

  finish(): readonly DecorationGeometryPart[] {
    return [...this.parts.entries()].map(([material, geometries]) => {
      const geometry = mergeGeometries(geometries);
      geometries.forEach((part) => part.dispose());
      geometry.computeBoundingBox();
      geometry.computeBoundingSphere();
      return { material, geometry };
    });
  }
}

function bench(b: DecorationBuilder) {
  for (const x of [-0.29, 0.29]) {
    for (const z of [-0.1, 0.1]) b.box('metal', [x, 0.15, z], [0.042, 0.3, 0.046]);
    b.box('metal', [x, 0.42, 0.145], [0.038, 0.39, 0.04], [-0.1, 0, 0]);
    b.box('woodDark', [x, 0.395, 0.01], [0.045, 0.035, 0.32]);
  }
  for (const z of [-0.105, 0.0, 0.105]) b.box('wood', [0, 0.3, z], [0.78, 0.05, 0.089]);
  for (const y of [0.47, 0.575]) b.box('wood', [0, y, 0.166], [0.78, 0.078, 0.04], [-0.1, 0, 0]);
  b.box('woodLight', [0, 0.327, -0.11], [0.72, 0.007, 0.008]);
}

function roundStone(b: DecorationBuilder) {
  b.sphere('stone', [0, 0.19, 0], [0.36, 0.18, 0.31], [0.08, 0.3, -0.08]);
  b.sphere('stoneLight', [-0.09, 0.3, -0.04], [0.17, 0.065, 0.17]);
  b.sphere('moss', [0.03, 0.045, 0.16], [0.23, 0.038, 0.125]);
  b.sphere('moss', [-0.19, 0.115, 0.16], [0.09, 0.038, 0.07], [0, 0, -0.4]);
}

function lantern(b: DecorationBuilder) {
  b.cylinder('metal', [0, 0.035, 0], 0.165, 0.18, 0.07, undefined, 8);
  b.cylinder('metal', [0, 0.19, 0], 0.075, 0.1, 0.28, undefined, 8);
  b.cylinder('metal', [0, 0.35, 0], 0.145, 0.15, 0.04, undefined, 8);
  b.cylinder('glow', [0, 0.455, 0], 0.115, 0.115, 0.18, undefined, 8);
  for (const x of [-0.09, 0.09]) {
    for (const z of [-0.09, 0.09]) b.box('metal', [x, 0.465, z], [0.018, 0.205, 0.018]);
  }
  b.cylinder('metal', [0, 0.585, 0], 0.025, 0.19, 0.11, undefined, 8);
  b.sphere('woodLight', [0, 0.665, 0], [0.028, 0.033, 0.028]);
}

function woodFence(b: DecorationBuilder) {
  for (const y of [0.18, 0.39]) b.box('woodLight', [0, y, 0.024], [0.81, 0.063, 0.05]);
  for (const x of [-0.32, 0, 0.32]) {
    b.box('wood', [x, 0.25, 0], [0.075, 0.5, 0.075]);
    b.cylinder('wood', [x, 0.535, 0], 0, 0.053, 0.07, [0, Math.PI / 4, 0], 4);
  }
  for (const x of [-0.16, 0.16]) b.box('wood', [x, 0.285, 0], [0.06, 0.43, 0.065]);
}

function birdbath(b: DecorationBuilder) {
  b.cylinder('stoneLight', [0, 0.035, 0], 0.17, 0.21, 0.07);
  b.cylinder('stone', [0, 0.25, 0], 0.085, 0.115, 0.44);
  b.cylinder('stoneLight', [0, 0.505, 0], 0.285, 0.14, 0.105);
  b.cylinder('water', [0, 0.56, 0], 0.245, 0.245, 0.012);
  b.ring('stoneLight', [0, 0.566, 0], 0.265, 0.025);
  // A tiny bird on the far rim makes this distinct from the fountain.
  b.sphere('moss', [0.13, 0.653, -0.155], [0.067, 0.052, 0.043], [0, 0, 0.18]);
  b.sphere('sage', [0.184, 0.698, -0.155], [0.037, 0.037, 0.035]);
  b.cylinder('woodLight', [0.225, 0.694, -0.155], 0, 0.02, 0.045, [0, 0, -Math.PI / 2], 5);
  b.sphere('leaf', [0.09, 0.659, -0.156], [0.055, 0.015, 0.025], [0, 0, -0.2]);
  b.sphere('metal', [0.196, 0.707, -0.129], [0.005, 0.006, 0.005]);
}

function fountain(b: DecorationBuilder) {
  b.cylinder('stone', [0, 0.055, 0], 0.38, 0.36, 0.11, undefined, 16);
  b.cylinder('water', [0, 0.112, 0], 0.33, 0.33, 0.009, undefined, 16);
  b.ring('stoneLight', [0, 0.13, 0], 0.35, 0.033);
  b.cylinder('stoneLight', [0, 0.27, 0], 0.07, 0.12, 0.32);
  b.cylinder('stone', [0, 0.44, 0], 0.225, 0.115, 0.095);
  b.cylinder('water', [0, 0.492, 0], 0.195, 0.195, 0.012);
  b.ring('stoneLight', [0, 0.5, 0], 0.21, 0.023);
  b.cylinder('stoneLight', [0, 0.566, 0], 0.045, 0.07, 0.13);
  b.cylinder('waterLight', [0, 0.702, 0], 0.012, 0.018, 0.2, undefined, 7);
  b.sphere('waterLight', [0, 0.81, 0], [0.024, 0.03, 0.024]);
  for (const x of [-0.11, 0.11]) {
    b.sphere('waterLight', [x, 0.578, 0], [0.014, 0.035, 0.014], [0, 0, x > 0 ? 0.35 : -0.35]);
  }
}

function flowerPot(b: DecorationBuilder) {
  b.cylinder('terracotta', [0, 0.15, 0], 0.205, 0.14, 0.3);
  b.ring('terracottaLight', [0, 0.297, 0], 0.196, 0.028);
  b.cylinder('soil', [0, 0.3, 0], 0.173, 0.173, 0.012);
  for (const [x, z, y] of [[-0.05, 0.02, 0.5], [0.08, -0.04, 0.54], [-0.09, -0.05, 0.56]]) {
    b.cylinder('leaf', [x, (y + 0.3) / 2, z], 0.01, 0.012, y - 0.3);
    for (let i = 0; i < 5; i += 1) {
      const angle = i * Math.PI * 2 / 5;
      b.sphere('petal', [x + Math.cos(angle) * 0.033, y, z + Math.sin(angle) * 0.033], [0.03, 0.023, 0.03]);
    }
    b.sphere('glow', [x, y + 0.017, z], [0.016, 0.012, 0.016]);
  }
  for (const side of [-1, 1]) {
    b.sphere('leafLight', [side * 0.105, 0.385, 0.06], [0.11, 0.025, 0.038], [0, side * 0.5, side * 0.38]);
  }
}

function wateringCan(b: DecorationBuilder) {
  b.cylinder('sage', [0.045, 0.19, 0], 0.145, 0.165, 0.34);
  b.cylinder('sageLight', [0.045, 0.363, 0], 0.14, 0.14, 0.016);
  b.cylinder('metal', [0.045, 0.373, 0], 0.055, 0.055, 0.007);
  b.add('sage', new THREE.TorusGeometry(1, 0.15, 6, 16), [0.187, 0.229, 0], [0.125, 0.15, 0.125]);
  b.cylinder('sage', [-0.185, 0.265, 0], 0.028, 0.045, 0.24, [0, 0, -0.9]);
  b.cylinder('sageLight', [-0.292, 0.355, 0], 0.075, 0.03, 0.07, [0, 0, -0.9]);
  for (const z of [-0.027, 0, 0.027]) b.sphere('metal', [-0.323, 0.38, z], [0.0035, 0.007, 0.0035]);
}

function signpost(b: DecorationBuilder) {
  b.box('woodDark', [0, 0.35, 0], [0.065, 0.7, 0.064]);
  const shape = new THREE.Shape();
  shape.moveTo(-0.26, -0.105);
  shape.lineTo(0.18, -0.105);
  shape.lineTo(0.3, 0);
  shape.lineTo(0.18, 0.105);
  shape.lineTo(-0.26, 0.105);
  shape.closePath();
  b.add('wood', new THREE.ExtrudeGeometry(shape, { depth: 0.043, bevelEnabled: false }), [0, 0.55, -0.029]);
  b.box('woodLight', [-0.06, 0.573, 0.017], [0.23, 0.012, 0.006]);
  b.box('woodLight', [-0.09, 0.53, 0.017], [0.17, 0.01, 0.006]);
  b.sphere('moss', [-0.09, 0.037, 0.045], [0.12, 0.037, 0.09]);
}

function gardenArch(b: DecorationBuilder) {
  for (const side of [-1, 1]) {
    b.box('wood', [side * 0.352, 0.36, 0], [0.058, 0.72, 0.066]);
    b.box('woodDark', [side * 0.352, 0.025, 0], [0.096, 0.05, 0.12]);
    for (const y of [0.18, 0.36, 0.54]) {
      b.box('woodLight', [side * 0.315, y, 0], [0.11, 0.025, 0.04]);
    }
  }
  b.ring('wood', [0, 0.72, 0], 0.352, 0.032, [0, 0, 0], Math.PI);
  for (const [x, y, angle] of [[-0.34, 0.3, -0.5], [-0.33, 0.55, 0.4], [-0.3, 0.82, -0.4], [-0.13, 1.034, 0.3], [0.34, 0.54, -0.4], [0.31, 0.87, 0.35]]) {
    b.sphere('leaf', [x, y, 0.047], [0.06, 0.026, 0.026], [0, 0, angle]);
    b.sphere('leafLight', [x + 0.016, y + 0.076, 0.024], [0.043, 0.026, 0.023], [0, 0, -angle]);
  }
  for (const [x, y] of [[-0.29, 0.89], [0.35, 0.69]]) {
    b.sphere('petal', [x, y, 0.065], [0.04, 0.04, 0.028]);
    b.sphere('glow', [x, y, 0.09], [0.014, 0.014, 0.009]);
  }
}

function steppingStones(b: DecorationBuilder) {
  for (const [x, z, radius, yaw] of [[0.08, -0.29, 0.15, 0.3], [-0.1, 0, 0.18, -0.15], [0.08, 0.28, 0.16, 0.5]]) {
    b.add('stone', new THREE.CylinderGeometry(radius, radius * 0.96, 0.07, 7), [x, 0.038, z], [1, 1, 0.85], [0, yaw, 0]);
    b.add('stoneLight', new THREE.CylinderGeometry(radius * 0.87, radius * 0.87, 0.008, 7), [x, 0.077, z], [1, 1, 0.85], [0, yaw, 0]);
  }
}

function mushroom(b: DecorationBuilder) {
  for (const [x, z, size] of [[-0.06, 0, 1], [0.225, 0.12, 0.54]]) {
    b.cylinder('cream', [x, 0.14 * size, z], 0.045 * size, 0.057 * size, 0.28 * size);
    b.add('terracotta', new THREE.SphereGeometry(1, 14, 8, 0, Math.PI * 2, 0, Math.PI / 2), [x, 0.285 * size, z], [0.21 * size, 0.17 * size, 0.21 * size]);
    b.cylinder('terracottaLight', [x, 0.282 * size, z], 0.205 * size, 0.19 * size, 0.022 * size, undefined, 14);
    for (const [dx, dz] of [[-0.075, 0.025], [0.055, 0.085], [0.055, -0.06]]) {
      const top = 0.285 + 0.17 * Math.sqrt(1 - (dx * dx + dz * dz) / (0.21 * 0.21));
      b.sphere('cream', [x + dx * size, (top + 0.002) * size, z + dz * size], [0.024 * size, 0.008 * size, 0.024 * size]);
    }
  }
}

const builders: Record<GardenDecorationType, (builder: DecorationBuilder) => void> = {
  bench,
  'round-stone': roundStone,
  lantern,
  'wood-fence': woodFence,
  birdbath,
  fountain,
  'flower-pot': flowerPot,
  'watering-can': wateringCan,
  signpost,
  'garden-arch': gardenArch,
  'stepping-stones': steppingStones,
  mushroom,
};

export function getDecorationGeometry(type: GardenDecorationType): readonly DecorationGeometryPart[] {
  const cached = geometryCache.get(type);
  if (cached) return cached;
  const builder = new DecorationBuilder();
  builders[type](builder);
  const geometry = builder.finish();
  geometryCache.set(type, geometry);
  return geometry;
}
