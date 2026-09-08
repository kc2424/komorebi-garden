import { Suspense, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import type { GardenEditMode, GardenPlant, SoilTile, TulipColor } from '../../types';
import { GhostTileMarker, SoilTileMesh, TILE_SIZE, TulipMesh } from './ProceduralMeshes';
import styles from './Garden3DCanvas.module.css';

interface Garden3DCanvasProps {
  soilTiles: SoilTile[];
  plants: GardenPlant[];
  editMode: GardenEditMode;
  selectedTileId: string | null;
  selectedPlantId: string | null;
  plantColor: TulipColor;
  addablePositions: { x: number; z: number }[];
  tulipUnlocked: boolean;
  onTileClick: (tileId: string) => void;
  onGhostTileClick: (x: number, z: number) => void;
  onPlantClick: (plantId: string) => void;
}

function GardenScene({
  soilTiles,
  plants,
  editMode,
  selectedTileId,
  selectedPlantId,
  addablePositions,
  onTileClick,
  onGhostTileClick,
  onPlantClick,
}: Omit<Garden3DCanvasProps, 'plantColor' | 'tulipUnlocked'>) {
  const plantTileIds = useMemo(() => new Set(plants.map((p) => p.tileId)), [plants]);

  return (
    <>
      <ambientLight intensity={0.65} />
      <directionalLight position={[4, 8, 3]} intensity={1.1} castShadow />
      <hemisphereLight args={['#cfe8f3', '#7d5e44', 0.35]} />

      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.01, 0]} receiveShadow>
        <planeGeometry args={[20, 20]} />
        <meshStandardMaterial color="#d8e8d0" roughness={1} />
      </mesh>

      {soilTiles.map((tile) => {
        const hasPlant = plantTileIds.has(tile.id);
        let highlight: 'add' | 'remove' | 'plant' | 'move' | null = null;
        if (editMode === 'remove-soil' && !hasPlant) highlight = 'remove';
        if (editMode === 'plant' && !hasPlant) highlight = 'plant';
        if (editMode === 'move' && !hasPlant) highlight = 'move';

        const plant = plants.find((p) => p.tileId === tile.id);

        return (
          <group key={tile.id}>
            <SoilTileMesh
              x={tile.x}
              z={tile.z}
              selected={selectedTileId === tile.id}
              highlight={highlight}
              onClick={() => onTileClick(tile.id)}
            />
            {plant && (
              <group position={[tile.x * TILE_SIZE, 0.06, tile.z * TILE_SIZE]}>
                <TulipMesh
                  color={plant.color}
                  rotation={plant.rotation}
                  selected={selectedPlantId === plant.id}
                  onClick={() => onPlantClick(plant.id)}
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

export function Garden3DCanvas(props: Garden3DCanvasProps) {
  return (
    <div className={styles.canvasWrap} aria-label="3D庭">
      <Canvas
        shadows
        camera={{ position: [3.5, 3.2, 3.5], fov: 42 }}
        gl={{ antialias: true, alpha: true }}
      >
        <Suspense fallback={null}>
          <GardenScene {...props} />
          <OrbitControls
            enablePan={false}
            minDistance={2.5}
            maxDistance={9}
            minPolarAngle={0.3}
            maxPolarAngle={Math.PI / 2.1}
            target={[0, 0.2, 0]}
          />
        </Suspense>
      </Canvas>
    </div>
  );
}
