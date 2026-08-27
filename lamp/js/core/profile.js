// Who is using LAMP: a name they chose, a birth year, and settings.
// Nothing else is ever stored about a child (SPEC.md §11).

import * as store from './storage.js';
import { bandForBirthYear, bandForAge, ageFromBirthYear } from './age.js';
import { DEFAULT_TRANSLATION } from './bible.js';

const DEFAULT_SETTINGS = {
  theme: 'system',          // system | light | dark
  readerTheme: 'day',       // day | sepia | night
  readerScale: null,     // null means "follow the age band"

  audio: true,
  aiEnabled: false,         // opt-in: Ask needs a Worker URL before it does anything
  aiWorker: '',
  aiSecret: '',
  region: 'kw',
  reminderAt: '',
};

export function getProfile() {
  return store.read(store.KEYS.profile, null);
}

export function saveProfile(patch) {
  const next = { ...(getProfile() || {}), ...patch };
  if (!next.createdAt) next.createdAt = new Date().toISOString();
  store.write(store.KEYS.profile, next);
  return next;
}

export function getSettings() {
  return { ...DEFAULT_SETTINGS, ...(store.read(store.KEYS.settings, {}) || {}) };
}

export function saveSettings(patch) {
  const next = { ...getSettings(), ...patch };
  store.write(store.KEYS.settings, next);
  return next;
}

export function currentBand(profile = getProfile()) {
  if (!profile) return '11-14';
  if (profile.band && !profile.birthYear) return profile.band;
  return bandForBirthYear(profile.birthYear);
}

export function currentAge(profile = getProfile()) {
  return profile ? ageFromBirthYear(profile.birthYear) : null;
}

/** The reader's starting text size, when nobody has chosen one. */
export const BAND_READER_SCALE = { '7-10': 1.15, '11-14': 1.05, '15-18': 1 };

export function readerScale(settings = getSettings(), band = currentBand()) {
  return settings.readerScale || BAND_READER_SCALE[band] || 1;
}

export function translationId(settings = getSettings()) {
  return settings.translation || DEFAULT_TRANSLATION;
}

/** "Good evening, Joshua." — the local clock decides, nothing else. */
export function greeting(name, now = new Date()) {
  const hour = now.getHours();
  const part = hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
  return name ? `${part}, ${name}.` : `${part}.`;
}

export { bandForAge };
