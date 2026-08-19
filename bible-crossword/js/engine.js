/* =============================================================================
   ENGINE — turns a solved grid into a playable crossword.
   -----------------------------------------------------------------------------
   Pure functions only: no DOM, no storage, no timers. Everything the UI needs
   about a puzzle (blocks, numbering, entries, which entry owns which cell) is
   derived here, once, from the grid in js/puzzles.js and the records in
   js/answers.js. Kept pure so test/crossword.test.mjs can exercise it directly.
   ========================================================================== */

import { ANSWERS } from './answers.js';
import { PUZZLES } from './puzzles.js';

export const SIZE = 6;
export const MIN_ENTRY = 3;
export const BLOCK = '#';

/** Every puzzle in the bank, oldest first. */
export function allPuzzles() { return PUZZLES; }

/* ── Daily selection ──────────────────────────────────────────────────────── */

/** Local calendar day as YYYY-MM-DD — never UTC, or the puzzle would change
 *  at 8am for members in Manila rather than at midnight. */
export function dayKey(date = new Date()) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

/** Whole days since the epoch, counted in the member's own timezone. */
export function dayNumber(date = new Date()) {
  const [y, m, d] = dayKey(date).split('-').map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / 86400000);
}

/** The puzzle everybody gets today. Deterministic: same day, same puzzle,
 *  every device, however many times the page is reloaded. */
export function puzzleForDate(date = new Date()) {
  const n = dayNumber(date);
  return PUZZLES[((n % PUZZLES.length) + PUZZLES.length) % PUZZLES.length];
}

/** 1-based position of a puzzle in the bank, for the "Puzzle 07" label. */
export function puzzleNumber(puzzle) {
  return PUZZLES.findIndex((p) => p.id === puzzle.id) + 1;
}

/* ── Grid analysis ────────────────────────────────────────────────────────── */

const isBlock = (grid, r, c) => r < 0 || c < 0 || r >= SIZE || c >= SIZE || grid[r][c] === BLOCK;

/**
 * Build the playable model for one puzzle.
 *
 * Returns entries in the order a solver reads them (numbering order, across
 * before down for the same number) and a lookup from "row,col" to the across
 * and down entries that cell belongs to. A cell can legitimately belong to only
 * one of them: a single white square between two blocks is checked by the
 * crossing word alone, which is normal for a grid this small.
 */
export function buildPuzzle(puzzle) {
  const grid = puzzle.grid.map((row) => row.split(''));
  const numbers = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  const entries = [];
  let next = 1;

  for (let r = 0; r < SIZE; r++) {
    for (let c = 0; c < SIZE; c++) {
      if (isBlock(grid, r, c)) continue;

      const startsAcross = isBlock(grid, r, c - 1) && runLength(grid, r, c, 0, 1) >= MIN_ENTRY;
      const startsDown = isBlock(grid, r - 1, c) && runLength(grid, r, c, 1, 0) >= MIN_ENTRY;
      if (!startsAcross && !startsDown) continue;

      const number = next++;
      numbers[r][c] = number;
      if (startsAcross) entries.push(makeEntry(grid, 'across', number, r, c));
      if (startsDown) entries.push(makeEntry(grid, 'down', number, r, c));
    }
  }

  const byCell = {};
  for (const entry of entries) {
    for (const [r, c] of entry.cells) {
      const key = `${r},${c}`;
      (byCell[key] ||= { across: null, down: null })[entry.dir] = entry.id;
    }
  }

  return {
    id: puzzle.id,
    category: puzzle.category,
    difficulty: puzzle.difficulty,
    size: SIZE,
    grid,
    numbers,
    entries,
    byCell,
    /** Every cell a player has to fill, in reading order. */
    letterCells: cellsInReadingOrder(grid),
    entry: (id) => entries.find((e) => e.id === id) || null,
    across: entries.filter((e) => e.dir === 'across'),
    down: entries.filter((e) => e.dir === 'down'),
  };
}

function runLength(grid, r, c, dr, dc) {
  let n = 0;
  while (!isBlock(grid, r + dr * n, c + dc * n)) n++;
  return n;
}

function makeEntry(grid, dir, number, row, col) {
  const [dr, dc] = dir === 'across' ? [0, 1] : [1, 0];
  const len = runLength(grid, row, col, dr, dc);
  const cells = Array.from({ length: len }, (_, i) => [row + dr * i, col + dc * i]);
  const answer = cells.map(([r, c]) => grid[r][c]).join('');
  const record = ANSWERS[answer];
  if (!record) throw new Error(`No answer record for ${answer} (${dir} ${number})`);
  return {
    id: `${number}${dir === 'across' ? 'A' : 'D'}`,
    dir,
    number,
    row,
    col,
    len,
    cells,
    answer,
    clue: record.clue,
    hint: record.hint,
    scripture: record.scripture,
    explanation: record.explanation,
    tags: record.tags,
  };
}

function cellsInReadingOrder(grid) {
  const out = [];
  for (let r = 0; r < SIZE; r++) for (let c = 0; c < SIZE; c++) if (grid[r][c] !== BLOCK) out.push([r, c]);
  return out;
}

/* ── Navigation helpers ───────────────────────────────────────────────────── */

/** The cell after `index` inside an entry, or null at the end of the word.
 *  Typing walks straight through the word and overwrites what is there —
 *  skipping filled squares mid-word is the behaviour that makes people type a
 *  whole answer and watch half of it land in the next clue. */
export function nextCellIn(entry, index) {
  const i = index + 1;
  return i < entry.len ? entry.cells[i] : null;
}

/** First empty cell of an entry, or its first cell if the entry is full. */
export function firstOpenCell(entry, letters) {
  for (const [r, c] of entry.cells) if (!letters[`${r},${c}`]) return [r, c];
  return entry.cells[0];
}

/** The entry a player should be moved to when they finish this one. Wraps
 *  round the whole puzzle so Tab never dead-ends. */
export function nextEntry(model, entryId, step = 1) {
  const list = model.entries;
  const i = list.findIndex((e) => e.id === entryId);
  if (i < 0) return list[0];
  return list[(i + step + list.length * 2) % list.length];
}

/* ── Progress ─────────────────────────────────────────────────────────────── */

export function isEntryFilled(entry, letters) {
  return entry.cells.every(([r, c]) => !!letters[`${r},${c}`]);
}

export function isEntryCorrect(entry, letters) {
  return entry.cells.every(([r, c], i) => letters[`${r},${c}`] === entry.answer[i]);
}

/** Cells the player has filled in wrongly. Only ever computed on demand — the
 *  grid never colours a letter red as it is typed. */
export function wrongCells(model, letters) {
  return model.letterCells.filter(([r, c]) => {
    const v = letters[`${r},${c}`];
    return v && v !== model.grid[r][c];
  });
}

export function isSolved(model, letters) {
  return model.letterCells.every(([r, c]) => letters[`${r},${c}`] === model.grid[r][c]);
}
