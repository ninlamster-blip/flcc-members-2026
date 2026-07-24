// Song "fingerprinting" — NOT acoustic/audio fingerprinting. There's no
// Chromaprint-style audio matching here, nothing that could recognize the
// same song from a different rip, re-encode, or file. This recognizes "the
// same file, played again" by filename + size (the identical identity
// scheme already used for saved lyrics), and keys a small per-device memory
// of it in localStorage: cached structure analysis (so a repeat play can
// skip re-running the FFT pass), the mood/tempo last seen playing it, how
// much of the track is typically listened to, and which camera scene mode
// has spent the most time on screen for it. All of this lives only in this
// browser's localStorage — there's no backend, so nothing is shared across
// devices, browsers, or synced anywhere.

const STORE_PREFIX = 'mv-memory::';

export function fingerprintTrack(file) {
  return `${file.name}::${file.size}`;
}

function storageKey(fp) { return STORE_PREFIX + fp; }

export function loadMemory(fp) {
  try {
    const raw = localStorage.getItem(storageKey(fp));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function saveMemory(fp, memory) {
  try {
    localStorage.setItem(storageKey(fp), JSON.stringify(memory));
  } catch { /* storage full/unavailable — memory just won't persist this time */ }
}

export const SCENE_LABELS = { orbit: 'Orbit', push: 'Push-in', drift: 'Drift', flythrough: 'Flythrough' };

function emptyMemory() {
  return { playCount: 0, totalCompletion: 0, sceneDurationsMs: {}, structure: null };
}

/** Attaches (or replaces) cached structure-analysis results on a track's
 * memory without touching its play-history fields. */
export function withStructure(existing, structure) {
  const memory = existing ? { ...existing } : emptyMemory();
  memory.structure = structure;
  return memory;
}

function clamp01(v) { return Math.max(0, Math.min(1, v)); }

/** Folds one finished (or abandoned) play session into a track's stored
 * memory, returning the updated memory — does not save it itself.
 * `session.completionRatio` is 0..1 (furthest point reached / duration).
 * `session.sceneDurationsMs` is e.g. { orbit: 4200, drift: 1800 }. */
export function recordPlaySession(existing, session) {
  const memory = existing
    ? { ...existing, sceneDurationsMs: { ...existing.sceneDurationsMs } }
    : emptyMemory();
  memory.playCount += 1;
  memory.totalCompletion += clamp01(session.completionRatio);
  memory.lastPlayedAt = Date.now();
  if (session.mood) memory.mood = session.mood;
  if (session.themeName) memory.themeName = session.themeName;
  if (session.bpm != null && isFinite(session.bpm)) memory.bpm = Math.round(session.bpm);
  for (const [mode, ms] of Object.entries(session.sceneDurationsMs || {})) {
    memory.sceneDurationsMs[mode] = (memory.sceneDurationsMs[mode] || 0) + ms;
  }
  return memory;
}

export function averageCompletion(memory) {
  return memory.playCount ? clamp01(memory.totalCompletion / memory.playCount) : 0;
}

export function favoriteScene(memory) {
  const entries = Object.entries(memory.sceneDurationsMs || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}
