// The prayer list, and the reflections written beside it.
//
// Two decisions worth stating, because they are the reason this module exists
// rather than a pile of localStorage calls in the Pray screen:
//
// 1. **A prayer is never deleted when it is answered.** It moves. The point of
//    keeping a prayer list at all is being able to look back at what God did
//    with it, and an app that clears the row the moment it is ticked destroys
//    exactly the thing worth keeping.
//
// 2. **Nothing here leaves the device.** Not to the church, not to a leader,
//    not to a server — there is no server. What an adult prays about their
//    marriage, their money or their manager is not ours to collect, and the
//    screens say so plainly rather than burying it in a policy.

import * as store from './storage.js';

const EMPTY = { items: [] };

const id = () => `p${Date.now().toString(36)}${Math.floor(Math.random() * 1296).toString(36)}`;

export function all() {
  const saved = store.read(store.KEYS.prayers, null) || {};
  const items = Array.isArray(saved.items) ? saved.items : [];
  return items.map((one) => ({ answered: null, archived: false, category: 'personal', ...one }));
}

function put(items) {
  store.write(store.KEYS.prayers, { ...EMPTY, items });
  return items;
}

export function add({ text, category = 'personal' }) {
  const body = String(text || '').trim();
  if (!body) return null;
  const item = { id: id(), text: body, category, created: new Date().toISOString(), answered: null, archived: false };
  put([item, ...all()]);
  return item;
}

export function update(itemId, patch) {
  const items = all().map((one) => (one.id === itemId ? { ...one, ...patch } : one));
  put(items);
  return items.find((one) => one.id === itemId) || null;
}

/** Mark a prayer answered. The note is optional and is the part worth having. */
export function answer(itemId, note = '') {
  return update(itemId, { answered: { at: new Date().toISOString(), note: String(note || '').trim() } });
}

export function reopen(itemId) { return update(itemId, { answered: null }); }

/** Deliberately the only way anything is destroyed, and it is always explicit. */
export function remove(itemId) {
  put(all().filter((one) => one.id !== itemId));
}

export const open = () => all().filter((one) => !one.answered && !one.archived);
export const answered = () => all().filter((one) => one.answered)
  .sort((a, b) => String(b.answered.at).localeCompare(String(a.answered.at)));

export function byCategory() {
  const groups = new Map();
  for (const item of open()) {
    if (!groups.has(item.category)) groups.set(item.category, []);
    groups.get(item.category).push(item);
  }
  return groups;
}

/** How long a prayer has been carried, said the way a person would say it. */
export function carriedFor(item, now = new Date()) {
  const from = new Date(item.created);
  if (Number.isNaN(from.getTime())) return '';
  const days = Math.max(0, Math.floor((now - from) / 86400000));
  if (days === 0) return 'Today';
  if (days === 1) return '1 day';
  if (days < 31) return `${days} days`;
  const months = Math.round(days / 30.44);
  if (months < 24) return `${months} month${months === 1 ? '' : 's'}`;
  return `${Math.round(days / 365.25)} years`;
}

// ── Reflections ────────────────────────────────────────────────────────────
//
// What a reader writes at the end of a guided prayer. Kept apart from the
// prayer list because it is a different act: a list is a set of asks, a
// journal is a record of listening.

export function reflections() {
  const saved = store.read(store.KEYS.journal, null) || {};
  return Array.isArray(saved.entries) ? saved.entries : [];
}

export function reflect({ text, guide = '', ref = '' }) {
  const body = String(text || '').trim();
  if (!body) return null;
  const entry = { id: id(), at: new Date().toISOString(), guide, ref, text: body };
  store.write(store.KEYS.journal, { entries: [entry, ...reflections()].slice(0, 500) });
  return entry;
}

export function unreflect(entryId) {
  store.write(store.KEYS.journal, { entries: reflections().filter((one) => one.id !== entryId) });
}
