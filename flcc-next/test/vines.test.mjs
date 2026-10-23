// Monkey Climb.
//
// The rules are pure functions, so the promises the game makes can be held
// without a thumb: one vine climbs slow and slides fast, two climb fast and
// slide slow; fruit knocks lizards off; falling is never a death; every level
// is at least as hard as the last up to 25 — and every level can be beaten,
// which a patient player below proves by looking ahead on a copy of the game
// before every move.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as vines from '../js/games/vines.js';

const DT = 1 / 60;
const run = (state, input, seconds, dt = DT) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...vines.step(state, input, dt));
  return events;
};
const quiet = (state) => {
  state.lizardClock = 1e9; state.birdClock = 1e9; state.nutClock = 1e9;
  state.lizards = []; state.birds = []; state.nuts = []; state.crawlers = [];
};
const walkTo = (state, x) => { for (let i = 0; i < 600 && Math.abs(state.monkey.x - x) > 0.6; i++) vines.step(state, { [x > state.monkey.x ? 'right' : 'left']: true }, DT); };

test('nothing moves until something is pressed', () => {
  const state = vines.create(3);
  run(state, {}, 2);
  assert.equal(state.time, 0);
  assert.ok(vines.step(state, { right: true }, DT).includes('start'));
});

test('one vine climbs slowly and slides fast; two climb fast and slide slowly', () => {
  const climbRate = (two, dir) => {
    const state = vines.create(3);
    run(state, { right: true }, DT);
    quiet(state);
    walkTo(state, 24);
    run(state, { up: true }, DT);
    assert.equal(state.monkey.mode, 'vine');
    if (two) { run(state, { right: true }, DT); assert.equal(state.monkey.two, true, 'pushing toward the partner grabs both'); }
    run(state, { up: true }, 2);                   // somewhere in the middle
    const y = state.monkey.y;
    run(state, dir < 0 ? { up: true } : { down: true }, 0.5);
    return Math.abs(state.monkey.y - y) / 0.5;
  };
  assert.ok(climbRate(true, -1) > climbRate(false, -1) * 1.5, 'two vines climb faster');
  assert.ok(climbRate(false, 1) > climbRate(true, 1) * 1.5, 'one vine slides faster');
});

test('the top of a vine leads onto the branch above, and the key clears the level', () => {
  const state = vines.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  walkTo(state, 24);
  run(state, { up: true }, DT);
  run(state, { right: true }, DT);
  run(state, { up: true }, 6);
  assert.equal(state.monkey.mode, 'ground');
  assert.equal(state.monkey.y, 26, 'up on the top branch');
  const events = run(state, { right: true }, 6);
  assert.ok(events.includes('level') && events.includes('next'));
  assert.equal(state.level, 2);
});

test('jumping off a vine can catch the next one in mid-air', () => {
  const state = vines.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  Object.assign(state.monkey, { mode: 'vine', vine: 5, two: false, x: 71, y: 80 });   // the right of the middle pair
  const events = [...run(state, { right: true }, DT), ...run(state, {}, 0.8)];
  assert.ok(events.includes('jump') && events.includes('grab'), events.join());
  assert.equal(state.monkey.vine, 6, 'caught the single vine to the right');
});

test('falling is never a death: letting go drops the monkey to the floor below', () => {
  const state = vines.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  Object.assign(state.monkey, { mode: 'vine', vine: 2, two: false, x: 44, y: 90 });
  const lives = state.lives;
  run(state, { down: true }, 3);
  assert.equal(state.monkey.mode, 'ground');
  assert.equal(state.monkey.y, 134);
  assert.equal(state.lives, lives);
});

test('a lizard that reaches the monkey costs a life; losing the last ends the level', () => {
  const state = vines.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  walkTo(state, 44);
  run(state, { up: true }, DT);
  state.lives = 1;
  state.lizards.push({ vine: 2, x: 44, y: state.monkey.y - 12, dir: 1, patrol: false, falling: false, vy: 0 });
  const events = run(state, {}, 3);
  assert.ok(events.includes('hit') && events.includes('over'));
  assert.deepEqual(vines.step(state, { up: true }, DT), []);
});

test('fruit knocked loose falls and knocks lizards off for points', () => {
  const state = vines.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  state.fruit = [{ x: 66, y: 50, vy: 0, falling: false, chain: 0 }];
  state.lizards.push({ vine: 4, x: 66, y: 80, dir: -1, patrol: true, falling: false, vy: 0 });
  Object.assign(state.monkey, { mode: 'vine', vine: 4, two: false, x: 66, y: 50 + 6 });
  const score = state.score;
  const events = run(state, {}, 0.6);
  assert.ok(events.includes('fruit') && events.includes('bonk'), events.join());
  assert.equal(state.lizards.length, 0);
  assert.ok(state.score >= score + 200);
});

test('every level is at least as hard as the one before, up to level 25, and then stays there', () => {
  const harder = { lizardEvery: -1, lizardSpeed: 1, patrol: 1, maxLizards: 1, aim: 1, fruit: -1, birdEvery: 0, birdSpeed: 1, crawlers: 1, nutEvery: 0, time: -1 };
  assert.equal(vines.HARDEST, 25);
  for (let n = 1; n < 60; n++) {
    const now = vines.level(n);
    const next = vines.level(n + 1);
    for (const [key, direction] of Object.entries(harder)) {
      if (!direction) { if (now[key]) assert.ok(next[key] && next[key] <= now[key], `${key} at level ${n + 1}`); continue; }
      assert.ok((next[key] - now[key]) * direction >= 0, `level ${n + 1} is easier than level ${n} on ${key}`);
    }
  }
  for (let n = 26; n < 60; n++) assert.deepEqual(vines.level(n), vines.level(25));
  const before = vines.level(24);
  const top = vines.level(25);
  assert.ok(Object.keys(top).some((key) => top[key] !== before[key]), 'level 25 is still harder than level 24');
  assert.ok(!vines.level(6).birdEvery && vines.level(7).birdEvery, 'birds arrive at level 7');
  assert.ok(!vines.level(12).crawlers && vines.level(13).crawlers, 'branch lizards arrive at level 13');
  assert.ok(!vines.level(18).nutEvery && vines.level(19).nutEvery, 'coconuts arrive at level 19');
});

test('a failed level is retried at that level with the score it started with', () => {
  const state = vines.create(5, { level: 13, score: 2400 });
  assert.equal(state.level, 13);
  assert.equal(state.levelScore, 2400);
  assert.equal(state.crawlers.length, 1);
  for (const bad of [0, -2, NaN, undefined, 'x']) assert.equal(vines.create(5, { level: bad }).level, 1, String(bad));
});

test('a level replays exactly from its seed', () => {
  const play = () => {
    const state = vines.create(42, { level: 14 });
    for (let i = 0; i < 60 * 20; i++) vines.step(state, { right: i % 120 < 60, left: i % 120 >= 60, up: i % 200 < 100, jump: i % 45 === 0 }, DT);
    return [state.score, state.lives, state.lizards.length, state.monkey.x, state.monkey.y];
  };
  assert.deepEqual(play(), play());
});

// ── Every level can be beaten ───────────────────────────────────────────────
//
// A patient player. Its plan: up the left pair of vines (both hands, so it
// climbs fast) and along the top branch to the key — or, from the middle
// branch or the right one, up whichever vine is there. Before every move it
// tries a few on a copy of the game a second and a half ahead, and takes the
// one that keeps it unhurt the longest.

const TICK = 1 / 30;

function plan(state) {
  const m = state.monkey;
  if (m.mode === 'air') return {};
  if (m.mode === 'vine') {
    const vine = vines.VINES[m.vine];
    const mate = vines.VINES.find((v) => v.x !== vine.x && Math.abs(v.x - vine.x) <= 5.5);
    if (mate && !m.two) return mate.x > vine.x ? { right: true } : { left: true };
    return { up: true };
  }
  const targets = { 134: 24, 70: 54, 104: 66 };
  if (Math.abs(m.y - 26) < 0.01) return { right: true };
  const x = targets[Math.round(m.y)];
  if (x === undefined) return {};
  if (Math.abs(m.x - x) < 1) return { up: true };
  return x > m.x ? { right: true } : { left: true };
}

function survive(state, first, horizon) {
  const copy = structuredClone(state);
  const lives = copy.lives;
  const level = copy.level;
  for (let t = 0; t < horizon; t += TICK) {
    vines.step(copy, t < 0.1 ? first(copy) : plan(copy), TICK);
    if (copy.level !== level) return { safe: horizon + 1, progress: 1e6 };
    if (copy.lives < lives || copy.pause > 0) return { safe: t, progress: 0 };
  }
  return { safe: horizon, progress: -copy.monkey.y + (copy.monkey.y < 27 ? copy.monkey.x : 0) };
}

const MOVES = [
  (s) => plan(s),
  () => ({}),
  () => ({ down: true }),
  () => ({ left: true }),
  () => ({ right: true }),
  () => ({ jump: true }),
];

test('every level can be beaten', () => {
  for (let n = 1; n <= vines.HARDEST; n++) {
    const state = vines.create(4000 + n, { level: n });
    for (let i = 0; i < 30 * 300 && state.level === n && !state.over; i++) {
      let best = null;
      for (const move of MOVES) {
        const result = survive(state, move, 1.8);
        // The route unless something else stays safe longer; a clear always wins.
        if (!best || result.safe > best.safe) best = { ...result, move };
      }
      for (let k = 0; k < 3 && state.level === n && !state.over; k++) vines.step(state, best.move(state), TICK);
    }
    assert.equal(state.over, false, `level ${n} could not be beaten (lives ${state.lives})`);
    assert.equal(state.level, n + 1, `level ${n} was not cleared in five minutes`);
  }
});
