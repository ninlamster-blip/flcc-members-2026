// What is next.
//
// The countdown on the Today screen is the app's signature feature and the one
// thing on it that is trivially, publicly wrong if the arithmetic slips: a
// member who is told the service is tomorrow when it was this morning stops
// trusting the whole app. None of it can be verified by looking at a screen on
// a Tuesday, so all of it is tested against fixed moments here.
//
// Every test below pins a real date. 1 September 2026 is a Tuesday; 4 September
// is a Friday.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as agenda from '../js/core/agenda.js';

const service = { id: 'friday', gathering: true, recurring: true, weekday: 5, start: '10:00', minutes: 120 };
const prayer = { id: 'tuesday', gathering: true, recurring: true, weekday: 2, start: '21:00', minutes: 60 };
const oneOff = { id: 'breakfast', date: '2026-09-26', start: '07:30', minutes: 120 };
const series = { id: 'class', dates: ['2026-09-04', '2026-09-11', '2026-09-18'], start: '12:15', minutes: 60 };

const on = (text) => new Date(text);

test('a time is read, and nonsense is midnight rather than a crash', () => {
  assert.deepEqual(agenda.parseTime('10:00'), { hours: 10, minutes: 0 });
  assert.deepEqual(agenda.parseTime('21:30'), { hours: 21, minutes: 30 });
  assert.deepEqual(agenda.parseTime('7:05'), { hours: 7, minutes: 5 });
  assert.deepEqual(agenda.parseTime('half past nine'), { hours: 0, minutes: 0 });
  assert.deepEqual(agenda.parseTime(undefined), { hours: 0, minutes: 0 });
});

test('a weekly event finds its next Friday', () => {
  const next = agenda.nextOccurrence(service, on('2026-09-01T08:00:00'));
  assert.equal(next.getDay(), 5);
  assert.equal(next.getDate(), 4);
  assert.equal(next.getHours(), 10);
});

/**
 * The one that is easy to get wrong.
 *
 * At 11am on a Friday the service is half over. It is not "in seven days" —
 * that is the answer a naive weekday calculation gives, and it would tell a
 * member sitting in the room that church is next week.
 */
test('an event that is running now is now, not next week', () => {
  const during = on('2026-09-04T11:00:00');
  assert.equal(agenda.isNow(service, during), true);
  assert.equal(agenda.nextOccurrence(service, during).getDate(), 4);
  assert.equal(agenda.countdown(agenda.nextOccurrence(service, during), during), 'Happening now');
});

test('once it has finished, the next one is a week away', () => {
  const after = on('2026-09-04T12:30:00');
  assert.equal(agenda.isNow(service, after), false);
  assert.equal(agenda.nextOccurrence(service, after).getDate(), 11);
});

test('earlier on the day itself, it is still today', () => {
  const morning = on('2026-09-04T06:00:00');
  const next = agenda.nextOccurrence(service, morning);
  assert.equal(next.getDate(), 4);
  assert.equal(agenda.countdown(next, morning), 'Later today');
});

test('a one-off happens once and then never again', () => {
  assert.equal(agenda.nextOccurrence(oneOff, on('2026-09-01T08:00:00')).getDate(), 26);
  assert.equal(agenda.nextOccurrence(oneOff, on('2026-09-26T08:00:00')).getDate(), 26, 'still running');
  assert.equal(agenda.nextOccurrence(oneOff, on('2026-09-27T08:00:00')), null);
});

test('a short series moves through its own dates and then stops', () => {
  assert.equal(agenda.nextOccurrence(series, on('2026-09-01T08:00:00')).getDate(), 4);
  assert.equal(agenda.nextOccurrence(series, on('2026-09-05T08:00:00')).getDate(), 11);
  assert.equal(agenda.nextOccurrence(series, on('2026-09-19T08:00:00')), null);
});

test('an event with no shape at all is null rather than a wrong date', () => {
  assert.equal(agenda.nextOccurrence({ id: 'undated', when: 'Sometime in the spring' }), null);
  assert.equal(agenda.nextOccurrence(null), null);
});

test('a countdown is said the way a person would say it', () => {
  const now = on('2026-09-01T08:00:00');
  assert.equal(agenda.countdown(on('2026-09-01T21:00:00'), now), 'Later today');
  assert.equal(agenda.countdown(on('2026-09-02T10:00:00'), now), 'Tomorrow');
  assert.equal(agenda.countdown(on('2026-09-04T10:00:00'), now), 'In 3 days');
  assert.equal(agenda.countdown(on('2026-09-07T10:00:00'), now), 'In 6 days');
  assert.equal(agenda.countdown(on('2026-09-11T10:00:00'), now), 'Next week');
  // Past a fortnight it stops counting and names the day instead. "In 23 days"
  // is a number nobody acts on.
  // Order is the locale's business; what matters is that it is short, names
  // the month, and is no longer counting.
  const far = agenda.countdown(on('2026-11-12T09:00:00'), now);
  assert.match(far, /Nov/);
  assert.match(far, /12/);
  assert.ok(far.length <= 12, `"${far}" is too long to sit beside a heading`);
  assert.equal(agenda.countdown(null, now), '');
});

test('the calendar is sorted by when things actually are', () => {
  const list = agenda.upcoming([oneOff, service, prayer], { now: on('2026-09-01T08:00:00') });
  assert.deepEqual(list.map((one) => one.event.id), ['tuesday', 'friday', 'breakfast']);
  assert.equal(agenda.nextUp([oneOff, service, prayer], on('2026-09-01T08:00:00')).event.id, 'tuesday');
});

test('an undated event keeps its place in the list rather than disappearing', () => {
  // A church notice somebody forgot to date should still appear on the
  // Community screen. It sorts to the end; it is never dropped.
  const undated = { id: 'undated', when: 'Sometime in the spring' };
  const list = agenda.upcoming([undated, service], { now: on('2026-09-01T08:00:00') });
  assert.equal(list.length, 2);
  assert.equal(list[1].event.id, 'undated');
  assert.equal(list[1].at, null);
  assert.equal(list[1].countdown, '');
});

/**
 * The framing on the Today screen.
 *
 * One place decides what the home screen says about the church's week, so no
 * two screens can drift out of step. These five states are the whole of it.
 */
test('the home screen knows where it is in the church week', () => {
  const events = [service, prayer, oneOff];
  assert.equal(agenda.pulse(events, on('2026-09-04T11:00:00')).state, 'gathered');
  assert.equal(agenda.pulse(events, on('2026-09-04T14:00:00')).state, 'after');
  // Friday evening: the service is over and out of its six-hour window, and
  // the next gathering is Tuesday — four days out, so "soon" rather than "eve".
  assert.equal(agenda.pulse(events, on('2026-09-04T20:00:00')).state, 'soon');
  assert.equal(agenda.pulse(events, on('2026-09-01T08:00:00')).state, 'eve', 'the Tuesday meeting is tonight');
  assert.equal(agenda.pulse(events, on('2026-09-02T08:00:00')).state, 'soon');
  assert.equal(agenda.pulse([], on('2026-09-02T08:00:00')).state, 'ordinary');
  for (const state of ['gathered', 'after', 'eve', 'soon', 'ordinary']) {
    const found = agenda.pulse(state === 'ordinary' ? [] : events,
      state === 'ordinary' ? on('2026-09-02T08:00:00') : on('2026-09-04T11:00:00'));
    assert.ok(found.line.length > 0, `${state} has no line`);
  }
});

test('days are counted as calendar days, not as multiples of 24 hours', () => {
  // 11pm Tuesday to 1am Wednesday is two hours and one day. Getting this wrong
  // is what makes a countdown say "today" at one minute past midnight.
  assert.equal(agenda.daysBetween(on('2026-09-01T23:00:00'), on('2026-09-02T01:00:00')), 1);
  assert.equal(agenda.daysBetween(on('2026-09-01T00:30:00'), on('2026-09-01T23:30:00')), 0);
  assert.equal(agenda.daysBetween(on('2026-09-04T10:00:00'), on('2026-09-01T10:00:00')), -3);
});
