// The authored writing.
//
// Nothing under content/ is code, so nothing under content/ gets checked by a
// browser until a reader opens the screen it broke. This suite is the review:
// every file's shape, every accent that must exist in the stylesheet, and the
// cross-references between files that a reviewer reading one file at a time
// cannot see.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { SEASONS, FOCUS } from '../js/core/profile.js';
import { isIcon, ICONS } from '../js/core/art.js';

const read = (path) => JSON.parse(readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8'));
const css = readFileSync(new URL('../css/next.css', import.meta.url), 'utf8');

/** The palette, taken from the stylesheet rather than restated here. */
const TONES = [...css.matchAll(/^\s{2}--([a-z-]+):\s+#[0-9A-F]{6};/gmi)].map((one) => one[1]);

const isText = (value, min = 1) => typeof value === 'string' && value.trim().length >= min;

/** A card colour, and a character that somebody actually drew. */
function looksRight(item, where) {
  assert.ok(ACCENTS.includes(item.tone), `${where}: unknown tone "${item.tone}"`);
  if ('symbol' in item) {
    assert.ok(isIcon(item.symbol),
      `${where}: no icon called "${item.symbol}" — the set is ${ICONS.join(', ')}`);
  }
}

/** The colours a poster may wear. `navy` is the content files' name for ink. */
const CARD_TONES = ['sky', 'rose', 'sunshine', 'captain', 'navy', 'poppy', 'paper'];
/** Everything a tone field may name. */
const ACCENTS = [...CARD_TONES];
/** Which files' tone ends up as a whole block of colour. */
const ON_CARDS = ['moments.json', 'paths.json', 'prayer-guides.json', 'reading-plans.json',
                  'events.json', 'messages.json', 'prayer-categories.json'];

/**
 * The six colours, pinned.
 *
 * `flcc-next/` wears the same six so the two editions read as one family, and
 * the two apps share no code — which means nothing but a test stops one of
 * them drifting a shade at a time. The kids edition has the matching block in
 * its own suite.
 *
 * The paper each app sits on is deliberately NOT shared. The kids edition is
 * warm cream because its posters are full-bleed colour; this one is a cooler
 * near-white because its surfaces are white cards, and a warm ground behind
 * white paper reads as a stain rather than as a choice.
 */
test('the six shared colours are exactly these', () => {
  const shared = {
    sky: '#C3D7EA', captain: '#4173B0', rose: '#EABCB5',
    poppy: '#EB8861', sunshine: '#EDCE7A',
  };
  for (const [name, hex] of Object.entries(shared)) {
    assert.match(css, new RegExp(`--${name}:\\s*${hex};`, 'i'),
      `--${name} should be ${hex} — and flcc-next/css/next.css must match`);
  }
  // The paper and the ink are shared too, now that both editions are drawn in
  // one system. `design.test.mjs` compares them against the kids edition
  // directly; these pin them so that "both moved together" still fails.
  assert.match(css, /--paper:\s*#FBF8F0;/i, 'both editions sit on the same cream paper');
  assert.match(css, /--ink:\s*#2B4C6D;/i, 'navy is the only ink');
});

test('the palette is the one the stylesheet defines', () => {
  for (const tone of ['paper', 'ink', 'sky', 'captain', 'rose', 'poppy', 'sunshine']) {
    assert.ok(TONES.includes(tone) || css.includes(`--${tone}:`), `--${tone} is missing from next.css`);
  }
});

/**
 * Poppy is an accent, never a poster.
 *
 * Navy on poppy is about 3.5:1, which is fine behind a headline and not fine
 * behind a paragraph — and a poster is mostly paragraphs. The kids edition
 * keeps poppy out of its poster tones for the same reason. Where a content
 * file names it anyway the screens quietly substitute rose, but a file that
 * relies on that is a file whose author did not get what they asked for, so
 * the ones that become whole blocks of colour are checked here.
 */
test('a content colour is one the poster system can actually paint', () => {
  for (const name of ON_CARDS) {
    for (const item of read(name)) {
      assert.ok(CARD_TONES.includes(item.tone),
        `${name}/${item.id}: "${item.tone}" is not a colour — pick one of ${CARD_TONES.join(', ')}`);
      assert.notEqual(item.tone, 'poppy',
        `${name}/${item.id}: poppy cannot carry a poster — navy on poppy is about 3.5:1`);
    }
  }
});

test('every poster colour is one the stylesheet can paint', () => {
  for (const tone of ['sunshine', 'rose', 'sky', 'captain', 'ink', 'paper']) {
    assert.match(css, new RegExp(`\\.poster\\[data-tone="${tone}"\\]`),
      `.poster[data-tone="${tone}"] is not styled`);
  }
});

test('every Scripture moment is complete, and in an adult voice', () => {
  const moments = read('moments.json');
  assert.ok(moments.length >= 14, 'a fortnight is the floor — a bank that runs dry in a week is repetitive');
  const ids = new Set();
  for (const one of moments) {
    assert.ok(isText(one.id), `moment without an id`);
    assert.equal(ids.has(one.id), false, `duplicate moment id ${one.id}`);
    ids.add(one.id);
    for (const field of ['ref', 'text', 'translation', 'theme', 'reflection', 'question', 'prayer', 'practice']) {
      assert.ok(isText(one[field], 3), `${one.id}: ${field} is missing`);
    }
    looksRight(one, `moments/${one.id}`);
    assert.ok(isText(one.symbol), `${one.id}: every moment names its character`);
    assert.match(one.question, /\?$/, `${one.id}: the question should be a question`);
    assert.ok(one.reflection.length >= 120, `${one.id}: the reflection is too thin to be worth reading`);
    assert.equal('kids' in one || 'teens' in one, false, `${one.id}: this app has one audience`);
  }
});

test('every path is complete, and says truthfully how long it is', () => {
  const paths = read('paths.json');
  assert.ok(paths.length >= 3);
  assert.equal(paths.filter((one) => one.featured).length, 1, 'exactly one path is featured, or none is');
  for (const path of paths) {
    for (const field of ['id', 'title', 'kicker', 'blurb', 'minutes']) {
      assert.ok(isText(path[field]), `${path.id}: ${field} is missing`);
    }
    looksRight(path, `paths/${path.id}`);
    for (const season of path.forSeason || []) {
      assert.ok(SEASONS.some((one) => one.id === season), `${path.id}: unknown season ${season}`);
    }
    for (const focus of path.forFocus || []) {
      assert.ok(FOCUS.some((one) => one.id === focus), `${path.id}: unknown focus ${focus}`);
    }
    const sessions = read(`paths/${path.id}.json`);
    assert.equal(sessions.length, path.sessions,
      `${path.id}: says ${path.sessions} sessions and has ${sessions.length}`);
  }
});

test('every session is a passage, a reading, a question, a practice and a prayer', () => {
  const files = readdirSync(new URL('../content/paths/', import.meta.url));
  assert.ok(files.length >= 3);
  for (const file of files) {
    const sessions = read(`paths/${file}`);
    const ids = new Set();
    for (const one of sessions) {
      assert.equal(ids.has(one.id), false, `${file}: duplicate session id ${one.id}`);
      ids.add(one.id);
      assert.ok(isText(one.id), `${file}: a session without an id`);
      for (const field of ['title', 'ref', 'text', 'question', 'practice', 'prayer']) {
        assert.ok(isText(one[field], 3), `${file}/${one.id}: ${field} is missing`);
      }
      assert.ok(Array.isArray(one.body) && one.body.length >= 2, `${file}/${one.id}: needs at least two paragraphs`);
      // A short closing line is good writing; a session that is all short
      // lines is a stub. So the floor is on the session, not the sentence.
      for (const paragraph of one.body) assert.ok(isText(paragraph, 24), `${file}/${one.id}: an empty paragraph`);
      assert.ok(one.body.join(' ').length >= 400, `${file}/${one.id}: too thin to be a session`);
      assert.match(one.question, /\?$/, `${file}/${one.id}: the question should be a question`);
    }
  }
});

test('every prayer guide is a sequence of timed steps', () => {
  const guides = read('prayer-guides.json');
  assert.ok(guides.length >= 4);
  for (const guide of guides) {
    for (const field of ['id', 'title', 'line']) assert.ok(isText(guide[field]), `${guide.id}: ${field} is missing`);
    looksRight(guide, `guides/${guide.id}`);
    assert.ok(guide.steps.length >= 3, `${guide.id}: a guide with two steps is a sentence`);
    for (const step of guide.steps) {
      assert.ok(isText(step.label), `${guide.id}: a step without a label`);
      assert.ok(isText(step.prompt, 20), `${guide.id}/${step.label}: the prompt is too thin`);
      assert.ok(step.seconds >= 30 && step.seconds <= 300, `${guide.id}/${step.label}: ${step.seconds}s is not a step`);
    }
    const minutes = guide.steps.reduce((sum, step) => sum + step.seconds, 0) / 60;
    assert.ok(minutes <= 12, `${guide.id}: ${Math.round(minutes)} minutes is not "a few"`);
  }
});

test('the prayer categories cover the default the code writes', () => {
  const categories = read('prayer-categories.json');
  const ids = categories.map((one) => one.id);
  assert.ok(ids.includes('personal'), 'prayers.js files an uncategorised prayer under "personal"');
  for (const one of categories) {
    assert.ok(isText(one.label) && isText(one.line), `${one.id}: incomplete`);
    looksRight(one, `categories/${one.id}`);
  }
  assert.equal(new Set(ids).size, ids.length, 'duplicate category');
});

test('a reading plan is long enough to be a habit and short enough to finish', () => {
  const plans = read('reading-plans.json');
  assert.ok(plans.length >= 2);
  for (const plan of plans) {
    for (const field of ['id', 'title', 'kicker', 'blurb']) assert.ok(isText(plan[field]), `${plan.id}: ${field}`);
    looksRight(plan, `plans/${plan.id}`);
    assert.ok(plan.days.length >= 7, `${plan.id}: a plan shorter than a week is a suggestion`);
    assert.ok(plan.days.length <= 60, `${plan.id}: ${plan.days.length} days is a plan most people abandon`);
    for (const [i, day] of plan.days.entries()) {
      assert.ok(isText(day.ref), `${plan.id} day ${i + 1}: no reference`);
      assert.ok(isText(day.note, 10), `${plan.id} day ${i + 1}: no note`);
    }
  }
});

test('what comes from church is dated, attributed and readable', () => {
  for (const one of read('updates.json')) {
    for (const field of ['id', 'title', 'from', 'body']) assert.ok(isText(one[field]), `${one.id}: ${field}`);
    assert.match(one.date, /^\d{4}-\d{2}-\d{2}$/, `${one.id}: ${one.date} is not a date`);
    assert.ok(!Number.isNaN(Date.parse(one.date)), `${one.id}: ${one.date} is not a real date`);
    looksRight(one, `updates/${one.id}`);
  }
  for (const one of read('events.json')) {
    for (const field of ['id', 'title', 'when', 'where', 'blurb']) assert.ok(isText(one[field]), `${one.id}: ${field}`);
    looksRight(one, `events/${one.id}`);
  }
  for (const one of read('ministries.json')) {
    for (const field of ['id', 'title', 'commitment', 'blurb']) assert.ok(isText(one[field]), `${one.id}: ${field}`);
    looksRight(one, `ministries/${one.id}`);
    assert.equal(typeof one.needs, 'boolean', `${one.id}: needs must be true or false`);
  }
});

test('nothing in the content still names a colour from the old palette', () => {
  // This app has been repainted twice. A file left carrying a colour from
  // either of the earlier palettes renders as an unstyled card rather than
  // failing, so every retired name is checked here by hand.
  const gone = /"(forest|sage|mist|olive|ember|gold|peach|yellow|cream|blush|lilac|coral|orange)"/;
  for (const file of readdirSync(new URL('../content/', import.meta.url), { withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith('.json')) continue;
    const raw = readFileSync(new URL(`../content/${file.name}`, import.meta.url), 'utf8');
    const hit = raw.match(gone);
    assert.equal(hit, null, `${file.name} still uses the old palette: ${hit && hit[0]}`);
    assert.equal(/"(tones|accent)"\s*:/.test(raw), false, `${file.name} still has tones/accent — it is one "tone" now`);
  }
});

test('the writing never promises something the app cannot do', () => {
  // There is no server. Any sentence telling a reader their prayer was sent,
  // their request was received or their place was reserved would be a lie, and
  // it is exactly the kind of lie a well-meaning content edit introduces.
  const promises = /\b(we (have )?(received|will pray)|(has|have) been (sent|submitted|received)|your (request|prayer) (was|has been) sent|reserved your place)\b/i;
  for (const file of readdirSync(new URL('../content/', import.meta.url), { withFileTypes: true })) {
    if (!file.isFile() || !file.name.endsWith('.json')) continue;
    const raw = readFileSync(new URL(`../content/${file.name}`, import.meta.url), 'utf8');
    assert.equal(promises.test(raw), false, `${file.name} promises something no server exists to do`);
  }
});


/**
 * Every event says when it is, twice.
 *
 * `when` is the sentence a member reads on the screen. The fields beside it —
 * `weekday` + `start`, or `date`, or `dates[]` — are what the countdown on the
 * Today screen is computed from. An event with only the sentence sorts to the
 * end of the calendar and never appears as "Next up", which is a silent
 * failure rather than a loud one, so it is checked here.
 */
test('every event can be counted down to, not just read', async () => {
  const agenda = await import('../js/core/agenda.js');
  const events = read('events.json');
  assert.ok(events.length >= 4);
  for (const one of events) {
    const timed = one.weekday !== undefined || one.date || Array.isArray(one.dates);
    assert.ok(timed, `${one.id}: no weekday, date or dates — nothing can count down to it`);
    assert.match(one.start, /^\d{1,2}:\d{2}$/, `${one.id}: "${one.start}" is not a time`);
    assert.ok(Number.isInteger(one.minutes) && one.minutes > 0, `${one.id}: how long does it run?`);
    if (one.weekday !== undefined) {
      assert.ok(one.weekday >= 0 && one.weekday <= 6, `${one.id}: ${one.weekday} is not a day of the week`);
      assert.equal(one.recurring, true, `${one.id}: has a weekday but is not marked recurring`);
    }
    for (const day of one.dates || []) {
      assert.match(day, /^\d{4}-\d{2}-\d{2}$/, `${one.id}: "${day}" is not a date`);
    }
    if (one.date) assert.match(one.date, /^\d{4}-\d{2}-\d{2}$/, `${one.id}: "${one.date}" is not a date`);
    // A recurring gathering must always resolve to a next occurrence, whenever
    // it is asked. A one-off is allowed to be in the past.
    if (one.weekday !== undefined) {
      assert.ok(agenda.nextOccurrence(one, new Date('2026-09-01T08:00:00')), `${one.id}: never happens again`);
    }
  }
  // Something has to be a gathering, or the Today screen has nothing to frame
  // the week around and pulse() falls back to "ordinary" for ever.
  assert.ok(events.some((one) => one.gathering), 'no event is marked as a gathering');
});

/**
 * The messages, and the one promise this screen must not make.
 *
 * FLCC publishes no video archive. Every message here therefore ships with
 * `url` empty and stands on what it carries instead — the passage, three
 * takeaways and the question. The Watch screen only offers "Watch the
 * recording" when `url` is filled in, so an empty string is a working state
 * rather than a broken one; what would break is a message with nothing to read
 * and no recording either, which is what this checks.
 */
test('every message can be opened, with or without a recording', () => {
  const messages = read('messages.json');
  assert.ok(messages.length >= 6, 'a Watch tab with five messages on it is an empty room');
  const ids = new Set();
  for (const one of messages) {
    assert.ok(isText(one.id), 'a message without an id');
    assert.equal(ids.has(one.id), false, `duplicate message id ${one.id}`);
    ids.add(one.id);
    for (const field of ['title', 'speaker', 'series', 'ref', 'blurb', 'question']) {
      assert.ok(isText(one[field], 3), `${one.id}: ${field} is missing`);
    }
    looksRight(one, `messages/${one.id}`);
    assert.match(one.date, /^\d{4}-\d{2}-\d{2}$/, `${one.id}: ${one.date} is not a date`);
    assert.ok(!Number.isNaN(Date.parse(one.date)), `${one.id}: ${one.date} is not a real date`);
    assert.ok(Number.isInteger(one.minutes) && one.minutes > 0, `${one.id}: how long was it?`);
    assert.match(one.question, /\?$/, `${one.id}: the question should be a question`);
    assert.ok(one.blurb.length >= 80, `${one.id}: the blurb is too thin to be worth opening`);
    assert.equal(typeof one.url, 'string', `${one.id}: url must exist, even empty`);
    assert.ok(Array.isArray(one.takeaways) && one.takeaways.length === 3,
      `${one.id}: three takeaways — a member reads three and skims seven`);
    for (const line of one.takeaways) assert.ok(isText(line, 30), `${one.id}: a thin takeaway`);
    if (one.url) assert.match(one.url, /^https:\/\//, `${one.id}: a recording link must be https`);
  }
  // Every series has to be a series. One message on its own is a message.
  const series = new Map();
  for (const one of messages) series.set(one.series, (series.get(one.series) || 0) + 1);
  for (const [name, count] of series) {
    assert.ok(count >= 2, `"${name}" has one message in it — that is not a series`);
  }
});
