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
//     slowly. Grabbing a vine that has a partner takes both at once; pushing
//     away from it jumps off, and a jump can catch the next vine in mid-air.
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
//   · Every level is played in one of eight jungles, taken in turn, each
//     with its own branches and vines, its own key and cage, and its own
//     time of day — see STAGES below.
//   · Reaching the key is not the end of it: the monkey holds it up, carries
//     it to the cage, the lock springs, and papa hops out for a hug.
//   · Everything random comes from a seed kept as a number on the state, so a
//     level can be replayed, a test can try a move on a copy, and every phone
//     in a room race meets the same lizards.
//
// The field is 100 units across and 140 down. An actor's `y` is its feet.

export const WIDTH = 100;
export const HEIGHT = 140;
export const HARDEST = 25;

// ── The stages ─────────────────────────────────────────────────────────────
//
// Eight jungles, each with its own branches and vines, its own key and cage
// spot and its own time of day, taken in turn (see stageFor). Four are drawn
// by hand and four are those four mirrored.
// Every stage keeps the same grammar, which the tests hold it to:
//
//   · the first ledge is the jungle floor and runs the whole width;
//   · the key and the cage sit at the top, at y 26;
//   · every vine hangs from a ledge — the top of every vine (or the middle of
//     a pair) leads onto the branch above, so climbing up always gets you
//     somewhere — and there is a way up from the floor to the key;
//   · two vines closer than PAIR are a pair, and hang over the same span.
//
// A ledge is a top y and an x span; a vine an x and the span it hangs over.

const DESIGNS = [
  {
    // The first jungle: a long pair up the left, a ledge in the middle.
    ledges: [
      { y: 134, x1: 0, x2: 100 },
      { y: 104, x1: 62, x2: 98 },
      { y: 70, x1: 38, x2: 60 },
      { y: 26, x1: 20, x2: 98 },
    ],
    vines: [
      { x: 24, top: 30, bottom: 120 },
      { x: 29, top: 30, bottom: 120 },
      { x: 44, top: 74, bottom: 124 },
      { x: 54, top: 30, bottom: 64 },
      { x: 66, top: 30, bottom: 98 },
      { x: 71, top: 30, bottom: 98 },
      { x: 88, top: 30, bottom: 98 },
    ],
    key: 93,
    cage: 10,
  },
  {
    // Steps: three short branches climbing across, with long vines to cheat by.
    ledges: [
      { y: 134, x1: 0, x2: 100 },
      { y: 110, x1: 4, x2: 38 },
      { y: 86, x1: 28, x2: 66 },
      { y: 60, x1: 56, x2: 96 },
      { y: 26, x1: 4, x2: 80 },
    ],
    vines: [
      { x: 14, top: 114, bottom: 124 },
      { x: 24, top: 30, bottom: 100 },
      { x: 33, top: 90, bottom: 102 },
      { x: 46, top: 30, bottom: 80 },
      { x: 58, top: 64, bottom: 78 },
      { x: 66, top: 30, bottom: 52 },
      { x: 71, top: 30, bottom: 52 },
    ],
    key: 8,
    cage: 90,
  },
  {
    // Twin towers: a branch on each side, a ledge between, and the key up top.
    ledges: [
      { y: 134, x1: 0, x2: 100 },
      { y: 96, x1: 4, x2: 32 },
      { y: 96, x1: 68, x2: 96 },
      { y: 62, x1: 36, x2: 64 },
      { y: 26, x1: 20, x2: 98 },
    ],
    vines: [
      { x: 17, top: 100, bottom: 120 },
      { x: 24, top: 30, bottom: 84 },
      { x: 29, top: 30, bottom: 84 },
      { x: 41, top: 30, bottom: 54 },
      { x: 50, top: 66, bottom: 122 },
      { x: 59, top: 30, bottom: 54 },
      { x: 76, top: 30, bottom: 84 },
      { x: 83, top: 100, bottom: 120 },
    ],
    key: 93,
    cage: 10,
  },
  {
    // The crossing: a stump, two side branches, a ledge above and three ways up.
    ledges: [
      { y: 134, x1: 0, x2: 100 },
      { y: 114, x1: 40, x2: 60 },
      { y: 88, x1: 4, x2: 36 },
      { y: 88, x1: 64, x2: 96 },
      { y: 56, x1: 30, x2: 70 },
      { y: 26, x1: 20, x2: 82 },
    ],
    vines: [
      { x: 12, top: 92, bottom: 120 },
      { x: 17, top: 92, bottom: 120 },
      { x: 26, top: 30, bottom: 84 },
      { x: 42, top: 60, bottom: 104 },
      { x: 50, top: 118, bottom: 126 },
      { x: 58, top: 60, bottom: 104 },
      { x: 64, top: 30, bottom: 46 },
      { x: 72, top: 30, bottom: 84 },
      { x: 77, top: 30, bottom: 84 },
      { x: 88, top: 92, bottom: 120 },
    ],
    key: 78,
    cage: 10,
  },
];

/** A design flipped left to right. */
function mirror(design) {
  return {
    ledges: design.ledges.map((l) => ({ y: l.y, x1: WIDTH - l.x2, x2: WIDTH - l.x1 })),
    vines: design.vines.map((v) => ({ ...v, x: WIDTH - v.x })).sort((a, b) => a.x - b.x),
    key: WIDTH - design.key,
    cage: WIDTH - design.cage,
  };
}

/** The times of day, in the order the stages take them. */
export const SKIES = ['night', 'dawn', 'day', 'sunset'];

/** The eight stages, in play order: each design and its mirror, never twice running. */
export const STAGES = [
  DESIGNS[0], mirror(DESIGNS[1]), DESIGNS[2], mirror(DESIGNS[3]),
  mirror(DESIGNS[0]), DESIGNS[1], mirror(DESIGNS[2]), DESIGNS[3],
].map((design, i) => ({
  ledges: design.ledges,
  vines: design.vines,
  key: { x: design.key, y: 26 },
  cage: { x: design.cage, y: 26 },
  sky: SKIES[i % SKIES.length],
}));

/**
 * The stage level `n` is played on: one after another, and each time round
 * the eight starting one further on, so level 9 is not level 1's jungle again.
 */
export const stageFor = (n) => {
  const i = Math.max(1, Math.trunc(n) || 1) - 1;
  return STAGES[(i + Math.floor(i / STAGES.length)) % STAGES.length];
};

export const PAIR = 5.5;          // vines this close are held together
const MONKEY = { w: 3.4, h: 6, run: 26, jump: 66, gravity: 240, reach: 2.6 };
const CLIMB = { one: { up: 13, down: 30 }, two: { up: 24, down: 14 } };
const HANG = 6;                   // feet below the hands, on a vine
const LIZARD_R = 2.2;
const BIRD_R = 2.4;
const NUT_R = 2;
const FRUIT_R = 2.2;
const LIVES = 3;
const SHOW_LEVEL = 2.4;
const HIT_PAUSE = 1.2;
// Reaching the key plays a short scene before the next level: the monkey holds
// the key up, carries it to the cage, the lock springs, the door swings open
// and papa hops out for a hug. These are its beats, in seconds from the key.
export const RESCUE = { lift: 0.5, carry: 2.1, unlock: 2.5, done: 3.8 };

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
  unlock: [{ type: 'square', from: 1400, to: 1400, at: 0, dur: 0.04, gain: 0.05 }, { type: 'triangle', from: 500, to: 900, at: 0.05, dur: 0.18, gain: 0.05 }],
  free: [659, 784, 1047, 1319, 1568].map((hz, i) => ({ type: 'square', from: hz, to: hz, at: i * 0.07, dur: 0.09, gain: 0.05 })),
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

/** The stage being played. The state keeps its number, so a copied state still works. */
const stageOf = (state) => STAGES[state.stage];
/** The vine paired with this one in `vines`, if there is one. Vines are kept by number for the same reason. */
export const partner = (vines, vine) => vines.find((other) => other.x !== vine.x && Math.abs(other.x - vine.x) <= PAIR) || null;
/** The ledge in `ledges` whose top is at `y` and spans `x`, or null. */
export const ledgeAt = (ledges, y, x) => ledges.find((l) => Math.abs(l.y - y) < 0.01 && x >= l.x1 && x <= l.x2) || null;

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
  state.stage = STAGES.indexOf(stageFor(n));
  state.config = level(n);
  state.lives = LIVES;
  state.levelScore = state.score;
  state.showLevel = SHOW_LEVEL;
  resetRound(state);
}

/** Back to the jungle floor with the field cleared — after a hit, and at a level's start. */
function resetRound(state) {
  const config = state.config;
  const { ledges, vines, key } = stageOf(state);
  // The monkey starts on the floor, at the end away from the key, facing in.
  const fromRight = key.x < WIDTH / 2;
  state.monkey = { x: fromRight ? WIDTH - 9 : 8, y: ledges[0].y, vx: 0, vy: 0, mode: 'ground', vine: null, two: false, face: fromRight ? -1 : 1, letGo: null, letGoClock: 0, settled: true };
  state.lizards = [];
  state.birds = [];
  state.nuts = [];
  state.rescue = null;
  // Fruit on vines that reach high, at a spread of heights, from the seed.
  const tall = vines.filter((v) => v.bottom - v.top > 50);
  state.fruit = Array.from({ length: config.fruit }, (_, i) => {
    const vine = tall[(i * 2 + Math.floor(random(state) * 2)) % tall.length];
    return { x: vine.x, y: vine.top + 12 + random(state) * 18, vy: 0, falling: false, chain: 0 };
  });
  state.crawlers = Array.from({ length: config.crawlers }, (_, i) => {
    const ledge = ledges[1 + (i % (ledges.length - 1))];
    return { ledge: ledges.indexOf(ledge), x: ledge.x1 + (ledge.x2 - ledge.x1) * (0.3 + 0.4 * random(state)), dir: i % 2 ? 1 : -1, bonked: false };
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
    rescue(state, dt, events);
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
  const { ledges, key } = stageOf(state);
  const body = { x: m.x, y: m.y - MONKEY.h / 2 };
  const hazards = [
    // A lizard that has dropped off its vine is tumbling away, and harmless.
    ...state.lizards.filter((one) => !one.falling).map((one) => ({ x: one.x, y: one.y, r: LIZARD_R })),
    ...state.birds.map((one) => ({ x: one.x, y: one.y, r: BIRD_R })),
    ...state.nuts.filter((one) => one.falling).map((one) => ({ x: one.x, y: one.y, r: NUT_R })),
    ...state.crawlers.filter((one) => !one.bonked).map((one) => ({ x: one.x, y: ledges[one.ledge].y - LIZARD_R, r: LIZARD_R })),
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
  if (m.mode === 'ground' && Math.abs(m.y - key.y) < 0.01 && Math.abs(m.x - key.x) <= 3) {
    state.score += 500 + Math.round(state.clock) * 10;
    state.rest = RESCUE.done;
    // The jungle goes quiet for the rescue.
    state.lizards = []; state.birds = []; state.nuts = [];
    for (const c of state.crawlers) c.bonked = true;
    state.rescue = { t: 0, from: m.x, unlocked: false, free: false };
    m.vx = 0;
    events.push('level');
  }
  return events;
}

/**
 * The rescue scene, one step of it: hold the key up, carry it along the top
 * to the cage door in little hops, spring the lock, and let papa out.
 */
function rescue(state, dt, events) {
  const r = state.rescue;
  if (!r) return;
  const { cage } = stageOf(state);
  const m = state.monkey;
  r.t += dt;
  const side = Math.sign(r.from - cage.x) || 1;
  const door = cage.x + side * 10;
  m.face = -side;
  if (r.t < RESCUE.lift) {
    m.x = r.from; m.y = cage.y; m.vx = 0; m.mode = 'ground';
  } else if (r.t < RESCUE.carry) {
    const k = (r.t - RESCUE.lift) / (RESCUE.carry - RESCUE.lift);
    m.x = r.from + (door - r.from) * k;
    m.y = cage.y - Math.abs(Math.sin(k * Math.PI * 5)) * 2.5;
    m.vx = -side; m.mode = 'ground';
  } else {
    m.x = door; m.y = cage.y; m.vx = 0; m.mode = 'ground';
    if (!r.unlocked) { r.unlocked = true; events.push('unlock'); }
    if (r.t >= RESCUE.unlock && !r.free) { r.free = true; events.push('free'); }
  }
}

function moveMonkey(state, input, dt, events) {
  const m = state.monkey;
  const { ledges, vines } = stageOf(state);
  if (input.across) m.face = input.across;
  m.letGoClock = Math.max(0, m.letGoClock - dt);

  if (m.mode === 'vine') {
    const vine = vines[m.vine];
    const mate = partner(vines, vine);
    // Off the side: from a pair, it is the outer vine that is let go last,
    // so the jump does not catch it again on the way past.
    const leave = (dir) => {
      if (m.two && Math.sign(mate.x - vine.x) === dir) m.vine = vines.indexOf(mate);
      return jumpOff(m, dir, events);
    };
    // A side held from before the grab is not a push: it has to be let go
    // and pressed again, or holding ▶ through a catch would jump straight off.
    if (!input.across) m.settled = true;
    const across = m.settled ? input.across : 0;
    // Toward a partner not yet held takes both; any other push jumps off.
    if (across && mate && !m.two && Math.sign(mate.x - vine.x) === across) { m.two = true; events.push('grab'); }
    else if (across) return leave(across);
    if (input.jump) return leave(m.face);

    const speeds = m.two ? CLIMB.two : CLIMB.one;
    const top = Math.max(vine.top, m.two ? mate.top : vine.top) + HANG;
    const bottom = (m.two ? Math.min(vine.bottom, mate.bottom) : vine.bottom) + HANG;
    m.x = m.two ? (vine.x + mate.x) / 2 : vine.x;
    m.y = clamp(m.y + (input.climb < 0 ? -speeds.up : input.climb > 0 ? speeds.down : 0) * dt, top, bottom);
    if (input.climb < 0 && m.y === top) {
      // Up onto the branch above the vine, if there is one.
      const ledge = ledgeAt(ledges, vine.top - 4, m.x);
      if (ledge) { m.mode = 'ground'; m.y = ledge.y; m.vine = null; m.two = false; }
    } else if (input.climb > 0 && m.y === bottom) {
      m.mode = 'air'; m.vy = 0; m.vx = 0; m.letGo = m.vine; m.letGoClock = 0.3; m.vine = null; m.two = false;
    }
    return;
  }

  if (m.mode === 'ground') {
    // Up a vine that hangs within reach overhead.
    if (input.climb < 0) {
      const vine = vines.find((v) => Math.abs(v.x - m.x) <= MONKEY.reach && v.bottom + HANG >= m.y - 10 && v.top + HANG <= m.y);
      if (vine) {
        hold(m, vines, vine, events);
        m.vx = 0;
        m.y = Math.min(m.y, vine.bottom + HANG);
        return;
      }
    }
    // Down onto a vine that hangs from the branch.
    if (input.climb > 0) {
      const vine = vines.find((v) => Math.abs(v.x - m.x) <= MONKEY.reach && Math.abs(v.top - 4 - m.y) < 0.01);
      if (vine) { hold(m, vines, vine, events); m.y = vine.top + HANG; return; }
    }
    m.vx = input.across * MONKEY.run;
    if (input.jump) { m.mode = 'air'; m.vy = -MONKEY.jump; m.vx = input.across * MONKEY.run; events.push('jump'); return; }
    m.x = clamp(m.x + m.vx * dt, 3, WIDTH - 3);
    if (!ledges.some((l) => Math.abs(l.y - m.y) < 0.01 && m.x >= l.x1 && m.x <= l.x2)) { m.mode = 'air'; m.vy = 0; }
    return;
  }

  // In the air: fall, catch a vine on the way past, or land on a branch.
  const before = m.y;
  m.vy += MONKEY.gravity * dt;
  m.x = clamp(m.x + m.vx * dt, 3, WIDTH - 3);
  m.y += m.vy * dt;
  for (const [index, vine] of vines.entries()) {
    if (index === m.letGo && m.letGoClock > 0) continue;
    if (Math.abs(vine.x - m.x) <= 1.6 && m.y >= vine.top + HANG && m.y <= vine.bottom + HANG + 2) {
      hold(m, vines, vine, events);
      m.vx = 0; m.vy = 0;
      m.y = clamp(m.y, vine.top + HANG, vine.bottom + HANG);
      return;
    }
  }
  if (m.vy > 0) {
    for (const l of ledges) {
      if (before <= l.y && m.y >= l.y && m.x >= l.x1 && m.x <= l.x2) {
        m.mode = 'ground'; m.y = l.y; m.vy = 0; m.vx = 0;
        return;
      }
    }
  }
}

/** Take hold of a vine — and of its partner too, when it has one. */
function hold(m, vines, vine, events) {
  m.mode = 'vine';
  m.vine = vines.indexOf(vine);
  m.two = Boolean(partner(vines, vine));
  m.settled = false;
  events.push('grab');
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
    const vines = stageOf(state).vines;
    const tall = vines.filter((v) => v.top <= 30);
    // Some come down the vine nearest the monkey; the rest anywhere.
    const nearest = [...tall].sort((a, b) => Math.abs(a.x - state.monkey.x) - Math.abs(b.x - state.monkey.x))[0];
    const vine = random(state) < config.aim ? nearest : tall[Math.floor(random(state) * tall.length)];
    state.lizards.push({ vine: vines.indexOf(vine), x: vine.x, y: vine.top, dir: 1, patrol: random(state) < config.patrol, falling: false, vy: 0 });
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
  const vines = stageOf(state).vines;
  for (const z of state.lizards) {
    if (z.falling) { z.vy += 200 * dt; z.y += z.vy * dt; continue; }
    const vine = vines[z.vine];
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
  const ledges = stageOf(state).ledges;
  for (const c of state.crawlers) {
    if (c.bonked) continue;
    const ledge = ledges[c.ledge];
    c.x += c.dir * speed * dt;
    if (c.x < ledge.x1 + 3) { c.x = ledge.x1 + 3; c.dir = 1; }
    if (c.x > ledge.x2 - 3) { c.x = ledge.x2 - 3; c.dir = -1; }
  }
}

function moveFruit(state, dt, events) {
  const m = state.monkey;
  const ledges = stageOf(state).ledges;
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
    const hitCrawlers = state.crawlers.filter((c) => !c.bonked && knock(c.x, ledges[c.ledge].y - LIZARD_R, LIZARD_R));
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
// stylesheet by the screen.

/** Mix two #rrggbb colours: `t` = 0 is `a`, 1 is `b`. A flat tint, not a gradient. */
function mix(a, b, t) {
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : null);
  const x = hex(a);
  const y = hex(b);
  if (!x || !y) return a;
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

/** The scene's tones, worked out once per palette and time of day. */
const toneCache = new WeakMap();
function tones(colors, sky = 'night') {
  if (!toneCache.has(colors)) toneCache.set(colors, {});
  const cached = toneCache.get(colors);
  if (cached[sky]) return cached[sky];
  const t = {
    // The backdrop, which is what the time of day changes.
    ...{
      night: {
        sky: mix(colors.sky, colors.paper, 0.55), glow: mix(colors.sunshine, colors.paper, 0.45),
        far: mix(colors.sky, colors.paper, 0.2), mid: mix(colors.sky, colors.captain, 0.45),
      },
      dawn: {
        sky: mix(colors.rose, colors.paper, 0.55), glow: mix(colors.sunshine, colors.paper, 0.25),
        far: mix(colors.rose, colors.sky, 0.55), mid: mix(colors.sky, colors.captain, 0.4),
      },
      day: {
        sky: mix(colors.sky, colors.paper, 0.3), glow: colors.sunshine,
        far: mix(colors.sky, colors.captain, 0.18), mid: mix(colors.sky, colors.captain, 0.5),
      },
      sunset: {
        sky: mix(mix(colors.sunshine, colors.poppy, 0.45), colors.paper, 0.45), glow: mix(colors.poppy, colors.paper, 0.25),
        far: mix(colors.rose, colors.poppy, 0.35), mid: mix(colors.rose, colors.captain, 0.55),
      },
    }[sky],
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
  cached[sky] = t;
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

/** A round puff of cloud, flat, with no outline, so it sits back. */
function cloud(g, x, y, w) {
  g.beginPath();
  g.arc(x, y, w * 0.28, 0, Math.PI * 2);
  g.arc(x + w * 0.3, y - w * 0.12, w * 0.32, 0, Math.PI * 2);
  g.arc(x + w * 0.62, y, w * 0.24, 0, Math.PI * 2);
  g.fill();
  g.fillRect(x, y - 0.2, w * 0.62, w * 0.24);
}

function drawScenery(g, colors, t, time, stage) {
  const sky = stage.sky;
  g.fillStyle = t.sky;
  g.fillRect(0, 0, WIDTH, HEIGHT);
  // What is in the sky: a moon and stars, a rising sun, a high sun with
  // clouds, or a big low sun with bands across it.
  g.fillStyle = t.glow;
  if (sky === 'night') {
    g.beginPath(); g.arc(70, 16, 11, 0, Math.PI * 2); g.fill();
    g.fillStyle = t.sky;
    g.beginPath(); g.arc(75, 13, 9, 0, Math.PI * 2); g.fill();
    g.fillStyle = t.glow;
    for (let i = 0; i < 9; i++) {
      const x = (i * 37 + 11) % 96 + 2;
      const y = 6 + ((i * 23) % 34);
      const r = 0.35 + 0.25 * Math.abs(Math.sin(time * 1.5 + i));
      g.beginPath(); g.arc(x, y, r, 0, Math.PI * 2); g.fill();
    }
  } else if (sky === 'dawn') {
    g.beginPath(); g.arc(28, 46, 13, Math.PI, 0); g.fill();
    g.fillStyle = mix(t.glow, colors.paper, 0.5);
    for (const [x, y, w] of [[50, 22, 16], [8, 30, 11]]) cloud(g, x + Math.sin(time * 0.2) * 2, y, w);
  } else if (sky === 'day') {
    g.save();
    g.translate(80, 16);
    g.rotate(time * 0.2);
    g.beginPath();
    for (let i = 0; i < 24; i++) {
      const r = i % 2 ? 7.5 : 11;
      g.lineTo(Math.cos((i * Math.PI) / 12) * r, Math.sin((i * Math.PI) / 12) * r);
    }
    g.closePath(); g.fill();
    g.restore();
    g.fillStyle = mix(t.glow, colors.paper, 0.3);
    g.beginPath(); g.arc(80, 16, 6.5, 0, Math.PI * 2); g.fill();
    g.fillStyle = colors.paper;
    for (const [x, y, w] of [[10, 18, 14], [44, 30, 18], [62, 8, 10]]) cloud(g, (x + time * 1.2) % 120 - 12, y, w);
  } else {
    g.beginPath(); g.arc(50, 44, 19, 0, Math.PI * 2); g.fill();
    g.fillStyle = t.sky;
    for (const [y, h] of [[36, 1.4], [42, 1.8], [48, 2.2]]) g.fillRect(30, y, 40, h);
  }
  // The far canopy: soft round crowns with no outline, so they sit back.
  g.fillStyle = t.far;
  for (let i = 0; i < 9; i++) {
    const x = i * 13 - 4;
    const y = 48 + Math.sin(i * 1.7 + stage.key.x) * 6;
    g.beginPath(); g.arc(x, y, 10 + (i % 3) * 2, 0, Math.PI * 2); g.fill();
  }
  g.fillRect(0, 50, WIDTH, HEIGHT - 50);
  // The mid canopy and its trunks, one tone darker.
  g.fillStyle = t.mid;
  for (const [x, w] of [[6, 5], [36, 4], [80, 6], [96, 4]]) g.fillRect(x - w / 2, 70, w, HEIGHT - 70);
  for (let i = 0; i < 8; i++) {
    const x = i * 15 + 2;
    const y = 76 + Math.sin(i * 2.3 + stage.cage.x) * 5;
    g.beginPath(); g.arc(x, y, 9 + (i % 2) * 3, 0, Math.PI * 2); g.fill();
  }
  // Fireflies at night and dusk; butterflies by day.
  if (sky === 'night' || sky === 'sunset') {
    g.fillStyle = mix(colors.sunshine, colors.paper, 0.45);
    for (let i = 0; i < 7; i++) {
      const x = (i * 29 + time * (3 + i)) % WIDTH;
      const y = 60 + ((i * 37) % 60) + Math.sin(time * 2 + i) * 3;
      g.beginPath(); g.arc(x, y, 0.5, 0, Math.PI * 2); g.fill();
    }
  } else {
    for (let i = 0; i < 3; i++) {
      const x = (i * 41 + time * (4 + i)) % (WIDTH + 10) - 5;
      const y = 70 + i * 17 + Math.sin(time * 1.4 + i * 2) * 4;
      const flap = 0.35 + 0.65 * Math.abs(Math.sin(time * 10 + i));
      g.fillStyle = i % 2 ? colors.rose : colors.sunshine;
      g.save();
      fine(g, 0.6);
      for (const side of [-1, 1]) { g.beginPath(); g.ellipse(x + side * 1.2 * flap, y, 1.2 * flap, 1.5, 0, 0, Math.PI * 2); g.fill(); g.stroke(); }
      g.restore();
    }
  }
  // The jungle floor: soil, a grass edge and a few flowers.
  const floor = stage.ledges[0].y;
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

function drawBranch(g, l, t, floor) {
  if (l === floor) return;
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
function drawMonkey(g, m, colors, t, time, { big = 1, sad = false, lift = false } = {}) {
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
  } else if (pose === 'leap' || lift) {
    // Arms up: leaping, or holding the key high.
    const reach = lift ? [-0.9, -10.2, 0.9, -10.2] : [-2.6, -7.4, 2.6, -7.4];
    limb(-1.3, -4.8, reach[0], reach[1]); limb(1.3, -4.8, reach[2], reach[3]);
    paw(reach[0], reach[1]); paw(reach[2], reach[3]);
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

/** Where the rescue is, as fractions of its beats; null outside it. */
function rescueBeat(state) {
  const r = state.rescue;
  if (!r) return null;
  const { cage } = stageOf(state);
  const side = Math.sign(r.from - cage.x) || 1;
  const between = (a, b) => clamp((r.t - a) / (b - a), 0, 1);
  return {
    t: r.t,
    side,
    lift: between(0, RESCUE.lift),
    carry: between(RESCUE.lift, RESCUE.carry),
    open: between(RESCUE.carry, RESCUE.unlock),
    out: between(RESCUE.unlock, RESCUE.unlock + 0.4),
    free: r.t >= RESCUE.unlock,
  };
}

/** The golden key, its bow at the top, turned by `angle`, centred on (x, y). */
function key(g, x, y, angle, colors, t) {
  g.save();
  g.translate(x, y);
  g.rotate(angle);
  g.fillStyle = colors.sunshine;
  g.beginPath(); g.arc(0, -2.2, 1.9, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = t.sky;
  g.beginPath(); g.arc(0, -2.2, 0.8, 0, Math.PI * 2); g.fill(); g.stroke();
  g.fillStyle = colors.sunshine;
  g.fillRect(-0.5, -0.4, 1, 5); g.strokeRect(-0.5, -0.4, 1, 5);
  g.fillRect(0.5, 2.6, 1.3, 0.8); g.strokeRect(0.5, 2.6, 1.3, 0.8);
  g.fillRect(0.5, 3.8, 1, 0.8); g.strokeRect(0.5, 3.8, 1, 0.8);
  g.restore();
}

/** A four-pointed paper star, the twinkle and the burst. */
function twinkle(g, x, y, r, spin, fill) {
  g.save();
  g.translate(x, y);
  g.rotate(spin);
  g.fillStyle = fill;
  g.beginPath();
  for (let i = 0; i < 8; i++) {
    const k = i % 2 ? r * 0.35 : r;
    g.lineTo(Math.cos((i * Math.PI) / 4) * k, Math.sin((i * Math.PI) / 4) * k);
  }
  g.closePath(); g.fill(); g.stroke();
  g.restore();
}

function drawCage(g, state, colors, t, time) {
  const { cage } = stageOf(state);
  const beat = rescueBeat(state);
  const side = beat ? beat.side : Math.sign(50 - cage.x) || 1;
  const x0 = cage.x - 8;
  // A wooden ledge for it to stand on.
  g.fillStyle = t.wood;
  g.fillRect(x0, cage.y, 16, 4); g.strokeRect(x0, cage.y, 16, 4);
  g.fillStyle = t.woodLight;
  g.fillRect(x0 + 1, cage.y + 0.6, 14, 1);
  // Papa: sad behind the bars, then out through the door and jumping for joy.
  if (!beat || !beat.free) {
    drawMonkey(g, { x: cage.x, y: cage.y, mode: 'ground', face: side, vx: 0 }, colors, t, time, { big: 1.35, sad: true });
  }
  // The roof, the back bars, and the door — the half of the front nearest
  // the branch, hinged at its outer edge, swinging open in the rescue.
  g.fillStyle = t.wood;
  g.fillRect(x0 + 0.2, cage.y - 15.5, 15.6, 2); g.strokeRect(x0 + 0.2, cage.y - 15.5, 15.6, 2);
  const bar = (x, top = cage.y - 13.5, bottom = cage.y) => {
    g.beginPath(); g.moveTo(x, top); g.lineTo(x, bottom);
    const w = g.lineWidth;
    g.lineWidth = w * 1.8; g.strokeStyle = colors.ink; g.stroke();
    g.lineWidth = w * 0.7; g.strokeStyle = colors.sky; g.stroke();
    g.lineWidth = w; g.strokeStyle = colors.ink;
  };
  g.save();
  g.lineCap = 'round';
  const hinge = cage.x + side * 7.4;
  const swing = beat ? 1 - 0.85 * beat.open : 1;
  for (let k = -6.6; k <= 7.1; k += 2.7) {
    const x = cage.x + side * k;
    if (side * (x - cage.x) > 0.5) bar(hinge + (x - hinge) * swing);
    else bar(x);
  }
  // The door's frame, top and bottom.
  const inner = hinge + (cage.x + side * 0.5 - hinge) * swing;
  g.fillStyle = t.woodLight;
  for (const y of [cage.y - 13.8, cage.y - 1.4]) {
    g.beginPath(); g.rect(Math.min(inner, hinge), y, Math.abs(hinge - inner), 1.2); g.fill(); g.stroke();
  }
  g.restore();
  // The padlock on the door: it springs off as the key turns.
  const lockX = hinge + (cage.x + side * 2.5 - hinge) * swing;
  let lockY = cage.y - 6.5;
  let spin = 0;
  if (beat && beat.open > 0) {
    const k = beat.open;
    lockY += -6 * k + 16 * k * k;
    spin = side * k * 3;
  }
  if (!beat || beat.t < RESCUE.unlock + 0.3) {
    g.save();
    g.translate(lockX + (beat ? side * beat.open * 4 : 0), lockY);
    g.rotate(spin);
    g.fillStyle = colors.sunshine;
    g.beginPath(); g.arc(0, beat && beat.open > 0 ? -0.6 : 0, 0.9, Math.PI, 0); g.stroke();
    g.fillRect(-1.2, 0, 2.4, 2); g.strokeRect(-1.2, 0, 2.4, 2);
    g.fillStyle = colors.ink;
    g.beginPath(); g.arc(0, 0.8, 0.25, 0, Math.PI * 2); g.fill();
    g.restore();
  }
  if (beat && beat.free) {
    // Papa hops out beside the little one, and they both jump for joy.
    const k = beat.out;
    const px = cage.x + side * 5.5 * k;
    const hop = Math.abs(Math.sin((beat.t - RESCUE.unlock) * 9)) * 2.4 * Math.min(1, k * 2);
    drawMonkey(g, { x: px, y: cage.y - hop, mode: hop > 0.4 ? 'air' : 'ground', face: side, vx: 0 }, colors, t, time, { big: 1.35 });
  }
}

/** The key: bobbing on its branch, or held up, carried, and turned in the lock. */
function drawKey(g, state, colors, t, time) {
  const stage = stageOf(state);
  const beat = rescueBeat(state);
  const m = state.monkey;
  if (!beat) {
    const bob = Math.sin(time * 3) * 0.6;
    key(g, stage.key.x, stage.key.y - 6 + bob, -0.5, colors, t);
    twinkle(g, stage.key.x + 2.6, stage.key.y - 10 + bob, 0.8 + 0.7 * (Math.sin(time * 4) + 1) / 2, time, colors.paper);
    return;
  }
  if (beat.open > 0) {
    // In the lock, turning, then gone with the lock.
    if (beat.t < RESCUE.unlock) {
      const hinge = stage.cage.x + beat.side * 7.4;
      const swing = 1 - 0.85 * beat.open;
      key(g, hinge + (stage.cage.x + beat.side * 2.5 - hinge) * swing + beat.side * 2.2, stage.cage.y - 5, beat.side * (Math.PI / 2 + beat.open * Math.PI), colors, t);
    }
    return;
  }
  // Held high in both hands, with a ring of sparkles as it is lifted.
  const lift = beat.lift;
  key(g, m.x, m.y - 15 - lift * 1.5, Math.sin(time * 10) * 0.15, colors, t);
  if (lift < 1 || beat.carry < 0.2) {
    const spread = 3 + lift * 6;
    for (let i = 0; i < 6; i++) {
      const a = (i * Math.PI) / 3 + time * 2;
      twinkle(g, m.x + Math.cos(a) * spread, m.y - 16 + Math.sin(a) * spread, 0.9, time * 3, colors.paper);
    }
  }
}

/** The celebration once papa is out: hearts rising, stars and bananas bursting. */
function drawCheer(g, state, colors, t, time) {
  const beat = rescueBeat(state);
  if (!beat || !beat.free) return;
  const { cage } = stageOf(state);
  const since = beat.t - RESCUE.unlock;
  const cx = cage.x + beat.side * 7.5;
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + 0.3;
    const r = 4 + since * 16;
    const x = cx + Math.cos(a) * r;
    const y = cage.y - 10 + Math.sin(a) * r * 0.8 + since * since * 6;
    if (i % 3 === 0) drawBananas(g, x, y, colors, t);
    else twinkle(g, x, y, 1.3, time * 4 + i, i % 2 ? colors.sunshine : colors.paper);
  }
  for (let i = 0; i < 3; i++) {
    const rise = ((since * 1.2 + i * 0.33) % 1);
    heart(g, cx + (i - 1) * 3 + Math.sin(time * 4 + i) * 0.8, cage.y - 14 - rise * 14, 1.3, colors.poppy);
  }
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
export function paint(g, state, { colors, scale, edge }) {
  g.setTransform(scale, 0, 0, scale, 0, 0);
  const stage = stageOf(state);
  const t = tones(colors, stage.sky);
  g.ink = colors.ink;
  g.lineWidth = edge / scale;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = colors.ink;
  const time = state.time;

  drawScenery(g, colors, t, time, stage);
  for (const vine of stage.vines) drawVine(g, vine, t, time);
  for (const l of stage.ledges) drawBranch(g, l, t, stage.ledges[0]);
  drawCage(g, state, colors, t, time);
  drawFringe(g, t);

  for (const f of state.fruit) drawBananas(g, f.x, f.y, colors, t);
  state.lizards.forEach((z, i) => drawLizard(g, z.x, z.y, z.falling ? time * 10 : z.dir > 0 ? Math.PI / 2 : -Math.PI / 2, colors, t, time, i));
  state.crawlers.forEach((c, i) => { if (!c.bonked) drawLizard(g, c.x, stage.ledges[c.ledge].y - 1.2, c.dir > 0 ? 0 : Math.PI, colors, t, time, i + 5); });
  for (const b of state.birds) drawToucan(g, b, colors, t, time);
  for (const n of state.nuts) {
    if (!n.falling) {
      // A flashing shadow on the floor where it will land.
      g.save();
      g.globalAlpha = 0.25 + 0.25 * Math.sin(time * 20);
      g.fillStyle = colors.ink;
      g.beginPath(); g.ellipse(n.x, stage.ledges[0].y - 0.4, NUT_R * 1.3, 0.6, 0, 0, Math.PI * 2); g.fill();
      g.restore();
      continue;
    }
    drawCoconut(g, n.x, n.y, colors, t);
  }

  const blink = state.pause > 0 && Math.floor(state.pause * 8) % 2 === 0;
  const lifting = state.rescue && state.rescue.t < RESCUE.carry;
  if (!blink) drawMonkey(g, state.monkey, colors, t, time, { big: 1.15, lift: lifting });
  drawKey(g, state, colors, t, time);
  drawCheer(g, state, colors, t, time);

  // Lives as hearts, and the bonus on a paper tab, together in the middle of
  // the top — the cage and the key take the two ends, on one side or the
  // other — and out of the way while the key is carried across.
  if (!state.rescue) {
    g.save();
    g.font = '800 3.6px Inter, system-ui, sans-serif';
    g.textAlign = 'left';
    g.textBaseline = 'middle';
    const bonus = `BONUS ${Math.round(state.clock) * 10}`;
    const w = g.measureText(bonus).width + 3;
    const left = WIDTH / 2 - (14 + w) / 2;
    for (let i = 0; i < Math.max(0, state.lives); i++) heart(g, left + 2 + i * 4.6, 13, 1.6, colors.poppy);
    g.fillStyle = colors.paper;
    g.fillRect(left + 14, 10.6, w, 5); g.strokeRect(left + 14, 10.6, w, 5);
    g.fillStyle = colors.ink;
    g.fillText(bonus, left + 15.5, 13.2);
    g.restore();
  }

  const middle = HEIGHT * 0.58;
  if (state.rest > 0) {
    if (state.rescue && state.rescue.t >= RESCUE.unlock) {
      caption(g, 'PAPA IS FREE!', colors, middle, 6.5);
      caption(g, `NEXT: LEVEL ${state.level + 1}`, colors, middle + 10, 4.5);
    } else caption(g, 'YOU GOT THE KEY!', colors, middle, 5.5);
  } else if (state.pause > 0) {
    caption(g, state.lives > 0 ? `OUCH! ${state.lives} ${state.lives === 1 ? 'LIFE' : 'LIVES'} LEFT` : 'OUT OF LIVES', colors, middle, 5);
  } else if (!state.started || state.showLevel > 0) {
    caption(g, `LEVEL ${state.level}`, colors, middle - 8, 6.5);
    caption(g, 'CLIMB TO THE KEY!', colors, middle + 2, 4.5);
    if (!state.started) caption(g, 'HOLD THE ARROWS · TAP JUMP', colors, middle + 10, 3.8);
  }
}
