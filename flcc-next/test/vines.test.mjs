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
  const events = run(state, { right: true }, 8);
  assert.ok(events.includes('level') && events.includes('next'));
  assert.equal(state.level, 2);
});

test('reaching the key plays the rescue: carry the key to the cage, spring the lock, papa hops out', () => {
  const state = vines.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  const { key, cage } = vines.STAGES[state.stage];
  Object.assign(state.monkey, { mode: 'ground', x: key.x - 2, y: key.y });
  const events = run(state, {}, DT);
  assert.ok(events.includes('level'), 'the key is reached');
  assert.ok(state.rescue, 'the rescue begins');
  // Held up first, then carried along to the cage door.
  run(state, {}, vines.RESCUE.lift - 0.05);
  assert.ok(Math.abs(state.monkey.x - (key.x - 2)) < 0.01, 'the key is held up where it was found');
  run(state, {}, (vines.RESCUE.carry - vines.RESCUE.lift) / 2);
  const halfway = state.monkey.x;
  assert.ok(halfway < key.x - 10 && halfway > cage.x + 10, `carried along the top (at ${halfway})`);
  const later = run(state, {}, vines.RESCUE.done - vines.RESCUE.carry / 2 - vines.RESCUE.lift / 2 - 0.1);
  assert.ok(Math.abs(state.monkey.x - (cage.x + 10)) < 0.01, 'at the cage door');
  assert.ok(later.includes('unlock') && later.includes('free'), later.join());
  assert.ok(later.indexOf('unlock') < later.indexOf('free'), 'the lock springs before papa comes out');
  assert.equal(state.level, 1, 'still the rescue, not yet the next level');
  const next = run(state, {}, 0.3);
  assert.ok(next.includes('next'));
  assert.equal(state.level, 2);
  assert.equal(state.rescue, null);
});

test('nothing hurts during the rescue: the jungle goes quiet', () => {
  const state = vines.create(3, { level: 20 });
  run(state, { right: true }, DT);
  run(state, {}, 4);
  const { key } = vines.STAGES[state.stage];
  Object.assign(state.monkey, { mode: 'ground', x: key.x, y: key.y });
  const lives = state.lives;
  run(state, {}, DT);
  assert.deepEqual([state.lizards.length, state.birds.length, state.nuts.length], [0, 0, 0]);
  run(state, {}, vines.RESCUE.done + 0.2);
  assert.equal(state.lives, 3, 'a fresh level, lives restored');
  assert.equal(state.level, 21);
  assert.ok(lives > 0);
});

// ── The stages ──────────────────────────────────────────────────────────────

/** The ledges a monkey on ledge `from` can climb to, and by which vine. */
function climbs(stage, from) {
  const l = stage.ledges[from];
  const out = [];
  for (const [index, v] of stage.vines.entries()) {
    if (v.x < l.x1 || v.x > l.x2 || v.bottom + 6 < l.y - 10 || v.top + 6 > l.y) continue;
    const mate = vines.partner(stage.vines, v);
    const x = mate ? (v.x + mate.x) / 2 : v.x;
    const above = vines.ledgeAt(stage.ledges, v.top - 4, x);
    if (above) out.push({ vine: index, x: v.x, to: stage.ledges.indexOf(above) });
  }
  return out;
}

/** For each ledge, the vine to take next on the shortest way to the key's ledge. */
function routes(stage) {
  const goal = stage.ledges.indexOf(vines.ledgeAt(stage.ledges, stage.key.y, stage.key.x));
  const next = new Map([[goal, null]]);
  for (let changed = true; changed;) {
    changed = false;
    for (let i = 0; i < stage.ledges.length; i++) {
      if (next.has(i)) continue;
      const way = climbs(stage, i).find((c) => next.has(c.to));
      if (way) { next.set(i, way); changed = true; }
    }
  }
  return { goal, next };
}

test('there are eight stages, taken in turn, each its own jungle and time of day', () => {
  assert.equal(vines.STAGES.length, 8);
  const shapes = new Set(vines.STAGES.map((s) => JSON.stringify([s.ledges, s.vines, s.key, s.cage])));
  assert.equal(shapes.size, 8, 'no two stages share a layout');
  for (let n = 1; n <= 30; n++) {
    const state = vines.create(5, { level: n });
    assert.equal(vines.STAGES[state.stage], vines.stageFor(n));
    if (n <= 8) assert.equal(state.stage, n - 1, `level ${n} is stage ${n}`);
    if (n > 1) assert.notEqual(vines.stageFor(n).sky, vines.stageFor(n - 1).sky, `level ${n} changes the time of day`);
  }
  assert.deepEqual(new Set(vines.STAGES.map((s) => s.sky)), new Set(vines.SKIES));
  // Each time round, the eight start one further on.
  assert.notEqual(vines.stageFor(9), vines.stageFor(1));
  for (let lap = 0; lap < 3; lap++) {
    assert.equal(new Set(Array.from({ length: 8 }, (_, i) => vines.stageFor(lap * 8 + i + 1))).size, 8, `lap ${lap + 1} plays all eight`);
  }
});

test('every stage keeps the rules: a floor, the key and cage up top, every vine leading somewhere, a way up', () => {
  for (const [i, stage] of vines.STAGES.entries()) {
    const name = `stage ${i + 1}`;
    const [floor, ...branches] = stage.ledges;
    assert.deepEqual([floor.x1, floor.x2], [0, vines.WIDTH], `${name}: the floor runs the whole width`);
    for (const l of branches) assert.ok(l.y < floor.y && l.x1 < l.x2 && l.x1 >= 0 && l.x2 <= vines.WIDTH, `${name}: a branch above the floor`);
    assert.equal(stage.key.y, 26);
    assert.equal(stage.cage.y, 26);
    assert.ok(vines.ledgeAt(stage.ledges, stage.key.y, stage.key.x), `${name}: the key sits on a branch`);
    // The cage door opens onto the top branch, where the rescue walks to.
    const side = Math.sign(stage.key.x - stage.cage.x);
    assert.ok(vines.ledgeAt(stage.ledges, 26, stage.cage.x + side * 10 + side * 0.5) || vines.ledgeAt(stage.ledges, 26, stage.cage.x + side * 12), `${name}: the cage door opens onto the branch`);
    assert.ok(Math.abs(stage.key.x - stage.cage.x) > 50, `${name}: key and cage at opposite ends`);
    for (const v of stage.vines) {
      const mate = vines.partner(stage.vines, v);
      const x = mate ? (v.x + mate.x) / 2 : v.x;
      assert.ok(v.top < v.bottom && v.bottom < floor.y, `${name}: vine at ${v.x} hangs above the floor`);
      assert.ok(vines.ledgeAt(stage.ledges, v.top - 4, x), `${name}: the vine at ${v.x} leads up onto a branch`);
      const close = stage.vines.filter((o) => o !== v && Math.abs(o.x - v.x) <= vines.PAIR);
      assert.ok(close.length <= 1, `${name}: vine at ${v.x} is in at most one pair`);
      if (mate) assert.deepEqual([mate.top, mate.bottom], [v.top, v.bottom], `${name}: a pair hangs together`);
    }
    assert.ok(stage.vines.some((v) => v.top <= 30 && v.bottom - v.top > 50), `${name}: a long vine down from the top, for lizards and fruit`);
    const { next } = routes(stage);
    assert.ok(next.has(0), `${name}: there is a way up from the floor to the key`);
  }
});


test('jumping off a vine can catch the next one in mid-air', () => {
  const state = vines.create(3);
  run(state, { right: true }, DT);
  quiet(state);
  Object.assign(state.monkey, { mode: 'vine', vine: 5, two: false, x: 71, y: 80 });   // the right of the middle pair
  const events = [...run(state, { right: true }, DT), ...run(state, {}, 0.8)];
  assert.ok(events.includes('jump') && events.includes('grab'), events.join());
  assert.equal(state.monkey.vine, 6, 'caught the single vine to the right');
  assert.equal(state.stage, 0, 'level one is the first stage');
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
// A patient player. Its plan, on whichever stage the level is played: from
// the branch it is on, take the vine on the shortest way to the key's branch
// (both hands on a pair, so it climbs fast), and walk along to the key.
// Before every move it tries a few on a copy of the game two and a half
// seconds ahead, and takes the one that keeps it unhurt the longest.

const TICK = 1 / 30;

const ways = vines.STAGES.map(routes);

function plan(state) {
  const m = state.monkey;
  const stage = vines.STAGES[state.stage];
  if (m.mode === 'air') return {};
  if (m.mode === 'vine') {
    const vine = stage.vines[m.vine];
    const mate = vines.partner(stage.vines, vine);
    if (mate && !m.two) return mate.x > vine.x ? { right: true } : { left: true };
    return { up: true };
  }
  const here = vines.ledgeAt(stage.ledges, m.y, m.x);
  if (!here) return {};
  const index = stage.ledges.indexOf(here);
  const { goal, next } = ways[state.stage];
  const x = index === goal ? stage.key.x : next.get(index)?.x;
  if (x === undefined) return {};
  if (index !== goal && Math.abs(m.x - x) < 1) return { up: true };
  return x > m.x ? { right: true } : { left: true };
}

function survive(state, first, horizon) {
  const copy = structuredClone(state);
  const lives = copy.lives;
  const level = copy.level;
  for (let t = 0; t < horizon; t += TICK) {
    vines.step(copy, t < 0.1 ? first(copy) : plan(copy), TICK);
    if (copy.level !== level || copy.rescue) return { safe: horizon + 1 };
    if (copy.lives < lives || copy.pause > 0) return { safe: t };
  }
  return { safe: horizon };
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
    vines.step(state, plan(state), TICK);         // standing still never starts a level
    for (let i = 0; i < 30 * 300 && state.level === n && !state.over; i++) {
      let best = null;
      for (const move of MOVES) {
        const result = survive(state, move, 2.6);
        // The route unless something else stays safe longer; a clear always wins.
        if (!best || result.safe > best.safe) best = { ...result, move };
      }
      for (let k = 0; k < 3 && state.level === n && !state.over; k++) vines.step(state, best.move(state), TICK);
    }
    assert.equal(state.over, false, `level ${n} could not be beaten (lives ${state.lives})`);
    assert.equal(state.level, n + 1, `level ${n} was not cleared in five minutes`);
  }
});
