import * as THREE from 'three';
import type { GardenModelType, TulipColor } from '../../types';
import { tulipColorHex } from '../../data/tulip';
import { PLANT_SHAPES } from '../../data/plantShapes';

type Point = [number, number, number];
const UP = new THREE.Vector3(0, 1, 0);
const FRONT = new THREE.Vector3(0, 0, 1);
const LEAF = '#668647';
const LEAF_LIGHT = '#86a45b';
const STEM = '#55753e';
const TAU = Math.PI * 2;
const sphere = new THREE.SphereGeometry(1, 6, 4);
const tinySphere = new THREE.SphereGeometry(1, 5, 3);
const branch = new THREE.CylinderGeometry(1, 1, 1, 6, 1);
const canopy = new THREE.IcosahedronGeometry(1, 1);

/** All plant parts are baked into one indexed, vertex-colored mesh. */
class PlantBuilder {
  positions: number[] = [];
  normals: number[] = [];
  colors: number[] = [];
  indices: number[] = [];

  add(geometry: THREE.BufferGeometry, color: string, position: Point = [0, 0, 0], scale: Point = [1, 1, 1], quaternion = new THREE.Quaternion()) {
    const matrix = new THREE.Matrix4().compose(new THREE.Vector3(...position), quaternion, new THREE.Vector3(...scale));
    const normalMatrix = new THREE.Matrix3().getNormalMatrix(matrix);
    const positions = geometry.getAttribute('position');
    const normals = geometry.getAttribute('normal');
    const offset = this.positions.length / 3;
    const point = new THREE.Vector3();
    const normal = new THREE.Vector3();
    const tint = new THREE.Color(color);
    for (let i = 0; i < positions.count; i += 1) {
      point.fromBufferAttribute(positions, i).applyMatrix4(matrix);
      normal.fromBufferAttribute(normals, i).applyMatrix3(normalMatrix).normalize();
      this.positions.push(point.x, point.y, point.z);
      this.normals.push(normal.x, normal.y, normal.z);
      // A gentle upward tint gives leaves and petals a little depth without textures.
      const shade = 0.94 + 0.06 * Math.max(0, normal.y);
      this.colors.push(tint.r * shade, tint.g * shade, tint.b * shade);
    }
    if (geometry.index) {
      for (let i = 0; i < geometry.index.count; i += 1) this.indices.push(offset + geometry.index.getX(i));
    } else {
      for (let i = 0; i < positions.count; i += 1) this.indices.push(offset + i);
    }
  }

  stem(from: Point, to: Point, radius = 0.018, color = STEM) {
    const a = new THREE.Vector3(...from);
    const b = new THREE.Vector3(...to);
    const direction = b.clone().sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize());
    const middle = a.add(b).multiplyScalar(0.5);
    this.add(branch, color, middle.toArray() as Point, [radius, direction.length(), radius], q);
  }

  oval(center: Point, scale: Point, color: string, quaternion?: THREE.Quaternion) {
    this.add(sphere, color, center, scale, quaternion);
  }

  leaf(from: Point, to: Point, width: number, color = LEAF, twist = 0) {
    const a = new THREE.Vector3(...from);
    const direction = new THREE.Vector3(...to).sub(a);
    const q = new THREE.Quaternion().setFromUnitVectors(UP, direction.clone().normalize());
    q.multiply(new THREE.Quaternion().setFromAxisAngle(UP, twist));
    this.add(leafGeometry, color, from, [width, direction.length(), width], q);
  }

  finish(modelType: GardenModelType) {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(this.positions, 3));
    geometry.setAttribute('normal', new THREE.Float32BufferAttribute(this.normals, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(this.colors, 3));
    geometry.setIndex(this.indices);
    geometry.computeBoundingBox();
    const bounds = geometry.boundingBox!;
    // Normalize to the camera contract so every model keeps a coherent garden scale.
    const target = PLANT_SHAPES[modelType];
    const height = bounds.max.y - Math.min(bounds.min.y, 0);
    const width = Math.max(bounds.max.x - bounds.min.x, bounds.max.z - bounds.min.z);
    const horizontalScale = Math.min(1, target.width / width);
    geometry.translate(0, -Math.min(bounds.min.y, 0), 0);
    geometry.scale(horizontalScale, target.height / height, horizontalScale);
    geometry.computeBoundingBox();
    geometry.computeBoundingSphere();
    geometry.name = `plant:${modelType}`;
    return geometry;
  }
}

function makeLeafGeometry() {
  const positions: number[] = [];
  const indices: number[] = [];
  const widths = [0, 0.72, 1, 0.78, 0];
  for (let row = 0; row < widths.length; row += 1) {
    const t = row / (widths.length - 1);
    const bend = Math.sin(t * Math.PI) * 0.18;
    positions.push(-widths[row] * 0.5, t, bend, 0, t, bend + Math.sin(t * Math.PI) * 0.1, widths[row] * 0.5, t, bend);
    if (row > 0) {
      for (let column = 0; column < 2; column += 1) {
        const a = (row - 1) * 3 + column;
        indices.push(a, a + 1, a + 3, a + 1, a + 4, a + 3);
      }
    }
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  return geometry;
}
const leafGeometry = makeLeafGeometry();
const petalGeometry = new THREE.BufferGeometry();
petalGeometry.setAttribute('position', new THREE.Float32BufferAttribute([
  0, 0, 0.22,
  0, -1, 0, -0.65, -0.65, 0.12, -1, 0.05, 0.18, -0.72, 0.75, 0.12,
  0, 1, 0, 0.72, 0.75, 0.12, 1, 0.05, 0.18, 0.65, -0.65, 0.12,
], 3));
petalGeometry.setIndex(Array.from({ length: 8 }, (_, i) => [0, (i + 1) % 8 + 1, i + 1]).flat());
petalGeometry.computeVertexNormals();

function leafyStem(b: PlantBuilder, top: Point, broad = 0.14, count = 3) {
  b.stem([0, 0, 0], top);
  for (let i = 0; i < count; i += 1) {
    const t = 0.2 + i * 0.17;
    const side = i % 2 === 0 ? 1 : -1;
    b.leaf([top[0] * t, top[1] * t, top[2] * t], [side * 0.27, top[1] * t + 0.18, 0.08 * side], broad, i % 2 ? LEAF : LEAF_LIGHT, side * 0.45);
  }
}

/** A cupped radial bloom; petals lie in a plane facing the supplied normal. */
function bloom(b: PlantBuilder, center: Point, count: number, radius: number, color: string, middle: string, normal: Point = [0, 0.86, 0.5], petalWidth = 0.12, cup = 0.03) {
  const orientation = new THREE.Quaternion().setFromUnitVectors(FRONT, new THREE.Vector3(...normal).normalize());
  const origin = new THREE.Vector3(...center);
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU;
    const p = new THREE.Vector3(Math.sin(angle) * radius * 0.55, Math.cos(angle) * radius * 0.55, cup).applyQuaternion(orientation).add(origin);
    const q = orientation.clone().multiply(new THREE.Quaternion().setFromAxisAngle(FRONT, -angle));
    b.add(petalGeometry, color, p.toArray() as Point, [petalWidth, radius * 0.57, 0.09 + cup], q);
  }
  const middlePosition = new THREE.Vector3(0, 0, cup + 0.035).applyQuaternion(orientation).add(origin);
  b.add(radius < 0.1 ? tinySphere : sphere, middle, middlePosition.toArray() as Point, [radius * 0.27, radius * 0.27, radius * 0.17], orientation);
}

function tuft(b: PlantBuilder, count: number, height: number, spread: number, width: number, colors = [LEAF, LEAF_LIGHT]) {
  for (let i = 0; i < count; i += 1) {
    const angle = (i / count) * TAU + 0.3;
    const length = height * (0.65 + (i % 3) * 0.175);
    b.leaf([0, 0.025, 0], [Math.cos(angle) * spread, length, Math.sin(angle) * spread], width, colors[i % colors.length], angle + 0.6);
  }
}

function tulip(b: PlantBuilder, color: TulipColor) {
  leafyStem(b, [0, 0.96, 0], 0.14, 2);
  b.leaf([0, 0.12, 0], [-0.22, 0.8, 0.08], 0.2, LEAF_LIGHT);
  b.leaf([0, 0.23, 0], [0.27, 0.88, -0.04], 0.17, LEAF, 1);
  const petalColor = color === 'pink' ? '#ec9ca4' : tulipColorHex(color);
  for (let i = 0; i < 6; i += 1) {
    const angle = i / 6 * TAU;
    const q = new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.12, angle, 0));
    b.oval([Math.sin(angle) * 0.1, 1.14 + (i % 2) * 0.035, Math.cos(angle) * 0.1], [0.123, 0.22, 0.075], petalColor, q);
  }
}

function pansy(b: PlantBuilder) {
  tuft(b, 6, 0.22, 0.23, 0.15);
  for (let i = 0; i < 2; i += 1) {
    const center: Point = [i === 0 ? -0.11 : 0.13, i === 0 ? 0.35 : 0.26, i * 0.08];
    b.stem([0, 0.03, 0], center, 0.012);
    bloom(b, center, 5, 0.19, i ? '#b193d1' : '#a17ac5', '#f1c154', [0, 0.34, 0.94], 0.11);
    for (const angle of [-0.9, 0.9, Math.PI]) {
      b.oval([center[0] + Math.sin(angle) * 0.055, center[1] + Math.cos(angle) * 0.055, center[2] + 0.057], [0.041, 0.055, 0.013], '#664574', new THREE.Quaternion().setFromAxisAngle(FRONT, -angle));
    }
  }
}

function lavender(b: PlantBuilder) {
  tuft(b, 9, 0.45, 0.27, 0.065, ['#6d8b65', '#91a777']);
  for (let i = 0; i < 7; i += 1) {
    const angle = i / 7 * TAU;
    const x = Math.cos(angle) * 0.21;
    const z = Math.sin(angle) * 0.16;
    const h = 0.72 + (i % 3) * 0.12;
    b.stem([0, 0, 0], [x, h, z], 0.009, '#78916b');
    for (let j = 0; j < 4; j += 1) {
      const size = 0.075 - j * 0.008;
      b.oval([x, h - 0.22 + j * 0.055, z], [size, 0.05, size], j % 2 ? '#b1a0d0' : '#8f79b4');
    }
  }
}

function rose(b: PlantBuilder) {
  leafyStem(b, [0, 0.73, 0], 0.16, 4);
  for (let layer = 0; layer < 3; layer += 1) {
    const count = 7 - layer;
    const radius = 0.18 - layer * 0.06;
    for (let i = 0; i < count; i += 1) {
      const angle = i / count * TAU + layer * 0.6;
      b.oval([Math.sin(angle) * radius, 0.79 + layer * 0.065, Math.cos(angle) * radius], [0.115 - layer * 0.018, 0.13 - layer * 0.018, 0.072], ['#cc7f91', '#dfa0ac', '#efd0cc'][layer], new THREE.Quaternion().setFromEuler(new THREE.Euler(-0.45, angle, 0)));
    }
  }
}

function hydrangea(b: PlantBuilder) {
  for (let i = 0; i < 6; i += 1) {
    const angle = i / 6 * TAU;
    b.leaf([0, 0.1, 0], [Math.sin(angle) * 0.43, 0.4, Math.cos(angle) * 0.38], 0.24, i % 2 ? '#668253' : '#88a169', angle);
  }
  const heads: Point[] = [[-0.2, 0.54, 0.04], [0.2, 0.62, -0.04], [0, 0.58, 0.23]];
  heads.forEach((center, index) => {
    b.stem([0, 0, 0], center, 0.026);
    b.oval(center, [0.25, 0.23, 0.23], index === 1 ? '#8d9bc1' : '#a2accf');
    for (let i = 0; i < 7; i += 1) {
      const angle = i * 2.4;
      const y = (i / 6) * 0.32 - 0.12;
      const radius = Math.sqrt(Math.max(0.01, 0.22 ** 2 - y ** 2));
      const offset: Point = [Math.cos(angle) * radius, y, Math.sin(angle) * radius];
      bloom(b, [center[0] + offset[0], center[1] + offset[1], center[2] + offset[2]], 4, 0.068, i % 2 ? '#c3cde3' : '#aebadd', '#e4d7a1', offset, 0.037, 0.002);
    }
  });
}

function marigold(b: PlantBuilder) {
  tuft(b, 7, 0.34, 0.27, 0.11);
  for (let head = 0; head < 3; head += 1) {
    const x = (head - 1) * 0.21;
    const y = head === 1 ? 0.47 : 0.34;
    const z = head === 1 ? -0.05 : 0.09;
    b.stem([0, 0.02, 0], [x, y, z], 0.014);
    b.oval([x, y, z], [0.16, 0.12, 0.15], '#df9b37');
    for (let i = 0; i < 8; i += 1) {
      const angle = i / 8 * TAU;
      b.oval([x + Math.cos(angle) * 0.1, y + 0.045, z + Math.sin(angle) * 0.1], [0.075, 0.085, 0.065], i % 2 ? '#efb549' : '#f3c361');
    }
    b.oval([x, y + 0.1, z], [0.095, 0.055, 0.085], '#f6ce70');
  }
}

function daffodil(b: PlantBuilder) {
  tuft(b, 5, 0.66, 0.21, 0.08);
  const center: Point = [0.06, 0.72, 0.04];
  b.stem([0, 0, 0], [0, 0.8, -0.02]);
  b.stem([0, 0.8, -0.02], center, 0.016);
  bloom(b, center, 6, 0.25, '#f5e8a0', '#eeb748', [0, 0.38, 0.93], 0.09);
  const q = new THREE.Quaternion().setFromUnitVectors(UP, new THREE.Vector3(0, 0.38, 0.93).normalize());
  const trumpet = new THREE.CylinderGeometry(0.095, 0.055, 0.15, 8, 1, true);
  b.add(trumpet, '#e9b647', [0.06, 0.76, 0.16], [1, 1, 1], q);
  trumpet.dispose();
}

function lily(b: PlantBuilder) {
  leafyStem(b, [0, 0.98, 0], 0.095, 5);
  const center: Point = [0, 1.03, 0];
  bloom(b, center, 6, 0.36, '#f5ede0', '#c6b675', [0, 0.92, 0.38], 0.09, 0.095);
  for (let i = 0; i < 5; i += 1) {
    const angle = i / 5 * TAU;
    const tip: Point = [Math.cos(angle) * 0.09, 1.25, Math.sin(angle) * 0.09 + 0.04];
    b.stem(center, tip, 0.006, '#b59e63');
    b.oval(tip, [0.025, 0.014, 0.016], '#b17c43');
  }
}

function poppy(b: PlantBuilder) {
  leafyStem(b, [0, 0.83, 0], 0.075, 3);
  bloom(b, [0, 0.87, 0], 4, 0.32, '#e99383', '#555248', [0, 0.83, 0.56], 0.22, 0.045);
  b.stem([0, 0.2, 0], [0.23, 0.69, -0.06], 0.009);
  b.oval([0.23, 0.69, -0.06], [0.047, 0.075, 0.05], '#879365');
}

function bluebell(b: PlantBuilder) {
  tuft(b, 5, 0.45, 0.24, 0.09);
  for (let stalk = 0; stalk < 2; stalk += 1) {
    const baseX = stalk === 0 ? -0.08 : 0.12;
    const height = stalk === 0 ? 0.87 : 0.66;
    b.stem([0, 0, 0], [baseX, height, 0], 0.012);
    for (let i = 0; i < 4; i += 1) {
      const side = i % 2 ? -1 : 1;
      const center: Point = [baseX + side * 0.11, height - 0.075 - i * 0.105, 0.055];
      b.stem([baseX, center[1] + 0.08, 0], [center[0], center[1] + 0.035, center[2]], 0.007);
      const bell = new THREE.CylinderGeometry(0.035, 0.085, 0.13, 7, 1, true);
      b.add(bell, i % 2 ? '#9298ca' : '#a9add9', center);
      bell.dispose();
      for (let tip = 0; tip < 4; tip += 1) {
        const angle = tip / 4 * TAU;
        b.add(tinySphere, '#b2b8e2', [center[0] + Math.cos(angle) * 0.062, center[1] - 0.06, center[2] + Math.sin(angle) * 0.062], [0.042, 0.023, 0.039]);
      }
    }
  }
}

function forgetMeNot(b: PlantBuilder) {
  tuft(b, 8, 0.18, 0.26, 0.12);
  for (let i = 0; i < 7; i += 1) {
    const angle = i * 2.4;
    const center: Point = [Math.cos(angle) * 0.2, 0.26 + (i % 3) * 0.045, Math.sin(angle) * 0.16];
    b.stem([0, 0.02, 0], center, 0.008);
    bloom(b, center, 5, 0.095, i % 2 ? '#91bcda' : '#aacde5', '#ead181', [0, 0.8, 0.6], 0.043, 0.002);
  }
}

function allium(b: PlantBuilder) {
  tuft(b, 4, 0.4, 0.23, 0.07);
  b.stem([0, 0, 0], [0, 1.11, 0], 0.018);
  b.oval([0, 1.11, 0], [0.24, 0.24, 0.24], '#ab8ebc');
  for (let i = 0; i < 36; i += 1) {
    const y = 1 - 2 * (i + 0.5) / 36;
    const radius = Math.sqrt(1 - y * y);
    const angle = i * 2.4;
    const offset: Point = [Math.cos(angle) * radius * 0.24, y * 0.24, Math.sin(angle) * radius * 0.24];
    b.oval([offset[0], 1.11 + offset[1], offset[2]], [0.047, 0.047, 0.047], i % 3 ? '#bfa6ce' : '#d4beda');
  }
}

function fern(b: PlantBuilder) {
  for (let frond = 0; frond < 6; frond += 1) {
    const angle = frond / 6 * TAU;
    const h = 0.49 + (frond % 3) * 0.1;
    const end: Point = [Math.cos(angle) * 0.43, h, Math.sin(angle) * 0.43];
    b.stem([0, 0.02, 0], end, 0.007, '#7a9856');
    for (let i = 1; i <= 6; i += 1) {
      const t = i / 7;
      const point: Point = [end[0] * t, end[1] * (t + Math.sin(t * Math.PI) * 0.2), end[2] * t];
      const leaflet = 0.14 * (1 - t * 0.68);
      for (const side of [-1, 1]) {
        b.leaf(point, [point[0] + Math.cos(angle + side * 1.15) * leaflet, point[1] + 0.08, point[2] + Math.sin(angle + side * 1.15) * leaflet], 0.05 * (1 - t * 0.3), frond % 2 ? '#779956' : '#8aa866', angle);
      }
    }
  }
}

function hosta(b: PlantBuilder) {
  for (let i = 0; i < 9; i += 1) {
    const angle = i / 9 * TAU;
    const tip: Point = [Math.cos(angle) * 0.4, 0.29 + (i % 3) * 0.09, Math.sin(angle) * 0.4];
    const from: Point = [0, 0.035, 0];
    b.leaf(from, tip, 0.29, '#cad297', angle);
    // The smaller inset leaf creates a pale, variegated rim without a texture.
    b.leaf([from[0], from[1] + 0.012, from[2] + 0.006], [tip[0] * 0.94, tip[1] * 0.95, tip[2] * 0.94 + 0.006], 0.215, i % 2 ? '#78905c' : '#91a76d', angle);
  }
}

function ornamentalGrass(b: PlantBuilder) {
  tuft(b, 19, 0.72, 0.37, 0.045, ['#a5af72', '#839653', '#b6bb81']);
  for (let i = 0; i < 5; i += 1) {
    const angle = i / 5 * TAU;
    const top: Point = [Math.cos(angle) * 0.22, 0.9 + (i % 3) * 0.065, Math.sin(angle) * 0.2];
    b.stem([0, 0, 0], top, 0.006, '#a9a174');
    b.oval(top, [0.045, 0.14, 0.042], i % 2 ? '#d1c5a0' : '#c6b88c', new THREE.Quaternion().setFromEuler(new THREE.Euler(0.12, angle, -0.16)));
  }
}

function tree(b: PlantBuilder, modelType: 'maple' | 'cherry') {
  const maple = modelType === 'maple';
  const bark = maple ? '#90775a' : '#8f7565';
  b.stem([0, 0, 0], [0.025, 1.57, 0], 0.055, bark);
  const heads: Array<{ center: Point; scale: Point }> = maple
    ? [
      { center: [-0.36, 1.42, 0.02], scale: [0.4, 0.25, 0.33] },
      { center: [0.32, 1.56, 0.04], scale: [0.42, 0.29, 0.34] },
      { center: [-0.12, 1.89, -0.06], scale: [0.47, 0.3, 0.4] },
      { center: [0.12, 1.67, 0.28], scale: [0.36, 0.22, 0.3] },
    ]
    : [
      { center: [-0.37, 1.48, 0], scale: [0.42, 0.37, 0.38] },
      { center: [0.36, 1.58, -0.02], scale: [0.43, 0.36, 0.4] },
      { center: [-0.07, 1.87, -0.04], scale: [0.48, 0.35, 0.43] },
      { center: [0.07, 1.6, 0.34], scale: [0.38, 0.29, 0.3] },
    ];
  heads.forEach(({ center, scale }, i) => {
    b.stem([0.01, 0.83 + i * 0.16, 0], center, 0.029 - i * 0.003, bark);
    b.add(canopy, maple ? ['#ba7850', '#d1935e', '#d9a56b', '#c98557'][i] : ['#dbb3b8', '#e8c5c7', '#f0d4d1', '#e1b9c0'][i], center, scale);
    if (maple) {
      for (let j = 0; j < 4; j += 1) {
        const angle = j / 4 * TAU;
        b.leaf([center[0], center[1], center[2]], [center[0] + Math.cos(angle) * scale[0] * 1.13, center[1] + 0.06, center[2] + Math.sin(angle) * scale[2] * 1.13], 0.21, '#ddb078', angle);
      }
    } else {
      for (let j = 0; j < 6; j += 1) {
        const angle = j * 2.4;
        b.oval([center[0] + Math.cos(angle) * scale[0] * 0.79, center[1] + (j % 3 - 1) * 0.12, center[2] + Math.sin(angle) * scale[2] * 0.8], [0.14, 0.13, 0.14], j % 2 ? '#f3dcd6' : '#e9c4cc');
      }
    }
  });
}

function createPlantGeometry(modelType: GardenModelType, color: TulipColor) {
  const b = new PlantBuilder();
  switch (modelType) {
    case 'tulip': tulip(b, color); break;
    case 'cosmos':
      leafyStem(b, [0, 0.98, 0], 0.035, 4);
      bloom(b, [0, 1.04, 0], 8, 0.36, '#e9adbf', '#eac26c', [0, 0.92, 0.38], 0.105);
      break;
    case 'pansy': pansy(b); break;
    case 'daisy':
      leafyStem(b, [0, 0.58, 0], 0.1, 3);
      bloom(b, [0, 0.62, 0], 12, 0.29, '#f4efe0', '#d8b55f', [0, 0.82, 0.57], 0.048);
      break;
    case 'sunflower':
      leafyStem(b, [0, 1.24, 0], 0.23, 4);
      bloom(b, [0, 1.4, 0], 15, 0.39, '#ecc65e', '#8d6f48', [0, 0.3, 0.95], 0.075);
      b.oval([0, 1.415, 0.075], [0.185, 0.185, 0.052], '#8b714c');
      break;
    case 'lavender': lavender(b); break;
    case 'rose': rose(b); break;
    case 'hydrangea': hydrangea(b); break;
    case 'marigold': marigold(b); break;
    case 'daffodil': daffodil(b); break;
    case 'lily': lily(b); break;
    case 'poppy': poppy(b); break;
    case 'bluebell': bluebell(b); break;
    case 'forget-me-not': forgetMeNot(b); break;
    case 'allium': allium(b); break;
    case 'fern': fern(b); break;
    case 'hosta': hosta(b); break;
    case 'ornamental-grass': ornamentalGrass(b); break;
    case 'maple':
    case 'cherry': tree(b, modelType); break;
  }
  return b.finish(modelType);
}

const geometryCache = new Map<string, THREE.BufferGeometry>();

/** Immutable shared geometry; component instances must not dispose it on unmount. */
export function getLightweightPlantGeometry(modelType: GardenModelType, color: TulipColor = 'red'): THREE.BufferGeometry {
  const key = modelType === 'tulip' ? `${modelType}:${color}` : modelType;
  let geometry = geometryCache.get(key);
  if (!geometry) {
    geometry = createPlantGeometry(modelType, color);
    geometryCache.set(key, geometry);
  }
  return geometry;
}

export function getLightweightPlantStats(modelType: GardenModelType) {
  const geometry = getLightweightPlantGeometry(modelType);
  return {
    triangles: (geometry.index?.count ?? geometry.getAttribute('position').count) / 3,
    vertices: geometry.getAttribute('position').count,
    drawCalls: 1,
  };
}
