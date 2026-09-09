import { Suspense, useLayoutEffect, useRef } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrthographicCamera, View } from '@react-three/drei';
import * as THREE from 'three';
import type { GardenModelType, TulipColor } from '../../types';
import { getPreviewCameraSetup } from '../../utils/previewCamera';
import { PreviewPlantMesh } from '../garden3d/ProceduralMeshes';
import styles from './FlowerPreviewCanvas.module.css';

interface FlowerPreviewSlotProps {
  modelType: GardenModelType;
  color: TulipColor;
  trackRef: React.RefObject<HTMLElement | null>;
}

function PreviewLighting() {
  return (
    <>
      <ambientLight intensity={0.88} color="#f5f0f2" />
      <directionalLight position={[1.5, 3.5, 2.5]} intensity={1.55} color="#fff8ee" />
      <directionalLight position={[-2, 1.5, -1.5]} intensity={0.42} color="#ded6d5" />
    </>
  );
}

function PreviewCamera({
  modelType,
  frameWidth,
  frameHeight,
}: {
  modelType: GardenModelType;
  frameWidth: number;
  frameHeight: number;
}) {
  const cameraRef = useRef<THREE.OrthographicCamera>(null);
  const setup = getPreviewCameraSetup(modelType, frameWidth, frameHeight);

  useLayoutEffect(() => {
    const camera = cameraRef.current;
    if (!camera) return;
    camera.position.set(...setup.position);
    camera.zoom = setup.zoom;
    camera.lookAt(...setup.target);
    camera.updateProjectionMatrix();
  }, [setup.position, setup.target, setup.zoom]);

  return (
    <OrthographicCamera
      ref={cameraRef}
      makeDefault
      near={0.01}
      far={20}
      position={setup.position}
      zoom={setup.zoom}
      onUpdate={(camera) => camera.lookAt(...setup.target)}
    />
  );
}

function PreviewScene({ modelType, color }: { modelType: GardenModelType; color: TulipColor }) {
  return (
    <group>
      <PreviewPlantMesh modelType={modelType} color={color} />
    </group>
  );
}

interface FlowerPreviewSlotPropsWithFrame extends FlowerPreviewSlotProps {
  frameWidth: number;
  frameHeight: number;
}

function FlowerPreviewSlot({
  modelType,
  color,
  trackRef,
  frameWidth,
  frameHeight,
}: FlowerPreviewSlotPropsWithFrame) {
  return (
    <View track={trackRef as React.RefObject<HTMLElement>} className={styles.view}>
      <PreviewCamera modelType={modelType} frameWidth={frameWidth} frameHeight={frameHeight} />
      <PreviewLighting />
      <PreviewScene modelType={modelType} color={color} />
    </View>
  );
}

interface FlowerPreviewCanvasProps {
  slots: Array<{
    id: string;
    modelType: GardenModelType;
    color: TulipColor;
    trackRef: React.RefObject<HTMLElement | null>;
    frameWidth: number;
    frameHeight: number;
  }>;
}

export function FlowerPreviewCanvas({ slots }: FlowerPreviewCanvasProps) {
  return (
    <div className={styles.canvasHost} aria-hidden="true">
      <Canvas
        className={styles.canvas}
        eventSource={document.body}
        dpr={[1, 1.5]}
        gl={{ antialias: true, alpha: true }}
        onCreated={({ gl }) => {
          gl.toneMapping = THREE.ACESFilmicToneMapping;
          gl.toneMappingExposure = 0.98;
          gl.outputColorSpace = THREE.SRGBColorSpace;
        }}
      >
        <Suspense fallback={null}>
          {slots.map((slot) => (
            <FlowerPreviewSlot
              key={slot.id}
              modelType={slot.modelType}
              color={slot.color}
              trackRef={slot.trackRef}
              frameWidth={slot.frameWidth}
              frameHeight={slot.frameHeight}
            />
          ))}
        </Suspense>
      </Canvas>
    </div>
  );
}
