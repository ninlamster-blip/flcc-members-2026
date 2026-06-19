'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useUniverseStore } from '@/store/universeStore';
import { PAULS_JOURNEYS } from '@/data/journeys';
import type { JourneyWaypoint, PaulsJourney } from '@/types/bible';

// ── Geographic projection ─────────────────────────────────────────────────────
// Map the Mediterranean lat/lng range onto the 3D world near early-church era.
// Early-church era disc is at z = -700; we sit 20 units in front (toward viewer).

const CENTER_LNG = 24.0;   // ~middle of Paul's travel range
const CENTER_LAT = 37.0;   // ~middle latitude
const SCALE      = 18;     // world-units per degree
const Y_OFFSET   = -300;   // shift map below era node cluster
const Z_MAP      = -680;   // slightly in front of early-church disc (z = -700)

function project(lng: number, lat: number): THREE.Vector3 {
  return new THREE.Vector3(
    (lng - CENTER_LNG) * SCALE,
    (lat - CENTER_LAT) * SCALE + Y_OFFSET,
    Z_MAP,
  );
}

// Animated dot completes one full loop every CYCLE_SECS seconds.
const CYCLE_SECS = 22;

// Spread the 4 journeys across the cycle so they don't all sync up.
const PHASE_OFFSETS = [0, 0.25, 0.5, 0.75];

// ── Traveling dot ─────────────────────────────────────────────────────────────

interface TravelingDotProps {
  curve:       THREE.CatmullRomCurve3;
  color:       string;
  phaseOffset: number;
}

function TravelingDot({ curve, color, phaseOffset }: TravelingDotProps) {
  const meshRef = useRef<THREE.Mesh>(null!);
  const tRef    = useRef(phaseOffset);

  useFrame((_, delta) => {
    tRef.current = (tRef.current + delta / CYCLE_SECS) % 1;
    const pt = curve.getPoint(tRef.current);
    meshRef.current.position.set(pt.x, pt.y, pt.z + 4);
  });

  return (
    <mesh ref={meshRef}>
      <sphereGeometry args={[6, 10, 10]} />
      <meshStandardMaterial color={color} emissive={color} emissiveIntensity={4} />
    </mesh>
  );
}

// ── City marker ───────────────────────────────────────────────────────────────

function WaypointMarker({ waypoint, color }: { waypoint: JourneyWaypoint; color: string }) {
  const pos     = project(waypoint.lng, waypoint.lat);
  const isKey   = !!waypoint.placeId;
  const radius  = isKey ? 5.5 : 3.5;

  // Strip parenthetical clarifiers for brevity: "Antioch (Syria)" → "Antioch"
  const shortLabel = waypoint.label.replace(/\s*\(.*\)$/, '');

  return (
    <group position={[pos.x, pos.y, pos.z + 2]}>
      {/* Glow sphere */}
      <mesh>
        <sphereGeometry args={[radius, 8, 8]} />
        <meshStandardMaterial color={color} emissive={color} emissiveIntensity={isKey ? 2 : 1.2} />
      </mesh>

      {/* City label above the sphere */}
      <Html
        position={[0, radius + 4, 0]}
        center
        style={{
          whiteSpace:     'nowrap',
          fontSize:       isKey ? '10px' : '8px',
          fontFamily:     'serif',
          color,
          textShadow:     '0 1px 4px rgba(0,0,0,0.95)',
          pointerEvents:  'none',
          userSelect:     'none',
          letterSpacing:  '0.04em',
          fontWeight:     isKey ? 'bold' : 'normal',
        }}
      >
        {shortLabel}
      </Html>
    </group>
  );
}

// ── Single journey route ───────────────────────────────────────────────────────

interface JourneyRouteProps {
  journey:     PaulsJourney;
  phaseOffset: number;
}

function JourneyRoute({ journey, phaseOffset }: JourneyRouteProps) {
  const { lineObj, curve } = useMemo(() => {
    const sorted = journey.waypoints.slice().sort((a, b) => a.order - b.order);
    const pts    = sorted.map((wp) => project(wp.lng, wp.lat));

    // Smooth CatmullRom curve — used for both the drawn line and the animated dot
    const c         = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
    const curvePts  = c.getPoints(140);

    const geo = new THREE.BufferGeometry().setFromPoints(curvePts);
    const mat = new THREE.LineBasicMaterial({
      color:       parseInt(journey.color.replace('#', ''), 16),
      transparent: true,
      opacity:     0.70,
      depthWrite:  false,
    });

    return { lineObj: new THREE.Line(geo, mat), curve: c };
  }, [journey]);

  return (
    <group>
      <primitive object={lineObj} />
      {journey.waypoints.map((wp) => (
        <WaypointMarker
          key={`${journey.id}-wp-${wp.order}`}
          waypoint={wp}
          color={journey.color}
        />
      ))}
      <TravelingDot curve={curve} color={journey.color} phaseOffset={phaseOffset} />
    </group>
  );
}

// ── Root layer component ───────────────────────────────────────────────────────

export default function PaulsJourneyLayer() {
  const visibleLayers = useUniverseStore((s) => s.visibleLayers);

  if (!visibleLayers.has('pauls-journeys')) return null;

  return (
    <group>
      {PAULS_JOURNEYS.map((journey, i) => (
        <JourneyRoute
          key={journey.id}
          journey={journey}
          phaseOffset={PHASE_OFFSETS[i] ?? 0}
        />
      ))}
    </group>
  );
}
