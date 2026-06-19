/**
 * Data architecture for Bible Universe.
 *
 * All data is static TypeScript — no API, no database.
 * Build time: data is tree-shaken and bundled by Next.js.
 * Runtime:    all nodes + connections load in <50ms.
 *
 * File map:
 *   data/eras.ts          — 13 era definitions with Z positions
 *   data/nodes/people.ts  — biblical persons (~25 nodes)
 *   data/nodes/places.ts  — locations (~15 nodes)
 *   data/nodes/events.ts  — historical events (~20 nodes)
 *   data/nodes/books.ts   — 66-book references (~15 key nodes)
 *   data/nodes/prophecies.ts — OT prophecies + NT fulfillments (~12 nodes)
 *   data/nodes/doctrines.ts  — theological themes (~8 nodes)
 *   data/connections.ts   — ~130 graph edges
 *   data/journeys.ts      — 4 Pauline missionary journeys
 *   data/storyStops.ts    — 16 cinematic story mode stops
 */

// ─── Era Z-axis positions ─────────────────────────────────────────────────────
// Creation is at the far positive Z end.
// Revelation is at the far negative Z end.
// Jesus Christ (life-of-christ) is pinned at Z = 0 — the center of the universe.

export const ERA_Z_POSITIONS = {
  'creation':            2400,
  'early-humanity':      1900,
  'patriarchs':          1400,
  'exodus':               900,
  'conquest':             550,
  'kingdom':              300,
  'divided-kingdom':      100,
  'exile':               -100,
  'restoration':         -300,
  'intertestamental':    -500,
  'life-of-christ':         0,  // ← Jesus at the origin
  'early-church':        -700,
  'revelation':         -1100,
} as const;

// ─── Cluster radii ────────────────────────────────────────────────────────────
// Controls how widely nodes spread in the XY plane around each era center.

export const ERA_CLUSTER_RADIUS = {
  'creation':           160,
  'early-humanity':     150,
  'patriarchs':         170,
  'exodus':             180,
  'conquest':           160,
  'kingdom':            200,
  'divided-kingdom':    190,
  'exile':              160,
  'restoration':        140,
  'intertestamental':   130,
  'life-of-christ':     210,  // largest — Life of Christ has the most nodes
  'early-church':       200,
  'revelation':         170,
} as const;

// ─── Performance targets ──────────────────────────────────────────────────────

export const PERF = {
  /** Max nodes rendered simultaneously before LOD kicks in. */
  maxVisibleNodes: 200,
  /** Camera distance at which node labels start fading. */
  labelFadeStart:  800,
  /** Camera distance at which labels are fully hidden. */
  labelFadeEnd:   2000,
  /** Max connection lines rendered at once. */
  maxConnections:  300,
} as const;
