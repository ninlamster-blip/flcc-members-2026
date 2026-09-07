// PAGASA's rainfall warning thresholds are the backbone of this app. If these
// numbers drift, every flood reading downstream of them is wrong.

import test from 'node:test';
import assert from 'node:assert/strict';
import { INTENSITY, WARNING_COLOUR, intensityFor, dailyBand, total, peakHour } from '../js/core/rain.js';

test('the three PAGASA warning thresholds are exactly where PAGASA puts them', () => {
  // Yellow 7.5–15 mm/h, orange 15–30, red above 30.
  assert.equal(intensityFor(7.5).id, 'heavy');
  assert.equal(intensityFor(14.9).id, 'heavy');
  assert.equal(intensityFor(15).id, 'intense');
  assert.equal(intensityFor(29.9).id, 'intense');
  assert.equal(intensityFor(30).id, 'torrential');
  assert.equal(intensityFor(120).id, 'torrential');
});

test('the warning colours are attached to the right bands, and only those', () => {
  assert.equal(WARNING_COLOUR.heavy, 'yellow');
  assert.equal(WARNING_COLOUR.intense, 'orange');
  assert.equal(WARNING_COLOUR.torrential, 'red');
  for (const id of ['none', 'light', 'moderate']) {
    assert.equal(WARNING_COLOUR[id], undefined, `${id} must not carry a warning colour`);
  }
});

test('below the warning range the ordinary bands still apply', () => {
  assert.equal(intensityFor(0).id, 'none');
  assert.equal(intensityFor(0.4).id, 'light');
  assert.equal(intensityFor(2.5).id, 'moderate');
  assert.equal(intensityFor(7.4).id, 'moderate');
});

test('the bands only ever climb, with no gap and no overlap', () => {
  let last = -1;
  for (let mm = 0; mm <= 60; mm += 0.1) {
    const rank = intensityFor(mm).rank;
    assert.ok(rank >= last, `rank fell at ${mm.toFixed(1)} mm/h`);
    last = rank;
  }
  assert.deepEqual(INTENSITY.map((b) => b.rank), [0, 1, 2, 3, 4, 5]);
});

test('a missing number is not treated as dry', () => {
  assert.equal(intensityFor(null).id, 'none');
  assert.equal(intensityFor(undefined).id, 'none');
  assert.equal(intensityFor(NaN).id, 'none');
});

test('every band says what to do about it', () => {
  for (const band of INTENSITY) {
    assert.ok(band.label && band.advice, band.id);
  }
  // The three that carry a warning colour name it, so the advice matches what
  // somebody would hear on the radio.
  assert.match(intensityFor(10).advice, /yellow/i);
  assert.match(intensityFor(20).advice, /orange/i);
  assert.match(intensityFor(40).advice, /red/i);
});

test('daily totals read the way people talk about a day', () => {
  assert.equal(dailyBand(0).id, 'dry');
  assert.equal(dailyBand(30).id, 'wet');
  assert.equal(dailyBand(120).id, 'soaking');
  assert.equal(dailyBand(400).id, 'extreme');
});

test('totals skip missing hours rather than counting them as zero rain', () => {
  const hours = [{ precipMm: 5 }, { precipMm: null }, { precipMm: 7.5 }, {}];
  assert.equal(total(hours), 12.5);
});

test('the wettest hour is found, and an empty run has none', () => {
  const hours = [{ precipMm: 2 }, { precipMm: 19 }, { precipMm: 8 }];
  assert.equal(peakHour(hours).precipMm, 19);
  assert.equal(peakHour([]), null);
});
