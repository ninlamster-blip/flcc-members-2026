// The 66 books, in canonical order. The 1-based index is also the book number
// bolls.life uses in /get-text/<translation>/<book>/<chapter>/.

const TABLE = [
  ['GEN', 'Genesis', 50], ['EXO', 'Exodus', 40], ['LEV', 'Leviticus', 27],
  ['NUM', 'Numbers', 36], ['DEU', 'Deuteronomy', 34], ['JOS', 'Joshua', 24],
  ['JDG', 'Judges', 21], ['RUT', 'Ruth', 4], ['1SA', '1 Samuel', 31],
  ['2SA', '2 Samuel', 24], ['1KI', '1 Kings', 22], ['2KI', '2 Kings', 25],
  ['1CH', '1 Chronicles', 29], ['2CH', '2 Chronicles', 36], ['EZR', 'Ezra', 10],
  ['NEH', 'Nehemiah', 13], ['EST', 'Esther', 10], ['JOB', 'Job', 42],
  ['PSA', 'Psalms', 150], ['PRO', 'Proverbs', 31], ['ECC', 'Ecclesiastes', 12],
  ['SNG', 'Song of Solomon', 8], ['ISA', 'Isaiah', 66], ['JER', 'Jeremiah', 52],
  ['LAM', 'Lamentations', 5], ['EZK', 'Ezekiel', 48], ['DAN', 'Daniel', 12],
  ['HOS', 'Hosea', 14], ['JOL', 'Joel', 3], ['AMO', 'Amos', 9],
  ['OBA', 'Obadiah', 1], ['JON', 'Jonah', 4], ['MIC', 'Micah', 7],
  ['NAM', 'Nahum', 3], ['HAB', 'Habakkuk', 3], ['ZEP', 'Zephaniah', 3],
  ['HAG', 'Haggai', 2], ['ZEC', 'Zechariah', 14], ['MAL', 'Malachi', 4],
  ['MAT', 'Matthew', 28], ['MRK', 'Mark', 16], ['LUK', 'Luke', 24],
  ['JHN', 'John', 21], ['ACT', 'Acts', 28], ['ROM', 'Romans', 16],
  ['1CO', '1 Corinthians', 16], ['2CO', '2 Corinthians', 13], ['GAL', 'Galatians', 6],
  ['EPH', 'Ephesians', 6], ['PHP', 'Philippians', 4], ['COL', 'Colossians', 4],
  ['1TH', '1 Thessalonians', 5], ['2TH', '2 Thessalonians', 3], ['1TI', '1 Timothy', 6],
  ['2TI', '2 Timothy', 4], ['TIT', 'Titus', 3], ['PHM', 'Philemon', 1],
  ['HEB', 'Hebrews', 13], ['JAS', 'James', 5], ['1PE', '1 Peter', 5],
  ['2PE', '2 Peter', 3], ['1JN', '1 John', 5], ['2JN', '2 John', 1],
  ['3JN', '3 John', 1], ['JUD', 'Jude', 1], ['REV', 'Revelation', 22],
];

export const BOOKS = TABLE.map(([id, name, chapters], i) => ({
  id,
  name,
  chapters,
  number: i + 1,
  testament: i < 39 ? 'OT' : 'NT',
}));

export const OLD_TESTAMENT = BOOKS.filter((b) => b.testament === 'OT');
export const NEW_TESTAMENT = BOOKS.filter((b) => b.testament === 'NT');

const BY_ID = new Map(BOOKS.map((b) => [b.id, b]));

// Spellings a child might actually type, beyond "starts with".
const ALIASES = {
  psalm: 'PSA', psalms: 'PSA', ps: 'PSA',
  song: 'SNG', songs: 'SNG', 'song of songs': 'SNG', canticles: 'SNG',
  ecclesiastes: 'ECC', eccl: 'ECC',
  matt: 'MAT', mt: 'MAT', mk: 'MRK', mark: 'MRK', lk: 'LUK', jn: 'JHN', john: 'JHN',
  acts: 'ACT', rom: 'ROM', phil: 'PHP', philippians: 'PHP', philemon: 'PHM', phlm: 'PHM',
  rev: 'REV', revelations: 'REV', apocalypse: 'REV',
  judges: 'JDG', jude: 'JUD', jdgs: 'JDG',
  deut: 'DEU', gen: 'GEN', exod: 'EXO', lev: 'LEV', num: 'NUM', josh: 'JOS',
  prov: 'PRO', isa: 'ISA', jer: 'JER', ezek: 'EZK', dan: 'DAN', hab: 'HAB',
  zech: 'ZEC', mal: 'MAL', heb: 'HEB', jas: 'JAS', james: 'JAS',
};

// Short forms of the base name of a numbered book ("1 cor" → 1 Corinthians).
const BASE_ALIASES = {
  sam: 'samuel', kgs: 'kings', ki: 'kings', kg: 'kings',
  chr: 'chronicles', chron: 'chronicles',
  cor: 'corinthians', th: 'thessalonians', thes: 'thessalonians', thess: 'thessalonians',
  tim: 'timothy', pet: 'peter', pt: 'peter', jn: 'john', joh: 'john',
};

export function bookById(id) {
  return BY_ID.get(String(id || '').toUpperCase()) || null;
}

/** Loose book lookup: exact name, alias, ordinal-normalised prefix. */
/** Loose book lookup: exact name, alias, ordinal-normalised prefix. */
export function findBook(raw) {
  let text = String(raw || '').trim().toLowerCase().replace(/\./g, '');
  if (!text) return null;

  text = text
    .replace(/^(1st|first|i)\s+/, '1 ')
    .replace(/^(2nd|second|ii)\s+/, '2 ')
    .replace(/^(3rd|third|iii)\s+/, '3 ')
    .replace(/^([123])\s*/, '$1 ')
    .replace(/\s+/g, ' ');

  if (BY_ID.has(text.toUpperCase())) return BY_ID.get(text.toUpperCase());
  if (ALIASES[text]) return BY_ID.get(ALIASES[text]);

  // "1 jn", "2 thess", "1 cor" — an ordinal plus a short form of the base name.
  const ordinal = text.match(/^([123]) (.+)$/);
  if (ordinal) {
    const [, number, rest] = ordinal;
    const base = BASE_ALIASES[rest] || rest;
    const match = BOOKS.find((b) => b.name.toLowerCase().startsWith(`${number} ${base}`));
    if (match) return match;
  }

  const exact = BOOKS.find((b) => b.name.toLowerCase() === text);
  if (exact) return exact;

  // Ambiguous prefixes ("jo") resolve to the first book in canonical order,
  // which is what a reader typing forwards expects.
  const prefix = BOOKS.find((b) => b.name.toLowerCase().startsWith(text));
  return prefix || null;
}
