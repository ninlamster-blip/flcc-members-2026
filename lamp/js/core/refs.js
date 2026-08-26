// Parsing and formatting Scripture references.
// Internally a reference is `BOOKID.chapter[.verse[-verse]]` — short, sortable,
// and safe as a storage key.

import { BOOKS, bookById, findBook } from './books.js';

/** "1 sam 17:45-47" → { book, chapter, verseStart, verseEnd } */
export function parseRef(input) {
  const text = String(input || '').trim().replace(/[–—]/g, '-');
  if (!text) return null;

  const dotted = text.match(/^([1-3]?[A-Za-z]{2,3})\.(\d+)(?:\.(\d+)(?:-(\d+))?)?$/);
  if (dotted && bookById(dotted[1])) {
    return build(bookById(dotted[1]), dotted[2], dotted[3], dotted[4]);
  }

  const m = text.match(/^\s*((?:[1-3]|i{1,3}|first|second|third)?\s*[A-Za-z][A-Za-z\s]*?)\s*(\d+)?\s*(?::\s*(\d+)\s*(?:-\s*(\d+))?)?\s*$/i);
  if (!m) return null;
  const book = findBook(m[1]);
  if (!book) return null;
  return build(book, m[2], m[3], m[4]);
}

function build(book, chapter, verseStart, verseEnd) {
  const ch = chapter === undefined || chapter === null || chapter === '' ? 1 : Number(chapter);
  if (!Number.isInteger(ch) || ch < 1 || ch > book.chapters) return null;
  const start = verseStart ? Number(verseStart) : null;
  let end = verseEnd ? Number(verseEnd) : null;
  if (end !== null && start !== null && end < start) end = start;
  return { book, chapter: ch, verseStart: start, verseEnd: end };
}

/** Canonical storage id: "JHN.3.16" or "JHN.3". */
export function refId(ref) {
  if (!ref) return '';
  let id = `${ref.book.id}.${ref.chapter}`;
  if (ref.verseStart) {
    id += `.${ref.verseStart}`;
    if (ref.verseEnd && ref.verseEnd !== ref.verseStart) id += `-${ref.verseEnd}`;
  }
  return id;
}

/** Human form: "John 3:16–17". */
export function formatRef(ref) {
  if (!ref) return '';
  let out = `${ref.book.name} ${ref.chapter}`;
  if (ref.verseStart) {
    out += `:${ref.verseStart}`;
    if (ref.verseEnd && ref.verseEnd !== ref.verseStart) out += `–${ref.verseEnd}`;
  }
  return out;
}

/** Parse then format, so authored content can be checked for typos. */
export function prettyRef(input) {
  const ref = parseRef(input);
  return ref ? formatRef(ref) : String(input || '');
}

export function chapterId(bookId, chapter) {
  return `${String(bookId).toUpperCase()}.${Number(chapter)}`;
}

/** Next/previous chapter across book boundaries — the reader needs both. */
export function stepChapter(bookId, chapter, delta) {
  const index = BOOKS.findIndex((b) => b.id === String(bookId).toUpperCase());
  if (index === -1) return null;
  let bookIndex = index;
  let ch = Number(chapter) + delta;
  while (ch < 1) {
    bookIndex -= 1;
    if (bookIndex < 0) return null;
    ch += BOOKS[bookIndex].chapters;
  }
  while (ch > BOOKS[bookIndex].chapters) {
    ch -= BOOKS[bookIndex].chapters;
    bookIndex += 1;
    if (bookIndex >= BOOKS.length) return null;
  }
  return { book: BOOKS[bookIndex], chapter: ch };
}

/**
 * A reference for a whole passage rather than a single verse: chapter ranges
 * and lists, as authored content uses them.
 *   "GEN.6-9"       → "Genesis 6–9"
 *   "GEN.12,15,22"  → "Genesis 12, 15, 22"
 *   "GEN.37,39-45"  → "Genesis 37, 39–45"
 * Falls back to the input untouched rather than showing an id to a child.
 */
export function displayRef(input) {
  const raw = String(input || '').trim();
  if (!raw) return '';

  const segments = raw.split(',').map((part) => part.trim()).filter(Boolean);
  if (!segments.length) return raw;

  const first = segments[0].match(/^(.+?)[.\s](\d+)(?:\s*[-–]\s*(\d+))?$/);
  if (!first) return prettyRef(raw);

  const book = bookById(first[1]) || findBook(first[1]);
  if (!book) return prettyRef(raw);

  const span = (from, to) => (to && to !== from ? `${from}–${to}` : String(from));
  const parts = [span(first[2], first[3])];

  for (const segment of segments.slice(1)) {
    const more = segment.match(/^(\d+)(?:\s*[-–]\s*(\d+))?$/);
    if (!more) return prettyRef(raw);
    parts.push(span(more[1], more[2]));
  }

  return `${book.name} ${parts.join(', ')}`;
}

/**
 * Where to open the Bible for a passage reference — the first chapter it names.
 * "GEN.37,39-45" starts at Genesis 37; "MRK.4.35-41" at Mark 4. Every story
 * can link into the reader, however its reference is written.
 */
export function firstChapter(input) {
  const head = String(input || '').split(',')[0].trim().replace(/\s*[-–]\s*\d+\s*$/, '');
  const ref = parseRef(head);
  return ref ? { book: ref.book, chapter: ref.chapter } : null;
}
