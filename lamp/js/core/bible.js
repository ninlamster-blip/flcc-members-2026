// Scripture text: fetch, normalise, cache.
//
// MVP ships public-domain translations only (SPEC.md §6). Text is never
// bundled with the app — it comes from the same sources the rest of this
// repository already uses, and is cached per chapter so a visited chapter
// reads offline afterwards.

import { bookById } from './books.js';
import { chapterId } from './refs.js';
import * as store from './storage.js';

export const TRANSLATIONS = [
  { id: 'WEB', name: 'World English Bible', note: 'Modern English, public domain', bolls: 'WEB' },
  { id: 'KJV', name: 'King James Version',  note: 'Classic English, public domain', bolls: 'KJV' },
  { id: 'ASV', name: 'American Standard',   note: 'Public domain', bolls: 'ASV' },
];

export const DEFAULT_TRANSLATION = 'WEB';

export function translation(id) {
  return TRANSLATIONS.find((t) => t.id === id) || TRANSLATIONS[0];
}

// ── Normalising ─────────────────────────────────────────────────────────────
// bolls.life has shipped two shapes of the same payload over the years:
// `{ pk, verse: <number>, text: <string> }` and `{ pk: <number>, verse: <string> }`.
// Rather than bet on one, accept either — and refuse anything that is neither.

export function stripTags(html) {
  return String(html == null ? '' : html)
    .replace(/<[^>]*>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

export function normalizeBolls(payload) {
  if (!Array.isArray(payload)) return [];
  const verses = [];
  for (const row of payload) {
    if (!row || typeof row !== 'object') continue;
    let number = null;
    let text = null;
    if (typeof row.verse === 'number') {           // { pk, verse: 1, text: "…" }
      number = row.verse;
      text = row.text;
    } else if (typeof row.verse === 'string') {    // { pk: 1, verse: "…" }
      number = Number(row.pk);
      text = row.verse;
    }
    if (!Number.isInteger(number) || number < 1) continue;
    const clean = stripTags(text);
    if (!clean) continue;
    verses.push({ n: number, text: clean });
  }
  return verses.sort((a, b) => a.n - b.n);
}

export function normalizeBibleApi(payload) {
  if (!payload || !Array.isArray(payload.verses)) return [];
  return payload.verses
    .map((v) => ({ n: Number(v.verse), text: stripTags(v.text) }))
    .filter((v) => Number.isInteger(v.n) && v.text)
    .sort((a, b) => a.n - b.n);
}

// ── Cache ───────────────────────────────────────────────────────────────────

const DB_NAME = 'lamp-bible';
const STORE = 'chapters';
let dbPromise = null;

function openDb() {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  if (!dbPromise) {
    dbPromise = new Promise((resolve) => {
      let request;
      try { request = indexedDB.open(DB_NAME, 1); } catch { return resolve(null); }
      request.onupgradeneeded = () => {
        if (!request.result.objectStoreNames.contains(STORE)) request.result.createObjectStore(STORE);
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    });
  }
  return dbPromise;
}

function cacheKey(translationId, bookId, chapter) {
  return `${translationId}/${chapterId(bookId, chapter)}`;
}

async function cacheGet(key) {
  const db = await openDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).get(key);
        request.onsuccess = () => resolve(request.result || null);
        request.onerror = () => resolve(null);
      } catch { resolve(null); }
    });
  }
  return store.read(store.KEYS.bible + key, null);
}

async function cachePut(key, value) {
  const db = await openDb();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(value, key);
        tx.oncomplete = () => resolve(true);
        tx.onerror = () => resolve(false);
      } catch { resolve(false); }
    });
  }
  return store.write(store.KEYS.bible + key, value);
}

export async function cachedChapters() {
  const db = await openDb();
  if (!db) return store.keys().filter((k) => k.startsWith(store.KEYS.bible)).length;
  return new Promise((resolve) => {
    try {
      const request = db.transaction(STORE, 'readonly').objectStore(STORE).count();
      request.onsuccess = () => resolve(request.result || 0);
      request.onerror = () => resolve(0);
    } catch { resolve(0); }
  });
}

// ── Fetching ────────────────────────────────────────────────────────────────

async function fetchJson(url, timeout = 12000) {
  const controller = typeof AbortController === 'undefined' ? null : new AbortController();
  const timer = controller ? setTimeout(() => controller.abort(), timeout) : null;
  try {
    const response = await fetch(url, controller ? { signal: controller.signal } : undefined);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return await response.json();
  } finally {
    if (timer) clearTimeout(timer);
  }
}

/**
 * A chapter, from cache when possible.
 * Returns { book, chapter, translation, verses: [{ n, text }], offline }.
 * Throws only when there is no cached copy *and* no network.
 */
export async function getChapter(bookId, chapter, translationId = DEFAULT_TRANSLATION, { refresh = false } = {}) {
  const book = bookById(bookId);
  if (!book) throw new Error(`Unknown book "${bookId}"`);
  const ch = Number(chapter);
  if (!Number.isInteger(ch) || ch < 1 || ch > book.chapters) {
    throw new Error(`${book.name} has ${book.chapters} chapter${book.chapters === 1 ? '' : 's'}`);
  }

  const key = cacheKey(translationId, book.id, ch);
  if (!refresh) {
    const hit = await cacheGet(key);
    if (hit && Array.isArray(hit.verses) && hit.verses.length) {
      return { ...hit, book, chapter: ch, translation: translationId, offline: true };
    }
  }

  const trans = translation(translationId);
  let verses = [];
  try {
    verses = normalizeBolls(await fetchJson(`https://bolls.life/get-text/${trans.bolls}/${book.number}/${ch}/`));
  } catch { /* fall through to the second source */ }

  if (!verses.length) {
    try {
      const url = `https://bible-api.com/${encodeURIComponent(`${book.name} ${ch}`)}?translation=${trans.id.toLowerCase()}`;
      verses = normalizeBibleApi(await fetchJson(url));
    } catch { /* both sources unreachable */ }
  }

  if (!verses.length) {
    const error = new Error('Scripture could not be downloaded. Connect once and this chapter is yours offline.');
    error.code = 'OFFLINE';
    throw error;
  }

  const record = { verses, fetchedAt: Date.now() };
  await cachePut(key, record);
  return { ...record, book, chapter: ch, translation: translationId, offline: false };
}

/** A single verse or short range, for a daily verse or a memory verse. */
export async function getPassage(ref, translationId = DEFAULT_TRANSLATION, options) {
  const chapter = await getChapter(ref.book.id, ref.chapter, translationId, options);
  if (!ref.verseStart) return { ...chapter, verses: chapter.verses };
  const end = ref.verseEnd || ref.verseStart;
  return { ...chapter, verses: chapter.verses.filter((v) => v.n >= ref.verseStart && v.n <= end) };
}

export function joinText(verses) {
  return (verses || []).map((v) => v.text).join(' ');
}

// ── Search over what is already cached ──────────────────────────────────────
// Search is deliberately local: it looks through the chapters this device has
// downloaded, which is honest about what it can find and works on a plane.

export async function searchCached(query, { limit = 40, translationId = null } = {}) {
  const needle = String(query || '').trim().toLowerCase();
  if (needle.length < 3) return { results: [], searched: 0 };

  const entries = [];
  const db = await openDb();
  if (db) {
    await new Promise((resolve) => {
      try {
        const request = db.transaction(STORE, 'readonly').objectStore(STORE).openCursor();
        request.onsuccess = () => {
          const cursor = request.result;
          if (!cursor) return resolve();
          entries.push([String(cursor.key), cursor.value]);
          cursor.continue();
        };
        request.onerror = () => resolve();
      } catch { resolve(); }
    });
  } else {
    for (const key of store.keys()) {
      if (!key.startsWith(store.KEYS.bible)) continue;
      entries.push([key.slice(store.KEYS.bible.length), store.read(key, null)]);
    }
  }

  const results = [];
  for (const [key, record] of entries) {
    if (!record || !Array.isArray(record.verses)) continue;
    const [trans, id] = key.split('/');
    if (translationId && trans !== translationId) continue;
    const [bookId, chapter] = String(id || '').split('.');
    const book = bookById(bookId);
    if (!book) continue;
    for (const verse of record.verses) {
      if (results.length >= limit) return { results, searched: entries.length };
      if (verse.text.toLowerCase().includes(needle)) {
        results.push({ book, chapter: Number(chapter), verse: verse.n, text: verse.text, translation: trans });
      }
    }
  }
  return { results, searched: entries.length };
}
