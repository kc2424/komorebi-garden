import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/addons/utils/BufferGeometryUtils.js';
import type { TileSurface } from '../../types';
import { getTileElevation, normalizeTerrainHeight } from '../../utils/terrain';
import { createEarthMaterial, createGrassMaterial, createTurfMaterial } from './proceduralMaterials';

type SolidSurface = Exclude<TileSurface, 'grass'>;
type Vec3 = [number, number, number];
const surfaceGeometries = new Map<SolidSurface, THREE.BufferGeometry>();
const columnGeometries = new Map<number, THREE.BufferGeometry>();
const surfaceMaterials = new Map<'ground' | 'water', THREE.MeshStandardMaterial>();
let earthMaterial: THREE.MeshStandardMaterial | undefined;
let turfMaterial: THREE.MeshStandardMaterial | undefined;
let grassMaterial: THREE.MeshStandardMaterial | undefined;

export function getEarthMaterial(): THREE.MeshStandardMaterial {
  return earthMaterial ??= createEarthMaterial();
}

export function getTurfMaterial(): THREE.MeshStandardMaterial {
  return turfMaterial ??= createTurfMaterial();
}

export function getGrassMaterial(): THREE.MeshStandardMaterial {
  return grassMaterial ??= createGrassMaterial();
}

/** Four immutable columns, with the bottom anchored at -0.30 at every height. */
export function getSoilColumnGeometry(height = 0): THREE.BufferGeometry {
  const level = normalizeTerrainHeight(height);
  const cached = columnGeometries.get(level);
  if (cached) return cached;
  const elevation = getTileElevation({ height: level });
  const geometry = new RoundedBoxGeometry(0.98, 0.34 + elevation, 0.98, 2, 0.07);
  geometry.translate(0, -0.13 + elevation / 2, 0);
  geometry.clearGroups();
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  columnGeometries.set(level, geometry);
  return geometry;
}

function coloredPart(
  source: THREE.BufferGeometry,
  color: string,
  position: Vec3,
  scale: Vec3 = [1, 1, 1],
  rotation: Vec3 = [0, 0, 0],
): THREE.BufferGeometry {
  const geometry = source.index ? source.toNonIndexed() : source;
  if (source !== geometry) source.dispose();
  geometry.applyMatrix4(new THREE.Matrix4().compose(
    new THREE.Vector3(...position),
    new THREE.Quaternion().setFromEuler(new THREE.Euler(...rotation)),
    new THREE.Vector3(...scale),
  ));
  const tint = new THREE.Color(color);
  const count = geometry.getAttribute('position').count;
  const colors = new Float32Array(count * 3);
  for (let index = 0; index < count; index += 1) {
    colors[index * 3] = tint.r;
    colors[index * 3 + 1] = tint.g;
    colors[index * 3 + 2] = tint.b;
  }
  geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  geometry.clearGroups();
  return geometry;
}

function buildSurfaceGeometry(surface: SolidSurface): THREE.BufferGeometry {
  const parts: THREE.BufferGeometry[] = [];
  if (surface === 'soil') {
    parts.push(coloredPart(new RoundedBoxGeometry(0.94, 0.055, 0.94, 2, 0.027), '#8d654c', [0, 0.035, 0]));
  } else if (surface === 'stone') {
    parts.push(coloredPart(new RoundedBoxGeometry(0.98, 0.07, 0.98, 2, 0.035), '#aaa39a', [0, 0.042, 0]));
  } else if (surface === 'gravel') {
    parts.push(coloredPart(new THREE.BoxGeometry(0.95, 0.055, 0.95), '#c8bbaa', [0, 0.035, 0]));
    for (let index = 0; index < 9; index += 1) {
      parts.push(coloredPart(
        new THREE.DodecahedronGeometry(1, 0),
        index % 2 ? '#e0d7c8' : '#aa9c8c',
        [(index % 3 - 1) * 0.28, 0.063, (Math.floor(index / 3) - 1) * 0.28],
        [0.11, 0.028, 0.075], [0, index * 1.2, 0],
      ));
    }
  } else if (surface === 'wood') {
    for (const [index, offset] of [-0.36, -0.12, 0.12, 0.36].entries()) {
      parts.push(coloredPart(
        new THREE.BoxGeometry(0.97, 0.055, 0.225),
        index % 2 ? '#b3885a' : '#c39a69', [0, 0.054, offset],
      ));
    }
  } else {
    parts.push(coloredPart(new THREE.BoxGeometry(0.96, 0.05, 0.96), '#79b8b9', [0, 0.041, 0]));
    for (const [index, offset] of [-0.2, 0.18].entries()) {
      parts.push(coloredPart(
        new THREE.PlaneGeometry(index ? 0.24 : 0.35, 0.014),
        '#a8d4cd', [index ? 0.12 : -0.15, 0.068, offset],
        [1, 1, 1], [-Math.PI / 2, 0, 0.13],
      ));
    }
  }
  const geometry = mergeGeometries(parts);
  parts.forEach((part) => part.dispose());
  geometry.computeBoundingBox();
  geometry.computeBoundingSphere();
  return geometry;
}

/** Exactly one vertex-colored mesh per non-grass surface, shared by all its tiles. */
export function getTileSurfaceGeometry(surface: SolidSurface): THREE.BufferGeometry {
  const cached = surfaceGeometries.get(surface);
  if (cached) return cached;
  const geometry = buildSurfaceGeometry(surface);
  surfaceGeometries.set(surface, geometry);
  return geometry;
}

export function getTileSurfaceMaterial(surface: SolidSurface): THREE.MeshStandardMaterial {
  const key = surface === 'water' ? 'water' : 'ground';
  const cached = surfaceMaterials.get(key);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: key === 'water' ? 0.26 : 0.92,
    metalness: key === 'water' ? 0.08 : 0,
  });
  surfaceMaterials.set(key, material);
  return material;
}
