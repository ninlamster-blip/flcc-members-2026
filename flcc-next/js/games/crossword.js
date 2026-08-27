// Crossword layout, worked out in code rather than authored by hand.
//
// A puzzle is a list of answers and their clues. This module interlocks them
// into a grid, so writing a new puzzle is writing words — no coordinates, no
// black squares to count, and nothing to get subtly wrong in a JSON file.
//
// It is deterministic: the same word list always produces the same grid, which
// is what makes it testable and what makes a puzzle look the same to every
// child in the same week.

const ACROSS = 'across';
const DOWN = 'down';

const clean = (word) => String(word || '').toUpperCase().replace(/[^A-Z]/g, '');
const at = (row, col) => `${row},${col}`;

function fits(board, word, row, col, dir) {
  const dr = dir === DOWN ? 1 : 0;
  const dc = dir === ACROSS ? 1 : 0;
  let crossings = 0;

  // Nothing may run straight into either end of the word.
  if (board.has(at(row - dr, col - dc))) return null;
  if (board.has(at(row + dr * word.length, col + dc * word.length))) return null;

  for (let i = 0; i < word.length; i++) {
    const r = row + dr * i;
    const c = col + dc * i;
    const held = board.get(at(r, c));
    if (held) {
      if (held.letter !== word[i]) return null;
      if (held[dir]) return null;             // already runs this way — would overlap
      crossings += 1;
      continue;
    }
    // An empty cell may not touch another word sideways.
    if (board.has(at(r + dc, c + dr)) || board.has(at(r - dc, c - dr))) return null;
  }
  return crossings;
}

function place(board, entry, word, row, col, dir) {
  const dr = dir === DOWN ? 1 : 0;
  const dc = dir === ACROSS ? 1 : 0;
  for (let i = 0; i < word.length; i++) {
    const key = at(row + dr * i, col + dc * i);
    const cell = board.get(key) || { row: row + dr * i, col: col + dc * i, letter: word[i] };
    cell[dir] = entry;
    board.set(key, cell);
  }
}

/** A seeded shuffle, so every candidate ordering is reproducible. */
function reorder(list, seed) {
  if (seed === 0) return list;
  const out = [...list];
  let value = seed * 2654435761 % 2147483647;
  const next = () => (value = (value * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

function attempt(ordered) {
  const board = new Map();
  const placed = [];
  let pending = [...ordered];

  // Repeat passes while anything still lands: a word that would not fit early
  // often crosses something that was placed after it.
  for (let pass = 0; pass < 3 && pending.length; pass++) {
    const missed = [];
    for (const word of pending) {
      if (!board.size) {
        place(board, word, word.letters, 0, 0, ACROSS);
        placed.push({ ...word, row: 0, col: 0, dir: ACROSS });
        continue;
      }

      let best = null;
      for (const cell of [...board.values()].sort((a, b) => a.row - b.row || a.col - b.col)) {
        for (let i = 0; i < word.letters.length; i++) {
          if (word.letters[i] !== cell.letter) continue;
          if (cell[ACROSS] && cell[DOWN]) continue;
          const dir = cell[ACROSS] ? DOWN : ACROSS;
          const row = dir === DOWN ? cell.row - i : cell.row;
          const col = dir === ACROSS ? cell.col - i : cell.col;
          const crossings = fits(board, word.letters, row, col, dir);
          if (crossings === null) continue;
          const spread = Math.abs(row) + Math.abs(col);
          if (!best || crossings > best.crossings || (crossings === best.crossings && spread < best.spread)) {
            best = { row, col, dir, crossings, spread };
          }
        }
      }

      if (!best) { missed.push(word); continue; }
      place(board, word, word.letters, best.row, best.col, best.dir);
      placed.push({ ...word, row: best.row, col: best.col, dir: best.dir });
    }
    if (missed.length === pending.length) break;
    pending = missed;
  }

  return { board, placed, skipped: pending.map((word) => word.answer) };
}

/**
 * Interlock a list of `{ answer, clue }` into a grid.
 *
 * A single greedy pass leaves words stranded, so this tries a fixed set of
 * orderings and keeps the tightest grid that strands the fewest — still
 * deterministic, because the orderings are seeded, not random.
 *
 * Returns the grid, the numbered entries, and any answer that would not fit.
 */
export function build(words, { attempts = 32 } = {}) {
  const parsed = words
    .map((word) => ({ ...word, letters: clean(word.answer) }))
    .filter((word) => word.letters.length > 1);
  const sorted = [...parsed].sort((a, b) => b.letters.length - a.letters.length ||
    a.letters.localeCompare(b.letters));

  let best = null;
  for (let seed = 0; seed < attempts; seed++) {
    const run = attempt(reorder(sorted, seed));
    const rows = [...run.board.values()];
    const height = rows.length ? Math.max(...rows.map((c) => c.row)) - Math.min(...rows.map((c) => c.row)) + 1 : 0;
    const width = rows.length ? Math.max(...rows.map((c) => c.col)) - Math.min(...rows.map((c) => c.col)) + 1 : 0;
    // Prefer a compact grid, and prefer a square one: a tall thin puzzle wastes
    // a phone screen and pushes the clues off the bottom of it.
    const cost = width * height + Math.abs(width - height) * 4;
    if (!best || run.skipped.length < best.skipped.length ||
      (run.skipped.length === best.skipped.length && cost < best.cost)) {
      best = { ...run, cost };
    }
  }

  return normalise(best.board, best.placed, best.skipped);
}

function normalise(board, placed, skipped) {
  const cells = [...board.values()];
  if (!cells.length) return { width: 0, height: 0, cells: [], entries: [], skipped };

  const top = Math.min(...cells.map((cell) => cell.row));
  const left = Math.min(...cells.map((cell) => cell.col));
  const height = Math.max(...cells.map((cell) => cell.row)) - top + 1;
  const width = Math.max(...cells.map((cell) => cell.col)) - left + 1;

  for (const cell of cells) { cell.row -= top; cell.col -= left; }
  const shifted = placed.map((entry) => ({ ...entry, row: entry.row - top, col: entry.col - left }));

  // Numbers run in reading order, the way a printed crossword numbers them.
  const inOrder = [...shifted].sort((a, b) => a.row - b.row || a.col - b.col ||
    (a.dir === ACROSS ? -1 : 1) - (b.dir === ACROSS ? -1 : 1));
  const numbers = new Map();
  let next = 1;
  const entries = inOrder.map((entry) => {
    const key = at(entry.row, entry.col);
    if (!numbers.has(key)) numbers.set(key, next++);
    const number = numbers.get(key);
    const cellKeys = [...entry.letters].map((_, i) => at(
      entry.row + (entry.dir === DOWN ? i : 0),
      entry.col + (entry.dir === ACROSS ? i : 0)));
    return { number, dir: entry.dir, clue: entry.clue, answer: entry.letters, row: entry.row, col: entry.col, cells: cellKeys };
  });

  for (const cell of cells) {
    cell.number = numbers.get(at(cell.row, cell.col)) || null;
    cell.key = at(cell.row, cell.col);
    delete cell[ACROSS];
    delete cell[DOWN];
  }
  for (const entry of entries) for (const key of entry.cells) {
    const cell = cells.find((candidate) => candidate.key === key);
    cell[entry.dir] = entry.number;
  }

  cells.sort((a, b) => a.row - b.row || a.col - b.col);
  return { width, height, cells, entries, skipped };
}

/** How much of the grid is filled in correctly. */
export function score(puzzle, filled) {
  let right = 0;
  for (const cell of puzzle.cells) if ((filled[cell.key] || '') === cell.letter) right += 1;
  return { right, total: puzzle.cells.length, done: right === puzzle.cells.length };
}
