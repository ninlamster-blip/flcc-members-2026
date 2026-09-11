/* =============================================================================
   SCRIPTURE REFERENCES — turning what somebody types into a reference.
   -----------------------------------------------------------------------------
   The preacher says "turn with me to first Corinthians thirteen" and the member
   has a few seconds to get it down before the reading starts. So the input has
   to accept "1 cor 13", "1co13", "I Corinthians 13" and "first corinthians 13"
   and give back "1 Corinthians 13".

   Two rules hold this together:

     1. A reference that cannot be resolved is never rejected. `normalize()`
        hands back exactly what was typed, so a member who writes "Ps 23 and the
        one about the sheep" keeps it. Losing what somebody wrote during a
        sermon is far worse than storing an untidy line.

     2. An ambiguous abbreviation resolves to nothing rather than to a guess.
        "jo" is John, Jonah, Joel, Job and Joshua; picking one would send a
        member to the wrong passage and look authoritative doing it. The ones
        that are ambiguous by prefix but unambiguous in practice — Phil, Judg,
        Jude — are listed as aliases and matched before any prefix search.

   No network, no data files: a phone in a church basement resolves references
   exactly as well as one on wifi.
   ========================================================================== */

/** Canonical name → the abbreviations a member might actually type.
 *  Prefixes are found by search, so only list what a prefix cannot reach. */
const BOOKS = [
  ['Genesis',         ['gn', 'gen']],
  ['Exodus',          ['ex', 'exo', 'exod']],
  ['Leviticus',       ['lv', 'lev']],
  ['Numbers',         ['nm', 'nu', 'num']],
  ['Deuteronomy',     ['dt', 'deut']],
  ['Joshua',          ['js', 'jos', 'josh']],
  ['Judges',          ['jdg', 'judg']],
  ['Ruth',            ['rt', 'ru']],
  ['1 Samuel',        ['1sa', '1sam']],
  ['2 Samuel',        ['2sa', '2sam']],
  ['1 Kings',         ['1kg', '1ki', '1kgs']],
  ['2 Kings',         ['2kg', '2ki', '2kgs']],
  ['1 Chronicles',    ['1ch', '1chr', '1chron']],
  ['2 Chronicles',    ['2ch', '2chr', '2chron']],
  ['Ezra',            ['ezr']],
  ['Nehemiah',        ['ne', 'neh']],
  ['Esther',          ['es', 'est', 'esth']],
  ['Job',             ['jb']],
  ['Psalm',           ['ps', 'psa', 'psalms', 'pss']],
  ['Proverbs',        ['pr', 'prov', 'prv']],
  ['Ecclesiastes',    ['ec', 'ecc', 'eccl', 'qoheleth']],
  ['Song of Solomon', ['song', 'songs', 'sos', 'song of songs', 'canticles']],
  ['Isaiah',          ['is', 'isa']],
  ['Jeremiah',        ['jer']],
  ['Lamentations',    ['lam']],
  ['Ezekiel',         ['ezk', 'eze', 'ezek']],
  ['Daniel',          ['dn', 'dan']],
  ['Hosea',           ['ho', 'hos']],
  ['Joel',            ['jl', 'joe']],
  ['Amos',            ['am']],
  ['Obadiah',         ['ob', 'oba', 'obad']],
  ['Jonah',           ['jon', 'jnh']],
  ['Micah',           ['mic']],
  ['Nahum',           ['na', 'nah']],
  ['Habakkuk',        ['hab']],
  ['Zephaniah',       ['zep', 'zeph']],
  ['Haggai',          ['hag']],
  ['Zechariah',       ['zec', 'zech']],
  ['Malachi',         ['mal']],
  ['Matthew',         ['mt', 'mat', 'matt']],
  ['Mark',            ['mk', 'mrk']],
  ['Luke',            ['lk', 'luk']],
  ['John',            ['jn', 'jhn']],
  ['Acts',            ['ac', 'act']],
  ['Romans',          ['rm', 'ro', 'rom']],
  ['1 Corinthians',   ['1co', '1cor']],
  ['2 Corinthians',   ['2co', '2cor']],
  ['Galatians',       ['gal']],
  ['Ephesians',       ['eph']],
  ['Philippians',     ['php', 'phil', 'philip']],
  ['Colossians',      ['col']],
  ['1 Thessalonians', ['1th', '1thes', '1thess']],
  ['2 Thessalonians', ['2th', '2thes', '2thess']],
  ['1 Timothy',       ['1ti', '1tim']],
  ['2 Timothy',       ['2ti', '2tim']],
  ['Titus',           ['ti', 'tit']],
  ['Philemon',        ['phm', 'phlm', 'philem', 'philemon']],
  ['Hebrews',         ['heb']],
  ['James',           ['jm', 'jas']],
  ['1 Peter',         ['1pe', '1pt', '1pet']],
  ['2 Peter',         ['2pe', '2pt', '2pet']],
  ['1 John',          ['1jn', '1jo']],
  ['2 John',          ['2jn', '2jo']],
  ['3 John',          ['3jn', '3jo']],
  ['Jude',            ['jud', 'jde']],
  ['Revelation',      ['rv', 're', 'rev', 'revelations', 'apocalypse']],
];

export const BOOK_NAMES = BOOKS.map(([name]) => name);

/** Every spelling that resolves outright, alias or canonical, lowercased. */
const EXACT = new Map();
for (const [name, aliases] of BOOKS) {
  EXACT.set(name.toLowerCase(), name);
  for (const alias of aliases) EXACT.set(alias, name);
}

const ORDINALS = { i: '1', ii: '2', iii: '3', first: '1', second: '2', third: '3' };

/** "II Cor." → "2 cor", "1st John" → "1 john", "  1JOHN " → "1 john". */
function tidy(bookish) {
  let s = String(bookish).toLowerCase().replace(/\./g, ' ').replace(/\s+/g, ' ').trim();
  // A leading number written any of the ways people write it.
  s = s.replace(/^([1-3])(?:st|nd|rd)?\b\s*/, '$1 ');
  s = s.replace(/^(i{1,3}|first|second|third)\b\s*/, (_, word) => ORDINALS[word] + ' ');
  // "1john" and "1 john" are the same book.
  s = s.replace(/^([1-3])\s*/, '$1 ');
  return s.trim();
}

/**
 * The canonical book name, or null when nothing or too much matches.
 * Exact spellings win; only then is a prefix considered, and only when exactly
 * one book starts with it.
 */
export function resolveBook(bookish) {
  const s = tidy(bookish);
  if (!s) return null;
  if (EXACT.has(s)) return EXACT.get(s);

  const compact = s.replace(/\s+/g, '');
  if (EXACT.has(compact)) return EXACT.get(compact);

  const hits = new Set();
  for (const [spelling, name] of EXACT) {
    if (spelling.startsWith(s) || spelling.replace(/\s+/g, '').startsWith(compact)) hits.add(name);
  }
  return hits.size === 1 ? [...hits][0] : null;
}

/**
 * Parse a reference into its parts, or null if the book cannot be resolved.
 *   'rom 8:28'    → { book: 'Romans', chapter: 8, verse: 28, verseEnd: null, ref: 'Romans 8:28' }
 *   '1 cor 13'    → { book: '1 Corinthians', chapter: 13, verse: null, … }
 *   'jn 3:16-17'  → { book: 'John', chapter: 3, verse: 16, verseEnd: 17, … }
 *   'Philippians' → { book: 'Philippians', chapter: null, … }
 */
export function parse(input) {
  const raw = String(input || '').trim().replace(/[\s,;.]+$/, '');
  if (!raw) return null;

  // Everything up to the last run of numbers is the book. The lazy prefix
  // keeps "1 John 1:9" whole — the leading 1 belongs to the book, not the
  // chapter — because the pattern has to reach the end of the string.
  const m = /^(.*?)[\s.]*(\d+)\s*[:.]?\s*(\d+)?\s*(?:[-–—]\s*(\d+))?$/.exec(raw);
  const bookish = m ? m[1] : raw;
  const book = resolveBook(bookish);
  if (!book) return null;

  const chapter  = m && m[2] ? Number(m[2]) : null;
  const verse    = m && m[3] ? Number(m[3]) : null;
  const verseEnd = m && m[4] ? Number(m[4]) : null;

  // "Jude 20" and "3 John 4" have one chapter, so the number is a verse. Said
  // out loud they are "Jude twenty", and writing them back as "Jude 20:—"
  // would be wrong.
  const oneChapter = book === 'Jude' || book === 'Obadiah' || book === 'Philemon' ||
                     book === '2 John' || book === '3 John';

  return { book, chapter, verse, verseEnd, ref: format({ book, chapter, verse, verseEnd, oneChapter }) };
}

function format({ book, chapter, verse, verseEnd, oneChapter }) {
  if (chapter == null) return book;
  // "Romans 8-9" and "Jude 20-21": with no verse, a range is a range of
  // whatever the first number was, and dropping the second half of it would
  // quietly change the passage.
  if (verse == null) return verseEnd != null ? `${book} ${chapter}-${verseEnd}` : `${book} ${chapter}`;
  if (oneChapter) return `${book} ${chapter}${verseEnd != null ? `-${verseEnd}` : ''}`;
  return `${book} ${chapter}:${verse}${verseEnd != null ? `-${verseEnd}` : ''}`;
}

/**
 * What to store for what somebody typed: the tidy reference when it resolves,
 * and otherwise their own words, untouched. Never returns an empty string for
 * non-empty input.
 */
export function normalize(input) {
  const parsed = parse(input);
  return parsed ? parsed.ref : String(input || '').trim();
}

/** True when this reads like a reference we could look up. */
export function isReference(input) {
  return parse(input) !== null;
}
