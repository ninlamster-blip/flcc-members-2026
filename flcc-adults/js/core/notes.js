// Sermon notes.
//
// The whole module is thirty lines because the feature is meant to be thirty
// lines. A member has their phone out during a sermon; what they need is a
// page that is already open and a keyboard, not a template with eight headings
// asking them to categorise a thought while the preacher is still talking.
//
// So a note is shaped like a message on the Watch tab, because that is the
// shape members asked to write in: the message (title, preacher, passage),
// what it was about, what it said in three points, the question to sit with,
// and then their own words (`body`). Nothing is required, nothing is
// validated, and an empty note is thrown away rather than saved as a piece of
// clutter to tidy up later. Notes written before the sections existed have
// only `body`, and read back as "your own words" with the rest blank.
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

/** Three, like the Watch tab. A member reading it back will read three. */
export const POINTS = 3;

/** The three points of a note, always three strings, whatever was stored. */
export function pointsOf(note) {
  const kept = Array.isArray(note && note.points) ? note.points : [];
  return Array.from({ length: POINTS }, (_, i) => String(kept[i] || ''));
}

export function create({ title = '', speaker = '', ref = '', about = '', points = [],
                         question = '', body = '', messageId = '' } = {}) {
  const now = new Date().toISOString();
  const note = {
    id: nextId(),
    title, speaker, ref, about, points: pointsOf({ points }), question, body, messageId,
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
  !note || ![note.title, note.body, note.ref, note.about, note.question, ...pointsOf(note)]
    .some((field) => String(field || '').trim());

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
 * chat, an email, a notes app — and every one of those takes plain text. It
 * follows the note's own sections, and a section left blank is left out
 * rather than printed as an empty heading.
 */
export function asText(note, { date = null } = {}) {
  if (!note) return '';
  const clean = (value) => String(value || '').trim();
  const title = clean(note.title) || 'Sermon notes';
  const when = date || (note.createdAt ? new Date(note.createdAt) : null);
  const heading = [
    [clean(note.speaker), clean(note.ref)].filter(Boolean).join(' · '),
    when && !Number.isNaN(when.getTime())
      ? when.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
      : '',
  ].filter(Boolean);

  const points = pointsOf(note).map(clean);
  const said = points.some(Boolean)
    ? points.map((line, i) => (line ? `${i + 1}. ${line}` : '')).filter(Boolean).join('\n')
    : '';
  const sections = [
    ['WHAT IT WAS ABOUT', clean(note.about)],
    ['WHAT IT SAID', said],
    ['SIT WITH THIS', clean(note.question)],
    ['YOUR OWN WORDS', clean(note.body)],
  ].filter(([, text]) => text).map(([name, text]) => `${name}\n${text}`);

  return [[title, ...heading].join('\n'), ...sections].join('\n\n') + '\n';
}

/** A file name for the note, safe on every phone and desktop. */
export function fileName(note) {
  const base = String((note && note.title) || '').trim().toLowerCase()
    .replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 48);
  return `${base || 'sermon-notes'}.txt`;
}
