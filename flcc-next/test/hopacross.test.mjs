// Hop Across.
//
// The rules are pure functions so this suite can exist. What it holds are the
// promises a player feels rather than sees: the first hop always works, a quick
// second tap is never lost, the river, the road and the railway each end a run,
// and the game only ever gets harder.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as hop from '../js/games/hopacross.js';
import * as chiptune from '../js/games/chiptune.js';

const DT = 1 / 60;
const run = (state, seconds) => {
  const events = [];
  for (let t = 0; t < seconds; t += DT) events.push(...hop.step(state, DT));
  return events;
};
/** Rows 0–4 are grass; make the one ahead clear so a test can hop onto it. */
const clearAhead = (state, r = 1) => state.rows[r].trees.clear();

test('a run starts on grass, on row 0, with nothing to fear', () => {
  for (const seed of [1, 2, 3, 99, 12345]) {
    const state = hop.create(seed);
    for (let r = -5; r < 5; r++) assert.equal(state.rows[r].type, 'grass', `seed ${seed}: row ${r}`);
    assert.equal(state.rows[1].trees.has(4), false, 'the lane straight ahead of the start is never blocked');
    assert.equal(state.score, 0);
    const events = run(state, 10);
    assert.equal(state.over, false, `seed ${seed}: standing still at the start must be safe`);
    assert.ok(!events.includes('over'));
  }
});

test('the first hop forward always works, and scores', () => {
  for (const seed of [1, 7, 42]) {
    const state = hop.create(seed);
    const events = hop.move(state, 0, 1);
    assert.deepEqual(events, ['start', 'hop']);
    run(state, 0.3);
    assert.equal(state.player.row, 1);
    assert.equal(state.score, 1);
  }
});

test('a press during a hop is kept and played when it lands', () => {
  const state = hop.create(5);
  clearAhead(state, 1);
  clearAhead(state, 2);
  hop.move(state, 0, 1);
  assert.deepEqual(hop.move(state, 0, 1), [], 'mid-hop, the second press waits');
  run(state, 0.5);
  assert.equal(state.player.row, 2, 'and then it happens');
});

test('trees and the edges of the field refuse a hop', () => {
  const state = hop.create(5);
  state.rows[1].trees.clear();
  state.rows[1].trees.add(4);
  assert.deepEqual(hop.move(state, 0, 1), ['start'], 'a tree ahead');
  state.player.x = 0;
  assert.deepEqual(hop.move(state, -1, 0), [], 'the left edge');
  state.player.x = hop.COLS - 1;
  assert.deepEqual(hop.move(state, 1, 0), [], 'the right edge');
  state.player.x = 4;
  assert.deepEqual(hop.move(state, 0, -1), [], 'behind the start');
});

test('stepping back to wait costs nothing, but only so far back', () => {
  const state = hop.create(5);
  state.score = 20;
  state.player.row = state.player.y = 18;
  for (let r = 13; r <= 18; r++) { state.rows[r].type = 'grass'; state.rows[r].trees.clear(); }
  assert.ok(hop.move(state, 0, -1).includes('hop'));
  run(state, 0.3);
  assert.equal(state.score, 20, 'the score is the furthest row, not the current one');
  state.player.row = state.player.y = 14;
  assert.ok(!hop.move(state, 0, -1).includes('hop'), 'too far behind the best row');
});

/** Put the chicken on row 1, and make row 2 whatever the test needs. */
const lane = (type, extra = {}) => {
  const state = hop.create(11);
  state.rows[2] = { r: 2, L: 1, type, objs: [], trees: new Set(), coin: null, seed: 0, dir: 1, speed: 0, ...extra };
  state.rows[1].trees.clear();
  state.player.row = state.player.y = 1;
  state.score = 1;
  state.started = true;
  return state;
};

test('landing in water ends the run; landing on a log rides it', () => {
  const wet = lane('river');
  hop.move(wet, 0, 1);
  const events = run(wet, 0.3);
  assert.ok(events.includes('water'));
  run(wet, 1.2);
  assert.equal(wet.over, true);

  const dry = lane('river', { objs: [{ x: 3, len: 3, tone: 0 }], speed: 1 });
  hop.move(dry, 0, 1);
  run(dry, 0.2);
  assert.equal(dry.dying, 0, 'a log holds the chicken up');
  const x = dry.player.x;
  run(dry, 0.5);
  assert.ok(dry.player.x > x, 'and carries it along');
});

test('a log carrying the chicken off the field ends the run', () => {
  const state = lane('river', { objs: [{ x: -2, len: hop.COLS + 6, tone: 0 }], speed: 3 });
  hop.move(state, 0, 1);
  const events = run(state, 4);
  assert.ok(events.includes('water'));
});

test('a car in the chicken’s lane ends the run', () => {
  const state = lane('road', { objs: [{ x: 4, len: 1, tone: 0 }] });
  hop.move(state, 0, 1);
  const events = run(state, 0.3);
  assert.ok(events.includes('car'));
  assert.equal(state.player.squashed, true);
  assert.deepEqual(hop.move(state, 0, 1), [], 'a lost chicken does not hop');
});

test('a train ends the run, and rings its bell first', () => {
  const state = lane('rail', { train: { x: -30, len: 12, active: false }, timer: 1.3, warning: false, speed: 20 });
  const events = run(state, 0.2);
  assert.ok(events.includes('bell'), 'the warning comes before the train');
  hop.move(state, 0, 1);
  run(state, 0.2);
  state.rows[2].train = { x: 3, len: 12, active: true };
  state.rows[2].speed = 0;
  assert.ok(run(state, DT * 2).includes('train'));
});

test('the mist takes a chicken that stands still from level 3', () => {
  const state = hop.create(3);
  state.level = 3;
  state.score = 60;
  state.started = true;
  const events = run(state, 3);
  assert.ok(events.includes('mist'));
  assert.ok(events.includes('over'));
  assert.equal(state.cause, 'mist');
});

test('a coin is picked up by landing on it', () => {
  const state = hop.create(4);
  clearAhead(state, 1);
  state.rows[1].coin = 4;
  hop.move(state, 0, 1);
  assert.ok(run(state, 0.3).includes('coin'));
  assert.equal(state.coins, 1);
  assert.equal(state.rows[1].coin, null);
});

test('every level is at least as hard as the one before, and some are harder', () => {
  const harder = { grass: -1, river: 1, rail: 1, carSpeed: 1, trucks: 1, carGap: -1, riverSpeed: 1, logGap: 1, trainSpeed: 1, mist: 1 };
  for (let n = 1; n < 60; n++) {
    const now = hop.level(n);
    const next = hop.level(n + 1);
    for (const [key, direction] of Object.entries(harder)) {
      assert.ok((next[key] - now[key]) * direction >= 0, `level ${n + 1} is easier than level ${n} on ${key}`);
    }
  }
  assert.ok(hop.level(8).carSpeed > hop.level(1).carSpeed);
  assert.equal(hop.level(1).rail, 0, 'no trains on level 1');
  assert.equal(hop.level(2).mist, 0, 'no mist before level 3');
  for (const n of [100, 10000]) {
    const config = hop.level(n);
    assert.ok(config.grass > 0 && Number.isFinite(config.trainSpeed), `level ${n} still has somewhere to stand`);
  }
});

test('the field keeps being built ahead of the chicken, and forgotten behind it', () => {
  const state = hop.create(8);
  state.score = 500;
  state.player.y = 500;
  state.cam = 500;
  hop.step(state, DT);
  assert.ok(state.rows[520], 'rows ahead exist');
  assert.equal(state.rows[0], undefined, 'rows far behind are gone');
});

test('a run is deterministic for a seed', () => {
  const play = () => {
    const state = hop.create(42);
    const seen = [];
    for (let i = 0; i < 60 * 20; i++) {
      if (i % 20 === 0) hop.move(state, 0, 1);
      seen.push(...hop.step(state, DT));
    }
    return [state.score, state.coins, state.cause, seen.join(',')];
  };
  assert.deepEqual(play(), play());
});

test('its sounds follow the chiptune rules, and hopping is the quietest', () => {
  const loudest = (recipe) => Math.max(...recipe.map((part) => part.gain));
  for (const [name, recipe] of Object.entries(hop.SOUNDS)) {
    assert.ok(chiptune.length(recipe) <= 1, `${name} lasts too long`);
    for (const part of recipe) {
      assert.ok(part.gain > 0 && part.gain <= 0.25, `${name}: gain ${part.gain}`);
      if (!part.noise) assert.ok(part.from > 0 && part.to > 0, `${name}: frequency`);
    }
    if (name !== 'hop') assert.ok(loudest(recipe) > loudest(hop.SOUNDS.hop), `${name} is no louder than a hop`);
  }
  for (const cause of Object.keys(hop.CAUSES)) assert.ok(hop.SOUNDS[cause], `no sound for "${cause}"`);
  assert.deepEqual(chiptune.cue(['hop', 'hop', 'coin'], hop.SOUNDS), ['hop', 'coin']);
});
