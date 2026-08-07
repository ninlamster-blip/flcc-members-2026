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

import { load, appSource, loadChurch, readRepoJSON, readRepoFile, exists } from './lib/extract.mjs';

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
  networkIndex, botrWhoIsWho, fresh, buildSystemPrompt, discoverProxy,
} = load('ask.html', [
  'addDaysISO', 'withinDays', 'daysAwayLabel',
  'networkAnnouncements', 'announcementLine', 'botrFridayLines', 'networkDirectory',
  'buildSuggestions', 'buildBriefing', 'ministryLine',
  'networkIndex', 'botrWhoIsWho', 'fresh', 'buildSystemPrompt', 'discoverProxy',
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

// ── Knowing who a nickname on the sheet actually is ──────────────────────────

const LINKED = {
  meta: BOTR.meta,
  schedule: [
    { date: '2026-08-14', preacher: 'Ptra. Weng', preacherId: 'cornerstone:sis-11',
      pastoralPrayer: 'Ptra. Mitch', emcee: 'Bro. Rey' },
    { date: '2026-08-28', preacher: 'Ptra. Ellen', preacherId: 'jaoc:sis-14' },
    { date: '2026-09-04', preacher: 'Ptra. Ellen', preacherId: 'jaoc:sis-14' },
    { date: '2026-09-11', preacher: 'Elinor Chee', preacherId: 'jaoc:sis-14' },
    { date: '2026-09-18', preacher: 'Ptr. Ghost', preacherId: 'jaoc:sis-99' },
  ],
};
const INDEX_NET = {
  cornerstone: { meta: { churchName: 'FLCC - Cornerstone' }, workers: [{ id: 'sis-11', name: 'Louella Calisagan', title: 'Ptra.' }] },
  jaoc:        { meta: { churchName: 'FLCC - JAOC' },        workers: [{ id: 'sis-14', name: 'Elinor Chee',      title: 'Ptra.' }] },
};
const IDX = networkIndex(FLCC.churches, INDEX_NET);

test('the member index is keyed by the church-qualified reference', () => {
  assert.equal(IDX['cornerstone:sis-11'].name, 'Ptra. Louella Calisagan');
  assert.equal(IDX['cornerstone:sis-11'].church, 'FLCC - Cornerstone');
  assert.equal(IDX['jaoc:sis-14'].name, 'Ptra. Elinor Chee');
  assert.equal(IDX['jaoc:sis-11'], undefined, 'a worker id must not match across churches');
});

test("a nickname on the sheet carries the member's real name and church", () => {
  const [aug14] = botrFridayLines(LINKED, null, IDX);
  assert.match(aug14, /Ptra\. Weng = Ptra\. Louella Calisagan, FLCC - Cornerstone/);
});

test('an unlinked name is left exactly as the sheet writes it', () => {
  const [aug14] = botrFridayLines(LINKED, null, IDX);
  assert.match(aug14, /Pastoral Prayer: Ptra\. Mitch \|/, 'no invented church for an unlinked name');
  const ghost = botrFridayLines(LINKED, '2026-09-18', IDX)[0];
  assert.match(ghost, /Preacher: Ptr\. Ghost$/, 'a reference to nobody adds nothing');
});

test('a name already written in full is not repeated back at itself', () => {
  const sept11 = botrFridayLines(LINKED, '2026-09-11', IDX)[0];
  assert.match(sept11, /Elinor Chee \(FLCC - JAOC\)/);
  assert.ok(!/Elinor Chee = /.test(sept11), 'no "Elinor Chee = Ptra. Elinor Chee"');
});

test('who-is-who lists each sheet name once, however often they serve', () => {
  const lines = botrWhoIsWho(LINKED, IDX);
  const ellen = lines.filter(l => l.includes('Ptra. Ellen'));
  assert.equal(ellen.length, 1, 'Ptra. Ellen preaches twice but is one person');
  assert.match(ellen[0], /Ptra\. Ellen — Ptra\. Elinor Chee · FLCC - JAOC/);
});

test('who-is-who leaves out anyone not linked to a real record', () => {
  const lines = botrWhoIsWho(LINKED, IDX).join('\n');
  assert.ok(!lines.includes('Ptra. Mitch'), 'unlinked names have no identity to give');
  assert.ok(!lines.includes('Ptr. Ghost'), 'a dangling reference is not an identity');
});

test('the real schedule resolves its linked names against the real rosters', () => {
  // The end-to-end version of all of the above, against what actually ships.
  const network = Object.fromEntries(
    FLCC.churches.map(c => [c.slug, readRepoJSON(c.dataBase.replace(/^\.\//, '').replace(/^\.$/, '') ? `${c.dataBase.replace(/^\.\//, '')}/data.json` : 'data.json')])
  );
  const idx = networkIndex(FLCC.churches, network);
  const lines = botrWhoIsWho(readRepoJSON('botr-schedule.json'), idx);
  assert.ok(lines.length > 0, 'the year has linked duties, so it must resolve some names');
  const joined = lines.join('\n');
  assert.match(joined, /Ptra\. Ellen — Ptra\. Elinor Chee · FLCC - JAOC/);
  assert.match(joined, /Sis\. Lala — Ptra\. Claraflor Serafico · FLCC - JAOC/);
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
  assert.match(dir, /Not published: nothing at all yet/);
});

test('a church with an empty roster is named as empty, not merely quiet', () => {
  const dir = networkDirectory(
    [{ slug: 'hotk', name: 'FLCC - HOTK', sector: 'Faith' }],
    { hotk: { meta: { churchName: 'FLCC - HOTK' }, workers: [] } },
  );
  assert.match(dir, /Members \(0\)/);
  assert.match(dir, /Not published:.*its roster/);
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

// ── Who the assistant is switched on for ─────────────────────────────────────
//
// The Worker that serves the app also answers on /proxy, holding the Anthropic
// key server-side, so no member should have to paste anything. But the app must
// only connect itself where that is actually true — the failure to avoid is
// telling a member the assistant is ready and having their first message 401.

const okPing = (over = {}) => async () => ({
  ok: true,
  json: async () => ({ ok: true, keySet: true, secretRequired: false, ...over }),
});

test('a Worker that can answer is discovered and used', async () => {
  assert.equal(await discoverProxy('https://church.example', okPing()), 'https://church.example');
});

test('a Worker with no Anthropic key is not offered to members', async () => {
  assert.equal(await discoverProxy('https://church.example', okPing({ keySet: false })), null);
});

test('a Worker behind a shared secret is not auto-connected', async () => {
  // The member has not been given the secret, so /proxy would 401 on their
  // first question. Better to show Connect than to promise and fail.
  assert.equal(await discoverProxy('https://church.example', okPing({ secretRequired: true })), null);
});

test('a host with no Worker behind it falls back to manual setup', async () => {
  assert.equal(await discoverProxy('https://pages.example', async () => ({ ok: false })), null);
  assert.equal(await discoverProxy('https://pages.example', async () => { throw new Error('offline'); }), null);
  assert.equal(await discoverProxy('https://pages.example', async () => ({ ok: true, json: async () => { throw new Error('html'); } })), null);
});

test('discovery is skipped when there is no origin to try', async () => {
  assert.equal(await discoverProxy(null), null);
  assert.equal(await discoverProxy(''), null);
});

test('the app only auto-connects when nothing is configured already', () => {
  // A member who set up their own key, or a different Worker, keeps it.
  assert.match(SRC, /if \(proxyUrl \|\| apiKey\) return;/);
  assert.match(SRC, /discoverProxy\(autoProxyOrigin\(\)\)/);
  assert.match(SRC, /localStorage\.setItem\(ASK_PROXY_KEY, found\)/,
    'persisting it is what lets the members app find it too');
});

test('the members app reaches the same Worker for its encouragement line', () => {
  const members = appSource('index.html');
  assert.match(members, /if \(!proxyUrl && !apiKey && \/\^https\?:\$\/\.test\(location\.protocol\)\) proxyUrl = location\.origin;/);
});

test('the Worker reports whether a secret would block a member', () => {
  const worker = readRepoFile('ask-proxy/worker.js');
  assert.match(worker, /secretRequired: !!env\.PROXY_SECRET/);
  // The secret itself must never leave the Worker.
  const ping = worker.slice(worker.indexOf("url.pathname === '/ping'"), worker.indexOf("url.pathname === '/news'"));
  assert.ok(!/PROXY_SECRET\s*[,)]/.test(ping.replace(/!!env\.PROXY_SECRET/g, '')),
    '/ping must report only whether a secret exists, never its value');
});

// ── The prompt, actually built ───────────────────────────────────────────────
//
// Extracting buildSystemPrompt and running it is worth more than grepping the
// template: a stray backtick in the prose ends the literal early, takes the
// whole script block with it, and leaves a blank page. Source greps sail
// straight past that — evaluating the function does not.

const REAL_NETWORK = Object.fromEntries(
  FLCC.churches.map(c => {
    const base = c.dataBase.replace(/^\.\/?/, '');
    return [c.slug, readRepoJSON(base ? `${base}/data.json` : 'data.json')];
  })
);

function realPrompt(slug = 'abundance') {
  const data = REAL_NETWORK[slug];
  return buildSystemPrompt(
    data, {}, {}, {},
    readRepoJSON('botr.json'), {}, null, [], [],
    readRepoJSON('announcements.json'),
    readRepoJSON('botr-schedule.json'),
    REAL_NETWORK,
    exists('worship.json') ? readRepoJSON('worship.json') : {},
  );
}

test('the prompt builds against the real published data', () => {
  const p = realPrompt();
  assert.ok(p.length > 5000, 'a prompt this short means a section silently rendered empty');
  assert.ok(!p.includes('undefined'), 'an undefined leaked into the prompt');
  assert.ok(!p.includes('[object Object]'), 'an object was stringified into the prompt');
});

test('the prompt carries every church in the network', () => {
  const p = realPrompt();
  for (const c of FLCC.churches) {
    assert.ok(p.includes(`slug: ${c.slug}`), `${c.slug} is missing from the built prompt`);
  }
  assert.match(p, /329 members in total|\d+ members in total/);
});

test('the prompt names the whole 2026 Friday schedule', () => {
  const p = realPrompt();
  const botr = readRepoJSON('botr-schedule.json');
  for (const e of botr.schedule.slice(0, 5)) {
    assert.ok(p.includes(e.date), `${e.date} is missing from the built prompt`);
  }
  assert.match(p, /Monthly themes:/);
  assert.match(p, /Holidays observed:/);
  assert.match(p, /Ministry leave/);
});

test('the prompt tells the assistant who the sheet nicknames are', () => {
  const p = realPrompt();
  assert.match(p, /Who these names are:/);
  assert.match(p, /Ptra\. Ellen — Ptra\. Elinor Chee · FLCC - JAOC/);
  assert.match(p, /Sis\. Lala — Ptra\. Claraflor Serafico · FLCC - JAOC/);
});

test('everything a member sees on Home is in the section the assistant reads first', () => {
  // The complaint this guards against: "the AI doesn't know what's on
  // tomorrow." Home shows the BOTR Friday service, network announcements,
  // holidays, ministry leave and this church's own next services. All of it
  // belongs above the fold of the prompt, not scattered through it.
  const p = realPrompt();
  const now = p.slice(p.indexOf('What Is Happening Right Now'), p.indexOf('## Church Overview'));
  for (const cue of [
    /Network announcements ahead/,
    /Next BOTR Friday morning services/,
    /This church's next services/,
    /Holidays in the next 45 days/,
    /Who is away/,
    /This month's BOTR theme/,
  ]) {
    assert.match(now, cue, 'missing from the "what is happening" section');
  }
});

/** The "What Is Happening Right Now" block on its own. */
function happeningNow(slug = 'abundance') {
  const p = realPrompt(slug);
  return p.slice(p.indexOf('What Is Happening Right Now'), p.indexOf('## Church Overview'));
}

test('the ministry leave list reaches the assistant as published, up top', () => {
  const now = happeningNow();
  const leave = readRepoJSON('botr-schedule.json').leave || [];
  assert.ok(leave.length, 'fixture check: the file has leave entries');
  for (const l of leave) {
    assert.ok(now.includes(l.person), `${l.person} is missing from "what is happening"`);
    assert.ok(now.includes(l.when), `${l.person}'s dates are missing — "when" is shown verbatim`);
  }
});

test('every holiday of the year reaches the assistant somewhere', () => {
  const p = realPrompt();
  for (const h of readRepoJSON('botr-schedule.json').holidays || []) {
    assert.ok(p.includes(h.name), `holiday "${h.name}" is missing from the prompt`);
  }
});

test('"what is happening" carries only the holidays that are actually near', () => {
  const now = happeningNow();
  const soon = now.slice(now.indexOf('Holidays in the next 45 days'), now.indexOf('Who is away'));
  const today = new Date().toISOString().slice(0, 10);
  for (const h of readRepoJSON('botr-schedule.json').holidays || []) {
    const near = withinDays(today, h.date, 45);
    assert.equal(soon.includes(h.date), near,
      `${h.name} on ${h.date} is ${near ? 'within' : 'outside'} 45 days and should ${near ? '' : 'not '}be listed`);
  }
});

test('the worship songbook reaches the assistant', () => {
  const p = realPrompt();
  const songs = readRepoJSON('worship.json').songs || [];
  assert.ok(songs.length, 'fixture check: Abundance has published songs');
  for (const s of songs.slice(0, 5)) {
    assert.ok(p.includes(s.title), `song "${s.title}" is missing from the prompt`);
  }
});

test('the assistant is handed every file the members app reads for a church', () => {
  // buildSystemPrompt can render a section perfectly and still be passed an
  // empty object, so the section quietly disappears. This is the call site.
  for (const file of ['data.json', 'music.json', 'prayer.json', 'equip.json', 'attendance.json', 'worship.json']) {
    assert.ok(SRC.includes(`fetch(fresh(CHURCH.data('${file}')))`),
      `${file} is on a members-app tab and must reach the assistant too`);
  }
  assert.match(SRC, /appData\.network, appData\.worship,/, 'worship must be passed through to the prompt');
});

test('the prompt carries the network announcements', () => {
  const p = realPrompt();
  for (const a of readRepoJSON('announcements.json').announcements) {
    if (a.date < new Date().toISOString().slice(0, 10)) continue;
    assert.ok(p.includes(a.title), `${a.title} is missing from the built prompt`);
  }
});

test('every church gets the same network sections, whichever one they are in', () => {
  // All 14, not a sample: the point of the directory is that a member of the
  // smallest church knows as much about the network as a member of the largest.
  for (const c of FLCC.churches) {
    const p = realPrompt(c.slug);
    for (const section of ['The 14 Churches of the Network', 'BOTR Friday Morning Service', 'Network Announcements', 'Who these names are:']) {
      assert.ok(p.includes(section), `${c.slug} is missing "${section}"`);
    }
  }
});

test('every church sees every other church, from every church', () => {
  for (const viewer of FLCC.churches) {
    const p = realPrompt(viewer.slug);
    for (const subject of FLCC.churches) {
      assert.ok(p.includes(`slug: ${subject.slug}`),
        `standing in ${viewer.slug}, ${subject.slug} is missing from the directory`);
    }
  }
});

test('every member in the network reaches the prompt, from any church', () => {
  for (const viewer of ['abundance', 'harvester', 'virtual']) {
    const p = realPrompt(viewer);
    for (const c of FLCC.churches) {
      for (const w of (REAL_NETWORK[c.slug].workers || []).filter(w => w.status !== 'inactive')) {
        assert.ok(p.includes(w.name), `standing in ${viewer}, ${c.slug}'s ${w.name} is missing`);
      }
    }
  }
});

test('a church that has published only a roster says so, rather than looking complete', () => {
  const p = realPrompt('abundance');
  // Whatever the churches have published today, any church without a schedule
  // must carry the note that keeps the assistant from inventing one.
  for (const c of FLCC.churches) {
    const d = REAL_NETWORK[c.slug];
    if ((d.schedule || []).length) continue;
    const block = p.slice(p.indexOf(`slug: ${c.slug}`));
    const line = block.slice(0, block.indexOf('###') === -1 ? block.length : block.indexOf('###'));
    assert.match(line, /Not published:.*a service schedule/,
      `${c.slug} has no schedule and must say so`);
  }
});

test('the assistant is told a roster is not a schedule', () => {
  const p = realPrompt('abundance');
  assert.match(p, /Not published:/);
  assert.match(p, /never who is\s+\*serving on a given day\*/);
  assert.match(p, /Never pick a plausible\s+name off that church's roster/);
});

test("a church's own upcoming services reach the directory once it has them", () => {
  const withSchedule = {
    ...REAL_NETWORK,
    harvester: {
      meta: { churchName: 'FLCC - Harvester', serviceTimes: { Sunday: '5:00 PM' } },
      workers: [{ id: 'bro-01', name: 'Test Preacher', title: 'Bro.', status: 'active' }],
      schedule: [
        { date: '2099-01-01', service: 'Sunday', roles: { preacher: 'bro-01' } },
        { date: '1999-01-01', service: 'Sunday', roles: { preacher: 'bro-01' } },
      ],
    },
  };
  const dir = networkDirectory(FLCC.churches, withSchedule, '2026-08-06');
  assert.match(dir, /Next services:/);
  assert.match(dir, /2099-01-01 \[Sunday\]: Preacher: Bro\. Test Preacher/);
  assert.ok(!dir.includes('1999-01-01'), 'a service already past is not upcoming');
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

test('the prompt resolves the sheet nicknames against the real rosters', () => {
  // botrFridayLines and botrWhoIsWho can both be correct and still be handed
  // an empty index at the call site, in which case every duty in the prompt
  // reads "Ptra. Weng" and nothing more. Only a call-site check catches that.
  assert.match(SRC, /const memberIndex\s*=\s*networkIndex\(CHURCH\.churches, network\)/);
  assert.match(SRC, /botrFridayLines\(botrSchedule, today, memberIndex\)/);
  assert.match(SRC, /botrFridayLines\(botrSchedule, null, memberIndex\)/);
  assert.match(SRC, /botrWhoIsWho\(botrSchedule, memberIndex\)/);
  assert.match(SRC, /\$\{whoIsWho\.join\('\\n'\)/, 'the lookup must reach the prompt');
  // Without today, "Next services" lists services from January.
  assert.match(SRC, /networkDirectory\(CHURCH\.churches, network, today\)/);
});

// ── Where the data comes from ────────────────────────────────────────────────
//
// These are the checks that stop the multi-church rule being broken by a
// one-word edit. A network-wide file read through CHURCH.data() resolves to
// ./churches/<slug>/… for thirteen of the fourteen churches, and every one of
// them silently gets an empty feed.

test('the network-wide feeds are read from the root, not per-church', () => {
  for (const file of ['announcements.json', 'botr-schedule.json', 'botr.json']) {
    assert.match(SRC, new RegExp(`fetch\\(fresh\\('${file.replace('.', '\\.')}'\\)\\)`),
      `${file} is shared by all 14 churches and must not be fetched through CHURCH.data()`);
    assert.ok(!SRC.includes(`CHURCH.data('${file}')`), `${file} must not be per-church`);
  }
});

test("each church's own files are still read through the resolver", () => {
  for (const file of ['data.json', 'music.json', 'prayer.json', 'equip.json', 'attendance.json']) {
    assert.ok(SRC.includes(`CHURCH.data('${file}')`), `${file} differs per church`);
  }
});

test('fresh() actually changes the URL, on a path with or without a query', () => {
  const a = fresh('./data.json');
  assert.match(a, /^\.\/data\.json\?t=\d+$/);
  assert.match(fresh('./x.json?church=jaoc'), /^\.\/x\.json\?church=jaoc&t=\d+$/,
    'an existing query must be kept, not clobbered');
  assert.notEqual(fresh('./data.json'), '/data.json');
  assert.equal(fresh(null), null, 'an unknown church resolves to null and must pass through');
});

test('every data read is cache-busted', () => {
  // The published URL never changes when the JSON behind it does, so a plain
  // fetch is served yesterday's copy by the browser and by Cloudflare's edge.
  // This is the whole reason a schedule update could show in the members app
  // and not in the assistant.
  const bare = [...SRC.matchAll(/fetch\((?!fresh\()([^)]*\.json[^)]*)\)/g)].map(m => m[1]);
  assert.deepEqual(bare, [], `these data reads are not wrapped in fresh(): ${bare.join(', ')}`);
});

test('the assistant reloads when the member comes back to the tab', () => {
  // A phone keeps the tab alive for days; without this the roster is frozen
  // at whenever it was first opened.
  assert.match(SRC, /addEventListener\('visibilitychange'/);
  assert.match(SRC, /document\.visibilityState === 'visible'/);
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
