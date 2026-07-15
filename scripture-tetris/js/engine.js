// Core Tetris game engine: board state, movement, rotation, locking, line
// clears, scoring, levels and speed. No rendering or DOM code lives here so
// it can be tested and reasoned about independently of the UI.
import { PIECES, PIECE_KEYS, COLS, ROWS, HIDDEN_ROWS, getKicks, randomBag } from './tetromino.js';

const LOCK_DELAY_MS = 500;
const MAX_LOCK_RESETS = 15;

function freshBoard() {
  const total = ROWS + HIDDEN_ROWS;
  return Array.from({ length: total }, () => Array(COLS).fill(null));
}

function cellsFor(pieceKey, state) {
  return PIECES[pieceKey].states[state];
}

export class Game {
  constructor(opts = {}) {
    this.onEvent = opts.onEvent || (() => {});
    this.reset();
  }

  reset() {
    this.board = freshBoard();
    this.queue = [];
    this._refillQueue();
    this.hold = null;
    this.holdUsed = false;
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.combo = -1;
    this.backToBack = false;
    this.gameOver = false;
    this.paused = false;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.isLocking = false;
    this.lastActionWasRotate = false;
    this.dropIntervalAcc = 0;
    this.totalPiecesPlaced = 0;
    this._spawnPiece();
  }

  _refillQueue() {
    while (this.queue.length < 7) this.queue.push(...randomBag());
  }

  get nextPreview() {
    return this.queue.slice(0, 5);
  }

  gravityMs() {
    const base = 1000 - (this.level - 1) * 75;
    return Math.max(90, base);
  }

  _spawnPiece() {
    this._refillQueue();
    const key = this.queue.shift();
    const size = PIECES[key].size;
    this.piece = {
      key,
      state: 0,
      row: HIDDEN_ROWS - (size === 4 ? 2 : 1),
      col: Math.floor((COLS - size) / 2),
    };
    this.holdUsed = false;
    this.isLocking = false;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.lastActionWasRotate = false;
    if (this._collides(this.piece.key, this.piece.state, this.piece.row, this.piece.col)) {
      this.gameOver = true;
      this.onEvent({ type: 'gameOver', score: this.score, lines: this.lines, level: this.level });
    }
  }

  _collides(key, state, row, col) {
    const cells = cellsFor(key, state);
    for (const [dr, dc] of cells) {
      const r = row + dr;
      const c = col + dc;
      if (c < 0 || c >= COLS || r >= ROWS + HIDDEN_ROWS) return true;
      if (r < 0) continue;
      if (this.board[r][c]) return true;
    }
    return false;
  }

  _cellsAbs(piece = this.piece) {
    return cellsFor(piece.key, piece.state).map(([dr, dc]) => [piece.row + dr, piece.col + dc]);
  }

  ghostRow() {
    let row = this.piece.row;
    while (!this._collides(this.piece.key, this.piece.state, row + 1, this.piece.col)) row++;
    return row;
  }

  move(dCol) {
    if (this.gameOver || this.paused) return false;
    const { key, state, row, col } = this.piece;
    if (!this._collides(key, state, row, col + dCol)) {
      this.piece.col += dCol;
      this.lastActionWasRotate = false;
      this._refreshLock();
      return true;
    }
    return false;
  }

  softDrop() {
    if (this.gameOver || this.paused) return false;
    const { key, state, row, col } = this.piece;
    if (!this._collides(key, state, row + 1, col)) {
      this.piece.row += 1;
      this.lastActionWasRotate = false;
      this.score += 1;
      this.onEvent({ type: 'score', score: this.score });
      return true;
    }
    return false;
  }

  hardDrop() {
    if (this.gameOver || this.paused) return;
    let dist = 0;
    while (!this._collides(this.piece.key, this.piece.state, this.piece.row + 1, this.piece.col)) {
      this.piece.row += 1;
      dist += 1;
    }
    this.score += dist * 2;
    this._lock();
  }

  rotate(dir) {
    if (this.gameOver || this.paused) return false;
    const { key } = this.piece;
    if (key === 'O') return false;
    const from = this.piece.state;
    const to = (from + dir + 4) % 4;
    const kicks = getKicks(key);
    for (const [dr, dc] of kicks) {
      const row = this.piece.row + dr;
      const col = this.piece.col + dc;
      if (!this._collides(key, to, row, col)) {
        this.piece.state = to;
        this.piece.row = row;
        this.piece.col = col;
        this.lastActionWasRotate = true;
        this._refreshLock();
        this.onEvent({ type: 'rotate' });
        return true;
      }
    }
    return false;
  }

  hold_() {
    if (this.gameOver || this.paused || this.holdUsed) return;
    const currentKey = this.piece.key;
    if (this.hold) {
      const swapped = this.hold;
      this.hold = currentKey;
      const size = PIECES[swapped].size;
      this.piece = {
        key: swapped,
        state: 0,
        row: HIDDEN_ROWS - (size === 4 ? 2 : 1),
        col: Math.floor((COLS - size) / 2),
      };
    } else {
      this.hold = currentKey;
      this._spawnPiece();
    }
    this.holdUsed = true;
    this.isLocking = false;
    this.lockTimer = 0;
    this.lockResets = 0;
    this.onEvent({ type: 'hold' });
  }

  _refreshLock() {
    if (this.isLocking && this.lockResets < MAX_LOCK_RESETS) {
      this.lockTimer = 0;
      this.lockResets += 1;
    }
  }

  _detectTSpin() {
    if (this.piece.key !== 'T' || !this.lastActionWasRotate) return null;
    const box = this.piece; // 3x3 box, row/col is top-left
    const filled = (r, c) => {
      if (c < 0 || c >= COLS || r >= ROWS + HIDDEN_ROWS) return true;
      if (r < 0) return false;
      return !!this.board[r][c];
    };
    const corners = {
      tl: filled(box.row, box.col),
      tr: filled(box.row, box.col + 2),
      bl: filled(box.row + 2, box.col),
      br: filled(box.row + 2, box.col + 2),
    };
    // Front corners face the direction the T's point faces for each state.
    const frontByState = {
      0: ['tl', 'tr'],
      1: ['tr', 'br'],
      2: ['bl', 'br'],
      3: ['tl', 'bl'],
    };
    const front = frontByState[this.piece.state];
    const back = Object.keys(corners).filter((k) => !front.includes(k));
    const frontCount = front.filter((k) => corners[k]).length;
    const backCount = back.filter((k) => corners[k]).length;
    const total = frontCount + backCount;
    if (total < 3) return null;
    if (frontCount === 2 || backCount === 2) return 'full';
    return 'mini';
  }

  _lock() {
    const tSpin = this._detectTSpin();
    for (const [r, c] of this._cellsAbs()) {
      if (r >= 0) this.board[r][c] = this.piece.key;
    }
    this.totalPiecesPlaced += 1;

    const fullRows = [];
    for (let r = 0; r < ROWS + HIDDEN_ROWS; r++) {
      if (this.board[r].every((cell) => cell)) fullRows.push(r);
    }
    const clearedCount = fullRows.length;

    if (clearedCount > 0) {
      const remaining = this.board.filter((_, r) => !fullRows.includes(r));
      const total = ROWS + HIDDEN_ROWS;
      while (remaining.length < total) remaining.unshift(Array(COLS).fill(null));
      this.board = remaining;
    }

    // Combo count must be updated before scoring so the bonus reflects the
    // chain length this clear extends to (0 on the first clear of a chain,
    // 1 on the next consecutive one, and so on).
    if (clearedCount > 0) this.combo += 1; else this.combo = -1;

    const result = this._score(clearedCount, tSpin);

    if (clearedCount > 0) {
      this.lines += clearedCount;
      const newLevel = Math.floor(this.lines / 10) + 1;
      if (newLevel !== this.level) {
        this.level = newLevel;
        this.onEvent({ type: 'levelUp', level: this.level });
      }
    }

    this.onEvent({
      type: 'lock',
      clearedCount,
      tSpin,
      ...result,
      combo: this.combo,
      score: this.score,
      lines: this.lines,
      level: this.level,
      totalPiecesPlaced: this.totalPiecesPlaced,
    });

    if (!this.gameOver) this._spawnPiece();
  }

  _score(clearedCount, tSpin) {
    const level = this.level;
    let base = 0;
    let label = null;
    let isDifficult = false;

    if (tSpin === 'full') {
      isDifficult = true;
      base = [400, 800, 1200, 1600][clearedCount] ?? 400;
      label = clearedCount === 0 ? 'T-Spin' : `T-Spin ${['', 'Single', 'Double', 'Triple'][clearedCount]}`;
    } else if (tSpin === 'mini') {
      base = [100, 200, 400][clearedCount] ?? 100;
      label = clearedCount === 0 ? 'T-Spin Mini' : `T-Spin Mini ${['', 'Single', 'Double'][clearedCount]}`;
      isDifficult = clearedCount > 0;
    } else if (clearedCount === 1) {
      base = 100; label = 'Single';
    } else if (clearedCount === 2) {
      base = 300; label = 'Double';
    } else if (clearedCount === 3) {
      base = 500; label = 'Triple';
    } else if (clearedCount === 4) {
      base = 800; label = 'Tetris'; isDifficult = true;
    }

    // A zero-line T-Spin keeps back-to-back eligibility alive (it doesn't
    // clear anything, so it shouldn't itself earn the streak bonus) while any
    // ordinary line clear breaks the chain.
    let backToBackBonus = 0;
    if (isDifficult && clearedCount > 0) {
      if (this.backToBack) backToBackBonus = Math.floor(base * 0.5);
      this.backToBack = true;
    } else if (isDifficult) {
      this.backToBack = true;
    } else if (clearedCount > 0) {
      this.backToBack = false;
    }

    const comboBonus = this.combo > 0 ? 50 * this.combo * level : 0;
    const total = (base + backToBackBonus) * level + comboBonus;
    this.score += total;

    return {
      label,
      points: total,
      backToBack: isDifficult && backToBackBonus > 0,
      isDifficult,
    };
  }

  tick(dtMs) {
    if (this.gameOver || this.paused) return;
    const onFloor = this._collides(this.piece.key, this.piece.state, this.piece.row + 1, this.piece.col);
    if (onFloor) {
      this.isLocking = true;
      this.lockTimer += dtMs;
      if (this.lockTimer >= LOCK_DELAY_MS) this._lock();
      return;
    }
    this.isLocking = false;
    this.lockTimer = 0;
    this.dropIntervalAcc += dtMs;
    const interval = this.gravityMs();
    while (this.dropIntervalAcc >= interval) {
      this.dropIntervalAcc -= interval;
      if (!this._collides(this.piece.key, this.piece.state, this.piece.row + 1, this.piece.col)) {
        this.piece.row += 1;
      } else {
        this.isLocking = true;
        break;
      }
    }
  }

  togglePause() {
    if (this.gameOver) return;
    this.paused = !this.paused;
  }
}

export { COLS, ROWS, HIDDEN_ROWS, PIECES, PIECE_KEYS };
