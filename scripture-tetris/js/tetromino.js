// Tetromino shapes, colors, and the Super Rotation System (SRS) kick tables.
export const COLS = 10;
export const ROWS = 20;
export const HIDDEN_ROWS = 2; // spawn buffer above the visible board

export const COLORS = {
  I: '#5FE3FF',
  O: '#FFD84D',
  T: '#C77DFF',
  S: '#6BFFA0',
  Z: '#FF6B7A',
  J: '#5B8CFF',
  L: '#FFA84D',
};

// Each piece defined at spawn orientation on a 4x4 (I,O) or 3x3 (others) grid.
// Coordinates are [row, col] offsets from the piece's origin.
const SHAPES = {
  I: [
    [[1, 0], [1, 1], [1, 2], [1, 3]],
  ],
  O: [
    [[0, 0], [0, 1], [1, 0], [1, 1]],
  ],
  T: [
    [[0, 1], [1, 0], [1, 1], [1, 2]],
  ],
  S: [
    [[0, 1], [0, 2], [1, 0], [1, 1]],
  ],
  Z: [
    [[0, 0], [0, 1], [1, 1], [1, 2]],
  ],
  J: [
    [[0, 0], [1, 0], [1, 1], [1, 2]],
  ],
  L: [
    [[0, 2], [1, 0], [1, 1], [1, 2]],
  ],
};

// Rotate a set of [row,col] cells 90deg clockwise around the box center,
// producing the four SRS orientation states (0, R, 2, L) for each piece.
function rotateCW(cells, size) {
  return cells.map(([r, c]) => [c, size - 1 - r]);
}

function buildStates(pieceKey) {
  const size = pieceKey === 'I' || pieceKey === 'O' ? 4 : 3;
  const base = SHAPES[pieceKey][0];
  const states = [base];
  let current = base;
  for (let i = 0; i < 3; i++) {
    current = rotateCW(current, size);
    states.push(current);
  }
  if (pieceKey === 'O') return [base, base, base, base]; // O never rotates visually
  return states;
}

export const PIECES = {};
for (const key of Object.keys(SHAPES)) {
  PIECES[key] = { key, color: COLORS[key], states: buildStates(key), size: (key === 'I' || key === 'O') ? 4 : 3 };
}

export const PIECE_KEYS = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

// SRS-style wall kicks: a small set of candidate [row,col] offsets tried in
// order after a rotation until one lands on a non-colliding position. This is
// a simplified, direction-agnostic stand-in for the full per-transition
// Guideline kick tables — it gives the same forgiving feel (nudging off walls
// and floors, occasional T-spin-enabling slides) without the fragility of a
// large hand-transcribed table.
const STANDARD_KICKS = [
  [0, 0], [0, -1], [0, 1], [0, -2], [0, 2], [-1, 0], [-1, -1], [-1, 1], [1, 0],
];

const I_KICKS_LIST = [
  [0, 0], [0, -1], [0, 1], [0, -2], [0, 2], [-1, 0], [1, 0], [-2, 0], [2, 0],
  [-1, -2], [-1, 2],
];

export function getKicks(pieceKey) {
  if (pieceKey === 'O') return [[0, 0]];
  return pieceKey === 'I' ? I_KICKS_LIST : STANDARD_KICKS;
}

export function randomBag() {
  const bag = [...PIECE_KEYS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}
