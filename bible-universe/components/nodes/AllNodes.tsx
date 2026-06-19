'use client';
import { useMemo } from 'react';
import { useUniverseStore } from '@/store/universeStore';
import NodeMesh from './NodeMesh';
import type { LayerId } from '@/types/bible';

/**
 * Renders all non-supernode nodes that belong to currently visible layers.
 * Jesus is rendered separately via JesusNode to preserve its special visuals.
 */
export default function AllNodes() {
  const nodes        = useUniverseStore((s) => s.nodes);
  const visibleLayers = useUniverseStore((s) => s.visibleLayers);

  const visibleNodes = useMemo(
    () => nodes.filter(
      (n) => !n.isSupernode && n.position && visibleLayers.has(n.type as LayerId),
    ),
    [nodes, visibleLayers],
  );

  return (
    <>
      {visibleNodes.map((node) => (
        <NodeMesh key={node.id} node={node} />
      ))}
    </>
  );
}
