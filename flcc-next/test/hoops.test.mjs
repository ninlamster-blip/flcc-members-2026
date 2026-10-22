// Hoops.
//
// The rules are pure functions so the promises the game makes can be checked
// without a thumb: a swipe up throws and a tap does not, a ball has to come
// down through a rim, every level is at least as hard as the last — and every
// level can actually be beaten, which is proved below by a player that tries
// shots on a copy of the game before taking one.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as hoops from '../js/games/hoops.js';

const DT = 1 / 60;

/** Fly the ball until it is settled. */
const settle = (state, dt = DT) => {
  const events = [];
  for (let i = 0; i < 600 && (state.ball.live || state.rest > 0); i++) events.push(...hoops.step(state, dt));
  return events;
};

/**
 * A patient player: tries a fan of swipes on a copy of the game, waiting a
 * little between tries, and takes the first one that scores. Returns the
 * events of the real shot, or null when nothing it tried would go in.
 */
function bestShot(state) {
  for (let wait = 0; wait < 8; wait++) {
    for (let length = 40; length <= 94; length += 3) {
      for (let across = -40; across <= 40; across += 2.5) {
        const copy = structuredClone(state);
        for (let i = 0; i < wait * 6; i++) hoops.step(copy, 1 / 30);
        hoops.shoot(copy, { dx: across, dy: -length });
        if (settle(copy, 1 / 30).some((one) => one === 'basket' || one === 'swish')) {
          for (let i = 0; i < wait * 6; i++) hoops.step(state, 1 / 30);
          return [...hoops.shoot(state, { dx: across, dy: -length }), ...settle(state, 1 / 30)];
        }
      }
    }
  }
  return null;
}

test('a tap or a swipe down does not throw; a swipe up does, and costs a ball', () => {
  const state = hoops.create(3);
  assert.deepEqual(hoops.shoot(state, { dx: 0, dy: -2 }), [], 'a tap');
  assert.deepEqual(hoops.shoot(state, { dx: 0, dy: 30 }), [], 'a swipe down');
  const balls = state.balls;
  const events = hoops.shoot(state, { dx: 0, dy: -60 });
  assert.ok(events.includes('start') && events.includes('throw'));
  assert.equal(state.balls, balls - 1);
  assert.ok(state.ball.vy < 0, 'the ball goes up');
  assert.deepEqual(hoops.shoot(state, { dx: 0, dy: -60 }), [], 'not a second ball while one is flying');
});

test('nothing moves until the first throw', () => {
  const state = hoops.create(3);
  for (let i = 0; i < 120; i++) hoops.step(state, DT);
  assert.equal(state.time, 0);
});

test('a tall phone gets the same throw: the same swipe reaches the same height above the rim', () => {
  const apexAbove = (height) => {
    const state = hoops.create(3, { height });
    Object.assign(state.hoops[0], { center: 10, range: 0 });    // out of the ball's way
    hoops.shoot(state, { dx: 0, dy: -70 });
    let top = state.ball.y;
    for (let i = 0; i < 300 && state.ball.vy < 0; i++) { hoops.step(state, 1 / 240); top = Math.min(top, state.ball.y); }
    return (state.config.hoopY - top) / (state.height - 16 - state.config.hoopY);
  };
  const standard = apexAbove(160);
  for (const height of [220, 320, 400]) assert.ok(Math.abs(apexAbove(height) - standard) < 0.02, `height ${height}`);
  assert.ok(standard > 0, 'a full swipe clears the rim');
});

test('the swipe’s direction is the aim', () => {
  const left = hoops.create(3);
  hoops.shoot(left, { dx: -20, dy: -60 });
  const right = hoops.create(3);
  hoops.shoot(right, { dx: 20, dy: -60 });
  assert.ok(left.ball.vx < 0 && right.ball.vx > 0);
});

test('a ball that comes down through the rim scores; one that goes up through it does not', () => {
  const state = hoops.create(5);
  hoops.shoot(state, { dx: 0, dy: -60 });
  const hoop = state.hoops[0];
  const rail = state.config.hoopY;
  // Falling, just above the rail, in the middle of the opening.
  Object.assign(state.ball, { x: hoop.x, y: rail - 0.3, vx: 0, vy: 40 });
  state.config = { ...state.config, speed: 0 };
  const events = hoops.step(state, DT);
  assert.ok(events.includes('swish'));
  assert.equal(state.made, 1);
  assert.ok(state.score >= 3);

  const rising = hoops.create(5);
  hoops.shoot(rising, { dx: 0, dy: -60 });
  rising.config = { ...rising.config, speed: 0 };
  Object.assign(rising.ball, { x: rising.hoops[0].x, y: rail + 1, vx: 0, vy: -200 });
  assert.ok(!hoops.step(rising, DT).some((one) => one === 'swish' || one === 'basket'));
});

test('every level is at least as hard as the one before, and some are harder', () => {
  const harder = { target: 1, hoops: 1, speed: 1, wind: 1, defender: 1, reach: 1, rim: -1, hoopY: -1 };
  for (let n = 1; n < 60; n++) {
    const now = hoops.level(n);
    const next = hoops.level(n + 1);
    for (const [key, direction] of Object.entries(harder)) {
      assert.ok((next[key] - now[key]) * direction >= 0, `level ${n + 1} is easier than level ${n} on ${key}`);
    }
    assert.ok(now.balls - now.target >= 2, `level ${n} leaves fewer than two spare balls`);
  }
  const first = hoops.level(1);
  const tenth = hoops.level(10);
  assert.equal(first.hoops, 1);
  assert.equal(tenth.hoops, 3);
  assert.equal(first.wind, 0);
  assert.ok(tenth.wind > 0 && tenth.defender > 0, 'wind and a defender by level ten');
  assert.ok(tenth.rim < first.rim && tenth.hoopY < first.hoopY && tenth.speed > first.speed);
});

test('the hoops move', () => {
  const state = hoops.create(7);
  hoops.shoot(state, { dx: 0, dy: -60 });
  const x = state.hoops[0].x;
  for (let i = 0; i < 30; i++) hoops.step(state, DT);
  assert.notEqual(state.hoops[0].x, x);
});

test('making the target clears the level and brings the next; running out ends it', () => {
  const state = hoops.create(9);
  hoops.shoot(state, { dx: 0, dy: -60 });
  state.made = state.config.target - 1;
  state.config = { ...state.config, speed: 0 };
  Object.assign(state.ball, { x: state.hoops[0].x, y: state.config.hoopY - 1, vx: 0, vy: 40 });
  const events = settle(state);
  assert.ok(events.includes('level') && events.includes('next'));
  assert.equal(state.level, 2);
  assert.equal(state.made, 0);
  assert.equal(state.balls, hoops.level(2).balls);

  const out = hoops.create(9);
  out.balls = 1;
  hoops.shoot(out, { dx: 40, dy: -8 });       // a feeble throw well wide
  const end = settle(out);
  assert.ok(end.includes('miss') && end.includes('over'));
  assert.equal(out.over, true);
  assert.deepEqual(hoops.shoot(out, { dx: 0, dy: -60 }), [], 'a finished level stays finished');
});

test('a failed level is retried at that level, with the score it started with', () => {
  const state = hoops.create(5, { level: 6, score: 420 });
  assert.equal(state.level, 6);
  assert.equal(state.score, 420);
  assert.equal(state.levelScore, 420);
  assert.ok(hoops.defender(state), 'level six has a defender');
  for (const bad of [0, -3, NaN, undefined, 'x']) assert.equal(hoops.create(5, { level: bad }).level, 1, String(bad));
});

test('the defender knocks a rising ball back down', () => {
  const state = hoops.create(5, { level: 8 });
  hoops.shoot(state, { dx: 0, dy: -60 });
  const guard = hoops.defender(state);
  Object.assign(state.ball, { x: guard.x, y: guard.y + 3, vx: 0, vy: -200 });
  const events = hoops.step(state, DT);
  assert.ok(events.includes('block'));
  assert.ok(state.ball.vy > 0);
});

test('a level replays exactly from its seed', () => {
  const play = () => {
    const state = hoops.create(42, { level: 7 });
    const seen = [];
    for (let i = 0; i < 6; i++) {
      hoops.shoot(state, { dx: (i % 3 - 1) * 12, dy: -55 - i * 4 });
      settle(state);
      seen.push([state.score, state.made, state.wind, state.gold]);
    }
    return seen;
  };
  assert.deepEqual(play(), play());
});

test('every level can be beaten', () => {
  // Levels 1–20 cover every knob reaching or nearing its ceiling.
  for (let n = 1; n <= 20; n++) {
    // Odd levels on a tall phone's field, even ones on the standard one.
    const state = hoops.create(1000 + n, { level: n, height: n % 2 ? 320 : 160 });
    let guard = 0;
    while (state.level === n && !state.over && guard++ < 40) {
      const shot = bestShot(state);
      assert.ok(shot, `level ${n}: a ball with no way in (made ${state.made}/${state.config.target}, wind ${state.wind})`);
    }
    assert.equal(state.over, false, `level ${n} could not be beaten`);
    assert.equal(state.level, n + 1, `level ${n} did not lead to level ${n + 1}`);
  }
});
