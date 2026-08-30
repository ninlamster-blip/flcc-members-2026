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
const css = readFileSync(new URL('../css/layers.css', import.meta.url), 'utf8');

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

/** The colours a card may wear. Poppy is not one of them — see below. */
const CARD_TONES = ['sky', 'rose', 'sunshine', 'captain', 'navy', 'poppy', 'ember', 'paper'];
/** Everything a stem, a tag or a character may be. Poppy lives here. */
const ACCENTS = [...CARD_TONES, 'poppy'];
/** Which files' tone ends up as a card's own background. */
const ON_CARDS = ['moments.json', 'paths.json', 'prayer-guides.json', 'reading-plans.json', 'events.json'];

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
    sky: '#C3D7EA', captain: '#4173B0', navy: '#2B4C6D',
    rose: '#EABCB5', poppy: '#EB8861', sunshine: '#EDCE7A',
  };
  for (const [name, hex] of Object.entries(shared)) {
    assert.match(css, new RegExp(`--${name}:\\s*${hex};`, 'i'),
      `--${name} should be ${hex} — and flcc-next/css/next.css must match`);
  }
  assert.match(css, /--paper:\s*#FAF6F2;/i, 'this app sits on a warm near-white');
  // The one colour that is this app's own: poppy deepened until white type
  // sits on it. The reference the layout comes from opens on a deep coral and
  // none of the six shared colours is dark enough to carry white text.
  assert.match(css, /--ember:\s*#C24A38;/i, 'the derived ember is gone');
  assert.match(css, /--ink:\s*var\(--navy\)/, 'navy is the only ink');
});

test('the palette is the one the stylesheet defines', () => {
  for (const tone of ['paper', 'white', 'sky', 'captain', 'navy', 'rose', 'poppy', 'sunshine']) {
    assert.ok(TONES.includes(tone) || css.includes(`--${tone}:`), `--${tone} is missing from sticker.css`);
  }
});

/**
 * Poppy may not carry body copy.
 *
 * Navy on poppy is about 3.5:1 — enough behind a headline, not enough behind a
 * paragraph, and every card in this app has paragraphs on it. So poppy is an
 * accent: stems, tags, stars and characters. A content file that hands poppy
 * to something rendered as a card would look fine to a reviewer and fail a
 * contrast check, which is exactly the kind of thing worth a test.
 */
test('poppy is an accent, never a surface with text on it', () => {
  for (const name of ON_CARDS) {
    for (const item of read(name)) {
      assert.ok(CARD_TONES.includes(item.tone),
        `${name}/${item.id}: "${item.tone}" cannot carry a card — pick one of ${CARD_TONES.join(', ')}`);
    }
  }
  assert.ok(css.includes('--poppy-wash:'), 'poppy needs a wash for its rows and notes');
});

/**
 * Every colour a card can wear needs a band to go under it.
 *
 * A card's bottom band is `--<tone>-band`, and a tone without one renders a
 * band with no colour — a white strip along the bottom of an otherwise
 * finished card. It is exactly the kind of thing that ships.
 */
test('every card colour has a wash to be tinted with', () => {
  // A card is tinted at about a tenth of a colour's strength, never painted in
  // it: full-strength colour on every surface is what a screen with no
  // hierarchy looks like. One block per screen is allowed to be solid, and
  // that block is navy.
  for (const tone of CARD_TONES) {
    if (tone === 'paper') continue;
    assert.ok(css.includes(`--${tone}-wash:`), `--${tone}-wash is missing`);
    assert.match(css, new RegExp(`\\.card\\[data-tone="${tone}"\\]`), `.card[data-tone="${tone}"] is not styled`);
  }
  assert.match(css, /\.card\[data-solid\]/, 'the one solid block has no styling');
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
  const gone = /"(forest|sage|mist|olive|gold|peach|yellow|cream|blush|lilac|coral|orange)"/;
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
