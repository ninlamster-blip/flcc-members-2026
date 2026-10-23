// David and the Giant.
//
// The rules are pure functions, so the promises the game makes can be held
// without a thumb: David runs, climbs and jumps; barrels roll down the tower
// and hurt; falling is never a death; every level is at least as hard as the
// last up to level 25 — and every level can be beaten, which a patient player
// below proves by looking a second ahead on a copy of the game before each move.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as giant from '../js/games/giant.js';

const DT = 1 / 60;
const run = (state, input, seconds, dt = DT) => {
  const events = [];
  for (let t = 0; t < seconds; t += dt) events.push(...giant.step(state, input, dt));
  return events;
};
const quiet = (state) => { state.throwClock = 1e9; state.springClock = 1e9; state.barrels = []; state.fires = []; state.springs = []; };

test('nothing moves until a button is pressed', () => {
  const state = giant.create(3);
  run(state, {}, 2);
  assert.equal(state.time, 0);
  assert.ok(giant.step(state, { right: true }, DT).includes('start'));
});

test('David runs, jumps and lands back on the girder', () => {
  const state = giant.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  const x = state.player.x;
  run(state, { right: true }, 0.5);
  assert.ok(state.player.x > x + 10, 'he runs');
  const floor = state.player.y;
  const events = run(state, { jump: true }, DT);
  assert.ok(events.includes('jump'));
  let top = floor;
  for (let i = 0; i < 60; i++) { giant.step(state, {}, DT); top = Math.min(top, state.player.y); }
  assert.ok(floor - top > 6, 'high enough to clear a barrel');
  assert.equal(state.player.y, floor, 'and he lands where he took off');
  assert.ok(state.player.ground);
});

test('ladders take him up a floor, and down again', () => {
  const state = giant.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  const start = state.player.y;
  const ladder = state.ladders.find((l) => l.bottom === 5);
  for (let i = 0; i < 400 && Math.abs(state.player.x - ladder.x) > 1; i++) giant.step(state, { [ladder.x > state.player.x ? 'right' : 'left']: true }, DT);
  run(state, { up: true }, 2);
  assert.ok(state.player.y < start - 15, 'he climbed a floor');
  assert.ok(state.player.ground && !state.player.ladder, 'and stepped off at the top');
  run(state, { down: true }, 2);
  assert.equal(state.player.y, start, 'and back down');
});

test('walking off the end of a girder drops him a floor — falling is never a death', () => {
  const state = giant.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  // Put him on floor 3, whose open end is on the left.
  Object.assign(state.player, { x: 20, y: 94, ground: true, ladder: null, vx: 0 });
  const lives = state.lives;
  const events = run(state, { left: true }, 1.5);
  assert.ok(events.includes('fall'));
  assert.equal(state.player.y, 114, 'he landed on the floor below');
  assert.equal(state.lives, lives, 'and lost nothing');
});

test('a barrel that reaches him costs a life; losing the last ends the level', () => {
  const state = giant.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  state.lives = 1;
  const p = state.player;
  state.barrels.push({ x: p.x + 1, y: p.y, floor: 5, dir: -1, vy: 0, mode: 'roll', spin: 0, jumped: false, ladder: null });
  const events = run(state, {}, 2);
  assert.ok(events.includes('hit') && events.includes('over'));
  assert.equal(state.over, true);
  assert.deepEqual(giant.step(state, { right: true }, DT), []);
});

test('jumping a barrel scores', () => {
  const state = giant.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  const p = state.player;
  state.barrels.push({ x: p.x + 9, y: p.y, floor: 5, dir: -1, vy: 0, mode: 'roll', spin: 0, jumped: false, ladder: null });
  const score = state.score;
  // Jump when it is a few steps away: a standing jump clears even the slowest barrel.
  for (let i = 0; i < 120 && state.barrels[0].x - p.x > 4.5; i++) giant.step(state, {}, DT);
  const events = [...giant.step(state, { jump: true }, DT), ...run(state, {}, 0.8)];
  assert.ok(events.includes('hop') && !events.includes('hit'), events.join());
  assert.ok(state.score >= score + 100);
});

test('reaching the lamb clears the level and starts the next', () => {
  const state = giant.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  Object.assign(state.player, { x: 70, y: 34, ground: true, ladder: null });
  const events = run(state, { right: true }, 3);
  assert.ok(events.includes('level') && events.includes('next'));
  assert.equal(state.level, 2);
  assert.equal(state.lives, 3);
});

test('barrels roll down the whole tower, floor by floor', () => {
  const state = giant.create(11);
  run(state, { left: true }, DT);
  state.config = { ...state.config, ladderChance: 0 };
  state.throwClock = 0;
  const floors = new Set();
  for (let i = 0; i < 60 * 30 && floors.size < 6; i++) {
    state.player.x = 3; state.player.y = 134; state.pause = 0; state.lives = 3;   // out of the way
    giant.step(state, {}, DT);
    for (const b of state.barrels) floors.add(b.floor);
    state.barrels = state.barrels.filter((b) => !(Math.abs(b.x - 3) < 6 && b.floor === 5));
  }
  assert.deepEqual([...floors].sort(), [0, 1, 2, 3, 4, 5]);
});

test('every level is at least as hard as the one before, up to level 25, and then stays there', () => {
  const harder = { throwEvery: -1, barrel: 1, ladderChance: 1, fireballs: 1, fireSpeed: 1, springEvery: 0, crumbles: 1, time: -1 };
  assert.equal(giant.HARDEST, 25);
  for (let n = 1; n < 60; n++) {
    const now = giant.level(n);
    const next = giant.level(n + 1);
    for (const [key, direction] of Object.entries(harder)) {
      if (key === 'springEvery') {
        if (now.springEvery) assert.ok(next.springEvery && next.springEvery <= now.springEvery);
        continue;
      }
      assert.ok((next[key] - now[key]) * direction >= 0, `level ${n + 1} is easier than level ${n} on ${key}`);
    }
  }
  for (let n = 26; n < 60; n++) assert.deepEqual(giant.level(n), giant.level(25));
  const before = giant.level(24);
  const top = giant.level(25);
  assert.ok(Object.keys(top).some((key) => top[key] !== before[key]), 'level 25 is still harder than level 24');
  assert.ok(!giant.level(7).fireballs && giant.level(8).fireballs, 'fireballs arrive at level 8');
  assert.ok(!giant.level(13).springEvery && giant.level(14).springEvery, 'springs arrive at level 14');
  assert.ok(!giant.level(18).crumbles && giant.level(19).crumbles, 'crumbling girders arrive at level 19');
});

test('a crumbling section gives way under him and drops him a floor', () => {
  const state = giant.create(5, { level: 19 });
  run(state, { right: true }, DT);
  quiet(state);
  const c = state.crumbles[0];
  Object.assign(state.player, { x: c.x + c.w / 2, y: 34 + c.floor * 20, ground: true, ladder: null, vx: 0 });
  const events = run(state, {}, 1.5);
  assert.ok(events.includes('crumble') && events.includes('fall'));
  assert.equal(state.player.y, 34 + (c.floor + 1) * 20);
});

test('a failed level is retried at that level with the score it started with', () => {
  const state = giant.create(5, { level: 9, score: 2400 });
  assert.equal(state.level, 9);
  assert.equal(state.levelScore, 2400);
  assert.equal(state.fires.length, 1, 'level 9 has a fireball');
  for (const bad of [0, -2, NaN, undefined, 'x']) assert.equal(giant.create(5, { level: bad }).level, 1, String(bad));
});

test('a level replays exactly from its seed', () => {
  const play = () => {
    const state = giant.create(42, { level: 12 });
    for (let i = 0; i < 60 * 20; i++) giant.step(state, { right: i % 120 < 60, left: i % 120 >= 60, jump: i % 45 === 0 }, DT);
    return [state.score, state.lives, state.barrels.length, state.player.x, state.player.y];
  };
  assert.deepEqual(play(), play());
});

// ── Every level can be beaten ───────────────────────────────────────────────
//
// A patient player. Its plan is simple — go to the nearest ladder up, climb
// it, and on the top floor walk to the lamb — and before every move it tries
// a few on a copy of the game and a second and a half ahead, and takes the
// one that keeps it unhurt the longest.

const TICK = 1 / 30;

function plan(state) {
  const p = state.player;
  if (p.ladder) return { up: true };
  if (!p.ground) return {};
  const g = Math.round((p.y - 34) / 20);
  if (g === 0) return { right: true };
  const ladders = state.ladders.filter((l) => l.bottom === g).sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x));
  const target = ladders[0];
  if (!target) return {};
  if (Math.abs(target.x - p.x) < 1.5) return { up: true };
  return target.x > p.x ? { right: true } : { left: true };
}

function survive(state, first, horizon) {
  const copy = structuredClone(state);
  const lives = copy.lives;
  const level = copy.level;
  for (let t = 0; t < horizon; t += TICK) {
    const input = t < 0.1 ? first(copy) : plan(copy);
    giant.step(copy, input, TICK);
    if (copy.level !== level) return { safe: horizon + 1, progress: 1e6 };
    if (copy.lives < lives || copy.pause > 0) return { safe: t, progress: 0 };
  }
  return { safe: horizon, progress: -copy.player.y };
}

const MOVES = [
  (s) => plan(s),
  (s) => ({ ...plan(s), jump: true }),
  () => ({ jump: true }),
  () => ({}),
  (s) => { const m = plan(s); return m.right ? { left: true } : m.left ? { right: true } : m.up ? { down: true } : {}; },
];

function bestMove(state) {
  let best = null;
  for (const move of MOVES) {
    const result = survive(state, move, 1.5);
    if (!best || result.safe > best.safe || (result.safe === best.safe && result.progress > best.progress)) best = { ...result, move };
  }
  return best.move;
}

test('every level can be beaten', () => {
  for (let n = 1; n <= giant.HARDEST; n++) {
    const state = giant.create(3000 + n, { level: n });
    for (let i = 0; i < 30 * 240 && state.level === n && !state.over; i++) {
      const move = bestMove(state);
      for (let k = 0; k < 3 && state.level === n && !state.over; k++) giant.step(state, move(state), TICK);
    }
    assert.equal(state.over, false, `level ${n} could not be beaten (lives ${state.lives})`);
    assert.equal(state.level, n + 1, `level ${n} was not cleared in four minutes`);
  }
});
