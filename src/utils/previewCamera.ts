import * as THREE from 'three';
import type { GardenModelType } from '../types';
import { COSMOS_BLOSSOM_CENTER_Y, COSMOS_HEIGHT } from '../components/garden3d/cosmosGeometry';
import { MODEL_HEIGHTS } from './plantModel';
import { PLANT_SHAPES } from '../data/plantShapes';
import { PANSY_BLOSSOM_WIDTH, PANSY_FLOWER_CENTER_Y, PANSY_HEIGHT } from '../components/garden3d/pansyGeometry';

/** Catalog card preview frame (CSS px). */
export const PREVIEW_FRAME_WIDTH = 100;
export const PREVIEW_FRAME_HEIGHT = 96;
/** Collapsed planting row preview frame (CSS px). */
export const PREVIEW_COMPACT_FRAME_WIDTH = 72;
export const PREVIEW_COMPACT_FRAME_HEIGHT = 68;
export const PREVIEW_FILL_FRACTION = 0.82;

export interface PreviewModelBounds {
  width: number;
  height: number;
  centerY: number;
}

export const PREVIEW_MODEL_BOUNDS: Record<GardenModelType, PreviewModelBounds> = {
  ...Object.fromEntries(Object.entries(PLANT_SHAPES).map(([modelType, shape]) => [modelType, { width: shape.width, height: shape.height, centerY: shape.height / 2 }])) as Record<GardenModelType, PreviewModelBounds>,
  tulip: { width: 0.52, height: MODEL_HEIGHTS.tulip, centerY: 0.62 },
  cosmos: { width: 0.78, height: COSMOS_HEIGHT, centerY: COSMOS_BLOSSOM_CENTER_Y },
  pansy: { width: PANSY_BLOSSOM_WIDTH, height: PANSY_HEIGHT, centerY: PANSY_FLOWER_CENTER_Y },
};

/** Fixed 3/4 azimuth for catalog readability (no idle spin). */
export const PREVIEW_YAW: Record<GardenModelType, number> = {
  ...Object.fromEntries(Object.keys(PLANT_SHAPES).map((modelType) => [modelType, 0.35])) as Record<GardenModelType, number>,
  tulip: 0.55,
  cosmos: 0.45,
  pansy: 0,
};

export interface PreviewCameraSetup {
  position: [number, number, number];
  target: [number, number, number];
  zoom: number;
}

export function getPreviewCameraSetup(
  modelType: GardenModelType,
  frameWidth = PREVIEW_FRAME_WIDTH,
  frameHeight = PREVIEW_FRAME_HEIGHT,
): PreviewCameraSetup {
  const bounds = PREVIEW_MODEL_BOUNDS[modelType];
  const yaw = PREVIEW_YAW[modelType];
  const elevation = modelType === 'pansy' ? 0.12 : 0.38;
  const cosYaw = Math.cos(yaw);
  const sinYaw = Math.sin(yaw);
  const cosElev = Math.cos(elevation);
  const sinElev = Math.sin(elevation);

  const target: [number, number, number] = [0, bounds.centerY, 0];
  const distance = Math.max(bounds.width, bounds.height) * 1.35;
  const position: [number, number, number] = [
    sinYaw * cosElev * distance,
    bounds.centerY + sinElev * distance,
    cosYaw * cosElev * distance,
  ];

  const frameAspect = frameWidth / frameHeight;
  const fitHeight = Math.max(bounds.height, bounds.width / frameAspect);
  const desiredFillPx = frameHeight * PREVIEW_FILL_FRACTION;
  /** 3/4 view enlarges the projected AABB compared to the fit axis. */
  const viewProjectionSlack = 1.14;
  const zoom = desiredFillPx / (fitHeight * viewProjectionSlack);

  return { position, target, zoom };
}

/** Drei View sets ortho frustum to ±frameWidth/2 and ±frameHeight/2 in CSS pixels. */
export function createPreviewOrthographicCamera(
  frameWidth: number,
  frameHeight: number,
): THREE.OrthographicCamera {
  return new THREE.OrthographicCamera(
    -frameWidth / 2,
    frameWidth / 2,
    frameHeight / 2,
    -frameHeight / 2,
    0.01,
    20,
  );
}

export interface PreviewProjectedExtents {
  widthPx: number;
  heightPx: number;
}

export function measurePreviewProjectedExtents(
  modelType: GardenModelType,
  frameWidth: number,
  frameHeight: number,
): PreviewProjectedExtents {
  const setup = getPreviewCameraSetup(modelType, frameWidth, frameHeight);
  const bounds = PREVIEW_MODEL_BOUNDS[modelType];
  const camera = createPreviewOrthographicCamera(frameWidth, frameHeight);
  camera.position.set(...setup.position);
  camera.zoom = setup.zoom;
  camera.lookAt(...setup.target);
  camera.updateMatrixWorld();
  camera.updateProjectionMatrix();

  const halfW = bounds.width / 2;
  const halfD = bounds.width / 2;
  const minY = bounds.centerY - bounds.height / 2;
  const maxY = bounds.centerY + bounds.height / 2;
  const corners = [
    new THREE.Vector3(-halfW, minY, -halfD),
    new THREE.Vector3(halfW, minY, -halfD),
    new THREE.Vector3(-halfW, minY, halfD),
    new THREE.Vector3(halfW, minY, halfD),
    new THREE.Vector3(-halfW, maxY, -halfD),
    new THREE.Vector3(halfW, maxY, -halfD),
    new THREE.Vector3(-halfW, maxY, halfD),
    new THREE.Vector3(halfW, maxY, halfD),
  ];

  let minXPx = Infinity;
  let maxXPx = -Infinity;
  let minYPx = Infinity;
  let maxYPx = -Infinity;
  const projected = new THREE.Vector3();
  for (const corner of corners) {
    projected.copy(corner).project(camera);
    const px = (projected.x * 0.5 + 0.5) * frameWidth;
    const py = (-projected.y * 0.5 + 0.5) * frameHeight;
    minXPx = Math.min(minXPx, px);
    maxXPx = Math.max(maxXPx, px);
    minYPx = Math.min(minYPx, py);
    maxYPx = Math.max(maxYPx, py);
  }

  return {
    widthPx: maxXPx - minXPx,
    heightPx: maxYPx - minYPx,
  };
}
