import { Canvas } from '@react-three/fiber'
import Track from '@/entities/Track'
import Player from '@/entities/Player'
import Skybox from '@/entities/Skybox'
import { PLAYER_Z } from '@/utils/constants'

export default function GameScene() {
  return (
    <Canvas
      shadows
      camera={{ position: [0, 3.5, PLAYER_Z + 9], fov: 58, near: 0.1, far: 300 }}
      gl={{ antialias: true, powerPreference: 'high-performance' }}
      className="absolute inset-0"
    >
      <Skybox />

      <ambientLight intensity={0.35} />
      <directionalLight
        position={[4, 10, 8]}
        intensity={1.1}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-camera-near={0.1}
        shadow-camera-far={60}
        shadow-camera-left={-12}
        shadow-camera-right={12}
        shadow-camera-top={12}
        shadow-camera-bottom={-12}
      />
      {/* Rim light from front-right for heavenly glow */}
      <pointLight position={[6, 5, PLAYER_Z]} intensity={0.6} color="#a78bfa" />

      <Track />
      <Player />
    </Canvas>
  )
}
