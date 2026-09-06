import test from 'node:test';
import assert from 'node:assert/strict';
import * as dust from '../js/core/dust.js';

test('the levels run clear to storm with no gap', () => {
  assert.deepEqual(dust.LEVELS.map((l) => l.rank), [0, 1, 2, 3, 4]);
  for (const l of dust.LEVELS) {
    assert.ok(l.label && l.short && l.advice, `${l.id} is missing text`);
  }
});

test('PM10 maps onto the levels the way the guidelines draw them', () => {
  assert.equal(dust.rankFromPm10(20), 0);   // ordinary air
  assert.equal(dust.rankFromPm10(100), 1);  // above the WHO daily guideline
  assert.equal(dust.rankFromPm10(250), 2);
  assert.equal(dust.rankFromPm10(500), 3);
  assert.equal(dust.rankFromPm10(1500), 4); // a shamal
});

test('visibility maps onto the WMO thresholds', () => {
  assert.equal(dust.rankFromVisibility(24000), 0);
  assert.equal(dust.rankFromVisibility(8000), 1);
  assert.equal(dust.rankFromVisibility(3000), 2);
  assert.equal(dust.rankFromVisibility(1500), 3);
  assert.equal(dust.rankFromVisibility(600), 4);  // dust storm, by definition
});

test('the worse of the two signals wins', () => {
  // Clean-looking particulates but you cannot see: still a dust storm.
  const blind = dust.dustLevel({ pm10: 30, visibility: 500 });
  assert.equal(blind.id, 'storm');
  // Clear air by sight, heavy particulates: still heavy.
  const loaded = dust.dustLevel({ pm10: 900, visibility: 20000 });
  assert.equal(loaded.id, 'storm');
});

test('mineral dust counts as particulate when it is the higher reading', () => {
  const level = dust.dustLevel({ pm10: 100, dust: 400, visibility: 20000 });
  assert.equal(level.id, 'heavy');
  assert.equal(level.pm10, 400, 'the higher particulate reading is the one reported');
});

test('either signal alone is enough, and neither means null', () => {
  assert.equal(dust.dustLevel({ pm10: 200 }).id, 'dusty');
  assert.deepEqual(dust.dustLevel({ pm10: 200 }).signals, ['particulate']);
  assert.equal(dust.dustLevel({ visibility: 3000 }).id, 'dusty');
  assert.deepEqual(dust.dustLevel({ visibility: 3000 }).signals, ['visibility']);
  assert.equal(dust.dustLevel({}), null);
  assert.equal(dust.dustLevel(), null);
});

test('nulls and nonsense are ignored rather than treated as zero', () => {
  assert.equal(dust.rankFromPm10(null), null);
  assert.equal(dust.rankFromPm10(undefined), null);
  assert.equal(dust.rankFromPm10(NaN), null);
  assert.equal(dust.rankFromVisibility(null), null);
  // A missing visibility must not read as "you cannot see anything".
  assert.equal(dust.dustLevel({ pm10: 20, visibility: null }).id, 'clear');
});
