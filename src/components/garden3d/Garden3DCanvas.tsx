import { memo, Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { ContactShadows, OrbitControls } from '@react-three/drei';
import type { OrbitControls as OrbitControlsImpl } from 'three-stdlib';
import * as THREE from 'three';
import type {
  GardenEditMode,
  GardenDecoration,
  GardenDecorationType,
  GardenModelType,
  GardenPlant,
  GardenScreenPhase,
  SoilTile,
  TulipColor,
} from '../../types';
import {
  GROUND_Y,
  getBuildingCameraPose,
  getCameraOrbitLimits,
  getViewingCameraPose,
  stepCameraPose,
  type CameraPose,
} from '../../utils/gardenCamera';
import { DecorativeSky } from '../garden/DecorativeSky';
import type { SkyPeriod } from '../../utils/skyTime';
import { getTileElevation } from '../../utils/terrain';
import { getGardenShadowRevision } from '../../utils/gardenShadows';
import {
  GardenDecorationMesh,
  GardenPlantMesh,
  GhostTileMarker,
  SoilTileMesh,
  TILE_SIZE,
} from './ProceduralMeshes';
import styles from './Garden3DCanvas.module.css';

interface Garden3DCanvasProps {
  soilTiles: SoilTile[];
  plants: GardenPlant[];
  decorations: GardenDecoration[];
  gardenPhase: GardenScreenPhase;
  editMode: GardenEditMode;
  selectedTileId: string | null;
  selectedPlantId: string | null;
  selectedDecorationId?: string | null;
  focusPlantId: string | null;
  highlightPlantId: string | null;
  plantColor: TulipColor;
  addablePositions: { x: number; z: number }[];
  tulipUnlocked: boolean;
  plantingFlowActive?: boolean;
  pendingPlacementTileId?: string | null;
  pendingPlacementPreview?: {
    modelType: GardenModelType;
    color: TulipColor;
    rotation: number;
  } | null;
  pendingDecorationPreview?: {
    type: GardenDecorationType;
    rotation: number;
  } | null;
  memoryPanelOpen?: boolean;
  cameraResetKey?: number;
  bottomInsetPx?: number;
  skyPeriod: SkyPeriod;
  skyCloudMotionEnabled: boolean;
  skyTransitionsEnabled: boolean;
  onTileClick: (tileId: string) => void;
  onGhostTileClick: (x: number, z: number) => void;
  onPlantClick: (plantId: string) => void;
  onDecorationClick?: (decorationId: string) => void;
}

const TAP_THRESHOLD_PX = 12;
const GROUND_EXTENT = 48;
const SHADOW_PLANE_OPACITY = 0.1;

function CameraRig({
  gardenPhase,
  soilTiles,
  addablePositions,
  focusPlant,
  plants,
  decorations,
  cameraResetKey,
  bottomInsetPx,
  reducedMotion,
  memoryPanelOpen,
  viewportHeight,
  viewportAspect,
}: {
  gardenPhase: GardenScreenPhase;
  soilTiles: SoilTile[];
  addablePositions: { x: number; z: number }[];
  focusPlant: GardenPlant | null;
  plants: GardenPlant[];
  decorations: GardenDecoration[];
  cameraResetKey: number;
  bottomInsetPx?: number;
  reducedMotion: boolean;
  memoryPanelOpen: boolean;
  viewportHeight: number;
  viewportAspect: number;
}) {
  const { camera } = useThree();
  const controlsRef = useRef<OrbitControlsImpl>(null);
  const animatingRef = useRef(false);
  const goalPoseRef = useRef<CameraPose | null>(null);
  const manuallyMovedRef = useRef(false);
  const previousNavigationRef = useRef<string | null>(null);

  const targetPose = useMemo<CameraPose>(() => {
    if (gardenPhase === 'building') {
      return getBuildingCameraPose(soilTiles, addablePositions, viewportHeight, viewportAspect, { plants, decorations, bottomInsetPx });
    }
    return getViewingCameraPose(soilTiles, focusPlant, {
      viewportHeight,
      viewportAspect,
      memoryPanelOpen,
      plants, decorations, bottomInsetPx,
    });
  }, [gardenPhase, soilTiles, addablePositions, focusPlant, viewportHeight, viewportAspect, memoryPanelOpen, plants, decorations, bottomInsetPx]);

  const orbitLimits = useMemo(
    () =>
      getCameraOrbitLimits(gardenPhase, soilTiles, addablePositions, {
        viewportHeight,
        viewportAspect,
        memoryPanelOpen,
        plants, decorations, bottomInsetPx,
      }),
    [gardenPhase, soilTiles, addablePositions, viewportHeight, viewportAspect, memoryPanelOpen, plants, decorations, bottomInsetPx],
  );

  const applyPose = (pose: CameraPose) => {
    const [px, py, pz] = pose.position;
    const [tx, ty, tz] = pose.target;
    camera.position.set(px, py, pz);
    if (controlsRef.current) {
      controlsRef.current.target.set(tx, ty, tz);
      controlsRef.current.update();
    } else {
      camera.lookAt(tx, ty, tz);
    }
  };

  const navigationKey = `${gardenPhase}:${focusPlant?.id ?? 'overview'}:${memoryPanelOpen}:${cameraResetKey}:${viewportHeight}:${viewportAspect}:${bottomInsetPx ?? 0}`;
  useEffect(() => {
    const firstPose = previousNavigationRef.current === null;
    const navigationChanged = previousNavigationRef.current !== navigationKey;
    previousNavigationRef.current = navigationKey;
    if (navigationChanged) manuallyMovedRef.current = false;
    if (manuallyMovedRef.current) return;
    if (reducedMotion || firstPose) {
      animatingRef.current = false;
      goalPoseRef.current = null;
      applyPose(targetPose);
      return;
    }

    goalPoseRef.current = targetPose;
    animatingRef.current = true;
  }, [targetPose, reducedMotion, camera, navigationKey]);

  useFrame((_, delta) => {
    if (!animatingRef.current || reducedMotion || !goalPoseRef.current) return;

    const controls = controlsRef.current;
    const currentTarget: [number, number, number] = controls
      ? [controls.target.x, controls.target.y, controls.target.z]
      : [0, 0, 0];
    const currentPosition: [number, number, number] = [
      camera.position.x,
      camera.position.y,
      camera.position.z,
    ];

    const { position, target, converged } = stepCameraPose(
      currentPosition,
      currentTarget,
      goalPoseRef.current,
      delta,
    );

    camera.position.set(position[0], position[1], position[2]);
    if (controls) {
      controls.target.set(target[0], target[1], target[2]);
      controls.update();
    } else {
      camera.lookAt(target[0], target[1], target[2]);
    }

    if (converged) {
      animatingRef.current = false;
      goalPoseRef.current = null;
    }
  });

  const handleControlStart = () => {
    manuallyMovedRef.current = true;
    animatingRef.current = false;
    goalPoseRef.current = null;
  };

  return (
    <OrbitControls
      ref={controlsRef}
      enablePan={false}
      minDistance={orbitLimits.minDistance}
      maxDistance={orbitLimits.maxDistance}
      minPolarAngle={0.35}
      maxPolarAngle={Math.PI / 2.05}
      onStart={handleControlStart}
    />
  );
}

/**
 * Drei 10.7's frame counter resets on a component render. Memoization captures once
 * per geometry revision while keeping its render targets alive between edits.
 * A keyed remount would recreate those targets for every placement.
 */
const GardenContactShadows = memo(function GardenContactShadows({ centerX, centerZ }: {
  centerX: number;
  centerZ: number;
  revision: string;
}) {
  return (
    <ContactShadows
      frames={1}
      position={[centerX * TILE_SIZE, GROUND_Y + 0.002, centerZ * TILE_SIZE]}
      opacity={0.22}
      scale={16}
      blur={2.8}
      far={5}
      resolution={512}
      color="#5a4a52"
    />
  );
});

function GardenScene({
  soilTiles,
  plants,
  decorations,
  editMode,
  selectedTileId,
  selectedPlantId,
  selectedDecorationId,
  highlightPlantId,
  addablePositions,
  onTileClick,
  onGhostTileClick,
  onPlantClick,
  onDecorationClick,
  plantingFlowActive = false,
  pendingPlacementTileId = null,
  pendingPlacementPreview = null,
  pendingDecorationPreview = null,
}: Omit<
  Garden3DCanvasProps,
  | 'plantColor'
  | 'tulipUnlocked'
  | 'gardenPhase'
  | 'focusPlantId'
  | 'memoryPanelOpen'
  | 'skyPeriod'
  | 'skyCloudMotionEnabled'
  | 'skyTransitionsEnabled'
  | 'cameraResetKey'
  | 'bottomInsetPx'
>) {
  const plantTileIds = useMemo(() => new Set(plants.map((p) => p.tileId)), [plants]);
  const decorationTileIds = useMemo(
    () => new Set(decorations.map((decoration) => decoration.tileId)),
    [decorations],
  );
  const gardenCenter = useMemo(() => {
    if (soilTiles.length === 0) return [0, 0] as [number, number];
    const xs = soilTiles.map((t) => t.x);
    const zs = soilTiles.map((t) => t.z);
    return [(Math.min(...xs) + Math.max(...xs)) / 2, (Math.min(...zs) + Math.max(...zs)) / 2] as [
      number,
      number,
    ];
  }, [soilTiles]);

  const shadowRevision = getGardenShadowRevision({
    soilTiles, plants, decorations, editMode, plantingFlowActive, selectedTileId, selectedPlantId,
    selectedDecorationId, highlightPlantId, addablePositions,
    pendingPlacementTileId, pendingPlacementPreview, pendingDecorationPreview,
  });

  return (
    <>
      <ambientLight intensity={0.8} color="#f5f0f2" />
      <directionalLight
        position={[5, 9, 6]}
        intensity={2.2}
        color="#fff8ee"
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-left={-10}
        shadow-camera-right={10}
        shadow-camera-top={10}
        shadow-camera-bottom={-10}
        shadow-camera-near={0.5}
        shadow-camera-far={28}
        shadow-bias={-0.0004}
      />
      <directionalLight position={[-4, 5, -3]} intensity={0.5} color="#ded6d5" />
      <hemisphereLight args={['#f0e8f0', '#c8b8c0', 0.6]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, GROUND_Y, 0]} receiveShadow>
        <planeGeometry args={[GROUND_EXTENT * 2, GROUND_EXTENT * 2]} />
        <shadowMaterial transparent opacity={SHADOW_PLANE_OPACITY} color="#4a3a42" />
      </mesh>

      <GardenContactShadows
        centerX={gardenCenter[0]}
        centerZ={gardenCenter[1]}
        revision={shadowRevision}
      />

      {soilTiles.map((tile) => {
        const hasPlant = plantTileIds.has(tile.id);
        const occupied = hasPlant || decorationTileIds.has(tile.id);
        let highlight: 'add' | 'remove' | 'plant' | 'move' | null = null;
        if (editMode === 'remove-soil' || editMode === 'lower-terrain') highlight = 'remove';
        if (editMode === 'raise-terrain') highlight = 'add';
        if ((editMode === 'plant' || editMode === 'place-decoration' || plantingFlowActive) && !occupied) highlight = 'plant';
        if (editMode === 'move' && !occupied) highlight = 'move';

        const plant = plants.find((p) => p.tileId === tile.id);
        const tileY = 0.06 + getTileElevation(tile);
        const terrainTool = ['paint-surface', 'raise-terrain', 'lower-terrain', 'remove-soil'].includes(editMode);

        return (
          <group key={tile.id}>
            <SoilTileMesh
              x={tile.x}
              z={tile.z}
              surface={tile.surface}
              height={tile.height}
              selected={selectedTileId === tile.id}
              highlight={highlight}
              onClick={() => onTileClick(tile.id)}
            />
            {plant && (
              <group position={[tile.x * TILE_SIZE, tileY, tile.z * TILE_SIZE]}>
                <GardenPlantMesh
                  plant={plant}
                  selected={
                    highlightPlantId === plant.id ||
                    (editMode !== 'view' && selectedPlantId === plant.id)
                  }
                  onClick={() => terrainTool ? onTileClick(tile.id) : onPlantClick(plant.id)}
                />
              </group>
            )}
            {decorations.filter((item) => item.tileId === tile.id).map((decoration) => (
              <group key={decoration.id} position={[tile.x * TILE_SIZE, tileY, tile.z * TILE_SIZE]}>
                <GardenDecorationMesh
                  decoration={decoration}
                  selected={selectedDecorationId === decoration.id}
                  onClick={() => terrainTool ? onTileClick(tile.id) : onDecorationClick?.(decoration.id)}
                />
              </group>
            ))}
            {pendingPlacementTileId === tile.id && pendingPlacementPreview && !occupied && (
              <group position={[tile.x * TILE_SIZE, tileY, tile.z * TILE_SIZE]}>
                <GardenPlantMesh
                  plant={{
                    color: pendingPlacementPreview.color,
                    rotation: pendingPlacementPreview.rotation,
                    modelType: pendingPlacementPreview.modelType,
                  }}
                  ghost
                  selected
                />
              </group>
            )}
            {pendingPlacementTileId === tile.id && pendingDecorationPreview && !occupied && (
              <group position={[tile.x * TILE_SIZE, tileY, tile.z * TILE_SIZE]}>
                <GardenDecorationMesh
                  decoration={pendingDecorationPreview}
                  ghost
                  selected
                />
              </group>
            )}
          </group>
        );
      })}

      {editMode === 'add-soil' &&
        addablePositions.map((pos) => (
          <group
            key={`ghost-${pos.x}-${pos.z}`}
            onClick={(e) => {
              e.stopPropagation();
              onGhostTileClick(pos.x, pos.z);
            }}
          >
            <GhostTileMarker x={pos.x} z={pos.z} />
          </group>
        ))}
    </>
  );
}

export function Garden3DCanvas({
  gardenPhase,
  soilTiles,
  plants,
  focusPlantId,
  highlightPlantId,
  memoryPanelOpen = false,
  cameraResetKey = 0,
  bottomInsetPx,
  skyPeriod,
  skyCloudMotionEnabled,
  skyTransitionsEnabled,
  addablePositions,
  ...sceneProps
}: Garden3DCanvasProps) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const pointerStart = useRef<{ x: number; y: number } | null>(null);
  const dragging = useRef(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [viewportSize, setViewportSize] = useState(() => {
    if (typeof window !== 'undefined') {
      return { height: window.innerHeight, width: window.innerWidth };
    }
    return { height: 844, width: 390 };
  });
  const viewportHeight = viewportSize.height;
  const viewportAspect = viewportSize.width / Math.max(viewportSize.height, 1);

  const focusPlant = useMemo(
    () => (focusPlantId ? plants.find((p) => p.id === focusPlantId) ?? null : null),
    [focusPlantId, plants],
  );

  useEffect(() => {
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    setReducedMotion(mq.matches);
    const handler = (e: MediaQueryListEvent) => setReducedMotion(e.matches);
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  useEffect(() => {
    const node = wrapRef.current;
    if (!node || typeof ResizeObserver === 'undefined') return;

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (entry) {
        setViewportSize({
          height: entry.contentRect.height,
          width: entry.contentRect.width,
        });
      }
    });
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  const handlePointerDown = (e: React.PointerEvent) => {
    pointerStart.current = { x: e.clientX, y: e.clientY };
    dragging.current = false;
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!pointerStart.current) return;
    const dx = e.clientX - pointerStart.current.x;
    const dy = e.clientY - pointerStart.current.y;
    if (Math.hypot(dx, dy) > TAP_THRESHOLD_PX) {
      dragging.current = true;
    }
  };

  const handlePointerUp = () => {
    pointerStart.current = null;
    setTimeout(() => {
      dragging.current = false;
    }, 0);
  };

  const handlePlantClick = (plantId: string) => {
    if (dragging.current) return;
    sceneProps.onPlantClick(plantId);
  };

  const handleTileClick = (tileId: string) => {
    if (dragging.current) return;
    sceneProps.onTileClick(tileId);
  };

  const handleDecorationClick = (decorationId: string) => {
    if (dragging.current) return;
    sceneProps.onDecorationClick?.(decorationId);
  };

  const handleGhostClick = (x: number, z: number) => {
    if (dragging.current) return;
    sceneProps.onGhostTileClick(x, z);
  };

  return (
    <div
      ref={wrapRef}
      className={styles.canvasWrap}
      aria-label="3D庭"
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
    >
      <DecorativeSky
        period={skyPeriod}
        cloudMotionEnabled={skyCloudMotionEnabled}
        transitionsEnabled={skyTransitionsEnabled}
      />
      <Canvas
        shadows
        dpr={[1, 2]}
        camera={{ position: [3.5, 3.2, 3.5], fov: 40 }}
        gl={{
          antialias: true,
          alpha: true,
          powerPreference: 'high-performance',
        }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.98;
          gl.outputColorSpace = THREE.SRGBColorSpace;
          gl.shadowMap.type = THREE.PCFSoftShadowMap;
        }}
      >
        <Suspense fallback={null}>
          <GardenScene
            soilTiles={soilTiles}
            plants={plants}
            highlightPlantId={highlightPlantId}
            addablePositions={addablePositions}
            {...sceneProps}
            onPlantClick={handlePlantClick}
            onDecorationClick={handleDecorationClick}
            onTileClick={handleTileClick}
            onGhostTileClick={handleGhostClick}
          />
          <CameraRig
            gardenPhase={gardenPhase}
            soilTiles={soilTiles}
            addablePositions={addablePositions}
            focusPlant={focusPlant}
            plants={plants}
            decorations={sceneProps.decorations}
            cameraResetKey={cameraResetKey}
            bottomInsetPx={bottomInsetPx}
            reducedMotion={reducedMotion}
            memoryPanelOpen={memoryPanelOpen}
            viewportHeight={viewportHeight}
            viewportAspect={viewportAspect}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
