'use client';
import { Suspense } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, AdaptiveDpr, AdaptiveEvents } from '@react-three/drei';
import { EffectComposer, Bloom, Vignette } from '@react-three/postprocessing';
import * as THREE from 'three';
import Starfield  from './Starfield';
import EraDiscs   from './EraDiscs';
import CameraRig  from './CameraRig';
import JesusNode       from '@/components/nodes/JesusNode';
import AllNodes        from '@/components/nodes/AllNodes';
import ConnectionLayer    from './ConnectionLayer';
import PaulsJourneyLayer  from '@/components/layers/PaulsJourneyLayer';
import ProphecyLayer      from '@/components/layers/ProphecyLayer';
import RevelationLayer   from '@/components/layers/RevelationLayer';
import { INITIAL_CAMERA_POSITION } from '@/lib/cameraUtils';

/**
 * Scene — the R3F Canvas and complete 3D scene graph.
 *
 * Camera: PerspectiveCamera fov=60, starts looking toward Jesus (origin)
 *         from the Creation end of the timeline.
 *
 * Post-processing:
 *   - Bloom: makes emissive materials glow (nodes, Jesus, era discs)
 *   - Vignette: darkens corners for cinematic depth
 *
 * Performance:
 *   - AdaptiveDpr: drops pixel ratio under load to maintain 60fps
 *   - AdaptiveEvents: pauses raycasting when idle
 */
export default function Scene() {
  return (
    <Canvas
      camera={{
        fov:      60,
        near:     1,
        far:      20000,
        position: [
          INITIAL_CAMERA_POSITION.x,
          INITIAL_CAMERA_POSITION.y,
          INITIAL_CAMERA_POSITION.z,
        ],
      }}
      gl={{
        antialias:            true,
        powerPreference:      'high-performance',
        toneMapping:          THREE.ReinhardToneMapping,
        toneMappingExposure:  1.4,
      }}
      dpr={[1, 2]}
      style={{ position: 'absolute', inset: 0 }}
    >
      {/* Background fill */}
      <color attach="background" args={['#020510']} />

      {/* ── Lighting ───────────────────────────────────────────────── */}
      <ambientLight color={0x1a1a33} intensity={1.2} />
      <directionalLight position={[200, 300, 500]} intensity={0.3} color={0xffffff} />

      {/* ── Scene content ──────────────────────────────────────────── */}
      <Suspense fallback={null}>
        <Starfield count={15000} />
        <EraDiscs />
        <ConnectionLayer />
        <ProphecyLayer />
        <RevelationLayer />
        <PaulsJourneyLayer />
        <AllNodes />
        <JesusNode />
      </Suspense>

      {/* ── Camera ─────────────────────────────────────────────────── */}
      <CameraRig />
      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.06}
        minDistance={80}
        maxDistance={8000}
        target={[0, 0, 0]}
        enablePan={true}
        panSpeed={0.8}
        rotateSpeed={0.6}
        zoomSpeed={1.0}
      />

      {/* ── Post-processing ────────────────────────────────────────── */}
      <EffectComposer>
        <Bloom
          luminanceThreshold={0.25}
          intensity={0.9}
          mipmapBlur
          radius={0.75}
        />
        <Vignette offset={0.4} darkness={0.6} />
      </EffectComposer>

      {/* ── Performance adaptors ───────────────────────────────────── */}
      <AdaptiveDpr pixelated />
      <AdaptiveEvents />
    </Canvas>
  );
}
