'use client';
import { useRef } from 'react';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import type { BibleEra } from '@/types/bible';
import { ERAS } from '@/data/eras';

export default function EraDiscs() {
  return (
    <group>
      {ERAS.map((era) => (
        <EraCluster key={era.id} era={era} />
      ))}
    </group>
  );
}

function EraCluster({ era }: { era: BibleEra }) {
  const color = new THREE.Color(era.color);
  const isChrist = era.id === 'life-of-christ';

  return (
    <group position={[0, 0, era.zPosition]}>
      {/* Nebula sphere — subtle color haze around each era cluster */}
      <mesh>
        <sphereGeometry args={[era.clusterRadius * 0.9, 16, 16]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isChrist ? 0.025 : 0.012}
          side={THREE.BackSide}
          depthWrite={false}
        />
      </mesh>

      {/* Floor disc */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -8, 0]}>
        <circleGeometry args={[era.clusterRadius, 64]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isChrist ? 0.06 : 0.025}
          depthWrite={false}
        />
      </mesh>

      {/* Ring outline on disc edge */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -7, 0]}>
        <ringGeometry args={[era.clusterRadius - 2, era.clusterRadius, 80]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={isChrist ? 0.28 : 0.14}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* For Christ era — extra inner ring for prominence */}
      {isChrist && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -6, 0]}>
          <ringGeometry args={[18, 24, 80]} />
          <meshBasicMaterial
            color={0xffd700}
            transparent
            opacity={0.35}
            side={THREE.DoubleSide}
            depthWrite={false}
            blending={THREE.AdditiveBlending}
          />
        </mesh>
      )}

      {/* Vertical era axis line — thin luminous post */}
      <mesh position={[0, 100, 0]}>
        <cylinderGeometry args={[0.5, 0.5, 200, 6]} />
        <meshBasicMaterial
          color={color}
          transparent
          opacity={0.08}
          depthWrite={false}
        />
      </mesh>

      {/* HTML label — scales with camera distance */}
      <Html
        center
        position={[0, 230, 0]}
        distanceFactor={1400}
        style={{ pointerEvents: 'none', userSelect: 'none' }}
      >
        <div style={{
          textAlign:     'center',
          color:         era.color,
          fontFamily:    'Georgia, serif',
          letterSpacing: '0.06em',
          textShadow:    `0 0 14px ${era.color}88`,
          lineHeight:    1.3,
        }}>
          <div style={{ fontSize: '13px', fontWeight: 'bold' }}>
            {era.label}
          </div>
          <div style={{ fontSize: '10px', opacity: 0.55, marginTop: 2 }}>
            {era.period}
          </div>
        </div>
      </Html>
    </group>
  );
}
