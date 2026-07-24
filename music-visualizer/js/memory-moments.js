// Memory Moments — user-created bookmarks within a track: a timestamp, an
// optional personal note, a short label describing the AI Director's
// visual read at that instant (mood/theme + camera move — a description,
// not a promise to recreate the exact same pixels later, since the visuals
// are genuinely reactive and depend on the live audio graph), and a small
// canvas screenshot thumbnail where one was captured. Stored per track in
// localStorage, keyed the same way as everything else in this app
// (filename+size — see fingerprint.js).

const STORE_PREFIX = 'mv-moments::';

function storageKey(fp) { return STORE_PREFIX + fp; }

export function loadMoments(fp) {
  try {
    const raw = localStorage.getItem(storageKey(fp));
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function saveMoments(fp, moments) {
  try {
    localStorage.setItem(storageKey(fp), JSON.stringify(moments));
  } catch { /* storage full/unavailable — the moment just won't persist */ }
}

export function addMoment(fp, { time, note = '', visualLabel = '', thumbnail = null }) {
  const moments = loadMoments(fp);
  moments.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    time, note, visualLabel, thumbnail,
    createdAt: Date.now(),
  });
  moments.sort((a, b) => a.time - b.time);
  saveMoments(fp, moments);
  return moments;
}

export function updateMomentNote(fp, id, note) {
  const moments = loadMoments(fp);
  const moment = moments.find((m) => m.id === id);
  if (moment) moment.note = note;
  saveMoments(fp, moments);
  return moments;
}

export function removeMoment(fp, id) {
  const moments = loadMoments(fp).filter((m) => m.id !== id);
  saveMoments(fp, moments);
  return moments;
}
