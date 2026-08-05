/**
 * The members app: what a member is told about their own attendance, and the
 * birthday/anniversary window on Home.
 *
 * Run: node --test 'test/*.test.mjs'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { load } from './lib/extract.mjs';

const {
  matchAttendanceRecord,
  getMyAttendanceStats,
  upcomingOccasions,
} = load('index.html', [
  'matchAttendanceRecord',
  'getMyAttendanceStats',
  'upcomingOccasions',
]);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const ME       = { id: 'bro-05', name: 'Allen Santos', title: 'Bro.' };
const SUNDAYER = { id: 'sis-14', name: 'Almira Dela Paz', title: 'Sis.', sundayOnly: true };
const FRIDAYER = { id: 'sis-01', name: 'Bless De Jesus', title: 'Sis.', fridayOnly: true };

/** Published-shape sessions: only present members carry a record. */
function published(sessions) {
  return {
    meta: { churchName: 'FLCC - Test', totalSessions: sessions.length },
    sessions: sessions.map(([date, service, present]) => ({
      id: `s-${date}`, date, service, serviceLabel: `${service} Service`,
      summary: { present: present.length, absent: 0, total: present.length },
      records: present.map(w => ({ memberId: w.id, memberName: `${w.title} ${w.name}`, status: 'present' })),
    })),
  };
}

/** Four Sundays and four Fridays; `present` attended every one they're on. */
const FOUR_OF_EACH = published([
  ['2026-07-10', 'Friday', [FRIDAYER]], ['2026-07-12', 'Sunday', [SUNDAYER]],
  ['2026-07-17', 'Friday', [FRIDAYER]], ['2026-07-19', 'Sunday', [SUNDAYER]],
  ['2026-07-24', 'Friday', [FRIDAYER]], ['2026-07-26', 'Sunday', [SUNDAYER]],
  ['2026-07-31', 'Friday', [FRIDAYER]], ['2026-08-02', 'Sunday', [SUNDAYER]],
]);

// ── Personal attendance ──────────────────────────────────────────────────────

test('a Sunday-only member who never misses a Sunday is shown 100%', () => {
  // The regression: every Friday counted against her because "no record"
  // was read as "absent", so perfect attendance displayed as 50%.
  const stats = getMyAttendanceStats(matchAttendanceRecord(SUNDAYER, FOUR_OF_EACH));
  assert.equal(stats.overall, 100);
  assert.equal(stats.totalSessions, 4);
  assert.equal(stats.fridaySessions, 0, 'Fridays she is not rostered for must not appear at all');
  assert.equal(stats.sundaySessions, 4);
});

test('a Friday-only member who never misses a Friday is shown 100%', () => {
  const stats = getMyAttendanceStats(matchAttendanceRecord(FRIDAYER, FOUR_OF_EACH));
  assert.equal(stats.overall, 100);
  assert.equal(stats.sundaySessions, 0);
  assert.equal(stats.fridaySessions, 4);
});

test('the recent-services strip only lists services the member is rostered for', () => {
  const records = matchAttendanceRecord(SUNDAYER, FOUR_OF_EACH);
  assert.ok(records.every(r => r.service === 'Sunday'));
  assert.equal(records.length, 4);
});

test('a member at both services is still measured against everything', () => {
  const stats = getMyAttendanceStats(matchAttendanceRecord(ME, FOUR_OF_EACH));
  assert.equal(stats.totalSessions, 8, 'no service preference means no sessions are skipped');
  assert.equal(stats.overall, 0, 'and genuine absence still reads as absence');
});

test('real absence is still reported', () => {
  const data = published([
    ['2026-07-12', 'Sunday', [SUNDAYER]],
    ['2026-07-19', 'Sunday', []],
    ['2026-07-26', 'Sunday', [SUNDAYER]],
    ['2026-08-02', 'Sunday', []],
  ]);
  const stats = getMyAttendanceStats(matchAttendanceRecord(SUNDAYER, data));
  assert.equal(stats.overall, 50);
  assert.equal(stats.streak, 0, 'the most recent session was a miss');
});

test('a streak counts back from the most recent service', () => {
  const stats = getMyAttendanceStats(matchAttendanceRecord(SUNDAYER, FOUR_OF_EACH));
  assert.equal(stats.streak, 4);
});

test('members are matched by name when the published record has no id', () => {
  const byName = {
    meta: {}, sessions: [{
      id: 's1', date: '2026-08-02', service: 'Sunday', records: [{ memberName: 'Sis. Almira Dela Paz', status: 'present' }],
    }],
  };
  const stats = getMyAttendanceStats(matchAttendanceRecord(SUNDAYER, byName));
  assert.equal(stats.overall, 100);
});

test('no attendance file means no card rather than a crash', () => {
  assert.equal(matchAttendanceRecord(SUNDAYER, null), null);
  assert.equal(matchAttendanceRecord(null, FOUR_OF_EACH), null);
  assert.equal(getMyAttendanceStats([]), null);
});

// ── Birthdays and anniversaries ──────────────────────────────────────────────

const worker = (name, birthday) => ({ id: name, name, title: 'Sis.', birthday });

test('the window is the next 30 days, inclusive of today', () => {
  const workers = [
    worker('today', '08-05'), worker('day30', '09-04'),
    worker('day31', '09-05'), worker('yesterday', '08-04'),
  ];
  const names = upcomingOccasions(workers, '2026-08-05', 'birthday').map(o => o.worker.name);
  assert.deepEqual(names, ['today', 'day30']);
});

test('a birthday today is zero days away, not a year', () => {
  const [first] = upcomingOccasions([worker('me', '08-05')], '2026-08-05', 'birthday');
  assert.equal(first.daysAway, 0);
});

test('the window crosses into next year in December', () => {
  const workers = [worker('newyear', '01-02'), worker('feb', '02-14')];
  const found = upcomingOccasions(workers, '2026-12-28', 'birthday');
  assert.deepEqual(found.map(o => o.worker.name), ['newyear']);
  assert.equal(found[0].daysAway, 5);
  assert.equal(found[0].date.getFullYear(), 2027, 'the next occurrence is next year');
});

test('results are ordered by how soon they fall', () => {
  const workers = [worker('c', '08-25'), worker('a', '08-06'), worker('b', '08-17')];
  assert.deepEqual(
    upcomingOccasions(workers, '2026-08-05', 'birthday').map(o => o.worker.name),
    ['a', 'b', 'c'],
  );
});

test('malformed and missing dates are skipped, not misread', () => {
  // "8-7" is the interesting one: parsed loosely it looks like a valid 7 August
  // and would quietly appear alongside real birthdays. The stored format is
  // MM-DD, so anything else is skipped here and caught at the data level by
  // the network suite rather than half-read.
  const workers = [
    worker('none', undefined), worker('empty', ''),
    worker('unpadded', '8-7'),          // would pass as 7 August without the guard
    worker('fulldate', '1990-08-07'),   // must not be read as month 1990
    worker('good', '08-07'),
  ];
  const names = upcomingOccasions(workers, '2026-08-05', 'birthday').map(o => o.worker.name);
  assert.deepEqual(names, ['good']);
});

test('anniversaries read the anniversary field, not the birthday', () => {
  const workers = [{ id: 'a', name: 'a', birthday: '08-06', anniversary: '08-08' }];
  assert.equal(upcomingOccasions(workers, '2026-08-05', 'anniversary')[0].daysAway, 3);
  assert.equal(upcomingOccasions(workers, '2026-08-05', 'birthday')[0].daysAway, 1);
});

test('a 29 February birthday still lands in the window on a common year', () => {
  const found = upcomingOccasions([worker('leap', '02-29')], '2027-02-20', 'birthday');
  assert.equal(found.length, 1, 'it should be greeted rather than dropped');
});

test('an empty roster is handled', () => {
  assert.deepEqual(upcomingOccasions([], '2026-08-05', 'birthday'), []);
  assert.deepEqual(upcomingOccasions(undefined, '2026-08-05', 'birthday'), []);
});

// ── Network announcements ────────────────────────────────────────────────────

const { upcomingAnnouncements } = load(
  'index.html',
  ['parseISODate', 'formatISODate', 'addDays', 'upcomingAnnouncements'],
);

const notice = (id, date, extra = {}) => ({ id, title: `Notice ${id}`, date, ...extra });

test('an announcement in the window is shown', () => {
  const found = upcomingAnnouncements([notice('a', '2026-08-07')], '2026-08-05', 14);
  assert.deepEqual(found.map(n => n.id), ['a']);
});

test('an announcement today still counts as upcoming', () => {
  assert.equal(upcomingAnnouncements([notice('a', '2026-08-05')], '2026-08-05', 14).length, 1);
});

test('a past announcement is dropped', () => {
  assert.deepEqual(upcomingAnnouncements([notice('a', '2026-08-04')], '2026-08-05', 14), []);
});

test('the window is respected', () => {
  const list = [notice('in', '2026-08-19'), notice('out', '2026-08-20')];
  assert.deepEqual(upcomingAnnouncements(list, '2026-08-05', 14).map(n => n.id), ['in']);
});

test('announcements are ordered by date, then by start time', () => {
  const list = [
    notice('c', '2026-08-09'),
    notice('b', '2026-08-07', { startTime: '18:00' }),
    notice('a', '2026-08-07', { startTime: '13:00' }),
  ];
  assert.deepEqual(upcomingAnnouncements(list, '2026-08-05', 30).map(n => n.id), ['a', 'b', 'c']);
});

test('an entry with no date or no title is skipped rather than rendered blank', () => {
  const list = [{ id: 'x', title: 'No date' }, { id: 'y', date: '2026-08-07' }, notice('ok', '2026-08-07')];
  assert.deepEqual(upcomingAnnouncements(list, '2026-08-05', 30).map(n => n.id), ['ok']);
});

test('no announcements file is handled', () => {
  assert.deepEqual(upcomingAnnouncements(null, '2026-08-05', 14), []);
  assert.deepEqual(upcomingAnnouncements([], '2026-08-05', 14), []);
});
