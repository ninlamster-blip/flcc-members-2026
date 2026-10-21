// Galaga: the rules, with no DOM in them.
//
// The arcade shape — a formation that flies in, sways, and peels off to dive
// at the ship — kept as pure functions over one state object, so it can be
// tested without a browser and the screen only has to draw what it is handed.
//
// A few decisions shape it:
//
//   · It never ends by being won. Clearing a wave brings the next one, and
//     every wave is harder than the last — more ships, faster dives, more fire
//     — until the curve flattens at a ceiling a good thumb can still survive.
//   · There is no fire button. Holding a direction — or a finger on the
//     field — moves the ship AND fires it; letting go stops both. One thumb
//     plays the whole game.
//   · The ship flies anywhere in the lower half of the field, not only along
//     the bottom: a finger on the field pulls it toward that point, so it can
//     slip up and around a diver or a stream of fire rather than only sideways.
//   · Every new wave hands the ship a power for that wave, in turn: a shield
//     that soaks up one hit, rapid fire, a three-way spread, then extra speed
//     — and round again. Wave one has none; clearing a wave ends its power.
//     A mothership wave is the exception: it always brings the triple shot
//     AND a shield, and the ship goes into it as a twin — a wingman beside
//     it if it has none — because that is the hardest fight in the game.
//   · Losing the last ship does not send you back to the start. A run can
//     begin at any wave — the one you reached — with the difficulty of that
//     wave, three fresh ships and, if the screen wants it, the score so far.
//   · The top row carries Boss Galagas: two hits each, and sometimes one
//     drops to hover above the ship's half of the field and lowers a tractor
//     beam. A ship caught in it is carried back up to the formation. Shoot
//     that boss down and the captured ship comes home as a wingman.
//   · Wingmen fly beside the ship — one on each side at most — and fire with
//     it. A hit costs a wingman before it costs a ship, so a good run keeps
//     going with a fleet. Downing a mothership also brings a wingman.
//   · Every fifth wave a mothership rides above the formation: a long health
//     bar, a fan of fire, and escorts it launches straight into a dive. The
//     wave is not clear until it is down.
//   · Everything random comes from a seeded generator, so a run can be
//     replayed exactly for a test — and every phone in a room race, given the
//     same seed, flies against the same waves.
//
// The field is measured in its own units — 100 across, and 140 down unless
// the screen asks for taller (`create(..., { height })`, `resize()`), so a
// tall phone is filled by the game rather than by empty paper. The ship
// starts 12 units above the bottom, whatever the height, and never climbs
// above the middle of the field.

export const WIDTH = 100;
export const HEIGHT = 140;

const SHIP_ABOVE = 12;        // how far above the bottom the ship flies
const SHIP_SPEED = 62;        // units a second
const TOUCH_SPEED = 120;      // units a second, gliding toward a finger
const SHIP_FLOOR = 6;         // the lowest the ship flies, above the bottom edge
const SHIP_RADIUS = 3.6;
const FIRE_EVERY = 0.26;      // seconds between shots while a direction is held
const MAX_SHOTS = 4;
const SHOT_SPEED = 130;
const ENEMY_RADIUS = 3.8;
const BOMB_RADIUS = 2.2;      // matches the dart as drawn, so a hit is one you could see
const START_LIVES = 3;
const MAX_LIVES = 5;
const SAFE_AFTER_HIT = 2;     // seconds the ship cannot be hit after losing a life
const BETWEEN_WAVES = 1.6;    // seconds of breathing room after a wave clears
const SHOW_POWER = 2.2;       // seconds the new power's name stays on the field
const MAX_WINGMEN = 2;        // one each side
const WING_GAP = 8;           // field units between the ship and a wingman
const BEAM_OPEN = 0.5;        // seconds a tractor beam takes to reach the ground
const BEAM_TIME = 2.6;        // seconds a tractor beam stays down
const BEAM_HALF = 7;          // half the beam's width
const BEAM_CHANCE = 0.5;      // share of boss dives that are a beam instead
const MOTHER_EVERY = 5;       // a mothership every fifth wave
const MOTHER_Y = 9;
const MOTHER_HALF = { x: 11, y: 5 };
const ESCORTS = 4;            // most escorts a mothership has out at once

/**
 * The powers, in the order the waves hand them out, and what each one changes.
 * Wave two gets the first, wave three the second, and so on, round and round.
 */
export const POWERS = ['shield', 'rapid', 'spread', 'speed'];
export const POWER_NAMES = { shield: 'SHIELD', rapid: 'RAPID FIRE', spread: 'TRIPLE SHOT', speed: 'SPEED BOOST' };
const RAPID = { every: 0.12, shots: 9, speed: 1.6 };    // fire rate, missiles at once, missile speed
const SPREAD = { angle: 22, shots: 12 };                // sideways drift of the outer two, missiles at once
const SPEED_BOOST = 1.7;

/**
 * The power wave `n` hands the ship, or null for wave one. A mothership wave
 * always gets the triple shot (and, in startWave, a shield and a twin too).
 */
export function powerFor(n) {
  const w = Math.max(1, Math.trunc(n));
  if (hasMothership(w)) return 'spread';
  return w > 1 ? POWERS[(w - 2) % POWERS.length] : null;
}

/** What the field calls the ship's powers right now, or '' for none. */
export function powerLabel(state) {
  if (!state.power) return '';
  if (hasMothership(state.wave)) return state.shield ? 'TRIPLE SHOT + SHIELD' : 'TRIPLE SHOT · SHIELD USED';
  return state.power === 'shield' && !state.shield ? 'SHIELD USED' : POWER_NAMES[state.power];
}

/** Whether wave `n` brings a mothership. */
export function hasMothership(n) {
  return Math.trunc(n) > 0 && Math.trunc(n) % MOTHER_EVERY === 0;
}

/** Where the wingmen fly, left first: one each side of the ship, inside the field. */
export function wingSpots(state) {
  const { x, y } = state.ship;
  return [-1, 1].slice(0, state.wingmen || 0).map((side) => ({ x: clamp(x + side * WING_GAP, 3, WIDTH - 3), y: y + 1, side }));
}

/** A seeded generator returning floats in [0, 1). */
export function seeded(seed) {
  let value = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  return () => {
    value = (value * 16807) % 2147483647;
    return (value - 1) / 2147483646;
  };
}

/**
 * How hard wave `n` is. Every number moves in the harder direction as `n`
 * grows, and each one stops at a ceiling — past about wave twenty the game is
 * as hard as it gets and stays there, forever.
 */
export function wave(n) {
  const w = Math.max(1, Math.trunc(n));
  return {
    rows: Math.min(5, 2 + Math.floor((w - 1) / 2)),
    cols: Math.min(8, 5 + Math.floor((w - 1) / 3)),
    sway: Math.min(1.9, 0.7 + 0.06 * w),           // formation sway, radians a second
    diveEvery: Math.max(0.55, 3.0 - 0.16 * w),      // seconds between new dives
    divers: Math.min(6, 1 + Math.floor(w / 3)),     // most ships diving at once
    diveSpeed: Math.min(88, 34 + 3.2 * w),
    fireEvery: Math.max(0.3, 2.2 - 0.11 * w),       // seconds between enemy shots
    shotSpeed: Math.min(95, 42 + 3 * w),
    armoured: Math.min(0.5, Math.max(0, (w - 2) * 0.08)), // share of ships that take two hits
  };
}

/**
 * A run, parked until the first press. It starts on wave one unless it is told
 * otherwise: `{ wave, score }` continues a run from the wave it reached, at
 * that wave's difficulty, with three fresh ships.
 */
export function create(seed = 1, { wave: from = 1, score = 0, height = HEIGHT } = {}) {
  const tall = Math.max(HEIGHT, Number(height) || HEIGHT);
  const state = {
    height: tall,
    random: seeded(seed),
    time: 0,
    wave: 0,
    score: Math.max(0, Math.trunc(score) || 0),
    lives: START_LIVES,
    wingmen: 0,
    mothership: null,
    ship: { x: WIDTH / 2, y: tall - SHIP_ABOVE, safe: 0 },
    shots: [],
    bombs: [],
    enemies: [],
    cooldown: 0,
    power: null,
    shield: false,
    showPower: 0,
    diveClock: 0,
    fireClock: 0,
    rest: 0,
    started: false,
    over: false,
  };
  startWave(state, Math.max(1, Math.trunc(from) || 1));
  return state;
}

function startWave(state, n) {
  const config = wave(n);
  state.wave = n;
  state.config = config;
  state.power = powerFor(n);
  state.shield = state.power === 'shield' || hasMothership(n);
  if (hasMothership(n)) state.wingmen = Math.max(state.wingmen || 0, 1);   // into the big fight as a twin
  state.showPower = state.power ? SHOW_POWER : 0;
  state.diveClock = config.diveEvery;
  state.fireClock = config.fireEvery;
  state.enemies = [];
  state.mothership = hasMothership(n) ? {
    x: WIDTH / 2, y: -14, hp: Math.min(60, 14 + 2 * n), most: Math.min(60, 14 + 2 * n),
    phase: 0, fireClock: config.fireEvery * 1.5, launchClock: 3, dent: 0,
  } : null;
  const gap = 10;
  const middle = Math.floor((config.cols - 1) / 2);
  const bossCols = [middle, middle + 1];      // two Boss Galagas, at the top in the middle
  const left = (WIDTH - (config.cols - 1) * gap) / 2;
  let index = 0;
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const slotX = left + col * gap;
      const slotY = 18 + row * 9 + (state.mothership ? 8 : 0);   // room above for a mothership
      const fromLeft = (row + col) % 2 === 0;
      const boss = row === 0 && bossCols.includes(col);
      state.enemies.push({
        id: `${n}:${index}`,
        row,
        kind: row % 4,                        // which drawing and which tone
        hp: state.random() < config.armoured || boss ? 2 : 1,
        boss,
        captive: false,
        slotX, slotY,
        x: fromLeft ? -8 : WIDTH + 8,
        y: -10 - row * 6,
        mode: 'enter',
        wait: index * 0.07,
        phase: 0,
        vx: 0, vy: 0,
      });
      index += 1;
    }
  }
}

/**
 * Make the field `height` units tall (never less than HEIGHT) — the screen
 * calls this when the phone turns or the window changes. The ship keeps its
 * height above the bottom edge.
 */
export function resize(state, height) {
  const above = state.height - state.ship.y;
  state.height = Math.max(HEIGHT, Number(height) || HEIGHT);
  state.ship.y = clamp(state.height - above, ceiling(state), state.height - SHIP_FLOOR);
  return state;
}

/** The highest the ship may fly: the middle of the field, below the formation. */
export function ceiling(state) {
  return state.height / 2;
}

/** Where a ship's formation slot actually is right now, with the sway. */
export function slot(state, enemy) {
  return {
    x: enemy.slotX + Math.sin(state.time * state.config.sway) * 7,
    y: enemy.slotY + Math.sin(state.time * state.config.sway * 1.7 + enemy.slotX / 10) * 1.2,
  };
}

const near = (a, b, r) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= r * r;
function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }

/**
 * Advance the run by `dt` seconds. `input` is what is held right now:
 * `{ left, right, up, down }`, and/or `to: { x, y }` — a point on the field,
 * in field units, that a finger is on. Returns what happened, so the screen
 * can repaint the numbers only when they change.
 */
export function step(state, input = {}, dt = 1 / 60) {
  const events = [];
  if (state.over) return events;
  const across = Boolean(input.right) - Boolean(input.left);   // both at once cancels out
  const along = Boolean(input.down) - Boolean(input.up);
  const to = input.to && Number.isFinite(input.to.x) && Number.isFinite(input.to.y) ? input.to : null;
  const held = Boolean(to) || across !== 0 || along !== 0;
  if (!state.started) {
    if (!held) return events;
    state.started = true;
    events.push('start');
  }
  dt = Math.min(dt, 0.05);                   // a background tab is not a teleport
  state.time += dt;

  // ── The ship: move and fire together, or neither ────────────────────────
  const ship = state.ship;
  const power = state.power;
  const boost = power === 'speed' ? SPEED_BOOST : 1;
  state.showPower = Math.max(0, state.showPower - dt);
  if (to) {
    // Glide toward the finger — fast, but never a teleport.
    const dx = clamp(to.x, 6, WIDTH - 6) - ship.x;
    const dy = clamp(to.y, ceiling(state), state.height - SHIP_FLOOR) - ship.y;
    const distance = Math.hypot(dx, dy);
    const reach = Math.min(1, (TOUCH_SPEED * boost * dt) / (distance || 1));
    ship.x += dx * reach;
    ship.y += dy * reach;
  } else if (held) {
    ship.x += across * SHIP_SPEED * boost * dt;
    ship.y += along * SHIP_SPEED * boost * dt;
  }
  ship.x = clamp(ship.x, 6, WIDTH - 6);
  ship.y = clamp(ship.y, ceiling(state), state.height - SHIP_FLOOR);
  ship.safe = Math.max(0, ship.safe - dt);
  state.cooldown = Math.max(0, state.cooldown - dt);
  const wings = wingSpots(state);
  const most = (power === 'rapid' ? RAPID.shots : power === 'spread' ? SPREAD.shots : MAX_SHOTS) * (1 + wings.length);
  if (held && state.cooldown === 0 && state.shots.length < most && state.rest === 0) {
    const vy = SHOT_SPEED * (power === 'rapid' ? RAPID.speed : 1);
    const drifts = power === 'spread' ? [-SPREAD.angle, 0, SPREAD.angle] : [0];
    for (const vx of drifts) state.shots.push({ x: ship.x, y: ship.y - 5, vx, vy });
    for (const wing of wings) state.shots.push({ x: wing.x, y: wing.y - 5, vx: 0, vy });
    state.cooldown = power === 'rapid' ? RAPID.every : FIRE_EVERY;
    events.push('fire');
  }
  for (const shot of state.shots) { shot.x += (shot.vx || 0) * dt; shot.y -= (shot.vy || SHOT_SPEED) * dt; }
  state.shots = state.shots.filter(onField);

  // ── Between waves: let the field clear, then bring the next ─────────────
  if (state.rest > 0) {
    state.rest = Math.max(0, state.rest - dt);
    moveBombs(state, dt);
    if (state.rest === 0) {
      startWave(state, state.wave + 1);
      events.push('wave');
      if (state.power) events.push('power');
    }
    return events;
  }

  // ── The formation ───────────────────────────────────────────────────────
  const config = state.config;
  for (const enemy of state.enemies) {
    if (enemy.wait > 0) { enemy.wait -= dt; continue; }
    const home = slot(state, enemy);
    if (enemy.mode === 'enter' || enemy.mode === 'return') {
      const dx = home.x - enemy.x;
      const dy = home.y - enemy.y;
      const distance = Math.hypot(dx, dy);
      const speed = enemy.mode === 'enter' ? 70 : 45;
      if (distance <= speed * dt) { enemy.x = home.x; enemy.y = home.y; enemy.mode = 'form'; }
      else { enemy.x += (dx / distance) * speed * dt; enemy.y += (dy / distance) * speed * dt; }
    } else if (enemy.mode === 'form') {
      enemy.x = home.x;
      enemy.y = home.y;
    } else if (enemy.mode === 'swoop') {
      // A boss on its way down to lower its beam over the ship.
      const dx = enemy.beamX - enemy.x;
      const dy = enemy.beamY - enemy.y;
      const distance = Math.hypot(dx, dy);
      const speed = config.diveSpeed * 0.8;
      if (distance <= speed * dt) { enemy.x = enemy.beamX; enemy.y = enemy.beamY; enemy.mode = 'beam'; enemy.phase = 0; events.push('beam'); }
      else { enemy.x += (dx / distance) * speed * dt; enemy.y += (dy / distance) * speed * dt; }
    } else if (enemy.mode === 'beam') {
      enemy.phase += dt;
      if (enemy.phase >= BEAM_TIME) enemy.mode = 'return';
    } else if (enemy.mode === 'dive') {
      enemy.phase += dt;
      // Steer toward the ship, with a weave on top so a dive is not a straight line.
      const pull = clamp((ship.x - enemy.x) * 1.4, -40, 40);
      enemy.vx += (pull - enemy.vx) * Math.min(1, dt * 2);
      enemy.x = clamp(enemy.x + (enemy.vx + Math.sin(enemy.phase * 5) * 18) * dt, 3, WIDTH - 3);
      enemy.y += config.diveSpeed * dt;
      if (enemy.y > state.height + 8) {
        if (enemy.escort) enemy.hp = 0;             // a mothership's escort does not join the formation
        else { enemy.y = -8; enemy.mode = 'return'; }
      }
    }
  }

  // Send someone down.
  state.diveClock -= dt;
  if (state.diveClock <= 0) {
    state.diveClock = config.diveEvery;
    const diving = state.enemies.filter((enemy) => enemy.mode === 'dive').length;
    const ready = state.enemies.filter((enemy) => enemy.mode === 'form');
    if (diving < config.divers && ready.length) {
      const enemy = ready[Math.floor(state.random() * ready.length)];
      const beaming = state.enemies.some((one) => one.mode === 'swoop' || one.mode === 'beam');
      if (enemy.boss && !enemy.captive && !beaming && state.random() < BEAM_CHANCE) {
        enemy.mode = 'swoop';
        enemy.beamX = clamp(ship.x, 12, WIDTH - 12);
        enemy.beamY = ceiling(state) - 16;
      } else {
        enemy.mode = 'dive';
        enemy.vx = 0;
      }
      enemy.phase = 0;
    }
  }

  // Shoot back — from a diver if there is one, otherwise from the formation.
  state.fireClock -= dt;
  if (state.fireClock <= 0) {
    state.fireClock = config.fireEvery;
    const divers = state.enemies.filter((enemy) => enemy.mode === 'dive' && enemy.y < ship.y - 20);
    const pool = divers.length ? divers : state.enemies.filter((enemy) => enemy.mode === 'form');
    if (pool.length) {
      const enemy = pool[Math.floor(state.random() * pool.length)];
      const aim = clamp((ship.x - enemy.x) / Math.max(20, ship.y - enemy.y), -0.5, 0.5);
      state.bombs.push({ x: enemy.x, y: enemy.y + 4, vx: aim * config.shotSpeed, vy: config.shotSpeed });
    }
  }
  // The mothership: drift in, sway along the top, fan its fire, launch escorts.
  const mother = state.mothership;
  if (mother) {
    mother.phase += dt;
    mother.dent = Math.max(0, mother.dent - dt);
    mother.y = Math.min(MOTHER_Y, mother.y + 20 * dt);
    mother.x = WIDTH / 2 + Math.sin(mother.phase * 0.6) * 30;
    mother.fireClock -= dt;
    if (mother.fireClock <= 0 && mother.y >= MOTHER_Y) {
      mother.fireClock = config.fireEvery * 1.5;
      for (const vx of [-0.35, 0, 0.35]) state.bombs.push({ x: mother.x, y: mother.y + 6, vx: vx * config.shotSpeed, vy: config.shotSpeed * 0.85 });
    }
    mother.launchClock -= dt;
    if (mother.launchClock <= 0 && mother.y >= MOTHER_Y) {
      mother.launchClock = Math.max(1.6, config.diveEvery * 1.8);
      if (state.enemies.filter((one) => one.escort).length < ESCORTS) {
        state.escorts = (state.escorts || 0) + 1;
        state.enemies.push({
          id: `${state.wave}:e${state.escorts}`, row: 1, kind: state.escorts % 4, hp: 1, boss: false, captive: false, escort: true,
          slotX: mother.x, slotY: mother.y, x: mother.x, y: mother.y + 4, mode: 'dive', wait: 0, phase: 0, vx: 0, vy: 0,
        });
      }
    }
  }
  moveBombs(state, dt);

  // ── What hit what ───────────────────────────────────────────────────────
  for (const shot of state.shots) {
    for (const enemy of state.enemies) {
      if (enemy.hp <= 0 || enemy.wait > 0 || !near(shot, enemy, ENEMY_RADIUS + 1)) continue;
      shot.y = -99;
      enemy.hp -= 1;
      if (enemy.hp > 0) { events.push('dent'); break; }
      const diving = enemy.mode === 'dive' || enemy.mode === 'swoop' || enemy.mode === 'beam';
      state.score += enemy.boss ? (diving ? 400 : 150) : (diving ? 100 : 50) * (enemy.row === 0 ? 2 : 1);
      events.push('kill');
      if (enemy.captive && state.wingmen < MAX_WINGMEN) { state.wingmen += 1; events.push('rescue', 'life'); }
      break;
    }
    if (shot.y > -99 && mother && mother.y >= 0
      && Math.abs(shot.x - mother.x) <= MOTHER_HALF.x && Math.abs(shot.y - mother.y) <= MOTHER_HALF.y) {
      shot.y = -99;
      mother.hp -= 1;
      mother.dent = 0.08;
      if (mother.hp > 0) events.push('dent');
      else {
        state.score += 2000 + 100 * state.wave;
        state.mothership = null;
        events.push('mothership', 'kill');
        if (state.wingmen < MAX_WINGMEN) { state.wingmen += 1; events.push('wingman', 'life'); }
      }
    }
  }
  state.shots = state.shots.filter(onField);

  if (ship.safe === 0) {
    // A tractor beam that has reached the ground takes the ship it is over.
    const beam = state.enemies.find((enemy) => enemy.mode === 'beam' && enemy.hp > 0 && !enemy.captive
      && enemy.phase >= BEAM_OPEN && Math.abs(ship.x - enemy.x) <= BEAM_HALF && ship.y > enemy.y);
    if (beam && !state.shield) {
      beam.captive = true;
      beam.mode = 'return';
      events.push('captured');
      if (lose(state, events)) return events;
    }
  }
  if (ship.safe === 0) {
    // Any of the fleet can be hit: the ship itself, or a wingman beside it.
    const fleet = [ship, ...wingSpots(state)];
    const struck = (body) => state.bombs.find((one) => near(one, body, SHIP_RADIUS + BOMB_RADIUS))
      || state.enemies.find((enemy) => enemy.hp > 0 && enemy.wait <= 0 && near(enemy, body, SHIP_RADIUS + ENEMY_RADIUS - 1));
    const body = fleet.find((one) => struck(one));
    if (body) {
      const what = struck(body);
      if ('hp' in what) what.hp = 0;
      else what.y = state.height + 99;
      if (state.shield && body === ship) {
        // The shield takes the hit instead, and is gone.
        state.shield = false;
        ship.safe = 1;
        events.push('shield');
        return events;
      }
      if (lose(state, events)) return events;
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  if (!state.enemies.length && !state.mothership) {
    // A spare ship every fifth wave, so a long run can survive a mistake.
    if (state.wave % 5 === 0 && state.lives < MAX_LIVES) { state.lives += 1; events.push('life'); }
    state.rest = BETWEEN_WAVES;
    state.power = null;                    // a power lasts the wave it came with
    state.shield = false;
    state.showPower = 0;
    events.push('cleared');
  }
  return events;
}

/**
 * The fleet takes a loss: a wingman if there is one, otherwise a ship.
 * Returns true when that was the last ship and the run is over.
 */
function lose(state, events) {
  state.ship.safe = SAFE_AFTER_HIT;
  state.bombs = [];
  if (state.wingmen > 0) {
    state.wingmen -= 1;
    events.push('wingman-lost', 'hit');
    return false;
  }
  state.lives -= 1;
  events.push('hit');
  if (state.lives <= 0) { state.over = true; events.push('over'); return true; }
  return false;
}

function onField(shot) {
  return shot.y > -4 && shot.x > -4 && shot.x < WIDTH + 4;
}

function moveBombs(state, dt) {
  for (const bomb of state.bombs) { bomb.x += bomb.vx * dt; bomb.y += bomb.vy * dt; }
  state.bombs = state.bombs.filter((bomb) => bomb.y < state.height + 4 && bomb.x > -4 && bomb.x < WIDTH + 4);
}

// ── Drawing ────────────────────────────────────────────────────────────────
//
// The poster system at arcade size: flat fills from the palette, one navy
// outline, paper behind. No glow on a shot, no gradient on a ship, no burst
// when something is hit — it is simply gone. `colors` is the palette read out
// of the stylesheet by the screen, so no colour is written down here.

const SHIP = [[0, -5.5], [5, 4], [1.8, 2.4], [0, 4.2], [-1.8, 2.4], [-5, 4]];
const TONE_BY_KIND = ['poppy', 'rose', 'sunshine', 'sky'];
const BOMB = [[0, 5], [2.8, -0.3], [0, -4.4], [-2.8, -0.3]];

function outline(g, points) {
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

function drawShip(g, x, y, colors, tone = 'captain') {
  g.save();
  g.translate(x, y);
  outline(g, SHIP);
  g.fillStyle = colors[tone] || colors.captain;
  g.fill();
  g.stroke();
  g.restore();
}

/** The shield: a sky ring in the navy outline, close around the ship. */
function drawShield(g, x, y, colors) {
  g.save();
  g.beginPath();
  g.arc(x, y, 8, 0, Math.PI * 2);
  g.fillStyle = colors.sky;
  g.globalAlpha = 0.55;
  g.fill();
  g.globalAlpha = 1;
  g.stroke();
  g.restore();
}

/** A tractor beam: a sky band from the boss down to the bottom of the field. */
function drawBeam(g, enemy, tall, colors) {
  const open = Math.min(1, enemy.phase / BEAM_OPEN);
  const bottom = enemy.y + 4 + (tall - enemy.y) * open;
  g.save();
  g.beginPath();
  g.moveTo(enemy.x - 2.5, enemy.y + 4);
  g.lineTo(enemy.x + 2.5, enemy.y + 4);
  g.lineTo(enemy.x + BEAM_HALF, bottom);
  g.lineTo(enemy.x - BEAM_HALF, bottom);
  g.closePath();
  g.fillStyle = colors.sky;
  g.globalAlpha = 0.5;
  g.fill();
  g.globalAlpha = 1;
  g.stroke();
  // Rungs that climb the beam, so it reads as pulling upward.
  g.fillStyle = colors.ink;
  for (let i = 0; i < 6; i++) {
    const y = bottom - (((enemy.phase * 30) + i * 12) % Math.max(1, bottom - enemy.y - 4));
    const half = 2.5 + (BEAM_HALF - 2.5) * ((y - enemy.y - 4) / Math.max(1, tall - enemy.y - 4));
    g.fillRect(enemy.x - half + 1, y, half * 2 - 2, 0.6);
  }
  g.restore();
}

/** A Boss Galaga: wider wings and a crown, captain until its first hit, then sky. */
function drawBoss(g, enemy, time, colors) {
  const flap = Math.sin(time * 7 + enemy.slotX) * 1.1;
  g.save();
  g.translate(enemy.x, enemy.y);
  if (enemy.mode === 'dive') g.rotate(Math.PI);
  g.fillStyle = enemy.hp > 1 ? colors.captain : colors.sky;
  for (const side of [-1, 1]) {
    outline(g, [[side * 1.6, -2.6], [side * 6.4, -2 - flap], [side * 6, 3.4], [side * 1.6, 2.6]]);
    g.fill();
    g.stroke();
  }
  g.beginPath();
  g.ellipse(0, 0.4, 2.8, 3.8, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  outline(g, [[-2.2, -3.2], [-1.4, -5.6], [0, -4], [1.4, -5.6], [2.2, -3.2]]);
  g.fillStyle = colors.sunshine;
  g.fill();
  g.stroke();
  g.restore();
  // The ship it has captured rides above it, nose down, in poppy.
  if (enemy.captive) {
    g.save();
    g.translate(enemy.x, enemy.y - 8);
    g.rotate(Math.PI);
    outline(g, SHIP);
    g.fillStyle = colors.poppy;
    g.fill();
    g.stroke();
    g.restore();
  }
}

/** The mothership: a long saucer with a dome, and its health bar beneath. */
function drawMothership(g, mother, colors) {
  g.save();
  g.translate(mother.x, mother.y);
  g.beginPath();
  g.ellipse(0, -2.4, 4.6, 3.6, 0, Math.PI, 0);
  g.closePath();
  g.fillStyle = colors.sky;
  g.fill();
  g.stroke();
  g.beginPath();
  g.ellipse(0, 0, MOTHER_HALF.x, MOTHER_HALF.y - 1.6, 0, 0, Math.PI * 2);
  g.fillStyle = mother.dent > 0 ? colors.sunshine : colors.rose;
  g.fill();
  g.stroke();
  g.fillStyle = colors.ink;
  for (const x of [-7, -3.5, 0, 3.5, 7]) { g.beginPath(); g.arc(x, 0.2, 0.9, 0, Math.PI * 2); g.fill(); }
  // Health: an outlined track with the share left filled in poppy.
  const width = MOTHER_HALF.x * 2;
  g.fillStyle = colors.paper;
  g.fillRect(-width / 2, MOTHER_HALF.y + 1, width, 2);
  g.fillStyle = colors.poppy;
  g.fillRect(-width / 2, MOTHER_HALF.y + 1, width * Math.max(0, mother.hp / mother.most), 2);
  g.strokeRect(-width / 2, MOTHER_HALF.y + 1, width, 2);
  g.restore();
}

function drawEnemy(g, enemy, time, colors) {
  if (enemy.boss) { drawBoss(g, enemy, time, colors); return; }
  const flap = Math.sin(time * 9 + enemy.slotX) * 0.9;
  g.save();
  g.translate(enemy.x, enemy.y);
  if (enemy.mode === 'dive') g.rotate(Math.PI);           // nose down on the way in
  g.fillStyle = colors[TONE_BY_KIND[enemy.kind]] || colors.rose;
  for (const side of [-1, 1]) {
    outline(g, [[side * 1.4, -2], [side * 4.8, -1.2 - flap], [side * 4.4, 2.6], [side * 1.4, 2]]);
    g.fill();
    g.stroke();
  }
  g.beginPath();
  g.ellipse(0, 0.3, 2.3, 3.1, 0, 0, Math.PI * 2);
  g.fill();
  g.stroke();
  if (enemy.hp > 1) {                                     // armoured: a solid navy core
    g.beginPath();
    g.arc(0, 0.3, 1, 0, Math.PI * 2);
    g.fillStyle = colors.ink;
    g.fill();
  }
  g.restore();
}

function caption(g, text, colors, y, size = 7) {
  g.fillStyle = colors.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 ${size}px Inter, system-ui, sans-serif`;
  g.fillText(text, WIDTH / 2, y);
}

/**
 * Paint the whole field. `scale` is canvas pixels per field unit, `edge` the
 * outline weight in canvas pixels, `ship` the palette tone the ship is painted in.
 */
export function paint(g, state, { colors, scale, edge, ship = 'captain' }) {
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.fillStyle = colors.paper;
  const tall = state.height || HEIGHT;
  g.fillRect(0, 0, WIDTH, tall);

  // A slow drift of dots, so the field reads as moving even between waves.
  g.fillStyle = colors.faint;
  for (let i = 0; i < 28; i++) {
    const x = (i * 37.3) % WIDTH;
    const y = (i * 53.7 + state.time * (8 + (i % 3) * 6)) % tall;
    g.fillRect(x, y, 0.8, 0.8);
  }

  g.lineWidth = edge / scale;
  g.lineJoin = 'round';
  g.strokeStyle = colors.ink;

  for (const enemy of state.enemies) if (enemy.mode === 'beam' && !enemy.captive) drawBeam(g, enemy, tall, colors);
  if (state.mothership) drawMothership(g, state.mothership, colors);
  for (const enemy of state.enemies) if (enemy.wait <= 0) drawEnemy(g, enemy, state.time, colors);

  g.fillStyle = colors.ink;
  const thick = state.power === 'rapid' ? 1 : 0.6;       // rapid-fire missiles are heavier
  for (const shot of state.shots) g.fillRect(shot.x - thick, shot.y - 2.5, thick * 2, 5);

  // Enemy fire is the one thing on the field that has to be seen at a glance,
  // so it is drawn large: a poppy dart in the navy outline, pointing the way
  // it is travelling, with a short navy trail behind it.
  for (const bomb of state.bombs) {
    const angle = Math.atan2(bomb.vy, bomb.vx) - Math.PI / 2;
    g.save();
    g.translate(bomb.x, bomb.y);
    g.rotate(angle);
    g.fillStyle = colors.ink;
    g.fillRect(-0.6, -9, 1.2, 4.6);
    outline(g, BOMB);
    g.fillStyle = colors.poppy;
    g.fill();
    g.stroke();
    g.restore();
  }

  const blinking = state.ship.safe > 0 && Math.floor(state.ship.safe * 8) % 2 === 0;
  if (!state.over && state.shield) drawShield(g, state.ship.x, state.ship.y, colors);
  if (!state.over && !blinking) {
    drawShip(g, state.ship.x, state.ship.y, colors, ship);
    for (const wing of wingSpots(state)) drawShip(g, wing.x, wing.y, colors, ship);
  }

  const name = powerLabel(state);
  if (!state.started) {
    if (state.wave > 1) caption(g, `WAVE ${state.wave}`, colors, tall * 0.52);
    caption(g, 'TOUCH AND DRAG TO FLY', colors, tall * 0.62, 6);
    if (name) caption(g, `POWER: ${name}`, colors, tall * 0.7, name.length > 14 ? 4.2 : 5);
  }
  else if (state.rest > 0) {
    caption(g, `WAVE ${state.wave + 1}`, colors, tall / 2);
    if (hasMothership(state.wave + 1)) caption(g, 'MOTHERSHIP!', colors, tall * 0.58, 5);
  }
  else if (state.showPower > 0) {
    caption(g, `${name}!`, colors, tall * 0.62, name.length > 14 ? 5.5 : 7);
    if (hasMothership(state.wave)) caption(g, 'AND A TWIN SHIP', colors, tall * 0.68, 4.5);
  }
  else if (name) {
    // While it lasts, the power's name sits small in the bottom corner.
    g.fillStyle = colors.ink;
    g.textAlign = 'left';
    g.textBaseline = 'alphabetic';
    g.font = '800 3.6px Inter, system-ui, sans-serif';
    g.fillText(name, 2.5, tall - 2.5);
  }
}
