// The layers above the hazard models: places, times, the API shape, deriving,
// advisories, and the screens.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as places from '../js/core/places.js';
import * as fmt from '../js/core/format.js';
import * as api from '../js/core/api.js';
import * as store from '../js/core/storage.js';
import { derive, upcoming, nextRain, wettestWindow } from '../js/core/derive.js';
import { advisories, SEVERITY_ORDER } from '../js/core/advisories.js';
import { toneFor } from '../js/ui/tone.js';
import * as view from '../js/ui/render.js';
import { forecast, air, NOW } from './fixtures/forecast.mjs';

const read = (f = forecast(), a = air()) =>
  derive(api.normalize(f, a, { place: { id: 'marikina', name: 'Marikina', region: 'Metro Manila' }, fetchedAt: NOW }), { now: NOW });

// ── places ──────────────────────────────────────────────────────────────────

test('every place is real, unique and inside the country', () => {
  const ids = places.PLACES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length, 'duplicate id');
  for (const p of places.PLACES) {
    assert.ok(places.REGIONS.includes(p.region), `${p.name} is in "${p.region}"`);
    assert.ok(places.inPhilippines(p.lat, p.lon), `${p.name} falls outside the bounds`);
  }
  assert.equal(places.byRegion().flatMap((g) => g.places).length, places.PLACES.length);
});

test('the places that flood and slide are actually in the list', () => {
  // The list exists to serve these; losing one silently would be a real loss.
  for (const id of ['marikina', 'malabon', 'calumpit', 'cdo', 'butuan', 'cotabato', 'baguio', 'la-trinidad']) {
    assert.ok(places.place(id), `${id} is missing`);
  }
});

test('somewhere else in the world is recognised as somewhere else', () => {
  assert.ok(places.inPhilippines(14.5995, 120.9842), 'Manila');
  assert.ok(!places.inPhilippines(29.3759, 47.9774), 'Kuwait City');
  assert.ok(!places.inPhilippines(1.3521, 103.8198), 'Singapore');
  assert.equal(places.nearest(14.6507, 121.1029).place.id, 'marikina');
});

// ── time ────────────────────────────────────────────────────────────────────

test('everything is read and written on the Manila clock', () => {
  // 23:00 UTC is already the next morning in Manila.
  assert.deepEqual(fmt.manilaParts(new Date('2026-09-01T23:30:00Z')),
    { year: 2026, month: 9, day: 2, hour: 7, minute: 30 });
  const d = fmt.parseLocal('2026-09-01T14:00');
  assert.equal(d.toISOString(), '2026-09-01T06:00:00.000Z');
  assert.equal(fmt.clock(d), '14:00');
  assert.equal(fmt.longDate(d), 'Tuesday 1 September');
});

test('rain is formatted the way a person reads it', () => {
  assert.equal(fmt.mm(0.4), '0.4 mm');
  assert.equal(fmt.mm(23.6), '24 mm');
  assert.equal(fmt.mm(12, { perHour: true }), '12 mm/h');
  assert.equal(fmt.mm(null), '—');
});

// ── the request ─────────────────────────────────────────────────────────────

test('the request asks for the past week, which is what the flood model needs', () => {
  const p = new URL(api.forecastUrl({ lat: 14.65, lon: 121.1 })).searchParams;
  assert.equal(p.get('past_days'), '7');
  assert.equal(p.get('timezone'), 'Asia/Manila');
  assert.ok(p.get('hourly').includes('precipitation'));
});

test('no credential is ever sent, and the coordinate is rounded', () => {
  for (const url of [api.forecastUrl({ lat: 14.6507123, lon: 121.1029456 }), api.airUrl({ lat: 14.65, lon: 121.1 })]) {
    const p = new URL(url).searchParams;
    for (const [key] of p) assert.ok(!/key|token|secret/i.test(key), key);
  }
  assert.equal(new URL(api.forecastUrl({ lat: 14.6507123, lon: 121.1029456 })).searchParams.get('latitude'), '14.6507');
});

test('a normalized reading carries history as well as forecast', () => {
  const r = api.normalize(forecast(), air(), { fetchedAt: NOW });
  assert.equal(r.hours.length, 336);
  assert.ok(r.hasHistory, 'the past week has to survive normalization');
  assert.ok(r.hasAirQuality);
});

test('losing air quality costs the air card and nothing else', () => {
  const r = api.normalize(forecast(), null);
  assert.equal(r.hasAirQuality, false);
  assert.equal(r.now.usAqi, null);
  assert.ok(Number.isFinite(r.now.tempC), 'the weather survives');
});

// ── deriving ────────────────────────────────────────────────────────────────

test('the flood reading reaches the derived object', () => {
  const d = read();
  assert.ok(d.flood && d.flood.id);
  assert.ok(d.ground && d.ground.id);
  assert.ok(d.landslide && d.landslide.id);
});

test('a downpour ahead is found, and the past is not mistaken for it', () => {
  const wet = read(forecast({ hour: (i) => (i >= 172 && i < 180 ? { precipitation: 18 } : {}) }));
  assert.equal(wet.ground.id, 'dry', 'rain in the forecast must not count as history');
  assert.ok(wet.flood.rank >= 3, wet.flood.label);
  const next = nextRain(wet.hours, 3, NOW);
  assert.ok(next && next.at > NOW);
});

test('the wettest window is a real stretch of the forecast', () => {
  const wet = read(forecast({ hour: (i) => (i >= 172 && i < 180 ? { precipitation: 18 } : {}) }));
  const w = wettestWindow(wet.hours, NOW);
  assert.ok(w && w.hours === 8);
  assert.equal(Math.round(w.mm), 144);
});

test('a forecast that has entirely run out gives nothing, not its own start', () => {
  const d = read();
  assert.deepEqual(upcoming(d.hours, 24, new Date('2026-09-10T00:00:00Z')), []);
});

test('deriving does not mutate the reading it was given', () => {
  const r = api.normalize(forecast(), air(), { fetchedAt: NOW });
  const before = JSON.stringify(r);
  derive(r, { now: NOW });
  assert.equal(JSON.stringify(r), before);
});

// ── advisories ──────────────────────────────────────────────────────────────

const ids = (list) => list.map((a) => a.id);

test('a quiet day raises nothing', () => {
  const quiet = read(forecast({ hour: () => ({ temperature_2m: 28, relative_humidity_2m: 62, wind_speed_10m: 8 }) }),
    air({ hour: () => ({ us_aqi: 30, pm2_5: 6, ozone: 40, nitrogen_dioxide: 8 }), current: { us_aqi: 30, pm2_5: 6, ozone: 40, nitrogen_dioxide: 8 } }));
  assert.deepEqual(ids(advisories(quiet, { now: NOW })), []);
});

test('flooding is listed, and listed first', () => {
  const wet = read(forecast({ hour: (i) => (i >= 169 ? { precipitation: 32, weather_code: 82 } : {}) }));
  const list = advisories(wet, { now: NOW });
  assert.equal(list[0].id, 'flood', `got ${list[0].id}`);
  assert.equal(list[0].severity, 'severe');
});

test('the list is sorted worst first', () => {
  const wet = read(forecast({ hour: (i) => (i >= 169 ? { precipitation: 32 } : {}) }));
  const list = advisories(wet, { now: NOW });
  for (let i = 1; i < list.length; i++) {
    assert.ok(SEVERITY_ORDER[list[i - 1].severity] >= SEVERITY_ORDER[list[i].severity]);
  }
});

test('the page tint follows the worst hazard', () => {
  const wet = read(forecast({ hour: (i) => (i >= 169 ? { precipitation: 32 } : {}) }));
  assert.equal(toneFor(advisories(wet, { now: NOW })), 'severe');
});

// ── the screens ─────────────────────────────────────────────────────────────

const tagsBalance = (html) => {
  const stripped = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  return {
    open: (stripped.match(/<[a-z]/g) || []).length,
    close: (stripped.match(/<\/[a-z]/g) || []).length,
  };
};

test('the flood card states its limits on screen, not just in the docs', () => {
  const html = view.floodCard(read());
  assert.match(html, /not a flood forecast/i);
  assert.match(html, /PAGASA/);
  assert.match(html, /drainage|river level|dam/i);
});

test('the landslide card refuses to pretend it knows the slope', () => {
  const html = view.landslideCard(read());
  assert.match(html, /PHIVOLCS/);
  assert.match(html, /slope/i);
});

test('the air card says what it cannot tell you about pollen', () => {
  assert.match(view.airCard(read()), /not published for the Philippines/i);
});

test('every section closes the tags it opens', () => {
  const d = read();
  for (const [name, html] of Object.entries({
    reading: view.reading(d, 'C'),
    flood: view.floodCard(d),
    landslide: view.landslideCard(d),
    humidity: view.humidityCard(d, 'C'),
    air: view.airCard(d),
    rain: view.rainChart(d, NOW),
    hours: view.hourStrip(d, 'C', NOW),
    days: view.dayList(d, 'C'),
    details: view.detailGrid(d, 'C'),
    advisories: view.advisoryList(advisories(d, { now: NOW })),
  })) {
    const { open, close } = tagsBalance(html);
    assert.equal(open, close, `${name}: ${open} opened, ${close} closed`);
  }
});

test('nothing renders "undefined" or "NaN" at a reader', () => {
  const sparse = forecast({ hour: () => ({ visibility: null, uv_index: null, precipitation: null }) });
  sparse.current.pressure_msl = null;
  const d = read(sparse, null);
  const all = [
    view.reading(d, 'C'), view.floodCard(d), view.landslideCard(d), view.humidityCard(d, 'C'),
    view.airCard(d), view.rainChart(d, NOW), view.hourStrip(d, 'C', NOW), view.dayList(d, 'C'),
    view.detailGrid(d, 'C'), view.sheetNote(d, 'calm'),
  ].join('');
  assert.ok(!/undefined|NaN|\[object/.test(all), all.match(/.{0,50}(undefined|NaN|\[object).{0,50}/)?.[0]);
});

test('a place name from a device is escaped, not injected', () => {
  assert.ok(!view.placeOptions('<img src=x onerror=alert(1)>').includes('<img'));
});

test('storage refuses every key that is not this app\'s', () => {
  for (const key of ['kw/v1/place', 'flcc-attendance-2026', 'shepherd/v1/x', 'ph/v2/place', '']) {
    assert.throws(() => store.guard(key), /must start with/, key);
  }
  for (const [name, key] of Object.entries(store.KEYS)) {
    assert.ok(key.startsWith('ph/v1/'), `${name} → ${key}`);
  }
});
