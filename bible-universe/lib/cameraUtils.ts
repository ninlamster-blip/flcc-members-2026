import type { Vec3 } from '@/types/bible';

// ─── Easing ───────────────────────────────────────────────────────────────────

export function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
}

export function easeOutQuart(t: number): number {
  return 1 - Math.pow(1 - t, 4);
}

// ─── Math ─────────────────────────────────────────────────────────────────────

export function lerpVec3(a: Vec3, b: Vec3, t: number): Vec3 {
  return {
    x: a.x + (b.x - a.x) * t,
    y: a.y + (b.y - a.y) * t,
    z: a.z + (b.z - a.z) * t,
  };
}

export function distanceVec3(a: Vec3, b: Vec3): number {
  return Math.sqrt(
    Math.pow(b.x - a.x, 2) +
    Math.pow(b.y - a.y, 2) +
    Math.pow(b.z - a.z, 2),
  );
}

// ─── Fly-to Animation ─────────────────────────────────────────────────────────

export interface FlyToConfig {
  fromPos:    Vec3;
  toPos:      Vec3;
  fromTarget: Vec3;
  toTarget:   Vec3;
  /** Duration in milliseconds. Defaults to 1400ms. */
  duration?:  number;
}

/**
 * Generates a function that, given elapsed time t ∈ [0,1],
 * returns the interpolated camera position and look-at target.
 *
 * Usage in R3F useFrame:
 *   const anim = createFlyTo(config);
 *   camera.position.set(...anim(t).pos);
 *   controls.target.set(...anim(t).target);
 */
export function createFlyTo(config: FlyToConfig) {
  return (t: number) => {
    const e = easeInOutCubic(Math.min(t, 1));
    return {
      pos:    lerpVec3(config.fromPos,    config.toPos,    e),
      target: lerpVec3(config.fromTarget, config.toTarget, e),
    };
  };
}

// ─── Initial camera position ──────────────────────────────────────────────────

/**
 * Default camera starting position: slightly above, looking toward Jesus
 * (origin) from the Creation end of the timeline.
 */
export const INITIAL_CAMERA_POSITION: Vec3 = { x: 0, y: 300, z: 3200 };
export const INITIAL_CAMERA_TARGET:   Vec3 = { x: 0, y: 0,   z: 0    };

// ─── Presentation mode ────────────────────────────────────────────────────────

/** Slow orbit speed for church presentation mode. */
export const PRESENTATION_ORBIT_SPEED = 0.15;
export const EXPLORE_ORBIT_SPEED      = 0;
