import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const STAR_COUNT = 600

function buildStarfield(): THREE.Points {
  const positions = new Float32Array(STAR_COUNT * 3)
  for (let i = 0; i < STAR_COUNT; i++) {
    const theta = Math.random() * Math.PI * 2
    const phi = Math.acos(2 * Math.random() - 1)
    const r = 120 + Math.random() * 30
    positions[i * 3] = r * Math.sin(phi) * Math.cos(theta)
    positions[i * 3 + 1] = Math.abs(r * Math.cos(phi))
    positions[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.BufferAttribute(positions, 3))
  const mat = new THREE.PointsMaterial({ color: '#e0e8ff', size: 0.4, sizeAttenuation: true })
  return new THREE.Points(geo, mat)
}

export default function Skybox() {
  const starsRef = useRef<THREE.Points>(null)

  useFrame((_, delta) => {
    if (starsRef.current) {
      starsRef.current.rotation.y += delta * 0.005
    }
  })

  return (
    <group>
      {/* Sky dome */}
      <mesh>
        <sphereGeometry args={[150, 32, 16]} />
        <meshBasicMaterial color="#030318" side={THREE.BackSide} />
      </mesh>

      {/* Horizon glow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -1, 0]}>
        <ringGeometry args={[20, 80, 64]} />
        <meshBasicMaterial color="#1e1060" side={THREE.DoubleSide} transparent opacity={0.6} />
      </mesh>

      {/* Stars */}
      <primitive ref={starsRef} object={buildStarfield()} />

      {/* Fog */}
      <fog attach="fog" args={['#0a0a1a', 40, 130]} />
    </group>
  )
}
