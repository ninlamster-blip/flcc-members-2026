// Sermon notes.
//
// The whole module is thirty lines because the feature is meant to be thirty
// lines. A member has their phone out during a sermon; what they need is a
// page that is already open and a keyboard, not a template with eight headings
// asking them to categorise a thought while the preacher is still talking.
//
// So a note is a title, an optional passage and speaker, and a body. Nothing
// is required, nothing is validated, and an empty note is thrown away rather
// than saved as a piece of clutter to tidy up later.
//
// Notes never leave the device on their own. There is no server behind this
// app, and a sermon note is the most private thing in it after a prayer — it
// is where somebody writes "this is about me" next to a point the preacher
// made. The one way out is the member's own hand: Share on a note hands its
// text to the phone's share sheet, a copy, or a file, and only when tapped.

import * as store from './storage.js';

const all = () => {
  const kept = store.read(store.KEYS.notes, null);
  return Array.isArray(kept) ? kept : [];
};

const save = (list) => { store.write(store.KEYS.notes, list); return list; };

/** Newest first — the one you are still writing is the one you want. */
export function list() {
  return [...all()].sort((a, b) => String(b.updatedAt).localeCompare(String(a.updatedAt)));
}

export function get(id) { return all().find((one) => one.id === id) || null; }

/**
 * Ids have to be unique within the millisecond.
 *
 * A timestamp alone is not: tapping "Start a note" twice in quick succession
 * produced two notes with the same id, and the second silently shadowed the
 * first everywhere the app looks one up.
 */
let counter = 0;
const nextId = () => `n${Date.now().toString(36)}${(counter++).toString(36)}`;

export function create({ title = '', speaker = '', ref = '', body = '', messageId = '' } = {}) {
  const now = new Date().toISOString();
  const note = {
    id: nextId(),
    title, speaker, ref, body, messageId,
    createdAt: now, updatedAt: now,
  };
  save([note, ...all()]);
  return note;
}

export function update(id, patch) {
  const list0 = all();
  const at = list0.findIndex((one) => one.id === id);
  if (at === -1) return null;
  list0[at] = { ...list0[at], ...patch, updatedAt: new Date().toISOString() };
  save(list0);
  return list0[at];
}

export function remove(id) {
  save(all().filter((one) => one.id !== id));
}

/** A note nobody typed anything into is not a note. */
export const isEmpty = (note) =>
  !note || !(String(note.title).trim() || String(note.body).trim() || String(note.ref).trim());

/** Drop the blanks. Called when a note screen is left. */
export function tidy() {
  const kept = all().filter((one) => !isEmpty(one));
  if (kept.length !== all().length) save(kept);
  return kept;
}

/**
 * A note as plain text, for sharing, copying or saving as a file.
 *
 * Plain text because it has to read properly wherever it lands — a WhatsApp
 * chat, an email, a notes app — and every one of those takes plain text.
 */
export function asText(note, { date = null } = {}) {
  if (!note) return '';
  const title = String(note.title || '').trim() || 'Sermon notes';
  const when = date || (note.createdAt ? new Date(note.createdAt) : null);
  const heading = [
    [String(note.speaker || '').trim(), String(note.ref || '').trim()].filter(Boolean).join(' · '),
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : '',
  ].filter(Boolean);
  const body = String(note.body || '').trim();
  return [title, ...heading, '', body].join('\n').trim() + '\n';
}

/** A file name for the note, safe on every phone and desktop. */
export function fileName(note) {
  const base = String((note && note.title) || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return `${base || 'sermon-notes'}.txt`;
}
