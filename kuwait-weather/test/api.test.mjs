import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../js/core/api.js';
import { forecast, air } from './fixtures/forecast.mjs';

const params = (url) => new URL(url).searchParams;

test('both endpoints are the keyless public ones, and no secret is sent', () => {
  const f = api.forecastUrl({ lat: 29.3759, lon: 47.9774 });
  const a = api.airUrl({ lat: 29.3759, lon: 47.9774 });
  assert.ok(f.startsWith('https://api.open-meteo.com/'));
  assert.ok(a.startsWith('https://air-quality-api.open-meteo.com/'));
  for (const url of [f, a]) {
    for (const [key] of params(url)) {
      assert.ok(!/key|token|secret|apikey/i.test(key), `${key} looks like a credential`);
    }
  }
});

test('the request carries coordinates and nothing about the person making it', () => {
  const sent = [...params(api.forecastUrl({ lat: 29.3759, lon: 47.9774 })).keys()].sort();
  assert.deepEqual(sent, [
    'current', 'daily', 'forecast_days', 'hourly', 'latitude', 'longitude', 'timezone', 'wind_speed_unit',
  ]);
});

test('everything is asked for in Kuwait time and in km/h', () => {
  const p = params(api.forecastUrl({ lat: 29, lon: 48 }));
  assert.equal(p.get('timezone'), 'Asia/Kuwait');
  assert.equal(p.get('wind_speed_unit'), 'kmh');
  assert.equal(params(api.airUrl({ lat: 29, lon: 48 })).get('timezone'), 'Asia/Kuwait');
});

test('the fields the screens read are the fields that get requested', () => {
  const p = params(api.forecastUrl({ lat: 29, lon: 48 }));
  // Each of these is something a card on the page shows.
  for (const field of ['visibility', 'wind_gusts_10m', 'relative_humidity_2m', 'cloud_cover', 'uv_index']) {
    assert.ok(p.get('hourly').includes(field), `hourly is missing ${field}`);
  }
  for (const field of ['wind_direction_10m', 'cloud_cover', 'relative_humidity_2m']) {
    assert.ok(p.get('current').includes(field), `current is missing ${field}`);
  }
  const a = params(api.airUrl({ lat: 29, lon: 48 }));
  assert.ok(a.get('hourly').includes('pm10') && a.get('hourly').includes('dust'));
});

test('coordinates are rounded, not passed through at full precision', () => {
  // A raw GPS fix is more precise than a forecast grid needs, and precision
  // that serves nobody is precision worth not sending.
  const p = params(api.forecastUrl({ lat: 29.37591234567, lon: 47.97741234567 }));
  assert.equal(p.get('latitude'), '29.3759');
  assert.equal(p.get('longitude'), '47.9774');
});

test('the air-quality forecast is not asked to run further than it can', () => {
  assert.ok(api.AIR_DAYS <= api.FORECAST_DAYS);
});

test('a normalized reading has hours, days and a current reading', () => {
  const r = api.normalize(forecast(), air(), { place: { id: 'kuwait-city', name: 'Kuwait City' } });
  assert.equal(r.hours.length, 48);
  assert.equal(r.days.length, 2);
  assert.equal(r.place.id, 'kuwait-city');
  assert.ok(r.hasAirQuality);
  assert.equal(r.now.tempC, 48);
  assert.equal(r.now.windDeg, 320);
});

test('visibility reaches the current reading, though the API has no current field for it', () => {
  const r = api.normalize(forecast({ hour: () => ({ visibility: 1200 }) }), air());
  assert.equal(r.now.visibilityM, 1200);
});

test('air-quality hours are matched by timestamp, not by index', () => {
  // The two models publish different horizons and can start on different
  // hours. Zipping them by index would attach the wrong dust to every hour.
  const offset = air({ offsetHours: 6, hour: (i) => ({ pm10: 100 + i }) });
  const r = api.normalize(forecast(), offset);

  const firstSix = r.hours.slice(0, 6);
  assert.ok(firstSix.every((h) => h.pm10 === null), 'hours before the air forecast starts must stay null');

  const matched = r.hours[6];
  assert.equal(matched.time, offset.hourly.time[0]);
  assert.equal(matched.pm10, 100);
});

test('losing air quality costs the dust numbers and nothing else', () => {
  const r = api.normalize(forecast(), null);
  assert.equal(r.hasAirQuality, false);
  assert.equal(r.now.tempC, 48, 'the temperature survives');
  assert.equal(r.now.pm10, null);
  assert.equal(r.now.dust, null);
  assert.ok(r.hours.every((h) => h.pm10 === null));
});

test('a response with no hourly block is rejected rather than half-rendered', () => {
  assert.throws(() => api.normalize({ current: {} }), /hourly/);
  assert.throws(() => api.normalize(null), /hourly/);
});

test('missing values come back as null, never as zero', () => {
  const broken = forecast();
  broken.hourly.visibility = broken.hourly.visibility.map(() => null);
  broken.current.pressure_msl = null;
  const r = api.normalize(broken, air());
  assert.equal(r.now.pressureHpa, null);
  assert.equal(r.hours[0].visibilityM, null);
  assert.notEqual(r.hours[0].visibilityM, 0);
});
