/**
 * Sermon Notes — the reference parser, the service a note belongs to, and the
 * promise that this app and the members app are two doors onto one set of
 * notes rather than two sets.
 *
 * sermon-notes/ is plain ES modules, so unlike the single-file apps these
 * import directly. The one thing that has to be checked against index.html is
 * the shared storage: the key and the note id, which are the whole reason a
 * note written in one app opens in the other.
 *
 * Run: node --test 'test/*.test.mjs'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { load, loadChurch, appSource, readRepoJSON, readRepoFile, exists } from './lib/extract.mjs';

const FLCC = loadChurch();
import { BOOK_NAMES, resolveBook, parse, normalize, isReference } from '../sermon-notes/js/scripture.js';
import {
  todayISO, daysBetween, dateLabel, shortDate, monthLabel, relativeDay,
  noteId, parseNoteId, servicesFrom, chooseService, switchableServices,
  looksLikeHtml, htmlToText, readNote, noteIsEmpty, noteSummary,
  listNotes, searchNotes, groupByMonth, noteToText,
} from '../sermon-notes/js/notes.js';

// ── Scripture references ─────────────────────────────────────────────────────

test('all sixty-six books are in the table and each answers to its own name', () => {
  assert.equal(BOOK_NAMES.length, 66);
  for (const name of BOOK_NAMES) {
    assert.equal(resolveBook(name), name, `${name} does not resolve from its own name`);
    assert.equal(resolveBook(name.toUpperCase()), name);
  }
});

test('the short forms a member actually types resolve', () => {
  const cases = {
    'rom 8:28': 'Romans 8:28',
    '1 cor 13': '1 Corinthians 13',
    '1co13': '1 Corinthians 13',
    'I Corinthians 13': '1 Corinthians 13',
    'first corinthians 13': '1 Corinthians 13',
    '1st john 1:9': '1 John 1:9',
    'Matt. 5:3': 'Matthew 5:3',
    'ps119:105': 'Psalm 119:105',
    'jn 3:16-17': 'John 3:16-17',
    'song 2:1': 'Song of Solomon 2:1',
    'rev 21': 'Revelation 21',
  };
  for (const [typed, expected] of Object.entries(cases)) {
    assert.equal(normalize(typed), expected, `"${typed}"`);
  }
});

test('the two abbreviations a prefix search gets wrong are listed by hand', () => {
  // "Phil" is Philippians to every preacher alive, and a prefix search cannot
  // know that because Philemon starts the same way. Same for Jude/Judges.
  assert.equal(resolveBook('phil'), 'Philippians');
  assert.equal(resolveBook('phlm'), 'Philemon');
  assert.equal(resolveBook('jude'), 'Jude');
  assert.equal(resolveBook('judg'), 'Judges');
});

test('an ambiguous abbreviation resolves to nothing rather than to a guess', () => {
  // "jo" is John, Jonah, Joel, Job and Joshua. Sending a member to one of them
  // and looking certain about it is worse than leaving their own words alone.
  for (const ambiguous of ['jo', 'j', 'ma', 'e']) {
    assert.equal(resolveBook(ambiguous), null, `"${ambiguous}" should be ambiguous`);
  }
  assert.equal(normalize('jo 3:16'), 'jo 3:16');
  assert.equal(isReference('jo 3:16'), false);
});

test('what cannot be parsed is handed back untouched, never dropped', () => {
  for (const typed of ['the one about the sheep', 'gibberish', 'Ptr. Rodel’s text', '???']) {
    assert.equal(normalize(typed), typed);
  }
  assert.equal(normalize('   Romans 8   '), 'Romans 8');
  assert.equal(normalize(''), '');
  assert.equal(normalize(undefined), '');
});

test('a range keeps both of its ends', () => {
  assert.equal(normalize('gen 1:1-3'), 'Genesis 1:1-3');
  assert.equal(normalize('romans 8-9'), 'Romans 8-9');
  assert.equal(normalize('2 tim 3:16-17'), '2 Timothy 3:16-17');
});

test('a one-chapter book is cited by verse, the way it is read out', () => {
  // "Jude 20", not "Jude 20:—". Nobody says "Jude chapter one verse twenty".
  assert.equal(normalize('jude 20'), 'Jude 20');
  assert.equal(normalize('jude 20-21'), 'Jude 20-21');
  assert.equal(normalize('3 jn 4'), '3 John 4');
  assert.equal(normalize('phlm 6'), 'Philemon 6');
});

test('a book on its own is a reference too', () => {
  assert.deepEqual(parse('Philippians'), {
    book: 'Philippians', chapter: null, verse: null, verseEnd: null, ref: 'Philippians',
  });
});

// ── Dates ────────────────────────────────────────────────────────────────────

test('dates are spelled out here rather than left to the device', () => {
  // Every member sees the same thing, and a test can check it.
  assert.equal(dateLabel('2026-08-30'), 'Sunday, 30 August 2026');
  assert.equal(shortDate('2026-08-30'), '30 Aug');
  assert.equal(monthLabel('2026-08'), 'August 2026');
});

test('a date is never moved across a day boundary by a timezone', () => {
  assert.equal(daysBetween('2026-08-30', '2026-08-31'), 1);
  assert.equal(daysBetween('2026-08-31', '2026-08-30'), -1);
  assert.equal(daysBetween('2026-08-30', '2026-08-30'), 0);
  // Across a daylight-saving change, where a naive difference gives 0.96 days.
  assert.equal(daysBetween('2026-03-28', '2026-03-29'), 1);
  assert.equal(todayISO(new Date(2026, 7, 30, 23, 59)), '2026-08-30');
  assert.equal(todayISO(new Date(2026, 7, 30, 0, 1)), '2026-08-30');
});

test('how near a service is, in words', () => {
  assert.equal(relativeDay('2026-08-30', '2026-08-30'), 'Today');
  assert.equal(relativeDay('2026-08-31', '2026-08-30'), 'Tomorrow');
  assert.equal(relativeDay('2026-08-29', '2026-08-30'), 'Yesterday');
  assert.equal(relativeDay('2026-09-02', '2026-08-30'), 'In 3 days');
  assert.equal(relativeDay('2026-08-26', '2026-08-30'), '4 days ago');
  assert.equal(relativeDay('2026-06-01', '2026-08-30'), '');
});

// ── Services ─────────────────────────────────────────────────────────────────

const DATA = {
  meta: { serviceTimes: { Friday: '4:30 PM', Sunday: '6:30 PM' } },
  themes: { '2026-08': 'Free Topic' },
  workers: [
    { id: 'ptr-01', name: 'Rodel Cruz', title: 'Ptr.' },
    { id: 'sis-08', name: 'Sandra Gabriel', title: 'Sis.' },
  ],
  schedule: [
    { id: 'a', date: '2026-08-30', service: 'Sunday', roles: { preacher: 'sis-08' } },
    { id: 'b', date: '2026-08-21', service: 'Friday', roles: { preacher: 'ptr-01' } },
    { id: 'c', date: '2026-08-23', service: 'Sunday', roles: { preacher: 'nobody' } },
    { id: 'd', date: '2026-08-28', service: 'Friday', roles: {}, isSpecial: true, specialNote: 'Baptism' },
  ],
};

test('a schedule row becomes what a note needs to know', () => {
  const services = servicesFrom(DATA);
  assert.deepEqual(services.map((s) => s.id), [
    '2026-08-21|Friday', '2026-08-23|Sunday', '2026-08-28|Friday', '2026-08-30|Sunday',
  ]);

  const sunday = services[3];
  assert.equal(sunday.label, 'Sunday Service');
  assert.equal(sunday.time, '6:30 PM');
  assert.equal(sunday.theme, 'Free Topic');
  // A row names its preacher by worker id, which means nothing to a member
  // reading their notes a year later.
  assert.equal(sunday.preacher, 'Sis. Sandra Gabriel');
  assert.equal(services[1].preacher, '', 'an unknown worker id leaves the line off, it does not print the id');
  assert.equal(services[2].special, 'Baptism');
});

test('a schedule that is missing, empty or malformed gives no services rather than throwing', () => {
  for (const bad of [null, undefined, {}, { schedule: null }, { schedule: [{}] }]) {
    assert.deepEqual(servicesFrom(bad), []);
  }
});

test('the app opens on today’s service', () => {
  const services = servicesFrom(DATA);
  assert.equal(chooseService(services, '2026-08-23').id, '2026-08-23|Sunday');
});

test('for a few days afterwards it stays on the service just gone', () => {
  // Somebody opening this on Monday is finishing Sunday's notes, not starting
  // Friday's. That is the whole reason the grace window exists.
  const services = servicesFrom(DATA);
  assert.equal(chooseService(services, '2026-08-24').id, '2026-08-23|Sunday');
  assert.equal(chooseService(services, '2026-08-26').id, '2026-08-23|Sunday');
});

test('once the window has passed it looks forward instead', () => {
  const services = servicesFrom(DATA);
  assert.equal(chooseService(services, '2026-08-27').id, '2026-08-28|Friday');
});

test('past the end of the schedule it opens on the last service there was', () => {
  const services = servicesFrom(DATA);
  assert.equal(chooseService(services, '2027-01-01').id, '2026-08-30|Sunday');
  assert.equal(chooseService([], '2026-08-30'), null);
});

test('the switcher offers what is near, plus anything already written on', () => {
  const services = servicesFrom(DATA);
  const notes = { '2026-08-21|Friday': { body: 'written long ago' } };
  const near = switchableServices(services, '2026-08-30', notes, 3, 3);
  assert.ok(near.some((s) => s.id === '2026-08-21|Friday'),
    'a service with notes on it stays reachable however old it is');
  assert.deepEqual(near.map((s) => s.date), ['2026-08-30', '2026-08-28', '2026-08-21'],
    'newest first, and 2026-08-23 is out of range with nothing written on it');
});

// ── Bodies written by the older app ──────────────────────────────────────────

test('a contentEditable body reads as the text somebody actually wrote', () => {
  assert.equal(htmlToText('Line one<br><br>Two &amp; three'), 'Line one\n\nTwo & three');
  assert.equal(htmlToText('<div>a</div><div>b</div>'), 'a\nb',
    'one line break per line, not two — a body must not double in height each time it is read');
  assert.equal(htmlToText('<div>one</div><div><br></div><div>two</div>'), 'one\n\ntwo');
  assert.equal(htmlToText('<b>bold</b> and <i>italic</i>'), 'bold and italic');
  assert.equal(htmlToText('<ul><li>one</li><li>two</li></ul>'), '• one\n• two');
});

test('plain text is left exactly as it is', () => {
  const plain = 'God is faithful.\n\n1. He keeps his word\n2. He keeps us';
  assert.equal(looksLikeHtml(plain), false);
  assert.equal(htmlToText(plain), plain);
  assert.equal(htmlToText(''), '');
  assert.equal(htmlToText(undefined), '');
});

test('a note read out of storage has every field, whichever app wrote it', () => {
  const fromMembersApp = { title: 'Faith that works', body: 'a<br>b', updatedAt: '2026-08-23T10:00:00Z' };
  const note = readNote(fromMembersApp);
  assert.equal(note.title, 'Faith that works');
  assert.equal(note.body, 'a\nb');
  assert.deepEqual(note.verses, []);
  assert.equal(note.passage, '');
  assert.equal(note.takeaway, '');
  assert.equal(note.updatedAt, '2026-08-23T10:00:00Z', 'fields this app does not use survive the read');
  assert.deepEqual(readNote(null).verses, []);
});

test('an empty note is empty however many blank fields it has', () => {
  assert.equal(noteIsEmpty(null), true);
  assert.equal(noteIsEmpty({ title: '   ', body: '', verses: [] }), true);
  assert.equal(noteIsEmpty({ verses: ['John 3:16'] }), false);
  assert.equal(noteIsEmpty({ takeaway: 'Call Nanay' }), false);
});

test('a note without a title is summarised by the first thing written in it', () => {
  assert.equal(noteSummary({ title: 'Faith that works' }), 'Faith that works');
  assert.equal(noteSummary({ body: '\n\n  God is faithful.\nSecond line' }), 'God is faithful.');
  assert.equal(noteSummary({ passage: 'Romans 8' }), 'Romans 8');
  assert.equal(noteSummary({ verses: ['John 3:16'] }), 'John 3:16');
  assert.equal(noteSummary({}), 'Untitled');
});

// ── The list ─────────────────────────────────────────────────────────────────

const NOTES = {
  '2026-08-21|Friday': { title: 'Standing firm', body: 'Ephesians six', verses: ['Ephesians 6:10'] },
  '2026-08-23|Sunday': { title: 'Faith that works', body: 'James on works' },
  '2026-08-30|Sunday': { title: '', body: '' },
  '2026-08-25|journal-browse': { title: 'not a service', body: 'opened the journal' },
};

test('the list is newest first, and leaves out what nobody wrote', () => {
  const list = listNotes(NOTES, servicesFrom(DATA));
  assert.deepEqual(list.map((n) => n.id), ['2026-08-23|Sunday', '2026-08-21|Friday']);
  assert.equal(list[0].preacher, '', 'preacher comes from the schedule, not the note');
  assert.equal(list[1].preacher, 'Ptr. Rodel Cruz');
});

test('the journal browser’s id is not a note somebody wrote', () => {
  // index.html opens its journal on `<today>|journal-browse`. It is a screen,
  // not a service, and it must never show up as one.
  const list = listNotes(NOTES, servicesFrom(DATA));
  assert.equal(list.some((n) => n.service === 'journal-browse'), false);
});

test('a note outlives its schedule row', () => {
  // A note is the member's, not the schedule's: a row edited away years later
  // must not take somebody's notes with it.
  const list = listNotes({ '2019-01-06|Sunday': { title: 'An old one' } }, servicesFrom(DATA));
  assert.equal(list.length, 1);
  assert.equal(list[0].label, 'Sunday Service');
  assert.equal(list[0].date, '2019-01-06');
});

test('search matches every word, anywhere in the note', () => {
  const list = listNotes(NOTES, servicesFrom(DATA));
  assert.equal(searchNotes(list, '').length, 2);
  assert.deepEqual(searchNotes(list, 'james').map((n) => n.id), ['2026-08-23|Sunday']);
  assert.deepEqual(searchNotes(list, 'rodel').map((n) => n.id), ['2026-08-21|Friday'],
    'the preacher is searchable even though the member never typed the name');
  assert.deepEqual(searchNotes(list, 'ephesians standing').map((n) => n.id), ['2026-08-21|Friday'],
    'two words, one in the title and one in a verse');
  assert.deepEqual(searchNotes(list, 'james ephesians'), []);
});

test('notes group into the months they were taken in', () => {
  const groups = groupByMonth(listNotes({
    '2026-08-23|Sunday': { title: 'August one' },
    '2026-07-05|Sunday': { title: 'July one' },
    '2026-07-03|Friday': { title: 'July two' },
  }, []));
  assert.deepEqual(groups.map((g) => [g.label, g.notes.length]), [['August 2026', 1], ['July 2026', 2]]);
});

// ── Sharing ──────────────────────────────────────────────────────────────────

test('a shared note carries nothing the member did not write', () => {
  const service = servicesFrom(DATA)[3];
  const text = noteToText({ title: 'Faith that works', body: 'God is faithful.' }, service, 'FLCC - Abundance Church');
  assert.match(text, /^Faith that works\n/);
  assert.match(text, /Sunday, 30 August 2026 · Sunday Service/);
  assert.match(text, /Preaching: Sis\. Sandra Gabriel/);
  assert.match(text, /God is faithful\./);
  // No headings over sections that are empty.
  assert.equal(/Passage:/.test(text), false);
  assert.equal(/Verses:/.test(text), false);
  assert.equal(/This week:/.test(text), false);
});

test('a shared note includes the parts that were filled in', () => {
  const service = servicesFrom(DATA)[3];
  const text = noteToText({
    body: 'God is faithful.', passage: 'James 2', verses: ['James 2:14', 'Romans 8:28'], takeaway: 'Call Nanay',
  }, service, 'FLCC - Abundance Church');
  assert.match(text, /Passage: James 2/);
  assert.match(text, /Verses: James 2:14, Romans 8:28/);
  assert.match(text, /This week: Call Nanay/);
});

// ── One set of notes, two doors ──────────────────────────────────────────────

const { makeNoteId } = load('index.html', ['makeNoteId']);

test('both apps build the same note id', () => {
  // This is the whole promise: a note taken in the members app opens here, and
  // one taken here opens there. It holds only while the ids agree.
  for (const [date, service] of [['2026-08-30', 'Sunday'], ['2026-08-21', 'Friday']]) {
    assert.equal(noteId(date, service), makeNoteId(date, service));
  }
  assert.deepEqual(parseNoteId('2026-08-30|Sunday'), { date: '2026-08-30', service: 'Sunday' });
});

test('both apps read the same storage key', () => {
  const app = appSource('index.html');
  assert.match(app, /SERMON_NOTES_STORE_KEY = CHURCH\.key\('flcc-sermon-notes-v1'\)/,
    'the members app no longer stores notes where Sermon Notes looks for them');
  assert.match(readRepoFile('sermon-notes/js/storage.js'), /NOTES_KEY = 'flcc-sermon-notes-v1'/);
});

test('the Home card counts notes the same way the list does', () => {
  // The card on Home and the list inside the app must not disagree about how
  // many notes somebody has — including about the journal browser's id.
  const app = appSource('index.html');
  assert.match(app, /journal-browse/, 'the Home card must still exclude the journal browser id');
  assert.match(app, /sermon-notes\/index\.html/, 'the Home card must still point at the app');
});

test('every church’s data.json reads as services, published or not', () => {
  // 14 churches share these files, so a shape that only holds for Abundance is
  // a bug the other thirteen find first. Most of them have not published a
  // schedule yet — an empty list is a real answer, and the app has a screen
  // for it; what must not happen is a throw or a half-built service.
  let withSchedules = 0;
  for (const church of FLCC.churches) {
    const file = FLCC.dataFor(church.slug, 'data.json').replace(/^\.\//, '');
    if (!exists(file)) continue;
    const services = servicesFrom(readRepoJSON(file));
    if (!services.length) {
      assert.equal(chooseService(services, todayISO()), null, `${church.slug}: nothing to open on`);
      continue;
    }
    withSchedules++;
    for (const service of services) {
      assert.match(service.date, /^\d{4}-\d{2}-\d{2}$/, `${church.slug}: ${service.id}`);
      assert.equal(service.id, noteId(service.date, service.service));
      assert.ok(service.label.trim(), `${church.slug}: ${service.id} has no label`);
    }
    assert.ok(chooseService(services, todayISO()), `${church.slug}: nothing to open on`);
  }
  assert.ok(withSchedules >= 1, 'no church in the network has a published schedule to open on');
});

test('a church that has not published a schedule is a state, not a failure', () => {
  // Thirteen of the fourteen are in exactly this position today, so the app
  // has to say so rather than claim the schedule would not load.
  const html = readRepoFile('sermon-notes/index.html');
  assert.match(html, /id="state-empty"/,
    'sermon-notes/index.html needs its own screen for a church with no schedule yet');
  assert.match(readRepoFile('sermon-notes/js/app.js'), /state-empty/);
});
