import { Canvas } from '@react-three/fiber'

export default function GameScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 4, 8], fov: 60, near: 0.1, far: 300 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      className="absolute inset-0"
    >
      <color attach="background" args={['#0a0a1a']} />
      <ambientLight intensity={0.4} />
      <directionalLight position={[5, 10, 5]} intensity={1.2} castShadow />

      {/* Track placeholder — Milestone 2 will replace this */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[9, 120]} />
        <meshStandardMaterial color="#1e1b4b" />
      </mesh>

      {/* Lane markers */}
      {[-3, 0, 3].map((x) => (
        <mesh key={x} position={[x, 0.01, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[0.05, 120]} />
          <meshBasicMaterial color="#4338ca" opacity={0.5} transparent />
        </mesh>
      ))}
    </Canvas>
  )
}
