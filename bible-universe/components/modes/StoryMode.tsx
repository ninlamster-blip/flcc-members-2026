'use client';
/**
 * StoryMode — cinematic auto-fly controller.
 *
 * Phase 7 will implement:
 *   - Reads storyStops from the Zustand store
 *   - On each stop: flies camera to the node, shows narration overlay,
 *     holds for `stop.duration` ms, then advances to the next stop
 *   - Narration overlay: semi-transparent bottom bar with the current
 *     stop's narration text, animated in with Framer Motion
 *   - Controls: Play / Pause / Prev / Next / Stop
 *   - Progress indicator: dots showing current position in the journey
 *
 * The 16-stop story arc covers:
 *   Creation → Fall → Flood → Abraham → Exodus → David → Isaiah 53
 *   → Jesus (center) → Cross → Resurrection → Pentecost
 *   → Paul → Rome → Revelation → New Jerusalem → New Creation
 */

export default function StoryMode() {
  return null;
}
