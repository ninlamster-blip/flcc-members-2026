import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../js/core/api.js';
import { derive, upcoming, nextDust, bestOutdoorWindow } from '../js/core/derive.js';
import { forecast, air } from './fixtures/forecast.mjs';

const NOON = new Date('2026-07-15T09:00:00Z'); // 12:00 in Kuwait

const read = (f = forecast(), a = air()) => derive(api.normalize(f, a, { fetchedAt: NOON }), { now: NOON });

test('every hour gains the numbers the forecast does not carry', () => {
  const d = read();
  for (const h of d.hours) {
    assert.ok(Number.isFinite(h.heatIndexC), 'heat index');
    assert.ok(Number.isFinite(h.wbgt), 'WBGT');
    assert.ok(h.work && h.work.id, 'work/rest band');
    assert.ok(h.dust && h.dust.id, 'dust level');
    assert.ok(h.at instanceof Date, 'a real timestamp');
  }
});

test('the raw mineral-dust reading survives being turned into a dust level', () => {
  const d = read(forecast(), air({ hour: () => ({ dust: 275 }) }));
  assert.equal(d.hours[0].dustUgm3, 275, 'the µg/m³ figure the details card shows');
  assert.equal(typeof d.hours[0].dust, 'object', 'and `dust` is now the level');
});

test('hours inside the midday ban are marked as such', () => {
  const d = read();
  const banned = d.hours.filter((h) => h.banned);
  assert.ok(banned.length > 0);
  for (const h of banned) {
    const hour = Number(h.time.slice(11, 13));
    assert.ok(hour >= 11 && hour < 16, `${h.time} is marked banned but is outside 11–16`);
  }
});

test('a day takes its heat from its own hours, not from a daily average', () => {
  const d = read();
  const today = d.days[0];
  const own = d.hours.filter((h) => h.time.startsWith(today.date));
  const hottest = Math.max(...own.map((h) => h.wbgt));
  assert.equal(today.peakWbgt, hottest);
  assert.ok(today.peakWork);
  assert.ok(today.peakHeat);
});

test('a day reports the worst dust any of its hours reaches', () => {
  const d = read(forecast(), air({ hour: (i) => ({ pm10: i === 5 ? 1500 : 20 }) }));
  assert.equal(d.days[0].dust.id, 'storm', 'one bad hour makes the day a dust day');
});

test('the day after tomorrow keeps its own hours out of today', () => {
  const d = read(forecast(), air({ hour: (i) => ({ pm10: i > 30 ? 1500 : 20 }) }));
  assert.equal(d.days[0].dust.id, 'clear');
  assert.equal(d.days[1].dust.id, 'storm');
});

test('the hourly strip starts at the current hour, not at midnight', () => {
  const d = read();
  const strip = upcoming(d.hours, 24, NOON);
  assert.equal(strip.length, 24);
  assert.equal(strip[0].time, '2026-07-15T12:00');
});

test('the strip runs out gracefully at the end of the forecast', () => {
  const d = read();
  const late = new Date('2026-07-16T20:00:00Z');
  const strip = upcoming(d.hours, 24, late);
  assert.ok(strip.length < 24 && strip.length > 0);
});

test('the next dust hour is in the future, and is the first bad one', () => {
  const d = read(forecast(), air({ hour: (i) => ({ pm10: i >= 20 ? 900 : 20 }) }));
  const next = nextDust(d.hours, 3, NOON);
  assert.ok(next);
  assert.equal(next.time, '2026-07-15T20:00');
  assert.ok(next.at > NOON);
});

test('no dust ahead means no warning invented', () => {
  const d = read(forecast(), air({ hour: () => ({ pm10: 15, dust: 5 }) }));
  assert.equal(nextDust(d.hours, 3, NOON), null);
});

test('the best window avoids the ban and the worst of the heat', () => {
  const d = read();
  const window = bestOutdoorWindow(d.hours, { now: NOON });
  assert.ok(window, 'a July night still offers a window');
  const banned = d.hours.filter((h) => h.banned && h.at >= window.from && h.at < window.to);
  assert.equal(banned.length, 0, 'the window must not overlap the ban');
});

test('a day with no safe hour at all returns nothing rather than a bad suggestion', () => {
  const relentless = forecast({ hour: () => ({ temperature_2m: 47, relative_humidity_2m: 45 }) });
  const d = read(relentless);
  assert.equal(bestOutdoorWindow(d.hours, { now: NOON }), null);
});

test('the work profile chosen changes the guidance, in both directions', () => {
  const reading = api.normalize(forecast(), air(), { fetchedAt: NOON });
  const light = derive(reading, { profile: 'light', now: NOON });
  const heavy = derive(reading, { profile: 'heavy', now: NOON });
  assert.equal(light.profile, 'light');
  assert.ok(light.now.work.work >= heavy.now.work.work,
    'heavy work can never be allowed more minutes than light work');
});

test('deriving does not mutate the reading it was given', () => {
  const reading = api.normalize(forecast(), air(), { fetchedAt: NOON });
  const before = JSON.stringify(reading);
  derive(reading, { now: NOON });
  assert.equal(JSON.stringify(reading), before);
});

test('a reading with no air quality still derives, minus the dust', () => {
  const d = read(forecast(), null);
  assert.equal(d.now.dust.signals.join(), 'visibility', 'visibility alone still gives a level');
  assert.equal(d.now.dustUgm3, null);
  assert.ok(d.now.work, 'the heat guidance is untouched');
});

test('the best window stays out of the dust as well as the heat', () => {
  // A cool evening is not a good time to be outside if the reason it cooled
  // off is the shamal arriving with it.
  const cool = forecast({ hour: (i) => ({ temperature_2m: i >= 14 ? 24 : 44, relative_humidity_2m: 20 }) });
  const dusty = air({ hour: (i) => ({ pm10: i >= 14 ? 900 : 20 }) });

  const withDust = derive(api.normalize(cool, dusty, { fetchedAt: NOON }), { now: NOON });
  const withoutDust = derive(api.normalize(cool, air({ hour: () => ({ pm10: 20 }) }), { fetchedAt: NOON }), { now: NOON });

  const clean = bestOutdoorWindow(withoutDust.hours, { now: NOON });
  const dirty = bestOutdoorWindow(withDust.hours, { now: NOON });
  assert.ok(clean, 'the cool evening is a window when the air is clean');
  assert.ok(!dirty || dirty.hours < clean.hours, 'and is not one, or is a shorter one, when it is not');
});
