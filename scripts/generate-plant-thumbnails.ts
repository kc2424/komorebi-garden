/** Rebuild static catalog previews: node_modules/.bin/tsx scripts/generate-plant-thumbnails.ts */
import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';
import * as THREE from 'three';
import { getLightweightPlantGeometry } from '../src/components/garden3d/lightweightPlantGeometry';
import { PLANT_SHAPES } from '../src/data/plantShapes';
import type { GardenModelType, TulipColor } from '../src/types';

const outputDirectory = resolve('public/art/plants');
mkdirSync(outputDirectory, { recursive: true });
const camera = new THREE.PerspectiveCamera();
camera.position.set(2.2, 1.7, 5);
camera.lookAt(0, 0, 0);
camera.updateMatrixWorld();
const viewMatrix = camera.matrixWorldInverse;
const light = new THREE.Vector3(-0.6, 1.6, 2.5).normalize();
const fillLight = new THREE.Vector3(1, 0.6, -0.3).normalize();

function createThumbnail(modelType: GardenModelType, color: TulipColor = 'red') {
  const geometry = getLightweightPlantGeometry(modelType, color);
  const positions = geometry.getAttribute('position');
  const normals = geometry.getAttribute('normal');
  const colors = geometry.getAttribute('color');
  const index = geometry.index!;
  const rotatedPositions: THREE.Vector3[] = [];
  let minX = Infinity;
  let maxX = -Infinity;
  let minY = Infinity;
  let maxY = -Infinity;
  for (let i = 0; i < positions.count; i += 1) {
    const point = new THREE.Vector3().fromBufferAttribute(positions, i).applyMatrix4(viewMatrix);
    rotatedPositions.push(point);
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
  }
  const scale = Math.min(116 / (maxX - minX), 106 / (maxY - minY));
  const offsetX = 80 - (maxX + minX) / 2 * scale;
  const offsetY = 115 + minY * scale;
  const triangles: Array<{ depth: number; shape: string }> = [];
  for (let i = 0; i < index.count; i += 3) {
    const indices = [index.getX(i), index.getX(i + 1), index.getX(i + 2)];
    const points = indices.map((vertex) => rotatedPositions[vertex]);
    const normal = new THREE.Vector3();
    const tint = new THREE.Color(0, 0, 0);
    for (const vertex of indices) {
      normal.add(new THREE.Vector3().fromBufferAttribute(normals, vertex));
      tint.r += colors.getX(vertex) / 3;
      tint.g += colors.getY(vertex) / 3;
      tint.b += colors.getZ(vertex) / 3;
    }
    normal.normalize();
    if (normal.dot(camera.position) < 0) normal.negate();
    const intensity = 0.69 + Math.max(0, normal.dot(light)) * 0.23 + Math.max(0, normal.dot(fillLight)) * 0.08;
    tint.multiplyScalar(intensity);
    const xy = points.map((point) => `${(point.x * scale + offsetX).toFixed(1)},${(offsetY - point.y * scale).toFixed(1)}`);
    const hex = `#${tint.getHexString()}`;
    triangles.push({ depth: (points[0].z + points[1].z + points[2].z) / 3, shape: `<path d="M${xy[0]}L${xy[1]}L${xy[2]}Z" fill="${hex}" stroke="${hex}" stroke-width=".28" stroke-linejoin="round"/>` });
  }
  triangles.sort((a, b) => a.depth - b.depth);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="160" height="128" viewBox="0 0 160 128"><ellipse cx="80" cy="116" rx="${modelType === 'maple' || modelType === 'cherry' ? 28 : 23}" ry="4" fill="#586344" opacity=".1"/>${triangles.map((triangle) => triangle.shape).join('')}</svg>\n`;
  const filename = modelType === 'tulip' && color !== 'red' ? `tulip-${color}` : modelType;
  writeFileSync(resolve(outputDirectory, `${filename}.svg`), svg);
}
for (const modelType of Object.keys(PLANT_SHAPES) as GardenModelType[]) createThumbnail(modelType);
for (const color of ['yellow', 'pink', 'white', 'purple', 'orange'] as const) createThumbnail('tulip', color);
console.log('Generated 20 plant previews and 5 additional tulip colors.');
