import type { GardenPlant, SoilTile } from '../types';
import { TILE_SIZE } from '../components/garden3d/ProceduralMeshes';
import { getPlantModelHeight } from './plantModel';

export interface CameraPose {
  position: [number, number, number];
  target: [number, number, number];
}

export const CAMERA_LERP_SPEED = 2.5;
export const CAMERA_CONVERGENCE_EPSILON = 0.02;

/** Model worker coordinates: flower ~1.4 tall, soil top at 0.06, ground at -0.31 */
export const FLOWER_HEIGHT = 1.4;
export const SOIL_TOP_Y = 0.06;
export const GROUND_Y = -0.31;
export const BOUNDS_Y_MAX = 1.55;
export const CAMERA_TARGET_Y = 0.65;
export const CAMERA_ELEVATION_DEG = 30;
export const BUILDING_CAMERA_ELEVATION_DEG = 38;
export const CAMERA_AZIMUTH_RAD = Math.PI / 4;
export const CAMERA_FOV_DEG = 40;
export const DEFAULT_VIEWPORT_HEIGHT = 844;
export const DEFAULT_VIEWPORT_WIDTH = 390;
/** ~178 CSS px flower at 390×844 home viewport; capped by fraction and absolute max. */
export const TARGET_FLOWER_SCREEN_PX = 178;
export const MAX_FLOWER_SCREEN_PX = 210;
export const MAX_FLOWER_VIEWPORT_FRACTION = 0.22;
/** ~168 CSS px flower above memory sheet (155–185 target band). */
export const MEMORY_TARGET_FLOWER_SCREEN_PX = 168;
export const MEMORY_MIN_FLOWER_VIEWPORT_FRACTION = 0.2;
export const MEMORY_MAX_FLOWER_SCREEN_PX = 195;
export const HOME_SCREEN_CENTER_FRACTION = 0.46;
export const MEMORY_SCREEN_CENTER_FRACTION = 0.33;
export const BUILDING_SCREEN_CENTER_FRACTION = 0.39;
export const CORNER_FIT_H_FILL = 0.88;
export const CORNER_FIT_V_FILL = 0.52;
export const CORNER_FIT_SAFETY = 1.03;

type Vec3 = [number, number, number];

function vec3Distance(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return Math.hypot(dx, dy, dz);
}

function vec3Add(a: Vec3, b: Vec3): Vec3 {
  return [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
}

function vec3Scale(v: Vec3, s: number): Vec3 {
  return [v[0] * s, v[1] * s, v[2] * s];
}

function dot(a: Vec3, b: Vec3): number {
  return a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
}

export function cameraPoseReached(
  position: Vec3,
  target: Vec3,
  goal: CameraPose,
  epsilon = CAMERA_CONVERGENCE_EPSILON,
): boolean {
  return (
    vec3Distance(position, goal.position) <= epsilon &&
    vec3Distance(target, goal.target) <= epsilon
  );
}

export function lerpVec3(from: Vec3, to: Vec3, alpha: number): Vec3 {
  return [
    from[0] + (to[0] - from[0]) * alpha,
    from[1] + (to[1] - from[1]) * alpha,
    from[2] + (to[2] - from[2]) * alpha,
  ];
}

export function stepCameraPose(
  position: Vec3,
  target: Vec3,
  goal: CameraPose,
  delta: number,
  speed = CAMERA_LERP_SPEED,
): { position: Vec3; target: Vec3; converged: boolean } {
  const alpha = Math.min(1, delta * speed);
  const nextPosition = lerpVec3(position, goal.position, alpha);
  const nextTarget = lerpVec3(target, goal.target, alpha);
  const converged = cameraPoseReached(nextPosition, nextTarget, goal);
  return {
    position: converged ? goal.position : nextPosition,
    target: converged ? goal.target : nextTarget,
    converged,
  };
}

export function resolveCameraFocusPlantId(
  plants: GardenPlant[],
  options: {
    viewingPlantId: string | null;
    viewingObservationId: string | null;
    lastAdmiredPlantId: string | null;
  },
): string | null {
  if (options.viewingPlantId && plants.some((p) => p.id === options.viewingPlantId)) {
    return options.viewingPlantId;
  }
  if (options.viewingObservationId) {
    return null;
  }
  if (
    options.lastAdmiredPlantId &&
    plants.some((p) => p.id === options.lastAdmiredPlantId)
  ) {
    return options.lastAdmiredPlantId;
  }
  return plants[0]?.id ?? null;
}

export function getSoilBounds(
  soilTiles: SoilTile[],
  addablePositions: { x: number; z: number }[] = [],
): {
  minX: number;
  maxX: number;
  minZ: number;
  maxZ: number;
  centerX: number;
  centerZ: number;
} {
  const xs = [...soilTiles.map((t) => t.x), ...addablePositions.map((p) => p.x)];
  const zs = [...soilTiles.map((t) => t.z), ...addablePositions.map((p) => p.z)];

  if (xs.length === 0) {
    return { minX: 0, maxX: 0, minZ: 0, maxZ: 0, centerX: 0, centerZ: 0 };
  }

  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minZ = Math.min(...zs);
  const maxZ = Math.max(...zs);
  return {
    minX,
    maxX,
    minZ,
    maxZ,
    centerX: (minX + maxX) / 2,
    centerZ: (minZ + maxZ) / 2,
  };
}

function fovRadians(fovDeg = CAMERA_FOV_DEG): number {
  return (fovDeg * Math.PI) / 180;
}

/** Outward-from-target camera basis: n, right, up. */
export function cameraBasis(
  azimuth = CAMERA_AZIMUTH_RAD,
  elevationRad = (CAMERA_ELEVATION_DEG * Math.PI) / 180,
): { n: Vec3; right: Vec3; up: Vec3 } {
  const cosAz = Math.cos(azimuth);
  const sinAz = Math.sin(azimuth);
  const cosElev = Math.cos(elevationRad);
  const sinElev = Math.sin(elevationRad);
  return {
    n: [cosAz * cosElev, sinElev, sinAz * cosElev],
    right: [sinAz, 0, -cosAz],
    up: [-cosAz * sinElev, cosElev, -sinAz * sinElev],
  };
}

/** World-space camera distance so an object of given height fills desired CSS pixels. */
export function distanceForScreenHeight(
  objectHeight: number,
  desiredScreenPx: number,
  viewportHeight: number,
  fovDeg = CAMERA_FOV_DEG,
): number {
  const visibleHeightAtUnitDistance = 2 * Math.tan(fovRadians(fovDeg) / 2);
  return (objectHeight * viewportHeight) / (desiredScreenPx * visibleHeightAtUnitDistance);
}

function gatherBoundsCorners(
  soilTiles: SoilTile[],
  addablePositions: { x: number; z: number }[],
  centerX: number,
  centerZ: number,
  targetY: number,
): Vec3[] {
  const half = TILE_SIZE / 2;
  const tileCenters = [
    ...soilTiles.map((t) => ({ x: t.x * TILE_SIZE, z: t.z * TILE_SIZE })),
    ...addablePositions.map((p) => ({ x: p.x * TILE_SIZE, z: p.z * TILE_SIZE })),
  ];
  const ys = [GROUND_Y, BOUNDS_Y_MAX];
  const corners: Vec3[] = [];

  const centers =
    tileCenters.length > 0 ? tileCenters : [{ x: centerX, z: centerZ }];

  for (const { x, z } of centers) {
    for (const dx of [-half, half]) {
      for (const dz of [-half, half]) {
        for (const y of ys) {
          corners.push([x + dx - centerX, y - targetY, z + dz - centerZ]);
        }
      }
    }
  }

  return corners;
}

function fitDistanceForPerspectiveCorners(
  corners: Vec3[],
  azimuth: number,
  elevationRad: number,
  aspect: number,
  fovDeg = CAMERA_FOV_DEG,
): number {
  const { n, right, up } = cameraBasis(azimuth, elevationRad);
  const vHalfTan = Math.tan(fovRadians(fovDeg) / 2);
  const hDenom = vHalfTan * Math.max(aspect, 0.35) * CORNER_FIT_H_FILL;
  const vDenom = vHalfTan * CORNER_FIT_V_FILL;

  let required = TILE_SIZE * 2.5;

  for (const r of corners) {
    const depth = dot(r, n);
    const hReq = depth + Math.abs(dot(r, right)) / hDenom;
    const vReq = depth + Math.abs(dot(r, up)) / vDenom;
    required = Math.max(required, hReq, vReq);
  }

  return required * CORNER_FIT_SAFETY;
}

/** Shift pose along screen-up so subject sits at desiredCenterFraction viewport height. */
export function applyVerticalScreenOffset(
  pose: CameraPose,
  distance: number,
  desiredCenterFraction: number,
  azimuth = CAMERA_AZIMUTH_RAD,
  elevationRad = (CAMERA_ELEVATION_DEG * Math.PI) / 180,
  fovDeg = CAMERA_FOV_DEG,
): CameraPose {
  const { up } = cameraBasis(azimuth, elevationRad);
  const amountWorld =
    (0.5 - desiredCenterFraction) * 2 * distance * Math.tan(fovRadians(fovDeg) / 2);
  const shift = vec3Scale(up, -amountWorld);
  return {
    position: vec3Add(pose.position, shift),
    target: vec3Add(pose.target, shift),
  };
}

/** Viewing azimuth: camera sits outside the focus tile relative to garden center. */
export function resolveViewingAzimuth(
  focusPx: number,
  focusPz: number,
  gardenCenterX: number,
  gardenCenterZ: number,
): number {
  const deltaX = focusPx - gardenCenterX;
  const deltaZ = focusPz - gardenCenterZ;
  const deltaLen = Math.hypot(deltaX, deltaZ);
  return deltaLen > 0.4 ? Math.atan2(deltaZ, deltaX) : CAMERA_AZIMUTH_RAD;
}

export function poseFromTarget(
  targetX: number,
  targetY: number,
  targetZ: number,
  distance: number,
  azimuth = CAMERA_AZIMUTH_RAD,
  elevationRad = (CAMERA_ELEVATION_DEG * Math.PI) / 180,
): CameraPose {
  const { n } = cameraBasis(azimuth, elevationRad);
  const offset = vec3Scale(n, distance);

  return {
    position: [targetX + offset[0], targetY + offset[1], targetZ + offset[2]],
    target: [targetX, targetY, targetZ],
  };
}

export function getBuildingCameraPose(
  soilTiles: SoilTile[],
  addablePositions: { x: number; z: number }[] = [],
  _viewportHeight = DEFAULT_VIEWPORT_HEIGHT,
  viewportAspect = DEFAULT_VIEWPORT_WIDTH / DEFAULT_VIEWPORT_HEIGHT,
): CameraPose {
  const bounds = getSoilBounds(soilTiles, addablePositions);
  const cx = bounds.centerX * TILE_SIZE;
  const cz = bounds.centerZ * TILE_SIZE;
  const targetY = 0.3;
  const elevationRad = (BUILDING_CAMERA_ELEVATION_DEG * Math.PI) / 180;
  const aspect = Math.max(viewportAspect, 0.35);

  const corners = gatherBoundsCorners(soilTiles, addablePositions, cx, cz, targetY);
  const distance = fitDistanceForPerspectiveCorners(
    corners,
    CAMERA_AZIMUTH_RAD,
    elevationRad,
    aspect,
  );

  const basePose = poseFromTarget(
    cx,
    targetY,
    cz,
    distance,
    CAMERA_AZIMUTH_RAD,
    elevationRad,
  );
  return applyVerticalScreenOffset(
    basePose,
    distance,
    BUILDING_SCREEN_CENTER_FRACTION,
    CAMERA_AZIMUTH_RAD,
    elevationRad,
  );
}

export function getViewingCameraPose(
  soilTiles: SoilTile[],
  focusPlant?: GardenPlant | null,
  options: {
    viewportHeight?: number;
    viewportAspect?: number;
    memoryPanelOpen?: boolean;
  } = {},
): CameraPose {
  const viewportHeight = options.viewportHeight ?? DEFAULT_VIEWPORT_HEIGHT;
  const memoryPanelOpen = options.memoryPanelOpen ?? false;
  const elevationRad = (CAMERA_ELEVATION_DEG * Math.PI) / 180;
  const screenCenterFraction = memoryPanelOpen
    ? MEMORY_SCREEN_CENTER_FRACTION
    : HOME_SCREEN_CENTER_FRACTION;

  const desiredFlowerPx = memoryPanelOpen
    ? Math.min(
        Math.max(
          MEMORY_TARGET_FLOWER_SCREEN_PX,
          viewportHeight * MEMORY_MIN_FLOWER_VIEWPORT_FRACTION,
        ),
        MEMORY_MAX_FLOWER_SCREEN_PX,
      )
    : Math.min(
        (TARGET_FLOWER_SCREEN_PX * viewportHeight) / DEFAULT_VIEWPORT_HEIGHT,
        viewportHeight * MAX_FLOWER_VIEWPORT_FRACTION,
        MAX_FLOWER_SCREEN_PX,
      );

  const offsetPose = (pose: CameraPose, distance: number, azimuth = CAMERA_AZIMUTH_RAD) =>
    applyVerticalScreenOffset(
      pose,
      distance,
      screenCenterFraction,
      azimuth,
      elevationRad,
    );

  if (!focusPlant) {
    const bounds = getSoilBounds(soilTiles);
    const cx = bounds.centerX * TILE_SIZE;
    const cz = bounds.centerZ * TILE_SIZE;
    const tileSpan = Math.max(
      (bounds.maxX - bounds.minX + 1) * TILE_SIZE,
      (bounds.maxZ - bounds.minZ + 1) * TILE_SIZE,
      TILE_SIZE * 2.5,
    );
    const distance = Math.max(
      distanceForScreenHeight(FLOWER_HEIGHT, desiredFlowerPx, viewportHeight),
      tileSpan * 1.1,
    );
    return offsetPose(poseFromTarget(cx, CAMERA_TARGET_Y, cz, distance), distance);
  }

  const tile = soilTiles.find((t) => t.id === focusPlant.tileId);
  if (!tile) {
    return getViewingCameraPose(soilTiles, null, options);
  }

  const bounds = getSoilBounds(soilTiles);
  const cx = bounds.centerX * TILE_SIZE;
  const cz = bounds.centerZ * TILE_SIZE;
  const px = tile.x * TILE_SIZE;
  const pz = tile.z * TILE_SIZE;
  const flowerHeight = getPlantModelHeight(focusPlant);
  const cameraTargetY = Math.min(
    CAMERA_TARGET_Y,
    SOIL_TOP_Y + flowerHeight * 0.42,
  );
  const distance = distanceForScreenHeight(flowerHeight, desiredFlowerPx, viewportHeight);
  const azimuth = resolveViewingAzimuth(px, pz, cx, cz);

  return offsetPose(
    poseFromTarget(px, cameraTargetY, pz, distance, azimuth, elevationRad),
    distance,
    azimuth,
  );
}

export function getCameraOrbitLimits(
  gardenPhase: 'viewing' | 'building',
  soilTiles: SoilTile[],
  addablePositions: { x: number; z: number }[] = [],
  options: {
    viewportHeight?: number;
    viewportAspect?: number;
    memoryPanelOpen?: boolean;
  } = {},
): { minDistance: number; maxDistance: number } {
  const viewportHeight = options.viewportHeight ?? DEFAULT_VIEWPORT_HEIGHT;
  const viewportAspect =
    options.viewportAspect ?? DEFAULT_VIEWPORT_WIDTH / DEFAULT_VIEWPORT_HEIGHT;

  if (gardenPhase === 'building') {
    const pose = getBuildingCameraPose(
      soilTiles,
      addablePositions,
      viewportHeight,
      viewportAspect,
    );
    const dist = vec3Distance(pose.position, pose.target);
    return {
      minDistance: Math.max(dist * 0.45, 2.5),
      maxDistance: dist * 2.4,
    };
  }

  const pose = getViewingCameraPose(soilTiles, null, {
    viewportHeight,
    viewportAspect,
    memoryPanelOpen: options.memoryPanelOpen,
  });
  const dist = vec3Distance(pose.position, pose.target);
  return {
    minDistance: Math.max(dist * 0.55, 2),
    maxDistance: dist * 1.85,
  };
}
