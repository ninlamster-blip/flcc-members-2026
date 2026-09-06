import test from 'node:test';
import assert from 'node:assert/strict';
import { banStatus, bannedHour, kuwaitParts, BAN, TIME_ZONE } from '../js/core/workban.js';

// Kuwait is UTC+3 all year, so a Kuwait hour is always three ahead of the Z
// time these tests are written in.
const kuwait = (iso) => new Date(iso);

test('the clock is read in Kuwait time, not the machine\'s', () => {
  const parts = kuwaitParts(kuwait('2026-07-15T09:30:00Z'));
  assert.deepEqual(parts, { year: 2026, month: 7, day: 15, hour: 12, minute: 30 });
});

test('Kuwait keeps no daylight saving, so the offset holds all year', () => {
  const january = kuwaitParts(kuwait('2026-01-15T09:00:00Z'));
  const july = kuwaitParts(kuwait('2026-07-15T09:00:00Z'));
  assert.equal(january.hour, 12);
  assert.equal(july.hour, 12);
  assert.equal(TIME_ZONE, 'Asia/Kuwait');
});

test('the ban is in force between 11:00 and 16:00 in the summer', () => {
  assert.ok(banStatus(kuwait('2026-07-15T08:00:00Z')).active, '11:00 Kuwait is inside');
  assert.ok(banStatus(kuwait('2026-07-15T12:00:00Z')).active, '15:00 Kuwait is inside');
  assert.ok(!banStatus(kuwait('2026-07-15T07:59:00Z')).active, '10:59 is outside');
  assert.ok(!banStatus(kuwait('2026-07-15T13:00:00Z')).active, '16:00 is the end, not part of it');
});

test('the season runs 1 June to 31 August inclusive', () => {
  assert.ok(banStatus(kuwait('2026-06-01T09:00:00Z')).inSeason, '1 June is in');
  assert.ok(banStatus(kuwait('2026-08-31T09:00:00Z')).inSeason, '31 August is in');
  assert.ok(!banStatus(kuwait('2026-05-31T09:00:00Z')).inSeason, '31 May is out');
  assert.ok(!banStatus(kuwait('2026-09-01T09:00:00Z')).inSeason, '1 September is out');
  assert.ok(!banStatus(kuwait('2026-01-15T09:00:00Z')).inSeason);
});

test('outside the season nothing is active, whatever the hour', () => {
  const winter = banStatus(kuwait('2026-01-15T09:00:00Z'));
  assert.equal(winter.active, false);
  assert.equal(winter.minutesUntilStart, null);
  assert.equal(winter.minutesUntilEnd, null);
  assert.match(winter.summary, /Outside/);
});

test('the countdowns point the right way', () => {
  const before = banStatus(kuwait('2026-07-15T06:30:00Z')); // 09:30 Kuwait
  assert.equal(before.active, false);
  assert.equal(before.minutesUntilStart, 90);
  assert.equal(before.minutesUntilEnd, null);

  const during = banStatus(kuwait('2026-07-15T11:00:00Z')); // 14:00 Kuwait
  assert.equal(during.active, true);
  assert.equal(during.minutesUntilEnd, 120);
  assert.equal(during.minutesUntilStart, null);

  const after = banStatus(kuwait('2026-07-15T15:00:00Z')); // 18:00 Kuwait
  assert.equal(after.active, false);
  assert.equal(after.minutesUntilStart, null);
  assert.match(after.summary, /ended/);
});

test('individual hours can be asked whether they are banned', () => {
  assert.ok(bannedHour(kuwait('2026-07-15T08:00:00Z')));   // 11:00
  assert.ok(!bannedHour(kuwait('2026-07-15T13:00:00Z')));  // 16:00
  assert.ok(!bannedHour(kuwait('2026-11-15T08:00:00Z')));  // out of season
});

test('the published rule is the one in the code', () => {
  assert.deepEqual(
    { start: [BAN.startMonth, BAN.startDay], end: [BAN.endMonth, BAN.endDay], hours: [BAN.fromHour, BAN.toHour] },
    { start: [6, 1], end: [8, 31], hours: [11, 16] },
  );
  assert.match(BAN.authority, /Public Authority for Manpower/);
});
