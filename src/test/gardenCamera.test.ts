import { describe, it, expect } from 'vitest';
import * as THREE from 'three';
import type { GardenPlant, SoilTile } from '../types';
import { createDefaultSoilTiles } from '../storage/migration';
import {
  CAMERA_FOV_DEG,
  DEFAULT_VIEWPORT_HEIGHT,
  DEFAULT_VIEWPORT_WIDTH,
  FLOWER_HEIGHT,
  GROUND_Y,
  BOUNDS_Y_MAX,
  SOIL_TOP_Y,
  cameraPoseReached,
  getBuildingCameraPose,
  getCameraOrbitLimits,
  getViewingCameraPose,
  getSoilBounds,
  resolveCameraFocusPlantId,
  resolveViewingAzimuth,
  stepCameraPose,
  type CameraPose,
} from '../utils/gardenCamera';
import { TILE_SIZE as MESH_TILE_SIZE } from '../components/garden3d/ProceduralMeshes';

const plants: GardenPlant[] = [
  { id: 'plant-a', color: 'red', tileId: 'soil-0-0', rotation: 0 },
  { id: 'plant-b', color: 'yellow', tileId: 'soil-1-0', rotation: 0 },
];

function projectToScreen(
  point: [number, number, number],
  pose: CameraPose,
  viewportWidth: number,
  viewportHeight: number,
  fovDeg = CAMERA_FOV_DEG,
): { x: number; y: number } {
  const camera = new THREE.PerspectiveCamera(
    fovDeg,
    viewportWidth / viewportHeight,
    0.1,
    200,
  );
  camera.position.set(pose.position[0], pose.position[1], pose.position[2]);
  camera.lookAt(pose.target[0], pose.target[1], pose.target[2]);
  camera.updateMatrixWorld(true);

  const projected = new THREE.Vector3(point[0], point[1], point[2]);
  projected.project(camera);
  return {
    x: ((projected.x + 1) / 2) * viewportWidth,
    y: ((1 - projected.y) / 2) * viewportHeight,
  };
}

function projectedSpanPx(
  points: [number, number, number][],
  pose: CameraPose,
  viewportWidth: number,
  viewportHeight: number,
): { width: number; height: number } {
  const screens = points.map((p) => projectToScreen(p, pose, viewportWidth, viewportHeight));
  const xs = screens.map((s) => s.x);
  const ys = screens.map((s) => s.y);
  return {
    width: Math.max(...xs) - Math.min(...xs),
    height: Math.max(...ys) - Math.min(...ys),
  };
}

function gardenCornerPoints(soilTiles: SoilTile[]): [number, number, number][] {
  const half = MESH_TILE_SIZE / 2;
  const points: [number, number, number][] = [];
  for (const tile of soilTiles) {
    const cx = tile.x * MESH_TILE_SIZE;
    const cz = tile.z * MESH_TILE_SIZE;
    for (const dx of [-half, half]) {
      for (const dz of [-half, half]) {
        for (const y of [GROUND_Y, BOUNDS_Y_MAX]) {
          points.push([cx + dx, y, cz + dz]);
        }
      }
    }
  }
  return points;
}

describe('gardenCamera', () => {
  it('steps toward a goal and converges', () => {
    const goal = {
      position: [1, 2, 3] as [number, number, number],
      target: [0, 0.5, 0] as [number, number, number],
    };
    let position: [number, number, number] = [0, 0, 0];
    let target: [number, number, number] = [0, 0, 0];
    let converged = false;

    for (let i = 0; i < 200 && !converged; i += 1) {
      const step = stepCameraPose(position, target, goal, 0.05);
      position = step.position;
      target = step.target;
      converged = step.converged;
    }

    expect(converged).toBe(true);
    expect(cameraPoseReached(position, target, goal)).toBe(true);
  });

  it('keeps home admiration on last admired or first flower', () => {
    expect(
      resolveCameraFocusPlantId(plants, {
        viewingPlantId: null,
        viewingObservationId: null,
        lastAdmiredPlantId: 'plant-b',
      }),
    ).toBe('plant-b');

    expect(
      resolveCameraFocusPlantId(plants, {
        viewingPlantId: null,
        viewingObservationId: null,
        lastAdmiredPlantId: null,
      }),
    ).toBe('plant-a');
  });

  it('does not focus an unrelated flower for unlinked observations', () => {
    expect(
      resolveCameraFocusPlantId(plants, {
        viewingPlantId: null,
        viewingObservationId: 'obs-unlinked',
        lastAdmiredPlantId: 'plant-b',
      }),
    ).toBeNull();
  });

  it('frames the building garden large enough on a 390×844 viewport', () => {
    const soilTiles = createDefaultSoilTiles();
    const aspect = DEFAULT_VIEWPORT_WIDTH / DEFAULT_VIEWPORT_HEIGHT;
    const pose = getBuildingCameraPose(soilTiles, [], DEFAULT_VIEWPORT_HEIGHT, aspect);
    const corners = gardenCornerPoints(soilTiles);
    const span = projectedSpanPx(
      corners,
      pose,
      DEFAULT_VIEWPORT_WIDTH,
      DEFAULT_VIEWPORT_HEIGHT,
    );

    expect(span.width).toBeGreaterThan(240);
    expect(span.height).toBeGreaterThan(180);

    const bounds = soilTiles.reduce(
      (acc, t) => ({
        cx: acc.cx + t.x,
        cz: acc.cz + t.z,
      }),
      { cx: 0, cz: 0 },
    );
    const center = projectToScreen(
      [
        (bounds.cx / soilTiles.length) * MESH_TILE_SIZE,
        0.3,
        (bounds.cz / soilTiles.length) * MESH_TILE_SIZE,
      ],
      pose,
      DEFAULT_VIEWPORT_WIDTH,
      DEFAULT_VIEWPORT_HEIGHT,
    );
    expect(center.y / DEFAULT_VIEWPORT_HEIGHT).toBeGreaterThan(0.32);
    expect(center.y / DEFAULT_VIEWPORT_HEIGHT).toBeLessThan(0.46);
  });

  it('places off-center focus camera outward from garden center so flower is foreground', () => {
    const soilTiles = createDefaultSoilTiles();
    const focus = plants[1];
    const tile = soilTiles.find((t) => t.id === focus.tileId)!;
    const bounds = getSoilBounds(soilTiles);
    const cx = bounds.centerX * MESH_TILE_SIZE;
    const cz = bounds.centerZ * MESH_TILE_SIZE;
    const px = tile.x * MESH_TILE_SIZE;
    const pz = tile.z * MESH_TILE_SIZE;
    const deltaX = px - cx;
    const deltaZ = pz - cz;
    const deltaLen = Math.hypot(deltaX, deltaZ);
    expect(deltaLen).toBeGreaterThan(0.4);

    const azimuth = resolveViewingAzimuth(px, pz, cx, cz);
    expect(azimuth).toBeCloseTo(Math.atan2(deltaZ, deltaX), 5);

    const aspect = DEFAULT_VIEWPORT_WIDTH / DEFAULT_VIEWPORT_HEIGHT;
    const pose = getViewingCameraPose(soilTiles, focus, {
      viewportHeight: DEFAULT_VIEWPORT_HEIGHT,
      viewportAspect: aspect,
      memoryPanelOpen: false,
    });

    const offsetX = pose.position[0] - pose.target[0];
    const offsetZ = pose.position[2] - pose.target[2];
    const offsetLen = Math.hypot(offsetX, offsetZ);
    expect(offsetLen).toBeGreaterThan(0.5);
    const alignment =
      (offsetX / offsetLen) * (deltaX / deltaLen) +
      (offsetZ / offsetLen) * (deltaZ / deltaLen);
    expect(alignment).toBeGreaterThan(0.95);
  });

  it('sizes the home flower smaller with garden context and centers it around 46% height at 390×844', () => {
    const soilTiles = createDefaultSoilTiles();
    const focus = plants[0];
    const aspect = DEFAULT_VIEWPORT_WIDTH / DEFAULT_VIEWPORT_HEIGHT;
    const pose = getViewingCameraPose(soilTiles, focus, {
      viewportHeight: DEFAULT_VIEWPORT_HEIGHT,
      viewportAspect: aspect,
      memoryPanelOpen: false,
    });

    const flowerCenterY = SOIL_TOP_Y + FLOWER_HEIGHT / 2;
    const top = projectToScreen(
      [0, SOIL_TOP_Y + FLOWER_HEIGHT, 0],
      pose,
      DEFAULT_VIEWPORT_WIDTH,
      DEFAULT_VIEWPORT_HEIGHT,
    );
    const bottom = projectToScreen(
      [0, SOIL_TOP_Y, 0],
      pose,
      DEFAULT_VIEWPORT_WIDTH,
      DEFAULT_VIEWPORT_HEIGHT,
    );
    const center = projectToScreen(
      [0, flowerCenterY, 0],
      pose,
      DEFAULT_VIEWPORT_WIDTH,
      DEFAULT_VIEWPORT_HEIGHT,
    );
    const gardenSpan = projectedSpanPx(
      gardenCornerPoints(soilTiles),
      pose,
      DEFAULT_VIEWPORT_WIDTH,
      DEFAULT_VIEWPORT_HEIGHT,
    );

    const flowerPx = Math.abs(top.y - bottom.y);
    expect(flowerPx).toBeGreaterThan(145);
    expect(flowerPx).toBeLessThan(175);
    expect(center.y / DEFAULT_VIEWPORT_HEIGHT).toBeGreaterThan(0.4);
    expect(center.y / DEFAULT_VIEWPORT_HEIGHT).toBeLessThan(0.52);
    expect(top.y).toBeGreaterThan(72);
    expect(bottom.y).toBeLessThan(DEFAULT_VIEWPORT_HEIGHT - 96);
    expect(gardenSpan.width).toBeGreaterThan(420);
    expect(gardenSpan.height).toBeGreaterThan(260);
  });

  it('sizes the memory flower smaller and lifts it above the sheet at 390×844', () => {
    const soilTiles = createDefaultSoilTiles();
    const focus = plants[0];
    const aspect = DEFAULT_VIEWPORT_WIDTH / DEFAULT_VIEWPORT_HEIGHT;
    const pose = getViewingCameraPose(soilTiles, focus, {
      viewportHeight: DEFAULT_VIEWPORT_HEIGHT,
      viewportAspect: aspect,
      memoryPanelOpen: true,
    });

    const flowerCenterY = SOIL_TOP_Y + FLOWER_HEIGHT / 2;
    const top = projectToScreen(
      [0, SOIL_TOP_Y + FLOWER_HEIGHT, 0],
      pose,
      DEFAULT_VIEWPORT_WIDTH,
      DEFAULT_VIEWPORT_HEIGHT,
    );
    const bottom = projectToScreen(
      [0, SOIL_TOP_Y, 0],
      pose,
      DEFAULT_VIEWPORT_WIDTH,
      DEFAULT_VIEWPORT_HEIGHT,
    );
    const center = projectToScreen(
      [0, flowerCenterY, 0],
      pose,
      DEFAULT_VIEWPORT_WIDTH,
      DEFAULT_VIEWPORT_HEIGHT,
    );
    const gardenSpan = projectedSpanPx(
      gardenCornerPoints(soilTiles),
      pose,
      DEFAULT_VIEWPORT_WIDTH,
      DEFAULT_VIEWPORT_HEIGHT,
    );

    const flowerPx = Math.abs(top.y - bottom.y);
    expect(flowerPx).toBeGreaterThan(140);
    expect(flowerPx).toBeLessThan(175);
    expect(center.y / DEFAULT_VIEWPORT_HEIGHT).toBeGreaterThan(0.27);
    expect(center.y / DEFAULT_VIEWPORT_HEIGHT).toBeLessThan(0.39);
    expect(top.y).toBeGreaterThan(48);
    expect(bottom.y).toBeLessThan(DEFAULT_VIEWPORT_HEIGHT * 0.58);
    expect(gardenSpan.width).toBeGreaterThan(400);
  });

  it('keeps fitted building and viewing poses inside orbit limits on desktop', () => {
    const soilTiles = createDefaultSoilTiles();
    const desktopWidth = 1100;
    const desktopHeight = 900;
    const aspect = desktopWidth / desktopHeight;

    const buildingPose = getBuildingCameraPose(soilTiles, [], desktopHeight, aspect);
    const buildingLimits = getCameraOrbitLimits('building', soilTiles, [], {
      viewportHeight: desktopHeight,
      viewportAspect: aspect,
    });
    const buildingDist = Math.hypot(
      buildingPose.position[0] - buildingPose.target[0],
      buildingPose.position[1] - buildingPose.target[1],
      buildingPose.position[2] - buildingPose.target[2],
    );
    expect(buildingDist).toBeGreaterThanOrEqual(buildingLimits.minDistance);
    expect(buildingDist).toBeLessThanOrEqual(buildingLimits.maxDistance);

    const viewingPose = getViewingCameraPose(soilTiles, plants[0], {
      viewportHeight: desktopHeight,
      viewportAspect: aspect,
      memoryPanelOpen: false,
    });
    const viewingLimits = getCameraOrbitLimits('viewing', soilTiles, [], {
      viewportHeight: desktopHeight,
      viewportAspect: aspect,
    });
    const viewingDist = Math.hypot(
      viewingPose.position[0] - viewingPose.target[0],
      viewingPose.position[1] - viewingPose.target[1],
      viewingPose.position[2] - viewingPose.target[2],
    );
    expect(viewingDist).toBeGreaterThanOrEqual(viewingLimits.minDistance);
    expect(viewingDist).toBeLessThanOrEqual(viewingLimits.maxDistance);

    const corners = gardenCornerPoints(soilTiles);
    const span = projectedSpanPx(corners, buildingPose, desktopWidth, desktopHeight);
    expect(span.width).toBeGreaterThan(320);
  });
});
