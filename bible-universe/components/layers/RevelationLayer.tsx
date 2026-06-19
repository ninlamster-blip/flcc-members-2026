'use client';
import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Html } from '@react-three/drei';
import * as THREE from 'three';
import { useUniverseStore } from '@/store/universeStore';

const PINK     = '#FF44AA';
const PINK_HEX = 0xFF44AA;
const GOLD     = '#FFE066';
const REV_Z    = -1100;

// ── Seven Churches of Revelation (Rev 2–3) ────────────────────────────────────
// Arranged in a ring of lampstands around the Throne Room — matching the imagery
// of Rev 1:12-13: "seven golden lampstands, and in their midst one like a son of man."

const CHURCHES = [
  { label: 'Ephesus',      ref: 'Rev 2:1–7',   note: 'Return to your first love'        },
  { label: 'Smyrna',       ref: 'Rev 2:8–11',  note: 'Be faithful unto death'            },
  { label: 'Pergamum',     ref: 'Rev 2:12–17', note: 'Hold fast to my name'              },
  { label: 'Thyatira',     ref: 'Rev 2:18–29', note: 'Hold fast till I come'             },
  { label: 'Sardis',       ref: 'Rev 3:1–6',   note: 'Strengthen what remains'           },
  { label: 'Philadelphia', ref: 'Rev 3:7–13',  note: 'An open door no one can shut'      },
  { label: 'Laodicea',     ref: 'Rev 3:14–22', note: 'Be zealous and repent'             },
];

const RING_R = 210; // world units from center to each lampstand

// ── Rotating throne-room rings ─────────────────────────────────────────────────

function ThroneRoom() {
  const ring1Ref = useRef<THREE.Mesh>(null!);
  const ring2Ref = useRef<THREE.Mesh>(null!);
  const ring3Ref = useRef<THREE.Mesh>(null!);
  const mat1Ref  = useRef<THREE.MeshBasicMaterial>(null!);
  const mat2Ref  = useRef<THREE.MeshBasicMaterial>(null!);
  const mat3Ref  = useRef<THREE.MeshBasicMaterial>(null!);
  const clockRef = useRef(0);

  useFrame((_, delta) => {
    clockRef.current += delta;
    const pulse = Math.sin(clockRef.current * 1.2) * 0.18 + 0.55;

    ring1Ref.current.rotation.z  += delta * 0.25;
    ring2Ref.current.rotation.x  += delta * 0.18;
    ring2Ref.current.rotation.z  -= delta * 0.12;
    ring3Ref.current.rotation.y  += delta * 0.35;
    ring3Ref.current.rotation.x  -= delta * 0.08;

    mat1Ref.current.opacity = pulse;
    mat2Ref.current.opacity = pulse * 0.65;
    mat3Ref.current.opacity = pulse * 0.45;
  });

  return (
    <group position={[0, 0, REV_Z]}>
      {/* Outer ring — orbits on Z plane */}
      <mesh ref={ring1Ref}>
        <ringGeometry args={[130, 138, 72]} />
        <meshBasicMaterial
          ref={mat1Ref}
          color={PINK_HEX}
          transparent
          opacity={0.55}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Middle ring — tilted 55° on X */}
      <mesh ref={ring2Ref} rotation={[Math.PI * 0.3, 0, 0]}>
        <ringGeometry args={[90, 96, 72]} />
        <meshBasicMaterial
          ref={mat2Ref}
          color={PINK_HEX}
          transparent
          opacity={0.40}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Inner ring — tilted on multiple axes */}
      <mesh ref={ring3Ref} rotation={[0, Math.PI * 0.25, 0]}>
        <ringGeometry args={[55, 60, 72]} />
        <meshBasicMaterial
          ref={mat3Ref}
          color={0xffbbdd}
          transparent
          opacity={0.35}
          depthWrite={false}
          side={THREE.DoubleSide}
        />
      </mesh>

      {/* Central glow — the throne */}
      <mesh>
        <sphereGeometry args={[22, 16, 16]} />
        <meshStandardMaterial
          color={PINK}
          emissive={PINK}
          emissiveIntensity={3.5}
          transparent
          opacity={0.85}
        />
      </mesh>

      {/* "New Jerusalem" label */}
      <Html position={[0, 180, 0]} center>
        <div style={{
          fontFamily:    'serif',
          fontSize:       '10px',
          letterSpacing: '0.14em',
          textTransform: 'uppercase',
          color:          GOLD,
          textShadow:    '0 0 10px rgba(0,0,0,0.95)',
          pointerEvents: 'none',
          userSelect:    'none',
          textAlign:     'center',
          lineHeight:     1.5,
        }}>
          Throne of God<br />
          <span style={{ fontSize: '8px', color: PINK, opacity: 0.85 }}>Rev 4:2 · 21:3</span>
        </div>
      </Html>
    </group>
  );
}

// ── Church lampstand marker ────────────────────────────────────────────────────

interface LampstandProps {
  label:   string;
  ref_:    string;
  note:    string;
  angle:   number;
}

function Lampstand({ label, ref_, note, angle }: LampstandProps) {
  const x = Math.cos(angle) * RING_R;
  const y = Math.sin(angle) * RING_R;

  return (
    <group position={[x, y, REV_Z]}>
      {/* Glowing sphere */}
      <mesh>
        <sphereGeometry args={[7, 10, 10]} />
        <meshStandardMaterial color={PINK} emissive={PINK} emissiveIntensity={2.5} />
      </mesh>

      {/* Church label */}
      <Html position={[0, 18, 0]} center>
        <div style={{
          fontFamily:    'serif',
          fontSize:       '9px',
          fontWeight:    'bold',
          letterSpacing: '0.06em',
          color:          PINK,
          textShadow:    '0 0 8px rgba(0,0,0,0.95)',
          pointerEvents: 'none',
          userSelect:    'none',
          whiteSpace:    'nowrap',
          textAlign:     'center',
          lineHeight:     1.4,
        }}>
          {label}<br />
          <span style={{ fontSize: '7px', color: GOLD, fontWeight: 'normal' }}>{ref_}</span>
        </div>
      </Html>
    </group>
  );
}

// ── Lampstand ring line ────────────────────────────────────────────────────────

function LampstandRing() {
  const lineObj = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const N = CHURCHES.length;
    for (let i = 0; i <= N; i++) {
      const angle = (i / N) * Math.PI * 2 - Math.PI / 2;
      pts.push(new THREE.Vector3(
        Math.cos(angle) * RING_R,
        Math.sin(angle) * RING_R,
        REV_Z,
      ));
    }
    const geo = new THREE.BufferGeometry().setFromPoints(pts);
    const mat = new THREE.LineBasicMaterial({
      color:       PINK_HEX,
      transparent: true,
      opacity:     0.25,
      depthWrite:  false,
    });
    return new THREE.Line(geo, mat);
  }, []);

  return <primitive object={lineObj} />;
}

// ── Root component ────────────────────────────────────────────────────────────

export default function RevelationLayer() {
  const visibleLayers = useUniverseStore((s) => s.visibleLayers);

  if (!visibleLayers.has('revelation-layer')) return null;

  return (
    <group>
      {/* Throne Room at the center of the Revelation era */}
      <ThroneRoom />

      {/* Ring connecting all 7 lampstands */}
      <LampstandRing />

      {/* Seven lampstands (churches) */}
      {CHURCHES.map((church, i) => {
        const angle = (i / CHURCHES.length) * Math.PI * 2 - Math.PI / 2;
        return (
          <Lampstand
            key={church.label}
            label={church.label}
            ref_={church.ref}
            note={church.note}
            angle={angle}
          />
        );
      })}
    </group>
  );
}
