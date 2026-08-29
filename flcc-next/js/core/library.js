// The library: what the ministry can change, and how.
//
// Kids and teens keep asking for more, and until now "more" meant a developer,
// a commit and a deploy. This module makes every authored file editable from
// the dashboard on the day somebody thinks of the question.
//
// How it works, and what it honestly is:
//
//   · The committed JSON under content/ stays the base. It is never rewritten
//     — there is no server here to rewrite it with.
//   · A *pack* of changes lives in `next/v1/library` on the device that made
//     them: rows added, rows edited, rows removed, keyed by kind.
//   · `content.js` fetches the base and lays the pack over it on every read, so
//     the app, the games and the audit all see the same merged content.
//
// Which means the honest limits, stated here and on the dashboard:
//
//   1. A pack lives on ONE DEVICE. A leader who edits on their phone has
//      changed their phone. Export the pack and import it elsewhere, or paste
//      the finished file into the repository to change it for everybody.
//   2. Scripture is not in here. Everything under `bible/` is the text of the
//      Bible; it is not the ministry's to edit and no screen can touch it.

import * as store from './storage.js';
import { SYMBOL_NAMES, TONES } from './art.js';

const PALETTE = [...TONES, 'paper', 'ink'];
const AUDIENCE = ['both', 'kids', 'teens'];

// ── Reading and writing a field by path ────────────────────────────────────
//
// A lesson's question lives at `quiz.q`, so fields address themselves with a
// dotted path rather than every kind needing its own reader.

export function get(row, path) {
  return String(path).split('.').reduce((at, key) => (at == null ? undefined : at[key]), row);
}

export function set(row, path, value) {
  const parts = String(path).split('.');
  const last = parts.pop();
  let at = row;
  for (const key of parts) at = (at[key] ??= {});
  at[last] = value;
  return row;
}

// ── The kinds ──────────────────────────────────────────────────────────────
//
// One entry per authored file. `key` is what identifies a row across edits:
// rows the ministry adds get a real id, and rows that shipped without one are
// identified by the text that makes them what they are. That is why editing a
// quiz question's wording is treated as a new question rather than a change to
// the old one — the question IS its wording, and pretending otherwise would
// silently orphan the edit the next time the base file changed.

const dual = (path, label, help) => ({ path, label, type: 'dual', help });

export const KINDS = [
  {
    id: 'daily',
    file: 'daily.json',
    label: 'Daily words',
    one: 'daily word',
    note: 'One a day, in order, for as many days as there are entries.',
    key: (row) => row.id || row.title,
    title: (row) => row.title,
    blank: () => ({ title: '', ref: '', text: '', translation: 'WEB', tone: 'sky', symbol: 'light',
      reflection: { kids: '', teens: '' }, prayer: { kids: '', teens: '' },
      challenge: { kids: '', teens: '' }, devotion: { kids: '', teens: '' }, reviewedBy: '' }),
    fields: [
      { path: 'title', label: 'Title', type: 'text', help: 'Set in capitals, like the others.' },
      { path: 'text', label: 'The verse', type: 'long' },
      { path: 'ref', label: 'Reference', type: 'text', help: 'John 3:16' },
      { path: 'translation', label: 'Translation', type: 'text' },
      { path: 'tone', label: 'Colour', type: 'choice', options: PALETTE },
      { path: 'symbol', label: 'Illustration', type: 'choice', options: SYMBOL_NAMES },
      dual('reflection', 'Reflection'),
      dual('prayer', 'Prayer'),
      dual('challenge', 'Today’s challenge'),
      dual('devotion', 'The devotional'),
      { path: 'reviewedBy', label: 'Checked by', type: 'text', help: 'Who read this before it went out.' },
    ],
  },
  {
    id: 'quiz',
    file: 'games/quiz.json',
    label: 'Quiz questions',
    one: 'question',
    note: 'Dealt by the Bible quiz, the speed quiz and Our church, according to each round’s topics.',
    key: (row) => row.id || row.q,
    title: (row) => row.q,
    blank: () => ({ q: '', options: ['', '', ''], answer: 0, why: '', ageGroup: 'both', topic: 'bible' }),
    fields: [
      { path: 'q', label: 'Question', type: 'text' },
      { path: 'options', label: 'Answers', type: 'answers', answerPath: 'answer',
        help: 'Three of them. Mark the right one — the app shuffles the order every day.' },
      { path: 'why', label: 'After the answer', type: 'long', help: 'One line saying why. Shown either way.' },
      { path: 'topic', label: 'Topic', type: 'choice', options: ['bible', 'jesus', 'flcc'] },
      { path: 'ageGroup', label: 'Who for', type: 'choice', options: AUDIENCE },
    ],
  },
  {
    id: 'who-am-i',
    file: 'games/who-am-i.json',
    label: 'Who am I? rounds',
    one: 'round',
    note: 'Three clues, hardest first. A clue must never contain the answer.',
    key: (row) => row.id || row.answer,
    title: (row) => row.answer,
    blank: () => ({ answer: '', clues: ['', '', ''], options: ['', '', ''], fact: '', ageGroup: 'both' }),
    fields: [
      { path: 'answer', label: 'Who it is', type: 'text' },
      { path: 'clues', label: 'Three clues', type: 'list', size: 3, help: 'Hardest first. None of them may say the name.' },
      { path: 'options', label: 'The three names offered', type: 'list', size: 3, help: 'The right one must be among them.' },
      { path: 'fact', label: 'One more thing about them', type: 'long' },
      { path: 'ageGroup', label: 'Who for', type: 'choice', options: AUDIENCE },
    ],
  },
  {
    id: 'verses',
    file: 'games/verse-builder.json',
    label: 'Verse-builder verses',
    one: 'verse',
    note: 'Rebuilt word by word, so four words is the minimum and about twenty is the sensible maximum.',
    key: (row) => row.id || row.ref,
    title: (row) => row.ref,
    blank: () => ({ text: '', ref: '', ageGroup: 'both' }),
    fields: [
      { path: 'text', label: 'The verse', type: 'long' },
      { path: 'ref', label: 'Reference', type: 'text' },
      { path: 'ageGroup', label: 'Who for', type: 'choice', options: AUDIENCE },
    ],
  },
  {
    id: 'crossword',
    file: 'games/crossword.json',
    label: 'Crossword puzzles',
    one: 'puzzle',
    note: 'The grid is built from the answers, so a word that crosses nothing cannot be placed.',
    key: (row) => row.id || row.title,
    title: (row) => row.title,
    blank: () => ({ id: '', title: '', ageGroup: 'both', words: [{ answer: '', clue: '' }] }),
    fields: [
      { path: 'id', label: 'Short id', type: 'text', help: 'Lower case, no spaces.' },
      { path: 'title', label: 'Title', type: 'text' },
      { path: 'words', label: 'Answers and clues', type: 'pairs',
        of: [['answer', 'Answer'], ['clue', 'Clue']],
        help: 'Six or more. A clue must never contain its own answer.' },
      { path: 'ageGroup', label: 'Who for', type: 'choice', options: AUDIENCE },
    ],
  },
  {
    id: 'games',
    file: 'games.json',
    label: 'Games',
    one: 'game',
    note: 'A game listed here must have an implementation in js/screens/game.js, so this is for renaming and retuning rather than inventing.',
    key: (row) => row.id,
    title: (row) => row.title,
    blank: () => ({ id: '', title: '', tone: 'rose', symbol: 'question', difficulty: 2,
      blurb: { kids: '', teens: '' } }),
    fields: [
      { path: 'id', label: 'Id', type: 'text', help: 'Must match a game the app knows how to play.' },
      { path: 'title', label: 'Title', type: 'text' },
      dual('blurb', 'One line about it'),
      { path: 'difficulty', label: 'Difficulty', type: 'number', min: 1, max: 5 },
      { path: 'tone', label: 'Colour', type: 'choice', options: PALETTE },
      { path: 'symbol', label: 'Illustration', type: 'choice', options: SYMBOL_NAMES },
    ],
  },
  {
    id: 'journeys',
    file: 'journeys.json',
    label: 'Journeys',
    one: 'journey',
    note: 'The lesson count here must match the number of lessons in the journey’s own file.',
    key: (row) => row.id,
    title: (row) => row.title,
    blank: () => ({ id: '', title: '', tone: 'captain', symbol: 'book', ageGroup: 'both', lessons: 0,
      blurb: { kids: '', teens: '' } }),
    fields: [
      { path: 'id', label: 'Id', type: 'text' },
      { path: 'title', label: 'Title', type: 'text' },
      dual('blurb', 'One line about it'),
      { path: 'lessons', label: 'How many lessons', type: 'number', min: 1, max: 60 },
      { path: 'tone', label: 'Colour', type: 'choice', options: PALETTE },
      { path: 'symbol', label: 'Illustration', type: 'choice', options: SYMBOL_NAMES },
      { path: 'ageGroup', label: 'Who for', type: 'choice', options: AUDIENCE },
    ],
  },
  {
    id: 'real-life',
    file: 'real-life.json',
    label: 'Real-life topics',
    one: 'topic',
    note: 'The things young people ask about that are not, on the face of it, Bible questions.',
    key: (row) => row.id || row.title,
    title: (row) => row.title,
    blank: () => ({ id: '', title: '', tone: 'rose', symbol: 'bulb', ageGroup: 'both',
      verse: '', ref: '', hook: { kids: '', teens: '' }, body: { kids: '', teens: '' },
      step: { kids: '', teens: '' } }),
    fields: [
      { path: 'id', label: 'Id', type: 'text' },
      { path: 'title', label: 'Title', type: 'text' },
      dual('hook', 'The line that gets them in'),
      dual('body', 'What the Bible says about it'),
      dual('step', 'One thing to do'),
      { path: 'verse', label: 'The verse', type: 'long' },
      { path: 'ref', label: 'Reference', type: 'text' },
      { path: 'tone', label: 'Colour', type: 'choice', options: PALETTE },
      { path: 'symbol', label: 'Illustration', type: 'choice', options: SYMBOL_NAMES },
      { path: 'ageGroup', label: 'Who for', type: 'choice', options: AUDIENCE },
    ],
  },
  {
    id: 'events',
    file: 'events.json',
    label: 'Events',
    one: 'event',
    note: 'What is on. An RSVP is remembered on the young person’s own device and sent nowhere.',
    key: (row) => row.id,
    title: (row) => (row.title && (row.title.teens || row.title.kids)) || row.id,
    blank: () => ({ id: '', title: { kids: '', teens: '' }, tone: 'sunshine', symbol: 'calendar',
      when: '', where: '', for: 'both', blurb: '' }),
    fields: [
      { path: 'id', label: 'Id', type: 'text' },
      dual('title', 'Title'),
      { path: 'when', label: 'When', type: 'text', help: 'Friday · 5:00 PM' },
      { path: 'where', label: 'Where', type: 'text' },
      { path: 'blurb', label: 'One line about it', type: 'long' },
      { path: 'for', label: 'Who for', type: 'choice', options: AUDIENCE },
      { path: 'tone', label: 'Colour', type: 'choice', options: PALETTE },
      { path: 'symbol', label: 'Illustration', type: 'choice', options: SYMBOL_NAMES },
    ],
  },
  {
    id: 'achievements',
    file: 'achievements.json',
    label: 'Achievements',
    one: 'achievement',
    note: 'Earned from what the app already records. Nothing else can be counted.',
    key: (row) => row.id || row.title,
    title: (row) => row.title,
    blank: () => ({ id: '', title: '', tone: 'sunshine', symbol: 'star', how: '',
      need: { kind: 'lesson', count: 1 } }),
    fields: [
      { path: 'id', label: 'Id', type: 'text' },
      { path: 'title', label: 'Title', type: 'text' },
      { path: 'how', label: 'How you get it', type: 'long' },
      { path: 'need.kind', label: 'Counted from', type: 'choice',
        options: ['streak', 'devotional', 'lesson', 'game', 'challenge', 'prayer'] },
      { path: 'need.count', label: 'How many', type: 'number', min: 1, max: 500 },
      { path: 'tone', label: 'Colour', type: 'choice', options: PALETTE },
      { path: 'symbol', label: 'Illustration', type: 'choice', options: SYMBOL_NAMES },
    ],
  },
  {
    id: 'bible-find',
    file: 'bible-find.json',
    label: 'Where do I look?',
    one: 'list',
    note: 'A feeling, and the places in the Bible to read about it. Every reference is opened in the reader, so it has to be one the app can resolve.',
    key: (row) => row.id,
    title: (row) => (row.title && (row.title.teens || row.title.kids)) || row.id,
    blank: () => ({ id: '', tone: 'sky', symbol: 'light', title: { kids: '', teens: '' },
      need: { kids: '', teens: '' }, refs: [''] }),
    fields: [
      { path: 'id', label: 'Id', type: 'text' },
      dual('title', 'Title'),
      dual('need', 'When you would open this'),
      { path: 'refs', label: 'Places to read', type: 'list', help: 'One reference a line — John 3:16, Psalm 23.' },
      { path: 'tone', label: 'Colour', type: 'choice', options: PALETTE },
      { path: 'symbol', label: 'Illustration', type: 'choice', options: SYMBOL_NAMES },
    ],
  },
  {
    id: 'bible-books',
    file: 'bible-books.json',
    label: 'What each Bible book is',
    one: 'book line',
    note: 'The one line shown above a book’s chapters. The book list itself comes from Scripture and cannot be edited.',
    key: (row) => String(row.n),
    title: (row) => `Book ${row.n}`,
    blank: () => ({ n: 1, about: '' }),
    fields: [
      { path: 'n', label: 'Book number', type: 'number', min: 1, max: 66 },
      { path: 'about', label: 'What it is, in one line', type: 'long' },
    ],
  },
  {
    id: 'help-lines',
    file: 'help-lines.json',
    path: 'lines',
    label: 'Help lines',
    one: 'help line',
    note: 'Shown to a young person whose question suggests they are in danger. Every number here must be checked against the organisation that publishes it — by a person, not from memory.',
    key: (row) => row.name,
    title: (row) => row.name,
    blank: () => ({ name: '', number: '', detail: '' }),
    fields: [
      { path: 'name', label: 'Who they are', type: 'text' },
      { path: 'number', label: 'Number', type: 'text', help: 'Leave empty if this is a person rather than a phone line.' },
      { path: 'detail', label: 'What they do', type: 'long' },
    ],
  },
];

/**
 * Lessons are the one kind with a file per journey rather than a file, so the
 * kind is made on demand from the journey's id. Everything else about it — the
 * fields, the merge, the editor — is the same as any other kind.
 */
const LESSONS = {
  one: 'lesson',
  note: 'Shown in the order they appear in the file. Adding one here also means raising the journey’s lesson count.',
  key: (row) => row.id,
  title: (row) => row.title,
  blank: () => ({ id: '', title: '', ref: '', text: '',
    body: { kids: '', teens: '' },
    quiz: { q: { kids: '', teens: '' }, options: ['', '', ''], answer: 0, why: { kids: '', teens: '' } } }),
  fields: [
    { path: 'id', label: 'Id', type: 'text', help: 'Unique inside this journey — l16, l17.' },
    { path: 'title', label: 'Title', type: 'text', help: 'Set in capitals, like the others.' },
    { path: 'text', label: 'The Scripture', type: 'long' },
    { path: 'ref', label: 'Reference', type: 'text' },
    { path: 'body', label: 'What it means', type: 'dual' },
    { path: 'quiz.q', label: 'The question', type: 'dual' },
    { path: 'quiz.options', label: 'Answers', type: 'answers', answerPath: 'quiz.answer',
      help: 'Mark the right one — the app shuffles the order every day.' },
    { path: 'quiz.why', label: 'After the answer', type: 'dual' },
  ],
};

const LESSON_FILE = /^journeys\/([a-z0-9-]+)\.json$/;

export function lessonKind(journeyId, label = journeyId) {
  return { ...LESSONS, id: `lessons:${journeyId}`, file: `journeys/${journeyId}.json`, label: `Lessons · ${label}` };
}

export const kindForFile = (file) => {
  const journey = LESSON_FILE.exec(String(file || ''));
  if (journey) return lessonKind(journey[1]);
  return KINDS.find((kind) => kind.file === file) || null;
};

export const kindOf = (id) => (String(id).startsWith('lessons:')
  ? lessonKind(String(id).slice('lessons:'.length))
  : KINDS.find((kind) => kind.id === id) || null);

// ── The pack ───────────────────────────────────────────────────────────────

const EMPTY_FILE = { added: [], edited: {}, removed: [] };

export function getPack() {
  const saved = store.read(store.KEYS.library, null) || {};
  return { version: 1, updated: saved.updated || null, files: { ...(saved.files || {}) } };
}

function savePack(pack) {
  store.write(store.KEYS.library, { ...pack, updated: new Date().toISOString() });
  return pack;
}

export function patchFor(file, pack = getPack()) {
  return { ...EMPTY_FILE, ...(pack.files[file] || {}) };
}

/**
 * Base rows + a pack = what the app actually shows.
 *
 * Pure, and the reason it is: this is the one piece of the feature that can be
 * got subtly wrong — an edit that vanishes, a removal that comes back — and it
 * is the piece a test can pin down completely.
 */
export function merge(rows, patch, keyOf) {
  const base = Array.isArray(rows) ? rows : [];
  const { added = [], edited = {}, removed = [] } = patch || {};
  const gone = new Set(removed);
  const out = [];
  for (const row of base.concat(added)) {
    const key = keyOf(row);
    if (gone.has(key)) continue;
    out.push(Object.prototype.hasOwnProperty.call(edited, key) ? edited[key] : row);
  }
  return out;
}

/**
 * Lay this device's pack over a file that has just been fetched.
 *
 * Files the editor does not know about pass straight through, which is what
 * keeps `content.js` from needing to know which files are editable.
 */
export function apply(file, base, pack = getPack()) {
  const kind = kindForFile(file);
  if (!kind) return base;
  const patch = patchFor(file, pack);
  if (!patch.added.length && !patch.removed.length && !Object.keys(patch.edited).length) return base;
  if (kind.path) {
    const inner = merge((base || {})[kind.path], patch, kind.key);
    return { ...(base || {}), [kind.path]: inner };
  }
  return merge(base, patch, kind.key);
}

/** The rows of a kind as the editor sees them: merged, and labelled. */
export function rowsOf(kind, base, pack = getPack()) {
  const rows = kind.path ? ((base || {})[kind.path] || []) : (base || []);
  const patch = patchFor(kind.file, pack);
  const baseKeys = new Set(rows.map(kind.key));
  const merged = merge(rows, patch, kind.key);
  return merged.map((row) => {
    const key = kind.key(row);
    return {
      row,
      key,
      state: !baseKeys.has(key) ? 'added'
        : Object.prototype.hasOwnProperty.call(patch.edited, key) ? 'edited'
          : 'shipped',
    };
  });
}

/** Rows the ministry removed, so the dashboard can offer them back. */
export function removedOf(kind, base, pack = getPack()) {
  const rows = kind.path ? ((base || {})[kind.path] || []) : (base || []);
  const gone = new Set(patchFor(kind.file, pack).removed);
  const patch = patchFor(kind.file, pack);
  return rows.concat(patch.added).filter((row) => gone.has(kind.key(row)));
}

// ── Changing something ─────────────────────────────────────────────────────

function editFile(file, change) {
  const pack = getPack();
  const patch = patchFor(file, pack);
  change(patch);
  pack.files[file] = patch;
  return savePack(pack);
}

export function addRow(kind, row) {
  const next = { ...row };
  // A row somebody adds gets an id of its own, so renaming it later is an edit
  // rather than a new row plus an orphan.
  if (!next.id && kind.fields.some((field) => field.path === 'id')) {
    next.id = `x${Date.now().toString(36)}`;
  }
  editFile(kind.file, (patch) => {
    patch.added = [...patch.added, next];
    patch.removed = patch.removed.filter((key) => key !== kind.key(next));
  });
  return next;
}

export function editRow(kind, key, row) {
  editFile(kind.file, (patch) => {
    // Editing a row this device added is a change to that row, not a patch on
    // top of it — otherwise the pack carries the same row twice.
    const at = patch.added.findIndex((one) => kind.key(one) === key);
    if (at >= 0 && kind.key(row) === key) patch.added[at] = row;
    else patch.edited = { ...patch.edited, [key]: row };
  });
  return row;
}

export function removeRow(kind, key) {
  editFile(kind.file, (patch) => {
    patch.removed = [...new Set([...patch.removed, key])];
    patch.added = patch.added.filter((one) => kind.key(one) !== key);
    if (Object.prototype.hasOwnProperty.call(patch.edited, key)) {
      const { [key]: _gone, ...rest } = patch.edited;
      patch.edited = rest;
    }
  });
}

/** Drop an edit, so the row goes back to what the committed file says. */
export function resetRow(kind, key) {
  editFile(kind.file, (patch) => {
    const { [key]: _gone, ...rest } = patch.edited;
    patch.edited = rest;
  });
}

export function restoreRow(kind, key) {
  editFile(kind.file, (patch) => { patch.removed = patch.removed.filter((one) => one !== key); });
}

/** Undo every change to one file, back to what was committed. */
export function resetFile(file) {
  const pack = getPack();
  delete pack.files[file];
  return savePack(pack);
}

export function resetAll() {
  store.remove(store.KEYS.library);
}

// ── Counting, exporting, importing ─────────────────────────────────────────

export function summary(pack = getPack()) {
  const files = [];
  let added = 0;
  let edited = 0;
  let removed = 0;
  for (const [file, patch] of Object.entries(pack.files || {})) {
    const one = {
      file,
      label: (kindForFile(file) || {}).label || file,
      added: (patch.added || []).length,
      edited: Object.keys(patch.edited || {}).length,
      removed: (patch.removed || []).length,
    };
    if (!one.added && !one.edited && !one.removed) continue;
    added += one.added; edited += one.edited; removed += one.removed;
    files.push(one);
  }
  return { files, added, edited, removed, total: added + edited + removed, updated: pack.updated };
}

/**
 * Read a pack that came from another device.
 *
 * Anything that is not a pack — someone pasting a content file, or an
 * unrelated download — is refused with a reason rather than half-applied.
 */
export function readPack(text) {
  let data;
  try { data = typeof text === 'string' ? JSON.parse(text) : text; }
  catch { throw new Error('That is not JSON.'); }
  if (!data || typeof data !== 'object' || Array.isArray(data) || !data.files || typeof data.files !== 'object') {
    throw new Error('That is not an FLCC NEXT content pack. Export one from a dashboard first.');
  }
  const files = {};
  for (const [file, patch] of Object.entries(data.files)) {
    if (!kindForFile(file)) continue;      // a file this version does not know
    files[file] = {
      added: Array.isArray(patch.added) ? patch.added : [],
      edited: (patch.edited && typeof patch.edited === 'object' && !Array.isArray(patch.edited)) ? patch.edited : {},
      removed: Array.isArray(patch.removed) ? patch.removed : [],
    };
  }
  if (!Object.keys(files).length) throw new Error('That pack has nothing in it this version can use.');
  return { version: 1, updated: data.updated || null, files };
}

/** Replace this device's pack, or lay another one on top of it. */
export function importPack(text, { replace = false } = {}) {
  const incoming = readPack(text);
  if (replace) return savePack(incoming);
  const pack = getPack();
  for (const [file, patch] of Object.entries(incoming.files)) {
    const mine = patchFor(file, pack);
    const kind = kindForFile(file);
    const keys = new Set(mine.added.map(kind.key));
    pack.files[file] = {
      added: [...mine.added, ...patch.added.filter((row) => !keys.has(kind.key(row)))],
      edited: { ...mine.edited, ...patch.edited },
      removed: [...new Set([...mine.removed, ...patch.removed])],
    };
  }
  return savePack(pack);
}
