// The Bible itself.
//
// Scripture is not content. Everything under `content/` is the teaching team's
// own writing; the text of Scripture is not ours to edit, and no screen in this
// app can change a word of it. That distinction is the whole reason this module
// is separate from `content.js`.
//
// ── Where the text comes from, and why ─────────────────────────────────────
//
// The 66 books, in three public-domain translations, are committed at
// `flcc-next/bible/` — built once by `scripts/build-next-bible.mjs`. This app
// reads those files rather than committing a second identical copy of them.
//
// That is a deliberate, narrow exception to the boundary between the apps in
// this repository, and it is worth being precise about what it is and is not:
//
//   It is       a read of static, public-domain, same-origin TEXT, at a fixed
//               path, in one direction, by one module.
//   It is not   a shared module, a shared storage namespace, or a read of
//               anything under `flcc-next/content/` — that content is written
//               for children and has no business here.
//
// The alternative was 14 MB of duplicated Scripture in one repository, kept in
// step by hand, where a correction applied to one copy silently would not
// reach the other. A shared, immutable text is the better bargain, and the
// path is stated in exactly one place — `BIBLE` below — so moving it later is
// a one-line change.
//
// Three translations, all public domain:
//
//   web  World English Bible      modern English, the default
//   bbe  Bible in Basic English   about a thousand words, plainer going
//   tgl  Ang Dating Biblia (1905) Tagalog, the language many FLCC families pray in
//
// A book is one file. Opening John downloads John, not a Bible, and the service
// worker keeps what has actually been read — so a chapter read on the church
// wifi is still readable on the commute.

import * as store from './storage.js';

export const DEFAULT_CODE = 'web';

/** The one place the shared Scripture path is written down. */
export const BIBLE = '../../../flcc-next/bible/';

const base = (path) => new URL(`${BIBLE}${path}`, import.meta.url);
const cache = new Map();

function loadJson(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(base(path))
    .then((response) => {
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      return response.json();
    })
    .catch((error) => { cache.delete(path); throw error; });
  cache.set(path, promise);
  return promise;
}

/** The 66 books, the three translations, and how many chapters each book has. */
export const manifest = () => loadJson('books.json');

/** One book, in one translation. `chapters[c - 1][v - 1]` is a verse. */
export const book = (code, number) => loadJson(`${code}/${number}.json`);

/** Is this book already on the device? Used to keep search off the network. */
export const isLoaded = (code, number) => cache.has(`${code}/${number}.json`);

// ── Names ──────────────────────────────────────────────────────────────────
//
// A reader types "john", "1 jn", "Juan", "Mga Awit" or "psalm". All of them
// should land somewhere sensible, so matching is done on a squashed form of
// the name and every book answers to several.

const squash = (text) => String(text || '').toLowerCase().replace(/[^a-z0-9]+/g, '');

/** Numbered books: "1st John", "I John", "first john" all mean "1john". */
function normalise(text) {
  return squash(String(text || '')
    .replace(/^\s*(1st|first|i)\s+/i, '1 ')
    .replace(/^\s*(2nd|second|ii)\s+/i, '2 ')
    .replace(/^\s*(3rd|third|iii)\s+/i, '3 '));
}

/**
 * The abbreviations that drop vowels rather than truncate — the ones printed
 * in study Bibles and written on whiteboards, which no amount of prefix
 * matching will ever guess. "Jud" is deliberately absent: it is Judges to some
 * people and Jude to others, so it stays a prefix match on Judges rather than
 * quietly picking one.
 */
const ALIASES = {
  gn: 1, ex: 2, lv: 3, nm: 4, dt: 5, jsh: 6, jdg: 7, rt: 8,
  '1sm': 9, '2sm': 10, '1kgs': 11, '2kgs': 12, '1chr': 13, '2chr': 14,
  ne: 16, ps: 19, pss: 19, prv: 20, qoh: 21, sos: 22, sng: 22,
  is: 23, jr: 24, lm: 25, ezk: 26, eze: 26, dn: 27, hs: 28, jl: 29, am: 30,
  ob: 31, jnh: 32, mi: 33, na: 34, hb: 35, zp: 36, hg: 37, zc: 38, ml: 39,
  mt: 40, mk: 41, mrk: 41, lk: 42, jn: 43, jhn: 43, ac: 44, acts: 44,
  rm: 45, '1co': 46, '2co': 47, gl: 48, ep: 49, php: 50, pp: 50, cl: 51,
  '1th': 52, '2th': 53, '1tm': 54, '2tm': 55, '1ti': 54, '2ti': 55,
  tit: 56, phm: 57, heb: 58, jas: 59, jms: 59,
  '1pt': 60, '2pt': 61, '1pe': 60, '2pe': 61,
  '1jn': 62, '2jn': 63, '3jn': 64, '1jo': 62, '2jo': 63, '3jo': 64,
  rv: 66, rev: 66,
};

/**
 * Half the Tagalog names open with an article — "Mga Awit", "Mga Kawikaan",
 * "Kay Tito" — so truncating the name as printed would file a third of the
 * canon under "mga". The article is dropped before truncating, and the full
 * name is kept as well, so both "Mga Awit" and "awit" find the Psalms.
 */
const stripArticle = (name) => String(name || '').replace(/^(mga|ang|kay)\s+/i, '');

/** Every spelling of a book that should resolve to it. */
export function namesFor(entry) {
  const names = [entry.name, entry.tagalog];
  const number = entry.name.match(/^\d/)?.[0] || '';
  const shorten = (name) => {
    const bare = stripArticle(String(name || '').replace(/^\d\s*/, ''));
    return bare ? [number + bare.slice(0, 4), number + bare.slice(0, 3)] : [];
  };
  // Three or four letters is what people actually type: "gene", "phil", "reve".
  names.push(...shorten(entry.name));
  if (entry.tagalog) names.push(stripArticle(entry.tagalog), ...shorten(entry.tagalog));
  for (const [alias, n] of Object.entries(ALIASES)) if (n === entry.n) names.push(alias);
  return [...new Set(names.map(normalise).filter(Boolean))];
}

/**
 * Find a book by any of its names, or by a leading fragment of one.
 *
 * Books are tried in canon order, so the two genuinely ambiguous short forms
 * resolve the way every study Bible resolves them: "Phil" is Philippians, not
 * Philemon, and "Jud" is Judges, not Jude. Anyone who means the other one has
 * to type more of it, which is also true on paper.
 */
export function findBook(books, text) {
  const wanted = normalise(text);
  if (!wanted) return null;
  let prefix = null;
  for (const entry of books) {
    const names = namesFor(entry);
    if (names.includes(wanted)) return entry;
    if (!prefix && names.some((name) => name.startsWith(wanted) && wanted.length >= 2)) prefix = entry;
  }
  return prefix;
}

/**
 * "John 3:16", "1 Jn 2:1-5", "Psalm 23", "Juan 3", "Mga Awit 23:1".
 *
 * Returns `{ book, chapter, verse, verseEnd }` — verse and verseEnd may be
 * null, which means "the whole chapter". Anything unparseable returns null,
 * and the caller falls back to searching for the words instead.
 */
export function parseRef(text, books) {
  const raw = String(text || '').trim();
  if (!raw) return null;
  // Split off the trailing "chapter:verse-verse"; whatever is left is the name.
  const match = raw.match(/^(.*?)[\s.]*(\d+)\s*(?::\s*(\d+)\s*(?:[-–—]\s*(\d+))?)?\s*$/);
  if (!match) return null;
  const entry = findBook(books, match[1]);
  if (!entry) return null;
  const chapter = Math.min(Math.max(1, Number(match[2])), entry.chapters);
  const verse = match[3] ? Number(match[3]) : null;
  const verseEnd = match[4] ? Number(match[4]) : null;
  return { book: entry, chapter, verse, verseEnd: verseEnd && verseEnd >= verse ? verseEnd : null };
}

/** "John 3:16", "John 3:16–18", "John 3" — how a reference is written back out. */
export function refText(entry, chapter, verse = null, verseEnd = null) {
  let out = `${entry.name} ${chapter}`;
  if (verse) out += `:${verse}`;
  if (verse && verseEnd && verseEnd !== verse) out += `–${verseEnd}`;
  return out;
}

/**
 * The verses a reference points at, with their numbers.
 *
 * A few verses are blank in the World English Bible — Luke 17:36, Acts 8:37,
 * 15:34 and 24:7 are not in the manuscripts it translates. The number is kept
 * so nothing after it shifts, and the blank is dropped here rather than shown
 * as an empty line.
 */
export async function passage(code, entry, chapter, verse = null, verseEnd = null) {
  const data = await book(code, entry.n);
  const rows = data.chapters[chapter - 1] || [];
  const from = verse ? verse : 1;
  const to = verse ? (verseEnd || verse) : rows.length;
  const verses = [];
  for (let n = from; n <= Math.min(to, rows.length); n++) {
    if (rows[n - 1]) verses.push({ n, text: rows[n - 1] });
  }
  return { ref: refText(entry, chapter, verse, verseEnd), chapters: data.chapters.length, verses };
}

// ── Searching ──────────────────────────────────────────────────────────────

/**
 * Look for words across the Bible, a book at a time.
 *
 * It is deliberately incremental: `onFound` is called as each book lands, so
 * results appear while the rest is still downloading, and `signal` stops it
 * the moment the reader navigates away or types something else. Books already
 * on the device are searched first, which makes a repeat search feel instant
 * and makes an offline search work at all.
 */
export async function search(term, { code = DEFAULT_CODE, books, limit = 60, onFound, onProgress, signal } = {}) {
  const needle = String(term || '').trim().toLowerCase();
  const found = [];
  if (needle.length < 2) return found;

  const order = [...books].sort((a, b) => Number(isLoaded(code, b.n)) - Number(isLoaded(code, a.n)));
  let searched = 0;

  for (const entry of order) {
    if (signal?.aborted || found.length >= limit) break;
    let data;
    try { data = await book(code, entry.n); } catch { searched += 1; continue; }
    if (signal?.aborted) break;

    const hits = [];
    data.chapters.forEach((rows, c) => {
      rows.forEach((text, v) => {
        if (found.length + hits.length >= limit) return;
        if (text && text.toLowerCase().includes(needle)) {
          hits.push({ book: entry, chapter: c + 1, verse: v + 1, text });
        }
      });
    });
    found.push(...hits);
    searched += 1;
    if (hits.length && onFound) onFound(hits, found.length);
    if (onProgress) onProgress(searched, order.length);
  }
  return found;
}

// ── What this device remembers ─────────────────────────────────────────────
//
// Which translation, where it stopped reading, and any verse the reader chose
// to keep. Nothing is sent anywhere; this is the same local-only bargain as
// the rest of the app.

const EMPTY = { code: DEFAULT_CODE, last: null, saved: [] };

export function getState() {
  const saved = store.read(store.KEYS.bible, null) || {};
  return { ...EMPTY, ...saved, saved: Array.isArray(saved.saved) ? saved.saved : [] };
}

export function setState(patch) {
  const next = { ...getState(), ...patch };
  store.write(store.KEYS.bible, next);
  return next;
}

export function saveVerse({ ref, text, code }) {
  const state = getState();
  if (state.saved.some((one) => one.ref === ref && one.code === code)) return state;
  const next = { ...state, saved: [{ ref, text, code, at: new Date().toISOString() }, ...state.saved].slice(0, 200) };
  store.write(store.KEYS.bible, next);
  return next;
}

export function unsaveVerse(ref, code) {
  const state = getState();
  const next = { ...state, saved: state.saved.filter((one) => !(one.ref === ref && one.code === code)) };
  store.write(store.KEYS.bible, next);
  return next;
}

export function isSaved(ref, code) {
  return getState().saved.some((one) => one.ref === ref && one.code === code);
}
