// David and the Giant: a climb-and-jump arcade game, with no DOM in it.
//
// A giant stands at the top of a tower of girders with a lamb he has taken,
// rolling barrels down at David, who starts at the bottom. Run along the
// girders, climb the ladders, jump the barrels, and reach the lamb at the top.
//
// A few decisions shape it:
//
//   · It is played in levels. Reaching the lamb clears a level; each level
//     gives three lives, and losing them all replays the same level with the
//     score it started with. Nobody is ever sent back to level one.
//   · Every level is at least as hard as the one before, up to level 25,
//     where everything reaches its ceiling and stays:
//       – from the start: barrels come faster and more often, and more of
//         them take the ladders down;
//       – level 8: fireballs patrol the girders;
//       – level 14: springs bounce along the top and drop straight down;
//       – level 19: crumbling girder sections give way under David's feet
//         a moment after he steps on them, dropping him a floor.
//   · Falling is never a death: David can walk off the end of a girder or
//     through a crumbled section and land on the floor below. Only being hit
//     costs a life.
//   · Jumping over a barrel or a fireball scores, and so does the time left
//     when the lamb is reached.
//   · Everything random comes from a seed kept as a number on the state, so a
//     level can be replayed, a test can try a move on a copy, and every phone
//     in a room race faces the same barrels.
//
// The field is 100 units across and 140 down. Positions are feet: an actor's
// `y` is the girder top it stands on.

export const WIDTH = 100;
export const HEIGHT = 140;

const FLOORS = 6;                 // girders, top (0) to bottom (5)
const FLOOR_Y = (g) => 34 + g * 20;
const SPAN = (g) => (g === FLOORS - 1 ? [4, 96] : g % 2 === 0 ? [4, 88] : [12, 96]);
const GOAL = { x: 82, floor: 0 };  // where the lamb waits
const GIANT_X = 12;
const START = { x: 10, floor: FLOORS - 1 };
const PLAYER = { w: 3.2, h: 7, run: 30, climb: 22, jump: 70, gravity: 250 };
const BARREL_R = 2.5;
const FIRE_R = 2.2;
const SPRING_R = 2.4;
const LADDER_GRAB = 2.6;          // how close to a ladder David must be to climb it
const LIVES = 3;
const BETWEEN = 1.8;
const SHOW_LEVEL = 2.4;
const HIT_PAUSE = 1.2;            // seconds the field freezes after a hit
export const HARDEST = 25;

/** The sounds this game makes, for js/games/chiptune.js. */
export const SOUNDS = {
  jump: [{ type: 'square', from: 400, to: 800, at: 0, dur: 0.1, gain: 0.04 }],
  over: [523, 440, 349, 262].map((hz, i) => ({ type: 'square', from: hz, to: hz, at: i * 0.15, dur: 0.13, gain: 0.05 })),
  hit: [
    { noise: true, cutFrom: 1800, cutTo: 80, at: 0, dur: 0.45, gain: 0.18 },
    { type: 'sawtooth', from: 200, to: 40, at: 0, dur: 0.4, gain: 0.06 },
  ],
  hop: [
    { type: 'triangle', from: 988, to: 988, at: 0, dur: 0.06, gain: 0.07 },
    { type: 'triangle', from: 1319, to: 1319, at: 0.06, dur: 0.1, gain: 0.07 },
  ],
  throw: [{ noise: true, cutFrom: 600, cutTo: 200, at: 0, dur: 0.18, gain: 0.08 }],
  fall: [{ type: 'triangle', from: 700, to: 200, at: 0, dur: 0.3, gain: 0.05 }],
  crumble: [{ noise: true, cutFrom: 2000, cutTo: 300, at: 0, dur: 0.3, gain: 0.08 }],
  level: [523, 659, 784, 1047].map((hz, i) => ({ type: 'square', from: hz, to: hz, at: i * 0.08, dur: 0.1, gain: 0.05 })),
};

/**
 * How hard level `n` is. Every number moves in the harder direction as `n`
 * grows, all the way to HARDEST, and then stays.
 */
export function level(n) {
  const l = Math.min(HARDEST, Math.max(1, Math.trunc(n) || 1));
  return {
    throwEvery: Math.max(1.7, 3.4 - 0.07 * (l - 1)),        // seconds between barrels
    barrel: Math.min(30, 16 + 0.6 * (l - 1)),               // barrel speed, units a second
    ladderChance: Math.min(0.4, 0.1 + 0.0125 * (l - 1)),    // share of barrels that take a ladder down
    fireballs: l >= 8 ? Math.min(3, 1 + Math.floor((l - 8) / 6)) : 0,
    fireSpeed: l >= 8 ? Math.min(14, 7 + 0.4 * (l - 8)) : 0,
    springEvery: l >= 14 ? Math.max(4, 8 - 0.35 * (l - 14)) : 0,   // seconds between springs
    crumbles: l >= 19 ? Math.min(3, 1 + Math.floor((l - 19) / 3)) : 0,
    time: Math.max(60, 90 - 1.25 * (l - 1)),                 // seconds on the bonus clock
  };
}

/** The next float in [0, 1) from the state's seed. */
function random(state) {
  state.seed = (state.seed * 16807) % 2147483647;
  return (state.seed - 1) / 2147483646;
}

function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }

/** The floor index a girder top is at, or -1. */
function floorAt(y) {
  for (let g = 0; g < FLOORS; g++) if (Math.abs(FLOOR_Y(g) - y) < 0.01) return g;
  return -1;
}

/** Whether there is solid girder at `x` on floor `g` — inside its span and not crumbled. */
export function solid(state, g, x) {
  const [left, right] = SPAN(g);
  if (x < left || x > right) return false;
  return !state.crumbles.some((c) => c.floor === g && c.gone > 0 && x >= c.x && x <= c.x + c.w);
}

/**
 * A run, parked until the first press. It starts on level one unless told
 * otherwise: `{ level, score }` picks up at that level with that score.
 */
export function create(seed = 1, { level: from = 1, score = 0 } = {}) {
  const state = {
    seed: (Math.abs(Math.trunc(seed) || 1) % 2147483646) + 1,
    height: HEIGHT,
    time: 0,
    level: 0,
    score: Math.max(0, Math.trunc(score) || 0),
    started: false,
    over: false,
    rest: 0,
    pause: 0,
    showLevel: 0,
  };
  startLevel(state, Math.max(1, Math.trunc(from) || 1));
  return state;
}

function startLevel(state, n) {
  state.level = n;
  state.config = level(n);
  state.lives = LIVES;
  state.levelScore = state.score;
  state.showLevel = SHOW_LEVEL;
  // Two ladders between each pair of floors, never at a girder's open end
  // and never right under the one above, so the climb zig-zags.
  state.ladders = [];
  for (let g = 0; g < FLOORS - 1; g++) {
    const [left, right] = SPAN(g);
    const [bLeft, bRight] = SPAN(g + 1);
    const lo = Math.max(left, bLeft) + 6;
    const hi = Math.min(right, bRight) - 6;
    const first = lo + random(state) * (hi - lo) * 0.4;
    const second = hi - random(state) * (hi - lo) * 0.4;
    state.ladders.push({ x: first, top: g, bottom: g + 1 }, { x: second, top: g, bottom: g + 1 });
  }
  // Crumbling sections sit away from the ladders, on the middle floors.
  state.crumbles = [];
  for (let i = 0; i < state.config.crumbles; i++) {
    const g = 1 + ((i * 2) % (FLOORS - 2));
    const [left, right] = SPAN(g);
    let x = left + 8 + random(state) * (right - left - 26);
    for (const ladder of state.ladders) {
      if ((ladder.top === g || ladder.bottom === g) && Math.abs(ladder.x - (x + 5)) < 9) x = clamp(ladder.x + 10, left + 4, right - 14);
    }
    state.crumbles.push({ floor: g, x, w: 10, stood: 0, gone: 0 });
  }
  resetRound(state);
}

/** Back to the bottom, the field cleared — after a hit, and at a level's start. */
function resetRound(state) {
  state.player = { x: START.x, y: FLOOR_Y(START.floor), vx: 0, vy: 0, ground: true, ladder: null, face: 1, airborne: 0 };
  state.barrels = [];
  state.springs = [];
  state.fires = Array.from({ length: state.config.fireballs }, (_, i) => {
    const g = 1 + ((i * 2 + 1) % (FLOORS - 2));
    const [left, right] = SPAN(g);
    return { floor: g, x: left + (right - left) * (0.3 + 0.4 * random(state)), dir: i % 2 ? 1 : -1, jumped: false };
  });
  state.throwClock = 1.2;
  state.springClock = state.config.springEvery;
  state.clock = state.config.time;
  for (const c of state.crumbles) { c.stood = 0; c.gone = 0; }
}

/** The ladder David could climb from where he stands (`dir` −1 up, +1 down), or null. */
function ladderNear(state, dir) {
  const p = state.player;
  const g = floorAt(p.y);
  if (g < 0) return null;
  return state.ladders.find((l) => Math.abs(l.x - p.x) <= LADDER_GRAB && (dir < 0 ? l.bottom === g : l.top === g)) || null;
}

/**
 * Advance the game by `dt` seconds. `input` is what is held now:
 * `{ left, right, up, down, jump }`. Any press starts the run.
 */
export function step(state, input = {}, dt = 1 / 60) {
  const events = [];
  if (state.over) return events;
  const across = Boolean(input.right) - Boolean(input.left);
  const climb = Boolean(input.down) - Boolean(input.up);
  if (!state.started) {
    if (!across && !climb && !input.jump) return events;
    state.started = true;
    events.push('start');
  }
  dt = Math.min(dt, 0.05);
  state.time += dt;
  state.showLevel = Math.max(0, state.showLevel - dt);

  if (state.rest > 0) {
    state.rest = Math.max(0, state.rest - dt);
    if (state.rest === 0) { startLevel(state, state.level + 1); events.push('next'); }
    return events;
  }
  if (state.pause > 0) {
    state.pause = Math.max(0, state.pause - dt);
    if (state.pause === 0) {
      if (state.lives <= 0) { state.over = true; events.push('over'); }
      else resetRound(state);
    }
    return events;
  }

  const config = state.config;
  state.clock = Math.max(0, state.clock - dt);
  movePlayer(state, { across, climb, jump: Boolean(input.jump) }, dt, events);
  moveBarrels(state, dt, events);
  moveFires(state, dt);
  moveSprings(state, dt);
  crumble(state, dt, events);

  // The giant throws.
  state.throwClock -= dt;
  if (state.throwClock <= 0) {
    state.throwClock = config.throwEvery * (0.8 + random(state) * 0.4);
    state.barrels.push({ x: GIANT_X + 6, y: FLOOR_Y(0), floor: 0, dir: 1, vy: 0, mode: 'roll', spin: 0, jumped: false, ladder: null });
    events.push('throw');
  }
  if (config.springEvery) {
    state.springClock -= dt;
    if (state.springClock <= 0) {
      state.springClock = config.springEvery;
      // Each spring drops at its own column, picked from the seed.
      state.springs.push({ x: GIANT_X + 6, y: FLOOR_Y(0), vy: -40, dropX: 30 + random(state) * 40, mode: 'hop', jumped: false });
    }
  }

  // What hit David — and what he jumped.
  const p = state.player;
  const body = { x: p.x, y: p.y - PLAYER.h / 2 };
  const hazards = [
    ...state.barrels.map((one) => ({ one, x: one.x, y: one.y - BARREL_R, r: BARREL_R })),
    ...state.fires.map((one) => ({ one, x: one.x, y: FLOOR_Y(one.floor) - FIRE_R, r: FIRE_R })),
    ...state.springs.map((one) => ({ one, x: one.x, y: one.y - SPRING_R, r: SPRING_R })),
  ];
  for (const h of hazards) {
    const dx = Math.abs(h.x - body.x);
    const dy = Math.abs(h.y - body.y);
    // A fair hit: the shapes have to really overlap, not just touch.
    if (dx < h.r + PLAYER.w / 2 - 1.2 && dy < h.r + PLAYER.h / 2 - 0.6) {
      state.lives -= 1;
      state.pause = HIT_PAUSE;
      events.push('hit');
      return events;
    }
    // Clearing one in the air, close above it, scores once.
    if (!p.ground && !p.ladder && !h.one.jumped && dx < 2 && p.y < h.y - h.r + 0.5 && p.y > h.y - h.r - 12) {
      h.one.jumped = true;
      state.score += 100;
      events.push('hop');
    }
  }

  // The lamb.
  if (floorAt(p.y) === GOAL.floor && p.ground && p.x >= GOAL.x - 3) {
    state.score += 500 + Math.round(state.clock) * 10;
    state.rest = BETWEEN;
    events.push('level');
  }
  return events;
}

function movePlayer(state, input, dt, events) {
  const p = state.player;
  if (p.ladder) {
    // On a ladder: up and down only, and off at either end.
    const ladder = p.ladder;
    p.y = clamp(p.y + input.climb * PLAYER.climb * dt, FLOOR_Y(ladder.top), FLOOR_Y(ladder.bottom));
    p.x = ladder.x;
    if (p.y === FLOOR_Y(ladder.top) && input.climb < 0) { p.ladder = null; p.ground = true; }
    else if (p.y === FLOOR_Y(ladder.bottom) && input.climb > 0) { p.ladder = null; p.ground = true; }
    return;
  }
  if (p.ground) {
    // Onto a ladder?
    if (input.climb) {
      const ladder = ladderNear(state, input.climb);
      if (ladder) { p.ladder = ladder; p.x = ladder.x; p.vx = 0; return; }
    }
    p.vx = input.across * PLAYER.run;
    if (input.across) p.face = input.across;
    if (input.jump) { p.vy = -PLAYER.jump; p.ground = false; p.airborne = 0; events.push('jump'); }
  }
  p.x = clamp(p.x + p.vx * dt, 4, WIDTH - 4);
  if (p.ground) {
    const g = floorAt(p.y);
    if (!solid(state, g, p.x)) { p.ground = false; p.vy = 0; p.airborne = 0; events.push('fall'); }
    return;
  }
  // In the air: fall, and land on the first solid girder below the feet.
  const before = p.y;
  p.airborne += dt;
  p.vy += PLAYER.gravity * dt;
  p.y += p.vy * dt;
  if (p.vy > 0) {
    for (let g = 0; g < FLOORS; g++) {
      const top = FLOOR_Y(g);
      if (before <= top && p.y >= top && solid(state, g, p.x)) {
        p.y = top;
        p.vy = 0;
        p.ground = true;
        if (!input.across) p.vx = 0;
        break;
      }
    }
  }
  if (p.y > HEIGHT + 10) { p.y = FLOOR_Y(FLOORS - 1); p.ground = true; }
}

function moveBarrels(state, dt) {
  const config = state.config;
  for (const b of state.barrels) {
    b.spin += dt * b.dir * config.barrel / BARREL_R;
    if (b.mode === 'roll') {
      b.x += b.dir * config.barrel * dt;
      // Down a ladder, sometimes — decided once, as it reaches the top of one.
      const ladder = state.ladders.find((l) => l.top === b.floor && Math.abs(l.x - b.x) < config.barrel * dt + 0.01 && l !== b.passed);
      if (ladder) {
        b.passed = ladder;
        if (random(state) < config.ladderChance) { b.mode = 'ladder'; b.x = ladder.x; b.ladder = ladder; continue; }
      }
      if (!solid(state, b.floor, b.x)) { b.mode = 'fall'; b.vy = 0; }
    } else if (b.mode === 'ladder') {
      b.y += config.barrel * 0.8 * dt;
      if (b.y >= FLOOR_Y(b.ladder.bottom)) {
        b.floor = b.ladder.bottom;
        b.y = FLOOR_Y(b.floor);
        b.mode = 'roll';
        b.dir = b.floor % 2 === 0 ? 1 : -1;
        b.passed = null;
      }
    } else if (b.mode === 'fall') {
      b.vy += 200 * dt;
      b.y += b.vy * dt;
      b.x += b.dir * config.barrel * 0.3 * dt;
      const below = b.floor + 1;
      if (below < FLOORS && b.y >= FLOOR_Y(below)) {
        b.floor = below;
        b.y = FLOOR_Y(below);
        b.mode = 'roll';
        b.dir = -b.dir;
        b.passed = null;
      }
    }
  }
  state.barrels = state.barrels.filter((b) => b.y < HEIGHT + 6 && b.x > -6 && b.x < WIDTH + 6);
}

function moveFires(state, dt) {
  const speed = state.config.fireSpeed;
  for (const f of state.fires) {
    f.x += f.dir * speed * dt;
    const [left, right] = SPAN(f.floor);
    if (f.x < left + 3) { f.x = left + 3; f.dir = 1; f.jumped = false; }
    if (f.x > right - 3) { f.x = right - 3; f.dir = -1; f.jumped = false; }
  }
}

function moveSprings(state, dt) {
  for (const s of state.springs) {
    if (s.mode === 'hop') {
      // Bounding along the top girder until its drop column.
      s.x += 26 * dt;
      s.vy += 300 * dt;
      s.y += s.vy * dt;
      if (s.y >= FLOOR_Y(0)) { s.y = FLOOR_Y(0); s.vy = -40; }
      if (s.x >= s.dropX) { s.x = s.dropX; s.mode = 'drop'; s.vy = 20; }
    } else {
      s.vy = Math.min(70, s.vy + 160 * dt);
      s.y += s.vy * dt;
    }
  }
  state.springs = state.springs.filter((s) => s.y < HEIGHT + 8);
}

function crumble(state, dt, events) {
  const p = state.player;
  const g = floorAt(p.y);
  for (const c of state.crumbles) {
    if (c.gone > 0) { c.gone = Math.max(0, c.gone - dt); continue; }
    const on = p.ground && g === c.floor && p.x >= c.x && p.x <= c.x + c.w;
    if (on) {
      c.stood += dt;
      if (c.stood >= 0.7) { c.gone = 5; c.stood = 0; events.push('crumble'); }
    } else c.stood = Math.max(0, c.stood - dt);
  }
}

// ── Drawing ────────────────────────────────────────────────────────────────
//
// The poster system in a tower: paper behind, flat palette fills, one navy
// outline. `colors` is the palette read out of the stylesheet by the screen.

function caption(g, text, colors, y, size = 7) {
  g.fillStyle = colors.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 ${size}px Inter, system-ui, sans-serif`;
  g.fillText(text, WIDTH / 2, y);
}

function drawGirder(g, state, floor, colors) {
  const [left, right] = SPAN(floor);
  const y = FLOOR_Y(floor);
  const pieces = [[left, right]];
  for (const c of state.crumbles.filter((one) => one.floor === floor)) {
    // Cut the crumbling section out, and draw it on its own.
    for (let i = 0; i < pieces.length; i++) {
      const [a, b] = pieces[i];
      if (c.x > a && c.x + c.w < b) { pieces.splice(i, 1, [a, c.x], [c.x + c.w, b]); break; }
    }
  }
  g.fillStyle = colors.poppy;
  for (const [a, b] of pieces) {
    g.fillRect(a, y, b - a, 3);
    g.strokeRect(a, y, b - a, 3);
    g.save();
    g.lineWidth /= 2;
    g.beginPath();
    for (let x = a + 4; x < b - 1; x += 4) { g.moveTo(x, y); g.lineTo(x + 2, y + 3); }
    g.stroke();
    g.restore();
  }
  for (const c of state.crumbles.filter((one) => one.floor === floor)) {
    if (c.gone > 0) continue;
    const shake = c.stood > 0 ? Math.sin(state.time * 60) * 0.4 : 0;
    g.fillStyle = colors.sunshine;
    g.fillRect(c.x, y + shake, c.w, 3);
    g.strokeRect(c.x, y + shake, c.w, 3);
    g.beginPath();
    g.moveTo(c.x + 3, y + shake); g.lineTo(c.x + 5, y + 3 + shake); g.lineTo(c.x + 7, y + shake);
    g.stroke();
  }
}

function drawLadder(g, ladder) {
  const top = FLOOR_Y(ladder.top);
  const bottom = FLOOR_Y(ladder.bottom);
  g.beginPath();
  g.moveTo(ladder.x - 2, top); g.lineTo(ladder.x - 2, bottom);
  g.moveTo(ladder.x + 2, top); g.lineTo(ladder.x + 2, bottom);
  for (let y = top + 3; y < bottom; y += 3.5) { g.moveTo(ladder.x - 2, y); g.lineTo(ladder.x + 2, y); }
  g.stroke();
}

function drawGiant(g, state, colors) {
  const y = FLOOR_Y(0);
  const lift = Math.max(0, 0.6 - state.throwClock) * 4;   // winds up before a throw
  g.save();
  g.translate(GIANT_X, y);
  g.fillStyle = colors.captain;
  g.fillRect(-6, -16, 12, 13);              // body
  g.strokeRect(-6, -16, 12, 13);
  g.fillRect(-5, -3, 4, 3); g.strokeRect(-5, -3, 4, 3);   // legs
  g.fillRect(1, -3, 4, 3); g.strokeRect(1, -3, 4, 3);
  g.beginPath();                             // head
  g.arc(0, -20, 5, 0, Math.PI * 2);
  g.fillStyle = colors.rose;
  g.fill();
  g.stroke();
  g.beginPath();                             // helmet
  g.arc(0, -21, 5.2, Math.PI, 0);
  g.fillStyle = colors.sunshine;
  g.fill();
  g.stroke();
  g.beginPath();                             // arms, raised to throw
  g.moveTo(-6, -13); g.lineTo(-9, -17 - lift);
  g.moveTo(6, -13); g.lineTo(9, -17 - lift);
  g.stroke();
  g.restore();
}

function drawLamb(g, colors, time) {
  const x = GOAL.x + 6;
  const y = FLOOR_Y(GOAL.floor);
  const bob = Math.sin(time * 4) * 0.5;
  g.save();
  g.translate(x, y + bob);
  g.fillStyle = colors.paper;
  for (const [cx, cy] of [[-2.5, -5], [0, -6], [2.5, -5], [0, -4]]) { g.beginPath(); g.arc(cx, cy, 2.6, 0, Math.PI * 2); g.fill(); g.stroke(); }
  g.beginPath();
  g.ellipse(4.6, -6.4, 1.7, 1.4, 0, 0, Math.PI * 2);
  g.fillStyle = colors.ink;
  g.fill();
  g.beginPath();
  g.moveTo(-2, -2); g.lineTo(-2, 0); g.moveTo(2, -2); g.lineTo(2, 0);
  g.stroke();
  g.restore();
}

function drawDavid(g, p, colors, time) {
  g.save();
  g.translate(p.x, p.y);
  const step = p.ground && p.vx ? Math.sin(time * 18) * 1.2 : 0;
  g.beginPath();                              // legs
  g.moveTo(-0.8, -2.5); g.lineTo(-0.8 - step, 0);
  g.moveTo(0.8, -2.5); g.lineTo(0.8 + step, 0);
  g.stroke();
  g.fillStyle = colors.sky;                   // tunic
  g.beginPath();
  g.moveTo(-2, -2.5); g.lineTo(2, -2.5); g.lineTo(1.4, -6); g.lineTo(-1.4, -6); g.closePath();
  g.fill();
  g.stroke();
  g.beginPath();                              // head
  g.arc(0, -7.6, 1.7, 0, Math.PI * 2);
  g.fillStyle = colors.rose;
  g.fill();
  g.stroke();
  if (!p.ladder) {                            // the sling, held out the way he faces
    g.beginPath();
    g.moveTo(p.face * 1.4, -5); g.lineTo(p.face * 3.4, -4);
    g.stroke();
  }
  g.restore();
}

/** Paint the whole tower. `scale` is canvas pixels per field unit, `edge` the outline in canvas pixels. */
export function paint(g, state, { colors, scale, edge }) {
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.fillStyle = colors.paper;
  g.fillRect(0, 0, WIDTH, HEIGHT);
  g.lineWidth = edge / scale;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = colors.ink;

  for (const ladder of state.ladders) drawLadder(g, ladder);
  for (let floor = 0; floor < FLOORS; floor++) drawGirder(g, state, floor, colors);
  drawGiant(g, state, colors);
  drawLamb(g, colors, state.time);

  // Barrels: poppy wood, two navy hoops, rolling.
  for (const b of state.barrels) {
    g.save();
    g.translate(b.x, b.y - BARREL_R);
    g.rotate(b.spin);
    g.beginPath();
    g.arc(0, 0, BARREL_R, 0, Math.PI * 2);
    g.fillStyle = colors.poppy;
    g.fill();
    g.stroke();
    g.beginPath();
    g.moveTo(-BARREL_R * 0.6, -BARREL_R * 0.8); g.lineTo(-BARREL_R * 0.6, BARREL_R * 0.8);
    g.moveTo(BARREL_R * 0.6, -BARREL_R * 0.8); g.lineTo(BARREL_R * 0.6, BARREL_R * 0.8);
    g.stroke();
    g.restore();
  }
  // Fireballs: a sunshine flame that flickers.
  for (const f of state.fires) {
    const x = f.x;
    const y = FLOOR_Y(f.floor);
    const flick = Math.sin(state.time * 20 + x) * 0.6;
    g.beginPath();
    g.moveTo(x - FIRE_R, y);
    g.quadraticCurveTo(x - FIRE_R, y - FIRE_R * 2, x + flick, y - FIRE_R * 2.6);
    g.quadraticCurveTo(x + FIRE_R, y - FIRE_R * 2, x + FIRE_R, y);
    g.closePath();
    g.fillStyle = colors.sunshine;
    g.fill();
    g.stroke();
  }
  // Springs: a sky coil.
  for (const s of state.springs) {
    g.save();
    g.translate(s.x, s.y);
    g.fillStyle = colors.sky;
    g.fillRect(-SPRING_R, -SPRING_R * 2, SPRING_R * 2, SPRING_R * 2);
    g.strokeRect(-SPRING_R, -SPRING_R * 2, SPRING_R * 2, SPRING_R * 2);
    g.beginPath();
    g.moveTo(-SPRING_R, -SPRING_R * 1.4); g.lineTo(SPRING_R, -SPRING_R * 1.1);
    g.moveTo(-SPRING_R, -SPRING_R * 0.8); g.lineTo(SPRING_R, -SPRING_R * 0.5);
    g.stroke();
    g.restore();
  }

  const blink = state.pause > 0 && Math.floor(state.pause * 8) % 2 === 0;
  if (!blink) drawDavid(g, state.player, colors, state.time);

  // The numbers that belong in the tower.
  g.fillStyle = colors.ink;
  g.textBaseline = 'alphabetic';
  g.font = '800 4px Inter, system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText(`${'♥'.repeat(Math.max(0, state.lives))}`, 3, 7);
  g.textAlign = 'right';
  g.fillText(`BONUS ${Math.round(state.clock) * 10}`, WIDTH - 3, 7);

  const middle = HEIGHT * 0.5;
  if (state.rest > 0) {
    caption(g, 'THE LAMB IS SAFE!', colors, middle, 6.5);
    caption(g, `NEXT: LEVEL ${state.level + 1}`, colors, middle + 9, 5);
  } else if (state.pause > 0) {
    caption(g, state.lives > 0 ? `OUCH! ${state.lives} ${state.lives === 1 ? 'LIFE' : 'LIVES'} LEFT` : 'OUT OF LIVES', colors, middle, 5.5);
  } else if (!state.started || state.showLevel > 0) {
    caption(g, `LEVEL ${state.level}`, colors, middle - 6);
    caption(g, 'CLIMB TO THE LAMB!', colors, middle + 3, 5);
    if (!state.started) caption(g, 'RUN · CLIMB · JUMP THE BARRELS', colors, middle + 11, 4.2);
  }
}
