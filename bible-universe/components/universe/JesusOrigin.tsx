'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

/**
 * JesusOrigin — the glowing gold marker at (0,0,0) for Phase 2.
 *
 * Phase 3 will replace this with the full interactive supernode.
 * This placeholder ensures the center of the universe is visually anchored
 * so navigation feels purposeful immediately.
 */
export default function JesusOrigin() {
  const coreRef  = useRef<THREE.Mesh>(null);
  const haloRef  = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const ringRef  = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    if (coreRef.current) {
      const pulse = 1 + Math.sin(t * 1.4) * 0.1;
      coreRef.current.scale.setScalar(pulse);
      (coreRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity =
        2.6 + Math.sin(t * 1.4) * 0.7;
    }

    if (haloRef.current) {
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.18 + Math.sin(t * 1.2) * 0.06;
    }

    if (outerRef.current) {
      (outerRef.current.material as THREE.MeshBasicMaterial).opacity =
        0.05 + Math.sin(t * 0.8) * 0.02;
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.25;
      ringRef.current.rotation.y = t * 0.12;
    }
  });

  return (
    <group position={[0, 0, 0]}>
      {/* Core sphere */}
      <mesh ref={coreRef}>
        <sphereGeometry args={[22, 32, 32]} />
        <meshStandardMaterial
          color={0xffd700}
          emissive={0xffd700}
          emissiveIntensity={2.6}
          roughness={0}
          metalness={1}
        />
      </mesh>

      {/* Inner glow halo */}
      <mesh ref={haloRef}>
        <sphereGeometry args={[52, 24, 24]} />
        <meshBasicMaterial
          color={0xffd700}
          transparent
          opacity={0.18}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Outer soft glow */}
      <mesh ref={outerRef}>
        <sphereGeometry args={[110, 16, 16]} />
        <meshBasicMaterial
          color={0xffaa00}
          transparent
          opacity={0.05}
          side={THREE.BackSide}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Orbital ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[48, 0.9, 8, 80]} />
        <meshBasicMaterial
          color={0xffd700}
          transparent
          opacity={0.38}
          depthWrite={false}
          blending={THREE.AdditiveBlending}
        />
      </mesh>

      {/* Point light at origin */}
      <pointLight color={0xffd700} intensity={5} distance={800} decay={2} />
    </group>
  );
}
