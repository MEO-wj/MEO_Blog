import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import * as THREE from "three";

export function NightStage() {
  const glowRef = useRef<THREE.PointLight>(null);

  useFrame(({ clock }) => {
    if (glowRef.current) {
      glowRef.current.intensity = 4.05 + Math.sin(clock.getElapsedTime() * 1.7) * 0.18;
    }
  });

  return (
    <>
      <color attach="background" args={["#060913"]} />
      <fogExp2 attach="fog" args={["#060913", 0.018]} />

      {/* Floor */}
      <mesh rotation-x={-Math.PI / 2} position={[0, -0.02, 0]} receiveShadow>
        <planeGeometry args={[90, 90]} />
        <meshStandardMaterial color="#0e1424" roughness={0.76} metalness={0.08} />
      </mesh>

      {/* Grid */}
      <gridHelper args={[90, 45, 0x26375f, 0x121a2e]} position={[0, 0.012, 0]}>
        <meshBasicMaterial transparent opacity={0.36} />
      </gridHelper>

      {/* Back wall */}
      <mesh position={[0, 18, -32]} receiveShadow>
        <planeGeometry args={[90, 36]} />
        <meshStandardMaterial color="#080d19" roughness={0.9} metalness={0} />
      </mesh>

      {/* Hemisphere ambient */}
      <hemisphereLight args={[0xb8caff, 0x060913, 2.85]} />

      {/* Moon key light */}
      <directionalLight
        position={[-14, 28, 18]}
        intensity={5.6}
        color={0xc9d7ff}
        castShadow
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={1}
        shadow-camera-far={70}
        shadow-camera-left={-28}
        shadow-camera-right={28}
        shadow-camera-top={28}
        shadow-camera-bottom={-28}
      />

      {/* Desk screen glow */}
      <pointLight ref={glowRef} position={[2.2, 5.2, -7.6]} intensity={4.2} color={0x64ffe1} distance={24} decay={2.1} />

      {/* Warm edge light */}
      <pointLight position={[-6.5, 4.6, -2.2]} intensity={2.2} color={0xffb870} distance={18} decay={2} />

      {/* Blue fill spot */}
      <spotLight
        position={[10, 16, 12]}
        intensity={2.5}
        color={0x6d84ff}
        distance={42}
        angle={Math.PI * 0.24}
        penumbra={0.52}
        decay={1.6}
        castShadow
        target-position={[1.8, 2, -6.5]}
      />
    </>
  );
}
