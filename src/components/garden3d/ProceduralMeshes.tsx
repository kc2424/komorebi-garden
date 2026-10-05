import { useMemo } from 'react';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type {
  GardenDecoration,
  GardenModelType,
  GardenPlant,
  TileSurface,
  TulipColor,
} from '../../types';
import { tulipColorHex } from '../../data/tulip';
import { resolvePlantModelType } from '../../utils/plantModel';
import { PREVIEW_YAW } from '../../utils/previewCamera';
import { getTileElevation } from '../../utils/terrain';
import { LightweightPlantMesh } from './LightweightPlants';
import { GardenDecorationMesh as LightweightDecorationMesh } from './GardenDecorations';
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
  createGhostMaterial,
  createLeafMaterial,
  createPetalMaterial,
  createStemMaterial,
} from './proceduralMaterials';
import { getGrassTuftsGeometry, getTurfCapGeometry, TURF_RING_Y } from './terrainGeometry';
import {
  getEarthMaterial, getGrassMaterial, getSoilColumnGeometry,
  getTileSurfaceGeometry, getTileSurfaceMaterial, getTurfMaterial,
} from './surfaceGeometry';
import {
  getTulipLeafGeometry,
  getTulipPetalGeometry,
  getTulipPetalRotations,
  getTulipStemGeometry,
} from './tulipGeometry';

const TILE_SIZE = 1;
const SOIL_TOP_Y = 0.06;
const TULIP_ROOT_Y = SOIL_TOP_Y;
const tileSelectionGeometry = new THREE.RingGeometry(0.2, 0.28, 32);
const tileSelectionMaterial = new THREE.MeshBasicMaterial({
  color: '#e8d4a0', transparent: true, opacity: 0.425, depthWrite: false,
});
const tileRemovalMaterial = new THREE.MeshBasicMaterial({
  color: '#d4a0a8', transparent: true, opacity: 0.357, depthWrite: false,
});

/** 3D blossom tint — saved enum unchanged; pink maps to warm coral for rendering. */
function tulipRenderColorHex(color: TulipColor): string {
  if (color === 'pink') return '#ec9ca4';
  return tulipColorHex(color);
}

interface SoilTileMeshProps {
  x: number;
  z: number;
  surface?: TileSurface;
  height?: number;
  selected?: boolean;
  highlight?: 'add' | 'remove' | 'plant' | 'move' | null;
  onClick?: () => void;
}

export function SoilTileMesh({
  x,
  z,
  surface = 'grass',
  height = 0,
  selected,
  highlight,
  onClick,
}: SoilTileMeshProps) {
  const elevation = getTileElevation({ height });
  const showRing = selected || highlight != null;

  return (
    <group
      position={[x * TILE_SIZE, 0, z * TILE_SIZE]}
      dispose={null}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      <mesh
        geometry={getSoilColumnGeometry(height)}
        material={getEarthMaterial()}
        castShadow
        receiveShadow
      />
      <group position={[0, elevation, 0]}>
        {surface === 'grass' ? (
          <>
            <mesh geometry={getTurfCapGeometry()} material={getTurfMaterial()} castShadow receiveShadow />
            <mesh geometry={getGrassTuftsGeometry(x, z)} material={getGrassMaterial()} />
          </>
        ) : (
          <mesh
            geometry={getTileSurfaceGeometry(surface)}
            material={getTileSurfaceMaterial(surface)}
            castShadow
            receiveShadow
          />
        )}
        {showRing && (
          <mesh
            geometry={tileSelectionGeometry}
            material={highlight === 'remove' ? tileRemovalMaterial : tileSelectionMaterial}
            position={[0, TURF_RING_Y, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
          />
        )}
      </group>
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
  return <LightweightPlantMesh modelType={resolvePlantModelType(plant)} color={plant.color} rotation={plant.rotation} selected={selected} ghost={ghost} onClick={onClick} />;
}

interface PreviewPlantMeshProps {
  modelType: GardenModelType;
  color: TulipColor;
}

export function PreviewPlantMesh({ modelType, color }: PreviewPlantMeshProps) {
  return <LightweightPlantMesh modelType={modelType} color={color} rotation={PREVIEW_YAW[modelType]} />;
}

export function GardenDecorationMesh({
  decoration,
  selected,
  ghost,
  onClick,
}: {
  decoration: Pick<GardenDecoration, 'type' | 'rotation'>;
  selected?: boolean;
  ghost?: boolean;
  onClick?: () => void;
}) {
  return <LightweightDecorationMesh type={decoration.type} rotation={decoration.rotation} selected={selected} ghost={ghost} onClick={onClick} />;
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
