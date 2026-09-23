// Galaga: the rules, with no DOM in them.
//
// The arcade shape — a formation that flies in, sways, and peels off to dive
// at the ship — kept as pure functions over one state object, so it can be
// tested without a browser and the screen only has to draw what it is handed.
//
// Three decisions shape it:
//
//   · It never ends by being won. Clearing a wave brings the next one, and
//     every wave is harder than the last — more ships, faster dives, more fire
//     — until the curve flattens at a ceiling a good thumb can still survive.
//   · There is no fire button. Holding left or right moves the ship AND fires
//     it; letting go stops both. One thumb plays the whole game.
//   · Everything random comes from a seeded generator, so a run can be
//     replayed exactly for a test.
//
// The field is measured in its own units — 100 across, 140 down — and the
// screen scales it to whatever canvas it has.

export const WIDTH = 100;
export const HEIGHT = 140;

const SHIP_Y = HEIGHT - 12;
const SHIP_SPEED = 62;        // units a second
const SHIP_RADIUS = 3.6;
const FIRE_EVERY = 0.26;      // seconds between shots while a direction is held
const MAX_SHOTS = 4;
const SHOT_SPEED = 130;
const ENEMY_RADIUS = 3.8;
const START_LIVES = 3;
const MAX_LIVES = 5;
const SAFE_AFTER_HIT = 2;     // seconds the ship cannot be hit after losing a life
const BETWEEN_WAVES = 1.6;    // seconds of breathing room after a wave clears

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

/** A fresh run, parked on wave one until the first press. */
export function create(seed = 1) {
  const state = {
    random: seeded(seed),
    time: 0,
    wave: 0,
    score: 0,
    lives: START_LIVES,
    ship: { x: WIDTH / 2, y: SHIP_Y, safe: 0 },
    shots: [],
    bombs: [],
    enemies: [],
    cooldown: 0,
    diveClock: 0,
    fireClock: 0,
    rest: 0,
    started: false,
    over: false,
  };
  startWave(state, 1);
  return state;
}

function startWave(state, n) {
  const config = wave(n);
  state.wave = n;
  state.config = config;
  state.diveClock = config.diveEvery;
  state.fireClock = config.fireEvery;
  state.enemies = [];
  const gap = 10;
  const left = (WIDTH - (config.cols - 1) * gap) / 2;
  let index = 0;
  for (let row = 0; row < config.rows; row++) {
    for (let col = 0; col < config.cols; col++) {
      const slotX = left + col * gap;
      const slotY = 18 + row * 9;
      const fromLeft = (row + col) % 2 === 0;
      state.enemies.push({
        id: `${n}:${index}`,
        row,
        kind: row % 4,                        // which drawing and which tone
        hp: state.random() < config.armoured ? 2 : 1,
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

/** Where a ship's formation slot actually is right now, with the sway. */
export function slot(state, enemy) {
  return {
    x: enemy.slotX + Math.sin(state.time * state.config.sway) * 7,
    y: enemy.slotY + Math.sin(state.time * state.config.sway * 1.7 + enemy.slotX / 10) * 1.2,
  };
}

const near = (a, b, r) => (a.x - b.x) ** 2 + (a.y - b.y) ** 2 <= r * r;
const clamp = (value, lo, hi) => Math.max(lo, Math.min(hi, value));

/**
 * Advance the run by `dt` seconds. `input` is `{ left, right }` — what is held
 * right now. Returns what happened, so the screen can repaint the numbers only
 * when they change.
 */
export function step(state, input = {}, dt = 1 / 60) {
  const events = [];
  if (state.over) return events;
  const left = Boolean(input.left);
  const right = Boolean(input.right);
  const held = left !== right;               // both at once cancels out
  if (!state.started) {
    if (!held) return events;
    state.started = true;
    events.push('start');
  }
  dt = Math.min(dt, 0.05);                   // a background tab is not a teleport
  state.time += dt;

  // ── The ship: move and fire together, or neither ────────────────────────
  const ship = state.ship;
  if (held) ship.x = clamp(ship.x + (right ? 1 : -1) * SHIP_SPEED * dt, 6, WIDTH - 6);
  ship.safe = Math.max(0, ship.safe - dt);
  state.cooldown = Math.max(0, state.cooldown - dt);
  if (held && state.cooldown === 0 && state.shots.length < MAX_SHOTS && state.rest === 0) {
    state.shots.push({ x: ship.x, y: ship.y - 5 });
    state.cooldown = FIRE_EVERY;
    events.push('fire');
  }
  for (const shot of state.shots) shot.y -= SHOT_SPEED * dt;
  state.shots = state.shots.filter((shot) => shot.y > -4);

  // ── Between waves: let the field clear, then bring the next ─────────────
  if (state.rest > 0) {
    state.rest = Math.max(0, state.rest - dt);
    moveBombs(state, dt);
    if (state.rest === 0) { startWave(state, state.wave + 1); events.push('wave'); }
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
    } else if (enemy.mode === 'dive') {
      enemy.phase += dt;
      // Steer toward the ship, with a weave on top so a dive is not a straight line.
      const pull = clamp((ship.x - enemy.x) * 1.4, -40, 40);
      enemy.vx += (pull - enemy.vx) * Math.min(1, dt * 2);
      enemy.x = clamp(enemy.x + (enemy.vx + Math.sin(enemy.phase * 5) * 18) * dt, 3, WIDTH - 3);
      enemy.y += config.diveSpeed * dt;
      if (enemy.y > HEIGHT + 8) { enemy.y = -8; enemy.mode = 'return'; }
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
      enemy.mode = 'dive';
      enemy.phase = 0;
      enemy.vx = 0;
    }
  }

  // Shoot back — from a diver if there is one, otherwise from the formation.
  state.fireClock -= dt;
  if (state.fireClock <= 0) {
    state.fireClock = config.fireEvery;
    const divers = state.enemies.filter((enemy) => enemy.mode === 'dive' && enemy.y < SHIP_Y - 20);
    const pool = divers.length ? divers : state.enemies.filter((enemy) => enemy.mode === 'form');
    if (pool.length) {
      const enemy = pool[Math.floor(state.random() * pool.length)];
      const aim = clamp((ship.x - enemy.x) / Math.max(20, SHIP_Y - enemy.y), -0.5, 0.5);
      state.bombs.push({ x: enemy.x, y: enemy.y + 4, vx: aim * config.shotSpeed, vy: config.shotSpeed });
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
      state.score += (enemy.mode === 'dive' ? 100 : 50) * (enemy.row === 0 ? 2 : 1);
      events.push('kill');
      break;
    }
  }
  state.shots = state.shots.filter((shot) => shot.y > -4);

  if (ship.safe === 0) {
    const bomb = state.bombs.find((one) => near(one, ship, SHIP_RADIUS + 1));
    const rammer = state.enemies.find((enemy) => enemy.hp > 0 && enemy.wait <= 0 && near(enemy, ship, SHIP_RADIUS + ENEMY_RADIUS - 1));
    if (bomb || rammer) {
      if (bomb) bomb.y = HEIGHT + 99;
      if (rammer) rammer.hp = 0;
      state.lives -= 1;
      ship.safe = SAFE_AFTER_HIT;
      state.bombs = [];
      events.push('hit');
      if (state.lives <= 0) { state.over = true; events.push('over'); return events; }
    }
  }
  state.enemies = state.enemies.filter((enemy) => enemy.hp > 0);

  if (!state.enemies.length) {
    // A spare ship every fifth wave, so a long run can survive a mistake.
    if (state.wave % 5 === 0 && state.lives < MAX_LIVES) { state.lives += 1; events.push('life'); }
    state.rest = BETWEEN_WAVES;
    events.push('cleared');
  }
  return events;
}

function moveBombs(state, dt) {
  for (const bomb of state.bombs) { bomb.x += bomb.vx * dt; bomb.y += bomb.vy * dt; }
  state.bombs = state.bombs.filter((bomb) => bomb.y < HEIGHT + 4 && bomb.x > -4 && bomb.x < WIDTH + 4);
}

// ── Drawing ────────────────────────────────────────────────────────────────
//
// The poster system at arcade size: flat fills from the palette, one navy
// outline, paper behind. No glow on a shot, no gradient on a ship, no burst
// when something is hit — it is simply gone. `colors` is the palette read out
// of the stylesheet by the screen, so no colour is written down here.

const SHIP = [[0, -5.5], [5, 4], [1.8, 2.4], [0, 4.2], [-1.8, 2.4], [-5, 4]];
const TONE_BY_KIND = ['poppy', 'rose', 'sunshine', 'sky'];

function outline(g, points) {
  g.beginPath();
  points.forEach(([x, y], i) => (i ? g.lineTo(x, y) : g.moveTo(x, y)));
  g.closePath();
}

function drawShip(g, x, y, colors) {
  g.save();
  g.translate(x, y);
  outline(g, SHIP);
  g.fillStyle = colors.captain;
  g.fill();
  g.stroke();
  g.restore();
}

function drawEnemy(g, enemy, time, colors) {
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

function caption(g, text, colors, y = HEIGHT / 2) {
  g.fillStyle = colors.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = '900 7px Inter, system-ui, sans-serif';
  g.fillText(text, WIDTH / 2, y);
}

/**
 * Paint the whole field. `scale` is canvas pixels per field unit, `edge` the
 * outline weight in canvas pixels.
 */
export function paint(g, state, { colors, scale, edge }) {
  g.setTransform(scale, 0, 0, scale, 0, 0);
  g.fillStyle = colors.paper;
  g.fillRect(0, 0, WIDTH, HEIGHT);

  // A slow drift of dots, so the field reads as moving even between waves.
  g.fillStyle = colors.faint;
  for (let i = 0; i < 28; i++) {
    const x = (i * 37.3) % WIDTH;
    const y = (i * 53.7 + state.time * (8 + (i % 3) * 6)) % HEIGHT;
    g.fillRect(x, y, 0.8, 0.8);
  }

  g.lineWidth = edge / scale;
  g.lineJoin = 'round';
  g.strokeStyle = colors.ink;

  for (const enemy of state.enemies) if (enemy.wait <= 0) drawEnemy(g, enemy, state.time, colors);

  g.fillStyle = colors.ink;
  for (const shot of state.shots) g.fillRect(shot.x - 0.6, shot.y - 2, 1.2, 4);

  g.fillStyle = colors.poppy;
  for (const bomb of state.bombs) {
    outline(g, [[bomb.x, bomb.y - 1.8], [bomb.x + 1.2, bomb.y], [bomb.x, bomb.y + 1.8], [bomb.x - 1.2, bomb.y]]);
    g.fill();
    g.stroke();
  }

  const blinking = state.ship.safe > 0 && Math.floor(state.ship.safe * 8) % 2 === 0;
  if (!state.over && !blinking) drawShip(g, state.ship.x, state.ship.y, colors);

  if (!state.started) caption(g, 'HOLD ◀ OR ▶ TO FLY', colors, HEIGHT * 0.62);
  else if (state.rest > 0) caption(g, `WAVE ${state.wave + 1}`, colors);
}
