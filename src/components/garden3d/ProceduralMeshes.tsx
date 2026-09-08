import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { RoundedBox } from '@react-three/drei';
import * as THREE from 'three';
import type { TulipColor } from '../../types';
import { tulipColorHex } from '../../data/tulip';

const TILE_SIZE = 1;
const TILE_HEIGHT = 0.12;
const TILE_RADIUS = 0.08;

interface SoilTileMeshProps {
  x: number;
  z: number;
  selected?: boolean;
  highlight?: 'add' | 'remove' | 'plant' | 'move' | null;
  onClick?: () => void;
}

export function SoilTileMesh({ x, z, selected, highlight, onClick }: SoilTileMeshProps) {
  const meshRef = useRef<THREE.Mesh>(null);

  useFrame((_, delta) => {
    if (!meshRef.current) return;
    if (selected || highlight) {
      meshRef.current.position.y = 0.06 + Math.sin(Date.now() * 0.004) * 0.02;
    } else {
      meshRef.current.position.y = THREE.MathUtils.lerp(meshRef.current.position.y, 0.06, delta * 8);
    }
  });

  const color = useMemo(() => {
    if (highlight === 'remove') return '#6b4c3b';
    if (highlight === 'add') return '#a67c52';
    if (selected) return '#9a7050';
    return '#7d5e44';
  }, [highlight, selected]);

  return (
    <group position={[x * TILE_SIZE, 0, z * TILE_SIZE]}>
      <RoundedBox
        ref={meshRef}
        args={[TILE_SIZE * 0.92, TILE_HEIGHT, TILE_SIZE * 0.92]}
        radius={TILE_RADIUS}
        smoothness={4}
        castShadow
        receiveShadow
        onClick={(e) => {
          e.stopPropagation();
          onClick?.();
        }}
      >
        <meshStandardMaterial color={color} roughness={0.9} metalness={0.05} />
      </RoundedBox>
      {(highlight === 'add' || selected) && (
        <mesh position={[0, 0.14, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.2, 0.28, 32]} />
          <meshBasicMaterial color="#f4d35e" transparent opacity={0.7} />
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
  const petalColor = tulipColorHex(color);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (!groupRef.current) return;
    const target = selected ? 1.08 : 1;
    groupRef.current.scale.setScalar(
      THREE.MathUtils.lerp(groupRef.current.scale.x, target, delta * 6),
    );
  });

  return (
    <group
      ref={groupRef}
      rotation={[0, rotation, 0]}
      onClick={(e) => {
        e.stopPropagation();
        onClick?.();
      }}
    >
      <mesh position={[0, 0.22, 0]} castShadow>
        <cylinderGeometry args={[0.02, 0.025, 0.44, 8]} />
        <meshStandardMaterial color="#3d6b4f" roughness={0.8} />
      </mesh>
      <mesh position={[0, 0.48, 0]} castShadow>
        <sphereGeometry args={[0.11, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.65]} />
        <meshStandardMaterial color={petalColor} roughness={0.55} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.38, 0]} castShadow>
        <cylinderGeometry args={[0.09, 0.07, 0.12, 16]} />
        <meshStandardMaterial color={petalColor} roughness={0.55} />
      </mesh>
      <mesh position={[0.12, 0.18, 0]} rotation={[0, 0, -0.6]}>
        <boxGeometry args={[0.18, 0.04, 0.08]} />
        <meshStandardMaterial color="#4a8f5c" roughness={0.85} />
      </mesh>
      <mesh position={[-0.1, 0.2, 0.05]} rotation={[0.2, 0.4, 0.5]}>
        <boxGeometry args={[0.16, 0.035, 0.07]} />
        <meshStandardMaterial color="#4a8f5c" roughness={0.85} />
      </mesh>
    </group>
  );
}

export function GhostTileMarker({ x, z }: { x: number; z: number }) {
  return (
    <group position={[x * TILE_SIZE, 0.08, z * TILE_SIZE]}>
      <mesh>
        <boxGeometry args={[TILE_SIZE * 0.85, 0.04, TILE_SIZE * 0.85]} />
        <meshStandardMaterial color="#c4a882" transparent opacity={0.45} />
      </mesh>
    </group>
  );
}

export { TILE_SIZE };
