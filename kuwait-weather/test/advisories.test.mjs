import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../js/core/api.js';
import { derive } from '../js/core/derive.js';
import { advisories, SEVERITY_ORDER } from '../js/core/advisories.js';
import { forecast, air } from './fixtures/forecast.mjs';

const NOON = new Date('2026-07-15T09:00:00Z');   // 12:00 Kuwait, inside the ban
const WINTER = new Date('2026-01-15T09:00:00Z'); // 12:00 Kuwait, out of season

function advise(f, a, now = NOON) {
  const d = derive(api.normalize(f, a, { fetchedAt: now }), { now });
  return advisories(d, { now });
}

const ids = (list) => list.map((x) => x.id);

// A mild January day, so each test can add exactly one problem to it.
const mild = (over = {}) => forecast({
  start: '2026-01-15T00:00',
  hour: () => ({ temperature_2m: 19, relative_humidity_2m: 45, wind_speed_10m: 10, wind_direction_10m: 180, wind_gusts_10m: 14, uv_index: 3, ...over }),
  current: { temperature_2m: 19, relative_humidity_2m: 45, wind_speed_10m: 10, wind_direction_10m: 180, wind_gusts_10m: 14, ...over },
});
// The air-quality endpoint carries the UV index as well as the particulates,
// and it is the one the app prefers — so a January fixture has to set it there.
const cleanAir = (over = {}, uv = 3) => air({
  start: '2026-01-15T00:00',
  hour: () => ({ pm10: 15, pm2_5: 6, dust: 3, ...over }),
  current: { uv_index: uv },
});

test('a mild day with clean air raises nothing', () => {
  assert.deepEqual(advise(mild(), cleanAir(), WINTER), []);
});

test('the worst thing is listed first', () => {
  const list = advise(forecast(), air({ hour: () => ({ pm10: 1200 }) }));
  assert.ok(list.length > 1);
  for (let i = 1; i < list.length; i++) {
    assert.ok(SEVERITY_ORDER[list[i - 1].severity] >= SEVERITY_ORDER[list[i].severity],
      `${list[i - 1].severity} was listed above ${list[i].severity}`);
  }
});

test('the midday ban is raised while it is in force', () => {
  const list = advise(forecast(), air());
  const ban = list.find((a) => a.id === 'work-ban');
  assert.ok(ban);
  assert.equal(ban.severity, 'warning');
  assert.match(ban.detail, /16:00/);
});

test('the ban is flagged in advance, but only shortly in advance', () => {
  const twoHoursBefore = new Date('2026-07-15T06:30:00Z'); // 09:30 Kuwait
  assert.ok(ids(advise(forecast(), air(), twoHoursBefore)).includes('work-ban-soon'));

  const dawn = new Date('2026-07-15T02:00:00Z'); // 05:00 Kuwait
  assert.ok(!ids(advise(forecast(), air(), dawn)).includes('work-ban-soon'));
});

test('out of season the ban is never mentioned', () => {
  const list = ids(advise(mild(), cleanAir(), WINTER));
  assert.ok(!list.includes('work-ban'));
  assert.ok(!list.includes('work-ban-soon'));
});

test('dust now outranks dust later', () => {
  const now = advise(mild(), cleanAir({ pm10: 1400 }), WINTER);
  const dust = now.find((a) => a.id === 'dust-now');
  assert.equal(dust.severity, 'severe');
  assert.match(dust.title, /Dust storm/);
});

test('dust coming later is announced with the hour it starts', () => {
  const later = advise(
    mild(),
    air({ start: '2026-01-15T00:00', hour: (i) => ({ pm10: i >= 18 ? 900 : 12 }) }),
    WINTER,
  );
  const warning = later.find((a) => a.id === 'dust-later');
  assert.ok(warning, 'a dust storm six hours out should be announced');
  assert.match(warning.detail, /\d/, 'and should say when');
});

test('dangerous heat for work is severe, and is driven by WBGT', () => {
  const list = advise(forecast(), air());
  const heat = list.find((a) => a.id === 'heat');
  assert.equal(heat.severity, 'severe');
  assert.match(heat.title, /Dangerous heat/);
});

test('a shamal is named as a shamal', () => {
  const windy = mild({ wind_speed_10m: 45, wind_direction_10m: 320, wind_gusts_10m: 65 });
  const list = advise(windy, cleanAir(), WINTER);
  const shamal = list.find((a) => a.id === 'shamal');
  assert.ok(shamal);
  assert.match(shamal.title, /shamal/i);
  assert.ok(!ids(list).includes('gusts'), 'a shamal already explains the wind');
});

test('a strong wind from the wrong direction is still worth saying', () => {
  const gusty = mild({ wind_speed_10m: 45, wind_direction_10m: 180, wind_gusts_10m: 70 });
  const list = ids(advise(gusty, cleanAir(), WINTER));
  assert.ok(list.includes('gusts'));
  assert.ok(!list.includes('shamal'));
});

test('rain is announced, and heavy rain is announced differently', () => {
  const drizzle = mild({ weather_code: 61, precipitation: 0.15 });
  const light = advise(drizzle, cleanAir(), WINTER).find((a) => a.id === 'rain');
  assert.ok(light);
  assert.equal(light.severity, 'info');

  const downpour = mild({ weather_code: 82, precipitation: 3 });
  const heavy = advise(downpour, cleanAir(), WINTER).find((a) => a.id === 'rain');
  assert.equal(heavy.severity, 'warning');
  assert.match(heavy.detail, /flood/i);
});

test('fog is raised, because the coast road gets it', () => {
  const foggy = mild({ weather_code: 45 });
  assert.ok(ids(advise(foggy, cleanAir(), WINTER)).includes('fog'));
});

test('UV is only mentioned when it is worth acting on, and only in daylight', () => {
  assert.ok(!ids(advise(mild(), cleanAir({}, 4), WINTER)).includes('uv'));
  assert.ok(ids(advise(mild(), cleanAir({}, 9), WINTER)).includes('uv'));

  const night = new Date('2026-01-15T20:00:00Z'); // 23:00 Kuwait
  assert.ok(!ids(advise(mild({ is_day: 0 }), cleanAir({}, 9), night)).includes('uv'),
    'UV at midnight is a number about the model, not about you');
});

test('every advisory carries a title, a detail and a known severity', () => {
  const list = advise(forecast(), air({ hour: () => ({ pm10: 1200 }) }));
  assert.ok(list.length);
  for (const a of list) {
    assert.ok(a.id && a.title && a.detail && a.icon, JSON.stringify(a));
    assert.ok(a.severity in SEVERITY_ORDER, a.severity);
  }
});

test('no advisory is listed twice', () => {
  const list = ids(advise(forecast(), air({ hour: () => ({ pm10: 1200 }) })));
  assert.equal(new Set(list).size, list.length);
});
