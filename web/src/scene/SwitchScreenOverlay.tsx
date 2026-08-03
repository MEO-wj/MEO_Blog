import { lazy, Suspense } from "react";
import { Html } from "@react-three/drei";
import * as THREE from "three";
import type { SwitchRouteState } from "../features/switch-ui/switchRoutes";

const SwitchHomeScreen = lazy(() =>
  import("../features/switch-ui/SwitchHomeScreen").then((m) => ({ default: m.SwitchHomeScreen })),
);

interface SwitchScreenOverlayProps {
  focused: boolean;
  resetSignal: number;
  onRequestFocus: () => void;
  onRequestHome: () => void;
  onRequestExit: () => void;
  routeState: SwitchRouteState;
  onNavigate: (to: string, options?: { replace?: boolean }) => void;
}

const SCREEN_POSITION: [number, number, number] = [1.75, 7.432, -7.969];
const SCREEN_ROTATION: [number, number, number] = [THREE.MathUtils.degToRad(2.18), 0, 0];
const DOCK_HIT_POSITION: [number, number, number] = [-3.75, 4.76, -7.66];

function setPointerCursor(cursor: string) {
  document.body.style.cursor = cursor;
}

function SwitchScreenFallback() {
  return (
    <div
      style={{
        width: 1280,
        height: 720,
        display: "grid",
        placeItems: "center",
        color: "#63e6be",
        background: "#1c1c1c",
        fontFamily: "ui-monospace, SFMono-Regular, Menlo, Consolas, monospace",
        letterSpacing: 4,
      }}
    >
      MEO_Blog
    </div>
  );
}

export function SwitchScreenOverlay({
  focused,
  resetSignal,
  onRequestFocus,
  onRequestHome,
  onRequestExit,
  routeState,
  onNavigate,
}: SwitchScreenOverlayProps) {
  return (
    <>
      <Html
        transform
        center
        occlude
        position={SCREEN_POSITION}
        rotation={SCREEN_ROTATION}
        scale={0.085}
        zIndexRange={[30, 0]}
        pointerEvents="auto"
        style={{
          backfaceVisibility: "hidden",
          WebkitBackfaceVisibility: "hidden",
        }}
      >
        <div
          className="switch-screen-html-surface"
          onClick={() => {
            if (!focused) onRequestFocus();
          }}
          style={{ cursor: focused ? "default" : "zoom-in" }}
        >
          <Suspense fallback={<SwitchScreenFallback />}>
            <SwitchHomeScreen
              focused={focused}
              resetSignal={resetSignal}
              presentation="preview"
              onRequestFocus={onRequestFocus}
              onRequestExit={onRequestExit}
              routeState={routeState}
              onNavigate={onNavigate}
            />
          </Suspense>
        </div>
      </Html>

      <mesh
        position={DOCK_HIT_POSITION}
        onClick={(event) => {
          event.stopPropagation();
          onRequestHome();
        }}
        onPointerOver={() => setPointerCursor("pointer")}
        onPointerOut={() => setPointerCursor("default")}
      >
        <planeGeometry args={[2.45, 1.65]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} side={THREE.DoubleSide} />
      </mesh>
    </>
  );
}
