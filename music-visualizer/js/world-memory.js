// World Memory — the persistent, cross-session "universe" state behind the
// idea that the visualizer's world accumulates your listening history
// instead of resetting fresh for every song. Two things persist across
// tracks (and across browser sessions, via localStorage):
//
// 1. A bounded belt of "landmarks" — one small shape added per track
//    actually listened to (not one abandoned in the first couple
//    seconds), colored and sized from that track's real theme/mood/energy
//    read, not randomly. Once the belt hits its cap, the oldest landmark
//    is recycled to make room for the newest, so the world stays large
//    but bounded rather than growing forever.
// 2. A slowly-decaying weighted history of which themes you've actually
//    listened to, which very gradually tints the ambient background
//    toward your session's overall taste rather than snapping instantly
//    to whatever's playing right now.
//
// Honesty note: this is NOT the "nebulae for ambient, cities for
// classical" literal biome system from the original pitch — five
// dedicated hand-built 3D biomes is a much larger undertaking than one
// pass justifies, especially unseen (this sandbox can't render Three.js
// at all to verify any of it). What's here is real and novel: an
// accumulating, per-track-colored landmark field and a genuinely
// history-weighted background tint, both grounded in the same real
// theme/mood data every other feature in this app already uses — just
// not five distinct hand-built worlds.

const STORE_KEY = 'mv-world';
const MAX_LANDMARKS = 80;
const HISTORY_DECAY = 0.985; // per recorded entry — recent listening matters more

function emptyWorld() {
  return { songsPlayed: 0, landmarks: [], themeWeights: {} };
}

export function loadWorld() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    if (!parsed || !Array.isArray(parsed.landmarks) || typeof parsed.themeWeights !== 'object') return emptyWorld();
    return parsed;
  } catch {
    return emptyWorld();
  }
}

export function saveWorld(world) {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(world));
  } catch { /* storage full/unavailable — the world just won't grow further this session */ }
}

/** Adds one landmark for a track that was actually heard, derived from its
 * real theme read at the time it finished. Mutates and returns `world` for
 * convenience — callers are responsible for saveWorld()ing it. */
export function addLandmark(world, { hue, sat, energy, themeName }) {
  const landmark = {
    hue: hue ?? 0.069,
    sat: sat ?? 0.6,
    size: 0.3 + clamp01(energy ?? 0.4) * 0.7,
    angle: Math.random() * Math.PI * 2,
    tilt: (Math.random() - 0.5) * 0.6,
    radiusOffset: Math.random(),
    addedAt: Date.now(),
  };
  world.landmarks.push(landmark);
  if (world.landmarks.length > MAX_LANDMARKS) world.landmarks.shift();
  world.songsPlayed += 1;

  if (themeName) {
    for (const key of Object.keys(world.themeWeights)) world.themeWeights[key] *= HISTORY_DECAY;
    world.themeWeights[themeName] = (world.themeWeights[themeName] || 0) + 1;
  }
  return world;
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

/** The session's dominant hue/saturation so far, weighted toward more
 * recently (and more often) played themes — null if nothing's been
 * recorded yet. `themeHueLookup(name)` must return `{ hue, sat }` or null;
 * colors come from the same THEMES table every theme in the app already
 * uses (see ai-director.js#themeByName), not invented here. Hue is
 * averaged as an angle (hues wrap 0..1), not a naive numeric mean, so e.g.
 * 0.98 and 0.02 correctly average to ~0.0, not ~0.5. */
export function dominantTint(world, themeHueLookup) {
  const entries = Object.entries(world.themeWeights);
  if (!entries.length) return null;
  let totalWeight = 0, sumX = 0, sumY = 0, sumSat = 0;
  for (const [name, weight] of entries) {
    const theme = themeHueLookup(name);
    if (!theme || weight <= 0) continue;
    const angle = theme.hue * Math.PI * 2;
    sumX += Math.cos(angle) * weight;
    sumY += Math.sin(angle) * weight;
    sumSat += theme.sat * weight;
    totalWeight += weight;
  }
  if (totalWeight === 0) return null;
  let hue = Math.atan2(sumY / totalWeight, sumX / totalWeight) / (Math.PI * 2);
  if (hue < 0) hue += 1;
  return { hue, sat: sumSat / totalWeight };
}
