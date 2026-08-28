// One small challenge a day, of five kinds (SPEC.md §16).
// "Live it" is never auto-verified — the child marks it done and we take their
// word for it.

import * as store from './storage.js';
import { pickFor } from './daily.js';
import { today } from './progress.js';

export const TYPES = ['find', 'remember', 'know', 'think', 'live'];

export const TYPE_LABEL = {
  find: 'Find it',
  remember: 'Remember it',
  know: 'Know it',
  think: 'Think about it',
  live: 'Live it',
};

export function getLog() {
  return store.read(store.KEYS.challenges, { log: {} }) || { log: {} };
}

function save(state) {
  store.write(store.KEYS.challenges, state);
  return state;
}

/** Which kind of challenge today is — a fixed rotation, so the week has shape. */
export function typeForDay(date = new Date()) {
  const index = pickFor(TYPES.map((_, i) => i), date, 0);
  return TYPES[index ?? 0];
}

export function challengeFor(pools, band, date = new Date()) {
  const type = typeForDay(date);
  const pool = (pools && pools[type]) || [];
  const forBand = pool.filter((item) => !item.bands || item.bands.includes(band));
  const chosen = pickFor(forBand.length ? forBand : pool, date, 3);
  return chosen ? { ...chosen, type } : null;
}

export function record(day, type, result, now = new Date()) {
  const state = getLog();
  state.log[day || today(now)] = { type, result, at: now.toISOString() };
  return save(state);
}

export function resultFor(day) {
  return getLog().log[day] || null;
}

export function completedCount(state = getLog()) {
  return Object.values(state.log || {}).filter((entry) => entry && entry.result !== 'skipped').length;
}
