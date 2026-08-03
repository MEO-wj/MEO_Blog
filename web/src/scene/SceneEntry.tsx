import { Suspense, useEffect, useMemo, useRef, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { useLocation, useNavigate } from "react-router-dom";
import { OrbitControls } from "@react-three/drei";
import * as THREE from "three";
import { NightStage } from "./NightStage";
import { SceneLoader } from "./SceneLoader";
import { useSceneLayout } from "./useSceneLayout";
import { LoadingOverlay } from "./LoadingOverlay";
import { getSwitchRouteState, isSwitchModalRoute } from "../features/switch-ui/switchRoutes";

const DESKTOP_FOV = 42;
const MOBILE_FOV = 58;
const SCREEN_FOCUS_FOV = 14.5;
const MOBILE_SCREEN_FOCUS_FOV = 72;
const SCREEN_FOCUS_POSITION = new THREE.Vector3(1.75, 7.5, 5.85);
const MOBILE_SCREEN_FOCUS_POSITION = new THREE.Vector3(1.75, 8.12, 7.8);
const SCREEN_FOCUS_TARGET = new THREE.Vector3(1.75, 7.5, -7.42);

function SceneCamera({
  position,
  target,
  screenFocused,
}: {
  position: [number, number, number];
  target: [number, number, number];
  screenFocused: boolean;
}) {
  const { camera, size } = useThree();
  const lookTarget = useRef(new THREE.Vector3(...target));
  const shouldAnimate = useRef(false);
  const initialized = useRef(false);

  const scenePosition = useMemo(
    () => new THREE.Vector3(...position),
    [position[0], position[1], position[2]],
  );
  const sceneTarget = useMemo(
    () => new THREE.Vector3(...target),
    [target[0], target[1], target[2]],
  );
  const focusPosition = size.width < 768 ? MOBILE_SCREEN_FOCUS_POSITION : SCREEN_FOCUS_POSITION;
  const desiredPosition = screenFocused ? focusPosition : scenePosition;
  const desiredTarget = screenFocused ? SCREEN_FOCUS_TARGET : sceneTarget;
  const desiredFov = screenFocused
    ? size.width < 768
      ? MOBILE_SCREEN_FOCUS_FOV
      : SCREEN_FOCUS_FOV
    : size.width < 768
      ? MOBILE_FOV
      : DESKTOP_FOV;

  useEffect(() => {
    if (!(camera instanceof THREE.PerspectiveCamera)) return;

    if (!initialized.current) {
      camera.position.copy(desiredPosition);
      lookTarget.current.copy(desiredTarget);
      camera.fov = desiredFov;
      camera.lookAt(lookTarget.current);
      camera.updateProjectionMatrix();
      initialized.current = true;
      return;
    }

    shouldAnimate.current = true;
  }, [camera, desiredFov, desiredPosition, desiredTarget, screenFocused, size.width]);

  useFrame((_, delta) => {
    if (!(camera instanceof THREE.PerspectiveCamera) || !shouldAnimate.current) return;

    const alpha = 1 - Math.exp(-delta * 4.2);
    camera.position.lerp(desiredPosition, alpha);
    lookTarget.current.lerp(desiredTarget, alpha);
    camera.fov = THREE.MathUtils.lerp(camera.fov, desiredFov, alpha);
    camera.lookAt(lookTarget.current);
    camera.updateProjectionMatrix();

    const positionDone = camera.position.distanceTo(desiredPosition) < 0.025;
    const targetDone = lookTarget.current.distanceTo(desiredTarget) < 0.025;
    const fovDone = Math.abs(camera.fov - desiredFov) < 0.05;

    if (positionDone && targetDone && fovDone) {
      camera.position.copy(desiredPosition);
      lookTarget.current.copy(desiredTarget);
      camera.fov = desiredFov;
      camera.lookAt(lookTarget.current);
      camera.updateProjectionMatrix();
      shouldAnimate.current = false;
    }
  });

  return null;
}

export function SceneEntry() {
  const { pathname } = useLocation();
  const navigate = useNavigate();
  const routeState = getSwitchRouteState(pathname);
  const { layout, error: layoutError } = useSceneLayout();
  const [screenFocused, setScreenFocused] = useState(() => isSwitchModalRoute(routeState.kind));
  const [screenResetSignal, setScreenResetSignal] = useState(0);

  useEffect(() => {
    if (isSwitchModalRoute(routeState.kind)) setScreenFocused(true);
  }, [routeState.kind]);
  function openScreen() {
    setScreenFocused(true);
  }

  function closeScreen() {
    setScreenFocused(false);
  }

  function resetScreenHome() {
    setScreenFocused(false);
    setScreenResetSignal((value) => value + 1);
  }

  const cameraPos = layout?.camera
    ? [layout.camera.position.x, layout.camera.position.y, layout.camera.position.z] as [number, number, number]
    : [1.9, 15.3, 18.7] as [number, number, number];
  const cameraTarget = layout?.camera
    ? [layout.camera.target.x, layout.camera.target.y, layout.camera.target.z] as [number, number, number]
    : [2.0, 5.8, 0.25] as [number, number, number];

  return (
    <div className="w-full h-full relative" style={{ width: "100%", height: "100%", position: "relative" }}>
      <LoadingOverlay layoutReady={layout !== null} layoutError={layoutError} />
      <Canvas
        dpr={[1, 1.5]}
        shadows
        camera={{ fov: DESKTOP_FOV, near: 0.1, far: 240, position: cameraPos }}
        gl={{ antialias: true, powerPreference: "high-performance" }}
        onCreated={({ gl }) => {
          gl.toneMapping = 4;
          gl.toneMappingExposure = 1.55;
        }}
      >
        <SceneCamera
          position={cameraPos}
          target={cameraTarget}
          screenFocused={screenFocused}
        />
        <NightStage />
        <OrbitControls
          enabled={!screenFocused}
          enableDamping
          dampingFactor={0.08}
          minDistance={7}
          maxDistance={44}
          maxPolarAngle={Math.PI * 0.48}
          target={cameraTarget}
        />
        <Suspense fallback={null}>
          {layout && (
            <SceneLoader
              layout={layout}
              screenFocused={screenFocused}
              screenResetSignal={screenResetSignal}
              onRequestScreenFocus={openScreen}
              onRequestScreenHome={resetScreenHome}
              onRequestScreenExit={closeScreen}
              routeState={routeState}
              onNavigate={navigate}
            />
          )}
        </Suspense>
      </Canvas>

      {!screenFocused && <div className="absolute left-4 bottom-4 flex items-center gap-2.5 px-3 py-2 rounded-lg border border-accent/20 bg-surface/70 backdrop-blur-sm text-xs text-text-dim pointer-events-none">
        <span className="w-2 h-2 rounded-full bg-primary shadow-[0_0_12px_rgba(99,230,190,0.9)]" />
        <span>
          <strong className="text-white font-semibold">MEO_Blog</strong> 夜景
        </span>
      </div>}
    </div>
  );
}
