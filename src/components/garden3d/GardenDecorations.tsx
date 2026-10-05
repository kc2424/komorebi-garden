import * as THREE from 'three';
import type { GardenDecorationType } from '../../types';
import {
  DECORATION_PALETTE,
  getDecorationGeometry,
  type DecorationMaterial,
} from './decorationGeometry';

const materials = new Map<string, THREE.MeshStandardMaterial>();
const selectionGeometry = new THREE.RingGeometry(0.33, 0.38, 32);
const selectionMaterial = new THREE.MeshBasicMaterial({
  color: '#f0e4c8', transparent: true, opacity: 0.7, depthWrite: false,
});

function getMaterial(key: DecorationMaterial, ghost: boolean) {
  const cacheKey = `${key}-${ghost ? 'ghost' : 'solid'}`;
  const cached = materials.get(cacheKey);
  if (cached) return cached;
  const material = new THREE.MeshStandardMaterial({
    color: DECORATION_PALETTE[key],
    roughness: key === 'water' || key === 'waterLight' ? 0.28 : 0.84,
    flatShading: true,
    transparent: ghost,
    opacity: ghost ? 0.5 : 1,
    depthWrite: !ghost,
    ...(key === 'glow' ? { emissive: '#b27c32', emissiveIntensity: ghost ? 0.12 : 0.32 } : {}),
  });
  materials.set(cacheKey, material);
  return material;
}

export interface GardenDecorationMeshProps {
  type: GardenDecorationType;
  rotation: number;
  selected?: boolean;
  ghost?: boolean;
  onClick?: () => void;
}

export function GardenDecorationMesh({ type, rotation, selected, ghost = false, onClick }: GardenDecorationMeshProps) {
  return (
    <group
      rotation={[0, rotation, 0]}
      dispose={null}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      {getDecorationGeometry(type).map((part) => (
        <mesh
          key={part.material}
          geometry={part.geometry}
          material={getMaterial(part.material, ghost)}
          castShadow={!ghost}
          receiveShadow={!ghost}
        />
      ))}
      {selected && (
        <mesh
          geometry={selectionGeometry}
          material={selectionMaterial}
          position={[0, 0.076, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      )}
    </group>
  );
}
