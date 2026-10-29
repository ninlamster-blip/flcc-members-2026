/**
 * Sermons: the public page (sermons.html), the editor (sermon-editor.html) and
 * the rules they share (sermons.js).
 *
 * The rule most worth defending is which videos play where. YouTube ones play
 * in the page; Facebook ones open on Facebook, because Facebook refuses to
 * play a video on another site once it hears music it thinks someone else owns
 * — the worship set, so nearly every service — and the first real sermon came
 * up as "Video unavailable". Nothing about that looks wrong until a visitor
 * taps play.
 *
 * Run: node --test 'test/*.test.mjs'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { loadChurch, readRepoFile, readRepoJSON, exists, appSource } from './lib/extract.mjs';

const win = {};
new Function('window', readRepoFile('sermons.js'))(win);
const S = win.FLCCSermons;
const CHURCHES = loadChurch().churches;

const GOOD = {
  id: '2026-10-25-walking-in-faith',
  date: '2026-10-25',
  title: 'Walking in Faith',
  preacher: 'Ptr. Rodel',
  summary: 'Faith is a daily walk, not a single step.',
  video: 'https://www.facebook.com/flccabundance/videos/1234567890123456/',
};

// ── The Facebook link ────────────────────────────────────────────────────────

test('a full Facebook video link is accepted and cleaned up', () => {
  for (const [input, href] of [
    ['https://www.facebook.com/flccabundance/videos/1234567890/', 'https://www.facebook.com/flccabundance/videos/1234567890/'],
    ['https://m.facebook.com/flccabundance/videos/1234567890?mibextid=abc', 'https://www.facebook.com/flccabundance/videos/1234567890/'],
    ['facebook.com/flccabundance/videos/sunday-service/1234567890', 'https://www.facebook.com/flccabundance/videos/sunday-service/1234567890/'],
    ['https://web.facebook.com/watch/?v=1234567890', 'https://www.facebook.com/watch/?v=1234567890'],
    ['https://www.facebook.com/watch?v=1234567890&ref=sharing', 'https://www.facebook.com/watch/?v=1234567890'],
    ['https://www.facebook.com/video.php?v=1234567890', 'https://www.facebook.com/watch/?v=1234567890'],
    ['https://www.facebook.com/reel/1234567890', 'https://www.facebook.com/reel/1234567890/'],
    ['  https://www.facebook.com/flccabundance/videos/1234567890/  ', 'https://www.facebook.com/flccabundance/videos/1234567890/'],
  ]) {
    const v = S.facebookVideo(input);
    assert.equal(v.ok, true, input);
    assert.equal(v.href, href, input);
  }
});

test("Facebook's whole Embed code can be pasted and the link is pulled out of it", () => {
  const code = '<iframe src="https://www.facebook.com/plugins/video.php?height=314&href=https%3A%2F%2Fwww.facebook.com%2Fflccabundance%2Fvideos%2F1234567890%2F&show_text=false&width=560&t=0" width="560" height="314" style="border:none;overflow:hidden" scrolling="no" frameborder="0" allowfullscreen="true"></iframe>';
  const v = S.facebookVideo(code);
  assert.equal(v.ok, true);
  assert.equal(v.href, 'https://www.facebook.com/flccabundance/videos/1234567890/');
});

test("the Share button's short links are accepted as they are", () => {
  // They open on Facebook as well as the full ones do, and the page only ever
  // opens a video on Facebook — so there is nothing to warn about.
  for (const input of [
    'https://fb.watch/abCD12_xy/',
    'https://www.facebook.com/share/v/1AbCdEfGh/',
    'https://www.facebook.com/share/r/1AbCdEfGh/',
  ]) {
    const v = S.facebookVideo(input);
    assert.equal(v.ok, true, input);
    assert.equal(v.href, input, input);
  }
});

test('anything that is not a Facebook video is refused with a reason', () => {
  for (const input of [
    '',
    'not a link at all',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.facebook.com/flccabundance',
    'https://www.facebook.com/flccabundance/posts/123',
    'https://facebook.com.evil.example/flcc/videos/123',
    'javascript:alert(1)',
  ]) {
    const v = S.facebookVideo(input);
    assert.equal(v.ok, false, `${JSON.stringify(input)} must be refused`);
    assert.ok(v.error, `${JSON.stringify(input)} needs a reason a person can act on`);
  }
});

test("the public page never embeds Facebook's player — only YouTube's", () => {
  // The Facebook player answered "Video unavailable … content owned by someone
  // else" for the first real sermon, because of the worship music.
  const src = readRepoFile('sermons.html').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.equal(/plugins\/video\.php|<iframe/.exec(src), null, 'no Facebook player, no hand-written iframe');
  const frames = [...src.matchAll(/el\('iframe', \{\s*src: ([^,]+),/g)].map(m => m[1].trim());
  assert.deepEqual(frames, ['S.youtubeEmbedUrl(v.id)'], 'the one player is YouTube’s');
  assert.match(src, /el\('a', \{\s*class: 'poster', href: links\.facebook\.href, target: '_blank'/, 'a Facebook-only sermon links out');
});

test("the members app's Home card follows the same rule", () => {
  const src = appSource('index.html');
  const card = src.slice(src.indexOf('function LatestSermonCard('), src.indexOf('function BOTRScheduleCard('));
  assert.ok(card.length > 0, 'LatestSermonCard must sit just above BOTRScheduleCard');
  assert.equal(/plugins\/video\.php/.exec(card), null);
  const frames = [...card.matchAll(/<iframe src=\{([^}]+)\}/g)].map(m => m[1]);
  assert.deepEqual(frames, ['S.youtubeEmbedUrl(v.id)']);
  assert.match(card, /CHURCH\.data\('sermons\.json'\)/, 'reads this church’s list through FLCC');
  assert.match(readRepoFile('index.html'), /<script src="\.\/sermons\.js"><\/script>/);
});

// ── YouTube ──────────────────────────────────────────────────────────────────

test('every shape of YouTube link comes back as its video id', () => {
  for (const input of [
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=42s&list=PL123',
    'https://youtu.be/dQw4w9WgXcQ?si=AbCdEf',
    'youtu.be/dQw4w9WgXcQ',
    'https://m.youtube.com/watch?v=dQw4w9WgXcQ',
    'https://www.youtube.com/live/dQw4w9WgXcQ?feature=shared',
    'https://youtube.com/shorts/dQw4w9WgXcQ',
    'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ',
    '<iframe width="560" height="315" src="https://www.youtube.com/embed/dQw4w9WgXcQ?si=x" title="YouTube video player" allowfullscreen></iframe>',
  ]) {
    const v = S.sermonVideo(input);
    assert.equal(v.ok, true, input);
    assert.equal(v.source, 'youtube', input);
    assert.equal(v.id, 'dQw4w9WgXcQ', input);
    assert.equal(v.href, 'https://www.youtube.com/watch?v=dQw4w9WgXcQ', input);
  }
});

test('a YouTube link that is not one video is refused with a reason', () => {
  for (const input of [
    'https://www.youtube.com/@flccchurch',
    'https://www.youtube.com/channel/UC123',
    'https://www.youtube.com/watch?v=short',
    'https://www.youtube.com/playlist?list=PL123',
    'https://youtube.com.evil.example/watch?v=dQw4w9WgXcQ',
  ]) {
    const v = S.sermonVideo(input);
    assert.equal(v.ok, false, input);
    assert.ok(v.error, input);
  }
});

test('Facebook links still work, and are marked to open on Facebook', () => {
  const v = S.sermonVideo('https://www.facebook.com/share/v/19vr6qa5ro/?mibextid=wwXIfr');
  assert.deepEqual(v, { ok: true, source: 'facebook', href: 'https://www.facebook.com/share/v/19vr6qa5ro/' });
  assert.equal(S.sermonVideo('https://example.com/video.mp4').ok, false);
});

test("YouTube's player and thumbnail addresses are built from the id alone", () => {
  assert.equal(S.youtubeEmbedUrl('dQw4w9WgXcQ'), 'https://www.youtube-nocookie.com/embed/dQw4w9WgXcQ?autoplay=1&rel=0&playsinline=1');
  assert.equal(S.youtubeThumb('dQw4w9WgXcQ'), 'https://i.ytimg.com/vi/dQw4w9WgXcQ/hqdefault.jpg');
});

test('a sermon with a YouTube video is publishable', () => {
  assert.deepEqual(S.sermonProblems({ ...GOOD, video: 'https://youtu.be/dQw4w9WgXcQ' }), []);
});

// ── One sermon ───────────────────────────────────────────────────────────────

test('a complete sermon has no problems', () => {
  assert.deepEqual(S.sermonProblems(GOOD), []);
});

test('each missing field is named', () => {
  for (const field of ['title', 'preacher', 'summary', 'date', 'video']) {
    const problems = S.sermonProblems({ ...GOOD, [field]: '   ' });
    assert.equal(problems.length, 1, `blank ${field} should be exactly one problem`);
  }
});

test('a date must be a real day', () => {
  assert.equal(S.validDate('2026-10-25'), true);
  for (const bad of ['2026-02-30', '2026-13-01', '25/10/2026', '', undefined]) {
    assert.equal(S.validDate(bad), false, String(bad));
  }
});

test('a real date stays valid east of Greenwich', () => {
  // A local midnight read back as UTC is the previous day in Kuwait (UTC+3),
  // which would have rejected every date entered there.
  const prev = process.env.TZ;
  process.env.TZ = 'Asia/Kuwait';
  try {
    const w = {};
    new Function('window', readRepoFile('sermons.js'))(w);
    assert.equal(w.FLCCSermons.validDate('2026-10-25'), true);
  } finally {
    if (prev === undefined) delete process.env.TZ; else process.env.TZ = prev;
  }
});

// ── The list ─────────────────────────────────────────────────────────────────

test('newest first; the same day keeps the order it was added in', () => {
  const list = [
    { id: 'a', date: '2026-10-11' },
    { id: 'b', date: '2026-10-25' },
    { id: 'c', date: '2026-10-18' },
    { id: 'd', date: '2026-10-25' },
  ];
  assert.deepEqual(S.sortSermons(list).map(s => s.id), ['b', 'd', 'c', 'a']);
  assert.deepEqual(list.map(s => s.id), ['a', 'b', 'c', 'd'], 'sorting must not reorder the original');
});

test('ids come from the date and title and never collide', () => {
  assert.equal(S.sermonId('2026-10-25', 'Walking in Faith!', []), '2026-10-25-walking-in-faith');
  assert.equal(S.sermonId('2026-10-25', 'Walking in Faith', ['2026-10-25-walking-in-faith']), '2026-10-25-walking-in-faith-2');
  assert.equal(S.sermonId('2026-10-25', 'Pagpapala', []), '2026-10-25-pagpapala');
  assert.equal(S.sermonId('2026-10-25', '🙏', []), '2026-10-25-sermon');
});

test('a missing or malformed file reads as an empty list', () => {
  assert.deepEqual(S.readSermonsFile(null), []);
  assert.deepEqual(S.readSermonsFile({}), []);
  assert.deepEqual(S.readSermonsFile({ sermons: 'oops' }), []);
  assert.deepEqual(S.readSermonsFile({ sermons: [null, GOOD, 3] }), [GOOD]);
});

test('search matches every word, across title, preacher and summary', () => {
  assert.equal(S.matchesSearch(GOOD, ''), true);
  assert.equal(S.matchesSearch(GOOD, 'faith rodel'), true);
  assert.equal(S.matchesSearch(GOOD, 'DAILY walk'), true);
  assert.equal(S.matchesSearch(GOOD, 'faith grace'), false);
});

// ── The church schedule fills in the preacher ────────────────────────────────

const DATA = {
  workers: [
    { id: 'ptr-01', title: 'Ptr.', name: 'Rodel Cruz', eligibleRoles: ['preacher'], status: 'active' },
    { id: 'ptr-02', title: 'Ptra.', name: 'Weng Calisagan', eligibleRoles: ['preacher', 'pastoralPrayer'], status: 'active' },
    { id: 'ptr-03', title: 'Ptr.', name: 'Retired One', eligibleRoles: ['preacher'], status: 'inactive' },
    { id: 'sis-01', title: 'Sis.', name: 'Bless', eligibleRoles: ['presider'], status: 'active' },
  ],
  schedule: [
    { date: '2026-10-23', service: 'Friday', roles: { preacher: 'ptr-01' } },
    { date: '2026-10-25', service: 'Sunday', roles: { preacher: 'ptr-02' } },
    { date: '2026-10-30', service: 'Friday', roles: { preacher: 'ptr-01' } },
    { date: '2026-10-30', service: 'Evening', roles: { preacher: 'ptr-02' } },
    { date: '2026-11-01', service: 'Sunday', roles: {} },
  ],
};

test("the schedule's preacher for a date is suggested by full name", () => {
  assert.equal(S.scheduledPreacher(DATA, '2026-10-23'), 'Ptr. Rodel Cruz');
  assert.equal(S.scheduledPreacher(DATA, '2026-10-25'), 'Ptra. Weng Calisagan');
});

test('no guess when nobody, or more than one person, preached that day', () => {
  assert.equal(S.scheduledPreacher(DATA, '2026-11-01'), '');
  assert.equal(S.scheduledPreacher(DATA, '2026-12-25'), '');
  assert.equal(S.scheduledPreacher(DATA, '2026-10-30'), '');
  assert.equal(S.scheduledPreacher(null, '2026-10-23'), '');
});

test('preacher suggestions: active preachers, then past sermons, no repeats', () => {
  const names = S.preacherSuggestions(DATA, [{ preacher: 'Ptr. Rodel Cruz' }, { preacher: 'Bishop Guest' }]);
  assert.deepEqual(names, ['Ptr. Rodel Cruz', 'Ptra. Weng Calisagan', 'Bishop Guest']);
});

// ── The files ────────────────────────────────────────────────────────────────

test('every sermons.json that exists is publishable as written', () => {
  // A hand-edited entry with a field missing is hidden from the public page
  // rather than shown half empty — this catches it before anyone wonders why.
  const files = ['sermons.json', ...CHURCHES.map(c => `churches/${c.slug}/sermons.json`), 'churches/_template/sermons.json'];
  for (const file of files.filter(exists)) {
    const json = readRepoJSON(file);
    assert.ok(Array.isArray(json.sermons), `${file}: needs a "sermons" list`);
    const ids = new Set();
    for (const s of json.sermons) {
      assert.deepEqual(S.sermonProblems(s), [], `${file}: "${s.title}"`);
      assert.ok(s.id && !ids.has(s.id), `${file}: "${s.title}" needs an id of its own`);
      ids.add(s.id);
    }
  }
});

test('both pages read the list through FLCC and share one set of rules', () => {
  for (const page of ['sermons.html', 'sermon-editor.html']) {
    const src = readRepoFile(page);
    assert.match(src, /<script src="\.\/church\.js"><\/script>/, `${page} must load church.js`);
    assert.match(src, /<script src="\.\/sermons\.js"><\/script>/, `${page} must load sermons.js, not its own copy of the rules`);
    assert.match(src, /CHURCH\.data\('sermons\.json'\)/, `${page} must read CHURCH.data('sermons.json')`);
    assert.equal(/function facebookVideo/.exec(src), null, `${page} must not grow its own link parser`);
  }
});

test('the editor can only write its own church\'s sermons file', () => {
  const src = appSource('sermon-editor.html');
  assert.match(src, /const GH_FILE = CHURCH\.publishPath\('sermons\.json'\);/);
  const puts = [...src.matchAll(/method:'PUT'/g)];
  assert.equal(puts.length, 1, 'one write, to GH_FILE');
});

test('the public page never puts typed text in as HTML', () => {
  // Every word on it was typed by a person; one stray "<" would break it, and
  // worse is possible. Text goes in through textContent only.
  const src = readRepoFile('sermons.html');
  const html = [...src.matchAll(/\.innerHTML\s*=\s*([^;]+);/g)].map(m => m[1].trim());
  for (const value of html) {
    assert.equal(value, 'PLAY_ICON', `innerHTML may only hold the fixed play icon, not ${value}`);
  }
  assert.match(src, /var PLAY_ICON = '<svg[^']*';/, 'and the play icon is a fixed string');
});

test("the members app's Watch tab frames this church's sermons page", () => {
  // One list, kept in one place: the tab is sermons.html in a frame, not a copy.
  const src = appSource('index.html');
  assert.match(src, /\{ key: 'watch',\s+label: '[^']*Watch' \}/, 'Watch is in the tab bar');
  assert.match(src, /currentTab === 'watch' && <WatchTab \/>/);
  const tab = src.slice(src.indexOf('function WatchTab('), src.indexOf('function WWLTab('));
  assert.match(tab, /src=\{CHURCH\.url\('sermons\.html\?embed=1'\)\}/, 'the current church, in embed mode');
  assert.match(tab, /e\.origin !== window\.location\.origin/, 'only our own page may size the frame');
  assert.match(src, /<LatestSermonCard onOpenAll=\{\(\) => setActiveTab\('watch'\)\} \/>/, 'Home’s "All sermons" opens it');
});

test('embed mode is opt-in and only tells our own origin its height', () => {
  const src = readRepoFile('sermons.html');
  assert.match(src, /get\('embed'\) === '1' && window\.parent !== window/);
  assert.match(src, /postMessage\(\{ flccSermons: 'height', h: [^}]+\}, location\.origin\)/);
});

// ── Both links ───────────────────────────────────────────────────────────────

const YT = 'https://youtu.be/dQw4w9WgXcQ?si=x';
const FB = 'https://www.facebook.com/share/v/19vr6qa5ro/?mibextid=wwXIfr';

test('a sermon can carry a YouTube link, a Facebook link, or both', () => {
  const both = S.sermonLinks({ youtube: YT, facebook: FB });
  assert.deepEqual(both, {
    youtube: { id: 'dQw4w9WgXcQ', href: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
    facebook: { href: 'https://www.facebook.com/share/v/19vr6qa5ro/' },
    problems: [],
  });
  assert.deepEqual(S.sermonProblems({ ...GOOD, video: undefined, youtube: YT }), []);
  assert.deepEqual(S.sermonProblems({ ...GOOD, video: undefined, facebook: FB }), []);
  assert.deepEqual(S.sermonProblems({ ...GOOD, video: undefined, youtube: YT, facebook: FB }), []);
});

test('a sermon with neither link is not publishable', () => {
  assert.deepEqual(S.sermonProblems({ ...GOOD, video: undefined }), ['Paste the YouTube or Facebook link — or both.']);
});

test('a link in the wrong box is named by its box', () => {
  assert.deepEqual(S.sermonLinks({ youtube: FB }).problems, ['YouTube box: That isn’t a YouTube link.']);
  assert.deepEqual(S.sermonLinks({ facebook: YT }).problems, ['Facebook box: That isn’t a Facebook link.']);
});

test('entries from before the two boxes still read, from their single "video" field', () => {
  assert.equal(S.sermonLinks({ video: FB }).facebook.href, 'https://www.facebook.com/share/v/19vr6qa5ro/');
  assert.equal(S.sermonLinks({ video: YT }).youtube.id, 'dQw4w9WgXcQ');
  // A box filled in later wins over the old field.
  assert.equal(S.sermonLinks({ video: 'https://youtu.be/AAAAAAAAAAA', youtube: YT }).youtube.id, 'dQw4w9WgXcQ');
});

test('the editor writes the two boxes and drops the old field when an entry is saved', () => {
  const src = appSource('sermon-editor.html');
  assert.match(src, /if\(links\.youtube\)  clean\.youtube=links\.youtube\.href;/);
  assert.match(src, /if\(links\.facebook\) clean\.facebook=links\.facebook\.href;/);
  assert.match(src, /s\.id===editingId\?\{id:s\.id,\.\.\.clean\}:s/, 'rebuilt, not merged, so an emptied box removes its link');
  assert.equal(/video:/.exec(src), null, 'nothing writes the old single field');
});
