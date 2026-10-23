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
// A twilight jungle drawn in the app's poster system: flat fills only — tints
// mixed from the palette for depth, never a gradient — and one navy outline.
// The scenery is layered back to front (a pale sky and moon, a far canopy, a
// mid canopy, the leaf fringe), and every actor is a small illustration with a
// face and a pose: the monkey climbs hand over hand, runs and leaps; the
// lizards snap; the toucans flap. `colors` is the palette read out of the
// stylesheet by the screen; `stick` is where a finger is steering from.

/** Mix two #rrggbb colours: `t` = 0 is `a`, 1 is `b`. A flat tint, not a gradient. */
function mix(a, b, t) {
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : null);
  const x = hex(a);
  const y = hex(b);
  if (!x || !y) return a;
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** The scene's tones, worked out once per palette. */
const toneCache = new WeakMap();
function tones(colors) {
  if (toneCache.has(colors)) return toneCache.get(colors);
  const t = {
    sky: mix(colors.sky, colors.paper, 0.55),
    moon: mix(colors.sunshine, colors.paper, 0.45),
    far: mix(colors.sky, colors.paper, 0.2),
    mid: mix(colors.sky, colors.captain, 0.45),
    leaf: colors.captain,
    leafDark: mix(colors.captain, colors.ink, 0.45),
    vine: mix(colors.captain, colors.ink, 0.3),
    vineLight: mix(colors.sky, colors.captain, 0.55),
    wood: mix(colors.poppy, colors.ink, 0.55),
    woodLight: mix(colors.poppy, colors.ink, 0.3),
    fur: mix(colors.poppy, colors.ink, 0.32),
    furDark: mix(colors.poppy, colors.ink, 0.55),
    skin: mix(colors.rose, colors.paper, 0.35),
    gold: colors.sunshine,
    goldDark: mix(colors.sunshine, colors.poppy, 0.55),
    lizard: mix(colors.poppy, colors.rose, 0.15),
    lizardDark: mix(colors.poppy, colors.ink, 0.35),
    soil: mix(colors.captain, colors.ink, 0.55),
    grass: mix(colors.captain, colors.sky, 0.25),
  };
  toneCache.set(colors, t);
  return t;
}

function caption(g, text, colors, y, size = 7) {
  g.save();
  g.font = `900 ${size}px Inter, system-ui, sans-serif`;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const w = g.measureText(text).width + size * 1.4;
  g.fillStyle = colors.paper;
  g.beginPath();
  g.roundRect?.(WIDTH / 2 - w / 2, y - size * 0.85, w, size * 1.7, size * 0.85);
  if (!g.roundRect) g.rect(WIDTH / 2 - w / 2, y - size * 0.85, w, size * 1.7);
  g.fill();
  g.stroke();
  g.fillStyle = colors.ink;
  g.fillText(text, WIDTH / 2, y + size * 0.05);
  g.restore();
}

const fine = (g, k = 0.55) => { g.lineWidth *= k; };

/** A pointed leaf, `len` long, pointing at `angle`, with a midrib. */
function leaf(g, x, y, len, angle, fill) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.beginPath();
  g.moveTo(0, 0);
  g.quadraticCurveTo(len * 0.5, -len * 0.38, len, 0);
  g.quadraticCurveTo(len * 0.5, len * 0.38, 0, 0);
  g.fillStyle = fill;
  g.fill();
  g.stroke();
  fine(g, 0.5);
  g.beginPath();
  g.moveTo(len * 0.1, 0);
  g.lineTo(len * 0.8, 0);
  g.stroke();
  g.restore();
}

function drawScenery(g, colors, t, time) {
  // The sky and a low moon.
  g.fillStyle = t.sky;
  g.fillRect(0, 0, WIDTH, HEIGHT);
  g.fillStyle = t.moon;
  g.beginPath(); g.arc(70, 16, 11, 0, Math.PI * 2); g.fill();
  // The far canopy: soft round crowns with no outline, so they sit back.
  g.fillStyle = t.far;
  for (let i = 0; i < 9; i++) {
    const x = i * 13 - 4;
    const y = 48 + Math.sin(i * 1.7) * 6;
    g.beginPath(); g.arc(x, y, 10 + (i % 3) * 2, 0, Math.PI * 2); g.fill();
  }
  g.fillRect(0, 50, WIDTH, HEIGHT - 50);
  // The mid canopy and its trunks, one tone darker.
  g.fillStyle = t.mid;
  for (const [x, w] of [[6, 5], [36, 4], [80, 6], [96, 4]]) g.fillRect(x - w / 2, 70, w, HEIGHT - 70);
  for (let i = 0; i < 8; i++) {
    const x = i * 15 + 2;
    const y = 76 + Math.sin(i * 2.3) * 5;
    g.beginPath(); g.arc(x, y, 9 + (i % 2) * 3, 0, Math.PI * 2); g.fill();
  }
  // Fireflies drifting in the dusk.
  g.fillStyle = t.moon;
  for (let i = 0; i < 7; i++) {
    const x = (i * 29 + time * (3 + i)) % WIDTH;
    const y = 60 + ((i * 37) % 60) + Math.sin(time * 2 + i) * 3;
    g.beginPath(); g.arc(x, y, 0.5, 0, Math.PI * 2); g.fill();
  }
  // The jungle floor: soil, a grass edge and a few flowers.
  const floor = LEDGES[0].y;
  g.fillStyle = t.soil;
  g.fillRect(0, floor, WIDTH, HEIGHT - floor);
  g.fillStyle = t.grass;
  g.beginPath();
  g.moveTo(0, floor + 2);
  for (let x = 0; x <= WIDTH; x += 2.5) g.lineTo(x, floor - (x % 5 === 0 ? 2.2 : 0.6));
  g.lineTo(WIDTH, floor + 2);
  g.closePath();
  g.fill();
  g.stroke();
  for (const [x, c] of [[14, colors.rose], [38, colors.sunshine], [60, colors.rose], [84, colors.sunshine]]) {
    g.fillStyle = c;
    for (let k = 0; k < 5; k++) { g.beginPath(); g.arc(x + Math.cos(k * 1.26) * 1.1, floor - 1.6 + Math.sin(k * 1.26) * 1.1, 0.75, 0, Math.PI * 2); g.fill(); }
    g.fillStyle = colors.paper;
    g.beginPath(); g.arc(x, floor - 1.6, 0.55, 0, Math.PI * 2); g.fill();
  }
}

/** The leaf fringe across the very top, drawn over everything at the back. */
function drawFringe(g, t) {
  for (let i = 0; i < 14; i++) {
    const x = i * 7.6 + 1;
    leaf(g, x, -1, 7 + (i % 3) * 1.6, Math.PI / 2 + (i % 2 ? 0.35 : -0.35), i % 2 ? t.leaf : t.leafDark);
  }
}

function drawVine(g, vine, t, time) {
  const sway = (y) => Math.sin(y * 0.35 + vine.x) * 0.45 + Math.sin(time * 1.3 + vine.x) * 0.15 * ((y - vine.top) / 60);
  // A rope of two strands: navy edge, green-blue body, light twist.
  const path = (dx) => {
    g.beginPath();
    for (let y = vine.top - 4; y <= vine.bottom + 1; y += 1.5) {
      const x = vine.x + sway(y) + dx;
      if (y === vine.top - 4) g.moveTo(x, y); else g.lineTo(x, y);
    }
  };
  const base = g.lineWidth;
  path(0);
  g.lineWidth = base * 2.6;
  g.strokeStyle = g.ink;
  g.stroke();
  g.lineWidth = base * 1.6;
  g.strokeStyle = t.vine;
  g.stroke();
  g.lineWidth = base * 0.5;
  g.strokeStyle = t.vineLight;
  g.beginPath();
  for (let y = vine.top - 2; y <= vine.bottom; y += 3) {
    g.moveTo(vine.x + sway(y) - 0.5, y);
    g.lineTo(vine.x + sway(y) + 0.5, y + 1.4);
  }
  g.stroke();
  g.lineWidth = base;
  g.strokeStyle = g.ink;
  // Leaves along it, side to side.
  let side = vine.x % 2 ? 1 : -1;
  for (let y = vine.top + 6; y < vine.bottom - 2; y += 9) {
    leaf(g, vine.x + sway(y), y, 3.6, side > 0 ? -0.5 : Math.PI + 0.5, side > 0 ? t.leaf : t.leafDark);
    side = -side;
  }
  // A curl at the bottom.
  g.beginPath();
  g.arc(vine.x + sway(vine.bottom) + 0.9, vine.bottom + 1.2, 1, Math.PI, Math.PI * 2.6);
  g.stroke();
}

function drawBranch(g, l, t, colors) {
  if (l === LEDGES[0]) return;
  const h = 4;
  g.fillStyle = t.wood;
  g.beginPath();
  g.roundRect?.(l.x1, l.y, l.x2 - l.x1, h, 2);
  if (!g.roundRect) g.rect(l.x1, l.y, l.x2 - l.x1, h);
  g.fill();
  g.stroke();
  // Bark: a lighter top edge, grain lines and the odd knot.
  g.fillStyle = t.woodLight;
  g.fillRect(l.x1 + 1.5, l.y + 0.6, l.x2 - l.x1 - 3, 1);
  g.save();
  fine(g, 0.5);
  g.beginPath();
  for (let x = l.x1 + 4; x < l.x2 - 2; x += 6.5) { g.moveTo(x, l.y + 2.2); g.lineTo(x + 3, l.y + 2.6); }
  g.stroke();
  for (let x = l.x1 + 9; x < l.x2 - 4; x += 19) { g.beginPath(); g.ellipse(x, l.y + 2.3, 1, 0.7, 0, 0, Math.PI * 2); g.stroke(); }
  g.restore();
  // Tufts of leaves at each end.
  leaf(g, l.x1 + 1, l.y + 1, 4, Math.PI + 0.4, t.leafDark);
  leaf(g, l.x1 + 1, l.y + 1, 3.4, Math.PI - 0.5, t.leaf);
  leaf(g, l.x2 - 1, l.y + 1, 4, -0.4, t.leafDark);
  leaf(g, l.x2 - 1, l.y + 1, 3.4, 0.5, t.leaf);
}

/**
 * The monkey, in a pose: climbing hand over hand on a vine, running, leaping,
 * or standing. Drawn about 8 units tall from its feet; `big` scales papa.
 */
function drawMonkey(g, m, colors, t, time, { big = 1, sad = false } = {}) {
  const face = m.face || 1;
  const pose = m.mode === 'vine' ? 'climb' : m.mode === 'air' ? 'leap' : m.vx ? 'run' : 'stand';
  const beat = time * (pose === 'run' ? 14 : 8);
  g.save();
  g.translate(m.x, m.y);
  g.scale(big, big);
  const limb = (x1, y1, x2, y2, w = 1.1) => {
    g.save();
    g.lineCap = 'round';
    g.lineWidth = w + g.lineWidth * 2;
    g.beginPath(); g.moveTo(x1, y1); g.lineTo(x2, y2); g.strokeStyle = colors.ink; g.stroke();
    g.lineWidth = w;
    g.strokeStyle = t.fur; g.stroke();
    g.restore();
  };
  const paw = (x, y) => { g.fillStyle = t.skin; g.beginPath(); g.arc(x, y, 0.55, 0, Math.PI * 2); g.fill(); g.stroke(); };
  // Tail: a curl behind.
  g.save();
  g.lineWidth *= 1;
  g.beginPath();
  g.moveTo(-face * 1.2, -2.2);
  g.bezierCurveTo(-face * 4.2, -1.6, -face * 4.6, -5.6, -face * 2.8, -5.4);
  g.lineCap = 'round';
  const tw = g.lineWidth;
  g.lineWidth = 0.9 + tw * 2; g.strokeStyle = colors.ink; g.stroke();
  g.lineWidth = 0.9; g.strokeStyle = t.fur; g.stroke();
  g.restore();
  // Legs.
  if (pose === 'climb') {
    const k = Math.sin(beat) * 0.9;
    limb(-0.7, -2.4, -1.4, -0.6 + k); limb(0.7, -2.4, 1.4, -0.6 - k);
    paw(-1.4, -0.6 + k); paw(1.4, -0.6 - k);
  } else if (pose === 'leap') {
    limb(-0.7, -2.4, -2, -1.2); limb(0.7, -2.4, 2, -0.6);
    paw(-2, -1.2); paw(2, -0.6);
  } else {
    const k = pose === 'run' ? Math.sin(beat) * 1.3 : 0;
    limb(-0.6, -2.4, -0.7 + k, 0); limb(0.6, -2.4, 0.7 - k, 0);
    paw(-0.7 + k, 0); paw(0.7 - k, 0);
  }
  // Body with a pale belly.
  g.fillStyle = t.fur;
  g.beginPath(); g.ellipse(0, -3.6, 1.8, 2.1, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = t.skin;
  g.beginPath(); g.ellipse(face * 0.3, -3.4, 1, 1.4, 0, 0, Math.PI * 2); g.fill();
  // Arms.
  if (pose === 'climb') {
    const k = Math.sin(beat) * 1.1;
    limb(-1.2, -4.8, -0.5, -9.2 - k); limb(1.2, -4.8, 0.5, -9.2 + k);
    paw(-0.5, -9.2 - k); paw(0.5, -9.2 + k);
  } else if (pose === 'leap') {
    limb(-1.3, -4.8, -2.6, -7.4); limb(1.3, -4.8, 2.6, -7.4);
    paw(-2.6, -7.4); paw(2.6, -7.4);
  } else {
    const k = pose === 'run' ? Math.sin(beat) * 1.1 : Math.sin(time * 2) * 0.2;
    limb(-1.4, -4.6, -2 - k * 0.4, -2.6); limb(1.4, -4.6, 2 + k * 0.4, -2.6);
    paw(-2 - k * 0.4, -2.6); paw(2 + k * 0.4, -2.6);
  }
  // Head: ears, round head, heart-shaped face, eyes with a glint, a smile.
  const hy = -7.4;
  for (const side of [-1, 1]) {
    g.fillStyle = t.fur; g.beginPath(); g.arc(side * 2.2, hy - 0.3, 1, 0, Math.PI * 2); g.fill(); g.stroke();
    g.fillStyle = t.skin; g.beginPath(); g.arc(side * 2.2, hy - 0.3, 0.5, 0, Math.PI * 2); g.fill();
  }
  g.fillStyle = t.fur;
  g.beginPath(); g.arc(0, hy, 2.3, 0, Math.PI * 2); g.fill(); g.stroke();
  const fx = pose === 'climb' ? 0 : face * 0.35;
  g.fillStyle = t.skin;
  g.beginPath();
  g.arc(fx - 0.75, hy - 0.4, 0.95, 0, Math.PI * 2);
  g.arc(fx + 0.75, hy - 0.4, 0.95, 0, Math.PI * 2);
  g.fill();
  g.beginPath(); g.ellipse(fx, hy + 0.85, 1.45, 1, 0, 0, Math.PI * 2); g.fill();
  g.save();
  fine(g, 0.5);
  g.beginPath(); g.ellipse(fx, hy + 0.85, 1.45, 1, 0, 0, Math.PI * 2); g.stroke();
  g.restore();
  for (const side of [-1, 1]) {
    g.fillStyle = colors.ink;
    g.beginPath(); g.arc(fx + side * 0.72, hy - 0.4, 0.42, 0, Math.PI * 2); g.fill();
    g.fillStyle = colors.paper;
    g.beginPath(); g.arc(fx + side * 0.72 + 0.14, hy - 0.55, 0.14, 0, Math.PI * 2); g.fill();
  }
  g.save();
  fine(g, 0.5);
  g.beginPath();
  if (sad) { g.moveTo(fx - 0.6, hy + 1.3); g.quadraticCurveTo(fx, hy + 0.8, fx + 0.6, hy + 1.3); }
  else { g.moveTo(fx - 0.6, hy + 1); g.quadraticCurveTo(fx, hy + 1.6, fx + 0.6, hy + 1); }
  g.stroke();
  g.fillStyle = colors.ink;
  g.beginPath(); g.arc(fx - 0.25, hy + 0.45, 0.13, 0, Math.PI * 2); g.arc(fx + 0.25, hy + 0.45, 0.13, 0, Math.PI * 2); g.fill();
  if (sad) { g.beginPath(); g.moveTo(fx - 1.2, hy - 1.5); g.lineTo(fx - 0.4, hy - 1.2); g.moveTo(fx + 1.2, hy - 1.5); g.lineTo(fx + 0.4, hy - 1.2); g.stroke(); }
  g.restore();
  g.restore();
}

/** A snapping lizard, nose first along `angle`, legs paddling, jaw snapping. */
function drawLizard(g, x, y, angle, colors, t, time, seed) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  const walk = Math.sin(time * 14 + seed) * 0.7;
  const snap = Math.max(0, Math.sin(time * 9 + seed)) * 0.5;
  // Tail.
  g.fillStyle = t.lizard;
  g.beginPath();
  g.moveTo(-1.6, -0.7);
  g.quadraticCurveTo(-4, -0.4 + walk * 0.6, -5.4, 0.6 + walk);
  g.quadraticCurveTo(-3.8, 0.6, -1.6, 0.8);
  g.closePath(); g.fill(); g.stroke();
  // Legs.
  g.save();
  fine(g, 0.8);
  g.beginPath();
  for (const [lx, side, k] of [[1, -1, walk], [1, 1, -walk], [-1.2, -1, -walk], [-1.2, 1, walk]]) {
    g.moveTo(lx, side * 0.6); g.lineTo(lx + k * 0.6, side * 1.7); g.lineTo(lx + k * 0.6 + 0.5, side * 1.9);
  }
  g.stroke();
  g.restore();
  // Body with spots.
  g.fillStyle = t.lizard;
  g.beginPath(); g.ellipse(0, 0, 2, 1, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = colors.sunshine;
  for (const sx of [-1, 0.2]) { g.beginPath(); g.arc(sx, -0.1, 0.35, 0, Math.PI * 2); g.fill(); }
  // Head with a snapping jaw and an eye.
  g.fillStyle = t.lizard;
  g.beginPath();
  g.moveTo(1.6, -0.8);
  g.quadraticCurveTo(3.4, -0.9, 3.6, -0.15 - snap);
  g.lineTo(2.3, 0);
  g.lineTo(3.6, 0.15 + snap);
  g.quadraticCurveTo(3.2, 0.9, 1.6, 0.8);
  g.closePath(); g.fill(); g.stroke();
  g.fillStyle = colors.paper;
  g.beginPath(); g.arc(2.4, -0.45, 0.35, 0, Math.PI * 2); g.fill();
  g.fillStyle = colors.ink;
  g.beginPath(); g.arc(2.5, -0.45, 0.18, 0, Math.PI * 2); g.fill();
  g.restore();
}

/** A toucan: navy body, pale chest, big sunshine beak, beating wings. */
function drawToucan(g, b, colors, t, time) {
  const flap = Math.sin(time * 12 + b.phase);
  g.save();
  g.translate(b.x, b.y);
  g.scale(b.dir, 1);
  // Far wing.
  g.fillStyle = t.leafDark;
  g.beginPath(); g.moveTo(-0.6, -0.4); g.lineTo(-2.4, -2.6 - flap * 1.4); g.lineTo(0.6, -0.8); g.closePath(); g.fill(); g.stroke();
  // Tail and body.
  g.fillStyle = colors.ink;
  g.beginPath(); g.moveTo(-2, 0); g.lineTo(-4, 0.8); g.lineTo(-3.6, -0.6); g.closePath(); g.fill(); g.stroke();
  g.beginPath(); g.ellipse(-0.3, 0, 2.3, 1.5, 0, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = colors.paper;
  g.beginPath(); g.ellipse(1, 0.3, 1, 1, 0, 0, Math.PI * 2); g.fill();
  // Beak and eye.
  g.fillStyle = colors.sunshine;
  g.beginPath(); g.moveTo(1.6, -0.6); g.quadraticCurveTo(4.4, -0.8, 4.8, 0.2); g.quadraticCurveTo(3.4, 0.5, 1.6, 0.4); g.closePath(); g.fill(); g.stroke();
  g.fillStyle = colors.poppy;
  g.beginPath(); g.moveTo(4.2, -0.4); g.quadraticCurveTo(4.6, -0.3, 4.8, 0.2); g.lineTo(4.1, 0.3); g.closePath(); g.fill();
  g.fillStyle = colors.sky;
  g.beginPath(); g.arc(1.1, -0.5, 0.45, 0, Math.PI * 2); g.fill();
  g.fillStyle = colors.ink;
  g.beginPath(); g.arc(1.15, -0.5, 0.2, 0, Math.PI * 2); g.fill();
  // Near wing.
  g.fillStyle = t.leaf;
  g.beginPath(); g.moveTo(-1.2, -0.2); g.lineTo(-2.8, -2.4 - flap * 1.8); g.lineTo(0.4, -0.6); g.closePath(); g.fill(); g.stroke();
  g.restore();
}

/** A bunch of three bananas hanging from a stalk. */
function drawBananas(g, x, y, colors, t) {
  g.save();
  g.translate(x, y);
  g.beginPath(); g.moveTo(0, -2.4); g.lineTo(0, -1); g.stroke();
  for (const a of [-0.6, 0, 0.6]) {
    g.save();
    g.rotate(a);
    g.fillStyle = colors.sunshine;
    g.beginPath();
    g.moveTo(0, -1);
    g.quadraticCurveTo(1.6, 0.4, 0.6, 2.6);
    g.quadraticCurveTo(0.2, 0.6, -0.5, -0.8);
    g.closePath(); g.fill(); g.stroke();
    g.fillStyle = t.wood;
    g.beginPath(); g.arc(0.6, 2.6, 0.3, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  g.restore();
}

function drawCoconut(g, x, y, colors, t) {
  g.fillStyle = t.wood;
  g.beginPath(); g.arc(x, y, NUT_R, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = t.woodLight;
  g.beginPath(); g.arc(x - 0.6, y - 0.6, 0.7, 0, Math.PI * 2); g.fill();
  g.fillStyle = colors.ink;
  for (const [dx, dy] of [[0.5, 0.3], [1, 0.9], [0.1, 1]]) { g.beginPath(); g.arc(x + dx, y + dy, 0.22, 0, Math.PI * 2); g.fill(); }
}

function drawCage(g, colors, t, time) {
  // A wooden ledge, papa sitting behind the bars, a padlock on the door.
  g.fillStyle = t.wood;
  g.fillRect(2, CAGE.y, 16, 4); g.strokeRect(2, CAGE.y, 16, 4);
  g.fillStyle = t.woodLight;
  g.fillRect(3, CAGE.y + 0.6, 14, 1);
  drawMonkey(g, { x: CAGE.x, y: CAGE.y, mode: 'ground', face: 1, vx: 0 }, colors, t, time, { big: 1.35, sad: true });
  g.fillStyle = t.wood;
  g.fillRect(2.2, CAGE.y - 15.5, 15.6, 2); g.strokeRect(2.2, CAGE.y - 15.5, 15.6, 2);
  g.save();
  g.lineCap = 'round';
  for (let x = 3.4; x <= 17; x += 2.7) {
    g.beginPath(); g.moveTo(x, CAGE.y - 13.5); g.lineTo(x, CAGE.y);
    const w = g.lineWidth;
    g.lineWidth = w * 1.8; g.strokeStyle = colors.ink; g.stroke();
    g.lineWidth = w * 0.7; g.strokeStyle = colors.sky; g.stroke();
    g.lineWidth = w; g.strokeStyle = colors.ink;
  }
  g.restore();
  g.fillStyle = colors.sunshine;
  g.beginPath(); g.arc(12.5, CAGE.y - 6.5, 0.9, Math.PI, 0); g.stroke();
  g.fillRect(11.3, CAGE.y - 6.5, 2.4, 2); g.strokeRect(11.3, CAGE.y - 6.5, 2.4, 2);
  g.fillStyle = colors.ink;
  g.beginPath(); g.arc(12.5, CAGE.y - 5.7, 0.25, 0, Math.PI * 2); g.fill();
}

function drawKey(g, colors, t, time) {
  const bob = Math.sin(time * 3) * 0.6;
  g.save();
  g.translate(KEY.x, KEY.y - 6 + bob);
  g.rotate(-0.5);
  g.fillStyle = colors.sunshine;
  g.beginPath(); g.arc(0, -2.2, 1.9, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = t.sky;
  g.beginPath(); g.arc(0, -2.2, 0.8, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = colors.sunshine;
  g.fillRect(-0.5, -0.4, 1, 5); g.strokeRect(-0.5, -0.4, 1, 5);
  g.fillRect(0.5, 2.6, 1.3, 0.8); g.strokeRect(0.5, 2.6, 1.3, 0.8);
  g.fillRect(0.5, 3.8, 1, 0.8); g.strokeRect(0.5, 3.8, 1, 0.8);
  g.restore();
  // A twinkle that turns.
  const k = (Math.sin(time * 4) + 1) / 2;
  g.save();
  g.translate(KEY.x + 2.6, KEY.y - 10 + bob);
  g.rotate(time);
  g.fillStyle = colors.paper;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const r = i % 2 ? 0.35 : 0.8 + k * 0.7;
    g.lineTo(Math.cos((i * Math.PI) / 4) * r, Math.sin((i * Math.PI) / 4) * r);
  }
  g.closePath(); g.fill(); g.stroke();
  g.restore();
}

function heart(g, x, y, r, fill) {
  g.fillStyle = fill;
  g.beginPath();
  g.moveTo(x, y + r * 0.9);
  g.bezierCurveTo(x - r * 1.6, y - r * 0.2, x - r * 0.6, y - r * 1.3, x, y - r * 0.35);
  g.bezierCurveTo(x + r * 0.6, y - r * 1.3, x + r * 1.6, y - r * 0.2, x, y + r * 0.9);
  g.fill();
  g.stroke();
}

/** Paint the whole jungle. `scale` is canvas pixels per field unit, `edge` the outline in canvas pixels. */
export function paint(g, state, { colors, scale, edge, stick = null }) {
  g.setTransform(scale, 0, 0, scale, 0, 0);
  const t = tones(colors);
  g.ink = colors.ink;
  g.lineWidth = edge / scale;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = colors.ink;
  const time = state.time;

  drawScenery(g, colors, t, time);
  for (const vine of VINES) drawVine(g, vine, t, time);
  for (const l of LEDGES) drawBranch(g, l, t, colors);
  drawCage(g, colors, t, time);
  drawKey(g, colors, t, time);
  drawFringe(g, t);

  for (const f of state.fruit) drawBananas(g, f.x, f.y, colors, t);
  state.lizards.forEach((z, i) => drawLizard(g, z.x, z.y, z.falling ? time * 10 : z.dir > 0 ? Math.PI / 2 : -Math.PI / 2, colors, t, time, i));
  state.crawlers.forEach((c, i) => { if (!c.bonked) drawLizard(g, c.x, LEDGES[c.ledge].y - 1.2, c.dir > 0 ? 0 : Math.PI, colors, t, time, i + 5); });
  for (const b of state.birds) drawToucan(g, b, colors, t, time);
  for (const n of state.nuts) {
    if (!n.falling) {
      // A flashing shadow on the floor where it will land.
      g.save();
      g.globalAlpha = 0.25 + 0.25 * Math.sin(time * 20);
      g.fillStyle = colors.ink;
      g.beginPath(); g.ellipse(n.x, LEDGES[0].y - 0.4, NUT_R * 1.3, 0.6, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      continue;
    }
    drawCoconut(g, n.x, n.y, colors, t);
  }

  const blink = state.pause > 0 && Math.floor(state.pause * 8) % 2 === 0;
  if (!blink) drawMonkey(g, state.monkey, colors, t, time, { big: 1.15 });

  // A finger steering: a ring where it went down, a dot where it is now.
  if (stick) {
    g.save();
    g.globalAlpha = 0.4;
    g.beginPath(); g.arc(stick.x, stick.y, 6, 0, Math.PI * 2); g.stroke();
    g.fillStyle = colors.ink;
    g.beginPath(); g.arc(stick.x + clamp(stick.dx, -6, 6), stick.y + clamp(stick.dy, -6, 6), 2, 0, Math.PI * 2); g.fill();
    g.restore();
  }

  // Lives as hearts, and the bonus on a paper tab.
  for (let i = 0; i < Math.max(0, state.lives); i++) heart(g, 25 + i * 4.6, 13, 1.6, colors.poppy);
  g.save();
  g.font = '800 3.6px Inter, system-ui, sans-serif';
  g.textAlign = 'right';
  g.textBaseline = 'middle';
  const bonus = `BONUS ${Math.round(state.clock) * 10}`;
  const w = g.measureText(bonus).width + 3;
  g.fillStyle = colors.paper;
  g.fillRect(WIDTH - 3 - w, 10.6, w, 5); g.strokeRect(WIDTH - 3 - w, 10.6, w, 5);
  g.fillStyle = colors.ink;
  g.fillText(bonus, WIDTH - 4.5, 13.2);
  g.restore();

  const middle = HEIGHT * 0.58;
  if (state.rest > 0) {
    caption(g, 'PAPA IS FREE!', colors, middle, 6.5);
    caption(g, `NEXT: LEVEL ${state.level + 1}`, colors, middle + 10, 4.5);
  } else if (state.pause > 0) {
    caption(g, state.lives > 0 ? `OUCH! ${state.lives} ${state.lives === 1 ? 'LIFE' : 'LIVES'} LEFT` : 'OUT OF LIVES', colors, middle, 5);
  } else if (!state.started || state.showLevel > 0) {
    caption(g, `LEVEL ${state.level}`, colors, middle - 8, 6.5);
    caption(g, 'CLIMB TO THE KEY!', colors, middle + 2, 4.5);
    if (!state.started) caption(g, 'DRAG TO MOVE · TAP TO JUMP', colors, middle + 10, 3.8);
  }
}
