// ─── Node Types ───────────────────────────────────────────────────────────────

/** What kind of biblical entity a node represents. */
export type NodeType =
  | 'person'     // biblical figure (gold sphere)
  | 'place'      // location (blue sphere)
  | 'event'      // historical event (white sphere)
  | 'book'       // one of the 66 books (purple sphere)
  | 'prophecy'   // OT prophecy or NT fulfillment (red sphere)
  | 'doctrine';  // theological theme or doctrine (green sphere)

/** How two nodes are related. */
export type ConnectionType =
  | 'flow'       // chronological / narrative sequence
  | 'prophecy'   // OT prophecy → NT fulfillment arc
  | 'family'     // genealogical / relational link
  | 'theme'      // same motif or symbol across eras
  | 'geography'; // share the same location

/** All 13 biblical eras in chronological order. */
export type EraId =
  | 'creation'
  | 'early-humanity'
  | 'patriarchs'
  | 'exodus'
  | 'conquest'
  | 'kingdom'
  | 'divided-kingdom'
  | 'exile'
  | 'restoration'
  | 'intertestamental'
  | 'life-of-christ'
  | 'early-church'
  | 'revelation';

/** User-facing navigation mode. */
export type AppMode =
  | 'explore'        // free-roam 3D navigation
  | 'story'          // cinematic auto-fly through history
  | 'learn'          // guided teacher mode with callouts
  | 'presentation';  // church/classroom mode (full-screen, minimal UI)

/** Toggleable visualization layers. */
export type LayerId =
  | 'people'
  | 'places'
  | 'events'
  | 'books'
  | 'prophecies'
  | 'doctrines'
  | 'timeline'
  | 'geography'
  | 'family-tree'
  | 'pauls-journeys'
  | 'revelation-layer';

// ─── Core Data Structures ─────────────────────────────────────────────────────

export interface Vec3 {
  x: number;
  y: number;
  z: number;
}

/**
 * A single node in the Bible knowledge graph.
 * offsetX/offsetY define position within the era cluster (XY plane).
 * `position` is computed at runtime by graphLayout.ts.
 */
export interface BibleNode {
  id: string;
  label: string;
  type: NodeType;
  eraId: EraId;
  description: string;
  verses: string[];
  /** Pre-defined offset from era cluster center, X axis (east/west). */
  offsetX: number;
  /** Pre-defined offset from era cluster center, Y axis (up/down). */
  offsetY: number;
  /** Computed 3D world position — set by graphLayout.computeLayout(). */
  position?: Vec3;
  tags?: string[];
  /** Renders larger and brighter — major biblical figures. */
  isKeyNode?: boolean;
  /** Maximum prominence — used only for Jesus Christ. */
  isSupernode?: boolean;
}

/**
 * A directed or bidirectional edge in the knowledge graph.
 * `weight` controls visual line thickness (1 = thin, 3 = thick).
 */
export interface BibleConnection {
  id: string;
  fromId: string;
  toId: string;
  type: ConnectionType;
  weight?: 1 | 2 | 3;
  label?: string;
  scriptureRef?: string;
}

/**
 * One of the 13 biblical eras.
 * `zPosition` is the 3D scene Z coordinate for the era cluster.
 * Jesus (life-of-christ) is fixed at z = 0 — the center of the universe.
 */
export interface BibleEra {
  id: EraId;
  label: string;
  period: string;         // e.g., "~4000–2350 BC"
  color: string;          // hex color for era disc and label
  zPosition: number;      // Z coordinate in 3D scene
  clusterRadius: number;  // max XY spread of nodes in this era
  description: string;
  books?: string[];        // canonical books associated with this era
}

// ─── Paul's Journeys ──────────────────────────────────────────────────────────

export interface JourneyWaypoint {
  placeId?: string;        // optional link to a place BibleNode
  label: string;
  lat: number;
  lng: number;
  scriptureRef: string;
  description?: string;
  order: number;
}

export interface PaulsJourney {
  id: string;
  label: string;           // "1st Missionary Journey"
  color: string;           // route line color
  period: string;          // "~AD 46–48"
  scriptureRef: string;    // primary scripture passage
  waypoints: JourneyWaypoint[];
}

// ─── Story Mode ───────────────────────────────────────────────────────────────

export interface StoryStop {
  nodeId: string;
  narration: string;
  /** Camera offset from node position: [dx, dy, dz] */
  cameraOffset: [number, number, number];
  /** Milliseconds to hold at this stop before advancing. */
  duration: number;
}

// ─── Search ───────────────────────────────────────────────────────────────────

export interface SearchResult {
  node: BibleNode;
  score: number;
  matchedField: 'label' | 'description' | 'verses' | 'tags';
}
