// Monkey Climb: a vine-climbing arcade game, with no DOM in it.
//
// Papa monkey has been shut in a cage at the top of the jungle, and the key
// hangs at the far end of the top branch. The little monkey starts on the
// jungle floor and climbs the vines to fetch it — dodging the snapping
// lizards that crawl down the vines, the birds that swoop across, and later
// the lizards that patrol the branches and coconuts that fall from the top.
//
// A few decisions shape it:
//
//   · Climbing is the game. Holding one vine, the monkey climbs slowly and
//     slides down fast; holding two side by side, it climbs fast and slides
//     slowly. Pushing toward a vine's partner grabs both; pushing away jumps
//     off, and a jump can catch the next vine in mid-air.
//   · Fruit hangs on some vines. Touching one knocks it loose, and it falls
//     straight down, knocking off every lizard or bird it hits for points.
//   · It is played in levels. Reaching the key clears a level; each level
//     gives three lives, and losing them all replays the same level with the
//     score it started with. Nobody is ever sent back to level one.
//   · Falling is never a death: the jungle floor runs the whole width, so a
//     slip off a vine only sends the monkey back down. Only being hit costs
//     a life.
//   · Every level is at least as hard as the one before, up to level 25,
//     where everything reaches its ceiling and stays:
//       – from the start: lizards come faster and more often, more of them
//         come down the monkey's own vine, more crawl back up instead of
//         dropping off, and there is less fruit;
//       – level 7: birds swoop across the jungle;
//       – level 13: lizards patrol the branches too;
//       – level 19: coconuts drop from the top, with a shadow to warn first.
//   · Everything random comes from a seed kept as a number on the state, so a
//     level can be replayed, a test can try a move on a copy, and every phone
//     in a room race meets the same lizards.
//
// The field is 100 units across and 140 down. An actor's `y` is its feet.

export const WIDTH = 100;
export const HEIGHT = 140;
export const HARDEST = 25;

/** The branches: a top y and an x span. The first is the jungle floor. */
export const LEDGES = [
  { y: 134, x1: 0, x2: 100 },     // the jungle floor
  { y: 104, x1: 62, x2: 98 },     // a branch on the right
  { y: 70, x1: 38, x2: 60 },      // a branch in the middle
  { y: 26, x1: 20, x2: 98 },      // the top branch, where the key is
];
/** The vines: an x, and the span they hang over. Two close together are a pair. */
export const VINES = [
  { x: 24, top: 30, bottom: 120 },
  { x: 29, top: 30, bottom: 120 },
  { x: 44, top: 74, bottom: 124 },
  { x: 54, top: 30, bottom: 64 },
  { x: 66, top: 30, bottom: 98 },
  { x: 71, top: 30, bottom: 98 },
  { x: 88, top: 30, bottom: 98 },
];
const PAIR = 5.5;                 // vines this close are held together
const KEY = { x: 93, y: 26 };
const CAGE = { x: 10, y: 26 };
const START = { x: 8, y: 134 };
const MONKEY = { w: 3.4, h: 6, run: 26, jump: 66, gravity: 240, reach: 2.6 };
const CLIMB = { one: { up: 13, down: 30 }, two: { up: 24, down: 14 } };
const HANG = 6;                   // feet below the hands, on a vine
const LIZARD_R = 2.2;
const BIRD_R = 2.4;
const NUT_R = 2;
const FRUIT_R = 2.2;
const LIVES = 3;
const BETWEEN = 1.8;
const SHOW_LEVEL = 2.4;
const HIT_PAUSE = 1.2;

/** The sounds this game makes, for js/games/chiptune.js. */
export const SOUNDS = {
  jump: [{ type: 'square', from: 420, to: 820, at: 0, dur: 0.1, gain: 0.04 }],
  grab: [{ type: 'triangle', from: 600, to: 700, at: 0, dur: 0.05, gain: 0.05 }],
  fruit: [{ type: 'triangle', from: 900, to: 300, at: 0, dur: 0.3, gain: 0.06 }],
  bonk: [
    { type: 'square', from: 1200, to: 1200, at: 0, dur: 0.06, gain: 0.06 },
    { type: 'square', from: 1600, to: 1600, at: 0.06, dur: 0.1, gain: 0.06 },
  ],
  hit: [
    { noise: true, cutFrom: 1800, cutTo: 80, at: 0, dur: 0.45, gain: 0.18 },
    { type: 'sawtooth', from: 220, to: 40, at: 0, dur: 0.4, gain: 0.06 },
  ],
  level: [523, 659, 784, 1047].map((hz, i) => ({ type: 'square', from: hz, to: hz, at: i * 0.08, dur: 0.1, gain: 0.05 })),
  over: [523, 440, 349, 262].map((hz, i) => ({ type: 'square', from: hz, to: hz, at: i * 0.15, dur: 0.13, gain: 0.05 })),
};

/**
 * How hard level `n` is. Every number moves in the harder direction as `n`
 * grows, all the way to HARDEST, and then stays.
 */
export function level(n) {
  const l = Math.min(HARDEST, Math.max(1, Math.trunc(n) || 1));
  return {
    lizardEvery: Math.max(1.6, 3 - 0.058 * (l - 1)),       // seconds between lizards
    lizardSpeed: Math.min(20, 12 + 0.34 * (l - 1)),         // units a second
    patrol: Math.min(0.5, 0.15 + 0.015 * (l - 1)),          // share that crawl back up instead of dropping off
    maxLizards: Math.min(6, 3 + Math.floor((l - 1) / 6)),  // most on the vines at once
    aim: Math.min(0.55, 0.3 + 0.0105 * (l - 1)),           // share sent down the vine nearest the monkey
    fruit: Math.max(2, 4 - Math.floor((l - 1) / 8)),       // fruit hanging on the vines
    birdEvery: l >= 7 ? Math.max(3, 5 - 0.112 * (l - 7)) : 0,
    birdSpeed: l >= 7 ? Math.min(32, 18 + 0.8 * (l - 7)) : 0,
    crawlers: l >= 13 ? Math.min(3, 1 + Math.floor((l - 13) / 4)) : 0,
    nutEvery: l >= 19 ? Math.max(3.6, 6 - 0.4 * (l - 19)) : 0,
    time: Math.max(60, 90 - 1.25 * (l - 1)),
  };
}

/** The next float in [0, 1) from the state's seed. */
function random(state) {
  state.seed = (state.seed * 16807) % 2147483647;
  return (state.seed - 1) / 2147483646;
}

function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }

/** The vine paired with this one, if there is one. Vines are kept by number, so a copied state still works. */
const partner = (vine) => VINES.find((other) => other.x !== vine.x && Math.abs(other.x - vine.x) <= PAIR) || null;
/** The ledge whose top is at `y` and spans `x`, or null. */
const ledgeAt = (y, x) => LEDGES.find((l) => Math.abs(l.y - y) < 0.01 && x >= l.x1 && x <= l.x2) || null;

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
    jumpWas: false,
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
  resetRound(state);
}

/** Back to the jungle floor with the field cleared — after a hit, and at a level's start. */
function resetRound(state) {
  const config = state.config;
  state.monkey = { x: START.x, y: START.y, vx: 0, vy: 0, mode: 'ground', vine: null, two: false, face: 1, letGo: null, letGoClock: 0 };
  state.lizards = [];
  state.birds = [];
  state.nuts = [];
  // Fruit on vines that reach high, at a spread of heights, from the seed.
  const tall = VINES.filter((v) => v.bottom - v.top > 50);
  state.fruit = Array.from({ length: config.fruit }, (_, i) => {
    const vine = tall[(i * 2 + Math.floor(random(state) * 2)) % tall.length];
    return { x: vine.x, y: vine.top + 12 + random(state) * 18, vy: 0, falling: false, chain: 0 };
  });
  state.crawlers = Array.from({ length: config.crawlers }, (_, i) => {
    const ledge = LEDGES[1 + (i % 3)];
    return { ledge: LEDGES.indexOf(ledge), x: ledge.x1 + (ledge.x2 - ledge.x1) * (0.3 + 0.4 * random(state)), dir: i % 2 ? 1 : -1, bonked: false };
  });
  state.lizardClock = 1.5;
  state.birdClock = config.birdEvery ? config.birdEvery * 0.6 : 0;
  state.nutClock = config.nutEvery ? config.nutEvery : 0;
  state.clock = config.time;
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
  const jump = Boolean(input.jump) && !state.jumpWas;    // a jump is a press, not a hold
  state.jumpWas = Boolean(input.jump);
  if (!state.started) {
    if (!across && !climb && !jump) return events;
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

  state.clock = Math.max(0, state.clock - dt);
  moveMonkey(state, { across, climb, jump }, dt, events);
  moveLizards(state, dt);
  moveBirds(state, dt);
  moveNuts(state, dt);
  moveCrawlers(state, dt);
  moveFruit(state, dt, events);
  spawn(state, dt);

  // What hit the monkey.
  const m = state.monkey;
  const body = { x: m.x, y: m.y - MONKEY.h / 2 };
  const hazards = [
    // A lizard that has dropped off its vine is tumbling away, and harmless.
    ...state.lizards.filter((one) => !one.falling).map((one) => ({ x: one.x, y: one.y, r: LIZARD_R })),
    ...state.birds.map((one) => ({ x: one.x, y: one.y, r: BIRD_R })),
    ...state.nuts.filter((one) => one.falling).map((one) => ({ x: one.x, y: one.y, r: NUT_R })),
    ...state.crawlers.filter((one) => !one.bonked).map((one) => ({ x: one.x, y: LEDGES[one.ledge].y - LIZARD_R, r: LIZARD_R })),
  ];
  for (const h of hazards) {
    if (Math.abs(h.x - body.x) < h.r + MONKEY.w / 2 - 1 && Math.abs(h.y - body.y) < h.r + MONKEY.h / 2 - 0.8) {
      state.lives -= 1;
      state.pause = HIT_PAUSE;
      events.push('hit');
      return events;
    }
  }

  // The key.
  if (m.mode === 'ground' && Math.abs(m.y - KEY.y) < 0.01 && m.x >= KEY.x - 3) {
    state.score += 500 + Math.round(state.clock) * 10;
    state.rest = BETWEEN;
    events.push('level');
  }
  return events;
}

function moveMonkey(state, input, dt, events) {
  const m = state.monkey;
  if (input.across) m.face = input.across;
  m.letGoClock = Math.max(0, m.letGoClock - dt);

  if (m.mode === 'vine') {
    const vine = VINES[m.vine];
    const mate = partner(vine);
    // Toward the partner vine grabs both; away from it lets go of it.
    if (input.across && mate) {
      const toward = Math.sign(mate.x - vine.x) === input.across;
      if (toward && !m.two) { m.two = true; events.push('grab'); }
      else if (!toward && m.two) { m.two = false; }
      else if (!toward && !m.two) return jumpOff(m, input.across, events);
    } else if (input.across && !mate) return jumpOff(m, input.across, events);
    if (input.jump) return jumpOff(m, m.face, events);

    const speeds = m.two ? CLIMB.two : CLIMB.one;
    const top = Math.max(vine.top, m.two ? mate.top : vine.top) + HANG;
    const bottom = (m.two ? Math.min(vine.bottom, mate.bottom) : vine.bottom) + HANG;
    m.x = m.two ? (vine.x + mate.x) / 2 : vine.x;
    m.y = clamp(m.y + (input.climb < 0 ? -speeds.up : input.climb > 0 ? speeds.down : 0) * dt, top, bottom);
    if (input.climb < 0 && m.y === top) {
      // Up onto the branch above the vine, if there is one.
      const ledge = ledgeAt(vine.top - 4, m.x);
      if (ledge) { m.mode = 'ground'; m.y = ledge.y; m.vine = null; m.two = false; }
    } else if (input.climb > 0 && m.y === bottom) {
      m.mode = 'air'; m.vy = 0; m.vx = 0; m.letGo = m.vine; m.letGoClock = 0.3; m.vine = null; m.two = false;
    }
    return;
  }

  if (m.mode === 'ground') {
    // Up a vine that hangs within reach overhead.
    if (input.climb < 0) {
      const vine = VINES.find((v) => Math.abs(v.x - m.x) <= MONKEY.reach && v.bottom + HANG >= m.y - 10 && v.top + HANG <= m.y);
      if (vine) {
        m.mode = 'vine'; m.vine = VINES.indexOf(vine); m.two = false; m.vx = 0;
        m.y = Math.min(m.y, vine.bottom + HANG);
        events.push('grab');
        return;
      }
    }
    // Down onto a vine that hangs from the branch.
    if (input.climb > 0) {
      const vine = VINES.find((v) => Math.abs(v.x - m.x) <= MONKEY.reach && Math.abs(v.top - 4 - m.y) < 0.01);
      if (vine) { m.mode = 'vine'; m.vine = VINES.indexOf(vine); m.two = false; m.y = vine.top + HANG; events.push('grab'); return; }
    }
    m.vx = input.across * MONKEY.run;
    if (input.jump) { m.mode = 'air'; m.vy = -MONKEY.jump; m.vx = input.across * MONKEY.run; events.push('jump'); return; }
    m.x = clamp(m.x + m.vx * dt, 3, WIDTH - 3);
    if (!LEDGES.some((l) => Math.abs(l.y - m.y) < 0.01 && m.x >= l.x1 && m.x <= l.x2)) { m.mode = 'air'; m.vy = 0; }
    return;
  }

  // In the air: fall, catch a vine on the way past, or land on a branch.
  const before = m.y;
  m.vy += MONKEY.gravity * dt;
  m.x = clamp(m.x + m.vx * dt, 3, WIDTH - 3);
  m.y += m.vy * dt;
  for (const [index, vine] of VINES.entries()) {
    if (index === m.letGo && m.letGoClock > 0) continue;
    if (Math.abs(vine.x - m.x) <= 1.6 && m.y >= vine.top + HANG && m.y <= vine.bottom + HANG + 2) {
      m.mode = 'vine'; m.vine = index; m.two = false; m.vx = 0; m.vy = 0;
      m.y = clamp(m.y, vine.top + HANG, vine.bottom + HANG);
      events.push('grab');
      return;
    }
  }
  if (m.vy > 0) {
    for (const l of LEDGES) {
      if (before <= l.y && m.y >= l.y && m.x >= l.x1 && m.x <= l.x2) {
        m.mode = 'ground'; m.y = l.y; m.vy = 0; m.vx = 0;
        return;
      }
    }
  }
}

function jumpOff(m, dir, events) {
  m.letGo = m.vine;
  m.letGoClock = 0.3;
  m.mode = 'air';
  m.vine = null;
  m.two = false;
  m.vx = dir * 34;                  // far enough to reach the next vine along
  m.vy = -30;
  m.face = dir;
  events.push('jump');
}

function spawn(state, dt) {
  const config = state.config;
  state.lizardClock -= dt;
  if (state.lizardClock <= 0 && state.lizards.filter((z) => !z.falling && !z.gone).length >= config.maxLizards) state.lizardClock = 0.5;
  if (state.lizardClock <= 0) {
    state.lizardClock = config.lizardEvery * (0.75 + random(state) * 0.5);
    const tall = VINES.filter((v) => v.top <= 30);
    // Some come down the vine nearest the monkey; the rest anywhere.
    const nearest = [...tall].sort((a, b) => Math.abs(a.x - state.monkey.x) - Math.abs(b.x - state.monkey.x))[0];
    const vine = random(state) < config.aim ? nearest : tall[Math.floor(random(state) * tall.length)];
    state.lizards.push({ vine: VINES.indexOf(vine), x: vine.x, y: vine.top, dir: 1, patrol: random(state) < config.patrol, falling: false, vy: 0 });
  }
  if (config.birdEvery) {
    state.birdClock -= dt;
    if (state.birdClock <= 0) {
      state.birdClock = config.birdEvery * (0.8 + random(state) * 0.4);
      const fromLeft = random(state) < 0.5;
      state.birds.push({ x: fromLeft ? -4 : WIDTH + 4, base: 44 + random(state) * 70, y: 0, dir: fromLeft ? 1 : -1, phase: random(state) * 6 });
    }
  }
  if (config.nutEvery) {
    state.nutClock -= dt;
    if (state.nutClock <= 0) {
      state.nutClock = config.nutEvery * (0.8 + random(state) * 0.4);
      state.nuts.push({ x: 30 + random(state) * 60, y: 30, warn: 0.9, falling: false, vy: 0 });
    }
  }
}

function moveLizards(state, dt) {
  const speed = state.config.lizardSpeed;
  for (const z of state.lizards) {
    if (z.falling) { z.vy += 200 * dt; z.y += z.vy * dt; continue; }
    const vine = VINES[z.vine];
    z.y += z.dir * speed * dt;
    if (z.y >= vine.bottom) {
      if (z.patrol) { z.y = vine.bottom; z.dir = -1; } else { z.falling = true; z.vy = 0; }
    }
    // A patrolling lizard climbs back up once, and leaves into the canopy.
    if (z.y <= vine.top && z.dir < 0) z.gone = true;
  }
  state.lizards = state.lizards.filter((z) => z.y < HEIGHT + 6 && !z.gone);
}

function moveBirds(state, dt) {
  const speed = state.config.birdSpeed;
  for (const b of state.birds) {
    b.x += b.dir * speed * dt;
    b.phase += dt * 3;
    b.y = b.base + Math.sin(b.phase) * 6;
  }
  state.birds = state.birds.filter((b) => b.x > -8 && b.x < WIDTH + 8);
}

function moveNuts(state, dt) {
  for (const n of state.nuts) {
    if (!n.falling) { n.warn -= dt; if (n.warn <= 0) n.falling = true; continue; }
    n.vy = Math.min(80, n.vy + 160 * dt);
    n.y += n.vy * dt;
  }
  state.nuts = state.nuts.filter((n) => n.y < HEIGHT + 6);
}

function moveCrawlers(state, dt) {
  const speed = state.config.lizardSpeed * 0.6;
  for (const c of state.crawlers) {
    if (c.bonked) continue;
    const ledge = LEDGES[c.ledge];
    c.x += c.dir * speed * dt;
    if (c.x < ledge.x1 + 3) { c.x = ledge.x1 + 3; c.dir = 1; }
    if (c.x > ledge.x2 - 3) { c.x = ledge.x2 - 3; c.dir = -1; }
  }
}

function moveFruit(state, dt, events) {
  const m = state.monkey;
  for (const f of state.fruit) {
    if (!f.falling) {
      // The monkey knocks it loose by climbing into it.
      if (m.mode === 'vine' && Math.abs(m.x - f.x) < 3.5 && Math.abs(m.y - HANG - f.y) < 3.5) { f.falling = true; f.vy = 0; events.push('fruit'); }
      continue;
    }
    f.vy = Math.min(90, f.vy + 180 * dt);
    f.y += f.vy * dt;
    const knock = (x, y, r) => Math.abs(x - f.x) < r + FRUIT_R && Math.abs(y - f.y) < r + FRUIT_R;
    const hitLizards = state.lizards.filter((z) => knock(z.x, z.y, LIZARD_R));
    const hitBirds = state.birds.filter((b) => knock(b.x, b.y, BIRD_R));
    const hitCrawlers = state.crawlers.filter((c) => !c.bonked && knock(c.x, LEDGES[c.ledge].y - LIZARD_R, LIZARD_R));
    for (const _ of [...hitLizards, ...hitBirds, ...hitCrawlers]) {
      f.chain += 1;
      state.score += 100 * (f.chain + 1);
      events.push('bonk');
    }
    state.lizards = state.lizards.filter((z) => !hitLizards.includes(z));
    state.birds = state.birds.filter((b) => !hitBirds.includes(b));
    for (const c of hitCrawlers) c.bonked = true;
  }
  state.fruit = state.fruit.filter((f) => f.y < HEIGHT + 6);
}

// ── Drawing ────────────────────────────────────────────────────────────────
//
// The poster system in a jungle: paper behind, flat palette fills, one navy
// outline. `colors` is the palette read out of the stylesheet by the screen.
// `stick` is where a finger is steering from, drawn as a faint ring.

function caption(g, text, colors, y, size = 7) {
  g.fillStyle = colors.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 ${size}px Inter, system-ui, sans-serif`;
  g.fillText(text, WIDTH / 2, y);
}

function drawMonkey(g, m, colors, time, big = 1) {
  g.save();
  g.translate(m.x, m.y);
  g.scale(big, big);
  const swing = m.mode === 'ground' && m.vx ? Math.sin(time * 16) * 1 : 0;
  g.fillStyle = colors.poppy;
  // Body and head.
  g.beginPath(); g.ellipse(0, -2.6, 2, 2.6, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.arc(0, -6.4, 2, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = colors.rose;
  g.beginPath(); g.ellipse(0.4 * (m.face || 1), -6, 1.2, 1, 0, 0, Math.PI * 2); g.fill();
  // Arms: up on a vine, out to the sides otherwise.
  g.beginPath();
  if (m.mode === 'vine') { g.moveTo(-1.4, -4); g.lineTo(-0.6, -9); g.moveTo(1.4, -4); g.lineTo(0.6, -9); }
  else { g.moveTo(-1.8, -3.6); g.lineTo(-3.2, -2 + swing); g.moveTo(1.8, -3.6); g.lineTo(3.2, -2 - swing); }
  // Tail.
  g.moveTo(-(m.face || 1) * 1.8, -1); g.quadraticCurveTo(-(m.face || 1) * 4.5, -1, -(m.face || 1) * 3.6, -4);
  g.stroke();
  g.restore();
}

/** Paint the whole jungle. `scale` is canvas pixels per field unit, `edge` the outline in canvas pixels. */
export function paint(g, state, { colors, scale, edge, stick = null }) {
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.fillStyle = colors.paper;
  g.fillRect(0, 0, WIDTH, HEIGHT);
  g.lineWidth = edge / scale;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = colors.ink;

  // Vines, wavy, with a leaf here and there.
  for (const vine of VINES) {
    g.beginPath();
    for (let y = vine.top - 4; y <= vine.bottom; y += 2) {
      const x = vine.x + Math.sin(y * 0.4) * 0.5;
      if (y === vine.top - 4) g.moveTo(x, y); else g.lineTo(x, y);
    }
    g.stroke();
    g.fillStyle = colors.sky;
    for (let y = vine.top + 8; y < vine.bottom; y += 16) {
      g.beginPath(); g.ellipse(vine.x + 1.6, y, 1.6, 0.8, -0.5, 0, Math.PI * 2); g.fill(); g.stroke();
    }
  }
  // Branches.
  for (const l of LEDGES) {
    g.fillStyle = l === LEDGES[0] ? colors.sky : colors.sunshine;
    g.fillRect(l.x1, l.y, l.x2 - l.x1, l === LEDGES[0] ? HEIGHT - l.y : 3);
    g.strokeRect(l.x1, l.y, l.x2 - l.x1, l === LEDGES[0] ? HEIGHT - l.y : 3);
  }
  // Papa's cage, top left, and the key.
  g.fillStyle = colors.sunshine;
  g.fillRect(2, CAGE.y, 16, 3); g.strokeRect(2, CAGE.y, 16, 3);
  drawMonkey(g, { x: CAGE.x, y: CAGE.y, mode: 'ground', face: 1 }, colors, 0, 1.6);
  g.beginPath();
  for (let x = 3; x <= 17; x += 2.8) { g.moveTo(x, CAGE.y); g.lineTo(x, CAGE.y - 14); }
  g.moveTo(2.5, CAGE.y - 14); g.lineTo(17.5, CAGE.y - 14);
  g.stroke();
  g.save();
  g.translate(KEY.x, KEY.y - 5 + Math.sin(state.time * 3) * 0.6);
  g.fillStyle = colors.sunshine;
  g.beginPath(); g.arc(0, -2, 2, 0, Math.PI * 2); g.fill(); g.stroke();
  g.beginPath(); g.moveTo(0, 0); g.lineTo(0, 4); g.moveTo(0, 2.6); g.lineTo(1.4, 2.6); g.moveTo(0, 4); g.lineTo(1.4, 4); g.stroke();
  g.restore();

  // Fruit: a rose berry with a leaf.
  for (const f of state.fruit) {
    g.fillStyle = colors.rose;
    g.beginPath(); g.arc(f.x, f.y, FRUIT_R, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(f.x, f.y - FRUIT_R); g.lineTo(f.x + 1, f.y - FRUIT_R - 1.2); g.stroke();
  }
  // Lizards on the vines, crawlers on the branches.
  const lizard = (x, y, angle) => {
    g.save();
    g.translate(x, y);
    g.rotate(angle);
    g.fillStyle = colors.captain;
    g.beginPath(); g.ellipse(0, 0, LIZARD_R, LIZARD_R * 0.7, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(LIZARD_R, 0); g.lineTo(LIZARD_R + 1.6, -0.6); g.moveTo(LIZARD_R, 0); g.lineTo(LIZARD_R + 1.6, 0.6);
    g.moveTo(-LIZARD_R, 0); g.lineTo(-LIZARD_R - 2, 0.4); g.stroke();
    g.restore();
  };
  for (const z of state.lizards) lizard(z.x, z.y, z.falling ? state.time * 10 : z.dir > 0 ? Math.PI / 2 : -Math.PI / 2);
  for (const c of state.crawlers) if (!c.bonked) lizard(c.x, LEDGES[c.ledge].y - LIZARD_R, c.dir > 0 ? 0 : Math.PI);
  // Birds: a sky body with flapping wings.
  for (const b of state.birds) {
    const flap = Math.sin(state.time * 14 + b.phase) * 1.4;
    g.fillStyle = colors.sky;
    g.beginPath(); g.ellipse(b.x, b.y, BIRD_R, BIRD_R * 0.7, 0, 0, Math.PI * 2); g.fill(); g.stroke();
    g.beginPath(); g.moveTo(b.x - 1, b.y - 0.5); g.lineTo(b.x - 2.6, b.y - 2 - flap); g.moveTo(b.x + 1, b.y - 0.5); g.lineTo(b.x + 2.6, b.y - 2 - flap);
    g.moveTo(b.x + b.dir * BIRD_R, b.y); g.lineTo(b.x + b.dir * (BIRD_R + 1.4), b.y + 0.4); g.stroke();
  }
  // Coconuts, and the shadow that warns of one.
  for (const n of state.nuts) {
    if (!n.falling) {
      g.save(); g.globalAlpha = 0.35 + 0.35 * Math.sin(state.time * 20);
      g.fillStyle = colors.ink; g.fillRect(n.x - NUT_R, LEDGES[0].y - 1, NUT_R * 2, 1); g.restore();
      continue;
    }
    g.fillStyle = colors.captain;
    g.beginPath(); g.arc(n.x, n.y, NUT_R, 0, Math.PI * 2); g.fill(); g.stroke();
  }

  const blink = state.pause > 0 && Math.floor(state.pause * 8) % 2 === 0;
  if (!blink) drawMonkey(g, state.monkey, colors, state.time);

  // A finger steering: a ring where it went down, a dot where it is now.
  if (stick) {
    g.save();
    g.globalAlpha = 0.35;
    g.beginPath(); g.arc(stick.x, stick.y, 6, 0, Math.PI * 2); g.stroke();
    g.fillStyle = colors.ink;
    g.beginPath(); g.arc(stick.x + clamp(stick.dx, -6, 6), stick.y + clamp(stick.dy, -6, 6), 2, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  g.fillStyle = colors.ink;
  g.textBaseline = 'alphabetic';
  g.font = '800 4px Inter, system-ui, sans-serif';
  g.textAlign = 'left';
  g.fillText('♥'.repeat(Math.max(0, state.lives)), 3, 7);
  g.textAlign = 'right';
  g.fillText(`BONUS ${Math.round(state.clock) * 10}`, WIDTH - 3, 7);

  const middle = HEIGHT * 0.58;
  if (state.rest > 0) {
    caption(g, 'PAPA IS FREE!', colors, middle, 6.5);
    caption(g, `NEXT: LEVEL ${state.level + 1}`, colors, middle + 9, 5);
  } else if (state.pause > 0) {
    caption(g, state.lives > 0 ? `OUCH! ${state.lives} ${state.lives === 1 ? 'LIFE' : 'LIVES'} LEFT` : 'OUT OF LIVES', colors, middle, 5.5);
  } else if (!state.started || state.showLevel > 0) {
    caption(g, `LEVEL ${state.level}`, colors, middle - 6);
    caption(g, 'CLIMB TO THE KEY!', colors, middle + 3, 5);
    if (!state.started) caption(g, 'DRAG TO MOVE · TAP TO JUMP', colors, middle + 11, 4.2);
  }
}
