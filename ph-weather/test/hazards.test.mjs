// Saturation, landslide, heat, monsoon and air.

import test from 'node:test';
import assert from 'node:assert/strict';
import { saturation, antecedent, LEVELS as SAT } from '../js/core/saturation.js';
import { landslideRisk } from '../js/core/landslide.js';
import { heatIndexC, heatBand, dewPointC, comfort, humidityPenaltyC, HEAT_BANDS } from '../js/core/heat.js';
import { monsoon, monsoonSeason, compass, beaufort } from '../js/core/monsoon.js';
import { aqiBand, dampness, irritants, POLLEN_NOTE } from '../js/core/air.js';

// ── saturation ──────────────────────────────────────────────────────────────

test('three-day rainfall sets the level', () => {
  assert.equal(saturation({ mm3d: 0 }).id, 'dry');
  assert.equal(saturation({ mm3d: 40 }).id, 'damp');
  assert.equal(saturation({ mm3d: 90 }).id, 'wet');
  assert.equal(saturation({ mm3d: 200 }).id, 'saturated');
  assert.equal(saturation({ mm3d: 400 }).id, 'soaked');
});

test('a long wet week saturates ground no single burst would', () => {
  const burstless = saturation({ mm3d: 60, mm7d: 400 });
  assert.equal(burstless.id, 'wet', 'the weekly total lifts it one level');
  assert.match(burstless.reason, /past week/);
});

test('no history means no guess', () => {
  assert.equal(saturation({ mm3d: null }), null);
  assert.equal(saturation({}), null);
});

test('antecedent rain counts the past only, never the forecast', () => {
  const now = new Date('2026-09-01T00:00:00Z');
  const hours = [
    { at: new Date('2026-08-30T00:00:00Z'), precipMm: 10 },
    { at: new Date('2026-08-31T00:00:00Z'), precipMm: 15 },
    { at: new Date('2026-09-01T06:00:00Z'), precipMm: 99 }, // ahead — must not count
  ];
  assert.equal(antecedent(hours, { now, days: 3 }), 25);
});

// ── landslide ───────────────────────────────────────────────────────────────

const ahead = (mm) => Array.from({ length: 24 }, () => ({ precipMm: mm }));

test('dry ground with no rain indicates nothing', () => {
  assert.equal(landslideRisk(saturation({ mm3d: 5 }), ahead(0)).rank, 0);
});

test('saturated ground plus heavy rain is the dangerous combination', () => {
  const r = landslideRisk(saturation({ mm3d: 200 }), ahead(12));
  assert.equal(r.id, 'high');
  assert.match(r.advice, /leave early|cut slope/i);
});

test('the landslide card never claims to know the slope', () => {
  const r = landslideRisk(saturation({ mm3d: 200 }), ahead(20));
  assert.ok(!/will (slide|collapse)/i.test(r.advice), 'it must not predict a slide');
  assert.match(r.reason, /\w/);
});

test('without a week of history there is nothing to say, and it says nothing', () => {
  assert.equal(landslideRisk(null, ahead(30)), null);
});

// ── heat ────────────────────────────────────────────────────────────────────

test('the heat bands are PAGASA\'s, not the American ones', () => {
  // PAGASA: caution from 27, extreme caution from 33, danger from 42,
  // extreme danger from 52.
  assert.equal(heatBand(26).id, 'safe');
  assert.equal(heatBand(30).id, 'caution');
  assert.equal(heatBand(38).id, 'extreme-caution');
  assert.equal(heatBand(45).id, 'danger');
  assert.equal(heatBand(55).id, 'extreme-danger');
  assert.equal(HEAT_BANDS.length, 5);
});

test('humidity is what makes Philippine heat dangerous, and the numbers show it', () => {
  // Same air temperature, different humidity: the humid one must be worse.
  const dry = heatIndexC(33, 45);
  const humid = heatIndexC(33, 85);
  assert.ok(humid > dry + 5, `33 °C at 85 % (${humid}) should far exceed 45 % (${dry})`);
  assert.ok(humidityPenaltyC(33, 85) > 10, 'the penalty is the story of a Manila afternoon');
});

test('dew point matches known values and reads as comfort', () => {
  assert.ok(Math.abs(dewPointC(30, 70) - 23.9) < 0.6, dewPointC(30, 70));
  assert.equal(comfort(14).id, 'dry');
  assert.equal(comfort(20).id, 'sticky');
  assert.equal(comfort(26).id, 'oppressive');
  assert.equal(comfort(28).id, 'extreme');
});

// ── monsoon ─────────────────────────────────────────────────────────────────

test('the two monsoons are named by direction and season', () => {
  assert.equal(monsoon({ speedKmh: 25, directionDeg: 225, month: 7 }).id, 'habagat');
  assert.equal(monsoon({ speedKmh: 25, directionDeg: 50, month: 1 }).id, 'amihan');
  assert.equal(monsoonSeason(7), 'habagat');
  assert.equal(monsoonSeason(12), 'amihan');
  assert.equal(monsoonSeason(4), null, 'March to May is neither');
});

test('a monsoon wind out of its season is just a wind', () => {
  assert.equal(monsoon({ speedKmh: 30, directionDeg: 225, month: 1 }), null);
  assert.equal(monsoon({ speedKmh: 30, directionDeg: 50, month: 7 }), null);
});

test('a habagat carrying a lot of rain is called the enhanced kind', () => {
  // The pattern that floods Metro Manila: southwest wind plus a great deal of
  // rain, usually pulled in by a storm the app cannot see.
  const plain = monsoon({ speedKmh: 25, directionDeg: 225, month: 8, rainMm24h: 10 });
  const enhanced = monsoon({ speedKmh: 25, directionDeg: 225, month: 8, rainMm24h: 90 });
  assert.equal(plain.enhanced, false);
  assert.equal(enhanced.enhanced, true);
  assert.match(enhanced.label, /enhanced/i);
  assert.match(enhanced.detail, /north/i, 'it should say where the pull is coming from');
});

test('a light breeze is not a monsoon', () => {
  assert.equal(monsoon({ speedKmh: 8, directionDeg: 225, month: 7 }), null);
});

test('the compass and Beaufort scale behave', () => {
  assert.equal(compass(225), 'SW');
  assert.equal(compass(45), 'NE');
  assert.equal(compass(null), null);
  assert.equal(beaufort(0).force, 0);
  assert.equal(beaufort(300).label, 'Violent storm');
});

// ── air and allergies ───────────────────────────────────────────────────────

test('the US AQI bands are where the US puts them', () => {
  assert.equal(aqiBand(20).id, 'good');
  assert.equal(aqiBand(75).id, 'moderate');
  assert.equal(aqiBand(120).id, 'sensitive');
  assert.equal(aqiBand(180).id, 'unhealthy');
  assert.equal(aqiBand(250).id, 'very-unhealthy');
  assert.equal(aqiBand(400).id, 'hazardous');
  assert.equal(aqiBand(null), null, 'no reading is not "good"');
});

test('the app is honest that it cannot give a pollen count here', () => {
  // The model publishes pollen for Europe only. Drawing a confident zero over
  // the Philippines would be worse than saying nothing.
  assert.match(POLLEN_NOTE, /not published for the Philippines/i);
  assert.match(POLLEN_NOTE, /Europe/i);
});

test('the allergy triggers it can measure are named, worst first', () => {
  const list = irritants({ pm25: 40, ozone: 130, no2: 30, pm10: 20 });
  assert.deepEqual(list.map((i) => i.id), ['ozone', 'pm25', 'no2']);
  assert.ok(!list.some((i) => i.id === 'pm10'), '20 µg/m³ PM10 is under the guideline');
});

test('clean air names no triggers rather than inventing them', () => {
  assert.deepEqual(irritants({ pm25: 5, pm10: 12, ozone: 40, no2: 8 }), []);
  assert.deepEqual(irritants({}), []);
});

test('damp is read from humidity, and cool air is not called mouldy', () => {
  assert.equal(dampness({ humidity: 50, tempC: 30 }).id, 'low');
  assert.equal(dampness({ humidity: 75, tempC: 30 }).id, 'high');
  assert.equal(dampness({ humidity: 90, tempC: 30 }).id, 'very-high');
  assert.equal(dampness({ humidity: 90, tempC: 15 }).id, 'low', 'mould slows right down in cool air');
  assert.equal(dampness({ humidity: null }), null);
});
