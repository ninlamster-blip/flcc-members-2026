// Claw: a prize machine, with no DOM in it.
//
// The claw hangs from a rail at the top of the glass. Move it over a prize,
// press DROP, and it goes down, closes and lifts. A good grab carries the
// prize to the chute in the corner; a grab that is off-centre lifts the prize
// and lets it slip halfway up; a grab that misses closes on nothing.
//
// A few decisions shape it:
//
//   · A won toy is seen all the way home: the claw carries it to the chute,
//     opens, and the toy falls into the prize box — the lid flaps open, the
//     box gives a little bounce and the points float up out of it. The toy
//     only counts once it has landed in the box.
//   · Nothing is down to luck. Whether a grab holds is decided by how
//     centred the claw is over the prize, against the level's grip, never by
//     a dice roll — so a careful player always wins, and a test can prove
//     every level can be beaten.
//   · It is played in levels, like Hoops. A level asks for so many prizes
//     from so many tries; make them and the next level starts, run out and
//     the same level starts again. Nobody is sent back to level one.
//   · Every level is at least as hard as the one before, all the way to
//     level 25, where every knob reaches its ceiling and stays:
//       – from the start: the grip forgives less and the toys shrink;
//       – level 3: a clock drops the claw for you if you wait too long;
//       – level 4: a conveyor carries the toys along, faster and faster;
//       – level 6: the claw sways as it drops;
//       – level 9: a slippery claw — a grab that is not near-perfect loses
//         its toy on the way to the box;
//       – level 13: the prize box slides to and fro, and you press DROP again
//         to let go over it — miss and the toy bounces back into the pile;
//       – level 17: heavy toys that the claw cannot lift sit among the others,
//         in the way.
//   · The prizes are toys — a teddy, a bunny, a duck, a dinosaur, a car, a
//     robot, a ball and a yo-yo — drawn in the app's own flat style. Now and
//     then one is gold and worth three times as much.
//   · Everything random comes from a seed kept as a number on the state, so
//     a level can be replayed, a test can try a grab on a copy, and every
//     phone in a room race sees the same machine.
//
// The field is 100 units across and 140 down unless the screen asks for
// taller; the prize floor sits 8 units above the bottom edge. On a taller
// field the claw drops and lifts faster in proportion, so a try takes the
// same time on any phone.

export const WIDTH = 100;
export const HEIGHT = 140;

const RAIL_Y = 14;            // where the claw hangs at rest
const REACH = 6;              // how far the claw's fingers reach below its head
const FLOOR_ABOVE = 8;        // the floor, above the bottom edge
const CHUTE_X = 11;           // over the chute
const CHUTE_WALL = 20;        // the wall between the chute and the prizes
const PIT = { left: 23, right: 97 };
const START_X = 60;
const SPEED = { move: 48, down: 60, up: 50, carry: 55, fall: 160 };
const CLOSE_TIME = 0.35;
const HOVER_TIME = 4;          // seconds the claw waits over a sliding box before letting go itself
const BOX = { width: 18, moving: 8, swing: 5 };   // the prize box's width, fixed and sliding, and how far it slides
const BOUNCE_TIME = 0.45;      // how long the prize box bounces after a toy lands
const POP_TIME = 1.1;         // how long the points float above the box
const BETWEEN = 1.6;          // seconds between levels
const SHOW_LEVEL = 2.4;
const GOLD_EVERY = 6;         // about one prize in six is gold

/** The toys a prize can be: soft ones and hard ones, drawn as symbols in js/core/art.js. */
export const PRIZES = ['teddy', 'bunny', 'duck', 'dino', 'car', 'robot', 'ball', 'yoyo'];
/** The palette tones a prize can be filled with. */
export const TONES = ['sky', 'rose', 'sunshine', 'captain', 'poppy'];

/** The sounds this game makes, for js/games/chiptune.js. */
export const SOUNDS = {
  drop: [{ type: 'triangle', from: 600, to: 300, at: 0, dur: 0.18, gain: 0.05 }],
  grab: [{ type: 'square', from: 220, to: 330, at: 0, dur: 0.08, gain: 0.05 }],
  slip: [{ type: 'sawtooth', from: 400, to: 150, at: 0, dur: 0.25, gain: 0.05 }],
  miss: [{ type: 'square', from: 300, to: 200, at: 0, dur: 0.12, gain: 0.04 }],
  release: [{ type: 'triangle', from: 900, to: 260, at: 0, dur: 0.35, gain: 0.05 }],
  heavy: [{ type: 'sawtooth', from: 160, to: 110, at: 0, dur: 0.3, gain: 0.05 }],
  bounced: [{ type: 'square', from: 500, to: 180, at: 0, dur: 0.22, gain: 0.04 }],
  prize: [
    { type: 'triangle', from: 784, to: 784, at: 0, dur: 0.08, gain: 0.08 },
    { type: 'triangle', from: 1047, to: 1047, at: 0.08, dur: 0.08, gain: 0.08 },
    { type: 'triangle', from: 1568, to: 1568, at: 0.16, dur: 0.16, gain: 0.08 },
  ],
  tick: [{ type: 'square', from: 1200, to: 1200, at: 0, dur: 0.03, gain: 0.03 }],
  level: [523, 659, 784, 1047].map((hz, i) => ({ type: 'square', from: hz, to: hz, at: i * 0.08, dur: 0.1, gain: 0.05 })),
  over: [523, 440, 349, 262].map((hz, i) => ({ type: 'square', from: hz, to: hz, at: i * 0.15, dur: 0.13, gain: 0.05 })),
};

/** The level at which every knob has reached its ceiling. */
export const HARDEST = 25;

/**
 * How hard level `n` is. Every number moves in the harder direction as `n`
 * grows, all the way to HARDEST, and there are always at least two spare tries.
 */
export function level(n) {
  const l = Math.min(HARDEST, Math.max(1, Math.trunc(n) || 1));
  const target = Math.min(10, 2 + Math.floor((l - 1) / 2));
  const spare = Math.max(2, 4 - Math.floor((l - 1) / 3));
  return {
    target,
    tries: target + spare,
    grip: Math.max(0.32, 0.65 - 0.014 * (l - 1)),           // share of a toy's radius a grab may be off and still hold
    size: Math.max(0.68, 1 - 0.0134 * (l - 1)),             // how big the toys are
    clock: l >= 3 ? Math.max(3.5, 10 - 0.3 * (l - 3)) : 0,   // seconds to aim before the claw drops itself
    belt: l >= 4 ? Math.min(13, 3 + 0.48 * (l - 4)) : 0,     // conveyor speed, units a second
    sway: l >= 6 ? Math.min(7, 2 + 0.27 * (l - 6)) : 0,      // how far the claw swings as it drops
    slip: l >= 9 ? Math.max(0.7, 0.95 - 0.016 * (l - 9)) : 1,   // share of the grip that still holds all the way to the box
    box: l >= 13 ? Math.min(2.6, 1.2 + 0.12 * (l - 13)) : 0,    // how fast the prize box slides, radians a second
    heavy: l >= 17 ? Math.min(3, 1 + Math.floor((l - 17) / 4)) : 0,   // toys too heavy to lift
  };
}

/** The next float in [0, 1) from the state's seed. */
function random(state) {
  state.seed = (state.seed * 16807) % 2147483647;
  return (state.seed - 1) / 2147483646;
}

function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }
const floorOf = (state) => state.height - FLOOR_ABOVE;
const pitWidth = PIT.right - PIT.left;
const wrap = (x) => PIT.left + ((((x - PIT.left) % pitWidth) + pitWidth) % pitWidth);

/**
 * A run, parked until the first press. It starts on level one unless told
 * otherwise: `{ level, score }` picks up at that level with that score.
 */
export function create(seed = 1, { level: from = 1, score = 0, height = HEIGHT } = {}) {
  const state = {
    seed: (Math.abs(Math.trunc(seed) || 1) % 2147483646) + 1,
    height: Math.max(HEIGHT, Number(height) || HEIGHT),
    time: 0,
    level: 0,
    score: Math.max(0, Math.trunc(score) || 0),
    started: false,
    over: false,
    rest: 0,
    showLevel: 0,
    prizes: [],
    falling: [],
    claw: { x: START_X, y: RAIL_Y, mode: 'aim', clock: 0, held: null, slipAt: null, sway: 0 },
    aimClock: 0,
    last: null,                 // what the last try did: 'prize', 'slip' or 'miss'
    drop: null,                 // a won toy on its way down into the prize box
    bounce: 0,                  // the box's bounce, counting down
    pop: null,                  // the points floating up out of the box
    hover: 0,                   // seconds left before a hovering claw lets go itself
  };
  startLevel(state, Math.max(1, Math.trunc(from) || 1));
  return state;
}

function newPrize(state, x, y, heavy = false) {
  const config = state.config;
  const r = (heavy ? 10 : 7 + random(state) * 1.5) * config.size;
  return {
    x, y: y ?? floorOf(state) - r, r, vy: 0,
    kind: heavy ? 'robot' : PRIZES[Math.floor(random(state) * PRIZES.length)],
    tone: heavy ? 'captain' : TONES[Math.floor(random(state) * TONES.length)],
    gold: !heavy && random(state) < 1 / GOLD_EVERY,
    heavy,
  };
}

function startLevel(state, n) {
  state.level = n;
  state.config = level(n);
  state.won = 0;
  state.tries = state.config.tries;
  state.levelScore = state.score;
  state.showLevel = SHOW_LEVEL;
  state.falling = [];
  // Prizes in slots along the floor, each nudged a little within its slot.
  const count = Math.max(4, Math.floor(pitWidth / (16 * state.config.size + 2)));
  const slot = pitWidth / count;
  // The heavy toys take evenly spaced slots, never the first, so there is
  // always something liftable either side of them.
  const heavySlots = new Set(Array.from({ length: state.config.heavy }, (_, i) => 1 + Math.floor(((i + 0.5) * (count - 1)) / state.config.heavy)));
  state.prizes = Array.from({ length: count }, (_, i) => {
    const prize = newPrize(state, 0, undefined, heavySlots.has(i));
    const room = Math.max(0, slot / 2 - prize.r - 0.5);
    prize.x = PIT.left + slot * (i + 0.5) + (random(state) * 2 - 1) * room;
    return prize;
  });
  state.claw = { x: state.claw.x, y: RAIL_Y, mode: 'aim', clock: 0, held: null, slipAt: null, sway: 0 };
  state.aimClock = state.config.clock;
  state.hover = 0;
}

/** Where the prize box is now: its left edge and width. It slides from level 13. */
export function box(state) {
  if (!state.config.box) return { left: 2, width: BOX.width };
  const center = CHUTE_X + Math.sin(state.time * state.config.box) * BOX.swing;
  return { left: center - BOX.moving / 2, width: BOX.moving };
}

/** Make the field `height` units tall (never less than HEIGHT). Prizes stay on the floor. */
export function resize(state, height) {
  const tall = Math.max(HEIGHT, Number(height) || HEIGHT);
  const shift = tall - state.height;
  state.height = tall;
  for (const prize of [...state.prizes, ...state.falling]) prize.y += shift;
  return state;
}

/** Where the claw's head actually is, sway included. */
export function clawX(state) {
  return clamp(state.claw.x + state.claw.sway, 6, WIDTH - 6);
}

/** Whether a drop would be taken right now. */
export function ready(state) {
  return !state.over && state.rest === 0 && state.claw.mode === 'aim' && state.tries > 0;
}

/** Whether the claw is holding a toy over a sliding box, waiting to be told to let go. */
export function hovering(state) {
  return !state.over && state.claw.mode === 'hover';
}

/**
 * Drop the claw where it is — or, while it hovers over a sliding box, let go
 * of the toy. Returns what happened.
 */
export function drop(state) {
  if (hovering(state)) { state.claw.mode = 'open'; return []; }
  if (!ready(state)) return [];
  const events = [];
  if (!state.started) { state.started = true; events.push('start'); }
  state.tries -= 1;
  state.last = null;
  state.claw.mode = 'down';
  state.claw.dropTime = state.time;
  events.push('drop');
  return events;
}

/** The prize the claw would close on: the nearest one under its fingers. */
function under(state, x) {
  let best = null;
  for (const prize of state.prizes) {
    const off = Math.abs(prize.x - x);
    if (off <= prize.r + 1.5 && (!best || off < Math.abs(best.x - x))) best = prize;
  }
  return best;
}

/**
 * Advance the machine by `dt` seconds. `input` is what is held now:
 * `{ left, right }`, or `to: x` — a point on the field a finger is over.
 * Moving the claw starts the run as well as dropping it does.
 */
export function step(state, input = {}, dt = 1 / 60) {
  const events = [];
  if (state.over) return events;
  const across = Boolean(input.right) - Boolean(input.left);
  const to = Number.isFinite(input.to) ? input.to : null;
  if (!state.started) {
    if (!across && to === null) return events;
    state.started = true;
    events.push('start');
  }
  dt = Math.min(dt, 0.05);
  state.time += dt;
  state.showLevel = Math.max(0, state.showLevel - dt);
  state.bounce = Math.max(0, state.bounce - dt);
  if (state.pop) { state.pop.t -= dt; if (state.pop.t <= 0) state.pop = null; }
  const config = state.config;
  const floor = floorOf(state);
  const tallness = state.height / HEIGHT;

  // The conveyor carries everything on the floor along, round and round.
  if (config.belt) for (const prize of state.prizes) prize.x = wrap(prize.x + config.belt * dt);

  // Prizes in the air fall to the floor (or, over the chute, are won).
  for (const prize of state.falling) {
    prize.vy += SPEED.fall * tallness * dt;
    prize.y += prize.vy * dt;
    if (prize.y >= floor - prize.r) {
      prize.y = floor - prize.r;
      prize.vy = 0;
      prize.x = clamp(prize.x, PIT.left + prize.r, PIT.right - prize.r);
      state.prizes.push(prize);
      prize.landed = true;
    }
  }
  state.falling = state.falling.filter((prize) => !prize.landed);

  if (state.rest > 0) {
    state.rest = Math.max(0, state.rest - dt);
    if (state.rest === 0) { startLevel(state, state.level + 1); events.push('next'); }
    return events;
  }

  const claw = state.claw;
  switch (claw.mode) {
    case 'aim': {
      if (to !== null) {
        const gap = clamp(to, 6, WIDTH - 6) - claw.x;
        claw.x += Math.sign(gap) * Math.min(Math.abs(gap), SPEED.move * dt);
      } else if (across) {
        claw.x = clamp(claw.x + across * SPEED.move * dt, 6, WIDTH - 6);
      }
      if (config.clock && state.tries > 0) {
        const before = Math.ceil(state.aimClock);
        state.aimClock = Math.max(0, state.aimClock - dt);
        if (Math.ceil(state.aimClock) < before && state.aimClock <= 3) events.push('tick');
        if (state.aimClock === 0) events.push(...drop(state));
      }
      break;
    }
    case 'down': {
      if (config.sway) claw.sway = Math.sin((state.time - claw.dropTime) * 3) * config.sway;
      const x = clawX(state);
      const target = under(state, x);
      const bottom = target ? target.y - target.r * 0.5 : floor;
      claw.y += SPEED.down * tallness * dt;
      if (claw.y + REACH >= bottom) { claw.y = bottom - REACH; claw.mode = 'close'; claw.clock = CLOSE_TIME; }
      break;
    }
    case 'close': {
      claw.clock -= dt;
      if (claw.clock > 0) break;
      const x = clawX(state);
      const prize = under(state, x);
      const off = prize ? Math.abs(prize.x - x) : Infinity;
      if (prize && prize.heavy && off <= prize.r * 0.95) {
        // Too heavy: the claw closes on it, strains, and comes up empty.
        events.push('heavy');
        state.last = 'heavy';
      } else if (prize && off <= prize.r * config.grip) {
        claw.held = prize;
        // A slippery claw keeps hold all the way only if the grab was near-perfect.
        claw.slips = off > prize.r * config.grip * config.slip;
        events.push('grab');
      } else if (prize && off <= prize.r * 0.95) {
        claw.held = prize;
        claw.slipAt = (claw.y + RAIL_Y) / 2;          // it lets go halfway up
        events.push('grab');
      } else {
        events.push('miss');
        state.last = 'miss';
      }
      if (claw.held) state.prizes = state.prizes.filter((one) => one !== claw.held);
      claw.mode = 'up';
      break;
    }
    case 'up': {
      claw.y = Math.max(RAIL_Y, claw.y - SPEED.up * tallness * dt);
      claw.sway *= Math.max(0, 1 - dt * 4);
      if (claw.held && claw.slipAt !== null && claw.y <= claw.slipAt) {
        const prize = claw.held;
        prize.x = clawX(state);
        prize.y = claw.y + REACH + prize.r * 0.5;
        prize.vy = 0;
        state.falling.push(prize);
        claw.held = null;
        claw.slipAt = null;
        events.push('slip');
        state.last = 'slip';
      }
      if (claw.y === RAIL_Y) {
        claw.x = clawX(state);
        claw.sway = 0;
        if (claw.held) claw.mode = 'carry';
        else endTry(state, events);
      }
      break;
    }
    case 'carry': {
      if (!claw.carryFrom) claw.carryFrom = claw.x;
      const gap = CHUTE_X - claw.x;
      claw.x += Math.sign(gap) * Math.min(Math.abs(gap), SPEED.carry * dt);
      // A slippery claw loses its toy halfway along, back into the pile.
      const halfway = Math.max(PIT.left + 4, (claw.carryFrom + CHUTE_X) / 2);
      if (claw.held && claw.slips && claw.x <= halfway) {
        const prize = claw.held;
        prize.x = claw.x;
        prize.y = claw.y + REACH + prize.r * 0.5;
        prize.vy = 0;
        state.falling.push(prize);
        claw.held = null;
        claw.slips = false;
        events.push('slip');
        state.last = 'slip';
      }
      if (claw.x === CHUTE_X) {
        claw.carryFrom = null;
        if (!claw.held) endTry(state, events);
        else if (config.box) { claw.mode = 'hover'; state.hover = HOVER_TIME; events.push('hover'); }
        else claw.mode = 'open';
      }
      break;
    }
    case 'hover': {
      // Over a sliding box: DROP lets go, and so does the clock.
      const before = Math.ceil(state.hover);
      state.hover = Math.max(0, state.hover - dt);
      if (Math.ceil(state.hover) < before && state.hover <= 2) events.push('tick');
      if (state.hover === 0) claw.mode = 'open';
      break;
    }
    case 'open': {
      // The claw lets go, and the toy falls the whole way into the box.
      if (claw.held) {
        const toy = claw.held;
        claw.held = null;
        state.drop = { ...toy, x: CHUTE_X, y: claw.y + REACH + toy.r * 0.5, vy: 0, spin: 0 };
        events.push('release');
      }
      const toy = state.drop;
      toy.vy += SPEED.fall * tallness * dt;
      toy.y += toy.vy * dt;
      toy.spin += dt * 5;
      if (toy.y < floor - 3) break;
      const prize = toy;
      state.drop = null;
      const into = box(state);
      if (toy.x < into.left + 1 || toy.x > into.left + into.width - 1) {
        // It missed the sliding box, and bounces back into the pile.
        state.falling.push({ ...toy, x: PIT.left + toy.r + 1, y: floor - 20, vy: 0 });
        events.push('bounced');
        state.last = 'bounced';
        endTry(state, events);
        break;
      }
      state.bounce = BOUNCE_TIME;
      state.won += 1;
      const points = (prize.gold ? 30 : 10) + (prize.r < 6 ? 5 : 0);
      state.score += points;
      state.lastPrize = { kind: prize.kind, tone: prize.tone, gold: prize.gold, points };
      state.pop = { text: `+${points}`, t: POP_TIME };
      state.last = 'prize';
      events.push('prize');
      // A new prize drops onto the pile where there is most room.
      state.falling.push(newPrize(state, roomiest(state), RAIL_Y + 6));
      endTry(state, events);
      break;
    }
    default: break;
  }
  return events;
}

/** The middle of the widest gap on the floor, for a new prize to land in. */
function roomiest(state) {
  const xs = [...state.prizes, ...state.falling].map((prize) => prize.x).sort((a, b) => a - b);
  const edges = [PIT.left, ...xs, PIT.right];
  let best = { gap: -1, x: (PIT.left + PIT.right) / 2 };
  for (let i = 1; i < edges.length; i++) {
    const gap = edges[i] - edges[i - 1];
    if (gap > best.gap) best = { gap, x: (edges[i] + edges[i - 1]) / 2 };
  }
  return clamp(best.x, PIT.left + 7, PIT.right - 7);
}

function endTry(state, events) {
  state.claw.mode = 'aim';
  state.claw.slipAt = null;
  state.claw.slips = false;
  state.claw.carryFrom = null;
  state.aimClock = state.config.clock;
  if (state.won >= state.config.target) {
    state.score += state.tries * 5;            // every try not needed is worth a little
    state.rest = BETWEEN;
    events.push('level');
  } else if (state.tries <= 0) {
    state.over = true;
    events.push('over');
  }
}

// ── Drawing ────────────────────────────────────────────────────────────────
//
// A prize machine drawn in the app's poster system: flat fills only — tints
// mixed from the palette for depth, never a gradient — and one navy outline.
// Inside the glass: a patterned back wall, a gantry rail the claw rides on, a
// padded floor (a moving belt when the conveyor runs), toys with shadows, a
// decorated prize box, and two strips of reflection on the glass. `colors` is
// the palette read out of the stylesheet; `sprite` is a function the screen
// supplies that returns a ready image of an art symbol in a tone, or null.

/** Mix two #rrggbb colours: `t` = 0 is `a`, 1 is `b`. A flat tint, not a gradient. */
function mix(a, b, t) {
  const hex = (c) => (/^#[0-9a-f]{6}$/i.test(c) ? [1, 3, 5].map((i) => parseInt(c.slice(i, i + 2), 16)) : null);
  const x = hex(a);
  const y = hex(b);
  if (!x || !y) return a;
  return `#${x.map((v, i) => Math.round(v + (y[i] - v) * t).toString(16).padStart(2, '0')).join('')}`;
}

const toneCache = new WeakMap();
function tones(colors) {
  if (toneCache.has(colors)) return toneCache.get(colors);
  const t = {
    wall: mix(colors.sky, colors.paper, 0.45),
    wallDot: mix(colors.sky, colors.paper, 0.1),
    metal: mix(colors.sky, colors.captain, 0.35),
    metalDark: mix(colors.captain, colors.ink, 0.25),
    pad: mix(colors.rose, colors.paper, 0.3),
    padDark: mix(colors.rose, colors.poppy, 0.35),
    belt: mix(colors.captain, colors.ink, 0.55),
    shadow: mix(colors.sky, colors.ink, 0.35),
    boxFront: colors.poppy,
    boxSide: mix(colors.poppy, colors.ink, 0.3),
    glass: colors.paper,
  };
  toneCache.set(colors, t);
  return t;
}

function tab(g, text, colors, x, y, size, align = 'center') {
  g.save();
  g.font = `900 ${size}px Inter, system-ui, sans-serif`;
  g.textBaseline = 'middle';
  const w = g.measureText(text).width + size * 1.4;
  const left = align === 'center' ? x - w / 2 : align === 'right' ? x - w : x;
  g.fillStyle = colors.paper;
  g.beginPath();
  g.roundRect?.(left, y - size * 0.85, w, size * 1.7, size * 0.85);
  if (!g.roundRect) g.rect(left, y - size * 0.85, w, size * 1.7);
  g.fill();
  g.stroke();
  g.fillStyle = colors.ink;
  g.textAlign = 'center';
  g.fillText(text, left + w / 2, y + size * 0.05);
  g.restore();
}
const caption = (g, text, colors, y, size = 7) => tab(g, text, colors, WIDTH / 2, y, size);

function drawPrize(g, prize, colors, sprite, t, shadow = false) {
  if (shadow && t) {
    // A soft-edged-looking but flat shadow on the floor under each toy.
    g.fillStyle = t.shadow;
    g.beginPath(); g.ellipse(prize.x, prize.y + prize.r * 0.95, prize.r * 0.9, prize.r * 0.22, 0, 0, Math.PI * 2); g.fill();
  }
  const image = sprite ? sprite(prize.kind, prize.gold ? 'sunshine' : prize.tone) : null;
  g.save();
  if (prize.gold) {
    // A gold toy sits in a sunburst.
    g.fillStyle = colors.sunshine;
    g.beginPath();
    for (let i = 0; i < 16; i++) {
      const r = prize.r + (i % 2 ? 0.6 : 2.2);
      g.lineTo(prize.x + Math.cos((i * Math.PI) / 8) * r, prize.y + Math.sin((i * Math.PI) / 8) * r);
    }
    g.closePath();
    g.fill();
    g.stroke();
  }
  if (image) {
    const size = prize.r * 2.5;
    g.drawImage(image, prize.x - size / 2, prize.y - size / 2, size, size);
  } else {
    g.beginPath();
    g.arc(prize.x, prize.y, prize.r, 0, Math.PI * 2);
    g.fillStyle = colors[prize.tone] || colors.rose;
    g.fill();
    g.stroke();
  }
  g.restore();
  if (prize.heavy) {
    // A heavy toy wears a weight tag on a string: the claw cannot lift it.
    g.save();
    const ty = prize.y - prize.r - 4.2;
    g.beginPath(); g.moveTo(prize.x, prize.y - prize.r + 1); g.lineTo(prize.x, ty + 2); g.stroke();
    g.fillStyle = colors.ink;
    g.beginPath();
    g.moveTo(prize.x - 4, ty - 2); g.lineTo(prize.x + 4, ty - 2); g.lineTo(prize.x + 5, ty + 2.2); g.lineTo(prize.x - 5, ty + 2.2); g.closePath();
    g.fill();
    g.fillStyle = colors.paper;
    g.font = '900 2.8px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('HEAVY', prize.x, ty + 0.2);
    g.restore();
  }
}

/** The back wall of the cabinet, the side posts and the gantry rail. */
function drawCabinet(g, state, colors, t, floor) {
  const tall = state.height;
  g.fillStyle = t.wall;
  g.fillRect(0, 0, WIDTH, tall);
  // A pattern of little stars on the back wall, flat and quiet.
  g.fillStyle = t.wallDot;
  for (let y = 16; y < floor - 20; y += 12) {
    for (let x = (y / 12) % 2 ? 10 : 4; x < WIDTH; x += 12) {
      g.beginPath();
      for (let i = 0; i < 10; i++) {
        const r = i % 2 ? 0.7 : 1.6;
        g.lineTo(x + Math.cos((i * Math.PI) / 5 - Math.PI / 2) * r, y + Math.sin((i * Math.PI) / 5 - Math.PI / 2) * r);
      }
      g.closePath();
      g.fill();
    }
  }
  // The gantry: a metal rail with rivets.
  g.fillStyle = t.metal;
  g.fillRect(0, 1.5, WIDTH, 4);
  g.strokeRect(0, 1.5, WIDTH, 4);
  g.fillStyle = t.metalDark;
  for (let x = 4; x < WIDTH; x += 8) { g.beginPath(); g.arc(x, 3.5, 0.55, 0, Math.PI * 2); g.fill(); }
}

/** The floor: a padded cushion, or a moving belt with rollers when the conveyor runs. */
function drawFloor(g, state, colors, t, floor) {
  const bottom = state.height;
  if (state.config.belt) {
    g.fillStyle = t.belt;
    g.fillRect(PIT.left - 2, floor, PIT.right - PIT.left + 4, bottom - floor);
    g.strokeRect(PIT.left - 2, floor, PIT.right - PIT.left + 4, bottom - floor);
    // Cleats moving with the belt, and a roller at each end.
    g.fillStyle = t.metal;
    const offset = (state.time * state.config.belt) % 7;
    for (let x = PIT.left + offset; x < PIT.right; x += 7) g.fillRect(x, floor + 0.6, 1.2, 1.4);
    for (const x of [PIT.left - 1, PIT.right + 1]) {
      g.save();
      g.translate(x, floor + 3.5);
      g.rotate(state.time * state.config.belt * 0.6);
      g.fillStyle = t.metal;
      g.beginPath(); g.arc(0, 0, 2.6, 0, Math.PI * 2); g.fill(); g.stroke();
      g.beginPath(); g.moveTo(-2.6, 0); g.lineTo(2.6, 0); g.moveTo(0, -2.6); g.lineTo(0, 2.6); g.stroke();
      g.restore();
    }
  } else {
    g.fillStyle = t.pad;
    g.fillRect(CHUTE_WALL, floor, WIDTH - CHUTE_WALL, bottom - floor);
    g.strokeRect(CHUTE_WALL, floor, WIDTH - CHUTE_WALL, bottom - floor);
    // Quilted stitching on the cushion.
    g.save();
    g.lineWidth *= 0.45;
    g.setLineDash([0.8, 0.8]);
    g.beginPath();
    for (let x = CHUTE_WALL + 5; x < WIDTH; x += 6) { g.moveTo(x, floor + 1); g.lineTo(x, bottom - 1); }
    g.moveTo(CHUTE_WALL + 1, floor + (bottom - floor) / 2); g.lineTo(WIDTH - 1, floor + (bottom - floor) / 2);
    g.stroke();
    g.restore();
  }
}

/**
 * The prize box, with a toy falling into it: the toy is drawn only above the
 * box's open top, so it disappears inside as it lands. The lid flaps open
 * while a toy is coming, and the box squashes and springs back when one lands.
 */
function drawBox(g, state, colors, t, floor, sprite) {
  const { left, width } = box(state);
  if (state.config.box) {
    // The rail the sliding box runs along.
    g.fillStyle = t.metal;
    g.fillRect(0.5, floor + FLOOR_ABOVE - 2.6, CHUTE_WALL, 1.6);
    g.strokeRect(0.5, floor + FLOOR_ABOVE - 2.6, CHUTE_WALL, 1.6);
  }
  const squash = state.bounce > 0 ? Math.sin((1 - state.bounce / BOUNCE_TIME) * Math.PI) * 2.2 : 0;
  const top = floor - 20 + squash;
  const bottom = floor + FLOOR_ABOVE - 2.6;
  const toy = state.drop;
  if (toy) {
    g.save();
    g.beginPath();
    g.rect(0, 0, CHUTE_WALL + 4, top + 0.5);
    g.clip();
    g.save();
    g.translate(toy.x, toy.y);
    g.rotate(Math.sin(toy.spin) * 0.35);
    drawPrize(g, { ...toy, x: 0, y: 0 }, colors, sprite, t);
    g.restore();
    g.restore();
  }
  // The box: a dark rim inside the open top, a bright front, a star badge.
  g.fillStyle = t.boxSide;
  g.fillRect(left, top, width, 2.4);
  g.strokeRect(left, top, width, 2.4);
  g.fillStyle = t.boxFront;
  g.fillRect(left, top + 2.4, width, bottom - top - 2.4);
  g.strokeRect(left, top + 2.4, width, bottom - top - 2.4);
  g.fillStyle = colors.sunshine;
  const cx = left + width / 2;
  const cy = top + 2.4 + (bottom - top - 2.4) * 0.38;
  const r = Math.min(width * 0.32, 4.2);
  g.beginPath();
  for (let i = 0; i < 10; i++) {
    const rr = i % 2 ? r * 0.45 : r;
    g.lineTo(cx + Math.cos((i * Math.PI) / 5 - Math.PI / 2) * rr, cy + Math.sin((i * Math.PI) / 5 - Math.PI / 2) * rr);
  }
  g.closePath();
  g.fill();
  g.stroke();
  if (width >= 12) {
    g.fillStyle = colors.paper;
    g.font = '900 3.4px Inter, system-ui, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText('PRIZE', cx, top + 2.4 + (bottom - top - 2.4) * 0.78);
  }
  // The lid: two flaps, swung open while a toy is on its way in.
  const open = toy || state.bounce > 0 ? 1 : 0;
  g.fillStyle = t.boxSide;
  for (const [x, dir] of [[left, -1], [left + width, 1]]) {
    g.beginPath();
    g.moveTo(x, top);
    g.lineTo(x + dir * (open ? 3 : 0) - dir * (open ? 0 : 0), top - (open ? 5 : 0.01));
    g.lineTo(x + dir * (open ? 4.2 : 0), top - (open ? 4.4 : 0.01));
    g.lineTo(x + dir * (open ? 1.2 : 0), top + 0.6);
    g.closePath();
    g.fill();
    g.stroke();
  }
  // The points, floating up out of the box and fading.
  if (state.pop) {
    const rise = 1 - state.pop.t / POP_TIME;
    g.save();
    g.globalAlpha = Math.min(1, state.pop.t * 2);
    tab(g, state.pop.text, colors, cx, top - 7 - rise * 14, 4.6);
    g.restore();
  }
}

/** The claw: a carriage on the rail, a cable, a motor housing with a light, three prongs. */
function drawClaw(g, x, y, mode, colors, t, time) {
  // Carriage riding the rail.
  g.fillStyle = t.metalDark;
  g.fillRect(x - 4, 0.8, 8, 5.4);
  g.strokeRect(x - 4, 0.8, 8, 5.4);
  g.fillStyle = colors.ink;
  for (const dx of [-2.2, 2.2]) { g.beginPath(); g.arc(x + dx, 1.4, 0.8, 0, Math.PI * 2); g.fill(); }
  // Cable: two strands.
  g.save();
  g.lineWidth *= 0.6;
  g.beginPath();
  g.moveTo(x - 0.5, 6.2); g.lineTo(x - 0.5, y - 4);
  g.moveTo(x + 0.5, 6.2); g.lineTo(x + 0.5, y - 4);
  g.stroke();
  g.restore();
  // Motor housing with a status light: sunshine while aiming, poppy while working.
  g.fillStyle = t.metal;
  g.beginPath();
  g.moveTo(x - 3.4, y - 4); g.lineTo(x + 3.4, y - 4); g.lineTo(x + 4.2, y); g.lineTo(x - 4.2, y); g.closePath();
  g.fill();
  g.stroke();
  g.fillStyle = mode === 'aim' ? colors.sunshine : colors.poppy;
  g.beginPath(); g.arc(x, y - 2, 0.8 + (mode === 'aim' ? Math.sin(time * 6) * 0.15 : 0), 0, Math.PI * 2); g.fill(); g.stroke();
  // Three prongs: open while aiming or dropping, shut once closed.
  const shut = mode === 'up' || mode === 'carry' || mode === 'hover' || mode === 'close';
  const open = shut ? 0 : 1;
  // Each prong is an elbow and a hooked tip, mirrored left and right.
  const elbow = [1.9 + 1.6 * open, 3.2];
  const tip = [0.5 + 1.4 * open, 6.4];
  const w = g.lineWidth;
  const prong = (side, front) => {
    g.beginPath();
    g.moveTo(x, y + 0.6);
    g.lineTo(x + side * elbow[0], y + elbow[1]);
    g.lineTo(x + side * tip[0], y + tip[1]);
    g.lineWidth = w * 3.4; g.strokeStyle = colors.ink; g.stroke();
    g.lineWidth = w * 1.5; g.strokeStyle = front ? t.metal : t.metalDark; g.stroke();
  };
  g.save();
  g.lineCap = 'round'; g.lineJoin = 'round';
  // The back prong, shorter and in shadow.
  g.beginPath(); g.moveTo(x, y + 0.6); g.lineTo(x, y + 5.2);
  g.lineWidth = w * 3.4; g.strokeStyle = colors.ink; g.stroke();
  g.lineWidth = w * 1.5; g.strokeStyle = t.metalDark; g.stroke();
  prong(-1, true);
  prong(1, true);
  g.restore();
  g.fillStyle = t.metalDark;
  g.beginPath(); g.arc(x, y + 0.6, 1.3, 0, Math.PI * 2); g.fill(); g.stroke();
}

/** Two strips of reflection on the glass, drawn last, quietly. */
function drawGlass(g, state, t) {
  g.save();
  g.globalAlpha = 0.22;
  g.fillStyle = t.glass;
  for (const [x, w] of [[64, 7], [76, 2.5]]) {
    g.beginPath();
    g.moveTo(x, 6); g.lineTo(x + w, 6); g.lineTo(x + w - 24, state.height * 0.62); g.lineTo(x - 24, state.height * 0.62);
    g.closePath();
    g.fill();
  }
  g.restore();
}

/** Paint the whole machine. `scale` is canvas pixels per field unit, `edge` the outline in canvas pixels. */
export function paint(g, state, { colors, scale, edge, sprite = null }) {
  g.setTransform(scale, 0, 0, scale, 0, 0);
  const tall = state.height;
  const floor = floorOf(state);
  const t = tones(colors);
  g.lineWidth = edge / scale;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = colors.ink;

  drawCabinet(g, state, colors, t, floor);
  drawFloor(g, state, colors, t, floor);
  // The wall between the prize box and the toys.
  g.fillStyle = t.metal;
  g.fillRect(CHUTE_WALL - 1.6, floor - 20, 1.6, tall - floor + 20);
  g.strokeRect(CHUTE_WALL - 1.6, floor - 20, 1.6, tall - floor + 20);
  drawBox(g, state, colors, t, floor, sprite);

  // The toys, with the conveyor's wrap drawn on both sides of the seam.
  g.save();
  g.beginPath();
  g.rect(PIT.left - 1, 0, pitWidth + 2, tall);
  g.clip();
  for (const prize of state.prizes) {
    drawPrize(g, prize, colors, sprite, t, true);
    if (state.config.belt && prize.x + prize.r > PIT.right) drawPrize(g, { ...prize, x: prize.x - pitWidth }, colors, sprite, t, true);
  }
  g.restore();
  for (const prize of state.falling) drawPrize(g, prize, colors, sprite, t);

  // The claw, and whatever it holds.
  const claw = state.claw;
  const x = clawX(state);
  if (claw.held) drawPrize(g, { ...claw.held, x, y: claw.y + REACH + claw.held.r * 0.5 }, colors, sprite, t);
  drawClaw(g, x, claw.y, claw.mode, colors, t, state.time);
  drawGlass(g, state, t);

  // The numbers that belong in the glass, on paper tabs.
  tab(g, `${state.won}/${state.config.target} · ${state.tries} ${state.tries === 1 ? 'try' : 'tries'}`, colors, WIDTH - 2.5, 11, 3.6, 'right');
  if (state.config.clock && claw.mode === 'aim' && state.started && !state.rest) {
    tab(g, `DROPS IN ${Math.ceil(state.aimClock)}`, colors, 2.5, 11, 3.6, 'left');
  }

  const middle = tall * 0.42;
  if (state.rest > 0) {
    caption(g, `LEVEL ${state.level} DONE!`, colors, middle, 6.5);
    caption(g, `NEXT: LEVEL ${state.level + 1}`, colors, middle + 10, 4.5);
  } else if (!state.started || state.showLevel > 0) {
    caption(g, `LEVEL ${state.level}`, colors, middle - 8, 6.5);
    caption(g, `WIN ${state.config.target} TOYS IN ${state.config.tries} TRIES`, colors, middle + 2, 4.5);
    if (!state.started) caption(g, 'MOVE THE CLAW, THEN DROP', colors, middle + 10, 3.8);
  } else if (state.last === 'prize' && claw.mode === 'aim' && state.lastPrize) {
    caption(g, `${state.lastPrize.gold ? 'GOLD! ' : ''}+${state.lastPrize.points}`, colors, middle, 6);
  } else if (claw.mode === 'hover') {
    caption(g, 'PRESS DROP TO LET GO!', colors, middle, 4.8);
    caption(g, `LETS GO IN ${Math.ceil(state.hover)}`, colors, middle + 8, 3.8);
  } else if (state.last === 'slip' && (claw.mode === 'up' || claw.mode === 'carry' || claw.mode === 'aim')) {
    caption(g, 'SO CLOSE — IT SLIPPED!', colors, middle, 4.8);
  } else if (state.last === 'heavy' && (claw.mode === 'up' || claw.mode === 'aim')) {
    caption(g, 'TOO HEAVY TO LIFT!', colors, middle, 4.8);
  } else if (state.last === 'bounced' && claw.mode === 'aim') {
    caption(g, 'MISSED THE BOX!', colors, middle, 4.8);
  }
}
