#!/usr/bin/env node
//
// Build FLCC NEXT's Bible out of public-domain sources.
//
//   node scripts/build-next-bible.mjs
//
// Why the text is committed rather than fetched at runtime:
//
//   · A child reading Scripture should not depend on a third party staying up,
//     staying free, or staying quiet about what was read. Committed text is
//     served from the same origin as the rest of the app, cached by the same
//     service worker, and works in a church hall with no signal.
//   · The app has no build step. This script is run by hand when a translation
//     is added, and its output is committed. Nothing runs it on deploy.
//
// Three translations, all public domain, all redistributable:
//
//   web  World English Bible          — modern English, the default
//   bbe  Bible in Basic English       — a ~1000-word vocabulary, for younger readers
//   tgl  Ang Dating Biblia (1905)     — Tagalog, the language most FLCC families pray in
//
// Sources come from github.com/seven1m/open-bibles, which carries the licence
// table for each file. Only the 66 books of the Protestant canon are written —
// the WEB source also ships the deuterocanon, which FLCC's statement of faith
// does not receive as Scripture, so it is skipped rather than silently mixed in.
//
// Output, under flcc-next/bible/:
//
//   books.json          the 66 books: number, name, Tagalog name, testament,
//                       chapter count, and which files exist
//   <code>/<n>.json     one book per file: { b, name, chapters: [[verse, …], …] }
//
// One file per book is the point. A phone opening John downloads John (~180 KB),
// not a whole Bible, and the service worker keeps what has actually been read.

import { mkdir, readFile, writeFile, rm } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const OUT = join(ROOT, 'flcc-next', 'bible');
const CACHE = join(ROOT, '.bible-sources');

// ── The canon ──────────────────────────────────────────────────────────────
//
// Numbered 1–66 in the order every Bible prints them, which is also the order
// the app lists them and the number a reference resolves to. `usfx` and `osis`
// are the ids the two source formats use for the same book.

const BOOKS = [
  // #, English name, USFX id, OSIS id, testament, Tagalog name
  [1, 'Genesis', 'GEN', 'Gen', 'old', 'Genesis'],
  [2, 'Exodus', 'EXO', 'Exod', 'old', 'Exodo'],
  [3, 'Leviticus', 'LEV', 'Lev', 'old', 'Levitico'],
  [4, 'Numbers', 'NUM', 'Num', 'old', 'Mga Bilang'],
  [5, 'Deuteronomy', 'DEU', 'Deut', 'old', 'Deuteronomio'],
  [6, 'Joshua', 'JOS', 'Josh', 'old', 'Josue'],
  [7, 'Judges', 'JDG', 'Judg', 'old', 'Mga Hukom'],
  [8, 'Ruth', 'RUT', 'Ruth', 'old', 'Ruth'],
  [9, '1 Samuel', '1SA', '1Sam', 'old', '1 Samuel'],
  [10, '2 Samuel', '2SA', '2Sam', 'old', '2 Samuel'],
  [11, '1 Kings', '1KI', '1Kgs', 'old', '1 Mga Hari'],
  [12, '2 Kings', '2KI', '2Kgs', 'old', '2 Mga Hari'],
  [13, '1 Chronicles', '1CH', '1Chr', 'old', '1 Mga Cronica'],
  [14, '2 Chronicles', '2CH', '2Chr', 'old', '2 Mga Cronica'],
  [15, 'Ezra', 'EZR', 'Ezra', 'old', 'Ezra'],
  [16, 'Nehemiah', 'NEH', 'Neh', 'old', 'Nehemias'],
  [17, 'Esther', 'EST', 'Esth', 'old', 'Ester'],
  [18, 'Job', 'JOB', 'Job', 'old', 'Job'],
  [19, 'Psalms', 'PSA', 'Ps', 'old', 'Mga Awit'],
  [20, 'Proverbs', 'PRO', 'Prov', 'old', 'Mga Kawikaan'],
  [21, 'Ecclesiastes', 'ECC', 'Eccl', 'old', 'Eclesiastes'],
  [22, 'Song of Solomon', 'SNG', 'Song', 'old', 'Awit ng mga Awit'],
  [23, 'Isaiah', 'ISA', 'Isa', 'old', 'Isaias'],
  [24, 'Jeremiah', 'JER', 'Jer', 'old', 'Jeremias'],
  [25, 'Lamentations', 'LAM', 'Lam', 'old', 'Mga Panaghoy'],
  [26, 'Ezekiel', 'EZK', 'Ezek', 'old', 'Ezekiel'],
  [27, 'Daniel', 'DAN', 'Dan', 'old', 'Daniel'],
  [28, 'Hosea', 'HOS', 'Hos', 'old', 'Oseas'],
  [29, 'Joel', 'JOL', 'Joel', 'old', 'Joel'],
  [30, 'Amos', 'AMO', 'Amos', 'old', 'Amos'],
  [31, 'Obadiah', 'OBA', 'Obad', 'old', 'Abdias'],
  [32, 'Jonah', 'JON', 'Jonah', 'old', 'Jonas'],
  [33, 'Micah', 'MIC', 'Mic', 'old', 'Mikas'],
  [34, 'Nahum', 'NAM', 'Nah', 'old', 'Nahum'],
  [35, 'Habakkuk', 'HAB', 'Hab', 'old', 'Habacuc'],
  [36, 'Zephaniah', 'ZEP', 'Zeph', 'old', 'Zefanias'],
  [37, 'Haggai', 'HAG', 'Hag', 'old', 'Hagai'],
  [38, 'Zechariah', 'ZEC', 'Zech', 'old', 'Zacarias'],
  [39, 'Malachi', 'MAL', 'Mal', 'old', 'Malakias'],
  [40, 'Matthew', 'MAT', 'Matt', 'new', 'Mateo'],
  [41, 'Mark', 'MRK', 'Mark', 'new', 'Marcos'],
  [42, 'Luke', 'LUK', 'Luke', 'new', 'Lucas'],
  [43, 'John', 'JHN', 'John', 'new', 'Juan'],
  [44, 'Acts', 'ACT', 'Acts', 'new', 'Mga Gawa'],
  [45, 'Romans', 'ROM', 'Rom', 'new', 'Mga Taga-Roma'],
  [46, '1 Corinthians', '1CO', '1Cor', 'new', '1 Mga Taga-Corinto'],
  [47, '2 Corinthians', '2CO', '2Cor', 'new', '2 Mga Taga-Corinto'],
  [48, 'Galatians', 'GAL', 'Gal', 'new', 'Mga Taga-Galacia'],
  [49, 'Ephesians', 'EPH', 'Eph', 'new', 'Mga Taga-Efeso'],
  [50, 'Philippians', 'PHP', 'Phil', 'new', 'Mga Taga-Filipos'],
  [51, 'Colossians', 'COL', 'Col', 'new', 'Mga Taga-Colosas'],
  [52, '1 Thessalonians', '1TH', '1Thess', 'new', '1 Mga Taga-Tesalonica'],
  [53, '2 Thessalonians', '2TH', '2Thess', 'new', '2 Mga Taga-Tesalonica'],
  [54, '1 Timothy', '1TI', '1Tim', 'new', '1 Kay Timoteo'],
  [55, '2 Timothy', '2TI', '2Tim', 'new', '2 Kay Timoteo'],
  [56, 'Titus', 'TIT', 'Titus', 'new', 'Kay Tito'],
  [57, 'Philemon', 'PHM', 'Phlm', 'new', 'Kay Filemon'],
  [58, 'Hebrews', 'HEB', 'Heb', 'new', 'Mga Hebreo'],
  [59, 'James', 'JAS', 'Jas', 'new', 'Santiago'],
  [60, '1 Peter', '1PE', '1Pet', 'new', '1 Pedro'],
  [61, '2 Peter', '2PE', '2Pet', 'new', '2 Pedro'],
  [62, '1 John', '1JN', '1John', 'new', '1 Juan'],
  [63, '2 John', '2JN', '2John', 'new', '2 Juan'],
  [64, '3 John', '3JN', '3John', 'new', '3 Juan'],
  [65, 'Jude', 'JUD', 'Jude', 'new', 'Judas'],
  [66, 'Revelation', 'REV', 'Rev', 'new', 'Apocalipsis'],
].map(([number, name, usfx, osis, testament, tagalog]) => ({ number, name, usfx, osis, testament, tagalog }));

const TRANSLATIONS = [
  {
    code: 'web',
    format: 'usfx',
    file: 'eng-web.usfx.xml',
    url: 'https://raw.githubusercontent.com/seven1m/open-bibles/master/eng-web.usfx.xml',
    name: 'World English Bible',
    short: 'WEB',
    language: 'English',
    note: 'Modern English, and the one the app quotes by default.',
    licence: 'Public domain',
  },
  {
    code: 'bbe',
    format: 'usfx',
    file: 'eng-bbe.usfx.xml',
    url: 'https://raw.githubusercontent.com/seven1m/open-bibles/master/eng-bbe.usfx.xml',
    name: 'Bible in Basic English',
    short: 'BBE',
    language: 'Easy English',
    note: 'Written with about a thousand words, so a younger reader can follow it alone.',
    licence: 'Public domain',
  },
  {
    code: 'tgl',
    format: 'osis',
    file: 'tgl-tagalog.osis.xml',
    url: 'https://raw.githubusercontent.com/seven1m/open-bibles/master/tgl-tagalog.osis.xml',
    name: 'Ang Dating Biblia (1905)',
    short: 'ADB',
    language: 'Tagalog',
    note: 'Ang Biblia sa Tagalog — the wording most FLCC parents grew up hearing.',
    licence: 'Public domain',
  },
];

// ── Reading the sources ────────────────────────────────────────────────────

async function source(translation) {
  const path = join(CACHE, translation.file);
  if (existsSync(path)) return readFile(path, 'utf8');
  process.stdout.write(`  fetching ${translation.file}… `);
  const response = await fetch(translation.url);
  if (!response.ok) throw new Error(`${translation.url} → HTTP ${response.status}`);
  const text = await response.text();
  await mkdir(CACHE, { recursive: true });
  await writeFile(path, text);
  process.stdout.write('done\n');
  return text;
}

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

/** XML fragment → the words a reader sees. Markup, notes and references go. */
function plain(xml) {
  return xml
    // Footnotes, cross references and their contents are apparatus, not Scripture.
    .replace(/<f\b[\s\S]*?<\/f>/g, '')
    .replace(/<x\b[\s\S]*?<\/x>/g, '')
    .replace(/<ref\b[\s\S]*?<\/ref>/g, '')
    .replace(/<note\b[\s\S]*?<\/note>/g, '')
    .replace(/<title\b[\s\S]*?<\/title>/g, '')
    // Everything else is formatting around text we keep.
    .replace(/<[^>]*>/g, ' ')
    .replace(/&#(\d+);/g, (_, code) => String.fromCodePoint(Number(code)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code) => String.fromCodePoint(parseInt(code, 16)))
    .replace(/&([a-z]+);/gi, (whole, name) => ENTITIES[name.toLowerCase()] ?? whole)
    .replace(/\s+/g, ' ')
    .replace(/\s+([,.;:!?’”])/g, '$1')
    .trim();
}

/**
 * USFX marks verses with empty milestones — `<v id="3"/>` — and the text runs
 * until the next milestone, the next chapter, or the end of the book. So the
 * parse is: cut the book out, then walk the milestones in order.
 */
function parseUsfx(xml, book) {
  const start = xml.indexOf(`<book id="${book.usfx}"`);
  if (start < 0) return null;
  const end = xml.indexOf('<book id="', start + 1);
  const body = xml.slice(start, end < 0 ? undefined : end);

  const chapters = [];
  const marks = [...body.matchAll(/<c\s+id="(\d+)"\s*\/?>|<v\s+id="([\d\-,ab]+)"[^>]*\/?>/g)];
  let chapter = 0;
  for (let i = 0; i < marks.length; i++) {
    const mark = marks[i];
    if (mark[1] !== undefined) { chapter = Number(mark[1]); chapters[chapter - 1] ||= []; continue; }
    if (!chapter) continue;
    const from = mark.index + mark[0].length;
    const to = i + 1 < marks.length ? marks[i + 1].index : body.length;
    // A verse id may be a range ("1-2"); the text belongs to the first of them.
    const verse = Number(String(mark[2]).match(/\d+/)?.[0]);
    if (!Number.isFinite(verse)) continue;
    const text = plain(body.slice(from, to));
    if (!text) continue;
    const rows = (chapters[chapter - 1] ||= []);
    rows[verse - 1] = rows[verse - 1] ? `${rows[verse - 1]} ${text}` : text;
  }
  return chapters;
}

/** OSIS wraps each verse in its own element, keyed `Book.chapter.verse`. */
function parseOsis(xml, book) {
  const start = xml.indexOf(`<div osisID='${book.osis}' type='book'`);
  if (start < 0) return null;
  const end = xml.indexOf("<div osisID='", start + 1);
  const body = xml.slice(start, end < 0 ? undefined : end);

  const chapters = [];
  for (const match of body.matchAll(/<verse osisID='[^.]+\.(\d+)\.(\d+)'>([\s\S]*?)<\/verse>/g)) {
    const chapter = Number(match[1]);
    const verse = Number(match[2]);
    const text = plain(match[3]);
    if (!text) continue;
    const rows = (chapters[chapter - 1] ||= []);
    rows[verse - 1] = text;
  }
  return chapters;
}

// ── Writing ────────────────────────────────────────────────────────────────

async function build() {
  await rm(OUT, { recursive: true, force: true });
  await mkdir(OUT, { recursive: true });

  const chapterCount = new Map();
  const have = new Map(BOOKS.map((book) => [book.number, []]));
  let bytes = 0;

  for (const translation of TRANSLATIONS) {
    console.log(`${translation.short} — ${translation.name}`);
    const xml = await source(translation);
    await mkdir(join(OUT, translation.code), { recursive: true });

    let verses = 0;
    for (const book of BOOKS) {
      const chapters = translation.format === 'usfx' ? parseUsfx(xml, book) : parseOsis(xml, book);
      if (!chapters || !chapters.length) {
        console.warn(`  ! ${book.name} is missing from ${translation.short}`);
        continue;
      }
      // A gap would silently renumber every verse after it, so fill rather than
      // shift, and say how many gaps there were.
      const clean = chapters.map((rows) => Array.from(rows || [], (text) => text || ''));
      verses += clean.reduce((sum, rows) => sum + rows.filter(Boolean).length, 0);

      // The canon's chapter count is whatever the translations agree on; the
      // first one to carry a book sets it, and any disagreement is reported.
      const already = chapterCount.get(book.number);
      if (already === undefined) chapterCount.set(book.number, clean.length);
      else if (already !== clean.length) {
        console.warn(`  ! ${book.name}: ${translation.short} has ${clean.length} chapters, expected ${already}`);
      }

      const json = JSON.stringify({ b: book.number, name: book.name, t: translation.code, chapters: clean });
      bytes += json.length;
      have.get(book.number).push(translation.code);
      await writeFile(join(OUT, translation.code, `${book.number}.json`), json);
    }
    console.log(`  ${verses.toLocaleString()} verses`);
  }

  const manifest = {
    built: new Date().toISOString().slice(0, 10),
    translations: TRANSLATIONS.map(({ code, name, short, language, note, licence }) =>
      ({ code, name, short, language, note, licence })),
    books: BOOKS.map((book) => ({
      n: book.number,
      name: book.name,
      tagalog: book.tagalog,
      testament: book.testament,
      chapters: chapterCount.get(book.number) || 0,
      in: have.get(book.number),
    })),
  };
  await writeFile(join(OUT, 'books.json'), `${JSON.stringify(manifest, null, 2)}\n`);

  console.log(`\n${BOOKS.length} books × ${TRANSLATIONS.length} translations · ${(bytes / 1e6).toFixed(1)} MB written to flcc-next/bible/`);
  console.log('\nIf this changed any text already published, bump VERSION in flcc-next/sw.js.');
  console.log('The service worker keeps Scripture cache-first and never refetches it, so a');
  console.log('device that has read a book will keep the old wording until that version changes.');
}

build().catch((error) => { console.error(error); process.exit(1); });
