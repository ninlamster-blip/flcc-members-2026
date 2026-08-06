/**
 * Ask FLCC — the assistant in ask.html.
 *
 * The thing under test here is mostly *what the assistant is told*. A wrong
 * answer from a language model is not reproducible, but a system prompt that
 * never mentions the other thirteen churches, or that reads a network-wide file
 * from one church's folder, is wrong every single time and is testable.
 *
 * So these checks fall into three groups:
 *   - the pure helpers that assemble each section (behavioural)
 *   - what the prompt template contains (grep-shaped, on purpose)
 *   - which files get fetched, since a network-wide feed read per-church would
 *     silently give thirteen churches an empty announcements list
 *
 * Run: node --test 'test/*.test.mjs'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { load, appSource, loadChurch, readRepoJSON } from './lib/extract.mjs';

const FLCC = loadChurch();
const SRC = appSource('ask.html');

const CHURCH_STUB = {
  churches: FLCC.churches,
  slug: 'abundance',
  name: 'FLCC - Abundance Church',
  short: 'Abundance',
  church: { sector: 'Hope' },
};

const {
  addDaysISO, withinDays, daysAwayLabel,
  networkAnnouncements, announcementLine, botrFridayLines, networkDirectory,
  buildSuggestions, buildBriefing, ministryLine,
} = load('ask.html', [
  'addDaysISO', 'withinDays', 'daysAwayLabel',
  'networkAnnouncements', 'announcementLine', 'botrFridayLines', 'networkDirectory',
  'buildSuggestions', 'buildBriefing', 'ministryLine',
], { CHURCH: CHURCH_STUB });

// ── Dates ────────────────────────────────────────────────────────────────────

test('addDaysISO crosses months and years without drifting', () => {
  assert.equal(addDaysISO('2026-08-06', 1), '2026-08-07');
  assert.equal(addDaysISO('2026-08-06', 0), '2026-08-06');
  assert.equal(addDaysISO('2026-12-28', 7), '2027-01-04');
  assert.equal(addDaysISO('2026-02-27', 2), '2026-03-01');   // 2026 is not a leap year
});

test('withinDays covers today and the far edge, but not the past', () => {
  assert.equal(withinDays('2026-08-06', '2026-08-06', 14), true, 'today counts');
  assert.equal(withinDays('2026-08-06', '2026-08-20', 14), true, 'the last day counts');
  assert.equal(withinDays('2026-08-06', '2026-08-21', 14), false);
  assert.equal(withinDays('2026-08-06', '2026-08-05', 14), false, 'yesterday is not upcoming');
});

test('daysAwayLabel reads the way a member would say it', () => {
  assert.equal(daysAwayLabel('2026-08-06', '2026-08-06'), 'Today');
  assert.equal(daysAwayLabel('2026-08-06', '2026-08-07'), 'Tomorrow');
  assert.equal(daysAwayLabel('2026-08-06', '2026-08-10'), 'In 4 days');
});

// ── Network announcements ────────────────────────────────────────────────────

const ANN = {
  announcements: [
    { id: 'a', title: 'Past thing',    date: '2026-08-01' },
    { id: 'b', title: 'Leaders\' Meeting', date: '2026-08-07', startTime: '13:00', endTime: '15:30', location: 'F&T Hall', host: 'FLCC - F&T' },
    { id: 'c', title: 'Far off',       date: '2027-01-01' },
    { id: 'd', title: '',              date: '2026-08-08' },
    { id: 'e', date: '2026-08-09' },
    { id: 'f', title: 'No date' },
  ],
};

test('only announcements still ahead, and inside the window, reach the assistant', () => {
  const got = networkAnnouncements(ANN, '2026-08-06', 90).map(a => a.id);
  assert.deepEqual(got, ['b'], 'past, far-future, untitled and undated entries all drop out');
});

test('an announcement on today is still upcoming', () => {
  const got = networkAnnouncements(ANN, '2026-08-07', 90).map(a => a.id);
  assert.deepEqual(got, ['b']);
});

test('announcements come back soonest first', () => {
  const many = { announcements: [
    { id: 'z', title: 'Later',  date: '2026-09-01' },
    { id: 'y', title: 'Sooner', date: '2026-08-10' },
  ] };
  assert.deepEqual(networkAnnouncements(many, '2026-08-06', 90).map(a => a.id), ['y', 'z']);
});

test('an announcement line carries the time, venue and host', () => {
  const line = announcementLine(networkAnnouncements(ANN, '2026-08-06', 90)[0]);
  assert.match(line, /2026-08-07/);
  assert.match(line, /13:00–15:30/);
  assert.match(line, /F&T Hall/);
  assert.match(line, /FLCC - F&T/);
});

test('a bare announcement still renders without stray separators', () => {
  const line = announcementLine({ title: 'Something', date: '2026-08-20' });
  assert.match(line, /2026-08-20 — \*\*Something\*\*$/);
});

// ── BOTR Friday schedule ─────────────────────────────────────────────────────

const BOTR = {
  meta: { churchName: 'FLCC - BOTR Friday', service: 'Friday Morning Service', serviceTime: '10:00 AM' },
  schedule: [
    { date: '2026-08-14', preacher: 'Ptra. Weng', pastoralPrayer: 'Ptra. Mitch', emcee: 'Bro. Rey', event: '' },
    { date: '2026-08-07', preacher: 'Rev. Rodel', pastoralPrayer: 'Ptr. Mike', emcee: 'Sis. Precy', event: '' },
    { date: '2026-07-31', preacher: 'Ptr. Froi', pastoralPrayer: '', emcee: 'Sis. Lala', event: '' },
    { date: '2026-09-04', preacher: 'Ptr. Oca', pastoralPrayer: '', emcee: 'Sis. Rona', event: 'LS' },
    { date: '2026-10-02', preacher: '', pastoralPrayer: '', emcee: '', event: '' },
  ],
};

test('the Friday schedule is listed in date order', () => {
  const dates = botrFridayLines(BOTR).map(l => l.trim().slice(0, 10));
  assert.deepEqual(dates, ['2026-07-31', '2026-08-07', '2026-08-14', '2026-09-04', '2026-10-02']);
});

test('asking from a date drops the Fridays already past', () => {
  const dates = botrFridayLines(BOTR, '2026-08-07').map(l => l.trim().slice(0, 10));
  assert.deepEqual(dates, ['2026-08-07', '2026-08-14', '2026-09-04', '2026-10-02']);
});

test('every filled role reaches the line, and a blank one is named as unassigned', () => {
  const [, aug7] = botrFridayLines(BOTR);
  assert.match(aug7, /Preacher: Rev\. Rodel/);
  assert.match(aug7, /Pastoral Prayer: Ptr\. Mike/);
  assert.match(aug7, /Emcee: Sis\. Precy/);

  const empty = botrFridayLines(BOTR, '2026-10-02')[0];
  assert.match(empty, /not yet assigned/, 'an empty Friday must not look like a filled one');
});

test('a special event is flagged on its Friday', () => {
  const ls = botrFridayLines(BOTR, '2026-09-04')[0];
  assert.match(ls, /★ LS/);
});

// ── The church directory ─────────────────────────────────────────────────────

const NETWORK = {
  abundance: {
    meta: { churchName: 'FLCC - Abundance Church', serviceTimes: { Friday: '4:30 PM', Sunday: '6:30 PM' } },
    ministry: { headName: 'Sis. Amazelle De Jesus', whatsapp: '+96500000000' },
    workers: [
      { id: 'a', name: 'Justin Flores', title: 'Ptr.', designation: 'Pastor', status: 'active' },
      { id: 'b', name: 'Someone Left', title: 'Bro.', status: 'inactive' },
    ],
  },
  jaoc: {
    meta: { churchName: 'FLCC - JAOC', serviceTimes: { Friday: '', Sunday: '' } },
    workers: [{ id: 'c', name: 'Elinor Chee', title: 'Ptra.', designation: 'Pastor', status: 'active' }],
  },
};

test('the directory covers every church in the registry', () => {
  const dir = networkDirectory(FLCC.churches, NETWORK);
  for (const c of FLCC.churches) {
    assert.ok(dir.includes(c.slug), `${c.slug} must appear in the directory`);
  }
});

test('a church that has not published yet says so instead of looking empty', () => {
  const dir = networkDirectory([{ slug: 'hotk', name: 'FLCC - HOTK', sector: 'Faith' }], {});
  assert.match(dir, /has not published its data yet/);
});

test('a church is named by its own published name, not the registry fallback', () => {
  const dir = networkDirectory([{ slug: 'jaoc', name: 'REGISTRY FALLBACK', sector: 'Love' }], NETWORK);
  assert.match(dir, /FLCC - JAOC/);
  assert.ok(!dir.includes('REGISTRY FALLBACK'), "a church's own churchName wins");
});

test('titles, designations and ministry contacts survive into the directory', () => {
  const dir = networkDirectory(FLCC.churches, NETWORK);
  assert.match(dir, /Ptr\. Justin Flores — Pastor/);
  assert.match(dir, /Ptra\. Elinor Chee — Pastor/);
  assert.match(dir, /Sis\. Amazelle De Jesus/);
  assert.match(dir, /Friday 4:30 PM · Sunday 6:30 PM/);
});

test('a blank service time is left out rather than printed empty', () => {
  const dir = networkDirectory([{ slug: 'jaoc', name: 'FLCC - JAOC', sector: 'Love' }], NETWORK);
  assert.ok(!/Services:/.test(dir), 'JAOC has published no times, so no Services line');
});

test('an inactive member is not offered as someone who can serve', () => {
  const dir = networkDirectory(FLCC.churches, NETWORK);
  assert.ok(!dir.includes('Someone Left'), 'inactive members stay out of the roster line');
});

test('ministryLine says so plainly when a ministry has no head yet', () => {
  assert.match(ministryLine(null), /not yet published/);
  assert.match(ministryLine({ headName: 'Sis. A', whatsapp: '+965' }), /Sis\. A \| WhatsApp: \+965/);
});

// ── Openers and the briefing ─────────────────────────────────────────────────

const APP_DATA = {
  announcements: ANN,
  botrSchedule: BOTR,
  data: { meta: { churchName: 'FLCC - Abundance Church' }, schedule: [{ date: '2026-08-07', service: 'Friday' }] },
};

test('the openers are drawn from real, upcoming data', () => {
  const texts = buildSuggestions(APP_DATA, '2026-08-06').map(s => s.text);
  assert.ok(texts.some(t => t.includes("Leaders' Meeting")), 'the next announcement becomes an opener');
  assert.ok(texts.some(t => t.includes('2026-08-07')), 'the next BOTR Friday becomes an opener');
});

test('an opener never points at a date that has already passed', () => {
  for (const s of buildSuggestions(APP_DATA, '2026-08-06')) {
    const m = /(\d{4}-\d{2}-\d{2})/.exec(s.text);
    if (m) assert.ok(m[1] >= '2026-08-06', `"${s.text}" points at a past date`);
  }
});

test('there are always openers, even before any data has loaded', () => {
  const none = buildSuggestions(null, '2026-08-06');
  assert.ok(none.length >= 4, 'the evergreen questions carry an empty screen');
  assert.ok(none.every(s => s.icon && s.text));
});

test('the opener list stays short enough to read', () => {
  assert.ok(buildSuggestions(APP_DATA, '2026-08-06').length <= 8);
});

test('the briefing leads with what is imminent, labelled in plain words', () => {
  const items = buildBriefing(APP_DATA, '2026-08-06');
  assert.ok(items.length > 0);
  assert.equal(items[0].title, "Leaders' Meeting");
  assert.equal(items[0].label, 'Tomorrow');
  assert.match(items[0].detail, /13:00–15:30/);
  assert.ok(items.every(i => i.ask), 'every card must be askable');
});

test('the briefing stays quiet about things far away', () => {
  const far = {
    announcements: { announcements: [{ id: 'x', title: 'Christmas', date: '2026-12-25' }] },
    botrSchedule: { schedule: [{ date: '2026-12-25', preacher: 'Ptr. Jopet' }] },
    data: { schedule: [{ date: '2026-12-25', service: 'Friday' }] },
  };
  assert.deepEqual(buildBriefing(far, '2026-08-06'), [], 'nothing within a fortnight, nothing shown');
});

test('the briefing is empty rather than broken before data loads', () => {
  assert.deepEqual(buildBriefing(null, '2026-08-06'), []);
});

// ── What the assistant is actually told ──────────────────────────────────────

test('the assistant is told it serves the whole network, not one church', () => {
  assert.match(SRC, /serving the whole FLCC BOTR Church Network/);
  assert.match(SRC, /The .{0,40}Churches of the Network — Directory/);
});

test('the assistant is given the network-wide feeds by name', () => {
  assert.match(SRC, /## BOTR Friday Morning Service/);
  assert.match(SRC, /## Network Announcements/);
  assert.match(SRC, /What Is Happening Right Now/);
});

test('the assistant is told to be proactive, not merely responsive', () => {
  assert.match(SRC, /## Be Proactive/);
  for (const cue of [/Lead with what's imminent/, /Close with a next step/, /Ask when it sharpens the answer/, /Notice things worth flagging/]) {
    assert.match(SRC, cue);
  }
});

test('the assistant is told not to invent a name, date or venue', () => {
  assert.match(SRC, /Never invent a name, a date or a venue/);
});

// ── Where the data comes from ────────────────────────────────────────────────
//
// These are the checks that stop the multi-church rule being broken by a
// one-word edit. A network-wide file read through CHURCH.data() resolves to
// ./churches/<slug>/… for thirteen of the fourteen churches, and every one of
// them silently gets an empty feed.

test('the network-wide feeds are read from the root, not per-church', () => {
  for (const file of ['announcements.json', 'botr-schedule.json', 'botr.json']) {
    assert.match(SRC, new RegExp(`fetch\\('${file.replace('.', '\\.')}'\\)`),
      `${file} is shared by all 14 churches and must not be fetched through CHURCH.data()`);
    assert.ok(!SRC.includes(`CHURCH.data('${file}')`), `${file} must not be per-church`);
  }
});

test("each church's own files are still read through the resolver", () => {
  for (const file of ['data.json', 'music.json', 'prayer.json', 'equip.json', 'attendance.json']) {
    assert.ok(SRC.includes(`CHURCH.data('${file}')`), `${file} differs per church`);
  }
});

test('every church roster is loaded, through the registry rather than a hardcoded path', () => {
  assert.match(SRC, /CHURCH\.churches\.map\(/, 'the roster fetch must walk the registry');
  assert.match(SRC, /CHURCH\.dataFor\(c\.slug, 'data\.json'\)/);
  assert.ok(!/churches\/[a-z-]+\/data\.json/.test(SRC), 'no church path may be typed into ask.html');
});

test('a church that fails to load is skipped, not fatal', () => {
  // One unpublished church must not take the whole directory down with it.
  assert.match(SRC, /\.catch\(\(\) => \[c\.slug, null\]\)/);
});

test('the screen renders the openers and the briefing that were built from data', () => {
  // The helpers above can be perfect and still reach nobody: the bug this
  // guards against lives at the call site, where a frozen array would render
  // instead. Testing buildSuggestions alone would not have caught it.
  assert.match(SRC, /buildSuggestions\(appData, todayISO\(\)\)/);
  assert.match(SRC, /buildBriefing\(appData, todayISO\(\)\)/);
  assert.match(SRC, /\{suggestions\.map\(/, 'the chips must render the built openers');
  assert.match(SRC, /\{briefing\.map\(/, 'the cards must render the built briefing');
  assert.ok(!/const SUGGESTIONS = \[/.test(SRC),
    'the hardcoded opener list is what went stale — it must not come back');
});

test('the openers show for a member on the shared proxy, not only a personal key', () => {
  // Most members never hold an API key — the church runs one Worker for all of
  // them, so gating this on apiKey alone hides it from nearly everyone.
  assert.match(SRC, /\{\(apiKey \|\| proxyUrl\) && \(/);
});

// ── The real data files behind all this ──────────────────────────────────────

test('announcements.json is shaped the way the assistant reads it', () => {
  const ann = readRepoJSON('announcements.json');
  assert.ok(Array.isArray(ann.announcements));
  for (const a of ann.announcements) {
    assert.match(a.date, /^\d{4}-\d{2}-\d{2}$/, `${a.id}: needs an ISO date`);
    assert.ok(a.title, `${a.id}: needs a title`);
    assert.ok(a.id, 'every announcement needs an id');
  }
});

test('there is exactly one Ask FLCC, so its knowledge cannot drift', () => {
  // index.html used to carry a second, never-rendered assistant with its own
  // system prompt. Two knowledge bases means one of them is always stale.
  const members = appSource('index.html');
  assert.ok(!members.includes('function buildChurchContext('),
    'the members app must not build its own assistant context — ask.html owns it');
  assert.ok(!members.includes('function AskTab('),
    'the members app links to ask.html rather than embedding a second assistant');
});
