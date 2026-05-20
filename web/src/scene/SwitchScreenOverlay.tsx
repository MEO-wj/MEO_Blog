import { Html } from "@react-three/drei";
import * as THREE from "three";
import { SwitchHomeScreen } from "../features/switch-ui/SwitchHomeScreen";

interface SwitchScreenOverlayProps {
  focused: boolean;
  resetSignal: number;
  onRequestFocus: () => void;
  onRequestHome: () => void;
  onRequestExit: () => void;
}

const SCREEN_POSITION: [number, number, number] = [1.75, 7.432, -7.969];
const SCREEN_ROTATION: [number, number, number] = [THREE.MathUtils.degToRad(2.18), 0, 0];
const DOCK_HIT_POSITION: [number, number, number] = [-3.75, 4.76, -7.66];

function setPointerCursor(cursor: string) {
  document.body.style.cursor = cursor;
}

export function SwitchScreenOverlay({
  focused,
  resetSignal,
  onRequestFocus,
  onRequestHome,
  onRequestExit,
}: SwitchScreenOverlayProps) {
  return (
    <>
      <Html
        transform
        center
        occlude={false}
        position={SCREEN_POSITION}
        rotation={SCREEN_ROTATION}
        scale={0.085}
        zIndexRange={[30, 0]}
        pointerEvents="auto"
      >
        <div
          className="switch-screen-html-surface"
          onClick={() => {
            if (!focused) onRequestFocus();
          }}
          style={{ cursor: focused ? "default" : "zoom-in" }}
        >
          <SwitchHomeScreen
            focused={focused}
            resetSignal={resetSignal}
            presentation="preview"
            onRequestFocus={onRequestFocus}
            onRequestExit={onRequestExit}
          />
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
