// RESOURCES — Cru's free material, and the ones a member has chosen to keep.
//
// Nothing of Cru's lives in this app. content/resources.json holds a title, a
// line of our own and a link for each; the link opens cru.org, where Cru's own
// read-online and download buttons are. What is kept here, under
// KEYS.resources, is only which of them a member added to "My resources" and
// which they have finished. Opening one is navigation to another site, not a
// request this app makes, so nothing about the member goes with it.

import * as store from './storage.js';

const EMPTY = { saved: [] };

function read() {
  const kept = store.read(store.KEYS.resources, null) || {};
  return { ...EMPTY, ...kept, saved: Array.isArray(kept.saved) ? kept.saved : [] };
}

export const saved = () => read().saved;
export const isSaved = (id) => saved().some((one) => one.id === id);

export function add(id) {
  if (isSaved(id)) return saved();
  const next = [{ id, at: new Date().toISOString(), done: false }, ...saved()];
  store.write(store.KEYS.resources, { ...read(), saved: next });
  return next;
}

export function remove(id) {
  const next = saved().filter((one) => one.id !== id);
  store.write(store.KEYS.resources, { ...read(), saved: next });
  return next;
}

export function setDone(id, done = true) {
  const next = saved().map((one) => (one.id === id ? { ...one, done: Boolean(done) } : one));
  store.write(store.KEYS.resources, { ...read(), saved: next });
  return next;
}

/** Every resource in the file, flat, each knowing its group. */
export function all(bank) {
  return (bank.groups || []).flatMap((group) => group.items.map((item) => ({ ...item, group: group.id })));
}

/** The member's saved list, in the order they added it, joined to the file. Gone entries drop out. */
export function mine(bank) {
  const byId = new Map(all(bank).map((item) => [item.id, item]));
  return saved().filter((one) => byId.has(one.id)).map((one) => ({ ...byId.get(one.id), savedAt: one.at, done: one.done }));
}

/**
 * Today's Promise on cru.org for a given day: one page per calendar day,
 * at <base>MM/DD.html. 29 February has no page of its own, so it opens the 28th.
 */
export function todaysPromiseUrl(base, date = new Date()) {
  let month = date.getMonth() + 1;
  let day = date.getDate();
  if (month === 2 && day === 29) day = 28;
  const two = (n) => String(n).padStart(2, '0');
  return `${base}${two(month)}/${two(day)}.html`;
}

/** Open a resource on cru.org in a new tab, without handing it this app's window. */
export function open(url) {
  window.open(url, '_blank', 'noopener');
}
