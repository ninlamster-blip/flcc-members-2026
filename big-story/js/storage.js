/* =============================================================================
   STORAGE — profiles and progress, on the device and nowhere else.
   -----------------------------------------------------------------------------
   One key, `flcc-big-story-v1`, deliberately NOT namespaced by church: this app
   reads no church data at all, and a child's progress is a device-wide thing
   here, like game scores and the Bible reading plan (see "Storage on a shared
   device" in CHURCHES.md).

   PROFILES exist because of how these phones are actually used. A family shares
   one, and two children in the same house are not the same age and are not up
   to the same story. Without profiles the younger one keeps opening the app to
   find their sister's progress and their sister's questions.

   Nothing is uploaded. There is no account, no name required beyond what a
   child types for themselves, and nothing here ever leaves the device.
   ========================================================================== */

const KEY = 'flcc-big-story-v1';
export const MAX_PROFILES = 6;

const EMPTY = { version: 1, profiles: [], current: null, progress: {} };

function read() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { ...EMPTY, profiles: [], progress: {} };
    const parsed = JSON.parse(raw) || {};
    return {
      version: 1,
      profiles: Array.isArray(parsed.profiles) ? parsed.profiles : [],
      current: parsed.current || null,
      progress: parsed.progress && typeof parsed.progress === 'object' ? parsed.progress : {},
    };
  } catch {
    return { ...EMPTY, profiles: [], progress: {} };
  }
}

function write(state) {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;   // private mode or a full disk: the app carries on in memory
  }
}

export function load() { return read(); }

export function profiles() { return read().profiles; }

export function currentProfile() {
  const state = read();
  return state.profiles.find((p) => p.id === state.current) || null;
}

export function addProfile(name, band) {
  const state = read();
  if (state.profiles.length >= MAX_PROFILES) return null;
  const profile = {
    id: 'p' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6),
    name: String(name || '').trim().slice(0, 24) || 'Me',
    band,
  };
  state.profiles.push(profile);
  state.current = profile.id;
  state.progress[profile.id] = { read: [], quizzes: {}, verses: [] };
  write(state);
  return profile;
}

export function selectProfile(id) {
  const state = read();
  if (!state.profiles.some((p) => p.id === id)) return false;
  state.current = id;
  return write(state);
}

export function updateProfile(id, patch) {
  const state = read();
  const profile = state.profiles.find((p) => p.id === id);
  if (!profile) return false;
  Object.assign(profile, patch);
  return write(state);
}

export function removeProfile(id) {
  const state = read();
  state.profiles = state.profiles.filter((p) => p.id !== id);
  delete state.progress[id];
  if (state.current === id) state.current = state.profiles.length ? state.profiles[0].id : null;
  return write(state);
}

/* ── Progress ─────────────────────────────────────────────────────────────── */

export function progressFor(profileId) {
  const stored = read().progress[profileId] || {};
  return {
    read: Array.isArray(stored.read) ? stored.read : [],
    quizzes: stored.quizzes && typeof stored.quizzes === 'object' ? stored.quizzes : {},
    verses: Array.isArray(stored.verses) ? stored.verses : [],
  };
}

function withProgress(profileId, change) {
  const state = read();
  const progress = progressFor(profileId);
  change(progress);
  state.progress[profileId] = progress;
  write(state);
  return progress;
}

export function markRead(profileId, storyId) {
  return withProgress(profileId, (p) => {
    if (!p.read.includes(storyId)) p.read.push(storyId);
  });
}

/** A better score replaces a worse one; a worse one never undoes a better.
 *  Practising again should not be able to cost a child something. */
export function recordQuiz(profileId, storyId, right, total) {
  return withProgress(profileId, (p) => {
    const previous = p.quizzes[storyId];
    if (!previous || right > previous.right) p.quizzes[storyId] = { right, total };
  });
}

export function markVerse(profileId, storyId, learned = true) {
  return withProgress(profileId, (p) => {
    const has = p.verses.includes(storyId);
    if (learned && !has) p.verses.push(storyId);
    if (!learned && has) p.verses = p.verses.filter((id) => id !== storyId);
  });
}
