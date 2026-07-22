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
import { getState, updateState, logFaithBlocksSession } from './state.js';
import { openBreathing } from './sanctuary.js';

const COLS = 6;
// Taller than classic Tetris's 20 rows would feel on 6 wide columns, but
// chosen to roughly match a phone's own usable aspect ratio once the
// header/controls are subtracted — see fitBoard() below, which measures
// the actual available space at runtime and sizes the board (and every
// tile) to fill as much of the screen as that ratio allows, rather than
// guessing a fixed size in CSS. A board this shape also stays forgiving:
// ordinary, unhurried play shouldn't top out every round.
const ROWS = 12;
const LINES_PER_BREAK = 3;
const INTERVENE_AFTER_MS = 20 * 60 * 1000;
// Constant, unhurried pace — no speed-up ramp. This is a wellness break,
// not a challenge to beat; gravity should never be the thing creating
// pressure to decide fast.
const DROP_INTERVAL_MS = 850;

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

// ── Sound (soft synthesized tones, no audio files needed — stays fully
// offline and needs no new assets) ──────────────────────────────────────────
// Lazily created on the first real tap (browsers require a user gesture
// before audio can play), and gently gained — this is a wellness break, not
// an arcade, so nothing here should startle anyone in a shared room.
let audioCtx = null;

function ensureAudioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function beep({ freq, duration, type = 'sine', gain = 0.04, delay = 0 }) {
  const ctx = ensureAudioCtx();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.value = freq;
  osc.connect(g);
  g.connect(ctx.destination);
  const t0 = ctx.currentTime + delay;
  g.gain.setValueAtTime(0, t0);
  g.gain.linearRampToValueAtTime(gain, t0 + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.start(t0);
  osc.stop(t0 + duration + 0.03);
}

function playSound(kind) {
  if (!getState().settings.faithBlocksSound) return;
  if (kind === 'move') beep({ freq: 260, duration: 0.06, gain: 0.025 });
  else if (kind === 'rotate') beep({ freq: 380, duration: 0.07, gain: 0.03 });
  else if (kind === 'lock') beep({ freq: 150, duration: 0.09, type: 'triangle', gain: 0.045 });
  else if (kind === 'lineClear') {
    beep({ freq: 523.25, duration: 0.14, gain: 0.045 }); // C5
    beep({ freq: 659.25, duration: 0.14, gain: 0.045, delay: 0.08 }); // E5
    beep({ freq: 783.99, duration: 0.18, gain: 0.045, delay: 0.16 }); // G5
  } else if (kind === 'gameOver') {
    beep({ freq: 392.0, duration: 0.2, gain: 0.035 }); // G4
    beep({ freq: 329.63, duration: 0.3, gain: 0.035, delay: 0.18 }); // E4
  }
}

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

function armDropTimer() {
  clearTimeout(dropTimer);
  if (paused || gameEnded) return;
  dropTimer = setTimeout(tick, DROP_INTERVAL_MS);
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
    playSound('lineClear');
  } else {
    playSound('lock');
  }

  current = next;
  next = randomPiece();
  renderNextPreview();

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
    playSound('move');
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
      playSound('rotate');
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

// Where the current piece would land if hard-dropped right now.
function ghostRow() {
  let r = current.row;
  while (!collides(current.shape, r + 1, current.col)) r += 1;
  return r;
}

// A faint landing-spot outline for the current piece — seeing exactly
// where a hard-drop will land before committing to it removes the anxiety
// of an irreversible surprise, which matters more here than in a
// competitive Tetris (this is meant to be relaxing, not tense).
function render() {
  const display = board.map((row) => row.slice());
  const ghostCells = new Set();
  if (current) {
    const gRow = ghostRow();
    if (gRow !== current.row) {
      current.shape.forEach((row, r) => row.forEach((v, c) => {
        if (!v) return;
        const br = gRow + r;
        const bc = current.col + c;
        if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS) ghostCells.add(br * COLS + bc);
      }));
    }
    current.shape.forEach((row, r) => row.forEach((v, c) => {
      if (!v) return;
      const br = current.row + r;
      const bc = current.col + c;
      if (br >= 0 && br < ROWS && bc >= 0 && bc < COLS) display[br][bc] = current.colorClass;
    }));
  }
  els.board.innerHTML = display.flat()
    .map((cell, i) => {
      if (cell) return `<div class="oc-fb-cell is-filled ${cell}"></div>`;
      if (ghostCells.has(i)) return '<div class="oc-fb-cell is-ghost"></div>';
      return '<div class="oc-fb-cell"></div>';
    })
    .join('');
  els.lines.textContent = `🧱 ${totalLinesCleared}`;
}

// A small always-visible preview of the upcoming piece — lets a member plan
// ahead calmly instead of reacting to a surprise the instant it spawns.
// Normalized onto a fixed 4x4 grid (big enough for any piece shape here) so
// the preview box never changes size as different pieces come up.
function renderNextPreview() {
  if (!els.nextPreview || !next) return;
  const size = 4;
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  const { shape, colorClass } = next;
  const offR = Math.floor((size - shape.length) / 2);
  const offC = Math.floor((size - shape[0].length) / 2);
  shape.forEach((row, r) => row.forEach((v, c) => {
    if (!v) return;
    grid[offR + r][offC + c] = colorClass;
  }));
  els.nextPreview.innerHTML = grid.flat()
    .map((cell) => `<div class="oc-fb-next-cell oc-fb-cell${cell ? ` is-filled ${cell}` : ''}"></div>`)
    .join('');
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
  renderNextPreview();
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
  playSound('gameOver');
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
// Pointer capture + explicit touch-action: none (see style.css) so the
// browser's own scroll/zoom gesture recognizer never races these handlers
// and swallows a swipe partway through — the failure mode that made touch
// controls feel unreliable before this.
function setupSwipe(zone) {
  let startX = 0;
  let startY = 0;
  let startT = 0;
  let tracking = false;

  const onDown = (e) => {
    tracking = true;
    startX = e.clientX;
    startY = e.clientY;
    startT = Date.now();
    zone.setPointerCapture?.(e.pointerId);
  };

  const onUp = (e) => {
    if (!tracking) return;
    tracking = false;
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
  };

  zone.addEventListener('pointerdown', onDown);
  zone.addEventListener('pointerup', onUp);
  zone.addEventListener('pointercancel', () => { tracking = false; });
}

function updateSoundBtn() {
  const on = getState().settings.faithBlocksSound;
  els.soundBtn.textContent = on ? '🔊' : '🔇';
  els.soundBtn.setAttribute('aria-label', on ? 'Mute sound' : 'Unmute sound');
}

// Measures the actual available space in #oc-fb-board-wrap and sizes the
// board to fill as much of it as the COLS:ROWS ratio allows — whichever
// dimension is the tighter fit wins, so the board (and every tile) is
// always as big as the real screen genuinely has room for, rather than a
// size guessed ahead of time in CSS. A no-op while the overlay is hidden
// (nothing to measure yet).
function fitBoard() {
  if (!els.overlay || els.overlay.hidden) return;
  const availW = els.boardWrap.clientWidth;
  const availH = els.boardWrap.clientHeight;
  if (!availW || !availH) return;
  const ratio = COLS / ROWS;
  let w = availW;
  let h = w / ratio;
  if (h > availH) {
    h = availH;
    w = h * ratio;
  }
  els.board.style.width = `${Math.floor(w)}px`;
  els.board.style.height = `${Math.floor(h)}px`;
}

export function initFaithBlocks(context) {
  goTo = context.goTo;
  versePool = flattenVerses(context.verses);

  els = {
    launchBtn: document.getElementById('oc-faithblocks-btn'),
    overlay: document.getElementById('oc-faithblocks'),
    closeBtn: document.getElementById('oc-fb-close'),
    soundBtn: document.getElementById('oc-fb-sound'),
    nextPreview: document.getElementById('oc-fb-next'),
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
    fitBoard();
    startGame();
  });
  // Deliberately NOT listening on window 'resize': mobile browsers fire it
  // constantly while playing as the address bar auto-hides/shows on touch,
  // which made the board visibly grow mid-tap and never settle back to its
  // original size. orientationchange (an actual device rotation) is a much
  // rarer, more deliberate signal, so it's the only thing worth re-fitting
  // for once the game is already open.
  window.addEventListener('orientationchange', () => setTimeout(fitBoard, 200));
  els.closeBtn.addEventListener('click', closeOverlay);

  updateSoundBtn();
  els.soundBtn.addEventListener('click', () => {
    updateState((s) => { s.settings.faithBlocksSound = !s.settings.faithBlocksSound; });
    updateSoundBtn();
    if (getState().settings.faithBlocksSound) playSound('move'); // a quick confirmation blip
  });

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
