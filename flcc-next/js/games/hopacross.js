// Hop Across: the rules, with no DOM in them.
//
// A chicken, a field of lanes, and one direction that counts — forward. Roads
// carry cars and trucks, rivers carry logs, railway lines carry trains, and
// grass is where a chicken can stop to think. Kept as pure functions over one
// state object, like Galaga, so it can be tested without a browser and the
// screen only has to draw what it is handed.
//
// Four decisions shape it:
//
//   · It never ends by being won. The field is generated as the chicken
//     climbs it, and every twenty rows is a new level: faster traffic, closer
//     cars, wider rivers, then trains from level 2 and the mist from level 3,
//     which rolls up behind and takes a chicken that stands still too long.
//     Every number stops at a ceiling a good thumb can still survive.
//   · The score is the furthest row reached, so stepping back to wait for a
//     gap is never punished — only standing still in front of the mist.
//   · A hop is a moment, not a teleport: a press during one is remembered and
//     played the instant it lands, so quick taps are never swallowed.
//   · Everything random comes from a seeded generator, so a run can be
//     replayed exactly for a test.
//
// The field is measured in lanes: COLS across, VIEW rows down, and the screen
// scales that to whatever canvas it has.

export const COLS = 9;
export const VIEW = 13;

const BASE = 0.68;             // how far down the field the chicken rides
const HOP = 0.13;              // seconds a hop takes
const ROWS_PER_LEVEL = 20;
const MINX = -12;              // lanes run on well past both edges, so traffic
const MAXX = COLS + 12;        // arrives from somewhere rather than appearing
const SPAN = MAXX - MINX;
const DYING = 0.95;            // seconds between the accident and the card
const BANNER = 2;              // seconds a new level's name stays up
const REACH = 1 + Math.floor(VIEW * (1 - BASE)); // rows back the chicken may walk

/** A seeded generator returning floats in [0, 1). */
export function seeded(seed) {
  let value = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

/** Which level row `r` belongs to. */
export const levelFor = (r) => 1 + Math.floor(Math.max(0, r) / ROWS_PER_LEVEL);

/**
 * How hard level `n` is. Every number moves in the harder direction as `n`
 * grows, and each stops at a ceiling.
 */
export function level(n) {
  const L = Math.max(1, Math.trunc(n) || 1);
  return {
    grass: Math.max(0.18, 0.42 - 0.03 * (L - 1)),       // share of safe ground
    river: Math.min(0.3, 0.14 + 0.02 * (L - 1)),
    rail: L >= 2 ? Math.min(0.14, 0.04 + 0.015 * L) : 0,
    carSpeed: Math.min(2.3, 1 + 0.12 * (L - 1)),
    trucks: L >= 2 ? Math.min(0.5, 0.15 * L) : 0,
    carGap: Math.max(1.6, 4.2 - 0.3 * (L - 1)),          // smallest gap between cars
    riverSpeed: Math.min(1.9, 1 + 0.07 * (L - 1)),
    logGap: Math.min(4, 2.6 + 0.15 * L),                  // widest gap between logs
    trainSpeed: Math.min(30, 17 + 0.7 * L),
    mist: L >= 3 ? Math.min(1.15, 0.35 + 0.07 * (L - 3)) : 0, // rows a second
  };
}

/** A new run, on the grass at row 0, before the first hop. */
export function create(seed = 1) {
  const state = {
    random: seeded(seed),
    time: 0,
    rows: {},
    top: -11,
    bottom: -10,
    queue: [],
    lastChunk: 'grass',
    lastRiverDir: 1,
    player: { x: 4, row: 0, y: 0, face: 0, hop: null, squashed: false, hidden: false, alpha: 1 },
    queued: null,
    cam: 0,
    score: 0,                  // the furthest row reached
    coins: 0,
    level: 1,
    mist: -99,
    banner: 0,
    started: false,
    dying: 0,
    cause: '',
    over: false,
  };
  ensureRows(state);
  return state;
}

const pick = (state, n) => Math.floor(state.random() * n);

function planChunk(state, L) {
  const config = level(L);
  const weights = { grass: config.grass, road: 0.38, river: config.river, rail: config.rail };
  weights[state.lastChunk] *= 0.12;           // two of a kind in a row is rare
  let total = 0;
  for (const key in weights) total += weights[key];
  let roll = state.random() * total;
  let type = 'grass';
  for (const key in weights) { roll -= weights[key]; if (roll <= 0 && weights[key] > 0) { type = key; break; } }
  let n = 1;
  if (type === 'grass') n = 1 + pick(state, L < 3 ? 3 : 2);
  else if (type === 'road') n = 1 + pick(state, Math.min(5, 2 + Math.floor(L / 2)));
  else if (type === 'river') n = 1 + pick(state, Math.min(4, 1 + Math.ceil(L / 2)));
  else n = 1 + (L >= 4 && state.random() < 0.4 ? 1 : 0);
  for (let i = 0; i < n; i++) state.queue.push(type);
  state.lastChunk = type;
}

function fillLane(state, row, len, gap) {
  let x = 0;
  for (;;) {
    const length = len();
    const space = gap();
    if (x + length + space > SPAN) break;
    row.objs.push({ x, len: length, tone: pick(state, 5) });
    x += length + space;
  }
  const shift = MINX + state.random() * SPAN;
  for (const one of row.objs) one.x = ((one.x + shift - MINX) % SPAN + SPAN) % SPAN + MINX;
}

function makeRow(state, r) {
  let type = 'grass';
  if (r >= 5) {
    if (!state.queue.length) planChunk(state, levelFor(r));
    type = state.queue.shift();
  }
  const L = levelFor(r);
  const config = level(L);
  const row = { r, L, type, objs: [], trees: new Set(), coin: null, seed: state.random() * 10 };

  if (type === 'grass') {
    if (r < 0) { for (let c = 0; c < COLS; c++) if (state.random() < 0.45) row.trees.add(c); }
    else if (r > 0 && r < 5) { for (let c = 0; c < COLS; c++) if (c !== 4 && state.random() < 0.14) row.trees.add(c); }
    else if (r >= 5) {
      const count = pick(state, Math.min(4, 2 + Math.floor(L / 3)));
      for (let i = 0; i < count; i++) row.trees.add(pick(state, COLS));
      if (state.random() < 0.22) { const c = pick(state, COLS); if (!row.trees.has(c)) row.coin = c; }
    }
  } else if (type === 'road') {
    const big = state.random() < config.trucks;
    row.dir = state.random() < 0.5 ? 1 : -1;
    row.speed = (1.1 + state.random() * 1.2) * config.carSpeed * (big ? 0.8 : 1);
    fillLane(state, row, () => (big ? 2 : 1), () => config.carGap + state.random() * 3);
    if (state.random() < 0.08) row.coin = pick(state, COLS);
  } else if (type === 'river') {
    state.lastRiverDir *= -1;
    row.dir = state.lastRiverDir;
    row.speed = (0.8 + state.random() * 0.8) * config.riverSpeed;
    fillLane(state, row, () => (L < 4 ? 2 + pick(state, 3) : 2 + pick(state, 2)),
      () => 1.4 + state.random() * (config.logGap - 1.4));
  } else {
    row.dir = state.random() < 0.5 ? 1 : -1;
    row.speed = config.trainSpeed;
    row.train = { x: MINX - 14, len: 12, active: false };
    row.timer = 1.5 + state.random() * 4;
    row.warning = false;
  }
  return row;
}

function ensureRows(state) {
  while (state.top < state.cam + 30) { state.top += 1; state.rows[state.top] = makeRow(state, state.top); }
  while (state.bottom < state.cam - 20) { delete state.rows[state.bottom]; state.bottom += 1; }
}

/** The log under column-position `x` in a river row, if there is one. */
export function logAt(row, x) {
  const centre = x + 0.5;
  return row.objs.find((one) => centre > one.x - 0.12 && centre < one.x + one.len + 0.12);
}

/**
 * Hop one lane. `dy` 1 is forward, -1 back; `dx` 1 is right, -1 left. A hop
 * asked for mid-hop is kept and played when this one lands. Returns what
 * happened: `'start'` on the first hop, `'hop'` when the chicken leaves the
 * ground. A hop into a tree, off the field or too far back is refused.
 */
export function move(state, dx, dy) {
  const events = [];
  if (state.over || state.dying) return events;
  const player = state.player;
  if (player.hop) { state.queued = { dx, dy }; return events; }
  if (!state.started) { state.started = true; events.push('start'); }
  player.face = dy > 0 ? 0 : dy < 0 ? 2 : dx < 0 ? 3 : 1;

  const ty = player.row + dy;
  if (ty < Math.max(0, state.score - REACH)) return events;
  const target = state.rows[ty];
  if (!target) return events;
  let tx;
  if (target.type === 'river') {
    // On water the chicken keeps the fraction the log carried it to.
    tx = player.x + dx;
    if (dx !== 0 && (tx < -0.4 || tx > COLS - 0.6)) return events;
  } else {
    tx = Math.round(player.x + dx);
    if (dx !== 0 && (tx < 0 || tx > COLS - 1)) return events;
    tx = Math.max(0, Math.min(COLS - 1, tx));
    if (target.type === 'grass' && target.trees.has(tx)) return events;
  }
  player.hop = { sx: player.x, sy: player.row, tx, ty, t: 0 };
  player.row = ty;
  events.push('hop');
  return events;
}

function die(state, cause, events) {
  if (state.dying || state.over) return;
  const player = state.player;
  state.cause = cause;
  state.dying = DYING;
  player.hop = null;
  state.queued = null;
  player.y = player.row;
  if (cause === 'car') player.squashed = true;
  if (cause === 'train') player.hidden = true;
  events.push(cause);
}

function land(state, events) {
  const player = state.player;
  const row = state.rows[player.row];
  if (row.type === 'river' && !logAt(row, player.x)) { die(state, 'water', events); return; }
  if (row.coin != null && Math.abs(player.x - row.coin) < 0.5) {
    state.coins += 1;
    row.coin = null;
    events.push('coin');
  }
  if (player.row > state.score) {
    state.score = player.row;
    events.push('score');
    const L = levelFor(state.score);
    if (L > state.level) { state.level = L; state.banner = BANNER; events.push('level'); }
  }
}

function hits(state, events) {
  const player = state.player;
  const hop = player.hop;
  const r = hop ? (hop.t < 0.5 ? hop.sy : hop.ty) : player.row;
  const row = state.rows[r];
  if (!row) return;
  const centre = player.x + 0.5;
  const half = 0.27;
  if (row.type === 'road') {
    for (const car of row.objs) if (centre + half > car.x && centre - half < car.x + car.len) { die(state, 'car', events); return; }
  } else if (row.type === 'rail' && row.train.active) {
    const train = row.train;
    if (centre + half > train.x && centre - half < train.x + train.len) die(state, 'train', events);
  }
}

function moveWorld(state, dt, events) {
  for (let r = Math.floor(state.cam) - 15; r <= state.top; r++) {
    const row = state.rows[r];
    if (!row) continue;
    if (row.type === 'road' || row.type === 'river') {
      const v = row.dir * row.speed * dt;
      for (const one of row.objs) {
        one.x += v;
        if (row.dir > 0 && one.x > MAXX) one.x -= SPAN;
        else if (row.dir < 0 && one.x + one.len < MINX) one.x += SPAN;
      }
    } else if (row.type === 'rail') {
      const train = row.train;
      if (!train.active) {
        row.timer -= dt;
        if (row.timer <= 1.2 && !row.warning) {
          row.warning = true;
          if (!state.dying && !state.over && Math.abs(r - state.player.row) < 6) events.push('bell');
        }
        if (row.timer <= 0) { train.active = true; train.x = row.dir > 0 ? MINX - train.len : MAXX; }
      } else {
        train.x += row.dir * row.speed * dt;
        if ((row.dir > 0 && train.x > MAXX) || (row.dir < 0 && train.x + train.len < MINX)) {
          train.active = false;
          row.warning = false;
          row.timer = 3 + (state.random() * 5) / Math.min(2, 1 + 0.1 * (row.L - 1));
        }
      }
    }
  }
}

/**
 * Advance the run by `dt` seconds. Returns what happened, so the screen can
 * play a sound and repaint the numbers only when they change: `hop`, `coin`,
 * `score`, `level`, `bell`, one of `car` / `water` / `train` / `mist` when the
 * chicken is lost, and `over` once the moment after it has passed.
 */
export function step(state, dt = 1 / 60) {
  const events = [];
  if (state.over) return events;
  dt = Math.min(dt, 0.05);                   // a background tab is not a teleport
  state.time += dt;
  state.banner = Math.max(0, state.banner - dt);
  moveWorld(state, dt, events);

  const player = state.player;
  if (state.dying) {
    state.dying = Math.max(0, state.dying - dt);
    const gone = DYING - state.dying;
    if ((state.cause === 'water') && gone > 0.12) player.hidden = true;
    if (state.cause === 'mist') player.alpha = Math.max(0, 1 - gone * 2);
    if (state.dying === 0) { state.over = true; events.push('over'); }
  } else {
    const hop = player.hop;
    if (hop) {
      hop.t += dt / HOP;
      const k = Math.min(1, hop.t);
      const ease = 1 - (1 - k) * (1 - k);
      player.x = hop.sx + (hop.tx - hop.sx) * ease;
      player.y = hop.sy + (hop.ty - hop.sy) * ease;
      if (k >= 1) {
        player.hop = null;
        player.x = hop.tx;
        player.y = hop.ty;
        land(state, events);
        if (!state.dying && state.queued) {
          const next = state.queued;
          state.queued = null;
          events.push(...move(state, next.dx, next.dy));
        }
      }
    } else {
      const row = state.rows[player.row];
      if (row.type === 'river') {
        if (logAt(row, player.x)) {
          player.x += row.dir * row.speed * dt;
          if (player.x < -0.5 || player.x > COLS - 0.5) die(state, 'water', events);
        } else die(state, 'water', events);
      }
    }
    if (!state.dying) hits(state, events);
    if (!state.dying && state.level >= 3) {
      state.mist = Math.max(state.mist + level(state.level).mist * dt, state.score - 8);
      if (player.y < state.mist - 0.3) die(state, 'mist', events);
    }
  }

  const target = Math.max(player.y, state.score - 2);
  state.cam += (target - state.cam) * Math.min(1, dt * 6);
  ensureRows(state);
  return events;
}

/** What a lost chicken is told, by what it was lost to. */
export const CAUSES = {
  car: ['Squished!', 'Cars don’t stop for chickens. Time your hop between them.'],
  water: ['Splash!', 'Chickens can’t swim. Land on the logs to cross the river.'],
  train: ['Choo-choo!', 'When the light flashes, a train is coming. Wait for it to pass.'],
  mist: ['Lost in the mist', 'From level 3 the mist rolls in behind you. Keep hopping forward.'],
};

/** What a new level brings, for the line under its name. */
export const LEVEL_NEWS = (n) => (n === 2 ? 'Trains start running.' : n === 3 ? 'The mist rolls in behind you.' : 'Everything moves a little faster.');

// ── Sounds ─────────────────────────────────────────────────────────────────
//
// Recipes for `js/games/chiptune.js`'s player, in its format, so Hop Across
// needs no audio files either. Hopping is the quietest, because it is the one
// played over and over.

export const SOUNDS = {
  hop: [{ type: 'square', from: 460, to: 720, at: 0, dur: 0.07, gain: 0.025 }],
  bell: [
    { type: 'square', from: 1250, to: 1250, at: 0, dur: 0.08, gain: 0.03 },
    { type: 'square', from: 1250, to: 1250, at: 0.16, dur: 0.08, gain: 0.03 },
  ],
  coin: [
    { type: 'triangle', from: 988, to: 988, at: 0, dur: 0.07, gain: 0.07 },
    { type: 'triangle', from: 1480, to: 1480, at: 0.07, dur: 0.14, gain: 0.06 },
  ],
  level: [523, 659, 784, 1047].map((hz, i) => ({ type: 'triangle', from: hz, to: hz, at: i * 0.09, dur: 0.14, gain: 0.06 })),
  car: [
    { type: 'sawtooth', from: 220, to: 60, at: 0, dur: 0.28, gain: 0.06 },
    { type: 'square', from: 120, to: 60, at: 0, dur: 0.3, gain: 0.04 },
  ],
  train: [
    { noise: true, cutFrom: 1800, cutTo: 80, at: 0, dur: 0.5, gain: 0.2 },
    { type: 'sawtooth', from: 180, to: 35, at: 0, dur: 0.45, gain: 0.07 },
  ],
  water: [
    { type: 'sine', from: 420, to: 90, at: 0, dur: 0.35, gain: 0.09 },
    { type: 'triangle', from: 260, to: 80, at: 0.05, dur: 0.4, gain: 0.05 },
  ],
  mist: [
    { type: 'sine', from: 420, to: 90, at: 0, dur: 0.35, gain: 0.09 },
  ],
};

// ── Drawing ────────────────────────────────────────────────────────────────
//
// The poster system at lane size: flat fills from the palette, one navy
// outline, paper behind. Seen from above, so nothing needs a shadow to stand
// up. `colors` is the palette read out of the stylesheet by the screen, so no
// colour is written down here.

const CAR_TONES = ['poppy', 'rose', 'sunshine', 'paper', 'captain'];

function box(g, x, y, w, h, r, fill) {
  if (w <= 0 || h <= 0) return;
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2)); else g.rect(x, y, w, h);
  if (fill) { g.fillStyle = fill; g.fill(); }
  g.stroke();
}

function dot(g, x, y, r, fill) {
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  if (fill) { g.fillStyle = fill; g.fill(); }
  g.stroke();
}

function drawGround(g, state, row, y, colors) {
  if (row.type === 'grass') return;              // the paper is the grass
  if (row.type === 'road') {
    g.fillStyle = colors.sky;
    g.fillRect(0, y, COLS, 1);
    const above = state.rows[row.r + 1];
    if (above && above.type === 'road') {
      g.fillStyle = colors.paper;
      for (let x = 0.2; x < COLS; x += 1) g.fillRect(x, y - 0.03, 0.5, 0.06);
    }
  } else if (row.type === 'river') {
    g.fillStyle = colors.captain;
    g.fillRect(0, y, COLS, 1);
    g.fillStyle = colors.sky;
    for (let k = 0; k < 7; k++) {
      let x = (k * 1.37 + row.seed * 5 + state.time * row.dir * row.speed * 0.6) % (COLS + 2);
      if (x < 0) x += COLS + 2;
      g.fillRect(x - 1, y + 0.28 + (k % 3) * 0.2, 0.34, 0.05);
    }
  } else {
    g.fillStyle = colors.faint;
    g.fillRect(0, y, COLS, 1);
    g.fillStyle = colors.ink;
    for (let x = 0.17; x < COLS; x += 0.5) g.fillRect(x, y + 0.14, 0.08, 0.72);
    g.fillRect(0, y + 0.28, COLS, 0.06);
    g.fillRect(0, y + 0.66, COLS, 0.06);
  }
}

/** Where one kind of ground meets another, a navy line — the poster's edge. */
function drawSeam(g, state, row, y, colors) {
  const above = state.rows[row.r + 1];
  if (!above || above.type === row.type) return;
  g.fillStyle = colors.ink;
  g.fillRect(0, y - 0.03, COLS, 0.06);
}

function drawTree(g, c, y, colors) {
  dot(g, c + 0.5, y + 0.52, 0.34, colors.rose);
  dot(g, c + 0.5, y + 0.52, 0.12, colors.paper);
}

function drawCar(g, car, row, y, colors) {
  const x = car.x + 0.08;
  const w = car.len - 0.16;
  if (x > COLS + 1 || x + w < -1) return;
  const top = y + 0.2;
  const tall = 0.6;
  const tone = colors[CAR_TONES[car.tone]] || colors.poppy;
  if (car.len === 2) {
    const cab = 0.62;
    const cabX = row.dir > 0 ? x + w - cab : x;
    const loadX = row.dir > 0 ? x : x + cab + 0.06;
    box(g, loadX, top, w - cab - 0.06, tall, 0.08, colors.paper);
    box(g, cabX, top, cab, tall, 0.12, tone === colors.paper ? colors.sunshine : tone);
    const glass = row.dir > 0 ? cabX + cab - 0.28 : cabX + 0.1;
    box(g, glass, top + 0.12, 0.18, tall - 0.24, 0.04, colors.sky);
  } else {
    box(g, x, top, w, tall, 0.16, tone);
    const glass = row.dir > 0 ? x + w - 0.38 : x + 0.14;
    box(g, glass, top + 0.12, 0.24, tall - 0.24, 0.05, colors.sky);
  }
}

function drawLog(g, log, y, colors) {
  const x = log.x + 0.05;
  const w = log.len - 0.1;
  if (x > COLS + 1 || x + w < -1) return;
  box(g, x, y + 0.2, w, 0.6, 0.3, colors.sunshine);
  g.beginPath();
  g.moveTo(x + 0.35, y + 0.42); g.lineTo(x + w - 0.6, y + 0.42);
  g.moveTo(x + 0.6, y + 0.6); g.lineTo(x + w - 0.35, y + 0.6);
  g.stroke();
}

function drawTrain(g, row, y, colors) {
  const train = row.train;
  if (!train.active) return;
  box(g, train.x, y + 0.1, train.len, 0.8, 0.14, colors.poppy);
  for (let i = 0.45; i < train.len - 0.6; i += 0.85) box(g, train.x + i, y + 0.3, 0.42, 0.4, 0.05, colors.paper);
}

function drawSignal(g, state, row, y, x, colors) {
  const on = (row.warning || row.train.active) && Math.floor(state.time * 6) % 2 === 0;
  dot(g, x, y + 0.5, 0.2, on ? colors.poppy : colors.paper);
}

function drawCoin(g, state, c, row, y, colors) {
  const bob = Math.sin(state.time * 4 + row.r) * 0.05;
  dot(g, c + 0.5, y + 0.5 + bob, 0.2, colors.sunshine);
  g.beginPath();
  g.moveTo(c + 0.5, y + 0.42 + bob); g.lineTo(c + 0.5, y + 0.58 + bob);
  g.stroke();
}

function drawChicken(g, state, colors) {
  const player = state.player;
  if (player.hidden) return;
  const y = rowY(state, player.y);
  const cx = player.x + 0.5;
  const cy = y + 0.5;
  g.save();
  g.globalAlpha = player.alpha;
  if (player.squashed) {
    g.beginPath();
    g.ellipse(cx, cy, 0.42, 0.14, 0, 0, Math.PI * 2);
    g.fillStyle = colors.paper; g.fill(); g.stroke();
    g.restore();
    return;
  }
  // A hop lifts the chicken toward the viewer: a little larger, then back.
  const lift = player.hop ? Math.sin(Math.PI * Math.min(1, player.hop.t)) * 0.18 : 0;
  g.translate(cx, cy);
  g.scale(1 + lift, 1 + lift);
  const face = player.face;                     // 0 up, 1 right, 2 down, 3 left
  const angle = [0, Math.PI / 2, Math.PI, -Math.PI / 2][face];
  g.rotate(angle);
  // Beak first, so the body's outline sits over its root.
  g.beginPath();
  g.moveTo(-0.08, -0.26); g.lineTo(0, -0.42); g.lineTo(0.08, -0.26); g.closePath();
  g.fillStyle = colors.sunshine; g.fill(); g.stroke();
  box(g, -0.28, -0.28, 0.56, 0.56, 0.18, colors.paper);
  // Comb along the crown, eyes either side of it.
  box(g, -0.06, -0.2, 0.12, 0.26, 0.05, colors.poppy);
  g.fillStyle = colors.ink;
  g.beginPath(); g.arc(-0.15, -0.14, 0.035, 0, Math.PI * 2); g.fill();
  g.beginPath(); g.arc(0.15, -0.14, 0.035, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** The top edge of row `r`, in field units, for the current camera. */
const rowY = (state, r) => VIEW * BASE - (r - state.cam);

/**
 * A headline and a label on a paper plate, centred at row-height `at`. Drawn
 * in canvas pixels rather than field units, because a font a fraction of a
 * pixel tall is not something every browser will scale up faithfully.
 */
function caption(g, big, small, { colors, scale, edge }, at) {
  const px = (units) => units * scale;
  const headFont = `900 ${px(0.62)}px Inter, system-ui, sans-serif`;
  const labelFont = `800 ${px(0.34)}px Inter, system-ui, sans-serif`;
  g.save();
  g.setTransform(1, 0, 0, 1, 0, 0);
  g.font = headFont;
  let widest = g.measureText(big).width;
  g.font = labelFont;
  widest = Math.max(widest, g.measureText(small).width);
  const w = Math.min(px(COLS - 0.4), widest + px(0.9));
  const h = px(1.55);
  const x = (px(COLS) - w) / 2;
  const y = px(at) - h / 2;
  g.lineWidth = edge;
  g.strokeStyle = colors.ink;
  g.fillStyle = colors.paper;
  g.beginPath();
  if (g.roundRect) g.roundRect(x, y, w, h, px(0.2)); else g.rect(x, y, w, h);
  g.fill();
  g.stroke();
  g.fillStyle = colors.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = headFont;
  g.fillText(big, px(COLS / 2), y + px(0.55), w - px(0.4));
  g.font = labelFont;
  g.fillText(small, px(COLS / 2), y + px(1.12), w - px(0.4));
  g.restore();
}

/**
 * Paint the whole field. `scale` is canvas pixels per lane, `edge` the
 * outline weight in canvas pixels.
 */
export function paint(g, state, { colors, scale, edge }) {
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.fillStyle = colors.paper;
  g.fillRect(0, 0, COLS, VIEW);
  g.lineWidth = edge / scale;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = colors.ink;

  const high = Math.ceil(state.cam + VIEW * BASE) + 1;
  const low = Math.floor(state.cam - VIEW * (1 - BASE)) - 1;
  for (let r = high; r >= low; r--) {
    const row = state.rows[r];
    if (row) drawGround(g, state, row, rowY(state, r), colors);
  }
  for (let r = high; r >= low; r--) {
    const row = state.rows[r];
    if (row) drawSeam(g, state, row, rowY(state, r), colors);
  }

  const on = Math.floor(state.player.y + 1e-6);
  for (let r = high; r >= low; r--) {
    const row = state.rows[r];
    if (!row) continue;
    const y = rowY(state, r);
    if (row.type === 'grass') for (const c of row.trees) drawTree(g, c, y, colors);
    else if (row.type === 'river') for (const log of row.objs) drawLog(g, log, y, colors);
    else if (row.type === 'road') for (const car of row.objs) drawCar(g, car, row, y, colors);
    else { drawTrain(g, row, y, colors); drawSignal(g, state, row, y, 0.3, colors); drawSignal(g, state, row, y, COLS - 0.3, colors); }
    if (row.coin != null) drawCoin(g, state, row.coin, row, y, colors);
    if (r === on) drawChicken(g, state, colors);
  }

  // The mist: flat paper rising from the bottom, edged in navy like any poster.
  if (state.level >= 3 && state.mist > -50) {
    const y = rowY(state, state.mist) + 1;
    if (y < VIEW) {
      g.fillStyle = colors.paper;
      g.fillRect(0, y, COLS, VIEW - y + 1);
      g.beginPath();
      for (let x = 0; x <= COLS; x += 0.5) {
        const wave = y + Math.sin(x * 2 + state.time * 2) * 0.06;
        if (x === 0) g.moveTo(x, wave); else g.lineTo(x, wave);
      }
      g.stroke();
    }
  }

  const plate = { colors, scale, edge };
  if (!state.started) caption(g, 'TAP OR ▲ TO HOP', 'SWIPE OR ◀ ▶ ▼ TO MOVE', plate, VIEW * 0.3);
  else if (state.banner > 0) caption(g, `LEVEL ${state.level}`, LEVEL_NEWS(state.level).toUpperCase(), plate, VIEW * 0.3);
}
