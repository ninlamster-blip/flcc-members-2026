'use client';
import { useMemo } from 'react';
import * as THREE from 'three';
import { useUniverseStore } from '@/store/universeStore';
import { arcPoints } from '@/lib/graphLayout';
import { CONNECTION_COLORS_HEX, CONNECTION_OPACITY } from '@/lib/colorSystem';
import type { BibleConnection, Vec3 } from '@/types/bible';

function hashStr(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0;
  }
  return h;
}

interface ArcLineProps {
  conn:           BibleConnection;
  fromPos:        Vec3;
  toPos:          Vec3;
  selectedNodeId: string | null;
}

function ArcLine({ conn, fromPos, toPos, selectedNodeId }: ArcLineProps) {
  const { lineObj, mat } = useMemo(() => {
    const pts = arcPoints(fromPos, toPos, conn.type, 40, hashStr(conn.id));
    const geo = new THREE.BufferGeometry();
    geo.setFromPoints(pts.map(([x, y, z]) => new THREE.Vector3(x, y, z)));
    const m = new THREE.LineBasicMaterial({
      color:       CONNECTION_COLORS_HEX[conn.type],
      transparent: true,
      opacity:     CONNECTION_OPACITY[conn.type],
      depthWrite:  false,
    });
    return { lineObj: new THREE.Line(geo, m), mat: m };
  }, [fromPos, toPos, conn.type, conn.id]);

  // Mutate material opacity directly — valid in R3F render body
  const isActive = !selectedNodeId || conn.fromId === selectedNodeId || conn.toId === selectedNodeId;
  const base     = CONNECTION_OPACITY[conn.type];
  mat.opacity    = selectedNodeId
    ? (isActive ? Math.min(base * 3.0, 0.90) : base * 0.08)
    : base;

  return <primitive object={lineObj} />;
}

export default function ConnectionLayer() {
  const nodes          = useUniverseStore((s) => s.nodes);
  const connections    = useUniverseStore((s) => s.connections);
  const selectedNodeId = useUniverseStore((s) => s.selectedNodeId);

  const nodeMap = useMemo(
    () => new Map(nodes.map((n) => [n.id, n])),
    [nodes],
  );

  const valid = useMemo(
    () => connections.filter((c) => {
      if (c.type === 'prophecy') return false; // ProphecyLayer renders these with enhanced visuals
      const f = nodeMap.get(c.fromId);
      const t = nodeMap.get(c.toId);
      return f?.position && t?.position;
    }),
    [connections, nodeMap],
  );

  return (
    <>
      {valid.map((conn) => (
        <ArcLine
          key={conn.id}
          conn={conn}
          fromPos={nodeMap.get(conn.fromId)!.position!}
          toPos={nodeMap.get(conn.toId)!.position!}
          selectedNodeId={selectedNodeId}
        />
      ))}
    </>
  );
}
