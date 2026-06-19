'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useUniverseStore } from '@/store/universeStore';
import { NODE_COLORS_HEX, NODE_EMISSIVE_INTENSITY, NODE_RADIUS } from '@/lib/colorSystem';
import { cameraPositionForNode } from '@/lib/graphLayout';
import type { BibleNode } from '@/types/bible';

interface NodeMeshProps {
  node: BibleNode;
}

const HALO_SCALE = 2.2;
const HOVER_SCALE = 1.35;
const SELECT_SCALE = 1.5;

export default function NodeMesh({ node }: NodeMeshProps) {
  const meshRef  = useRef<THREE.Mesh>(null);
  const haloRef  = useRef<THREE.Mesh>(null);
  const matRef   = useRef<THREE.MeshStandardMaterial>(null);
  const scaleRef = useRef(1);

  const isHovered  = useUniverseStore((s) => s.hoveredNodeId  === node.id);
  const isSelected = useUniverseStore((s) => s.selectedNodeId === node.id);

  const { hoverNode, selectNode, setCameraTarget, setCameraPosition } = useUniverseStore.getState();

  const pos     = node.position!;
  const color   = NODE_COLORS_HEX[node.type];
  const baseEmi = NODE_EMISSIVE_INTENSITY[node.type];
  const radius  = node.isKeyNode ? NODE_RADIUS.key : NODE_RADIUS.default;

  const geo     = useMemo(() => new THREE.SphereGeometry(radius,   24, 24), [radius]);
  const haloGeo = useMemo(() => new THREE.SphereGeometry(radius * HALO_SCALE, 16, 16), [radius]);

  useFrame((_, delta) => {
    if (!meshRef.current || !matRef.current) return;

    const targetScale = isSelected ? SELECT_SCALE : isHovered ? HOVER_SCALE : 1;
    scaleRef.current  = THREE.MathUtils.lerp(scaleRef.current, targetScale, 1 - Math.exp(-8 * delta));
    meshRef.current.scale.setScalar(scaleRef.current);
    if (haloRef.current) haloRef.current.scale.setScalar(scaleRef.current);

    const targetEmi = isSelected
      ? baseEmi * 2.2
      : isHovered
      ? baseEmi * 1.8
      : baseEmi;
    matRef.current.emissiveIntensity = THREE.MathUtils.lerp(
      matRef.current.emissiveIntensity,
      targetEmi,
      1 - Math.exp(-6 * delta),
    );
  });

  function handleClick(e: { stopPropagation: () => void }) {
    e.stopPropagation();
    selectNode(node.id);
    const camPos = cameraPositionForNode(pos, false, node.isKeyNode);
    setCameraTarget([pos.x, pos.y, pos.z]);
    setCameraPosition([camPos.x, camPos.y, camPos.z]);
  }

  return (
    <group position={[pos.x, pos.y, pos.z]}>
      {/* Core sphere */}
      <mesh
        ref={meshRef}
        geometry={geo}
        onClick={handleClick}
        onPointerEnter={(e) => { e.stopPropagation(); hoverNode(node.id); document.body.style.cursor = 'pointer'; }}
        onPointerLeave={(e) => { e.stopPropagation(); hoverNode(null);    document.body.style.cursor = 'default'; }}
      >
        <meshStandardMaterial
          ref={matRef}
          color={color}
          emissive={color}
          emissiveIntensity={baseEmi}
          roughness={0.3}
          metalness={0.4}
        />
      </mesh>

      {/* Additive halo glow */}
      <mesh ref={haloRef} geometry={haloGeo}>
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isHovered || isSelected ? 0.10 : 0.04}
          side={THREE.BackSide}
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Label — visible within reasonable camera distance */}
      <Html
        center
        distanceFactor={600}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          fontFamily:    'serif',
          fontSize:      node.isKeyNode ? '13px' : '11px',
          color:         '#ffffff',
          opacity:       isHovered || isSelected ? 1 : 0.55,
          whiteSpace:    'nowrap',
          textShadow:    '0 0 8px rgba(0,0,0,0.9)',
          transform:     `translateY(${radius * 2.5}px)`,
          transition:    'opacity 0.2s',
          letterSpacing: '0.03em',
        }}>
          {node.label}
        </div>
      </Html>
    </group>
  );
}
