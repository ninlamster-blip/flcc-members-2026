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
// Open grids first: the fewer blocked cells a pattern has the better it looks,
// and the more of the 36 squares a solver actually gets to fill in.
PATTERNS.sort((a, b) => (a.blacks - b.blacks) || (b.slots.length - a.slots.length));
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
function fill(pattern, { available, prefer }) {
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
    return out.filter((w) => pool[s.len].has(w) && !placed.has(w)).sort((a, b) => rank.get(a) - rank.get(b));
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

/* ── Build the ten puzzles ────────────────────────────────────────────────── */
const TARGETS = [
  { id: 'flcc-hard-001', category: 'Lesser-Known People' },
  { id: 'flcc-hard-002', category: 'Kings & Kingdoms' },
  { id: 'flcc-hard-003', category: 'Bible Geography' },
  { id: 'flcc-hard-004', category: 'Prophets' },
  { id: 'flcc-hard-005', category: 'Women of the Bible' },
  { id: 'flcc-hard-006', category: 'Objects & Symbols' },
  { id: 'flcc-hard-007', category: 'Places & Cities' },
  { id: 'flcc-hard-008', category: 'New Testament' },
  { id: 'flcc-hard-009', category: 'Old Testament' },
  { id: 'flcc-hard-010', category: 'Bible History' },
];

// Answers four letters and longer appear in exactly one puzzle. Three-letter
// answers are the connective tissue every small crossword needs and there are
// only so many defensible ones, so they may serve twice — never in the same
// puzzle, and never more than that.
const uses = new Map();
const available = (w) => (uses.get(w) || 0) < (w.length === 3 ? 2 : 1);
const built = [];
let patternCursor = 0;

for (const target of TARGETS) {
  let done = null;
  let filled = 0, offTheme = 0;
  for (let attempt = 0; attempt < PATTERNS.length && !done; attempt++) {
    const pattern = PATTERNS[(patternCursor + attempt) % PATTERNS.length];
    const res = fill(pattern, { available, prefer: target.category });
    if (!res) continue;
    filled++;
    const onTheme = res.words.filter((w) => ANSWERS[w].tags.includes(target.category)).length;
    if (onTheme < Math.min(3, res.words.length)) { offTheme++; continue; }   // must really be about its category
    done = { ...target, ...res, onTheme, slots: pattern.slots.length };
    patternCursor = (patternCursor + attempt + 1) % PATTERNS.length;
  }
  if (!done) throw new Error(`could not build a puzzle for ${target.category} (fills=${filled}, offTheme=${offTheme})`);
  done.words.forEach((w) => uses.set(w, (uses.get(w) || 0) + 1));
  built.push(done);
  console.log(`${done.id}  ${done.category.padEnd(22)} ${done.words.length} answers (${done.onTheme} on theme)`);
}

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
   THE PUZZLE BANK — ten hard 6x6 Bible crosswords.
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
console.log(`\nwrote bible-crossword/js/puzzles.js — ${built.length} puzzles, ${uses.size} distinct answers`);
