// Who is using the app.
//
// There is no age switch here, and that is the whole difference between this
// app and the kids and teens one. Adults are one audience: the content is
// written once, in one register, and nothing is softened or sharpened behind
// the reader's back.
//
// What is asked at the door is small on purpose — a name, a season, and what
// they came for. Everything else the app learns, it learns from use.

import * as store from './storage.js';

/**
 * The season a reader is in.
 *
 * It changes what the app offers first — which path is suggested, which
 * prayer guide opens by default — and nothing else. It is never used to
 * withhold anything, and it can be changed at any time from You.
 */
export const SEASONS = [
  { id: 'beginning', label: 'New to faith', line: 'I am at the beginning, and I want to understand what this is.' },
  { id: 'growing',   label: 'Growing',      line: 'I believe, and I want it to go deeper than Sunday.' },
  { id: 'returning', label: 'Coming back',  line: 'I have been away from it for a while.' },
  { id: 'serving',   label: 'Serving',      line: 'I am leading or serving, and I need to stay fed myself.' },
];

export const FOCUS = [
  { id: 'bible',    label: 'Knowing the Bible',  accent: 'sky' },
  { id: 'prayer',   label: 'A real prayer life', accent: 'rose' },
  { id: 'family',   label: 'Marriage and family', accent: 'sunshine' },
  { id: 'work',     label: 'Faith at work',      accent: 'captain' },
  { id: 'ministry', label: 'Serving the church', accent: 'poppy' },
];

export function getUser() { return store.read(store.KEYS.user, null); }

export function saveUser(patch) {
  const next = { ...(getUser() || {}), ...patch };
  if (!Array.isArray(next.focus)) next.focus = [];
  if (!next.id) next.id = `m${Date.now().toString(36)}`;
  if (!next.createdAt) next.createdAt = new Date().toISOString();
  if (!next.role) next.role = 'member';
  if (!SEASONS.some((one) => one.id === next.season)) next.season = 'growing';
  store.write(store.KEYS.user, next);
  return next;
}

export const seasonOf = (user = getUser()) =>
  SEASONS.find((one) => one.id === (user || {}).season) || SEASONS[1];

export const wants = (id, user = getUser()) => Boolean(user && (user.focus || []).includes(id));

export function firstName(user = getUser()) {
  const name = String((user || {}).name || '').trim();
  return name.split(/\s+/)[0] || 'friend';
}

export function getSettings() {
  return { figures: 'on', ...(store.read(store.KEYS.settings, {}) || {}) };
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  store.write(store.KEYS.settings, next);
  return next;
}

/** The little characters are the app's signature — and they are also
 *  decoration. A reader who would rather do without them can turn them off in
 *  You; the cards, the colours and the layout are unaffected. */
export const showFigures = () => getSettings().figures !== 'off';

export function greeting(now = new Date()) {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}
