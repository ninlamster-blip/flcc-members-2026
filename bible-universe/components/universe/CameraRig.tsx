'use client';
import { useEffect, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import * as THREE from 'three';
import { useUniverseStore } from '@/store/universeStore';
import { easeInOutCubic, PRESENTATION_ORBIT_SPEED } from '@/lib/cameraUtils';

interface AnimState {
  active:      boolean;
  startPos:    THREE.Vector3;
  endPos:      THREE.Vector3;
  startTarget: THREE.Vector3;
  endTarget:   THREE.Vector3;
  elapsed:     number;
  duration:    number; // seconds
}

/**
 * CameraRig — drives all programmatic camera movement.
 *
 * Subscribes to the Zustand store's cameraPosition + cameraTarget.
 * When either changes (via selectNode / story mode / search), it kicks off
 * a smooth eased fly-to animation in useFrame.
 *
 * Must be rendered inside the R3F <Canvas> tree.
 */
export default function CameraRig() {
  const { camera } = useThree();
  const animRef        = useRef<AnimState | null>(null);
  const currentTarget  = useRef(new THREE.Vector3(0, 0, 0));

  // Subscribe to store — trigger animation when camera target/position changes
  useEffect(() => {
    let prevPos = useUniverseStore.getState().cameraPosition;
    let prevTgt = useUniverseStore.getState().cameraTarget;

    const unsub = useUniverseStore.subscribe((state) => {
      const { cameraPosition, cameraTarget } = state;

      if (cameraPosition === prevPos && cameraTarget === prevTgt) return;
      prevPos = cameraPosition;
      prevTgt = cameraTarget;

      animRef.current = {
        active:      true,
        startPos:    camera.position.clone(),
        endPos:      new THREE.Vector3(...cameraPosition),
        startTarget: currentTarget.current.clone(),
        endTarget:   new THREE.Vector3(...cameraTarget),
        elapsed:     0,
        duration:    1.4,
      };
    });

    return unsub;
  }, [camera]);

  useFrame((state, delta) => {
    const controls = state.controls as any;

    // Keep currentTarget in sync when idle
    if (!animRef.current?.active) {
      if (controls?.target) currentTarget.current.copy(controls.target);

      // Presentation mode — slow auto-rotate
      if (useUniverseStore.getState().mode === 'presentation' && controls) {
        controls.autoRotate      = true;
        controls.autoRotateSpeed = PRESENTATION_ORBIT_SPEED;
      } else if (controls) {
        controls.autoRotate = false;
      }
      return;
    }

    const anim = animRef.current;
    anim.elapsed += delta;
    const t = easeInOutCubic(Math.min(anim.elapsed / anim.duration, 1));

    state.camera.position.lerpVectors(anim.startPos, anim.endPos, t);

    if (controls?.target) {
      controls.target.lerpVectors(anim.startTarget, anim.endTarget, t);
    }

    if (t >= 1) {
      state.camera.position.copy(anim.endPos);
      if (controls?.target) {
        controls.target.copy(anim.endTarget);
        currentTarget.current.copy(anim.endTarget);
      }
      anim.active = false;
    }
  });

  return null;
}
