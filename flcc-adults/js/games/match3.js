// Match-three: the rules, with no DOM in them.
//
// Candy Crush's shape — swap two neighbours, clear runs of three or more, let
// the board fall and cascade — kept as pure functions so it can be tested
// without a browser and so the screen only has to draw what it is handed.
//
// Two deliberate departures from the genre:
//
//   · A swap that matches nothing is refused rather than played and undone.
//     The animated "nope, snap back" is the genre's way of spending a move on
//     a mistake; this app has no reason to punish a misread.
//   · There is no timer, no lives and no score to compare with anyone. There
//     is a move count and a target, and running out is the end of the round,
//     not a failure.

export const KINDS = ['sunshine', 'rose', 'sky', 'captain', 'poppy'];

/** A seeded generator, so a board can be replayed exactly for a test. */
export function seeded(seed) {
  let value = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  return () => (value = (value * 48271) % 2147483647) / 2147483647;
}

const at = (board, r, c) => (board[r] ? board[r][c] : undefined);

/** Every run of three or more, across and down, as a set of "r,c" keys. */
export function matches(board) {
  const found = new Set();
  const size = board.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < board[r].length; c++) {
      const kind = at(board, r, c);
      if (kind === null || kind === undefined) continue;
      // Across
      let run = 1;
      while (at(board, r, c + run) === kind) run += 1;
      if (run >= 3) for (let i = 0; i < run; i++) found.add(`${r},${c + i}`);
      // Down
      run = 1;
      while (at(board, r + run, c) === kind) run += 1;
      if (run >= 3) for (let i = 0; i < run; i++) found.add(`${r + i},${c}`);
    }
  }
  return found;
}

/** Clear a set of cells, drop what is above them, and refill from the top. */
export function collapse(board, cleared, next) {
  const out = board.map((row) => [...row]);
  for (const key of cleared) {
    const [r, c] = key.split(',').map(Number);
    out[r][c] = null;
  }
  const height = out.length;
  const width = out[0].length;
  for (let c = 0; c < width; c++) {
    const column = [];
    for (let r = height - 1; r >= 0; r--) if (out[r][c] !== null) column.push(out[r][c]);
    for (let r = height - 1; r >= 0; r--) {
      const held = column[height - 1 - r];
      out[r][c] = held === undefined ? KINDS[Math.floor(next() * KINDS.length)] : held;
    }
  }
  return out;
}

/**
 * A starting board with no matches already on it and at least one move
 * available. A board that solves itself before the player touches it is a
 * board that gave away its first three moves.
 */
export function newBoard(size, next) {
  let board;
  let guard = 0;
  do {
    board = Array.from({ length: size }, () =>
      Array.from({ length: size }, () => KINDS[Math.floor(next() * KINDS.length)]));
    while (matches(board).size) board = collapse(board, matches(board), next);
    guard += 1;
  } while (!hasMove(board) && guard < 40);
  return board;
}

export const adjacent = (a, b) =>
  (a.r === b.r && Math.abs(a.c - b.c) === 1) || (a.c === b.c && Math.abs(a.r - b.r) === 1);

function swapped(board, a, b) {
  const out = board.map((row) => [...row]);
  const held = out[a.r][a.c];
  out[a.r][a.c] = out[b.r][b.c];
  out[b.r][b.c] = held;
  return out;
}

/** Is there any swap left that would match something? */
export function hasMove(board) {
  const size = board.length;
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < board[r].length; c++) {
      for (const [dr, dc] of [[0, 1], [1, 0]]) {
        const b = { r: r + dr, c: c + dc };
        if (b.r >= size || b.c >= board[r].length) continue;
        if (matches(swapped(board, { r, c }, b)).size) return true;
      }
    }
  }
  return false;
}

/**
 * Play a swap.
 *
 * Returns the sequence of boards so the screen can animate the cascade one
 * step at a time, plus how much was cleared. `ok: false` means the swap
 * matched nothing and the board is unchanged.
 */
export function play(board, a, b, next) {
  if (!adjacent(a, b)) return { ok: false, board, steps: [], cleared: 0 };
  const first = swapped(board, a, b);
  let found = matches(first);
  if (!found.size) return { ok: false, board, steps: [], cleared: 0 };

  const steps = [];
  let current = first;
  let cleared = 0;
  let cascade = 0;
  while (found.size) {
    cleared += found.size;
    cascade += 1;
    steps.push({ board: current, cleared: [...found], cascade });
    current = collapse(current, found, next);
    found = matches(current);
  }
  return { ok: true, board: current, steps, cleared, cascades: cascade };
}
