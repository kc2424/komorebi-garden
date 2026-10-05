import type { GardenDecoration, GardenPlant, SoilTile } from '../types';
import { TILE_SIZE } from '../components/garden3d/ProceduralMeshes';
import { getPlantModelHeight } from './plantModel';
import { getTileElevation } from './terrain';
import { getDecorationCatalogEntry } from '../data/decorationCatalog';

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
export const OVERVIEW_CAMERA_ELEVATION_DEG = 38;
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

export interface GardenCameraContent {
  plants?: GardenPlant[];
  decorations?: GardenDecoration[];
  /** UI inset measured from the canvas bottom; excludes scene from the tool tray. */
  bottomInsetPx?: number;
  topInsetPx?: number;
}

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
  const nextTarget = lerpVec3(target, goal.target, alpha);
  const offset: Vec3 = [position[0] - target[0], position[1] - target[1], position[2] - target[2]];
  const goalOffset: Vec3 = [goal.position[0] - goal.target[0], goal.position[1] - goal.target[1], goal.position[2] - goal.target[2]];
  const radius = Math.hypot(...offset);
  const goalRadius = Math.hypot(...goalOffset);
  const direction = radius > 1e-9 ? offset : goalOffset;
  const goalDirection = goalRadius > 1e-9 ? goalOffset : direction;
  const azimuth = Math.atan2(direction[2], direction[0]);
  const goalAzimuth = Math.atan2(goalDirection[2], goalDirection[0]);
  const azimuthDelta = Math.atan2(Math.sin(goalAzimuth - azimuth), Math.cos(goalAzimuth - azimuth));
  const elevation = Math.atan2(direction[1], Math.hypot(direction[0], direction[2]));
  const goalElevation = Math.atan2(goalDirection[1], Math.hypot(goalDirection[0], goalDirection[2]));
  const nextRadius = radius + (goalRadius - radius) * alpha;
  const nextAzimuth = azimuth + azimuthDelta * alpha;
  const nextElevation = elevation + (goalElevation - elevation) * alpha;
  // A straight position lerp cuts through the target when the views face opposite
  // directions. Orbit around the moving target while keeping its radius instead.
  const nextPosition = vec3Add(nextTarget, vec3Scale(cameraBasis(nextAzimuth, nextElevation).n, nextRadius));
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
  // An overview never silently inherits the first or last admired plant.
  return null;
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

function tileContentTop(tile: SoilTile, content: GardenCameraContent): number {
  const plant = content.plants?.find((item) => item.tileId === tile.id);
  const decoration = content.decorations?.find((item) => item.tileId === tile.id);
  const legacyBounds = content.plants === undefined && content.decorations === undefined;
  const itemHeight = Math.max(
    plant ? getPlantModelHeight(plant) : 0,
    decoration ? getDecorationCatalogEntry(decoration.type).height : 0,
    legacyBounds ? BOUNDS_Y_MAX - SOIL_TOP_Y : 0.08,
  );
  return getTileElevation(tile) + SOIL_TOP_Y + itemHeight;
}

function sceneTargetY(soilTiles: SoilTile[], content: GardenCameraContent): number {
  const highestPoint = Math.max(SOIL_TOP_Y, ...soilTiles.map((tile) => tileContentTop(tile, content)));
  return Math.max(0.12, (GROUND_Y + highestPoint) / 2);
}

function gatherBoundsCorners(
  soilTiles: SoilTile[],
  addablePositions: { x: number; z: number }[],
  centerX: number,
  centerZ: number,
  targetY: number,
  content: GardenCameraContent = {},
): Vec3[] {
  const corners: Vec3[] = [];
  const tiles = soilTiles.length > 0 || addablePositions.length > 0
    ? [...soilTiles, ...addablePositions.map((position) => ({ ...position, id: '' }))]
    : [{ id: '', x: centerX / TILE_SIZE, z: centerZ / TILE_SIZE }];
  for (const tile of tiles) {
    const occupied = content.plants?.some((plant) => plant.tileId === tile.id)
      || content.decorations?.some((decoration) => decoration.tileId === tile.id);
    const half = occupied ? TILE_SIZE * 0.72 : TILE_SIZE / 2;
    const top = tileContentTop(tile, content);
    for (const dx of [-half, half]) {
      for (const dz of [-half, half]) {
        for (const y of [GROUND_Y, top]) {
          corners.push([tile.x * TILE_SIZE + dx - centerX, y - targetY, tile.z * TILE_SIZE + dz - centerZ]);
        }
      }
    }
  }
  return corners;
}

function usableFrame(
  viewportHeight: number,
  content: GardenCameraContent,
  defaultCenter: number,
  defaultFill: number,
): { center: number; fill: number } {
  if (content.bottomInsetPx === undefined) return { center: defaultCenter, fill: defaultFill };
  const top = Math.max(content.topInsetPx ?? 82, 12);
  const bottom = Math.min(content.bottomInsetPx + 16, viewportHeight - top - 100);
  const height = Math.max(100, viewportHeight - top - bottom);
  return {
    center: (top + height / 2) / viewportHeight,
    fill: Math.min(0.86, height / viewportHeight * 0.9),
  };
}

function fitDistanceForPerspectiveCorners(
  corners: Vec3[],
  azimuth: number,
  elevationRad: number,
  aspect: number,
  fovDeg = CAMERA_FOV_DEG,
  verticalFill = CORNER_FIT_V_FILL,
): number {
  const { n, right, up } = cameraBasis(azimuth, elevationRad);
  const vHalfTan = Math.tan(fovRadians(fovDeg) / 2);
  const hDenom = vHalfTan * Math.max(aspect, 0.35) * CORNER_FIT_H_FILL;
  const vDenom = vHalfTan * verticalFill;

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
  viewportHeight = DEFAULT_VIEWPORT_HEIGHT,
  viewportAspect = DEFAULT_VIEWPORT_WIDTH / DEFAULT_VIEWPORT_HEIGHT,
  content: GardenCameraContent = {},
): CameraPose {
  const bounds = getSoilBounds(soilTiles, addablePositions);
  const cx = bounds.centerX * TILE_SIZE;
  const cz = bounds.centerZ * TILE_SIZE;
  const targetY = content.plants !== undefined ? sceneTargetY(soilTiles, content) : 0.3;
  const elevationRad = (BUILDING_CAMERA_ELEVATION_DEG * Math.PI) / 180;
  const aspect = Math.max(viewportAspect, 0.35);

  const frame = usableFrame(viewportHeight, content, BUILDING_SCREEN_CENTER_FRACTION, CORNER_FIT_V_FILL);
  const corners = gatherBoundsCorners(soilTiles, addablePositions, cx, cz, targetY, content);
  const distance = fitDistanceForPerspectiveCorners(
    corners,
    CAMERA_AZIMUTH_RAD,
    elevationRad,
    aspect,
    CAMERA_FOV_DEG,
    frame.fill,
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
    frame.center,
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
  } & GardenCameraContent = {},
): CameraPose {
  const viewportHeight = options.viewportHeight ?? DEFAULT_VIEWPORT_HEIGHT;
  const memoryPanelOpen = options.memoryPanelOpen ?? false;
  const elevationRad = (CAMERA_ELEVATION_DEG * Math.PI) / 180;
  const screenCenterFraction = usableFrame(
    viewportHeight, options,
    memoryPanelOpen ? MEMORY_SCREEN_CENTER_FRACTION : HOME_SCREEN_CENTER_FRACTION,
    0.64,
  ).center;

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
    const targetY = sceneTargetY(soilTiles, options);
    const overviewElevation = OVERVIEW_CAMERA_ELEVATION_DEG * Math.PI / 180;
    const frame = usableFrame(viewportHeight, options, HOME_SCREEN_CENTER_FRACTION, 0.64);
    const corners = gatherBoundsCorners(soilTiles, [], cx, cz, targetY, options);
    const distance = fitDistanceForPerspectiveCorners(
      corners, CAMERA_AZIMUTH_RAD, overviewElevation,
      options.viewportAspect ?? DEFAULT_VIEWPORT_WIDTH / DEFAULT_VIEWPORT_HEIGHT,
      CAMERA_FOV_DEG, frame.fill,
    );
    return applyVerticalScreenOffset(
      poseFromTarget(cx, targetY, cz, distance, CAMERA_AZIMUTH_RAD, overviewElevation),
      distance, frame.center, CAMERA_AZIMUTH_RAD, overviewElevation,
    );
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
  const cameraTargetY = getTileElevation(tile) + Math.min(
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
  } & GardenCameraContent = {},
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
      options,
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
    ...options,
    memoryPanelOpen: options.memoryPanelOpen,
  });
  const dist = vec3Distance(pose.position, pose.target);
  return {
    minDistance: 1.3,
    maxDistance: dist * 1.85,
  };
}
