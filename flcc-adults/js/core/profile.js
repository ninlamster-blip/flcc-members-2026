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

/**
 * How big the type is.
 *
 * Not a preference so much as an accessibility need: a good part of this
 * church is over sixty, and the poster system is set in a face that is
 * beautiful and, at 16px on a phone held at arm's length, genuinely hard.
 * The scale multiplies the reader's own browser default rather than replacing
 * it, so somebody who has already turned text up on their phone gets that,
 * times this.
 */
export const TEXT_SIZES = [
  { id: 'standard', label: 'Standard', scale: 1,    line: 'The size the app was drawn at.' },
  { id: 'large',    label: 'Large',    scale: 1.15, line: 'A little more room to read.' },
  { id: 'larger',   label: 'Larger',   scale: 1.3,  line: 'Comfortable at arm’s length.' },
  { id: 'largest',  label: 'Largest',  scale: 1.5,  line: 'For reading without glasses.' },
];

export function getSettings() {
  return { figures: 'on', text: 'standard', ...(store.read(store.KEYS.settings, {}) || {}) };
}

export const textSize = (settings = getSettings()) =>
  TEXT_SIZES.find((one) => one.id === settings.text) || TEXT_SIZES[0];

/**
 * Put the chosen scale on the root element.
 *
 * `index.html` calls this before the first screen is built, so the app is
 * never drawn at one size and then re-drawn at another — a reader who needs
 * large type should not have to watch the page jump on every load.
 */
export function applyTextSize(settings = getSettings()) {
  const size = textSize(settings);
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.style.setProperty('--text-scale', String(size.scale));
  }
  return size;
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
