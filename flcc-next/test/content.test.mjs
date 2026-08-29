// Content is data, and this suite is its schema. A missing age variant, a
// wrong quiz answer, or an unlabelled help line fails the build.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { MODES } from '../js/core/profile.js';
import { hasSymbol, TONES, TONE_HEX } from '../js/core/art.js';

const read = (path) => JSON.parse(readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8'));

function bothModes(value, where) {
  assert.ok(value && typeof value === 'object' && !Array.isArray(value), `${where} should be keyed by age group`);
  for (const key of MODES) {
    const text = value[key];
    assert.ok(typeof text === 'string' && text.trim(), `${where} is missing the ${key} version`);
  }
}

function validTone(tone, where) {
  assert.ok([...TONES, 'paper', 'ink'].includes(tone), `${where}: "${tone}" is not in the palette`);
}

test('every day has both age groups, a real tone and a real symbol', () => {
  const daily = read('daily.json');
  assert.ok(daily.length >= 7, 'at least a week of content');
  for (const day of daily) {
    assert.ok(day.title && day.ref && day.text, `${day.title}: incomplete`);
    assert.ok(day.title === day.title.toUpperCase(), `${day.title}: titles are set in capitals`);
    validTone(day.tone, day.title);
    assert.ok(hasSymbol(day.symbol), `${day.title}: no symbol "${day.symbol}"`);
    for (const field of ['reflection', 'prayer', 'challenge', 'devotion']) bothModes(day[field], `${day.title}.${field}`);
    assert.ok('reviewedBy' in day, `${day.title}: needs a review field`);
  }
});

test('every journey has its lessons, and every lesson has an answerable question', () => {
  const journeys = read('journeys.json');
  assert.ok(journeys.length >= 3);
  for (const journey of journeys) {
    validTone(journey.tone, journey.title);
    assert.ok(hasSymbol(journey.symbol), `${journey.title}: no symbol`);
    bothModes(journey.blurb, `${journey.title}.blurb`);

    const lessons = read(`journeys/${journey.id}.json`);
    assert.equal(lessons.length, journey.lessons, `${journey.title}: lesson count does not match`);
    for (const lesson of lessons) {
      assert.ok(lesson.title && lesson.ref && lesson.text, `${lesson.id}: incomplete`);
      bothModes(lesson.body, `${lesson.id}.body`);
      bothModes(lesson.quiz.q, `${lesson.id}.quiz.q`);
      bothModes(lesson.quiz.why, `${lesson.id}.quiz.why`);
      assert.ok(Number.isInteger(lesson.quiz.answer) && lesson.quiz.options[lesson.quiz.answer] !== undefined,
        `${lesson.id}: the answer does not point at an option`);
    }
  }
});

test('real life topics are written for both, or marked for one', () => {
  const topics = read('real-life.json');
  assert.ok(topics.length >= 6);
  for (const topic of topics) {
    validTone(topic.tone, topic.title);
    assert.ok(hasSymbol(topic.symbol), `${topic.title}: no symbol`);
    for (const field of ['hook', 'body', 'step']) bothModes(topic[field], `${topic.title}.${field}`);
    assert.ok(topic.verse && topic.ref, `${topic.title}: needs Scripture`);
    assert.ok(['both', ...MODES].includes(topic.ageGroup), `${topic.title}: ageGroup`);
  }
});

test('every game exists in code, and every question can be answered', () => {
  const games = read('games.json');
  // Read the routing table out of the screen rather than restating it here, so
  // a game listed in content but never wired up fails this test.
  const source = readFileSync(new URL('../js/screens/game.js', import.meta.url), 'utf8');
  const start = source.indexOf('const GAMES = {');
  const table = source.slice(start, source.indexOf('};', start));
  const built = [...table.matchAll(/^\s+'?([a-z-]+)'?\s*:/gm)].map((match) => match[1]);
  assert.equal(built.length, games.length, `games.json lists ${games.length}, the screen routes ${built.length}`);
  for (const game of games) {
    assert.ok(built.includes(game.id), `${game.id} has no implementation`);
    validTone(game.tone, game.title);
    assert.ok(hasSymbol(game.symbol), `${game.title}: no symbol`);
    bothModes(game.blurb, `${game.title}.blurb`);
    assert.ok(game.difficulty >= 1 && game.difficulty <= 5);
  }

  for (const row of read('games/quiz.json')) {
    assert.ok(row.options[row.answer] !== undefined, `quiz: "${row.q}" has no valid answer`);
    assert.ok(row.why, `quiz: "${row.q}" needs an explanation`);
  }
  const whoAnswers = read('games/who-am-i.json').map((row) => row.answer);
  assert.equal(new Set(whoAnswers).size, whoAnswers.length,
    'two Who am I? rounds share an answer — a day could deal both, and the options would give it away');
  for (const row of read('games/who-am-i.json')) {
    assert.equal(row.clues.length, 3, `who-am-i: ${row.answer} needs three clues`);
    assert.ok(row.options.includes(row.answer), `who-am-i: ${row.answer} is not among its own options`);
    for (const clue of row.clues) {
      assert.ok(!clue.toLowerCase().includes(row.answer.toLowerCase()), `who-am-i: a clue gives away ${row.answer}`);
    }
  }
  for (const puzzle of read('games/crossword.json')) {
    assert.ok(['both', ...MODES].includes(puzzle.ageGroup), `crossword: ${puzzle.id} ageGroup`);
    assert.ok(puzzle.words.length >= 6, `crossword: ${puzzle.id} is too thin`);
    const answers = puzzle.words.map((word) => word.answer.toUpperCase());
    assert.equal(new Set(answers).size, answers.length, `crossword: ${puzzle.id} repeats an answer`);
    for (const word of puzzle.words) {
      assert.ok(!word.clue.toUpperCase().includes(word.answer.toUpperCase()),
        `crossword: the clue gives away ${word.answer}`);
    }
  }
  for (const row of read('games/verse-builder.json')) {
    assert.ok(row.text.split(' ').length >= 4, `verse-builder: "${row.text}" is too short to rebuild`);
    assert.ok(row.ref, 'verse-builder: every verse needs its reference');
  }
});

test('achievements can actually be earned, and events can be attended', () => {
  for (const row of read('achievements.json')) {
    assert.ok(hasSymbol(row.symbol), `${row.title}: no symbol`);
    validTone(row.tone, row.title);
    assert.ok(['streak', 'devotional', 'lesson', 'game', 'challenge', 'prayer'].includes(row.need.kind), `${row.title}: unknown requirement`);
    assert.ok(row.need.count > 0 && row.how, `${row.title}: needs a threshold and an explanation`);
  }
  for (const row of read('events.json')) {
    assert.ok(row.when && row.where && row.blurb, `${row.id}: incomplete`);
    assert.ok(['both', ...MODES].includes(row.for), `${row.id}: audience`);
    assert.ok(hasSymbol(row.symbol), `${row.id}: no symbol`);
  }
});

test('help lines are named, and either flagged or signed off by a person', () => {
  const help = read('help-lines.json');
  // These are the numbers a frightened child is sent to. A church may clear the
  // flag once it has actually checked them — but only by naming who did, and
  // when. Silently deleting the flag is the thing this must not allow.
  if (help.verifyBeforeLaunch !== true) {
    assert.ok(help.verifiedBy, 'the flag is cleared but nobody is named as having checked the numbers');
    assert.match(String(help.verifiedAt || ''), /^\d{4}-\d{2}-\d{2}$/, 'a verification needs a date');
  }
  assert.ok(help.lines.length >= 3);
  for (const line of help.lines) {
    assert.ok(line.name, 'every line is named');
    assert.ok(line.number || line.detail, `${line.name} needs a number or an explanation`);
  }
  assert.ok(/trusted adult/i.test(help.lines[0].name), 'a person comes before any phone number');
});

test('the illustration set covers everything the content asks for', () => {
  const used = new Set();
  for (const file of ['daily.json', 'journeys.json', 'real-life.json', 'games.json', 'events.json', 'achievements.json']) {
    for (const row of read(file)) if (row.symbol) used.add(row.symbol);
  }
  for (const name of used) assert.ok(hasSymbol(name), `content asks for a "${name}" symbol that does not exist`);
  assert.ok(used.size >= 8, 'the content should use a range of the illustration set');
});

/**
 * The six colours, pinned.
 *
 * The adult edition (`flcc-adults/`) wears this same palette so the two apps
 * read as one family, and they share no code — which means nothing but a test
 * stops one of them drifting a shade at a time. The adult suite has the
 * identical block; changing a colour means changing it in both.
 */
test('the shared palette is exactly these six colours on this paper', () => {
  const css = readFileSync(new URL('../css/next.css', import.meta.url), 'utf8');
  const expected = {
    sunshine: '#EDCE7A', rose: '#EABCB5', sky: '#C3D7EA',
    captain: '#4173B0', poppy: '#EB8861', paper: '#FBF8F0', ink: '#2B4C6D',
  };
  for (const [name, hex] of Object.entries(expected)) {
    assert.match(css, new RegExp(`--${name}:\\s*${hex};`, 'i'),
      `--${name} should be ${hex} — and flcc-adults/css/sticker.css must match`);
  }
  for (const [name, hex] of Object.entries(TONE_HEX)) {
    if (expected[name]) assert.equal(hex.toUpperCase(), expected[name], `art.js has ${name} as ${hex}`);
  }
});
