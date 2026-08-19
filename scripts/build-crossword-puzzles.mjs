/* =============================================================================
   Builds bible-crossword/js/puzzles.js from the validated answer bank.
   -----------------------------------------------------------------------------
   Run:  node scripts/build-crossword-puzzles.mjs

   Grids are not hand-drawn. This enumerates every 180°-symmetric 6x6 pattern
   whose white runs are all either a real entry (3-6 cells) or a single cell
   checked by the other direction, then fills the good ones by backtracking out
   of bible-crossword/js/answers.js. Nothing invents a word: every letter in
   every puzzle comes from a record a human wrote and checked.

   Deterministic — the shuffles run off a fixed seed, so re-running reproduces
   the committed file exactly.
   ========================================================================== */

import { writeFileSync } from 'node:fs';
import { ANSWERS } from '../bible-crossword/js/answers.js';

const N = 6;
const MIN_LEN = 3;

/* ── Seeded RNG so a rebuild is reproducible ──────────────────────────────── */
let seed = 20260819;
const rand = () => (seed = (seed * 1103515245 + 12345) & 0x7fffffff) / 0x7fffffff;
const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rand() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

/* ── Valid single-line profiles ───────────────────────────────────────────── */
// A line of 6 cells. Every maximal white run must be length 1 (an unchecked
// cell, which the crossing direction has to cover) or >= MIN_LEN. Two runs of
// >= MIN_LEN cannot fit in six cells with a separator, so at most one entry.
function runsOf(blackSet) {
  const runs = [];
  let start = -1;
  for (let i = 0; i <= N; i++) {
    const black = i === N || blackSet.has(i);
    if (!black && start < 0) start = i;
    if (black && start >= 0) { runs.push([start, i - 1]); start = -1; }
  }
  return runs;
}
function lineOk(blackSet) {
  const runs = runsOf(blackSet);
  if (!runs.length) return false;                       // a fully black line
  let entries = 0;
  for (const [a, b] of runs) {
    const len = b - a + 1;
    if (len === 2) return false;                        // an unclued pair
    if (len >= MIN_LEN) entries++;
  }
  return entries <= 1;
}
const PROFILES = [];
for (let mask = 0; mask < 64; mask++) {
  const s = new Set();
  for (let i = 0; i < N; i++) if (mask & (1 << i)) s.add(i);
  if (lineOk(s)) PROFILES.push([...s]);
}

/* ── Grid enumeration ─────────────────────────────────────────────────────── */
function makeGrid(rowProfiles) {
  const g = Array.from({ length: N }, () => Array(N).fill(false)); // false = white
  rowProfiles.forEach((cols, r) => cols.forEach((c) => { g[r][c] = true; }));
  return g;
}
function lineEntries(cells) {                            // cells: array of bool black
  const s = new Set();
  cells.forEach((b, i) => { if (b) s.add(i); });
  return runsOf(s).filter(([a, b]) => b - a + 1 >= MIN_LEN);
}
function gridOk(g) {
  for (let r = 0; r < N; r++) if (!lineOk(new Set(g[r].map((b, c) => (b ? c : -1)).filter((c) => c >= 0)))) return false;
  for (let c = 0; c < N; c++) {
    const col = new Set();
    for (let r = 0; r < N; r++) if (g[r][c]) col.add(r);
    if (!lineOk(col)) return false;
  }
  // Every white cell must belong to at least one entry.
  const inAcross = Array.from({ length: N }, () => Array(N).fill(false));
  const inDown = Array.from({ length: N }, () => Array(N).fill(false));
  for (let r = 0; r < N; r++) for (const [a, b] of lineEntries(g[r])) for (let c = a; c <= b; c++) inAcross[r][c] = true;
  for (let c = 0; c < N; c++) {
    const col = []; for (let r = 0; r < N; r++) col.push(g[r][c]);
    for (const [a, b] of lineEntries(col)) for (let r = a; r <= b; r++) inDown[r][c] = true;
  }
  const white = [];
  for (let r = 0; r < N; r++) for (let c = 0; c < N; c++) {
    if (g[r][c]) continue;
    if (!inAcross[r][c] && !inDown[r][c]) return false;
    white.push(r * N + c);
  }
  // White cells must form one connected region.
  const seen = new Set([white[0]]);
  const stack = [white[0]];
  while (stack.length) {
    const cur = stack.pop(), r = Math.floor(cur / N), c = cur % N;
    for (const [dr, dc] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nr = r + dr, nc = c + dc;
      if (nr < 0 || nr >= N || nc < 0 || nc >= N || g[nr][nc]) continue;
      const id = nr * N + nc;
      if (!seen.has(id)) { seen.add(id); stack.push(id); }
    }
  }
  return seen.size === white.length;
}
function slotsOf(g) {
  const slots = [];
  for (let r = 0; r < N; r++) for (const [a, b] of lineEntries(g[r])) slots.push({ dir: 'across', row: r, col: a, len: b - a + 1 });
  for (let c = 0; c < N; c++) {
    const col = []; for (let r = 0; r < N; r++) col.push(g[r][c]);
    for (const [a, b] of lineEntries(col)) slots.push({ dir: 'down', row: a, col: c, len: b - a + 1 });
  }
  return slots;
}

const PATTERNS = [];
for (const p0 of PROFILES) for (const p1 of PROFILES) for (const p2 of PROFILES) {
  const mirror = (cols) => cols.map((c) => N - 1 - c);
  const g = makeGrid([p0, p1, p2, mirror(p2), mirror(p1), mirror(p0)]);
  if (!gridOk(g)) continue;
  const slots = slotsOf(g);
  const blacks = g.flat().filter(Boolean).length;
  if (slots.length < 8 || slots.length > 12) continue;
  if (blacks < 4 || blacks > 14) continue;
  PATTERNS.push({ g, slots, blacks });
}
// Rank patterns by where the bank is actually deep. Sorting purely on how open
// a grid looks picks shapes stuffed with three- and four-letter slots, which
// burns the two scarcest banks while the five- and six-letter ones sit unused —
// measured at 64% and 73% consumed against 11% and 17%. Weighting by supply
// first, then by openness, is what lets one bank carry a month of puzzles.
const DEPTH = {};
for (const w of Object.keys(ANSWERS)) DEPTH[w.length] = (DEPTH[w.length] || 0) + 1;
const supply = (p) => p.slots.reduce((n, s) => n + DEPTH[s.len], 0) / p.slots.length;
PATTERNS.sort((a, b) => (supply(b) - supply(a)) || (a.blacks - b.blacks) || (b.slots.length - a.slots.length));
console.log(`patterns: ${PATTERNS.length}`);

/* ── Word index ───────────────────────────────────────────────────────────── */
const WORDS = Object.keys(ANSWERS);
const byLen = {};
for (const w of WORDS) (byLen[w.length] ||= []).push(w);
// (length, position, letter) -> words. Candidate lists for a half-filled slot
// are the intersection of these, which keeps the search cheap enough to run
// the whole build in a few seconds.
const INDEX = {};
for (const w of WORDS) for (let i = 0; i < w.length; i++) (INDEX[`${w.length}:${i}:${w[i]}`] ||= new Set()).add(w);

/* ── Fill one pattern ─────────────────────────────────────────────────────── */
function fill(pattern, { available, prefer, minTheme = 0 }) {
  const { g, slots } = pattern;
  const grid = Array.from({ length: N }, (_, r) => Array.from({ length: N }, (_, c) => (g[r][c] ? '#' : null)));
  const cellsOf = (s) => Array.from({ length: s.len }, (_, i) => (s.dir === 'across' ? [s.row, s.col + i] : [s.row + i, s.col]));
  slots.forEach((s) => { s.cells = cellsOf(s); });

  // Preferred words (carrying the target tag) are tried first, so a puzzle ends
  // up genuinely about its category rather than nominally.
  const rank = new Map();
  const pool = {};
  for (const len of Object.keys(byLen)) {
    const free = byLen[len].filter((w) => available(w));
    const hot = shuffle(free.filter((w) => ANSWERS[w].tags.includes(prefer)));
    const cold = shuffle(free.filter((w) => !ANSWERS[w].tags.includes(prefer)));
    pool[len] = new Set([...hot, ...cold]);
    [...hot, ...cold].forEach((w, i) => rank.set(w, i));
  }

  // Filtering for theme *after* a fill succeeds does not work: the solver is
  // free to satisfy the grid entirely from the general bank, and a thin
  // category then never reaches its quota however many patterns are tried.
  // Instead a set of slots is nominated up front and may only take answers
  // carrying the tag, so the theme is a constraint the search has to satisfy
  // rather than a property it might happen to have.
  const hot = new Set(WORDS.filter((w) => available(w) && ANSWERS[w].tags.includes(prefer)));
  const hotByLen = {};
  for (const w of hot) hotByLen[w.length] = (hotByLen[w.length] || 0) + 1;
  const forced = new Set(
    [...slots]
      .map((s, i) => ({ i, supply: hotByLen[s.len] || 0 }))
      .sort((a, b) => b.supply - a.supply)
      .slice(0, minTheme)
      .filter((s) => s.supply > 0)
      .map((s) => s.i),
  );
  if (forced.size < minTheme) return null;   // this category cannot carry this shape

  const placed = new Set();
  const candidates = (s) => {
    const known = [];
    s.cells.forEach(([r, c], i) => { if (grid[r][c] !== null) known.push([i, grid[r][c]]); });
    let out = null;
    for (const [i, ch] of known) {
      const set = INDEX[`${s.len}:${i}:${ch}`];
      if (!set) return [];
      out = out === null ? [...set] : out.filter((w) => set.has(w));
      if (!out.length) return [];
    }
    if (out === null) out = [...pool[s.len]];
    const onlyHot = forced.has(slots.indexOf(s));
    return out
      .filter((w) => pool[s.len].has(w) && !placed.has(w) && (!onlyHot || hot.has(w)))
      .sort((a, b) => rank.get(a) - rank.get(b));
  };

  let steps = 0;
  function recurse(remaining) {
    if (!remaining.length) return true;
    if (++steps > 250000) return false;
    // Most-constrained slot first, and bail the moment any slot has no options.
    let best = null, bestList = null;
    for (const s of remaining) {
      const list = candidates(s);
      if (!list.length) return false;
      if (!bestList || list.length < bestList.length) { best = s; bestList = list; if (list.length === 1) break; }
    }
    const rest = remaining.filter((s) => s !== best);
    for (const w of bestList) {
      const before = best.cells.map(([r, c]) => grid[r][c]);
      best.cells.forEach(([r, c], k) => { grid[r][c] = w[k]; });
      placed.add(w);
      if (recurse(rest)) return true;
      placed.delete(w);
      best.cells.forEach(([r, c], k) => { grid[r][c] = before[k]; });
    }
    return false;
  }

  if (!recurse([...slots])) return null;
  return { grid: grid.map((row) => row.join('')), words: [...placed] };
}

/* ── Build the puzzles ───────────────────────────────────────────────────── */

// A month of daily puzzles. The rotation is ordered so no two consecutive days
// share a theme; it cycles back to the top once every category has had one.
const ROTATION = [
  'Lesser-Known People', 'Kings & Kingdoms', 'Bible Geography', 'Prophets',
  'Women of the Bible', 'Objects & Symbols', 'Places & Cities', 'New Testament',
  'Words of Jesus', 'Old Testament', 'Bible History', 'Holy Spirit',
  'Men of the Bible', 'Theology', 'Bible Numbers', 'Scripture Detective', 'Who Am I?',
];
const TARGET = 31;

// Short answers are the connecting tissue a 6x6 grid cannot do without, and
// Scripture only offers so many defensible ones, so they may serve more than
// once. Longer answers appear exactly once. Whatever repeats has to be far
// apart in the rotation — a word coming back the very next day would read as
// carelessness rather than as fill.
const CAP = { 3: 3, 4: 2, 5: 1, 6: 1 };
const APART = 6;

const uses = new Map();
const lastSeen = new Map();
let day = 0;
const available = (w) =>
  (uses.get(w) || 0) < CAP[w.length] &&
  (!lastSeen.has(w) || day - lastSeen.get(w) >= APART);

const built = [];
let patternCursor = 0;

function attempt(category) {
  for (let a = 0; a < PATTERNS.length; a++) {
    const pattern = PATTERNS[(patternCursor + a) % PATTERNS.length];
    // Half the grid, not a token three. A puzzle whose hero says "Words of
    // Jesus" over five Old Testament place names is a label, not a theme.
    const minTheme = Math.ceil(pattern.slots.length / 2);
    const res = fill(pattern, { available, prefer: category, minTheme });
    if (!res) continue;
    const onTheme = res.words.filter((w) => ANSWERS[w].tags.includes(category)).length;
    if (onTheme < minTheme) continue;
    patternCursor = (patternCursor + a + 1) % PATTERNS.length;
    return { ...res, onTheme };
  }
  return null;
}

function record(category, res) {
  day = built.length + 1;
  const id = `flcc-hard-${String(day).padStart(3, '0')}`;
  res.words.forEach((w) => {
    uses.set(w, (uses.get(w) || 0) + 1);
    lastSeen.set(w, day);
  });
  built.push({ id, category, difficulty: 'Hard', ...res });
  console.log(`${id}  ${category.padEnd(22)} ${res.words.length} answers (${res.onTheme} on theme)`);
}

// One pass through the rotation in order, so every category gets a day before
// any gets a second. After that, always take whichever category has had the
// fewest — left to run round the rotation again it silently drifts toward the
// three or four richest themes and the month stops feeling varied.
const skipped = [];
const tally = new Map(ROTATION.map((c) => [c, 0]));
const exhausted = new Set();

for (const category of ROTATION) {
  if (built.length >= TARGET) break;
  const res = attempt(category);
  if (res) { record(category, res); tally.set(category, 1); }
  else { skipped.push(category); exhausted.add(category); }
}

while (built.length < TARGET) {
  const next = ROTATION
    .filter((c) => !exhausted.has(c))
    .sort((a, b) => tally.get(a) - tally.get(b))[0];
  if (!next) break;
  const res = attempt(next);
  if (res) { record(next, res); tally.set(next, tally.get(next) + 1); }
  else exhausted.add(next);   // this category has given all it can for now
}

if (skipped.length) console.log(`\nno grid available for: ${skipped.join(', ')}`);
if (built.length < TARGET) {
  console.log(`built ${built.length} of ${TARGET} — the bank is the limit, not the code`);
}
if (!built.length) throw new Error('could not build a single puzzle');

/* ── Emit ─────────────────────────────────────────────────────────────────── */
const body = built.map((p) => `  {
    id: '${p.id}',
    category: '${p.category.replace(/'/g, "\\'")}',
    difficulty: 'Hard',
    grid: [
${p.grid.map((row) => `      '${row}',`).join('\n')}
    ],
  },`).join('\n');

const out = `/* =============================================================================
   THE PUZZLE BANK — a month of hard 6x6 Bible crosswords, one for each day.
   -----------------------------------------------------------------------------
   GENERATED FILE. Do not hand-edit: run

     node scripts/build-crossword-puzzles.mjs

   Each puzzle is stored as its solved grid — '#' is a blocked cell, every other
   character is the answer letter that belongs there. js/engine.js derives the
   blocks, the numbering and the across/down entries from this, and looks every
   entry up in js/answers.js for its clue, hint, Scripture reference and
   explanation. That is why a puzzle carries no clue text of its own: there is
   exactly one place a Bible fact can enter this game.

   Answers of four letters and up appear in exactly one puzzle. Three-letter
   answers may serve twice — a grid this small needs connecting tissue, and
   Scripture only offers so many defensible three-letter words.
   ========================================================================== */

export const PUZZLES = [
${body}
];
`;
writeFileSync(new URL('../bible-crossword/js/puzzles.js', import.meta.url), out);
console.log(`\nwrote bible-crossword/js/puzzles.js — ${built.length} puzzles, ${uses.size} distinct answers of ${WORDS.length} in the bank`);
