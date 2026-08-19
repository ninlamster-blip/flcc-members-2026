/* =============================================================================
   STORAGE — everything this game remembers lives on the member's own device.
   -----------------------------------------------------------------------------
   One localStorage key, one shape, read and written only through here. Nothing
   is sent anywhere: no name, no answers, no history. Game scores are a
   device-wide preference in this app rather than a per-church one (see
   CHURCHES.md, "Storage on a shared device"), so the key is deliberately not
   namespaced by church — a member who looks at two churches keeps one streak.
   ========================================================================== */

const KEY = 'flcc-crossword-v1';

const EMPTY = {
  version: 1,
  streak: { count: 0, best: 0, lastDay: null },
  results: {},     // puzzleId -> finished result
  progress: {},    // puzzleId -> work in progress
  settings: { sound: false },
};

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return structuredClone(EMPTY);
    const parsed = JSON.parse(raw);
    return {
      ...structuredClone(EMPTY),
      ...parsed,
      streak: { ...EMPTY.streak, ...(parsed.streak || {}) },
      results: parsed.results || {},
      progress: parsed.progress || {},
      settings: { ...EMPTY.settings, ...(parsed.settings || {}) },
    };
  } catch {
    return structuredClone(EMPTY);
  }
}

function write(state) {
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* private mode, quota — play on */ }
  return state;
}

export function load() { return read(); }

export function settings() { return read().settings; }

export function setSetting(name, value) {
  const s = read();
  s.settings[name] = value;
  return write(s).settings;
}

/* ── Work in progress ─────────────────────────────────────────────────────── */

export function loadProgress(puzzleId) { return read().progress[puzzleId] || null; }

export function saveProgress(puzzleId, progress) {
  const s = read();
  s.progress[puzzleId] = progress;
  write(s);
}

export function clearProgress(puzzleId) {
  const s = read();
  delete s.progress[puzzleId];
  write(s);
}

/* ── Finished puzzles ─────────────────────────────────────────────────────── */

export function resultFor(puzzleId) { return read().results[puzzleId] || null; }

export function allResults() { return read().results; }

/**
 * Record a completed puzzle and roll the streak forward.
 *
 * A streak counts consecutive *calendar days on which a puzzle was finished*,
 * not consecutive puzzles: someone who solves three in one evening has a
 * one-day streak, and someone who solves one a day for a week has seven. A
 * second finish on a day that already counts leaves the streak alone.
 */
export function recordResult(result, todayKey) {
  const s = read();
  const previous = s.results[result.puzzleId];
  // Replaying a puzzle keeps the better score rather than overwriting it.
  s.results[result.puzzleId] = previous && previous.score >= result.score
    ? { ...previous, replays: (previous.replays || 0) + 1 }
    : { ...result, replays: previous ? (previous.replays || 0) + 1 : 0 };
  delete s.progress[result.puzzleId];

  const last = s.streak.lastDay;
  if (last !== todayKey) {
    s.streak.count = last && isYesterday(last, todayKey) ? s.streak.count + 1 : 1;
    s.streak.lastDay = todayKey;
    s.streak.best = Math.max(s.streak.best || 0, s.streak.count);
  }
  write(s);
  return s;
}

/** Streak as it should be *shown* — a stored count from three days ago is
 *  history, not a live streak, so it reads as 0 without being erased. */
export function currentStreak(todayKey) {
  const { streak } = read();
  if (!streak.lastDay) return { ...streak, count: 0 };
  if (streak.lastDay === todayKey || isYesterday(streak.lastDay, todayKey)) return streak;
  return { ...streak, count: 0 };
}

function isYesterday(dayA, dayB) {
  const toUTC = (k) => { const [y, m, d] = k.split('-').map(Number); return Date.UTC(y, m - 1, d); };
  return toUTC(dayB) - toUTC(dayA) === 86400000;
}
