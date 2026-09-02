// What has been read, prayed and finished.
//
// This app keeps a record and refuses to keep a score. There is no XP, there
// are no levels, there are no badges and there is no leaderboard — an adult
// who missed four days does not need a broken chain telling them so, and
// nobody's walk with God is a number that goes up.
//
// What is kept is what is genuinely useful to the person it belongs to: what
// they have finished, so a path can resume where they left it; and how many
// days running they have shown up, shown quietly and never mourned.

import * as store from './storage.js';

const EMPTY = { days: { count: 0, best: 0, lastDay: null }, done: {}, counts: {} };

/** The kinds of thing that can be completed. Named, so a typo cannot invent one. */
export const KINDS = ['reading', 'session', 'prayer', 'reflection', 'message'];

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
  return {
    ...EMPTY, ...saved,
    days: { ...EMPTY.days, ...(saved.days || {}) },
    done: { ...(saved.done || {}) },
    counts: { ...(saved.counts || {}) },
  };
}

function save(state) { store.write(store.KEYS.progress, state); return state; }

/** Pure: what the run of days becomes when a day is touched. */
export function bumpDays(days, day) {
  const current = { count: 0, best: 0, lastDay: null, ...(days || {}) };
  if (current.lastDay === day) return current;
  const count = current.lastDay === yesterday(day) ? current.count + 1 : 1;
  return { count, best: Math.max(count, current.best || 0), lastDay: day };
}

/**
 * Record something finished. `key` makes it idempotent for good — reopening a
 * session already read does not count twice, and does not un-count it either.
 */
export function complete(kind, key, now = new Date()) {
  const state = getProgress();
  const id = `${kind}:${key}`;
  const day = today(now);
  const first = !state.done[id];

  if (first) {
    state.done[id] = day;
    state.counts[kind] = (state.counts[kind] || 0) + 1;
  }
  const before = state.days.count;
  state.days = bumpDays(state.days, day);
  save(state);
  return { first, days: state.days, grew: state.days.count !== before };
}

export function isDone(kind, key) { return Boolean(getProgress().done[`${kind}:${key}`]); }
export function doneOn(kind, key) { return getProgress().done[`${kind}:${key}`] || null; }
export function count(kind) { return getProgress().counts[kind] || 0; }

/** How far through a list of keys this reader is. Used by every path. */
export function through(kind, keys) {
  const state = getProgress();
  const list = Array.isArray(keys) ? keys : [];
  const finished = list.filter((key) => state.done[`${kind}:${key}`]);
  return {
    finished: finished.length,
    total: list.length,
    percent: list.length ? Math.round((finished.length / list.length) * 100) : 0,
    next: list.find((key) => !state.done[`${kind}:${key}`]) || null,
  };
}

/** Days touched in the last `span` days — the quiet rhythm shown on Home. */
export function rhythm(span = 14, now = new Date()) {
  const state = getProgress();
  const touched = new Set(Object.values(state.done));
  const out = [];
  for (let i = span - 1; i >= 0; i--) {
    const date = new Date(now);
    date.setDate(date.getDate() - i);
    const day = today(date);
    out.push({ day, on: touched.has(day) });
  }
  return out;
}
