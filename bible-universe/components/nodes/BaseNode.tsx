'use client';
/**
 * BaseNode — the foundational 3D sphere component for all node types.
 *
 * Phase 3 will implement:
 *   - MeshStandardMaterial with color + emissive from colorSystem
 *   - Outer glow halo (MeshBasicMaterial, AdditiveBlending, BackSide)
 *   - CSS2DObject label (via @react-three/drei <Html>)
 *   - Scale animation on hover (spring via framer-motion/three or R3F springs)
 *   - onPointerEnter → hoverNode(id)
 *   - onPointerLeave → hoverNode(null)
 *   - onClick       → selectNode(id)
 *   - Visibility driven by visibleLayers set
 *
 * Subclasses (PersonNode, PlaceNode, etc.) extend BaseNode with type-specific
 * visual accents (e.g., rings for doctrines, cross symbol for Jesus).
 */

import type { BibleNode } from '@/types/bible';

export interface BaseNodeProps {
  node: BibleNode;
}

export default function BaseNode(_props: BaseNodeProps) {
  // Phase 3 implementation
  return null;
}
