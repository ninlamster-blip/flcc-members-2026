// Exercises the part of attendance.html that decides what a steward sees when
// she opens the app on a second browser: the published attendance.json is
// pulled back down and merged with whatever this device already has.
//
// That merge is the one place in the app where records can be lost, so it is
// tested against the real source — the functions are lifted straight out of
// attendance.html rather than restated here, so a change to the page that
// breaks the rules below fails this file.
//
// Run with: node attendance.test.mjs
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const here = dirname(fileURLToPath(import.meta.url));
const page = readFileSync(join(here, 'attendance.html'), 'utf8');

/** Slice a top-level `function name(…) { … }` out of the page. They all sit at
 *  column 0 inside the script tag, so the first `\n}` at column 0 ends them. */
function lift(name) {
  const start = page.indexOf(`function ${name}(`);
  if (start < 0) throw new Error(`attendance.html no longer defines ${name}()`);
  const end = page.indexOf('\n}', start);
  if (end < 0) throw new Error(`could not find the end of ${name}()`);
  return page.slice(start, end + 2);
}

const NAMES = ['sessionStamp', 'sessionFromPublished', 'mergePublished', 'getSessionSummary', 'buildAttendanceJSON'];
const { sessionStamp, sessionFromPublished, mergePublished, buildAttendanceJSON } = new Function(`
  const CHURCH = { name: 'FLCC - Test Church', short: 'Test' };
  ${NAMES.map(lift).join('\n')}
  return { ${NAMES.join(', ')} };
`)();

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log('FAIL:', msg); }
  else console.log('ok:', msg);
}

const T = {
  old:    '2026-07-01T10:00:00.000Z',
  mid:    '2026-07-10T10:00:00.000Z',
  recent: '2026-07-20T10:00:00.000Z',
};

function localSession(over = {}) {
  return {
    id: 's-1', date: '2026-07-10', service: 'Friday', serviceLabel: 'Friday Service',
    recordedBy: 'Sis. Steward', createdAt: T.old, totalMembers: 40,
    records: [{ memberId: 'sis-01', memberName: 'Sis. One', ministry: 'Service', status: 'present', timestamp: T.old }],
    updatedAt: T.old, ...over,
  };
}
function publishedFile(sessions, over = {}) {
  return { meta: { churchName: 'FLCC - Test Church', publishedAt: T.mid, totalSessions: sessions.length }, sessions, ...over };
}
function publishedSession(over = {}) {
  return {
    id: 's-1', date: '2026-07-10', service: 'Friday', serviceLabel: 'Friday Service',
    updatedAt: T.mid, totalMembers: 40, summary: { present: 2, absent: 38, total: 40 },
    records: [
      { memberId: 'sis-01', memberName: 'Sis. One', ministry: 'Service', status: 'present' },
      { memberId: 'bro-02', memberName: 'Bro. Two', ministry: 'Music / Worship', status: 'present' },
    ], ...over,
  };
}
function device(over = {}) {
  return { meta: {}, sessions: [], customMembers: [], deletedSessions: [], ...over };
}

// ── A brand-new browser: everything published shows up ──────────────────────
{
  const merged = mergePublished(device(), publishedFile([publishedSession()]));
  assert(merged && merged.sessions.length === 1, 'a fresh browser picks up the published sessions');
  assert(merged.added === 1 && merged.refreshed === 0, 'they are counted as added, not refreshed');
  const s = merged.sessions[0];
  assert(s.records.length === 2, 'the records come with them');
  assert(s.totalMembers === 40, 'totalMembers survives so History and Analytics still compute');
  assert(s.summary === undefined, 'the published summary is dropped — it is recomputed from records');
}

// ── An unchanged file writes nothing ────────────────────────────────────────
{
  const state = device({ sessions: [localSession({ updatedAt: T.mid })] });
  assert(mergePublished(state, publishedFile([publishedSession({ updatedAt: T.mid })])) === null,
    'a file that adds nothing new returns null rather than rewriting storage');
}

// ── Newest wins, in both directions ─────────────────────────────────────────
{
  // Published copy is newer than this device's — take it.
  const stale  = device({ sessions: [localSession({ updatedAt: T.old })] });
  const merged = mergePublished(stale, publishedFile([publishedSession({ updatedAt: T.recent })]));
  assert(merged.refreshed === 1 && merged.sessions[0].records.length === 2,
    'a newer published copy replaces this device\'s older one');
  assert(merged.sessions[0].recordedBy === 'Sis. Steward',
    'fields the published file does not carry are kept from the local copy');
}
{
  // This device is mid-service and ahead of the file — do not clobber it.
  const ahead = device({ sessions: [localSession({
    updatedAt: T.recent,
    records: [
      { memberId: 'sis-01', memberName: 'Sis. One',   status: 'present', timestamp: T.recent },
      { memberId: 'bro-02', memberName: 'Bro. Two',   status: 'present', timestamp: T.recent },
      { memberId: 'sis-03', memberName: 'Sis. Three', status: 'present', timestamp: T.recent },
    ],
  })] });
  assert(mergePublished(ahead, publishedFile([publishedSession({ updatedAt: T.mid })])) === null,
    'an older published copy never overwrites work this device has not published yet');
}

// ── The merge is a union: nothing local is dropped ──────────────────────────
{
  const state  = device({ sessions: [localSession({ id: 'local-only', date: '2026-07-19', updatedAt: T.recent })] });
  const merged = mergePublished(state, publishedFile([publishedSession({ id: 'published-only' })]));
  const ids    = merged.sessions.map(s => s.id).sort();
  assert(ids.join(',') === 'local-only,published-only',
    'a session recorded here but never published survives the merge');
}

// ── A deleted session stays deleted ─────────────────────────────────────────
{
  const state = device({ deletedSessions: [{ id: 's-1', at: T.recent }] });
  assert(mergePublished(state, publishedFile([publishedSession({ updatedAt: T.mid })])) === null,
    'a session deleted here is not resurrected by an older published copy');

  const reRecorded = mergePublished(state, publishedFile([publishedSession({ updatedAt: '2026-07-25T10:00:00.000Z' })]));
  assert(reRecorded && reRecorded.sessions.length === 1,
    'but it comes back when someone recorded it again after the delete');
}

// ── Visitors travel with the file, without duplicating ──────────────────────
{
  const state = device({ customMembers: [{ id: 'v-1', name: 'Visitor One' }] });
  const merged = mergePublished(state, publishedFile([publishedSession()], {
    customMembers: [{ id: 'v-1', name: 'Visitor One' }, { id: 'v-2', name: 'Visitor Two' }],
  }));
  assert(merged.customMembers.length === 2, 'a visitor added elsewhere arrives, and a known one is not duplicated');
}

// ── Older files, published before sessions carried updatedAt ────────────────
{
  const legacy = publishedSession();
  delete legacy.updatedAt;
  delete legacy.totalMembers;
  const merged = mergePublished(device(), publishedFile([legacy]));
  assert(merged.sessions[0].updatedAt === T.mid, 'a session with no stamp falls back to the file\'s publishedAt');
  assert(merged.sessions[0].totalMembers === 40, 'and its member count falls back to the published summary');
}

// ── Round trip: publish from one device, land intact on another ─────────────
{
  const origin = device({
    sessions: [localSession({ updatedAt: T.recent }), localSession({ id: 's-2', date: '2026-07-12', updatedAt: T.recent })],
    customMembers: [{ id: 'v-9', name: 'Visitor Nine' }],
  });
  const file   = buildAttendanceJSON(origin);
  const merged = mergePublished(device(), JSON.parse(JSON.stringify(file)));
  assert(merged.sessions.length === 2, 'both services survive publish → fetch → merge');
  assert(merged.sessions.every(s => s.records.length === 1), 'with their records');
  assert(merged.sessions.every(s => s.updatedAt === T.recent), 'and their stamps, so neither side clobbers the other later');
  assert(merged.customMembers.length === 1, 'and the visitors');
  assert(mergePublished(merged, JSON.parse(JSON.stringify(file))) === null, 'merging the same file twice is a no-op');
}

// ── sessionStamp picks the newest thing a session carries ───────────────────
{
  assert(sessionStamp({ createdAt: T.old, records: [{ timestamp: T.recent }] }) === T.recent,
    'a record tapped after the session was created moves the stamp forward');
  assert(sessionStamp({}, T.mid) === T.mid, 'an empty session falls back to the value given');
  assert(sessionFromPublished({ id: 'x', records: [] }, T.mid).synced === true,
    'a session that came from the published file is marked synced');
}

console.log(failures ? `\n${failures} test(s) failed` : '\nAll attendance merge tests passed');
process.exit(failures ? 1 : 0);
