// The flood model is the reason this app exists, and the place where being
// wrong matters most. These tests pin what it does and — as importantly —
// what it refuses to do.

import test from 'node:test';
import assert from 'node:assert/strict';
import { floodRisk, LEVELS } from '../js/core/flood.js';
import { saturation } from '../js/core/saturation.js';

const hours = (mmPerHour, count = 24) =>
  Array.from({ length: count }, (_, i) => ({ precipMm: mmPerHour, at: new Date(2026, 8, 1, i) }));

const dry = saturation({ mm3d: 0, mm7d: 0 });
const soaked = saturation({ mm3d: 320, mm7d: 480 });

test('no rain coming is no flood, whatever the ground has been through', () => {
  const quiet = floodRisk(hours(0), soaked);
  assert.equal(quiet.id, 'none');
  assert.equal(quiet.drivers.length, 0);
});

test('wet ground on its own never raises a flood warning', () => {
  // Saturated soil is not a flood. Without rain to run off it, it is just
  // wet ground, and saying otherwise would cry wolf every week of the habagat.
  const trickle = floodRisk(hours(0.5), soaked);
  assert.ok(trickle.rank <= 1, `${trickle.label} on 0.5 mm/h is crying wolf`);
});

test('a downpour on dry ground is still a flood risk', () => {
  const burst = floodRisk(hours(35, 4).concat(hours(0, 20)), dry);
  assert.ok(burst.rank >= 3, burst.label);
  assert.match(burst.drivers.join(' '), /torrential/i);
});

test('the same rain is worse on ground that is already full', () => {
  // This is the whole point of asking the API for the past week: 9 mm/h for
  // eight hours is only "heavy", but on soaked ground it is a different
  // afternoon entirely. The totals are kept below the level where rainfall
  // alone already tops the scale, or there would be no room to show it.
  const onDry = floodRisk(hours(9, 8).concat(hours(0, 16)), dry);
  const onSoaked = floodRisk(hours(9, 8).concat(hours(0, 16)), soaked);
  assert.ok(onSoaked.rank > onDry.rank,
    `dry ${onDry.label} vs soaked ${onSoaked.label} — saturation must count`);
  assert.match(onSoaked.drivers.join(' '), /soaked/i);
});

test('a long soaking day counts even when no single hour is dramatic', () => {
  // Twelve hours of 9 mm never trips an hourly warning, and still puts 108 mm
  // on the ground.
  const steady = floodRisk(hours(9, 12).concat(hours(0, 12)), dry);
  assert.match(steady.drivers.join(' '), /24 hours/);
  assert.ok(steady.rank >= 2);
});

test('the level always says what drove it', () => {
  const r = floodRisk(hours(20), soaked);
  assert.ok(r.drivers.length >= 2, 'both the rain and the ground should be named');
  for (const driver of r.drivers) assert.ok(driver.length > 5, driver);
});

test('it reports the numbers it reasoned from, not just a verdict', () => {
  const r = floodRisk(hours(12, 6).concat(hours(0, 18)), dry);
  assert.equal(Math.round(r.peakMmPerHour), 12);
  assert.equal(Math.round(r.mm24h), 72);
  assert.ok(r.peakAt instanceof Date);
});

test('missing ground history does not break the reading', () => {
  // The past week can be absent. The model should still work off rainfall
  // alone rather than throwing or silently going quiet.
  const r = floodRisk(hours(35, 5).concat(hours(0, 19)), null);
  assert.ok(r.rank >= 3, r.label);
});

test('nothing forecast at all is handled, not crashed on', () => {
  assert.equal(floodRisk([], null).id, 'none');
  assert.equal(floodRisk([], soaked).id, 'none');
});

test('the scale never runs off its own end', () => {
  const worst = floodRisk(hours(200), soaked);
  assert.equal(worst.rank, LEVELS.length - 1);
  assert.equal(worst.id, 'severe');
});

test('every level has advice somebody could act on', () => {
  for (const l of LEVELS) {
    assert.ok(l.label && l.advice, l.id);
  }
  // The top of the scale has to say the thing that actually saves people.
  assert.match(LEVELS[4].advice, /never drive into moving water|leave low ground/i);
});
