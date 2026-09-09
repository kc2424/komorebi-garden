import { useMemo, useRef } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { GardenModelType, GardenPlant, TulipColor } from '../../types';
import { tulipColorHex } from '../../data/tulip';
import { resolvePlantModelType } from '../../utils/plantModel';
import { PREVIEW_YAW } from '../../utils/previewCamera';
import {
  getCosmosCenterGeometry,
  getCosmosLeafGeometry,
  getCosmosLeafPlacements,
  getCosmosPetalGeometry,
  getCosmosPetalRotations,
  getCosmosStemGeometry,
} from './cosmosGeometry';
import {
  getPansyCalyxGeometry,
  getPansyFoliageGeometry,
  getPansyPetalGeometry,
  getPansyPetalSpecs,
  getPansyStemGeometry,
  PANSY_FLOWER_CENTER_Y,
} from './pansyGeometry';
import {
  createEarthMaterial,
  createGhostMaterial,
  createGrassMaterial,
  createLeafMaterial,
  createPetalMaterial,
  createStemMaterial,
  createTurfMaterial,
} from './proceduralMaterials';
import { getGrassTuftsGeometry, getTurfCapGeometry, TURF_RING_Y } from './terrainGeometry';
import {
  getTulipLeafGeometry,
  getTulipPetalGeometry,
  getTulipPetalRotations,
  getTulipStemGeometry,
} from './tulipGeometry';

const TILE_SIZE = 1;
const SOIL_WIDTH = 0.98;
const SOIL_HEIGHT = 0.34;
const SOIL_RADIUS = 0.07;
const SOIL_CENTER_Y = -0.13;
const SOIL_TOP_Y = 0.06;
const TULIP_ROOT_Y = SOIL_TOP_Y;

/** 3D blossom tint — saved enum unchanged; pink maps to warm coral for rendering. */
function tulipRenderColorHex(color: TulipColor): string {
  if (color === 'pink') return '#ec9ca4';
  return tulipColorHex(color);
}

interface SoilTileMeshProps {
  x: number;
  z: number;
  selected?: boolean;
  highlight?: 'add' | 'remove' | 'plant' | 'move' | null;
  onClick?: () => void;
}

export function SoilTileMesh({ x, z, selected, highlight, onClick }: SoilTileMeshProps) {
  const groupRef = useRef<THREE.Group>(null);

  const earthMaterial = useMemo(() => createEarthMaterial(), []);
  const turfMaterial = useMemo(() => createTurfMaterial(), []);
  const grassMaterial = useMemo(() => createGrassMaterial(), []);
  const turfGeometry = useMemo(() => getTurfCapGeometry(), []);
  const grassGeometry = useMemo(() => getGrassTuftsGeometry(x, z), [x, z]);

  const showRing =
    selected ||
    highlight === 'add' ||
    highlight === 'plant' ||
    highlight === 'move' ||
    highlight === 'remove';

  const ringColor =
    highlight === 'remove'
      ? '#d4a0a8'
      : highlight === 'add'
        ? '#e8d4a0'
        : '#e8d4a0';
  const ringOpacity = highlight === 'remove' ? 0.42 : 0.5;

  return (
    <group ref={groupRef} position={[x * TILE_SIZE, 0, z * TILE_SIZE]}>
      <RoundedBox
        args={[SOIL_WIDTH, SOIL_HEIGHT, SOIL_WIDTH]}
        radius={SOIL_RADIUS}
        smoothness={6}
        position={[0, SOIL_CENTER_Y, 0]}
        material={earthMaterial}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      />

      <mesh geometry={turfGeometry} material={turfMaterial} castShadow receiveShadow />

      <mesh geometry={grassGeometry} material={grassMaterial} />

      {showRing && (
        <mesh position={[0, TURF_RING_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.28, 32]} />
          <meshBasicMaterial color={ringColor} transparent opacity={ringOpacity * 0.85} />
        </mesh>
      )}
    </group>
  );
}

interface TulipMeshProps {
  color: TulipColor;
  rotation: number;
  selected?: boolean;
  onClick?: () => void;
}

export function TulipMesh({ color, rotation, selected, onClick }: TulipMeshProps) {
  const petalColor = tulipRenderColorHex(color);
  const petalRotations = useMemo(() => getTulipPetalRotations(), []);
  const stemGeometry = useMemo(() => getTulipStemGeometry(), []);
  const leftLeafGeometry = useMemo(() => getTulipLeafGeometry('left'), []);
  const rightLeafGeometry = useMemo(() => getTulipLeafGeometry('right'), []);

  const outerPetalMaterial = useMemo(() => createPetalMaterial(petalColor, false), [petalColor]);
  const innerPetalMaterial = useMemo(() => createPetalMaterial(petalColor, true), [petalColor]);
  const leafMaterial = useMemo(() => createLeafMaterial(), []);
  const stemMaterial = useMemo(() => createStemMaterial(), []);

  const petalMeshes = useMemo(
    () =>
      petalRotations.map(({ layer, index, rotation: petalRotation }) => ({
        key: `${layer}-${index}`,
        layer,
        index,
        rotation: petalRotation,
        geometry: getTulipPetalGeometry(layer, index, petalColor),
        material: layer === 'inner' ? innerPetalMaterial : outerPetalMaterial,
      })),
    [petalRotations, petalColor, innerPetalMaterial, outerPetalMaterial],
  );

  return (
    <group
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <mesh geometry={stemGeometry} material={stemMaterial} castShadow />

      <mesh
        geometry={leftLeafGeometry}
        material={leafMaterial}
        rotation={[0, 0.2, 0]}
        castShadow
      />
      <mesh
        geometry={rightLeafGeometry}
        material={leafMaterial}
        rotation={[0, -0.15, 0]}
        castShadow
      />

      {petalMeshes.map(({ key, rotation: petalRotation, geometry, material }) => (
        <mesh
          key={key}
          geometry={geometry}
          material={material}
          rotation={[0, petalRotation, 0]}
          castShadow
        />
      ))}

      {selected && (
        <mesh position={[0, TURF_RING_Y - TULIP_ROOT_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.14, 0.2, 32]} />
          <meshBasicMaterial color="#f0e4c8" transparent opacity={0.38} />
        </mesh>
      )}
    </group>
  );
}

interface CosmosMeshProps {
  rotation: number;
  selected?: boolean;
  ghost?: boolean;
  onClick?: () => void;
}

export function CosmosMesh({ rotation, selected, ghost, onClick }: CosmosMeshProps) {
  const petalRotations = useMemo(() => getCosmosPetalRotations(), []);
  const leafPlacements = useMemo(() => getCosmosLeafPlacements(), []);
  const stemGeometry = useMemo(() => getCosmosStemGeometry(), []);
  const centerGeometry = useMemo(() => getCosmosCenterGeometry(), []);
  const petalMaterial = useMemo(() => createPetalMaterial('#f2a8c4', false), []);
  const centerMaterial = useMemo(() => createPetalMaterial('#f0c040', true), []);
  const leafMaterial = useMemo(() => createLeafMaterial(), []);
  const stemMaterial = useMemo(() => createStemMaterial(), []);
  const ghostOpacity = ghost ? 0.55 : 1;

  return (
    <group
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <mesh geometry={stemGeometry} material={stemMaterial} castShadow />
      {leafPlacements.map((placement) => (
        <mesh
          key={`leaf-${placement.side}-${placement.index}`}
          geometry={getCosmosLeafGeometry(
            placement.side,
            placement.index,
            placement.attachY,
            placement.attachX,
          )}
          material={leafMaterial}
          castShadow
        />
      ))}
      {petalRotations.map((petalRotation, index) => (
        <mesh
          key={`petal-${index}`}
          geometry={getCosmosPetalGeometry(index)}
          material={petalMaterial}
          rotation={[0, petalRotation, 0]}
          castShadow
        />
      ))}
      <mesh geometry={centerGeometry} material={centerMaterial} castShadow />
      {ghost && (
        <mesh scale={[1.02, 1.02, 1.02]}>
          <sphereGeometry args={[0.5, 8, 8]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
      )}
      {selected && (
        <mesh position={[0, TURF_RING_Y - SOIL_TOP_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.14, 0.2, 32]} />
          <meshBasicMaterial color="#f0e4c8" transparent opacity={0.38 * ghostOpacity} />
        </mesh>
      )}
    </group>
  );
}

interface PansyMeshProps {
  rotation: number;
  selected?: boolean;
  ghost?: boolean;
  onClick?: () => void;
}

export function PansyMesh({ rotation, selected, ghost, onClick }: PansyMeshProps) {
  const foliageGeometry = useMemo(() => getPansyFoliageGeometry(), []);
  const stemGeometry = useMemo(() => getPansyStemGeometry(), []);
  const calyxGeometry = useMemo(() => getPansyCalyxGeometry(), []);
  const petalSpecs = useMemo(() => getPansyPetalSpecs(), []);
  const foliageMaterial = useMemo(() => createLeafMaterial(), []);
  const stemMaterial = useMemo(() => createStemMaterial(), []);
  const calyxMaterial = useMemo(() => createLeafMaterial(), []);
  const petalMaterials = useMemo(
    () =>
      petalSpecs.map((spec) =>
        createPetalMaterial(spec.baseHex, spec.role === 'lower'),
      ),
    [petalSpecs],
  );
  const ghostOpacity = ghost ? 0.55 : 1;

  return (
    <group
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <mesh geometry={foliageGeometry} material={foliageMaterial} castShadow receiveShadow />
      <mesh geometry={stemGeometry} material={stemMaterial} castShadow />
      <group position={[0, PANSY_FLOWER_CENTER_Y, 0]}>
        <mesh geometry={calyxGeometry} material={calyxMaterial} castShadow />
        {petalSpecs.map((spec, index) => (
          <mesh
            key={spec.role}
            geometry={getPansyPetalGeometry(spec.role)}
            material={petalMaterials[index]}
            rotation={[0, 0, spec.angleZ]}
            castShadow
          />
        ))}
      </group>
      {selected && (
        <mesh position={[0, TURF_RING_Y - SOIL_TOP_Y, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.12, 0.18, 32]} />
          <meshBasicMaterial color="#f0e4c8" transparent opacity={0.38 * ghostOpacity} />
        </mesh>
      )}
    </group>
  );
}

interface GardenPlantMeshProps {
  plant: Pick<GardenPlant, 'color' | 'rotation' | 'modelType'>;
  selected?: boolean;
  ghost?: boolean;
  onClick?: () => void;
}

export function GardenPlantMesh({ plant, selected, ghost, onClick }: GardenPlantMeshProps) {
  const modelType = resolvePlantModelType(plant);
  if (modelType === 'cosmos') {
    return (
      <CosmosMesh rotation={plant.rotation} selected={selected} ghost={ghost} onClick={onClick} />
    );
  }
  if (modelType === 'pansy') {
    return (
      <PansyMesh rotation={plant.rotation} selected={selected} ghost={ghost} onClick={onClick} />
    );
  }
  return (
    <TulipMesh
      color={plant.color}
      rotation={plant.rotation}
      selected={selected}
      onClick={onClick}
    />
  );
}

interface PreviewPlantMeshProps {
  modelType: GardenModelType;
  color: TulipColor;
}

export function PreviewPlantMesh({ modelType, color }: PreviewPlantMeshProps) {
  const yaw = PREVIEW_YAW[modelType];
  if (modelType === 'cosmos') {
    return <CosmosMesh rotation={yaw} />;
  }
  if (modelType === 'pansy') {
    return <PansyMesh rotation={yaw} />;
  }
  return <TulipMesh color={color} rotation={yaw} />;
}

export function GhostTileMarker({ x, z }: { x: number; z: number }) {
  const ghostMaterial = useMemo(() => createGhostMaterial(), []);

  return (
    <group position={[x * TILE_SIZE, 0.05, z * TILE_SIZE]}>
      <RoundedBox
        args={[0.82, 0.04, 0.82]}
        radius={0.06}
        smoothness={4}
        material={ghostMaterial}
      />

      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[0.22, 0.04]} />
        <meshBasicMaterial color="#6d7a62" transparent opacity={0.7} />
      </mesh>
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, Math.PI / 2]}>
        <planeGeometry args={[0.22, 0.04]} />
        <meshBasicMaterial color="#6d7a62" transparent opacity={0.7} />
      </mesh>
    </group>
  );
}

export { TILE_SIZE };
