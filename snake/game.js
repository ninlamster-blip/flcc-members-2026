'use strict';

// ── Grid constants ────────────────────────────────────────────────
const COLS = 22, ROWS = 22;
const TICK_BASE = 145; // ms at level 1 (decreases per level)
const TICK_MIN  = 58;  // fastest possible tick

// ── Food catalogue ────────────────────────────────────────────────
const FOOD = {
  APPLE:  { pts: 10, color: '#FF4455', glow: 'rgba(255,68,85,0.75)',   prob: 0.62, label: null,   power: null    },
  GOLD:   { pts: 50, color: '#FFD700', glow: 'rgba(255,215,0,0.85)',   prob: 0.14, label: '★',    power: null    },
  SPEED:  { pts: 20, color: '#22CCFF', glow: 'rgba(34,204,255,0.80)',  prob: 0.10, label: '⚡',   power: 'SPEED' },
  DOUBLE: { pts: 25, color: '#FF8800', glow: 'rgba(255,136,0,0.80)',   prob: 0.08, label: '×2',   power: 'DOUBLE'},
  SHRINK: { pts: 35, color: '#FF00FF', glow: 'rgba(255,0,255,0.80)',   prob: 0.06, label: '✂',    power: 'SHRINK'},
};

// ── State ─────────────────────────────────────────────────────────
let canvas, ctx, cellW, cellH;
let snake, dir, queued;
let food, foodAnim;
let particles = [];
let score, level, hiScore;
let gameState = 'idle';   // idle | playing | dead
let tickId, frameId;
let activePower = null, powerTicks = 0, powerMax = 0;
let comboCount = 0, comboTicks = 0;
let shake = 0;

// ── Audio ─────────────────────────────────────────────────────────
let ac;
function ensureAudio() {
  if (!ac) ac = new (window.AudioContext || window.webkitAudioContext)();
}

function beep(notes, type = 'sine', vol = 0.18) {
  if (!ac) return;
  notes.forEach(([freq, start, dur]) => {
    const o = ac.createOscillator();
    const g = ac.createGain();
    o.type = type;
    o.frequency.value = freq;
    o.connect(g); g.connect(ac.destination);
    const t = ac.currentTime + start;
    g.gain.setValueAtTime(vol, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    o.start(t); o.stop(t + dur + 0.01);
  });
}

function sndEat()    { beep([[440, 0, 0.07], [660, 0.06, 0.07]]); }
function sndGold()   { beep([[523, 0, 0.08], [659, 0.07, 0.08], [784, 0.14, 0.1]], 'square', 0.12); }
function sndPower()  { beep([[300, 0, 0.06], [600, 0.05, 0.08], [1200, 0.12, 0.1]], 'sine', 0.13); }
function sndLevel()  { beep([[392, 0, 0.09], [523, 0.09, 0.09], [659, 0.18, 0.09], [784, 0.27, 0.13]]); }
function sndDie()    { beep([[180, 0, 0.05], [140, 0.05, 0.07], [100, 0.12, 0.1], [70, 0.22, 0.18]], 'sawtooth', 0.25); }
function sndCombo()  { beep([[880, 0, 0.06], [1100, 0.05, 0.06]], 'square', 0.10); }

// ── Layout ────────────────────────────────────────────────────────
function resize() {
  const wrap = document.getElementById('canvas-wrap');
  const W = wrap.clientWidth;
  const H = wrap.clientHeight;
  const cell = Math.floor(Math.min(W / COLS, H / ROWS));
  cellW = cellH = cell;
  canvas.width  = COLS * cell;
  canvas.height = ROWS * cell;
}

// ── Init ──────────────────────────────────────────────────────────
function init() {
  canvas = document.getElementById('c');
  ctx    = canvas.getContext('2d');
  resize();
  window.addEventListener('resize', resize);

  hiScore = +localStorage.getItem('snk_hi') || 0;
  document.getElementById('hi-display').textContent = hiScore;
  document.getElementById('hi-val').textContent = 'BEST: ' + hiScore;

  bindInput();

  document.getElementById('btn-start').addEventListener('click', () => { ensureAudio(); startGame(); });
  document.getElementById('btn-restart').addEventListener('click', () => { ensureAudio(); startGame(); });
}

// ── Input ─────────────────────────────────────────────────────────
function bindInput() {
  const MAP = { ArrowUp:'U', ArrowDown:'D', ArrowLeft:'L', ArrowRight:'R',
                w:'U', s:'D', a:'L', d:'R', W:'U', S:'D', A:'L', D:'R' };
  document.addEventListener('keydown', e => {
    if (MAP[e.key]) { e.preventDefault(); enqueue(MAP[e.key]); }
    if ((e.key === ' ' || e.key === 'Enter') && gameState === 'dead') { ensureAudio(); startGame(); }
  });

  // Swipe
  let tx = 0, ty = 0;
  canvas.addEventListener('touchstart', e => {
    tx = e.touches[0].clientX; ty = e.touches[0].clientY;
    ensureAudio(); e.preventDefault();
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    const dx = e.changedTouches[0].clientX - tx;
    const dy = e.changedTouches[0].clientY - ty;
    if (Math.abs(dx) > Math.abs(dy)) enqueue(dx > 0 ? 'R' : 'L');
    else                              enqueue(dy > 0 ? 'D' : 'U');
    e.preventDefault();
  }, { passive: false });
}

const OPP = { U:'D', D:'U', L:'R', R:'L' };
function enqueue(d) {
  if (gameState !== 'playing') return;
  if (queued.length < 2 && OPP[d] !== (queued[queued.length - 1] || dir)) queued.push(d);
}

// ── Game start ────────────────────────────────────────────────────
function startGame() {
  score = 0; level = 1;
  comboCount = 0; comboTicks = 0;
  activePower = null; powerTicks = 0; shake = 0;
  particles = [];

  const cx = Math.floor(COLS / 2), cy = Math.floor(ROWS / 2);
  snake = [{ x: cx, y: cy }, { x: cx - 1, y: cy }, { x: cx - 2, y: cy }];
  dir = 'R'; queued = [];

  spawnFood();
  updateHUD();
  hidePowerBanner();
  showOverlay(null);
  gameState = 'playing';

  clearInterval(tickId);
  tickId = setInterval(tick, tickSpeed());

  cancelAnimationFrame(frameId);
  frameId = requestAnimationFrame(frame);
}

function tickSpeed() {
  return Math.max(TICK_MIN, TICK_BASE - (level - 1) * 9);
}

// ── Food ──────────────────────────────────────────────────────────
function spawnFood() {
  const occ = new Set(snake.map(s => s.x + ',' + s.y));
  let x, y;
  do { x = Math.floor(Math.random() * COLS); y = Math.floor(Math.random() * ROWS); }
  while (occ.has(x + ',' + y));

  let r = Math.random(), cum = 0, type = 'APPLE';
  for (const [k, v] of Object.entries(FOOD)) { cum += v.prob; if (r < cum) { type = k; break; } }

  food = { x, y, type };
  foodAnim = 0;
}

// ── Game tick ─────────────────────────────────────────────────────
function tick() {
  if (gameState !== 'playing') return;

  if (queued.length) dir = queued.shift();

  const head = snake[0];
  const nx = head.x + (dir === 'R' ? 1 : dir === 'L' ? -1 : 0);
  const ny = head.y + (dir === 'D' ? 1 : dir === 'U' ? -1 : 0);

  // Wall
  if (nx < 0 || nx >= COLS || ny < 0 || ny >= ROWS) { die(); return; }

  // Self — skip last tail (it will vacate)
  for (let i = 0; i < snake.length - 1; i++) {
    if (snake[i].x === nx && snake[i].y === ny) { die(); return; }
  }

  snake.unshift({ x: nx, y: ny });

  if (nx === food.x && ny === food.y) {
    eatFood();
  } else {
    snake.pop();
  }

  // Combo decay
  if (comboTicks > 0 && --comboTicks === 0) comboCount = 0;

  // Power countdown
  if (activePower && powerTicks > 0 && --powerTicks === 0) expirePower();
}

function eatFood() {
  const f = FOOD[food.type];
  let pts = f.pts * (activePower === 'DOUBLE' ? 2 : 1);

  // Combo
  if (comboTicks > 0) {
    comboCount++;
    pts = Math.round(pts * (1 + comboCount * 0.4));
    if (comboCount >= 3) sndCombo();
  } else {
    comboCount = 1;
  }
  comboTicks = 9;

  score += pts;

  burst(food.x * cellW + cellW / 2, food.y * cellH + cellH / 2, f.color,
        food.type === 'GOLD' ? 22 : 12);

  if (f.power) {
    activatePower(f.power);
    sndPower();
  } else if (food.type === 'GOLD') {
    sndGold();
    burst(food.x * cellW + cellW / 2, food.y * cellH + cellH / 2, '#FFD700', 18);
  } else {
    sndEat();
  }

  // Show floating score
  floatText('+' + pts, food.x * cellW + cellW / 2, food.y * cellH, f.color);

  const newLevel = Math.floor(score / 120) + 1;
  if (newLevel > level) { level = newLevel; doLevelUp(); }

  updateHUD();
  spawnFood();
}

// ── Powers ────────────────────────────────────────────────────────
function activatePower(p) {
  if (p === 'SHRINK') {
    snake.splice(Math.max(3, snake.length - 6));
    return; // instant
  }
  activePower = p;
  powerMax = powerTicks = 32; // 32 ticks
  showPowerBanner(p);

  if (p === 'SPEED') {
    clearInterval(tickId);
    tickId = setInterval(tick, Math.max(38, tickSpeed() * 0.48));
  }
}

function expirePower() {
  const was = activePower;
  activePower = null;
  powerTicks = 0;
  hidePowerBanner();
  if (was === 'SPEED') {
    clearInterval(tickId);
    tickId = setInterval(tick, tickSpeed());
  }
}

function showPowerBanner(p) {
  const el = document.getElementById('power-banner');
  el.className = '';
  if (p === 'SPEED')  { el.textContent = '⚡ SPEED BOOST'; el.classList.add('spd'); }
  if (p === 'DOUBLE') { el.textContent = '×2 DOUBLE SCORE'; el.classList.add('x2'); }
  el.style.display = 'block';
}

function hidePowerBanner() {
  const el = document.getElementById('power-banner');
  el.style.display = 'none';
}

// ── Level up ──────────────────────────────────────────────────────
function doLevelUp() {
  sndLevel();
  clearInterval(tickId);
  tickId = setInterval(tick, tickSpeed());

  const el = document.getElementById('level-flash');
  el.textContent = 'LEVEL ' + level + '!';
  el.classList.remove('hidden');
  void el.offsetWidth; // re-trigger animation
  el.style.animation = 'none';
  requestAnimationFrame(() => { el.style.animation = ''; });
  setTimeout(() => el.classList.add('hidden'), 1500);
}

// ── Death ─────────────────────────────────────────────────────────
function die() {
  gameState = 'dead';
  clearInterval(tickId);
  sndDie();
  shake = 14;

  snake.forEach(seg => burst(seg.x * cellW + cellW / 2, seg.y * cellH + cellH / 2, '#00FF88', 5));

  if (score > hiScore) {
    hiScore = score;
    localStorage.setItem('snk_hi', hiScore);
  }

  setTimeout(() => {
    document.getElementById('over-score').textContent = score;
    document.getElementById('over-level').textContent = level;
    document.getElementById('hi-val').textContent = 'BEST: ' + hiScore;
    const nr = document.getElementById('new-rec');
    if (score > 0 && score >= hiScore) nr.classList.remove('hidden');
    else nr.classList.add('hidden');
    showOverlay('over-screen');
  }, 900);
}

// ── Particles ─────────────────────────────────────────────────────
function burst(x, y, color, n) {
  for (let i = 0; i < n; i++) {
    const a = (Math.PI * 2 / n) * i + Math.random() * 0.8;
    const spd = 1.6 + Math.random() * 3.2;
    particles.push({ x, y, vx: Math.cos(a) * spd, vy: Math.sin(a) * spd,
                     color, life: 1, r: 2 + Math.random() * 2.5 });
  }
}

// Floating score text particles
const floats = [];
function floatText(text, x, y, color) {
  floats.push({ text, x, y, color, life: 1 });
}

// ── HUD ───────────────────────────────────────────────────────────
function updateHUD() {
  document.getElementById('score-val').textContent = score;
  document.getElementById('level-val').textContent = 'LVL ' + level;
  document.getElementById('hi-val').textContent = 'BEST: ' + hiScore;
}

function showOverlay(id) {
  document.querySelectorAll('.overlay').forEach(o => o.classList.remove('active'));
  if (id) document.getElementById(id).classList.add('active');
}

// ── Render ────────────────────────────────────────────────────────
let prevTs = 0;

function frame(ts) {
  frameId = requestAnimationFrame(frame);
  const dt = ts - prevTs; prevTs = ts;
  foodAnim += 0.07;

  // Update particles
  particles = particles.filter(p => {
    p.x += p.vx; p.y += p.vy;
    p.vx *= 0.90; p.vy *= 0.90;
    p.life -= 0.038;
    return p.life > 0;
  });

  // Update floats
  for (let i = floats.length - 1; i >= 0; i--) {
    floats[i].y -= 0.9;
    floats[i].life -= 0.035;
    if (floats[i].life <= 0) floats.splice(i, 1);
  }

  // Screen shake
  let sx = 0, sy = 0;
  if (shake > 0) {
    sx = (Math.random() - 0.5) * shake;
    sy = (Math.random() - 0.5) * shake;
    shake *= 0.80;
    if (shake < 0.6) shake = 0;
  }

  ctx.save();
  ctx.translate(sx, sy);

  draw();

  ctx.restore();
}

function draw() {
  const W = canvas.width, H = canvas.height;

  // Background
  ctx.fillStyle = '#060a0f';
  ctx.fillRect(0, 0, W, H);

  // Subtle scanlines
  for (let y = 0; y < H; y += 4) {
    ctx.fillStyle = 'rgba(0,0,0,0.12)';
    ctx.fillRect(0, y, W, 1);
  }

  // Grid dots
  ctx.fillStyle = 'rgba(0,255,136,0.055)';
  for (let col = 0; col < COLS; col++) {
    for (let row = 0; row < ROWS; row++) {
      ctx.beginPath();
      ctx.arc(col * cellW + cellW / 2, row * cellH + cellH / 2, 0.9, 0, Math.PI * 2);
      ctx.fill();
    }
  }

  // Border glow
  ctx.strokeStyle = 'rgba(0,255,136,0.18)';
  ctx.lineWidth = 1.5;
  ctx.strokeRect(1, 1, W - 2, H - 2);

  // Food
  if (food) drawFood();

  // Snake
  if (gameState === 'playing' || gameState === 'dead') drawSnake();

  // Particles
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life * 0.9;
    ctx.shadowColor = p.color;
    ctx.shadowBlur = 8;
    ctx.fillStyle = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });

  // Floating score text
  floats.forEach(f => {
    ctx.save();
    ctx.globalAlpha = f.life;
    ctx.fillStyle = f.color;
    ctx.shadowColor = f.color;
    ctx.shadowBlur = 8;
    ctx.font = `bold ${Math.floor(cellH * 0.7)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.text, f.x, f.y);
    ctx.restore();
  });

  // Power progress bar (bottom of canvas)
  if (activePower && powerMax > 0) {
    const ratio = powerTicks / powerMax;
    const barColor = activePower === 'SPEED' ? '#22CCFF' : '#FF8800';
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(0, H - 5, W, 5);
    ctx.fillStyle = barColor;
    ctx.shadowColor = barColor;
    ctx.shadowBlur = 6;
    ctx.fillRect(0, H - 5, W * ratio, 5);
    ctx.shadowBlur = 0;
  }
}

function drawFood() {
  const f = FOOD[food.type];
  const cx = food.x * cellW + cellW / 2;
  const cy = food.y * cellH + cellH / 2;
  const pulse = 1 + Math.sin(foodAnim) * 0.14;
  const r = (cellW / 2 - 2) * pulse;

  ctx.save();
  ctx.shadowColor = f.glow;
  ctx.shadowBlur = 18;

  // Outer glow ring
  ctx.beginPath();
  ctx.arc(cx, cy, r + 3, 0, Math.PI * 2);
  ctx.fillStyle = f.glow;
  ctx.fill();

  // Main circle
  ctx.shadowBlur = 10;
  ctx.fillStyle = f.color;
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, Math.PI * 2);
  ctx.fill();

  // Highlight
  ctx.fillStyle = 'rgba(255,255,255,0.3)';
  ctx.beginPath();
  ctx.arc(cx - r * 0.28, cy - r * 0.28, r * 0.35, 0, Math.PI * 2);
  ctx.fill();

  // Label
  if (f.label) {
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#fff';
    ctx.font = `bold ${Math.floor(cellH * 0.55)}px 'Courier New', monospace`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(f.label, cx, cy + 1);
  }
  ctx.restore();
}

function drawSnake() {
  const n = snake.length;
  snake.forEach((seg, i) => {
    // Green gradient: head bright → tail dark
    const t = i / Math.max(n - 1, 1);
    const g = Math.round(255 - t * 185);
    const a = Math.max(0.25, 1 - t * 0.7);
    const color = `rgba(0,${g},${Math.round(136 - t * 110)},${a})`;

    const px = seg.x * cellW + 1;
    const py = seg.y * cellH + 1;
    const w  = cellW - 2;
    const h  = cellH - 2;

    ctx.save();
    if (i === 0) { ctx.shadowColor = '#00FF88'; ctx.shadowBlur = 16; }
    ctx.fillStyle = color;

    // Rounded rect
    const rad = Math.min(4, w / 3);
    ctx.beginPath();
    ctx.moveTo(px + rad, py);
    ctx.lineTo(px + w - rad, py);
    ctx.quadraticCurveTo(px + w, py, px + w, py + rad);
    ctx.lineTo(px + w, py + h - rad);
    ctx.quadraticCurveTo(px + w, py + h, px + w - rad, py + h);
    ctx.lineTo(px + rad, py + h);
    ctx.quadraticCurveTo(px, py + h, px, py + h - rad);
    ctx.lineTo(px, py + rad);
    ctx.quadraticCurveTo(px, py, px + rad, py);
    ctx.closePath();
    ctx.fill();

    // Snake eyes on head
    if (i === 0) {
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#000';
      const er = Math.max(1.5, cellW * 0.1);
      if (dir === 'R' || dir === 'L') {
        const ex = dir === 'R' ? px + w * 0.72 : px + w * 0.28;
        ctx.beginPath(); ctx.arc(ex, py + h * 0.3, er, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex, py + h * 0.7, er, 0, Math.PI * 2); ctx.fill();
      } else {
        const ey = dir === 'D' ? py + h * 0.72 : py + h * 0.28;
        ctx.beginPath(); ctx.arc(px + w * 0.3, ey, er, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + w * 0.7, ey, er, 0, Math.PI * 2); ctx.fill();
      }
      // White pupils
      ctx.fillStyle = 'rgba(255,255,255,0.8)';
      const pr = er * 0.45;
      if (dir === 'R' || dir === 'L') {
        const ex = dir === 'R' ? px + w * 0.72 : px + w * 0.28;
        ctx.beginPath(); ctx.arc(ex + pr * (dir === 'R' ? 0.5 : -0.5), py + h * 0.3, pr, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(ex + pr * (dir === 'R' ? 0.5 : -0.5), py + h * 0.7, pr, 0, Math.PI * 2); ctx.fill();
      } else {
        const ey = dir === 'D' ? py + h * 0.72 : py + h * 0.28;
        ctx.beginPath(); ctx.arc(px + w * 0.3, ey + pr * (dir === 'D' ? 0.5 : -0.5), pr, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.arc(px + w * 0.7, ey + pr * (dir === 'D' ? 0.5 : -0.5), pr, 0, Math.PI * 2); ctx.fill();
      }
    }
    ctx.restore();
  });
}

// ── Boot ──────────────────────────────────────────────────────────
window.addEventListener('load', init);
