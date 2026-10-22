// Hoops: a basketball shoot-out, with no DOM in it.
//
// The ball waits at the bottom of the field; a swipe up throws it. The
// swipe's direction is where it is aimed and its length is how hard it goes.
// It has to come DOWN through a rim to count, like a real shot. The hoops
// slide along a rail at the top of the field, so every shot is a moving one.
//
// A few decisions shape it:
//
//   · It is played in levels, and every level can be beaten. A level asks
//     for a number of baskets from a number of balls — three from seven at
//     first. Make them and the next level starts; run out and the same level
//     starts again. Nobody is ever sent back to level one for a miss.
//   · Every level is at least as hard as the one before, and each knob stops
//     at a ceiling: the hoops slide faster, the rim narrows and climbs
//     farther away, a second and then a third hoop share the rail, wind
//     pushes the ball from level four, and a defender sways across the
//     middle from level six. More hoops is not easier — each one is narrower
//     and has less of the rail to itself.
//   · With more than one hoop, one is gold and worth double. It changes
//     every ball.
//   · A clean swish is worth more than a shot that touched the rim, and a
//     run of baskets in a row adds a little more.
//   · Everything random comes from a seed kept as a number on the state, so
//     a level can be replayed exactly, a test can clone a state and try a
//     shot on the copy, and every phone in a room race shoots at the same
//     hoops, wind and defender.
//
// The field is 100 units across and 160 down unless the screen asks for
// taller; the ball always starts 16 units above the bottom edge. A taller
// field stretches the throw with it (`stretch()`): gravity and launch speed
// grow together, so a shot takes the same time and the same swipe on any
// phone — otherwise a tall screen would put the hoop out of reach.

export const WIDTH = 100;
export const HEIGHT = 160;

const BALL_R = 4.2;
const FROM_BOTTOM = 16;        // where the ball waits, above the bottom edge
const GRAVITY = 230;           // units a second, a second
const LAUNCH = 250;            // upward speed of a full-strength throw
const SWIPE_FULL = 70;         // field units of swipe for a full-strength throw
const POWER = { min: 0.35, max: 1.35 };
const SWIPE_MIN = 6;           // shorter than this is a tap, not a throw
const RIM_BOUNCE = 0.55;       // how much speed a ball keeps off the rim
const WALL_BOUNCE = 0.7;
const FLIGHT_MAX = 5;          // seconds before a ball that is stuck is called dead
const BETWEEN = 1.6;           // seconds between levels
const SHOW_LEVEL = 2.4;        // seconds the level's goal stays on the field

/** The sounds this game makes, for js/games/chiptune.js. */
export const SOUNDS = {
  throw: [{ type: 'triangle', from: 300, to: 520, at: 0, dur: 0.09, gain: 0.06 }],
  rim: [{ type: 'square', from: 640, to: 560, at: 0, dur: 0.05, gain: 0.04 }],
  block: [{ noise: true, cutFrom: 1200, cutTo: 200, at: 0, dur: 0.12, gain: 0.1 }],
  basket: [
    { noise: true, cutFrom: 5000, cutTo: 2000, at: 0, dur: 0.14, gain: 0.06 },
    { type: 'triangle', from: 784, to: 784, at: 0.04, dur: 0.12, gain: 0.07 },
  ],
  swish: [
    { noise: true, cutFrom: 7000, cutTo: 3000, at: 0, dur: 0.2, gain: 0.07 },
    { type: 'triangle', from: 988, to: 988, at: 0.05, dur: 0.1, gain: 0.07 },
    { type: 'triangle', from: 1319, to: 1319, at: 0.14, dur: 0.14, gain: 0.07 },
  ],
  level: [523, 659, 784, 1047].map((hz, i) => ({ type: 'square', from: hz, to: hz, at: i * 0.08, dur: 0.1, gain: 0.05 })),
  over: [523, 440, 349, 262].map((hz, i) => ({ type: 'square', from: hz, to: hz, at: i * 0.15, dur: 0.13, gain: 0.05 })),
};

/**
 * How hard level `n` is. Every number moves in the harder direction as `n`
 * grows and stops at a ceiling, and there are always at least two spare balls.
 */
export function level(n) {
  const l = Math.max(1, Math.trunc(n) || 1);
  const target = Math.min(10, 3 + Math.floor((l - 1) / 2));
  const spare = Math.max(2, 4 - Math.floor((l - 1) / 3));
  return {
    target,
    balls: target + spare,
    hoops: l >= 7 ? 3 : l >= 3 ? 2 : 1,
    speed: Math.min(2.2, 0.6 + 0.1 * (l - 1)),          // how fast the hoops slide, radians a second
    rim: Math.max(6.5, 11 - 0.3 * (l - 1)),              // half the rim's opening
    hoopY: Math.max(24, 40 - 1 * (l - 1)),               // the rail: higher is farther away
    wind: l >= 4 ? Math.min(40, 10 + 3 * (l - 4)) : 0,   // the strongest gust, sideways
    defender: l >= 6 ? Math.min(1.6, 0.7 + 0.06 * (l - 6)) : 0,   // how fast the defender sways
    reach: l >= 6 ? Math.min(11, 6 + 0.35 * (l - 6)) : 0,         // half the defender's width
  };
}

/** How much taller than the standard field this one is, measured ball to rail. */
export function stretch(state) {
  return Math.max(1, (state.height - FROM_BOTTOM - 40) / (HEIGHT - FROM_BOTTOM - 40));
}

/** The next float in [0, 1) from the state's seed. */
function random(state) {
  state.seed = (state.seed * 16807) % 2147483647;
  return (state.seed - 1) / 2147483646;
}

function clamp(value, lo, hi) { return Math.max(lo, Math.min(hi, value)); }

/**
 * A run, parked until the first throw. It starts on level one unless told
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
    streak: 0,
    showLevel: 0,
    ball: null,
    hoops: [],
    wind: 0,
    gold: -1,
  };
  startLevel(state, Math.max(1, Math.trunc(from) || 1));
  return state;
}

function startLevel(state, n) {
  const config = level(n);
  state.level = n;
  state.config = config;
  state.made = 0;
  state.balls = config.balls;
  state.levelScore = state.score;          // what a retry of this level goes back to
  state.showLevel = SHOW_LEVEL;
  const lane = WIDTH / config.hoops;
  state.hoops = Array.from({ length: config.hoops }, (_, i) => ({
    center: lane * (i + 0.5),
    range: config.hoops === 1 ? 30 : Math.max(2, lane / 2 - config.rim - 2),
    phase: i * 2.1 + random(state) * Math.PI * 2,
    x: lane * (i + 0.5),
  }));
  placeHoops(state);
  nextBall(state);
}

/** A fresh ball at the bottom, with this ball's wind and gold hoop. */
function nextBall(state) {
  const config = state.config;
  state.ball = { x: WIDTH / 2, y: state.height - FROM_BOTTOM, vx: 0, vy: 0, live: false, touched: false, scored: false, flight: 0 };
  state.wind = config.wind ? Math.round((random(state) * 2 - 1) * config.wind) : 0;
  state.gold = config.hoops > 1 ? Math.floor(random(state) * config.hoops) : -1;
}

function placeHoops(state) {
  for (const hoop of state.hoops) hoop.x = hoop.center + Math.sin(state.time * state.config.speed + hoop.phase) * hoop.range;
}

/** Where the defender is now, or null below level six. */
export function defender(state) {
  if (!state.config.defender) return null;
  const y = (state.config.hoopY + state.height - FROM_BOTTOM) / 2;
  return { x: WIDTH / 2 + Math.sin(state.time * state.config.defender) * 34, y, reach: state.config.reach };
}

/**
 * Make the field `height` units tall (never less than HEIGHT). The ball keeps
 * its place above the bottom edge.
 */
export function resize(state, height) {
  const tall = Math.max(HEIGHT, Number(height) || HEIGHT);
  if (state.ball && !state.ball.live) state.ball.y = tall - FROM_BOTTOM;
  state.height = tall;
  return state;
}

/** Whether a throw would be taken right now. */
export function ready(state) {
  return !state.over && state.rest === 0 && state.ball && !state.ball.live && state.balls > 0;
}

/**
 * Throw the ball. `swipe` is `{ dx, dy }` in field units, finger down to
 * finger up; up the field is negative `dy`. The direction is the aim — the
 * ball arrives at the rail where the swipe's line meets it — and the length
 * is the strength. Returns what happened.
 */
export function shoot(state, swipe = {}) {
  const dx = Number(swipe.dx) || 0;
  const dy = Number(swipe.dy) || 0;
  if (!ready(state) || dy > -SWIPE_MIN) return [];
  const events = [];
  if (!state.started) { state.started = true; events.push('start'); }
  const ball = state.ball;
  const power = clamp(-dy / SWIPE_FULL, POWER.min, POWER.max);
  const gravity = GRAVITY * stretch(state);
  const vy = power * LAUNCH * stretch(state);
  const rail = state.config.hoopY;
  const apex = ball.y - (vy * vy) / (2 * gravity);
  const up = vy / gravity;
  const flight = apex < rail ? up + Math.sqrt((2 * (rail - apex)) / gravity) : up;
  const target = ball.x + (dx / -dy) * (ball.y - rail);
  ball.vx = clamp((target - ball.x) / flight, -140, 140);
  ball.vy = -vy;
  ball.live = true;
  ball.flight = 0;
  state.balls -= 1;
  events.push('throw');
  return events;
}

/** Advance the run by `dt` seconds. Returns what happened. */
export function step(state, dt = 1 / 60) {
  const events = [];
  if (state.over || !state.started) return events;
  dt = Math.min(dt, 0.05);
  state.time += dt;
  state.showLevel = Math.max(0, state.showLevel - dt);
  placeHoops(state);

  if (state.rest > 0) {
    state.rest = Math.max(0, state.rest - dt);
    if (state.rest === 0) { startLevel(state, state.level + 1); events.push('next'); }
    return events;
  }

  const ball = state.ball;
  if (!ball.live) return events;
  const config = state.config;
  const before = ball.y;
  ball.flight += dt;
  ball.vy += GRAVITY * stretch(state) * dt;
  ball.vx += state.wind * dt;
  ball.x += ball.vx * dt;
  ball.y += ball.vy * dt;

  // The side walls.
  if (ball.x < BALL_R) { ball.x = BALL_R; ball.vx = Math.abs(ball.vx) * WALL_BOUNCE; }
  if (ball.x > WIDTH - BALL_R) { ball.x = WIDTH - BALL_R; ball.vx = -Math.abs(ball.vx) * WALL_BOUNCE; }

  // The defender knocks a rising ball back down.
  const guard = defender(state);
  if (guard && ball.vy < 0 && Math.abs(ball.y - guard.y) < 2.5 + BALL_R && Math.abs(ball.x - guard.x) < guard.reach + BALL_R) {
    ball.vy = Math.abs(ball.vy) * 0.35;
    ball.vx *= 0.5;
    ball.blocked = true;
    events.push('block');
  }

  // The rims: two hard points each side of every opening.
  for (const hoop of state.hoops) {
    for (const side of [-1, 1]) {
      const px = hoop.x + side * config.rim;
      const nx = ball.x - px;
      const ny = ball.y - config.hoopY;
      const d = Math.hypot(nx, ny);
      if (d >= BALL_R + 0.8 || d === 0) continue;
      const ux = nx / d;
      const uy = ny / d;
      ball.x = px + ux * (BALL_R + 0.8);
      ball.y = config.hoopY + uy * (BALL_R + 0.8);
      const along = ball.vx * ux + ball.vy * uy;
      if (along < 0) {
        ball.vx -= (1 + RIM_BOUNCE) * along * ux;
        ball.vy -= (1 + RIM_BOUNCE) * along * uy;
        if (!ball.touched) events.push('rim');
        ball.touched = true;
      }
    }
  }

  // Down through an opening is a basket.
  if (!ball.scored && ball.vy > 0 && before < config.hoopY && ball.y >= config.hoopY) {
    const index = state.hoops.findIndex((hoop) => Math.abs(ball.x - hoop.x) < config.rim - 0.5);
    if (index >= 0) {
      ball.scored = true;
      state.made += 1;
      state.streak += 1;
      const points = (ball.touched ? 2 : 3) * (index === state.gold ? 2 : 1) + Math.min(5, state.streak - 1);
      state.score += points;
      ball.points = points;
      ball.gold = index === state.gold;
      events.push(ball.touched ? 'basket' : 'swish');
    }
  }

  const gone = ball.y > state.height + 10 || ball.flight > FLIGHT_MAX || (ball.scored && ball.y > config.hoopY + 22);
  if (!gone) return events;

  if (!ball.scored) { state.streak = 0; events.push('miss'); }
  if (state.made >= config.target) {
    state.score += state.balls * 5;          // every ball not needed is worth a little
    state.rest = BETWEEN;
    ball.live = false;
    events.push('level');
  } else if (state.balls <= 0) {
    state.over = true;
    ball.live = false;
    events.push('over');
  } else {
    nextBall(state);
  }
  return events;
}

// ── Drawing ────────────────────────────────────────────────────────────────
//
// The poster system on a court: paper behind, flat palette fills, one navy
// outline. `colors` is the palette read out of the stylesheet by the screen.

function caption(g, text, colors, y, size = 7) {
  g.fillStyle = colors.ink;
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.font = `900 ${size}px Inter, system-ui, sans-serif`;
  g.fillText(text, WIDTH / 2, y);
}

function drawHoop(g, hoop, rail, rim, gold, colors) {
  // The backboard, then the net, then the rim on top.
  g.fillStyle = gold ? colors.sunshine : colors.sky;
  g.fillRect(hoop.x - rim - 3, rail - 14, rim * 2 + 6, 11);
  g.strokeRect(hoop.x - rim - 3, rail - 14, rim * 2 + 6, 11);
  g.strokeRect(hoop.x - 3, rail - 10, 6, 5);
  g.beginPath();
  for (let i = 0; i <= 4; i++) {
    const top = hoop.x - rim + (rim * 2 * i) / 4;
    const bottom = hoop.x - rim * 0.6 + (rim * 1.2 * i) / 4;
    g.moveTo(top, rail);
    g.lineTo(bottom, rail + 8);
  }
  g.moveTo(hoop.x - rim * 0.8, rail + 4);
  g.lineTo(hoop.x + rim * 0.8, rail + 4);
  g.save();
  g.lineWidth /= 2;
  g.stroke();
  g.restore();
  g.beginPath();
  g.ellipse(hoop.x, rail, rim, 1.6, 0, 0, Math.PI * 2);
  g.fillStyle = colors.poppy;
  g.fill();
  g.stroke();
}

function drawBall(g, ball, colors) {
  g.save();
  g.translate(ball.x, ball.y);
  g.rotate(ball.live ? ball.flight * ball.vx * 0.08 : 0);
  g.beginPath();
  g.arc(0, 0, BALL_R, 0, Math.PI * 2);
  g.fillStyle = colors.poppy;
  g.fill();
  g.stroke();
  g.beginPath();
  g.moveTo(-BALL_R, 0); g.lineTo(BALL_R, 0);
  g.moveTo(0, -BALL_R); g.lineTo(0, BALL_R);
  g.stroke();
  g.restore();
}

/**
 * Paint the whole field. `scale` is canvas pixels per field unit, `edge` the
 * outline weight in canvas pixels, `aim` an optional `{ dx, dy }` swipe in
 * progress to show as an arrow from the ball.
 */
export function paint(g, state, { colors, scale, edge, aim = null }) {
  g.setTransform(scale, 0, 0, scale, 0, 0);
  const tall = state.height;
  g.fillStyle = colors.paper;
  g.fillRect(0, 0, WIDTH, tall);
  g.lineWidth = edge / scale;
  g.lineJoin = 'round';
  g.lineCap = 'round';
  g.strokeStyle = colors.ink;
  const config = state.config;

  // The court: a key and an arc under the ball, faint.
  g.save();
  g.strokeStyle = colors.faint;
  g.beginPath();
  g.arc(WIDTH / 2, tall, 28, Math.PI, 0);
  g.moveTo(WIDTH / 2 - 14, tall); g.lineTo(WIDTH / 2 - 14, tall - 34);
  g.lineTo(WIDTH / 2 + 14, tall - 34); g.lineTo(WIDTH / 2 + 14, tall);
  g.stroke();
  g.restore();

  // The rail the hoops slide along.
  g.beginPath();
  g.moveTo(2, config.hoopY - 14);
  g.lineTo(WIDTH - 2, config.hoopY - 14);
  g.stroke();

  const guard = defender(state);
  if (guard) {
    g.fillStyle = colors.captain;
    g.beginPath();
    g.roundRect?.(guard.x - guard.reach, guard.y - 2.5, guard.reach * 2, 5, 2.5);
    if (!g.roundRect) g.rect(guard.x - guard.reach, guard.y - 2.5, guard.reach * 2, 5);
    g.fill();
    g.stroke();
  }

  // The ball goes behind the rims on its way down through them.
  const ball = state.ball;
  const behind = ball && ball.live && ball.vy > 0 && ball.y < config.hoopY + 8 && ball.y > config.hoopY - 6;
  if (ball && behind) drawBall(g, ball, colors);
  state.hoops.forEach((hoop, i) => drawHoop(g, hoop, config.hoopY, config.rim, i === state.gold, colors));
  if (ball && !behind && !(state.rest > 0)) drawBall(g, ball, colors);

  // The aim, while a finger is drawing a throw.
  if (aim && ready(state) && aim.dy < -SWIPE_MIN) {
    const length = Math.min(1, -aim.dy / (SWIPE_FULL * POWER.max));
    const reach = 14 + 30 * length;
    const norm = Math.hypot(aim.dx, aim.dy) || 1;
    const tx = ball.x + (aim.dx / norm) * reach;
    const ty = ball.y + (aim.dy / norm) * reach;
    g.save();
    g.setLineDash([1.5, 2.5]);
    g.beginPath();
    g.moveTo(ball.x, ball.y - BALL_R - 1);
    g.lineTo(tx, ty);
    g.stroke();
    g.restore();
  }

  // The numbers that belong on the field: wind, and balls left.
  g.fillStyle = colors.ink;
  g.textBaseline = 'alphabetic';
  g.font = '800 4px Inter, system-ui, sans-serif';
  if (state.wind) {
    g.textAlign = 'left';
    const arrows = state.wind > 0 ? '→'.repeat(1 + Math.floor(Math.abs(state.wind) / 15)) : '←'.repeat(1 + Math.floor(Math.abs(state.wind) / 15));
    g.fillText(`WIND ${arrows}`, 3, 6);
  }
  g.textAlign = 'right';
  g.fillText(`${state.made}/${config.target} · ${state.balls} ${state.balls === 1 ? 'ball' : 'balls'}`, WIDTH - 3, 6);
  if (state.gold >= 0) {
    g.textAlign = 'center';
    g.fillText('GOLD HOOP ×2', WIDTH / 2, 6);
  }

  const middle = (config.hoopY + tall) / 2;
  if (state.rest > 0) {
    caption(g, `LEVEL ${state.level} DONE!`, colors, middle);
    caption(g, `NEXT: LEVEL ${state.level + 1}`, colors, middle + 9, 5);
  } else if (!state.started || state.showLevel > 0) {
    caption(g, `LEVEL ${state.level}`, colors, middle - 6);
    caption(g, `MAKE ${config.target} OF ${config.balls}`, colors, middle + 3, 5.5);
    if (!state.started) caption(g, 'SWIPE UP TO SHOOT', colors, middle + 11, 4.5);
  } else if (ball && ball.scored && ball.live) {
    caption(g, `${ball.touched ? 'BASKET' : 'SWISH'}! +${ball.points}`, colors, middle, 6);
  }
}
