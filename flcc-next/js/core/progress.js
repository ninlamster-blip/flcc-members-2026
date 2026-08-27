// XP, streaks and what has been finished.
//
// The point of the numbers is encouragement and consistency, not scoring
// spirituality. Nothing here can be lost, spent, or compared against another
// child: there is no leaderboard, and there never will be.

import * as store from './storage.js';

export const XP = {
  devotional: 20,
  challenge: 15,
  lesson: 25,
  game: 10,
  memory: 20,
  prayer: 10,
};

// Levels are slow on purpose. Reaching one should mean weeks of turning up.
export const LEVEL_STEP = 120;

export const LEVEL_TITLES = [
  'First Steps', 'Seeker', 'Explorer', 'Faith Explorer', 'Truth Finder',
  'Light Bearer', 'Way Maker', 'Deep Rooted', 'Faithful', 'Disciple',
];

const EMPTY = { xp: 0, streak: { count: 0, best: 0, lastDay: null }, done: {}, counts: {} };

export function today(now = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function yesterday(day) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return today(date);
}

export function getProgress() {
  const saved = store.read(store.KEYS.progress, null) || {};
  return { ...EMPTY, ...saved, streak: { ...EMPTY.streak, ...(saved.streak || {}) }, done: { ...(saved.done || {}) }, counts: { ...(saved.counts || {}) } };
}

function save(state) { store.write(store.KEYS.progress, state); return state; }

/** Pure: what a streak becomes when a day is touched. */
export function bumpStreak(streak, day) {
  const current = { count: 0, best: 0, lastDay: null, ...(streak || {}) };
  if (current.lastDay === day) return current;
  const count = current.lastDay === yesterday(day) ? current.count + 1 : 1;
  return { count, best: Math.max(count, current.best || 0), lastDay: day };
}

export function level(xp) {
  return Math.max(1, Math.floor(xp / LEVEL_STEP) + 1);
}

export function levelTitle(xp) {
  return LEVEL_TITLES[Math.min(level(xp) - 1, LEVEL_TITLES.length - 1)];
}

export function intoLevel(xp) {
  return Math.round(((xp % LEVEL_STEP) / LEVEL_STEP) * 100);
}

/**
 * Record something finished. `key` makes it idempotent for the day — finishing
 * the same devotional twice does not pay twice.
 */
export function complete(kind, key, now = new Date()) {
  const state = getProgress();
  const id = `${kind}:${key}`;
  const day = today(now);
  const first = !state.done[id];

  if (first) {
    state.done[id] = day;
    state.xp += XP[kind] || 5;
    state.counts[kind] = (state.counts[kind] || 0) + 1;
  }
  const before = state.streak.count;
  state.streak = bumpStreak(state.streak, day);
  save(state);
  return { first, xp: state.xp, streak: state.streak, streakGrew: state.streak.count !== before };
}

export function isDone(kind, key) {
  return Boolean(getProgress().done[`${kind}:${key}`]);
}

export function count(kind) {
  return getProgress().counts[kind] || 0;
}
