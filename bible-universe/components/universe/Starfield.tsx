'use client';
import { useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';

interface StarfieldProps {
  count?: number;
}

export default function Starfield({ count = 15000 }: StarfieldProps) {
  const meshRef = useRef<THREE.Points>(null);

  const [geometry, material] = useMemo(() => {
    const positions = new Float32Array(count * 3);
    const colors    = new Float32Array(count * 3);
    const sizes     = new Float32Array(count);

    for (let i = 0; i < count; i++) {
      // Distribute in a spherical shell between r=6000 and r=14000
      const r     = 6000 + Math.random() * 8000;
      const theta = Math.random() * Math.PI * 2;
      const phi   = Math.acos(2 * Math.random() - 1);

      positions[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);

      // Subtle color variation: warm white to cool blue-white
      const warmth = Math.random();
      colors[i * 3]     = 0.72 + warmth * 0.28;   // R
      colors[i * 3 + 1] = 0.72 + warmth * 0.16;   // G
      colors[i * 3 + 2] = 0.82 + warmth * 0.18;   // B

      sizes[i] = 0.5 + Math.random() * 1.8;
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geo.setAttribute('color',    new THREE.BufferAttribute(colors, 3));
    geo.setAttribute('size',     new THREE.BufferAttribute(sizes, 1));

    const mat = new THREE.PointsMaterial({
      size:            1.6,
      vertexColors:    true,
      transparent:     true,
      opacity:         0.88,
      sizeAttenuation: false,  // uniform pixel size regardless of depth
      depthWrite:      false,
    });

    return [geo, mat];
  }, [count]);

  // Very slow rotation — gives a sense of the universe breathing
  useFrame((_, delta) => {
    if (meshRef.current) {
      meshRef.current.rotation.y += delta * 0.005;
      meshRef.current.rotation.x += delta * 0.002;
    }
  });

  return <points ref={meshRef} geometry={geometry} material={material} />;
}
