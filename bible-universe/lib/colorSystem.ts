import type { NodeType, ConnectionType, EraId } from '@/types/bible';

// ─── Node Colors ──────────────────────────────────────────────────────────────

/** CSS hex strings for UI badges and labels. */
export const NODE_COLORS: Record<NodeType, string> = {
  person:    '#FFD700',
  place:     '#4488FF',
  event:     '#FFFFFF',
  book:      '#AA44FF',
  prophecy:  '#FF4444',
  doctrine:  '#44FF88',
};

/** Three.js hex numbers for 3D materials. */
export const NODE_COLORS_HEX: Record<NodeType, number> = {
  person:    0xffd700,
  place:     0x4488ff,
  event:     0xffffff,
  book:      0xaa44ff,
  prophecy:  0xff4444,
  doctrine:  0x44ff88,
};

/** Emissive intensity for each node type (higher = brighter glow). */
export const NODE_EMISSIVE_INTENSITY: Record<NodeType, number> = {
  person:    0.9,
  place:     0.7,
  event:     0.6,
  book:      1.0,
  prophecy:  1.2,
  doctrine:  0.8,
};

// ─── Node Radii ───────────────────────────────────────────────────────────────

export const NODE_RADIUS = {
  supernode: 24,   // Jesus Christ only
  key:       12,   // Abraham, Moses, David, Paul, etc.
  default:    6,   // All other nodes
} as const;

// ─── Connection Colors ────────────────────────────────────────────────────────

export const CONNECTION_COLORS: Record<ConnectionType, string> = {
  flow:      '#1E3A4A',
  prophecy:  '#FF6600',
  family:    '#88AAFF',
  theme:     '#AA88FF',
  geography: '#44AAFF',
};

export const CONNECTION_COLORS_HEX: Record<ConnectionType, number> = {
  flow:      0x1e3a4a,
  prophecy:  0xff6600,
  family:    0x88aaff,
  theme:     0xaa88ff,
  geography: 0x44aaff,
};

export const CONNECTION_OPACITY: Record<ConnectionType, number> = {
  flow:      0.25,
  prophecy:  0.65,
  family:    0.45,
  theme:     0.35,
  geography: 0.40,
};

// ─── Era Colors ───────────────────────────────────────────────────────────────

export const ERA_COLORS: Record<EraId, string> = {
  'creation':            '#FF8800',
  'early-humanity':      '#FF6644',
  'patriarchs':          '#FFAA00',
  'exodus':              '#FFD700',
  'conquest':            '#AADDFF',
  'kingdom':             '#88DDFF',
  'divided-kingdom':     '#4488FF',
  'exile':               '#8844FF',
  'restoration':         '#AA88FF',
  'intertestamental':    '#AAAAAA',
  'life-of-christ':      '#FFFFFF',
  'early-church':        '#44FF88',
  'revelation':          '#FF44AA',
};

export const ERA_COLORS_HEX: Record<EraId, number> = {
  'creation':            0xff8800,
  'early-humanity':      0xff6644,
  'patriarchs':          0xffaa00,
  'exodus':              0xffd700,
  'conquest':            0xaaddff,
  'kingdom':             0x88ddff,
  'divided-kingdom':     0x4488ff,
  'exile':               0x8844ff,
  'restoration':         0xaa88ff,
  'intertestamental':    0xaaaaaa,
  'life-of-christ':      0xffffff,
  'early-church':        0x44ff88,
  'revelation':          0xff44aa,
};

// ─── UI Colors ────────────────────────────────────────────────────────────────

export const UI = {
  panelBg:       'rgba(8, 8, 18, 0.95)',
  panelBorder:   'rgba(255, 255, 255, 0.10)',
  goldPrimary:   '#fbbf24',
  goldGlow:      'rgba(251, 191, 36, 0.30)',
  textMuted:     'rgba(255, 255, 255, 0.45)',
  textSecondary: 'rgba(255, 255, 255, 0.70)',
} as const;
