'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useUniverseStore } from '@/store/universeStore';
import type { BibleConnection, Vec3 } from '@/types/bible';

const GOLD_HEX   = 0xffd000;
const GOLD_STR   = '#FFD000';
const CYCLE_SECS = 6;

// ── Geometry ──────────────────────────────────────────────────────────────────

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  return h;
}

/** Quadratic Bézier lifting high above the midpoint — the prophecy "rainbow arc". */
function propArcPts(from: Vec3, to: Vec3, seed: number, segments = 70): THREE.Vector3[] {
  const jitter = Math.sin(seed * 7.3 + 1.57) * 28;
  const cx = (from.x + to.x) / 2 + jitter;
  const cy = (from.y + to.y) / 2 + 500;   // dramatic Y lift
  const cz = (from.z + to.z) / 2;

  const pts: THREE.Vector3[] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    pts.push(new THREE.Vector3(
      u * u * from.x + 2 * u * t * cx + t * t * to.x,
      u * u * from.y + 2 * u * t * cy + t * t * to.y,
      u * u * from.z + 2 * u * t * cz + t * t * to.z,
    ));
  }
  return pts;
}

// ── Animated particle ─────────────────────────────────────────────────────────

function ProphecyParticle({ curve, phaseOffset, radius }: {
  curve:       THREE.CatmullRomCurve3;
  phaseOffset: number;
  radius:      number;
}) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const tRef    = useRef(phaseOffset);

  useFrame((_, delta) => {
    tRef.current = (tRef.current + delta / CYCLE_SECS) % 1;
    const pt = curve.getPoint(tRef.current);
    meshRef.current.position.copy(pt);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[radius, 8, 8]} />
      <meshStandardMaterial color={GOLD_STR} emissive={GOLD_STR} emissiveIntensity={5} />
    </mesh>
  );
}

// ── Single prophecy arc ───────────────────────────────────────────────────────

interface ProphecyArcProps {
  conn:    BibleConnection;
  fromPos: Vec3;
  toPos:   Vec3;
}

function ProphecyArc({ conn, fromPos, toPos }: ProphecyArcProps) {
  const seed         = hashStr(conn.id);
  const baseRadius   = conn.weight === 3 ? 7 : conn.weight === 2 ? 5.5 : 4;

  const { lineObj, curve, apex } = useMemo(() => {
    const pts = propArcPts(fromPos, toPos, seed);
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color:       GOLD_HEX,
      transparent: true,
      opacity:     conn.weight === 3 ? 0.70 : 0.50,
      depthWrite:  false,
    });
    const c = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const ap = c.getPoint(0.5); // apex for label placement
    return { lineObj: new THREE.Line(geo, mat), curve: c, apex: ap };
  }, [fromPos, toPos, seed, conn.weight]);

  return (
    <group>
      {/* Gold arc line */}
      <primitive object={lineObj} />

      {/* Traveling particles — lead + trailing */}
      <ProphecyParticle curve={curve} phaseOffset={0}    radius={baseRadius} />
      <ProphecyParticle curve={curve} phaseOffset={0.50} radius={baseRadius * 0.65} />

      {/* Scripture reference label at arc apex */}
      <Html position={[apex.x, apex.y + 10, apex.z]} center>
        <div style={{
          fontFamily:    'serif',
          fontSize:       '8px',
          letterSpacing: '0.06em',
          color:          GOLD_STR,
          textShadow:    '0 0 8px rgba(0,0,0,0.95)',
          whiteSpace:    'nowrap',
          pointerEvents: 'none',
          userSelect:    'none',
          opacity:        0.85,
        }}>
          {conn.scriptureRef ?? conn.label}
        </div>
      </Html>
    </group>
  );
}

// ── Root component ────────────────────────────────────────────────────────────

export default function ProphecyLayer() {
  const visibleLayers = useUniverseStore((s) => s.visibleLayers);
  const nodes         = useUniverseStore((s) => s.nodes);
  const connections   = useUniverseStore((s) => s.connections);

  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const prophecyConns = useMemo(
    () => connections.filter((c) => c.type === 'prophecy'),
    [connections],
  );

  if (!visibleLayers.has('prophecies')) return null;

  return (
    <group>
      {prophecyConns.map((conn) => {
        const from = nodeMap.get(conn.fromId);
        const to   = nodeMap.get(conn.toId);
        if (!from?.position || !to?.position) return null;
        return (
          <ProphecyArc
            key={conn.id}
            conn={conn}
            fromPos={from.position}
            toPos={to.position}
          />
        );
      })}
    </group>
  );
}
