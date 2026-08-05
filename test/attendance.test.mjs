/**
 * Attendance OS: rosters, session summaries and pastoral care flags.
 *
 * The rule this file exists to defend: a Friday roster and a Sunday roster are
 * not the same set of people, so a session must always be measured against the
 * roster it was actually recorded from. Getting that wrong is invisible — the
 * numbers stay plausible, they're just quietly too low, forever.
 *
 * Run: node --test 'test/*.test.mjs'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { load, appSource } from './lib/extract.mjs';

const {
  rosterForService,
  getSessionSummary,
  computeCareFlags,
} = load('attendance.html', [
  'PASTORAL_CARE_SERVICES',
  'rosterForService',
  'getSessionSummary',
  'computeCareFlags',
]);

// ── Fixtures ─────────────────────────────────────────────────────────────────

const member = (id, extra = {}) => ({
  id, name: id, title: 'Bro.', status: 'active', type: 'individual',
  sundayOnly: false, fridayOnly: false, ...extra,
});

/** 10 members: 6 at both services, 1 Friday-only, 3 Sunday-only. */
const MEMBERS = [
  member('both-1'), member('both-2'), member('both-3'),
  member('both-4'), member('both-5'), member('both-6'),
  member('fri-1', { fridayOnly: true }),
  member('sun-1', { sundayOnly: true }),
  member('sun-2', { sundayOnly: true }),
  member('sun-3', { sundayOnly: true }),
];

/** A session with everyone on `present` marked present, as the app stores it:
 *  only present members get a record — absence is the *lack* of one. */
function session(date, service, present) {
  const roster = rosterForService(MEMBERS, service);
  return {
    id: `s-${date}-${service}`,
    date, service, serviceLabel: `${service} Service`,
    totalMembers: roster.length,
    records: present.map(id => ({ memberId: id, memberName: id, status: 'present' })),
  };
}

const ids = list => list.map(m => m.id);

// ── Rosters ──────────────────────────────────────────────────────────────────

test('a Sunday roster excludes Friday-only members', () => {
  const roster = rosterForService(MEMBERS, 'Sunday');
  assert.equal(roster.length, 9);
  assert.ok(!ids(roster).includes('fri-1'));
  assert.ok(ids(roster).includes('sun-1'));
});

test('a Friday roster excludes Sunday-only members', () => {
  const roster = rosterForService(MEMBERS, 'Friday');
  assert.equal(roster.length, 7);
  assert.ok(!ids(roster).includes('sun-1'));
  assert.ok(ids(roster).includes('fri-1'));
});

test('non-worship gatherings follow the Friday rule', () => {
  // Prayer meetings, training and the rest are weekday gatherings, so a
  // Sunday-only member isn't expected at them either.
  assert.deepEqual(ids(rosterForService(MEMBERS, 'Prayer Meeting')), ids(rosterForService(MEMBERS, 'Friday')));
});

test('with no service started, the roster is everyone', () => {
  assert.equal(rosterForService(MEMBERS, null).length, MEMBERS.length);
  assert.equal(rosterForService(MEMBERS, '').length, MEMBERS.length);
});

test('the two rosters genuinely differ — the whole reason this matters', () => {
  assert.notDeepEqual(
    ids(rosterForService(MEMBERS, 'Sunday')),
    ids(rosterForService(MEMBERS, 'Friday')),
  );
});

// ── Session summaries ────────────────────────────────────────────────────────

test('a full roster marked present is 100%, not "everyone minus the other service"', () => {
  // The regression: History measured against all 10 members, so a perfect
  // Sunday reported 9/10 and a perfect Friday 7/10. Neither could reach 100%.
  for (const service of ['Sunday', 'Friday']) {
    const roster = rosterForService(MEMBERS, service);
    const s = session('2026-08-02', service, ids(roster));
    const sum = getSessionSummary(s, s.totalMembers || MEMBERS.length);

    assert.equal(sum.present, roster.length, `${service} present`);
    assert.equal(sum.absent, 0, `${service} absent`);
    assert.equal(sum.total, roster.length, `${service} total`);
    assert.equal(Math.round((sum.present / sum.total) * 100), 100, `${service} percentage`);
  }
});

test("a session's own roster size wins over a caller-supplied total", () => {
  const s = session('2026-08-02', 'Sunday', ['both-1']);
  const sum = getSessionSummary(s, s.totalMembers || MEMBERS.length);
  assert.equal(sum.total, 9);       // the Sunday roster
  assert.notEqual(sum.total, 10);   // not every active member
});

test('sessions recorded before totalMembers existed fall back to the passed total', () => {
  const legacy = { id: 'old', date: '2026-01-04', service: 'Sunday', records: [{ memberId: 'both-1', status: 'present' }] };
  assert.equal('totalMembers' in legacy, false);
  const sum = getSessionSummary(legacy, legacy.totalMembers || MEMBERS.length);
  assert.equal(sum.total, MEMBERS.length);
  assert.equal(sum.present, 1);
});

test('the published summary uses the session roster with no caller total', () => {
  // buildAttendanceJSON calls getSessionSummary(s) bare — this is what lands in
  // attendance.json and what the members app reads back.
  const s = session('2026-08-02', 'Friday', ids(rosterForService(MEMBERS, 'Friday')));
  const sum = getSessionSummary(s);
  assert.equal(sum.total, 7);
  assert.equal(sum.absent, 0);
});

test('an empty session reports the roster as absent, not as zero total', () => {
  const s = session('2026-08-02', 'Sunday', []);
  const sum = getSessionSummary(s, s.totalMembers);
  assert.deepEqual(sum, { present: 0, absent: 9, total: 9 });
});

test('summaries never report negative absences', () => {
  const s = { id: 'x', date: '2026-08-02', service: 'Sunday', totalMembers: 2, records: [
    { memberId: 'a', status: 'present' }, { memberId: 'b', status: 'present' }, { memberId: 'c', status: 'present' },
  ] };
  assert.equal(getSessionSummary(s, s.totalMembers).absent, 0);
});

test('no screen measures a session against the whole membership', () => {
  // The tests above prove the function is right when called correctly. This
  // one guards the thing that actually regressed: History and Analytics
  // passing `members.length`, which overrides the session's own roster and
  // silently caps every service below 100%.
  const offenders = [...appSource('attendance.html').matchAll(/getSessionSummary\([^)]*?,\s*members\.length\s*\)/g)];
  assert.deepEqual(
    offenders.map(m => m[0]), [],
    'pass `s.totalMembers || members.length` so the session\'s own roster wins',
  );
});

// ── Pastoral care flags ──────────────────────────────────────────────────────

/** Four Sundays and four Fridays where only `present` ever showed up. */
function history(present) {
  return [
    session('2026-07-05', 'Sunday', present), session('2026-07-10', 'Friday', present),
    session('2026-07-12', 'Sunday', present), session('2026-07-17', 'Friday', present),
    session('2026-07-19', 'Sunday', present), session('2026-07-24', 'Friday', present),
    session('2026-07-26', 'Sunday', present), session('2026-07-31', 'Friday', present),
  ];
}

test('a member absent from every service is flagged', () => {
  // The regression: the weekly summary built its candidate list from
  // session.records, so someone with no record anywhere was invisible to the
  // one report meant to find them.
  const flags = computeCareFlags(history(['both-1']), MEMBERS);
  const flagged = flags.map(f => f.member.id);
  assert.ok(flagged.includes('both-2'), 'a member with no record at all must still be flagged');
  assert.ok(!flagged.includes('both-1'), 'the member who attended everything must not be');
});

test('a Sunday-only member is judged on Sundays alone', () => {
  // Present every Sunday, absent every Friday — which is exactly what being
  // Sunday-only means, and must not read as neglect.
  const sundays = ids(rosterForService(MEMBERS, 'Sunday'));
  const sessions = history([]).map(s => (s.service === 'Sunday' ? { ...s, records: sundays.map(id => ({ memberId: id, memberName: id, status: 'present' })) } : s));

  const flagged = computeCareFlags(sessions, MEMBERS).map(f => f.member.id);
  assert.ok(!flagged.includes('sun-1'), 'perfect Sunday attendance must not flag a Sunday-only member');
});

test('a Friday-only member is judged on Fridays alone', () => {
  const fridays = ids(rosterForService(MEMBERS, 'Friday'));
  const sessions = history([]).map(s => (s.service === 'Friday' ? { ...s, records: fridays.map(id => ({ memberId: id, memberName: id, status: 'present' })) } : s));

  const flagged = computeCareFlags(sessions, MEMBERS).map(f => f.member.id);
  assert.ok(!flagged.includes('fri-1'), 'perfect Friday attendance must not flag a Friday-only member');
});

test('a both-services member who abandons one service is still flagged', () => {
  // Attends every Sunday, never a Friday. The comment in computeCareFlags is
  // explicit that this should still reach a pastor.
  const sessions = history([]).map(s => (s.service === 'Sunday' ? { ...s, records: [{ memberId: 'both-1', memberName: 'both-1', status: 'present' }] } : s));

  const flags = computeCareFlags(sessions, MEMBERS);
  const one = flags.find(f => f.member.id === 'both-1');
  assert.ok(one, 'skipping every Friday must still flag');
  assert.equal(one.missedService, 'Friday');
});

test('flags escalate to pastor priority at five consecutive absences', () => {
  const flags = computeCareFlags(history(['both-1']), MEMBERS);
  const one = flags.find(f => f.member.id === 'both-2');
  assert.equal(one.streak, 4);
  assert.equal(one.level, 'gentle');

  const longer = [...history(['both-1']), session('2026-06-28', 'Sunday', ['both-1'])];
  const escalated = computeCareFlags(longer, MEMBERS).find(f => f.member.id === 'both-2');
  assert.equal(escalated.level, 'priority');
});

test('inactive members are never flagged', () => {
  const withInactive = [...MEMBERS, member('gone', { status: 'inactive' })];
  const flagged = computeCareFlags(history(['both-1']), withInactive).map(f => f.member.id);
  assert.ok(!flagged.includes('gone'));
});

test('nothing is flagged before there is enough history to judge', () => {
  const twoSessions = [session('2026-07-26', 'Sunday', []), session('2026-07-31', 'Friday', [])];
  assert.deepEqual(computeCareFlags(twoSessions, MEMBERS), []);
});

test('non-worship gatherings do not drive pastoral care', () => {
  const meetings = [
    session('2026-07-08', 'Prayer Meeting', []), session('2026-07-15', 'Prayer Meeting', []),
    session('2026-07-22', 'Prayer Meeting', []), session('2026-07-29', 'Prayer Meeting', []),
  ];
  assert.deepEqual(computeCareFlags(meetings, MEMBERS), [], 'missing prayer meetings is not a care flag');
});

test('flags are ordered by how long someone has been away', () => {
  const flags = computeCareFlags(history(['both-1']), MEMBERS);
  const streaks = flags.map(f => f.streak);
  assert.deepEqual(streaks, [...streaks].sort((a, b) => b - a));
});

// ── Publishing ───────────────────────────────────────────────────────────────

const { mergeAttendanceSessions } = load('attendance.html', [
  'getSessionSummary',
  'toPublishedSession',
  'mergeAttendanceSessions',
]);

/** A session in the shape the published file stores. */
const pub = (id, date, service, present = 0) => ({
  id, date, service, serviceLabel: `${service} Service`,
  summary: { present, absent: 0, total: present },
  records: Array.from({ length: present }, (_, i) => ({ memberId: `m${i}`, memberName: `m${i}`, status: 'present' })),
});

test('publishing from a device with stale data cannot delete what is already up', () => {
  // Abundance, twice: a browser holding one empty session republished over 17
  // real ones and took 321 attendance marks with it.
  const alreadyPublished = [
    pub('a', '2026-07-05', 'Sunday', 30), pub('b', '2026-07-03', 'Friday', 28),
    pub('c', '2026-06-28', 'Sunday', 31), pub('d', '2026-06-26', 'Friday', 27),
  ];
  const staleDevice = [{ id: 'z', date: '2026-06-08', service: 'Friday', totalMembers: 30, records: [] }];

  const merged = mergeAttendanceSessions(alreadyPublished, staleDevice, []);

  assert.equal(merged.length, 5, 'the four published sessions survive, plus the local one');
  const present = merged.reduce((n, s) => n + s.records.length, 0);
  assert.equal(present, 116, 'no attendance marks are lost');
});

test('a session recorded on this device is added to what is published', () => {
  const merged = mergeAttendanceSessions(
    [pub('a', '2026-07-05', 'Sunday', 30)],
    [{ id: 'new', date: '2026-08-02', service: 'Sunday', totalMembers: 38, records: [{ memberId: 'm1', memberName: 'm1', status: 'present' }] }],
    [],
  );
  assert.deepEqual(merged.map(s => s.id), ['new', 'a'], 'newest first');
  assert.equal(merged[0].summary.total, 38, 'and it carries its own roster size');
});

test('this device wins for a session both sides know about', () => {
  // The steward corrected a session locally; the published copy is stale.
  const merged = mergeAttendanceSessions(
    [pub('a', '2026-07-05', 'Sunday', 10)],
    [{ id: 'a', date: '2026-07-05', service: 'Sunday', totalMembers: 38, records: [
      { memberId: 'm1', memberName: 'm1', status: 'present' }, { memberId: 'm2', memberName: 'm2', status: 'present' },
    ] }],
    [],
  );
  assert.equal(merged.length, 1);
  assert.equal(merged[0].summary.present, 2, 'the local correction is what gets published');
});

test('a deliberately deleted session stays deleted', () => {
  const merged = mergeAttendanceSessions(
    [pub('a', '2026-07-05', 'Sunday', 30), pub('b', '2026-07-03', 'Friday', 28)],
    [],
    ['a'],
  );
  assert.deepEqual(merged.map(s => s.id), ['b']);
});

test('two stewards on two devices both keep their sessions', () => {
  const deviceA = [{ id: 'a1', date: '2026-08-02', service: 'Sunday', totalMembers: 38, records: [] }];
  const first = mergeAttendanceSessions([], deviceA, []);

  const deviceB = [{ id: 'b1', date: '2026-08-07', service: 'Friday', totalMembers: 27, records: [] }];
  const second = mergeAttendanceSessions(first, deviceB, []);

  assert.deepEqual(second.map(s => s.id).sort(), ['a1', 'b1']);
});

test('nothing published yet is not treated as a loss', () => {
  const merged = mergeAttendanceSessions([], [{ id: 'a', date: '2026-08-02', service: 'Sunday', totalMembers: 38, records: [] }], []);
  assert.equal(merged.length, 1);
});

test('merging is stable — publishing twice changes nothing', () => {
  const local = [{ id: 'a', date: '2026-08-02', service: 'Sunday', totalMembers: 38, records: [{ memberId: 'm1', memberName: 'm1', status: 'present' }] }];
  const once = mergeAttendanceSessions([], local, []);
  const twice = mergeAttendanceSessions(once, local, []);
  assert.deepEqual(twice, once);
});

test('a malformed published file cannot inject junk sessions', () => {
  const merged = mergeAttendanceSessions([null, {}, pub('a', '2026-07-05', 'Sunday', 3)], [], []);
  assert.deepEqual(merged.map(s => s.id), ['a']);
});

test('every publish path merges rather than overwrites', () => {
  // The regression guard: buildAttendanceJSON(state) with no published
  // sessions passed in is exactly what wiped the file.
  const src = appSource('attendance.html');
  const bare = [...src.matchAll(/buildAttendanceJSON\(\s*state\s*\)/g)];
  assert.deepEqual(bare.map(m => m[0]), [], 'publish through buildMergedAttendance(state)');
});

const { buildAttendanceJSON } = load(
  'attendance.html',
  ['getSessionSummary', 'toPublishedSession', 'mergeAttendanceSessions', 'buildAttendanceJSON'],
  { CHURCH: { name: 'FLCC - Test Church' } },
);

test('the published payload carries the merge, not just this device', () => {
  // End-to-end over the function the publish paths actually call.
  const state = {
    meta: { churchName: '' },
    sessions: [{ id: 'local', date: '2026-08-02', service: 'Sunday', totalMembers: 38, records: [] }],
    deletedSessions: [],
  };
  const alreadyPublished = [pub('a', '2026-07-05', 'Sunday', 30), pub('b', '2026-07-03', 'Friday', 28)];

  const out = buildAttendanceJSON(state, alreadyPublished);

  assert.deepEqual(out.sessions.map(s => s.id), ['local', 'a', 'b']);
  assert.equal(out.meta.totalSessions, 3, 'the count reflects everything published, not just local');
  assert.equal(out.meta.churchName, 'FLCC - Test Church', 'falls back to the active church');
  assert.equal(out.sessions.reduce((n, s) => n + s.records.length, 0), 58, 'no marks dropped');
});

test('the payload honours deletions end-to-end', () => {
  const state = { meta: {}, sessions: [], deletedSessions: ['a'] };
  const out = buildAttendanceJSON(state, [pub('a', '2026-07-05', 'Sunday', 30), pub('b', '2026-07-03', 'Friday', 28)]);
  assert.deepEqual(out.sessions.map(s => s.id), ['b']);
});
