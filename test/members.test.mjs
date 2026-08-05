/**
 * The members app: what a member is told about their own attendance, and the
 * birthday/anniversary window on Home.
 *
 * Run: node --test 'test/*.test.mjs'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { load, appSource } from './lib/extract.mjs';

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

// ── BOTR Friday duties ───────────────────────────────────────────────────────

const { myBotrDuties, botrRef } = load(
  'index.html',
  ['parseISODate', 'formatISODate', 'addDays', 'BOTR_ROLES', 'botrRef', 'myBotrDuties'],
);

/** The shared schedule spans all 14 churches, so a reference names both. */
const BOTR = {
  meta: { churchName: 'FLCC - BOTR Friday', service: 'Friday Morning Service', serviceTime: '10:00 AM' },
  schedule: [
    { date: '2026-08-07', preacher: 'Ptr. Rodel', preacherId: 'ft:bro-17',
      pastoralPrayer: 'Ptr. Mike', pastoralPrayerId: 'agape:bro-06',
      emcee: 'Sis. Precy', emceeId: 'ft:sis-12', event: '' },
    { date: '2026-08-14', preacher: 'Ptra. Weng',
      pastoralPrayer: 'Ptra. Mitch', pastoralPrayerId: 'shekinah:sis-14',
      emcee: 'Bro. Rey', event: '' },
    { date: '2026-07-31', preacher: 'Ptr. Froi', pastoralPrayer: '', emcee: '', event: '' },
  ],
};

const roleNames = list => list.flatMap(d => d.roles);

test('a member serving on the shared schedule sees their duty', () => {
  const duties = myBotrDuties(BOTR, 'ft', { id: 'bro-17' }, '2026-08-05', 60);
  assert.equal(duties.length, 1);
  assert.equal(duties[0].entry.date, '2026-08-07');
  assert.deepEqual(duties[0].roles, ['Preacher']);
});

test('a reference is church-qualified — the same worker id in another church is not a match', () => {
  // Worker ids are only unique inside a church, so "bro-17" at Agape must not
  // pick up F&T's assignment.
  assert.deepEqual(myBotrDuties(BOTR, 'agape', { id: 'bro-17' }, '2026-08-05', 60), []);
  assert.equal(botrRef('ft', 'bro-17'), 'ft:bro-17');
});

test('each role resolves to its own person', () => {
  assert.deepEqual(roleNames(myBotrDuties(BOTR, 'agape', { id: 'bro-06' }, '2026-08-05', 60)), ['Pastoral Prayer']);
  assert.deepEqual(roleNames(myBotrDuties(BOTR, 'ft', { id: 'sis-12' }, '2026-08-05', 60)), ['EMCEE']);
  assert.deepEqual(roleNames(myBotrDuties(BOTR, 'shekinah', { id: 'sis-14' }, '2026-08-05', 60)), ['Pastoral Prayer']);
});

test('someone serving two roles on one day gets both', () => {
  const doubled = { ...BOTR, schedule: [{ date: '2026-08-07', preacherId: 'ft:bro-17', emceeId: 'ft:bro-17' }] };
  assert.deepEqual(roleNames(myBotrDuties(doubled, 'ft', { id: 'bro-17' }, '2026-08-05', 60)), ['Preacher', 'EMCEE']);
});

test('a member not named on the schedule has no duties', () => {
  assert.deepEqual(myBotrDuties(BOTR, 'mtcc', { id: 'bro-01' }, '2026-08-05', 60), []);
});

test('entries with no reference stay display-only', () => {
  // 31 July names "Ptr. Froi" but links nobody — it still shows on the shared
  // card, it just isn't anyone's personal assignment.
  const all = ['ft', 'agape', 'shekinah', 'mtcc'].flatMap(slug =>
    myBotrDuties(BOTR, slug, { id: 'bro-17' }, '2026-07-01', 365));
  assert.equal(all.some(d => d.entry.date === '2026-07-31'), false);
});

test('with no window, a member sees every duty still ahead of them', () => {
  // My Schedule is a member's own commitment list, so it shows everything
  // ahead the way their church assignments already do — a duty in December is
  // still theirs to know about in August. The 60-day cap this replaced hid
  // exactly that case.
  const decemberToo = { ...BOTR, schedule: [
    { date: '2026-08-07', preacherId: 'ft:bro-17' },
    { date: '2026-12-25', preacherId: 'ft:bro-17' },
  ] };
  assert.deepEqual(
    myBotrDuties(decemberToo, 'ft', { id: 'bro-17' }, '2026-08-05').map(d => d.entry.date),
    ['2026-08-07', '2026-12-25'],
  );
});

test('My Schedule asks for every duty, the bell only for imminent ones', () => {
  // The test above proves the function is right when called correctly; this
  // guards the call sites, which is where the 60-day cap actually lived.
  const calls = [...appSource('index.html').matchAll(/myBotrDuties\(botrScheduleData[^)]*\)/g)].map(m => m[0]);
  assert.equal(calls.length, 2, 'expected one call on My Schedule and one in the bell');

  const [mySchedule, bell] = calls;
  assert.equal(/,\s*\d+\s*\)$/.test(mySchedule), false,
    `My Schedule must not cap the window — a December duty is still theirs to see: ${mySchedule}`);
  assert.match(bell, /,\s*14\s*\)$/, 'the bell stays at 14 days');
});

test('past duties are not shown, and the window is respected', () => {
  assert.deepEqual(myBotrDuties(BOTR, 'ft', { id: 'bro-17' }, '2026-08-08', 60), [], 'past');
  assert.deepEqual(myBotrDuties(BOTR, 'shekinah', { id: 'sis-14' }, '2026-08-05', 5), [], '14 Aug is outside a 5-day window');
});

test('duties come back soonest first', () => {
  const many = { ...BOTR, schedule: [
    { date: '2026-09-04', preacherId: 'ft:bro-17' },
    { date: '2026-08-07', preacherId: 'ft:bro-17' },
    { date: '2026-08-21', preacherId: 'ft:bro-17' },
  ] };
  assert.deepEqual(
    myBotrDuties(many, 'ft', { id: 'bro-17' }, '2026-08-05', 60).map(d => d.entry.date),
    ['2026-08-07', '2026-08-21', '2026-09-04'],
  );
});

test('no schedule, no member or no church means no duties rather than a crash', () => {
  assert.deepEqual(myBotrDuties(null, 'ft', { id: 'bro-17' }, '2026-08-05'), []);
  assert.deepEqual(myBotrDuties(BOTR, 'ft', null, '2026-08-05'), []);
  assert.deepEqual(myBotrDuties(BOTR, null, { id: 'bro-17' }, '2026-08-05'), []);
});

// ── Saving to a phone calendar ───────────────────────────────────────────────

const { parseTime12, icsDateTimePlus, buildICSEvent } = load(
  'index.html',
  ['parseISODate', 'formatISODate', 'addDays', 'formatICSDateTime', 'formatICSDate',
   'formatICSStamp', 'escapeICS', 'parseTime12', 'icsDateTimePlus', 'buildICSEvent'],
);

const line = (lines, key) => (lines.find(l => l.startsWith(key)) || '').slice(key.length);

test('a displayed service time is read back for the calendar', () => {
  // botr-schedule.json stores "10:00 AM" because that is what the card shows.
  assert.equal(parseTime12('10:00 AM'), '10:00');
  assert.equal(parseTime12('1:00 PM'), '13:00');
  assert.equal(parseTime12('12:00 AM'), '00:00', 'midnight is 00, not 12');
  assert.equal(parseTime12('12:30 PM'), '12:30', 'noon stays 12');
  assert.equal(parseTime12('9 am'), '09:00');
});

test('anything that is not a time gives null, so the event falls back to all-day', () => {
  for (const bad of ['', null, undefined, 'TBD', 'morning', '10:00', '25:00 AM']) {
    assert.equal(parseTime12(bad), null, `"${bad}"`);
  }
});

test('an end time rolls the hour and the day over properly', () => {
  // formatICSDateTime only pads, so 23:30 + 90 minutes has to normalise into
  // the next day rather than producing hour 25.
  assert.equal(icsDateTimePlus('2026-08-07', '13:00', 90), '20260807T143000');
  assert.equal(icsDateTimePlus('2026-08-07', '23:30', 90), '20260808T010000');
  assert.equal(icsDateTimePlus('2026-08-31', '23:00', 120), '20260901T010000', 'and over a month end');
});

test('a timed event carries a start and an end', () => {
  const lines = buildICSEvent({
    uid: 'x@test', date: '2026-08-07', startTime: '13:00',
    summary: "Leaders' Meeting", location: 'FLCC - Shekinah Church Hall',
  });
  assert.equal(line(lines, 'DTSTART:'), '20260807T130000');
  assert.equal(line(lines, 'DTEND:'), '20260807T143000', '90 minutes by default');
  assert.equal(line(lines, 'LOCATION:'), 'FLCC - Shekinah Church Hall');
  assert.ok(lines[0] === 'BEGIN:VEVENT' && lines[lines.length - 1] === 'END:VEVENT');
});

test('an explicit end time wins over the default duration', () => {
  const lines = buildICSEvent({ uid: 'x@test', date: '2026-08-07', startTime: '13:00', endTime: '16:00', summary: 'x' });
  assert.equal(line(lines, 'DTEND:'), '20260807T160000');
});

test('an event with no time becomes an all-day entry', () => {
  const lines = buildICSEvent({ uid: 'x@test', date: '2026-08-07', summary: 'x' });
  assert.equal(line(lines, 'DTSTART;VALUE=DATE:'), '20260807');
  assert.equal(line(lines, 'DTEND;VALUE=DATE:'), '20260808', 'all-day events end the next day');
  assert.equal(lines.some(l => l.startsWith('DTSTART:')), false, 'no timed start');
});

test('commas and newlines in a title cannot break the file', () => {
  const lines = buildICSEvent({ uid: 'x@test', date: '2026-08-07', summary: 'Meeting, part 2; see notes', description: 'a\nb' });
  const summary = line(lines, 'SUMMARY:');
  assert.ok(summary.includes('\\,'), 'commas are escaped');
  assert.ok(summary.includes('\;'), 'semicolons are escaped');
  assert.ok(!line(lines, 'DESCRIPTION:').includes('\n'), 'raw newlines would truncate the event');
});

test('an empty location or description is left out rather than written blank', () => {
  const lines = buildICSEvent({ uid: 'x@test', date: '2026-08-07', summary: 'x', location: '', description: '' });
  assert.equal(lines.some(l => l.startsWith('LOCATION:')), false);
  assert.equal(lines.some(l => l.startsWith('DESCRIPTION:')), false);
});

// ── Themes, holidays and leave ───────────────────────────────────────────────

const { upcomingHolidays, themeForDate } = load(
  'index.html',
  ['parseISODate', 'formatISODate', 'addDays', 'upcomingHolidays', 'themeForDate'],
);

const THEMES = { '2026-07': 'Book of 1 Thessalonians', '2026-09': 'Financial Stewardship' };

test('a service shows the theme of the month it falls in', () => {
  assert.equal(themeForDate(THEMES, '2026-07-31'), 'Book of 1 Thessalonians');
  assert.equal(themeForDate(THEMES, '2026-09-18'), 'Financial Stewardship');
});

test('a month with no theme yet shows nothing rather than a placeholder', () => {
  // August still reads "Book of ________" on the sheet, so it is left unset.
  assert.equal(themeForDate(THEMES, '2026-08-07'), '');
  assert.equal(themeForDate(undefined, '2026-08-07'), '');
  assert.equal(themeForDate(THEMES, undefined), '');
});

const HOLIDAYS = [
  { date: '2026-08-27', name: 'PBUH Birthday' },
  { date: '2026-05-27', name: 'Eid Al Adha' },
  { date: '2026-09-30', name: 'Later' },
];

test('only holidays still ahead and inside the window are shown', () => {
  const found = upcomingHolidays(HOLIDAYS, '2026-08-05', 45);
  assert.deepEqual(found.map(h => h.name), ['PBUH Birthday'], 'May has passed, September is beyond 45 days');
});

test('holidays come back soonest first', () => {
  const list = [{ date: '2026-08-27', name: 'b' }, { date: '2026-08-10', name: 'a' }];
  assert.deepEqual(upcomingHolidays(list, '2026-08-05', 45).map(h => h.name), ['a', 'b']);
});

test('a holiday today still counts as upcoming', () => {
  assert.equal(upcomingHolidays([{ date: '2026-08-05', name: 'Today' }], '2026-08-05', 45).length, 1);
});

test('holiday entries missing a date or a name are skipped', () => {
  const list = [{ date: '2026-08-10' }, { name: 'No date' }, { date: '2026-08-11', name: 'ok' }];
  assert.deepEqual(upcomingHolidays(list, '2026-08-05', 45).map(h => h.name), ['ok']);
});

test('no holiday list is handled', () => {
  assert.deepEqual(upcomingHolidays(null, '2026-08-05'), []);
  assert.deepEqual(upcomingHolidays([], '2026-08-05'), []);
});
