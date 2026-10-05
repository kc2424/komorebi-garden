import * as THREE from 'three';
import type { GardenModelType, TulipColor } from '../../types';
import { getLightweightPlantGeometry } from './lightweightPlantGeometry';

const plantMaterial = new THREE.MeshStandardMaterial({
  vertexColors: true,
  roughness: 0.88,
  metalness: 0,
  side: THREE.DoubleSide,
});
const ghostMaterial = plantMaterial.clone();
ghostMaterial.transparent = true;
ghostMaterial.opacity = 0.5;
ghostMaterial.depthWrite = false;
ghostMaterial.forceSinglePass = true;
const selectionGeometry = new THREE.RingGeometry(0.2, 0.27, 32);
const selectionMaterial = new THREE.MeshBasicMaterial({ color: '#f0e4c8', transparent: true, opacity: 0.7, depthWrite: false });

export interface LightweightPlantMeshProps {
  modelType: GardenModelType;
  color: TulipColor;
  rotation: number;
  selected?: boolean;
  onClick?: () => void;
  ghost?: boolean;
}

/** One draw call per plant, with shared geometry and material across repeated placements. */
export function LightweightPlantMesh({ modelType, color, rotation, selected, onClick, ghost }: LightweightPlantMeshProps) {
  return (
    <group
      rotation={[0, rotation, 0]}
      dispose={null}
      onClick={(event) => {
        event.stopPropagation();
        onClick?.();
      }}
    >
      <mesh
        geometry={getLightweightPlantGeometry(modelType, color)}
        material={ghost ? ghostMaterial : plantMaterial}
        castShadow={!ghost}
        receiveShadow
      />
      {selected && !ghost && (
        <mesh
          geometry={selectionGeometry}
          material={selectionMaterial}
          position={[0, 0.018, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
        />
      )}
    </group>
  );
}
