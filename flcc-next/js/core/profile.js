// Who is using the app, and which of the two experiences they get.
//
// The age group is the single switch: it changes content, tone, length and
// register everywhere. There are exactly two, because "kids" and "teens" are
// genuinely different audiences and a slider between them would serve neither.

import * as store from './storage.js';

export const MODES = ['kids', 'teens'];

export const MODE = {
  kids:  { label: 'Kids',  range: '7–12',  minutes: '3–7 minutes',  min: 7,  max: 12 },
  teens: { label: 'Teens', range: '13–18', minutes: '5–10 minutes', min: 13, max: 18 },
};

/** Ages outside 7–18 still get a sensible experience rather than a broken one. */
export function modeForAge(age) {
  const years = Number(age);
  if (!Number.isFinite(years)) return 'teens';
  return years <= 12 ? 'kids' : 'teens';
}

export function getUser() {
  return store.read(store.KEYS.user, null);
}

export function saveUser(patch) {
  const next = { ...(getUser() || {}), ...patch };
  if (next.age !== undefined) next.ageGroup = modeForAge(next.age);
  if (!next.id) next.id = `u${Date.now().toString(36)}`;
  if (!next.createdAt) next.createdAt = new Date().toISOString();
  if (!next.role) next.role = 'member';
  store.write(store.KEYS.user, next);
  return next;
}

/**
 * Which experience this reader gets.
 *
 * `ageGroup` is derived once, on save. But a record can reach here without it —
 * written by an older version, restored from a partial backup, edited by hand —
 * and defaulting straight to `teens` would quietly hand a nine-year-old the
 * teen content. So age is consulted before falling back.
 */
export function mode(user = getUser()) {
  if (!user) return 'teens';
  if (MODES.includes(user.ageGroup)) return user.ageGroup;
  if (Number.isFinite(Number(user.age))) return modeForAge(user.age);
  return 'teens';
}

export function isKids(user = getUser()) { return mode(user) === 'kids'; }

/** Pick the variant written for this reader. Falls back rather than blanking. */
export function forMode(value, current = mode()) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return value;
  return value[current] ?? value[current === 'kids' ? 'teens' : 'kids'] ?? null;
}

export function getSettings() {
  // leaderKey is a ministry leader's own credential for reading the prayer
  // queue. It lives only on a leader's device and is never shipped to a young
  // person's phone — a secret on a child's phone is not a secret.
  return { theme: 'system', motion: 'full', aiWorker: '', aiSecret: '', aiEnabled: false, leaderKey: '', ...(store.read(store.KEYS.settings, {}) || {}) };
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  store.write(store.KEYS.settings, next);
  return next;
}

export function greeting(now = new Date()) {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}
