// Galaga.
//
// The rules are pure functions so this suite can exist. The three promises the
// game makes — it never ends, it only gets harder, and it fires only while a
// direction is held — are exactly the things nobody checks by playing for a
// minute.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as galaga from '../js/games/galaga.js';

const DT = 1 / 60;
const run = (state, input, seconds) => {
  const events = [];
  for (let t = 0; t < seconds; t += DT) events.push(...galaga.step(state, input, DT));
  return events;
};

test('nothing moves until a direction is pressed', () => {
  const state = galaga.create(3);
  assert.deepEqual(run(state, {}, 2), []);
  assert.equal(state.started, false);
  assert.equal(state.time, 0);
  assert.ok(run(state, { left: true }, DT).includes('start'));
});

test('holding a direction moves the ship and fires it; letting go stops both', () => {
  const state = galaga.create(3);
  const x = state.ship.x;
  const firing = run(state, { right: true }, 1);
  assert.ok(state.ship.x > x, 'holding right moves the ship right');
  assert.ok(firing.filter((one) => one === 'fire').length >= 3, 'holding a direction fires');

  const parked = state.ship.x;
  const idle = run(state, {}, 1);
  assert.equal(state.ship.x, parked, 'letting go stops the ship');
  assert.equal(idle.filter((one) => one === 'fire').length, 0, 'letting go stops the firing');

  const both = run(state, { left: true, right: true }, 1);
  assert.equal(both.filter((one) => one === 'fire').length, 0, 'both at once cancel out');
});

test('the ship stays on the field', () => {
  const state = galaga.create(3);
  run(state, { left: true }, 3);
  assert.ok(state.ship.x >= 0);
  run(state, { right: true }, 5);
  assert.ok(state.ship.x <= galaga.WIDTH);
});

test('every wave is at least as hard as the one before, and some are harder', () => {
  const harder = { rows: 1, cols: 1, sway: 1, divers: 1, diveSpeed: 1, shotSpeed: 1, armoured: 1, diveEvery: -1, fireEvery: -1 };
  for (let n = 1; n < 60; n++) {
    const now = galaga.wave(n);
    const next = galaga.wave(n + 1);
    for (const [key, direction] of Object.entries(harder)) {
      assert.ok((next[key] - now[key]) * direction >= 0, `wave ${n + 1} is easier than wave ${n} on ${key}`);
    }
  }
  const first = galaga.wave(1);
  const tenth = galaga.wave(10);
  assert.ok(tenth.rows * tenth.cols > first.rows * first.cols, 'later waves bring more ships');
  assert.ok(tenth.diveSpeed > first.diveSpeed && tenth.fireEvery < first.fireEvery);
});

test('the game never runs out of waves', () => {
  for (const n of [1, 25, 100, 10000]) {
    const config = galaga.wave(n);
    assert.ok(config.rows > 0 && config.cols > 0, `wave ${n} has nobody in it`);
    assert.ok(Number.isFinite(config.diveSpeed) && config.diveEvery > 0 && config.fireEvery > 0);
  }
});

test('clearing a wave brings the next one', () => {
  const state = galaga.create(9);
  run(state, { right: true }, DT);
  state.enemies = [];
  const events = run(state, {}, 3);           // hands off, so nothing in the new wave is shot
  assert.ok(events.includes('cleared'));
  assert.ok(events.includes('wave'));
  assert.equal(state.wave, 2);
  assert.equal(state.enemies.length, galaga.wave(2).rows * galaga.wave(2).cols);
});

test('a run can continue from the wave it reached, as hard as that wave', () => {
  const state = galaga.create(5, { wave: 3, score: 1200 });
  assert.equal(state.wave, 3, 'it does not go back to wave one');
  assert.equal(state.score, 1200, 'the score carries over');
  assert.equal(state.lives, 3, 'with three fresh ships');
  assert.deepEqual(state.config, galaga.wave(3), 'at wave three\'s difficulty');
  assert.equal(state.enemies.length, galaga.wave(3).rows * galaga.wave(3).cols);

  // And it keeps getting harder from there.
  run(state, { right: true }, DT);
  state.enemies = [];
  run(state, {}, 3);
  assert.equal(state.wave, 4);
  assert.ok(state.config.diveSpeed > galaga.wave(3).diveSpeed);
});

test('a bad saved wave falls back to wave one rather than breaking', () => {
  for (const wave of [0, -4, NaN, undefined, 'x']) {
    const state = galaga.create(5, { wave });
    assert.equal(state.wave, 1, String(wave));
    assert.ok(state.enemies.length > 0);
  }
});

test('a shot that reaches a ship destroys it and scores', () => {
  const state = galaga.create(9);
  run(state, { right: true }, DT);
  state.enemies = [{ id: 'x', row: 1, kind: 1, hp: 1, slotX: 50, slotY: 40, x: 50, y: 40, mode: 'form', wait: 0, phase: 0, vx: 0, vy: 0 }];
  state.shots = [{ x: 50, y: 42 }];
  const events = galaga.step(state, {}, DT);
  assert.ok(events.includes('kill'));
  assert.ok(state.score > 0);
});

test('being hit costs a ship, and losing the last ends the run', () => {
  const state = galaga.create(9);
  run(state, { right: true }, DT);
  state.lives = 1;
  state.bombs = [{ x: state.ship.x, y: state.ship.y, vx: 0, vy: 0 }];
  const events = galaga.step(state, {}, DT);
  assert.ok(events.includes('hit') && events.includes('over'));
  assert.equal(state.over, true);
  assert.deepEqual(galaga.step(state, { left: true }, DT), [], 'a finished run stays finished');
});

test('a long run with the controls held is deterministic for a seed', () => {
  const play = () => {
    const state = galaga.create(42);
    for (let i = 0; i < 60 * 30; i++) galaga.step(state, { left: Math.floor(i / 90) % 2 === 0, right: Math.floor(i / 90) % 2 === 1 }, DT);
    return [state.score, state.wave, state.lives, state.over];
  };
  assert.deepEqual(play(), play());
});
