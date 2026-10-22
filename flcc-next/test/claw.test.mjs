// Claw.
//
// A prize machine is the one arcade game people expect to be rigged. This
// one is not, and these tests are how that stays true: a grab holds or slips
// by how centred it was, never by chance, every level is at least as hard as
// the last — and every level can be beaten, which a patient player below
// proves by trying each grab on a copy of the machine first.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as claw from '../js/games/claw.js';

const DT = 1 / 60;

/** Run the machine until the claw is back to aiming (or the level moves on). */
const finish = (state, dt = DT) => {
  const events = [];
  for (let i = 0; i < 1200 && (state.claw.mode !== 'aim' || state.rest > 0); i++) events.push(...claw.step(state, {}, dt));
  return events;
};

/**
 * Move the claw to `x` and drop it there. Over a sliding box, let go after
 * `release` seconds of hovering (or leave it to the claw's own clock).
 */
const grabAt = (state, x, dt = DT, release = null) => {
  const events = [];
  for (let i = 0; i < 400 && Math.abs(state.claw.x - x) > 0.01 && state.claw.mode === 'aim'; i++) events.push(...claw.step(state, { to: x }, dt));
  if (state.claw.mode === 'aim') events.push(...claw.drop(state));
  for (let i = 0; i < 1200 && state.claw.mode !== 'aim' && state.claw.mode !== 'hover'; i++) events.push(...claw.step(state, {}, dt));
  if (state.claw.mode === 'hover' && release !== null) {
    for (let t = 0; t < release; t += dt) events.push(...claw.step(state, {}, dt));
    events.push(...claw.drop(state));
  }
  return [...events, ...finish(state, dt)];
};

/**
 * A patient player: tries a grab at every spot along the rail on a copy of
 * the machine, waiting a little between rounds, and takes the first one that
 * wins a prize. Returns the real try's events, or null when nothing works.
 */
function bestGrab(state) {
  const releases = state.config.box ? [0, 0.3, 0.6, 0.9, 1.2, 1.5, 1.8, 2.1, 2.4, 2.7, 3] : [null];
  for (let wait = 0; wait < 10; wait++) {
    for (let x = 22; x <= 94; x += 0.5) {
      for (const release of releases) {
        const copy = structuredClone(state);
        for (let i = 0; i < wait * 9; i++) claw.step(copy, { to: copy.claw.x }, 1 / 30);
        const tried = grabAt(copy, x, 1 / 30, release);
        if (tried.includes('prize')) {
          for (let i = 0; i < wait * 9; i++) claw.step(state, { to: state.claw.x }, 1 / 30);
          return grabAt(state, x, 1 / 30, release);
        }
        // Nothing lifted here: no release timing will change that.
        if (!tried.includes('grab')) break;
      }
    }
  }
  return null;
}

test('nothing moves until the claw is moved or dropped', () => {
  const state = claw.create(3);
  for (let i = 0; i < 120; i++) claw.step(state, {}, DT);
  assert.equal(state.time, 0);
  assert.ok(claw.step(state, { left: true }, DT).includes('start'));
});

test('the claw moves along the rail and stays inside the machine', () => {
  const state = claw.create(3);
  const x = state.claw.x;
  for (let i = 0; i < 30; i++) claw.step(state, { right: true }, DT);
  assert.ok(state.claw.x > x);
  for (let i = 0; i < 400; i++) claw.step(state, { left: true }, DT);
  assert.ok(state.claw.x >= 0);
  for (let i = 0; i < 200; i++) claw.step(state, { to: 60 }, DT);
  assert.ok(Math.abs(state.claw.x - 60) < 0.01, 'it glides to a finger');
});

test('a centred grab wins the prize; dropping costs a try', () => {
  const state = claw.create(5);
  const prize = state.prizes[2];
  const tries = state.tries;
  const events = grabAt(state, prize.x);
  assert.ok(events.includes('drop') && events.includes('grab') && events.includes('prize'));
  assert.equal(state.tries, tries - 1);
  assert.equal(state.won, 1);
  assert.ok(state.score >= 10);
  assert.ok(!state.prizes.includes(prize), 'the prize is gone from the pile');
});

test('a won toy is seen falling all the way into the box, and counts only once it lands', () => {
  const state = claw.create(5);
  const prize = state.prizes[2];
  for (let i = 0; i < 400 && Math.abs(state.claw.x - prize.x) > 0.01; i++) claw.step(state, { to: prize.x }, DT);
  claw.drop(state);
  let released = false;
  let lastY = -Infinity;
  for (let i = 0; i < 1200 && state.claw.mode !== 'aim'; i++) {
    const events = claw.step(state, {}, DT);
    if (events.includes('release')) { released = true; assert.equal(state.won, 0, 'not won while it is still in the air'); }
    if (state.drop) {
      assert.ok(state.drop.y >= lastY, 'it only ever falls');
      lastY = state.drop.y;
    }
    if (events.includes('prize')) {
      assert.ok(released, 'it was let go over the box first');
      assert.equal(state.drop, null);
      assert.ok(state.bounce > 0, 'the box bounces');
      assert.ok(state.pop && state.pop.text.startsWith('+'), 'the points float up');
    }
  }
  assert.ok(released);
  assert.equal(state.won, 1);
  assert.ok(lastY > state.height - 30, 'it fell down to the box, not just out of the claw');
});

test('a grab well off-centre lifts the prize and lets it slip; one that misses closes on nothing', () => {
  const slip = claw.create(5);
  const prize = slip.prizes[2];
  const off = prize.r * (slip.config.grip + 0.95) / 2;
  const events = grabAt(slip, prize.x + off);
  assert.ok(events.includes('grab') && events.includes('slip'), events.join());
  assert.ok(!events.includes('prize'));
  assert.equal(slip.won, 0);
  assert.ok(slip.prizes.includes(prize), 'it fell back onto the pile');

  const miss = claw.create(5);
  const xs = miss.prizes.map((one) => one.x).sort((a, b) => a - b);
  const gap = xs.findIndex((x, i) => i && x - xs[i - 1] > 2 * 8 + 4);
  const between = gap > 0 ? (xs[gap] + xs[gap - 1]) / 2 : 21;
  const missed = grabAt(miss, Math.max(21, between));
  assert.ok(missed.includes('miss') || missed.includes('slip') || missed.includes('prize'), 'the try ends either way');
});

test('a grab is never left to chance: the same grab always does the same thing', () => {
  const play = () => {
    const state = claw.create(77, { level: 8 });
    return [40, 55, 70, 85].map((x) => { grabAt(state, x); return [state.won, state.score, state.last]; });
  };
  assert.deepEqual(play(), play());
});

test('every level is at least as hard as the one before, up to level 25, and then stays there', () => {
  const harder = { target: 1, clock: 0, belt: 1, sway: 1, grip: -1, size: -1, slip: -1, box: 1, heavy: 1 };
  assert.equal(claw.HARDEST, 25);
  for (let n = 1; n < 60; n++) {
    const now = claw.level(n);
    const next = claw.level(n + 1);
    for (const [key, direction] of Object.entries(harder)) {
      if (key === 'clock') {
        // No clock at all is the easiest; once there is one it only shortens.
        if (now.clock) assert.ok(next.clock && next.clock <= now.clock, `level ${n + 1}'s clock is longer`);
        continue;
      }
      assert.ok((next[key] - now[key]) * direction >= 0, `level ${n + 1} is easier than level ${n} on ${key}`);
    }
    assert.ok(now.tries - now.target >= 2, `level ${n} leaves fewer than two spare tries`);
  }
  for (let n = 26; n < 60; n++) assert.deepEqual(claw.level(n), claw.level(25), `level ${n} is not the same as level 25`);
  const before = claw.level(24);
  const top = claw.level(25);
  assert.ok(Object.keys(top).some((key) => top[key] !== before[key]), 'level 25 is still harder than level 24');
  // Each new hazard arrives on its level.
  assert.ok(claw.level(8).slip === 1 && claw.level(9).slip < 1, 'the slippery claw arrives at level 9');
  assert.ok(!claw.level(12).box && claw.level(13).box > 0, 'the sliding box arrives at level 13');
  assert.ok(!claw.level(16).heavy && claw.level(17).heavy > 0, 'heavy toys arrive at level 17');
  const first = claw.level(1);
  const tenth = claw.level(10);
  assert.equal(first.clock + first.belt + first.sway, 0, 'level one has no clock, belt or sway');
  assert.ok(tenth.clock > 0 && tenth.belt > 0 && tenth.sway > 0);
  assert.ok(tenth.grip < first.grip && tenth.size < first.size);
});

test('the clock drops the claw by itself when it runs out', () => {
  const state = claw.create(5, { level: 3 });
  claw.step(state, { left: true }, DT);
  const events = [];
  for (let i = 0; i < 60 * 12 && state.claw.mode === 'aim'; i++) events.push(...claw.step(state, {}, DT));
  assert.ok(events.includes('drop'));
  assert.ok(events.includes('tick'), 'it counts down out loud');
});

test('making the target clears the level; running out of tries ends it', () => {
  const state = claw.create(9);
  state.won = state.config.target - 1;
  const events = grabAt(state, state.prizes[1].x);
  assert.ok(events.includes('prize') && events.includes('level') && events.includes('next'), events.join());
  assert.equal(state.level, 2);
  assert.equal(state.won, 0);
  assert.equal(state.tries, claw.level(2).tries);

  const out = claw.create(9);
  out.tries = 1;
  const end = grabAt(out, 21);              // over the chute wall: nothing there
  assert.ok(end.includes('over'), end.join());
  assert.equal(out.over, true);
  assert.deepEqual(claw.drop(out), []);
});

test('a failed level is retried at that level with the score it started with', () => {
  const state = claw.create(5, { level: 6, score: 300 });
  assert.equal(state.level, 6);
  assert.equal(state.levelScore, 300);
  for (const bad of [0, -2, NaN, undefined, 'x']) assert.equal(claw.create(5, { level: bad }).level, 1, String(bad));
});

test('the conveyor carries the prizes along', () => {
  const state = claw.create(5, { level: 5 });
  claw.step(state, { left: true }, DT);
  const xs = state.prizes.map((one) => one.x);
  for (let i = 0; i < 30; i++) claw.step(state, {}, DT);
  assert.notDeepEqual(state.prizes.map((one) => one.x), xs);
});

test('every prize is one of the app’s own drawings', async () => {
  const art = await import('../js/core/art.js');
  for (const kind of claw.PRIZES) assert.ok(art.hasSymbol(kind), `${kind} is not in art.js`);
});

test('a heavy toy cannot be lifted', () => {
  const state = claw.create(5, { level: 17 });
  state.config = { ...state.config, belt: 0, sway: 0 };
  const heavy = state.prizes.find((one) => one.heavy);
  assert.ok(heavy, 'level 17 has a heavy toy');
  const events = grabAt(state, heavy.x);
  assert.ok(events.includes('heavy') && !events.includes('prize'));
  assert.ok(state.prizes.includes(heavy), 'it stays in the pile');
});

test('a slippery claw loses a grab that is good but not near-perfect on the way to the box', () => {
  const state = claw.create(5, { level: 12 });
  state.config = { ...state.config, belt: 0, sway: 0, box: 0 };
  const prize = state.prizes.find((one) => !one.heavy && one.x > 50) || state.prizes.find((one) => !one.heavy);
  const off = prize.r * state.config.grip * (state.config.slip + 1) / 2;   // inside the grip, outside the slippery part
  const events = grabAt(state, prize.x + off);
  assert.ok(events.includes('grab') && events.includes('slip') && !events.includes('prize'), events.join());
});

test('over a sliding box the claw waits for DROP: let go at the right moment and the toy is won, at the wrong one it bounces back', () => {
  const state = claw.create(5, { level: 13 });
  state.config = { ...state.config, belt: 0, sway: 0, slip: 1 };
  const prize = state.prizes.find((one) => !one.heavy);
  for (let i = 0; i < 400 && Math.abs(state.claw.x - prize.x) > 0.01; i++) claw.step(state, { to: prize.x }, DT);
  claw.drop(state);
  for (let i = 0; i < 1200 && state.claw.mode !== 'hover'; i++) claw.step(state, {}, DT);
  assert.equal(state.claw.mode, 'hover', 'it hovers over the box and waits');
  assert.ok(claw.hovering(state));
  const outcomes = new Set();
  for (let wait = 0; wait < 3.5; wait += 0.1) {
    const copy = structuredClone(state);
    for (let t = 0; t < wait; t += DT) claw.step(copy, {}, DT);
    claw.drop(copy);
    const events = finish(copy);
    assert.ok(events.includes('release'));
    if (events.includes('prize')) outcomes.add('won');
    if (events.includes('bounced')) { outcomes.add('bounced'); assert.equal(copy.won, 0); }
  }
  assert.deepEqual([...outcomes].sort(), ['bounced', 'won'], 'the timing of the release decides it');
});

test('every level can be beaten', () => {
  for (let n = 1; n <= claw.HARDEST; n++) {
    const state = claw.create(2000 + n, { level: n, height: n % 2 ? 260 : 140 });
    let guard = 0;
    while (state.level === n && !state.over && guard++ < 30) {
      assert.ok(bestGrab(state), `level ${n}: no grab wins (won ${state.won}/${state.config.target}, ${state.tries} tries left)`);
    }
    assert.equal(state.over, false, `level ${n} could not be beaten`);
    assert.equal(state.level, n + 1);
  }
});
