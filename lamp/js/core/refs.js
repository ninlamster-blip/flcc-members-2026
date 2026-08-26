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
