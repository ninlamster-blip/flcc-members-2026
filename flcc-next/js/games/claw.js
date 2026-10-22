// Claw: a prize machine, with no DOM in it.
//
// The claw hangs from a rail at the top of the glass. Move it over a prize,
// press DROP, and it goes down, closes and lifts. A good grab carries the
// prize to the chute in the corner; a grab that is off-centre lifts the prize
// and lets it slip halfway up; a grab that misses closes on nothing.
//
// A few decisions shape it:
//
//   · Nothing is down to luck. Whether a grab holds is decided by how
//     centred the claw is over the prize, against the level's grip, never by
//     a dice roll — so a careful player always wins, and a test can prove
//     every level can be beaten.
//   · It is played in levels, like Hoops. A level asks for so many prizes
//     from so many tries; make them and the next level starts, run out and
//     the same level starts again. Nobody is sent back to level one.
//   · Every level is at least as hard as the one before, and each knob stops
//     at a ceiling: the grip forgives less, prizes get smaller, a clock
//     drops the claw for you from level three, a conveyor carries the
//     prizes along from level four, and the claw sways as it drops from
//     level six.
//   · The prizes are the app's own drawings. Now and then one is gold and
//     worth three times as much.
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
const OPEN_TIME = 0.3;
const BETWEEN = 1.6;          // seconds between levels
const SHOW_LEVEL = 2.4;
const GOLD_EVERY = 6;         // about one prize in six is gold

/** The drawings a prize can be — symbols in js/core/art.js. */
export const PRIZES = ['star', 'heart', 'rocket', 'chicken', 'book', 'light', 'bulb', 'flag', 'shield', 'ball', 'plant', 'bolt'];
/** The palette tones a prize can be filled with. */
export const TONES = ['sky', 'rose', 'sunshine', 'captain', 'poppy'];

/** The sounds this game makes, for js/games/chiptune.js. */
export const SOUNDS = {
  drop: [{ type: 'triangle', from: 600, to: 300, at: 0, dur: 0.18, gain: 0.05 }],
  grab: [{ type: 'square', from: 220, to: 330, at: 0, dur: 0.08, gain: 0.05 }],
  slip: [{ type: 'sawtooth', from: 400, to: 150, at: 0, dur: 0.25, gain: 0.05 }],
  miss: [{ type: 'square', from: 300, to: 200, at: 0, dur: 0.12, gain: 0.04 }],
  prize: [
    { type: 'triangle', from: 784, to: 784, at: 0, dur: 0.08, gain: 0.08 },
    { type: 'triangle', from: 1047, to: 1047, at: 0.08, dur: 0.08, gain: 0.08 },
    { type: 'triangle', from: 1568, to: 1568, at: 0.16, dur: 0.16, gain: 0.08 },
  ],
  tick: [{ type: 'square', from: 1200, to: 1200, at: 0, dur: 0.03, gain: 0.03 }],
  level: [523, 659, 784, 1047].map((hz, i) => ({ type: 'square', from: hz, to: hz, at: i * 0.08, dur: 0.1, gain: 0.05 })),
  over: [523, 440, 349, 262].map((hz, i) => ({ type: 'square', from: hz, to: hz, at: i * 0.15, dur: 0.13, gain: 0.05 })),
};

/**
 * How hard level `n` is. Every number moves in the harder direction as `n`
 * grows and stops at a ceiling, and there are always at least two spare tries.
 */
export function level(n) {
  const l = Math.max(1, Math.trunc(n) || 1);
  const target = Math.min(8, 2 + Math.floor((l - 1) / 2));
  const spare = Math.max(2, 4 - Math.floor((l - 1) / 3));
  return {
    target,
    tries: target + spare,
    grip: Math.max(0.3, 0.65 - 0.025 * (l - 1)),       // share of a prize's radius a grab may be off and still hold
    size: Math.max(0.7, 1 - 0.025 * (l - 1)),          // how big the prizes are
    clock: l >= 3 ? Math.max(4, 10 - 0.4 * (l - 3)) : 0,   // seconds to aim before the claw drops itself
    belt: l >= 4 ? Math.min(12, 3 + 0.8 * (l - 4)) : 0,    // conveyor speed, units a second
    sway: l >= 6 ? Math.min(6, 2 + 0.35 * (l - 6)) : 0,    // how far the claw swings as it drops
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
  };
  startLevel(state, Math.max(1, Math.trunc(from) || 1));
  return state;
}

function newPrize(state, x, y) {
  const config = state.config;
  const r = (5.5 + random(state) * 1.5) * config.size;
  return {
    x, y: y ?? floorOf(state) - r, r, vy: 0,
    kind: PRIZES[Math.floor(random(state) * PRIZES.length)],
    tone: TONES[Math.floor(random(state) * TONES.length)],
    gold: random(state) < 1 / GOLD_EVERY,
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
  const count = Math.max(4, Math.floor(pitWidth / (13 * state.config.size + 2)));
  const slot = pitWidth / count;
  state.prizes = Array.from({ length: count }, (_, i) => {
    const prize = newPrize(state, 0);
    const room = Math.max(0, slot / 2 - prize.r - 0.5);
    prize.x = PIT.left + slot * (i + 0.5) + (random(state) * 2 - 1) * room;
    return prize;
  });
  state.claw = { x: state.claw.x, y: RAIL_Y, mode: 'aim', clock: 0, held: null, slipAt: null, sway: 0 };
  state.aimClock = state.config.clock;
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

/** Drop the claw where it is. Returns what happened. */
export function drop(state) {
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
      if (prize && off <= prize.r * config.grip) {
        claw.held = prize;
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
      const gap = CHUTE_X - claw.x;
      claw.x += Math.sign(gap) * Math.min(Math.abs(gap), SPEED.carry * dt);
      if (claw.x === CHUTE_X) { claw.mode = 'open'; claw.clock = OPEN_TIME; }
      break;
    }
    case 'open': {
      claw.clock -= dt;
      if (claw.clock > 0) break;
      const prize = claw.held;
      claw.held = null;
      state.won += 1;
      const points = (prize.gold ? 30 : 10) + (prize.r < 5 ? 5 : 0);
      state.score += points;
      state.lastPrize = { kind: prize.kind, tone: prize.tone, gold: prize.gold, points };
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
// The poster system on a prize machine: paper behind, flat palette fills, one
// navy outline. `colors` is the palette read out of the stylesheet; `sprite`
// is a function the screen supplies that returns a ready image of an art
// symbol in a tone, or null while it is still loading.

function caption(g, text, colors, y, size = 7) {
  g.fillStyle = colors.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 ${size}px Inter, system-ui, sans-serif`;
  g.fillText(text, WIDTH / 2, y);
}

function drawPrize(g, prize, colors, sprite) {
  const image = sprite ? sprite(prize.kind, prize.gold ? 'sunshine' : prize.tone) : null;
  g.save();
  if (prize.gold) {
    g.beginPath();
    g.arc(prize.x, prize.y, prize.r + 1.6, 0, Math.PI * 2);
    g.fillStyle = colors.sunshine;
    g.fill();
    g.stroke();
  }
  if (image) {
    const size = prize.r * 2.3;
    g.drawImage(image, prize.x - size / 2, prize.y - size / 2, size, size);
  } else {
    g.beginPath();
    g.arc(prize.x, prize.y, prize.r, 0, Math.PI * 2);
    g.fillStyle = colors[prize.tone] || colors.rose;
    g.fill();
    g.stroke();
  }
  g.restore();
}

function drawClaw(g, x, y, mode, colors) {
  // The cable, the head, and two fingers — open while aiming, shut once closed.
  g.beginPath();
  g.moveTo(x, 4);
  g.lineTo(x, y - 2);
  g.stroke();
  g.fillStyle = colors.captain;
  g.fillRect(x - 4, y - 3, 8, 4);
  g.strokeRect(x - 4, y - 3, 8, 4);
  const shut = mode === 'up' || mode === 'carry' || (mode === 'close');
  const spread = shut ? 2.2 : 5;
  g.beginPath();
  for (const side of [-1, 1]) {
    g.moveTo(x + side * 3, y + 1);
    g.lineTo(x + side * spread, y + REACH - 1.5);
    g.lineTo(x + side * (spread - 2), y + REACH);
  }
  g.stroke();
}

/** Paint the whole machine. `scale` is canvas pixels per field unit, `edge` the outline in canvas pixels. */
export function paint(g, state, { colors, scale, edge, sprite = null }) {
  g.setTransform(scale, 0, 0, scale, 0, 0);
  const tall = state.height;
  const floor = floorOf(state);
  g.fillStyle = colors.paper;
  g.fillRect(0, 0, WIDTH, tall);
  g.lineWidth = edge / scale;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = colors.ink;

  // The rail, the floor, and the chute with its wall.
  g.beginPath();
  g.moveTo(2, 4); g.lineTo(WIDTH - 2, 4);
  g.moveTo(CHUTE_WALL, floor); g.lineTo(PIT.right + 1, floor);
  g.stroke();
  g.fillStyle = colors.sky;
  g.fillRect(2, floor - 20, CHUTE_WALL - 2, 20 + FLOOR_ABOVE - 2);
  g.strokeRect(2, floor - 20, CHUTE_WALL - 2, 20 + FLOOR_ABOVE - 2);
  g.fillStyle = colors.ink;
  g.font = '900 3.6px Inter, system-ui, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('PRIZE', (2 + CHUTE_WALL) / 2, floor - 10);

  // The prizes, with the conveyor's wrap drawn on both sides of the seam.
  g.save();
  g.beginPath();
  g.rect(PIT.left - 1, 0, pitWidth + 2, tall);
  g.clip();
  for (const prize of state.prizes) {
    drawPrize(g, prize, colors, sprite);
    if (state.config.belt && prize.x + prize.r > PIT.right) drawPrize(g, { ...prize, x: prize.x - pitWidth }, colors, sprite);
  }
  g.restore();
  for (const prize of state.falling) drawPrize(g, prize, colors, sprite);

  if (state.config.belt) {
    // Chevrons on the belt, moving with it.
    g.save();
    g.lineWidth /= 2;
    g.beginPath();
    const offset = (state.time * state.config.belt) % 8;
    for (let x = PIT.left + offset; x < PIT.right; x += 8) {
      g.moveTo(x, floor + 2); g.lineTo(x + 2, floor + 4); g.lineTo(x, floor + 6);
    }
    g.stroke();
    g.restore();
  }

  // The claw, and whatever it holds.
  const claw = state.claw;
  const x = clawX(state);
  if (claw.held) drawPrize(g, { ...claw.held, x, y: claw.y + REACH + claw.held.r * 0.5 }, colors, sprite);
  drawClaw(g, x, claw.y, claw.mode, colors);

  // The numbers that belong in the glass.
  g.fillStyle = colors.ink;
  g.textBaseline = 'alphabetic';
  g.font = '800 4px Inter, system-ui, sans-serif';
  g.textAlign = 'right';
  g.fillText(`${state.won}/${state.config.target} · ${state.tries} ${state.tries === 1 ? 'try' : 'tries'}`, WIDTH - 3, 10);
  if (state.config.clock && claw.mode === 'aim' && state.started && !state.rest) {
    g.textAlign = 'left';
    g.fillText(`DROPS IN ${Math.ceil(state.aimClock)}`, 3, 10);
  }

  const middle = tall * 0.42;
  if (state.rest > 0) {
    caption(g, `LEVEL ${state.level} DONE!`, colors, middle);
    caption(g, `NEXT: LEVEL ${state.level + 1}`, colors, middle + 9, 5);
  } else if (!state.started || state.showLevel > 0) {
    caption(g, `LEVEL ${state.level}`, colors, middle - 6);
    caption(g, `WIN ${state.config.target} PRIZES IN ${state.config.tries} TRIES`, colors, middle + 3, 5);
    if (!state.started) caption(g, 'MOVE THE CLAW, THEN DROP', colors, middle + 11, 4.5);
  } else if (state.last === 'prize' && claw.mode === 'aim' && state.lastPrize) {
    caption(g, `${state.lastPrize.gold ? 'GOLD! ' : ''}+${state.lastPrize.points}`, colors, middle, 6);
  } else if (state.last === 'slip' && (claw.mode === 'up' || claw.mode === 'aim')) {
    caption(g, 'SO CLOSE — IT SLIPPED!', colors, middle, 5);
  }
}
