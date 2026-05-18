import { Suspense } from "react";
import { Canvas } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { NightStage } from "./NightStage";
import { SceneLoader } from "./SceneLoader";
import { useSceneLayout } from "./useSceneLayout";

export function SceneEntry() {
  const { layout } = useSceneLayout();

  return (
    <div className="w-full h-full relative">
      <Canvas
        shadows
        camera={{ fov: 58, near: 0.1, far: 240, position: [1.9, 15.3, 18.7] }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = 4;
          gl.toneMappingExposure = 1.55;
        }}
      >
        <NightStage />
        <OrbitControls
          enableDamping
          dampingFactor={0.08}
          minDistance={7}
          maxDistance={44}
          maxPolarAngle={Math.PI * 0.48}
          target={[2.0, 5.8, 0.25]}
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
