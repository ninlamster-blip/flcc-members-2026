import test from 'node:test';
import assert from 'node:assert/strict';
import * as fmt from '../js/core/format.js';

test('a Kuwait wall-clock stamp is read as the Kuwait time it already is', () => {
  // The API is asked for timezone=Asia/Kuwait, so "14:00" means 14:00 in
  // Kuwait. Parsing it as UTC would shift every hour on the page by three.
  const d = fmt.parseLocal('2026-07-15T14:00');
  assert.equal(d.toISOString(), '2026-07-15T11:00:00.000Z');
  assert.equal(fmt.clock(d), '14:00');
});

test('a stamp that is not a stamp comes back as null', () => {
  assert.equal(fmt.parseLocal('not a date'), null);
  assert.equal(fmt.parseLocal(null), null);
  assert.equal(fmt.parseLocal(undefined), null);
});

test('hours, days and dates are all rendered in Kuwait time', () => {
  const d = fmt.parseLocal('2026-07-15T18:00');
  assert.equal(fmt.hourLabel(d), '6pm');
  assert.equal(fmt.clock(d), '18:00');
  assert.equal(fmt.weekday(d), 'Wed');
  assert.equal(fmt.dayAndMonth(d), '15 Jul');
});

test('temperatures convert and round, and missing ones show a dash', () => {
  assert.equal(fmt.temp(48, 'C'), '48°C');
  assert.equal(fmt.temp(0, 'C'), '0°C');
  assert.equal(fmt.temp(100, 'F'), '212°F');
  assert.equal(fmt.temp(48, 'C', { sign: false }), '48°');
  assert.equal(fmt.temp(null, 'C'), '—');
  assert.equal(fmt.temp(undefined), '—');
});

test('visibility is said the way people say it', () => {
  assert.equal(fmt.visibility(24000), '10+ km');
  assert.equal(fmt.visibility(4500), '4.5 km');
  assert.equal(fmt.visibility(600), '600 m');
  assert.equal(fmt.visibility(null), '—');
});

test('durations read as hours and minutes', () => {
  assert.equal(fmt.minutes(45), '45 min');
  assert.equal(fmt.minutes(60), '1 h');
  assert.equal(fmt.minutes(150), '2 h 30 min');
  assert.equal(fmt.minutes(null), '—');
});

test('"updated" never reads as the future', () => {
  const now = new Date('2026-07-15T12:00:00Z');
  assert.equal(fmt.ago(new Date('2026-07-15T11:58:00Z'), now), '2 min ago');
  assert.equal(fmt.ago(new Date('2026-07-15T11:59:40Z'), now), 'just now');
  assert.equal(fmt.ago(new Date('2026-07-15T10:00:00Z'), now), '2 hours ago');
  // A device clock that has drifted backwards must not produce "-4 min ago".
  assert.equal(fmt.ago(new Date('2026-07-15T12:04:00Z'), now), 'just now');
});

test('numbers keep their units and their dashes', () => {
  assert.equal(fmt.num(29.04, 1, '°C'), '29.0°C');
  assert.equal(fmt.num(60, 0, ' µg/m³'), '60 µg/m³');
  assert.equal(fmt.num(null, 0, '%'), '—');
  assert.equal(fmt.num(NaN, 0), '—');
});

test('the long date is a Kuwait date, not the machine\'s', () => {
  // 23:30 UTC is already the next day in Kuwait.
  assert.equal(fmt.longDate(new Date('2026-07-15T23:30:00Z')), 'Thursday 16 July');
  assert.equal(fmt.longDate(new Date('2026-07-15T09:00:00Z')), 'Wednesday 15 July');
});

// ── the clock belongs to the place, not to the app ──────────────────────────

test('a reading from another country is labelled on that country\'s clock', () => {
  // This is the bug: opened from Manila, the forecast was right and every hour
  // on the page was written on Kuwait's clock, so five in the afternoon read
  // as noon.
  fmt.setLocale({ timeZone: 'Asia/Manila', utcOffsetSeconds: 8 * 3600 });
  const afternoon = fmt.parseLocal('2026-07-15T17:00');
  assert.equal(afternoon.toISOString(), '2026-07-15T09:00:00.000Z');
  assert.equal(fmt.clock(afternoon), '17:00');
  assert.equal(fmt.hourLabel(afternoon), '5pm');

  fmt.setLocale({ timeZone: 'Asia/Kuwait', utcOffsetSeconds: 3 * 3600 });
  assert.equal(fmt.clock(fmt.parseLocal('2026-07-15T17:00')), '17:00');
});

test('the same instant is five hours apart on the two clocks', () => {
  fmt.setLocale({ timeZone: 'Asia/Kuwait', utcOffsetSeconds: 3 * 3600 });
  const kuwait = fmt.parseLocal('2026-07-15T12:00');
  fmt.setLocale({ timeZone: 'Asia/Manila', utcOffsetSeconds: 8 * 3600 });
  const manila = fmt.parseLocal('2026-07-15T12:00');
  assert.equal((manila - kuwait) / 3600000, -5, 'noon in Manila is five hours before noon in Kuwait');
});

test('the date heading follows the zone across midnight', () => {
  // 23:00 in Manila is still the afternoon before in Kuwait.
  const instant = new Date('2026-07-15T15:00:00Z');
  fmt.setLocale({ timeZone: 'Asia/Manila', utcOffsetSeconds: 8 * 3600 });
  assert.equal(fmt.longDate(instant), 'Wednesday 15 July');
  fmt.setLocale({ timeZone: 'Pacific/Auckland', utcOffsetSeconds: 12 * 3600 });
  assert.equal(fmt.longDate(instant), 'Thursday 16 July');
});

test('a zone Intl has never heard of falls back instead of taking the render with it', () => {
  const applied = fmt.setLocale({ timeZone: 'Mars/Olympus', utcOffsetSeconds: 0 });
  assert.equal(applied.timeZone, fmt.DEFAULT_ZONE);
  assert.ok(fmt.clock(new Date()));
});

test('a reading with no zone at all uses the app\'s own default', () => {
  const applied = fmt.setLocale({});
  assert.equal(applied.timeZone, 'Asia/Kuwait');
  assert.equal(applied.utcOffsetSeconds, 3 * 3600);
  fmt.setLocale({ timeZone: 'Asia/Kuwait', utcOffsetSeconds: 3 * 3600 });
});
