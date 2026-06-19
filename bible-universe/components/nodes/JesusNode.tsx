'use client';
import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useUniverseStore } from '@/store/universeStore';
import { cameraPositionForNode } from '@/lib/graphLayout';

const JESUS_POS = { x: 0, y: 0, z: 0 };

export default function JesusNode() {
  const coreRef  = useRef<THREE.Mesh>(null);
  const haloRef  = useRef<THREE.Mesh>(null);
  const outerRef = useRef<THREE.Mesh>(null);
  const ringRef  = useRef<THREE.Mesh>(null);
  const scaleRef = useRef(1);

  const isHovered  = useUniverseStore((s) => s.hoveredNodeId  === 'jesus');
  const isSelected = useUniverseStore((s) => s.selectedNodeId === 'jesus');
  const { hoverNode, selectNode, setCameraTarget, setCameraPosition } = useUniverseStore.getState();

  useFrame(({ clock }, delta) => {
    const t = clock.getElapsedTime();

    const targetScale = isSelected ? 1.25 : isHovered ? 1.15 : 1;
    scaleRef.current  = THREE.MathUtils.lerp(scaleRef.current, targetScale, 1 - Math.exp(-6 * delta));

    if (coreRef.current) {
      const pulse = scaleRef.current * (1 + Math.sin(t * 1.4) * 0.08);
      coreRef.current.scale.setScalar(pulse);
      const targetEmi = isSelected ? 4.0 : isHovered ? 3.5 : 2.6 + Math.sin(t * 1.4) * 0.7;
      (coreRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity = THREE.MathUtils.lerp(
        (coreRef.current.material as THREE.MeshStandardMaterial).emissiveIntensity,
        targetEmi,
        1 - Math.exp(-5 * delta),
      );
    }

    if (haloRef.current) {
      (haloRef.current.material as THREE.MeshBasicMaterial).opacity =
        (isHovered || isSelected ? 0.28 : 0.18) + Math.sin(t * 1.2) * 0.05;
    }

    if (outerRef.current) {
      (outerRef.current.material as THREE.MeshBasicMaterial).opacity =
        (isHovered || isSelected ? 0.09 : 0.05) + Math.sin(t * 0.8) * 0.02;
    }

    if (ringRef.current) {
      ringRef.current.rotation.z = t * 0.25;
      ringRef.current.rotation.y = t * 0.12;
    }
  });

  function handleClick(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    selectNode('jesus');
    const camPos = cameraPositionForNode(JESUS_POS, true, true);
    setCameraTarget([0, 0, 0]);
    setCameraPosition([camPos.x, camPos.y, camPos.z]);
  }

  return (
    <group position={[0, 0, 0]}>
      {/* Invisible hit target — wider than the visual sphere for easy clicking */}
      <mesh
        onClick={handleClick}
        onPointerEnter={(e) => { e.stopPropagation(); hoverNode('jesus'); document.body.style.cursor = 'pointer'; }}
        onPointerLeave={(e) => { e.stopPropagation(); hoverNode(null);    document.body.style.cursor = 'default'; }}
      >
        <sphereGeometry args={[40, 8, 8]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>

      {/* Core */}
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

      {/* Inner halo */}
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

      {/* Point light */}
      <pointLight color={0xffd700} intensity={5} distance={800} decay={2} />

      {/* Label */}
      <Html center distanceFactor={800} style={{ pointerEvents: 'none', userSelect: 'none' }}>
        <div style={{
          fontFamily:    'serif',
          fontSize:      '16px',
          fontWeight:    'bold',
          color:         '#FFD700',
          whiteSpace:    'nowrap',
          textShadow:    '0 0 16px rgba(251,191,36,0.8)',
          transform:     'translateY(52px)',
          letterSpacing: '0.08em',
          opacity:       isHovered || isSelected ? 1 : 0.85,
          transition:    'opacity 0.2s',
        }}>
          Jesus Christ
        </div>
      </Html>
    </group>
  );
}
