// Faith Blocks — a big-block Tetris variant built as a wellness feature, not
// entertainment for its own sake: a way to breathe for a few minutes between
// shifts, with the app quietly aware of why someone might reach for it.
//
// V1 (first slice) scope, deliberately: the game itself (big blocks, huge
// touch controls + swipe gestures, calm Apple-style design), scripture/
// encouragement breaks between rounds, and one gentle "you've been playing a
// while" offer after ~20 minutes — no guilt, no pressure, easy to dismiss.
// Sessions are logged locally (state.js's faithBlocksSessions) as the
// foundation for later Agent Brain personalization; the fuller behavioral-
// pattern engine, a wellness analytics dashboard, accessibility deep-modes,
// and a multi-game plugin framework are intentionally left for later slices,
// same incremental spirit as the LIFE-pillar roadmap.
//
// No score chase on purpose — lines cleared are shown quietly, never framed
// as a number to beat. Never "GAME OVER"; never "YOU WIN".
import { pickRandom } from './utils.js';
import { logFaithBlocksSession } from './state.js';
import { openBreathing } from './sanctuary.js';

const COLS = 6;
const ROWS = 11;
const LINES_PER_BREAK = 3;
const INTERVENE_AFTER_MS = 20 * 60 * 1000;

const PIECES = [
  { shape: [[1, 1, 1, 1]], color: 'oc-fb-c1' }, // I
  { shape: [[1, 1], [1, 1]], color: 'oc-fb-c2' }, // O
  { shape: [[0, 1, 0], [1, 1, 1]], color: 'oc-fb-c3' }, // T
  { shape: [[0, 1, 1], [1, 1, 0]], color: 'oc-fb-c4' }, // S
  { shape: [[1, 1, 0], [0, 1, 1]], color: 'oc-fb-c5' }, // Z
  { shape: [[1, 0, 0], [1, 1, 1]], color: 'oc-fb-c6' }, // J
  { shape: [[0, 0, 1], [1, 1, 1]], color: 'oc-fb-c7' }, // L
];

const ENCOURAGEMENTS = [
  'Isang block, isang hakbang.',
  'Kasama mo ang Diyos dito.',
  'Ayos lang ang maupo at magpahinga sandali.',
  "Galing mo — ilang minuto lang ito para sa'yo.",
];

const END_TITLES = ['Magaling!', 'Isang hakbang paglaya.', 'Salamat sa oras na ito.'];

let els = {};
let goTo = () => {};
let versePool = [];

let board = [];
let current = null;
let next = null;
let totalLinesCleared = 0;
let linesSinceBreak = 0;
let paused = false;
let gameEnded = false;
let sessionStartedAt = null;
let dropTimer = null;
let interventionTimer = null;
let interventionShownThisSession = false;

function flattenVerses(verses) {
  if (!verses) return [];
  return Object.entries(verses)
    .filter(([key]) => key !== '_comment')
    .flatMap(([, list]) => list);
}

function emptyBoard() {
  return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPiece() {
  const p = PIECES[Math.floor(Math.random() * PIECES.length)];
  const shape = p.shape.map((row) => row.slice());
  return { shape, colorClass: p.color, row: 0, col: Math.floor((COLS - shape[0].length) / 2) };
}

// Exported for direct unit testing (a small, pure function) — everything
// else here is DOM-wiring/game-loop state better exercised through the real
// UI rather than mocked in isolation.
export function rotateMatrix(m) {
  const rows = m.length;
  const cols = m[0].length;
  const res = Array.from({ length: cols }, () => Array(rows).fill(0));
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) res[c][rows - 1 - r] = m[r][c];
  }
  return res;
}

function collides(shape, row, col) {
  for (let r = 0; r < shape.length; r++) {
    for (let c = 0; c < shape[r].length; c++) {
      if (!shape[r][c]) continue;
      const br = row + r;
      const bc = col + c;
      if (bc < 0 || bc >= COLS || br >= ROWS) return true;
      if (br >= 0 && board[br][bc]) return true;
    }
  }
  return false;
}

function clearFullLines() {
  let cleared = 0;
  for (let r = ROWS - 1; r >= 0; r--) {
    if (board[r].every((cell) => cell)) {
      board.splice(r, 1);
      board.unshift(Array(COLS).fill(null));
      cleared += 1;
      r += 1; // re-check this index; a new row just slid into it
    }
  }
  return cleared;
}

function dropIntervalMs() {
  return Math.max(500, 900 - Math.floor(totalLinesCleared / 3) * 40);
}

function armDropTimer() {
  clearTimeout(dropTimer);
  if (paused || gameEnded) return;
  dropTimer = setTimeout(tick, dropIntervalMs());
}

function tick() {
  if (!current) return;
  if (!collides(current.shape, current.row + 1, current.col)) {
    current.row += 1;
  } else {
    lockPiece();
  }
  render();
  armDropTimer();
}

function lockPiece() {
  current.shape.forEach((row, r) => row.forEach((v, c) => {
    if (!v) return;
    const br = current.row + r;
    const bc = current.col + c;
    if (br >= 0 && br < ROWS) board[br][bc] = current.colorClass;
  }));

  const cleared = clearFullLines();
  if (cleared > 0) {
    totalLinesCleared += cleared;
    linesSinceBreak += cleared;
  }

  current = next;
  next = randomPiece();

  if (collides(current.shape, current.row, current.col)) {
    gameOver();
    return;
  }

  if (linesSinceBreak >= LINES_PER_BREAK) {
    linesSinceBreak -= LINES_PER_BREAK;
    pauseForBreak();
  }
}

function tryMove(dc) {
  if (paused || gameEnded || !current) return;
  if (!collides(current.shape, current.row, current.col + dc)) {
    current.col += dc;
    render();
  }
}

function tryRotate() {
  if (paused || gameEnded || !current) return;
  const rotated = rotateMatrix(current.shape);
  for (const dc of [0, -1, 1, -2, 2]) {
    if (!collides(rotated, current.row, current.col + dc)) {
      current.shape = rotated;
      current.col += dc;
      render();
      return;
    }
  }
}

function hardDrop() {
  if (paused || gameEnded || !current) return;
  while (!collides(current.shape, current.row + 1, current.col)) current.row += 1;
  lockPiece();
  render();
  armDropTimer();
}

function render() {
  const display = board.map((row) => row.slice());
  if (current) {
    current.shape.forEach((row, r) => row.forEach((v, c) => {
      if (!v) return;
      const br = current.row + r;
      const bc = current.col + c;
      if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS) display[br][bc] = current.colorClass;
    }));
  }
  els.board.innerHTML = display.flat()
    .map((cell) => `<div class="oc-fb-cell${cell ? ` is-filled ${cell}` : ''}"></div>`)
    .join('');
  els.lines.textContent = `🧱 ${totalLinesCleared}`;
}

// ── Scripture / encouragement break, every few line clears ──────────────────
function pauseForBreak() {
  paused = true;
  clearTimeout(dropTimer);
  const showVerse = versePool.length > 0 && Math.random() < 0.6;
  if (showVerse) {
    const v = pickRandom(versePool);
    els.breakText.textContent = `“${v.text}”`;
    els.breakRef.textContent = v.ref;
  } else {
    els.breakText.textContent = pickRandom(ENCOURAGEMENTS);
    els.breakRef.textContent = '';
  }
  els.break.hidden = false;
}

function resumeFromBreak() {
  els.break.hidden = true;
  paused = false;
  armDropTimer();
}

// ── The 20-minute gentle break offer ─────────────────────────────────────────
function startInterventionWatch() {
  clearInterval(interventionTimer);
  interventionTimer = setInterval(() => {
    if (paused || gameEnded || interventionShownThisSession || !sessionStartedAt) return;
    if (Date.now() - sessionStartedAt >= INTERVENE_AFTER_MS) {
      interventionShownThisSession = true;
      paused = true;
      clearTimeout(dropTimer);
      els.intervene.hidden = false;
    }
  }, 30000);
}

// ── Session lifecycle ─────────────────────────────────────────────────────────
function logCurrentSession() {
  if (!sessionStartedAt) return;
  logFaithBlocksSession({
    startedAt: sessionStartedAt,
    durationMs: Date.now() - sessionStartedAt,
    linesCleared: totalLinesCleared,
  });
  sessionStartedAt = null;
}

function startGame() {
  board = emptyBoard();
  current = randomPiece();
  next = randomPiece();
  totalLinesCleared = 0;
  linesSinceBreak = 0;
  paused = false;
  gameEnded = false;
  sessionStartedAt = Date.now();
  interventionShownThisSession = false;
  els.break.hidden = true;
  els.intervene.hidden = true;
  els.end.hidden = true;
  render();
  armDropTimer();
  startInterventionWatch();
}

function gameOver() {
  paused = true;
  gameEnded = true;
  clearTimeout(dropTimer);
  clearInterval(interventionTimer);
  logCurrentSession();
  render();
  els.endTitle.textContent = pickRandom(END_TITLES);
  els.endSub.textContent = totalLinesCleared > 0
    ? `${totalLinesCleared} na linya ang nalinis mo. Isang hakbang paglaya.`
    : 'Ayos lang iyan — subukan ulit kung kailan mo gusto.';
  els.end.hidden = false;
}

function closeOverlay() {
  clearTimeout(dropTimer);
  clearInterval(interventionTimer);
  logCurrentSession();
  els.overlay.hidden = true;
}

// ── Swipe gestures on the board (tap = rotate, matching the spec) ───────────
function setupSwipe(zone) {
  let startX = 0;
  let startY = 0;
  let startT = 0;
  zone.addEventListener('pointerdown', (e) => {
    startX = e.clientX;
    startY = e.clientY;
    startT = Date.now();
  });
  zone.addEventListener('pointerup', (e) => {
    const dx = e.clientX - startX;
    const dy = e.clientY - startY;
    if (Date.now() - startT > 800) return; // too slow to read as a swipe
    const TAP = 10;
    const SWIPE = 28;
    if (Math.abs(dx) < TAP && Math.abs(dy) < TAP) { tryRotate(); return; }
    if (Math.abs(dx) > Math.abs(dy)) {
      if (dx > SWIPE) tryMove(1);
      else if (dx < -SWIPE) tryMove(-1);
    } else if (dy > SWIPE) {
      hardDrop();
    }
  });
}

export function initFaithBlocks(context) {
  goTo = context.goTo;
  versePool = flattenVerses(context.verses);

  els = {
    launchBtn: document.getElementById('oc-faithblocks-btn'),
    overlay: document.getElementById('oc-faithblocks'),
    closeBtn: document.getElementById('oc-fb-close'),
    lines: document.getElementById('oc-fb-lines'),
    boardWrap: document.getElementById('oc-fb-board-wrap'),
    board: document.getElementById('oc-fb-board'),
    left: document.getElementById('oc-fb-left'),
    right: document.getElementById('oc-fb-right'),
    rotate: document.getElementById('oc-fb-rotate'),
    drop: document.getElementById('oc-fb-drop'),
    break: document.getElementById('oc-fb-break'),
    breakText: document.getElementById('oc-fb-break-text'),
    breakRef: document.getElementById('oc-fb-break-ref'),
    breakContinue: document.getElementById('oc-fb-break-continue'),
    intervene: document.getElementById('oc-fb-intervene'),
    end: document.getElementById('oc-fb-end'),
    endTitle: document.getElementById('oc-fb-end-title'),
    endSub: document.getElementById('oc-fb-end-sub'),
    retry: document.getElementById('oc-fb-retry'),
    endClose: document.getElementById('oc-fb-end-close'),
  };
  if (!els.overlay) return;

  els.launchBtn.addEventListener('click', () => {
    navigator.vibrate?.(8);
    els.overlay.hidden = false;
    startGame();
  });
  els.closeBtn.addEventListener('click', closeOverlay);

  els.left.addEventListener('click', () => { navigator.vibrate?.(6); tryMove(-1); });
  els.right.addEventListener('click', () => { navigator.vibrate?.(6); tryMove(1); });
  els.rotate.addEventListener('click', () => { navigator.vibrate?.(6); tryRotate(); });
  els.drop.addEventListener('click', () => { navigator.vibrate?.(10); hardDrop(); });
  setupSwipe(els.boardWrap);

  els.breakContinue.addEventListener('click', resumeFromBreak);

  els.intervene.querySelectorAll('[data-fb-intervene]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const kind = btn.dataset.fbIntervene;
      els.intervene.hidden = true;
      if (kind === 'continue') {
        paused = false;
        armDropTimer();
        return;
      }
      closeOverlay();
      if (kind === 'pray') goTo('faith');
      else if (kind === 'journal') goTo('journal');
      else if (kind === 'breathe') openBreathing();
      // 'break' — just closes, no further navigation.
    });
  });

  els.retry.addEventListener('click', startGame);
  els.endClose.addEventListener('click', () => { els.overlay.hidden = true; });
}
