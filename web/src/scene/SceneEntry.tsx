import { Suspense, useEffect } from "react";
import { Canvas, useThree } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { NightStage } from "./NightStage";
import { SceneLoader } from "./SceneLoader";
import { useSceneLayout } from "./useSceneLayout";

const DESKTOP_FOV = 42;
const MOBILE_FOV = 58;

function SceneCamera({
  position,
  target,
}: {
  position: [number, number, number];
  target: [number, number, number];
}) {
  const { camera, size } = useThree();

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    camera.position.set(...position);
    camera.fov = size.width < 768 ? MOBILE_FOV : DESKTOP_FOV;
    camera.lookAt(...target);
    camera.updateProjectionMatrix();
  }, [camera, position, size.width, target]);

  return null;
}

export function SceneEntry() {
  const { layout } = useSceneLayout();

  const cameraPos = layout?.camera
    ? [layout.camera.position.x, layout.camera.position.y, layout.camera.position.z] as [number, number, number]
    : [1.9, 15.3, 18.7] as [number, number, number];
  const cameraTarget = layout?.camera
    ? [layout.camera.target.x, layout.camera.target.y, layout.camera.target.z] as [number, number, number]
    : [2.0, 5.8, 0.25] as [number, number, number];

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{ fov: DESKTOP_FOV, near: 0.1, far: 240, position: cameraPos }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = 4;
          gl.toneMappingExposure = 1.55;
        }}
      >
        <SceneCamera position={cameraPos} target={cameraTarget} />
        <NightStage />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={7}
          maxDistance={44}
          maxPolarAngle={Math.PI * 0.48}
          target={cameraTarget}
        />
        <Suspense fallback={null}>
          {layout && <SceneLoader layout={layout} />}
        </Suspense>
      </Canvas>

      <div className="absolute left-4 bottom-4 flex items-center gap-2.5 px-3 py-2 rounded-lg border border-accent/20 bg-surface/70 backdrop-blur-sm text-xs text-text-dim pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_12px_rgba(99,230,190,0.9)]" />
        <span>
          <strong className="text-white font-semibold">MEO_Blog</strong> night
          scene
        </span>
      </div>
    </div>
  );
}
