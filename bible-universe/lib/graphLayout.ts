import type { BibleNode, BibleEra, BibleConnection, Vec3 } from '@/types/bible';

// ─── Layout Engine ────────────────────────────────────────────────────────────

/**
 * Assigns final 3D world positions to all nodes.
 *
 * Layout strategy:
 *   - Eras are arranged along the Z axis: past (+Z) → future (-Z)
 *   - Jesus Christ (isSupernode) is pinned to the origin (0, 0, 0)
 *   - Nodes spread in the XY plane using pre-defined offsetX/offsetY
 *   - Golden-ratio jitter on Z prevents flat "walls" of nodes per era
 *
 * Returns a new array of nodes with `position` populated.
 */
export function computeLayout(
  nodes:       BibleNode[],
  eras:        BibleEra[],
): BibleNode[] {
  const eraZMap = new Map<string, number>(eras.map((e) => [e.id, e.zPosition]));

  return nodes.map((node, i) => {
    if (node.isSupernode) {
      return { ...node, position: { x: 0, y: 0, z: 0 } };
    }

    const eraZ  = eraZMap.get(node.eraId) ?? 0;
    // Golden-ratio jitter: each node gets a unique but deterministic Z offset
    const jitter = Math.sin(i * 1.6180339887) * 30;

    return {
      ...node,
      position: {
        x: node.offsetX,
        y: node.offsetY,
        z: eraZ + jitter,
      },
    };
  });
}

/**
 * Returns the set of node IDs directly connected to `nodeId` (1 hop).
 */
export function getConnectedNodeIds(
  nodeId:      string,
  connections: Pick<BibleConnection, 'fromId' | 'toId'>[],
): Set<string> {
  const ids = new Set<string>();
  for (const { fromId, toId } of connections) {
    if (fromId === nodeId) ids.add(toId);
    if (toId   === nodeId) ids.add(fromId);
  }
  return ids;
}

/**
 * Returns all nodes within `hops` connections of `nodeId`.
 * Used for the "highlight neighborhood" feature on selection.
 */
export function getNeighborhood(
  nodeId:      string,
  connections: Pick<BibleConnection, 'fromId' | 'toId'>[],
  hops = 1,
): Set<string> {
  const visited = new Set<string>([nodeId]);
  let frontier  = new Set<string>([nodeId]);

  for (let h = 0; h < hops; h++) {
    const next = new Set<string>();
    Array.from(frontier).forEach((fid) => {
      connections.forEach(({ fromId, toId }) => {
        if (fromId === fid && !visited.has(toId))   next.add(toId);
        if (toId   === fid && !visited.has(fromId)) next.add(fromId);
      });
    });
    next.forEach((id) => visited.add(id));
    frontier = next;
  }

  visited.delete(nodeId);
  return visited;
}

// ─── Curve Generation ─────────────────────────────────────────────────────────

/**
 * Generates a quadratic Bézier arc between two 3D points.
 *
 * For prophecy arcs, the control point lifts high above center, creating
 * the characteristic "rainbow arc" from OT prophecy to NT fulfillment.
 */
export function arcPoints(
  from:        Vec3,
  to:          Vec3,
  type:        'flow' | 'prophecy' | 'family' | 'theme' | 'geography',
  segments = 40,
): [number, number, number][] {
  const midX = (from.x + to.x) / 2 + (Math.random() - 0.5) * 40;
  const midZ = (from.z + to.z) / 2;

  const liftY = type === 'prophecy'
    ? 280                              // tall arc for prophecy fulfillment
    : type === 'family'
    ? 60
    : 40;
  const midY = (from.y + to.y) / 2 + liftY;

  const pts: [number, number, number][] = [];
  for (let i = 0; i <= segments; i++) {
    const t = i / segments;
    const u = 1 - t;
    pts.push([
      u * u * from.x + 2 * u * t * midX + t * t * to.x,
      u * u * from.y + 2 * u * t * midY + t * t * to.y,
      u * u * from.z + 2 * u * t * midZ + t * t * to.z,
    ]);
  }
  return pts;
}

// ─── Camera Helpers ───────────────────────────────────────────────────────────

/**
 * Returns the ideal 3D camera position for framing a given node.
 * Distance scales with node prominence.
 */
export function cameraPositionForNode(
  pos:          Vec3,
  isSupernode?: boolean,
  isKeyNode?:   boolean,
): Vec3 {
  const dist = isSupernode ? 380 : isKeyNode ? 240 : 170;
  return {
    x: pos.x,
    y: pos.y + dist * 0.35,
    z: pos.z + dist,
  };
}

/**
 * Fits the camera to show all nodes in a given era.
 */
export function cameraPositionForEra(
  eraZ:         number,
  clusterRadius: number,
): Vec3 {
  return {
    x: 0,
    y: clusterRadius * 0.6,
    z: eraZ + clusterRadius * 2.5,
  };
}
