// Memory verses — five stages and a legible schedule (SPEC.md §15).
// A missed review moves back one stage, never to zero: patience, not punishment.

import * as store from './storage.js';

export const STAGES = ['learn', 'listen', 'practice', 'challenge', 'mastered'];

export const STAGE_LABEL = {
  learn: 'Learning',
  listen: 'Learning',
  practice: 'Practising',
  challenge: 'Almost there',
  mastered: 'Mastered',
};

// 1 day, 3, 7, 16, 35 — spaced, but small enough numbers to explain to a child.
export const INTERVALS = [1, 3, 7, 16, 35];

const DAY = 86400000;

export function getMemory() {
  return store.read(store.KEYS.memory, { verses: [] }) || { verses: [] };
}

function save(state) {
  store.write(store.KEYS.memory, state);
  return state;
}

export function addVerse(ref, translationId, now = new Date()) {
  const state = getMemory();
  if (state.verses.some((v) => v.ref === ref)) return state;
  state.verses.push({
    ref,
    translation: translationId,
    stage: 'learn',
    due: now.toISOString(),
    attempts: 0,
    correct: 0,
    addedAt: now.toISOString(),
  });
  return save(state);
}

export function removeVerse(ref) {
  const state = getMemory();
  state.verses = state.verses.filter((v) => v.ref !== ref);
  return save(state);
}

/** Pure: the next state of one verse after a review. */
export function advance(verse, passed, now = new Date()) {
  const index = STAGES.indexOf(verse.stage);
  const at = index === -1 ? 0 : index;
  const next = passed ? Math.min(at + 1, STAGES.length - 1) : Math.max(at - 1, 0);
  const interval = INTERVALS[Math.min(next, INTERVALS.length - 1)];
  return {
    ...verse,
    stage: STAGES[next],
    due: new Date(now.getTime() + interval * DAY).toISOString(),
    attempts: (verse.attempts || 0) + 1,
    correct: (verse.correct || 0) + (passed ? 1 : 0),
    lastReviewed: now.toISOString(),
  };
}

export function review(ref, passed, now = new Date()) {
  const state = getMemory();
  state.verses = state.verses.map((v) => (v.ref === ref ? advance(v, passed, now) : v));
  return save(state);
}

export function dueVerses(state = getMemory(), now = new Date()) {
  return state.verses.filter((v) => v.stage !== 'mastered' && new Date(v.due).getTime() <= now.getTime());
}

// ── Grading ────────────────────────────────────────────────────────────────

export function normalise(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(/[“”]/g, '"')
    .replace(/[^a-z0-9' ]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Levenshtein, capped — we only ever care about small distances. */
export function distance(a, b) {
  if (a === b) return 0;
  const rows = a.length + 1;
  const cols = b.length + 1;
  let previous = Array.from({ length: cols }, (_, i) => i);
  for (let i = 1; i < rows; i++) {
    const current = [i];
    for (let j = 1; j < cols; j++) {
      current[j] = Math.min(
        previous[j] + 1,
        current[j - 1] + 1,
        previous[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1),
      );
    }
    previous = current;
  }
  return previous[cols - 1];
}

/** Whitespace- and punctuation-insensitive, forgiving one character per ten. */
export function grade(answer, expected) {
  const got = normalise(answer);
  const want = normalise(expected);
  if (!want) return { pass: false, distance: 0, allowed: 0 };
  const allowed = Math.max(1, Math.floor(want.length / 10));
  const d = distance(got, want);
  return { pass: d <= allowed, distance: d, allowed };
}

/** A small, stable hash so a seed of any shape spreads across a pool. */
function hash(seed) {
  const text = String(seed);
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value);
}

/**
 * Blank out words for the Practice stage. Deterministic for a given verse and
 * seed, so a child sees the same puzzle if they come back to it.
 */
export function cloze(text, count = 3, seed = 1) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  const candidates = words
    .map((word, index) => ({ word, index }))
    .filter(({ word }) => word.replace(/[^A-Za-z]/g, '').length > 3);
  if (!candidates.length) return { words, blanks: [] };

  const blanks = [];
  const seeded = hash(seed);
  let cursor = seeded % candidates.length;
  const spread = Math.max(1, Math.floor(candidates.length / Math.max(1, count)));
  const step = 1 + ((seeded >> 7) % spread);
  for (let i = 0; i < Math.min(count, candidates.length); i++) {
    blanks.push(candidates[cursor].index);
    cursor = (cursor + step) % candidates.length;
    while (blanks.includes(candidates[cursor].index) && blanks.length < candidates.length) {
      cursor = (cursor + 1) % candidates.length;
    }
  }
  return { words, blanks: [...new Set(blanks)].sort((a, b) => a - b) };
}
