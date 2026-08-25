/**
 * The Big Story — the content bank, the tiering, and the quiz.
 *
 * Most of this is about the bank rather than the code. A Sunday school app that
 * teaches a child something the Bible does not say is worse than no app, so the
 * rules below are strict on the content and relaxed about almost everything
 * else: every story readable at every age, every question answerable and backed
 * by a reference, every reference shaped like one somebody could look up.
 *
 * Run: node --test 'test/*.test.mjs'
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';

import { appSource, readRepoFile } from './lib/extract.mjs';
import { STORIES, ERAS, AGE_BANDS, TIERS } from '../big-story/js/stories.js';
import { QUESTIONS } from '../big-story/js/questions.js';
import {
  tiersUpTo, storyById, storyText, showsDeeper, storiesByEra, bandById,
  questionsFor, buildQuiz, scoreQuiz, QUIZ_LENGTH, PASS_MARK,
  maskVerse, verseMatches, storyState, isComplete, completedCount, nextStory, isNext,
} from '../big-story/js/engine.js';

/** "Genesis 1", "1 Kings 18:21", "Luke 23:4, 14, 22", "Genesis 15:12, 17", "Acts 1-10". */
const REFERENCE = /^(?:[1-3]\s)?[A-Z][A-Za-z]+(?:\s[A-Z][a-z]+)*\s\d+(?:[-–]\d+)?(?::\d+(?:[-–]\d+)?)?(?:,\s?\d+(?:[-–]\d+)?)*$/;

// ── The stories ──────────────────────────────────────────────────────────────

test('every story is told at every age', () => {
  // A tier with a hole in it is a child staring at a blank screen.
  for (const story of STORIES) {
    for (const tier of TIERS) {
      assert.ok(story.text[tier] && story.text[tier].trim().length > 80,
        `${story.id}: the "${tier}" telling is missing or too short`);
    }
  }
});

test('each age gets more than the one below, and no two tellings are the same text', () => {
  // Measured by what is actually on the screen, not by the story text alone:
  // the older tier reads the Go deeper note as well, and its telling is denser
  // rather than simply longer, so a few of them are a line shorter than the
  // middle one and that is correct.
  for (const story of STORIES) {
    const words = (s) => s.split(/\s+/).length;
    const young = words(story.text.young);
    const middle = words(story.text.middle);
    const older = words(story.text.older) + words(story.deeper);
    assert.ok(middle > young, `${story.id}: middle is not fuller than young`);
    assert.ok(older > middle, `${story.id}: a teenager reads no more than a ten-year-old`);
    assert.ok(words(story.text.older) > young,
      `${story.id}: the older telling is no longer than the one written for seven-year-olds`);
    assert.notEqual(story.text.young, story.text.middle, `${story.id}: young and middle are the same text`);
    assert.notEqual(story.text.middle, story.text.older, `${story.id}: middle and older are the same text`);
  }
});

test('the youngest telling stays short enough to read to a seven-year-old', () => {
  for (const story of STORIES) {
    const words = story.text.young.split(/\s+/).length;
    assert.ok(words <= 90, `${story.id}: the young telling is ${words} words, which is a wall of text at that age`);
  }
});

/** "Genesis 12, 15, 17" continues in the same book; "Luke 22-23, John 19" names
 *  a second one. Split on the comma and lend a book name to the parts that
 *  carry only numbers. */
function referenceParts(reference) {
  return reference.split(',')
    .map((s) => s.trim())
    .map((part) => (/[A-Za-z]/.test(part) ? part : `Genesis ${part}`));
}

test('every story says where it is in the Bible', () => {
  for (const story of STORIES) {
    for (const part of referenceParts(story.reference)) {
      assert.match(part, REFERENCE, `${story.id}: "${story.reference}" does not read as a reference`);
    }
  }
});

test('every story has a memory verse with a reference and its words', () => {
  for (const story of STORIES) {
    assert.ok(story.verse && story.verse.reference && story.verse.text, `${story.id}: no memory verse`);
    assert.match(story.verse.reference, REFERENCE, `${story.id}: verse reference`);
    assert.ok(story.verse.text.split(/\s+/).length >= 5, `${story.id}: the verse is too short to be one`);
    assert.ok(story.verse.text.split(/\s+/).length <= 60, `${story.id}: that verse is too long to memorise`);
  }
});

test('the memory verses quote the translation the app names', () => {
  // The app says "World English Bible" under every verse, and the WEB renders
  // the divine name as "Yahweh" in the Old Testament. Rather than print wording
  // no FLCC teacher would recognise — or quietly swap in "the LORD" and still
  // call it the WEB — stories whose natural verse contains it are given a
  // different verse. This test is what stops that rule being forgotten.
  for (const story of STORIES) {
    assert.doesNotMatch(story.verse.text, /Yahweh/,
      `${story.id}: quoting the WEB's divine name; choose another verse for this story`);
    assert.doesNotMatch(story.verse.text, /\bLORD\b/,
      `${story.id}: "LORD" is not the WEB's wording — this verse is being misquoted`);
  }
});

test('every story belongs to an era that exists, and every era has stories', () => {
  const eraIds = new Set(ERAS.map((e) => e.id));
  for (const story of STORIES) {
    assert.ok(eraIds.has(story.era), `${story.id}: unknown era "${story.era}"`);
  }
  for (const era of ERAS) {
    assert.ok(STORIES.some((s) => s.era === era.id), `era "${era.id}" has no stories in it`);
  }
});

test('story ids are unique and url-safe', () => {
  const seen = new Set();
  for (const story of STORIES) {
    assert.match(story.id, /^[a-z0-9-]+$/, `${story.id} is not safe in a hash route`);
    assert.ok(!seen.has(story.id), `duplicate story id ${story.id}`);
    seen.add(story.id);
  }
});

test('the older tier gets a Go deeper note and the younger ones do not', () => {
  assert.equal(showsDeeper('older'), true);
  assert.equal(showsDeeper('young'), false);
  assert.equal(showsDeeper('middle'), false);
  for (const story of STORIES) {
    assert.ok(story.deeper && story.deeper.trim().length > 80, `${story.id}: no Go deeper note`);
  }
});

test('the story runs from Genesis to the church', () => {
  assert.equal(STORIES[0].id, 'creation');
  assert.equal(STORIES[STORIES.length - 1].era, 'church');
  assert.ok(STORIES.length >= 20, 'too few stories to call it the whole story');
});

// ── The questions ────────────────────────────────────────────────────────────

test('every question is answerable, and only one answer is right', () => {
  for (const q of QUESTIONS) {
    assert.equal(q.a.length, 4, `${q.story}: "${q.q}" does not have four options`);
    assert.ok(Number.isInteger(q.correct) && q.correct >= 0 && q.correct < q.a.length,
      `${q.story}: "${q.q}" has no correct answer`);
    assert.equal(new Set(q.a).size, 4, `${q.story}: "${q.q}" repeats an option`);
    for (const option of q.a) assert.ok(String(option).trim(), `${q.story}: "${q.q}" has an empty option`);
  }
});

test('every question carries the passage that settles it', () => {
  // This is the whole guard against a plausible-sounding invention getting in.
  for (const q of QUESTIONS) {
    assert.ok(q.ref, `${q.story}: "${q.q}" has no reference`);
    for (const part of referenceParts(q.ref)) {
      assert.match(part, REFERENCE, `${q.story}: "${q.ref}" does not read as a reference`);
    }
  }
});

test('every question belongs to a story that exists, at a tier that exists', () => {
  const ids = new Set(STORIES.map((s) => s.id));
  for (const q of QUESTIONS) {
    assert.ok(ids.has(q.story), `question names unknown story "${q.story}"`);
    assert.ok(TIERS.includes(q.tier), `${q.story}: unknown tier "${q.tier}"`);
  }
});

test('every story has enough questions at every age', () => {
  for (const story of STORIES) {
    const count = (tier) => QUESTIONS.filter((q) => q.story === story.id && q.tier === tier).length;
    assert.ok(count('young') >= 3, `${story.id}: only ${count('young')} questions a seven-year-old can be asked`);
    assert.ok(count('middle') >= 2, `${story.id}: not enough middle questions`);
    assert.ok(count('older') >= 2, `${story.id}: not enough older questions`);
  }
});

test('a tier is a floor, so older children get the younger questions too', () => {
  assert.deepEqual(tiersUpTo('young'), ['young']);
  assert.deepEqual(tiersUpTo('middle'), ['young', 'middle']);
  assert.deepEqual(tiersUpTo('older'), ['young', 'middle', 'older']);
  assert.deepEqual(tiersUpTo('nonsense'), ['young']);

  for (const story of STORIES) {
    const young = questionsFor(story.id, 'young').length;
    const older = questionsFor(story.id, 'older').length;
    assert.ok(older > young, `${story.id}: a teenager is asked no more than a seven-year-old`);
  }
});

test('the youngest quiz is genuinely shorter', () => {
  // Three questions for a seven-year-old, five for everybody else.
  for (const story of STORIES.slice(0, 5)) {
    assert.equal(buildQuiz(story.id, 'young', () => 0.5).length, 3);
    assert.equal(buildQuiz(story.id, 'older', () => 0.5).length, QUIZ_LENGTH);
  }
});

// ── The quiz ─────────────────────────────────────────────────────────────────

test('the right answer is not always in the same place', () => {
  // The bank stores the correct answer first so a person can check the file at
  // a glance. If that ever reached the screen unshuffled, a child would work it
  // out inside two questions and stop reading the options.
  assert.ok(QUESTIONS.every((q) => q.correct === 0),
    'the bank convention changed — the shuffle below is what makes it safe');

  let seed = 7;
  const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  const positions = new Set();
  for (let i = 0; i < 40; i++) {
    for (const question of buildQuiz('creation', 'older', rng)) positions.add(question.answer);
  }
  assert.ok(positions.size >= 3, `the answer only ever landed in ${positions.size} position(s)`);
});

test('a teenager\u2019s quiz is mostly written for teenagers', () => {
  // The floor makes the younger questions eligible; it must not make them the
  // whole quiz. Every story has 2 older + 2 middle + 3 young, so a five
  // question quiz should be the four harder ones plus one filler.
  let seed = 5;
  const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (const story of STORIES) {
    const quiz = buildQuiz(story.id, 'older', rng);
    const young = quiz.filter((q) => q.tier === 'young').length;
    assert.ok(young <= 1, `${story.id}: ${young} of ${quiz.length} questions were written for seven-year-olds`);
    assert.ok(quiz.some((q) => q.tier === 'older'), `${story.id}: no question at the reader's own level`);
  }
  // A ten-year-old gets the middle ones first, then young to fill.
  const middle = buildQuiz(STORIES[0].id, 'middle', rng);
  assert.equal(middle.filter((q) => q.tier === 'middle').length, 2);
  assert.equal(middle.filter((q) => q.tier === 'young').length, 3);
});

test('a shuffled question still points at the right answer', () => {
  let seed = 99;
  const rng = () => (seed = (seed * 1103515245 + 12345) % 2147483648) / 2147483648;
  for (const story of STORIES) {
    for (const question of buildQuiz(story.id, 'older', rng)) {
      const source = QUESTIONS.find((q) => q.story === story.id && q.q === question.question);
      assert.ok(source, `${story.id}: a dealt question is not in the bank`);
      assert.equal(question.options[question.answer], source.a[source.correct],
        `${story.id}: "${question.question}" points at the wrong option after shuffling`);
      assert.equal(question.options.length, 4);
    }
  }
});

test('scoring, and what counts as a pass', () => {
  const quiz = buildQuiz('creation', 'older', () => 0.5);
  assert.deepEqual(scoreQuiz(quiz, quiz.map((q) => q.answer)), { right: 5, total: 5, passed: true });
  assert.deepEqual(scoreQuiz(quiz, quiz.map(() => -1)), { right: 0, total: 5, passed: false });

  // Three out of five passes, two does not.
  const three = quiz.map((q, i) => (i < 3 ? q.answer : -1));
  const two = quiz.map((q, i) => (i < 2 ? q.answer : -1));
  assert.equal(scoreQuiz(quiz, three).passed, true);
  assert.equal(scoreQuiz(quiz, two).passed, false);
  assert.equal(PASS_MARK, 0.6);
  assert.deepEqual(scoreQuiz([], []), { right: 0, total: 0, passed: false });
});

// ── Memory verses ────────────────────────────────────────────────────────────

test('the same verse hides the same words every time', () => {
  // A child practising one verse three evenings running is learning that
  // sentence. Moving the gaps each time makes it a new puzzle every evening.
  const text = 'In the beginning, God created the heavens and the earth.';
  assert.deepEqual(maskVerse(text, 1).map((t) => t.hidden), maskVerse(text, 1).map((t) => t.hidden));
});

test('each level hides more than the last, and the last hides everything', () => {
  const text = STORIES[0].verse.text;
  const hidden = (level) => maskVerse(text, level).filter((t) => t.hidden).length;
  assert.equal(hidden(0), 0);
  assert.ok(hidden(1) > 0);
  assert.ok(hidden(2) > hidden(1), 'level 2 does not hide more than level 1');
  assert.equal(hidden(3), maskVerse(text, 3).length, 'level 3 should hide every word');
});

test('a hidden word still shows its first letter', () => {
  for (const token of maskVerse('In the beginning God created', 3)) {
    assert.equal(token.hint, token.word[0], `no hint for "${token.word}"`);
  }
  assert.deepEqual(maskVerse('', 3), []);
  assert.deepEqual(maskVerse(undefined, 1), []);
});

test('saying the verse right is not the same as typing it perfectly', () => {
  const verse = 'In the beginning, God created the heavens and the earth.';
  assert.equal(verseMatches('in the beginning god created the heavens and the earth', verse), true);
  assert.equal(verseMatches('In  the beginning,, God created the heavens and the earth!', verse), true);
  assert.equal(verseMatches('In the beginning God made the heavens', verse), false);
  assert.equal(verseMatches('', verse), false);
  assert.equal(verseMatches('', ''), false);
});

// ── Progress ─────────────────────────────────────────────────────────────────

const PROGRESS = { read: ['creation'], quizzes: { creation: { right: 4, total: 5 } }, verses: ['creation'] };

test('a story is finished only when it has been read, passed and learned', () => {
  assert.equal(isComplete(PROGRESS, 'creation'), true);
  assert.equal(isComplete({ ...PROGRESS, verses: [] }, 'creation'), false);
  assert.equal(isComplete({ ...PROGRESS, read: [] }, 'creation'), false);
  assert.equal(isComplete({ ...PROGRESS, quizzes: { creation: { right: 1, total: 5 } } }, 'creation'), false);
  assert.equal(isComplete({}, 'creation'), false);
  assert.equal(completedCount(PROGRESS), 1);
});

test('progress survives a stored shape that makes no sense', () => {
  for (const junk of [null, undefined, {}, { read: 'nope', quizzes: 5, verses: null }]) {
    assert.doesNotThrow(() => storyState(junk, 'creation'));
    assert.equal(isComplete(junk, 'creation'), false);
  }
});

test('Continue goes to the first unfinished story, in Bible order', () => {
  assert.equal(nextStory({}).id, 'creation');
  assert.equal(nextStory(PROGRESS).id, STORIES[1].id);
  assert.equal(isNext(PROGRESS, STORIES[1].id), true);
  assert.equal(isNext(PROGRESS, 'creation'), false);

  const everything = {
    read: STORIES.map((s) => s.id),
    verses: STORIES.map((s) => s.id),
    quizzes: Object.fromEntries(STORIES.map((s) => [s.id, { right: 5, total: 5 }])),
  };
  assert.equal(nextStory(everything), null, 'finishing everything must not loop back to the start');
  assert.equal(completedCount(everything), STORIES.length);
});

// ── Ages ─────────────────────────────────────────────────────────────────────

test('the age bands cover 7 to 18 with no gap and no overlap', () => {
  assert.deepEqual(AGE_BANDS.map((b) => b.label), ['7 to 9', '10 to 13', '14 to 18']);
  assert.deepEqual(AGE_BANDS.map((b) => b.tier), TIERS);
  assert.equal(bandById('older').tier, 'older');
  assert.equal(bandById('nonsense').tier, 'middle', 'an unknown band must land somewhere sensible');
});

// ── How it is wired in ───────────────────────────────────────────────────────

test('the app reads no church data and holds no key that belongs to a church', () => {
  // This is a network-wide app like the games: no FLCC.data, no FLCC.key, and
  // nothing per church. A child's progress is device-wide (CHURCHES.md).
  for (const file of ['js/app.js', 'js/engine.js', 'js/storage.js', 'js/stories.js']) {
    const src = readRepoFile('big-story/' + file);
    assert.doesNotMatch(src, /FLCC\.(data|key|dataFor)/, `big-story/${file} reaches into church data`);
  }
  assert.match(readRepoFile('big-story/js/storage.js'), /KEY = 'flcc-big-story-v1'/);
});

test('the members app points at it', () => {
  const app = appSource('index.html');
  assert.match(app, /big-story\/index\.html/, 'the Home card no longer points at The Big Story');
});

test('the service worker caches every file the app is built from', () => {
  // Nothing here is fetched at runtime, so a missing file in the shell list is
  // the difference between working on a jeepney and not.
  const sw = readRepoFile('big-story/sw.js');
  for (const file of ['./index.html', './style.css', './js/app.js', './js/engine.js',
                      './js/storage.js', './js/stories.js', './js/questions.js']) {
    assert.ok(sw.includes(`'${file}'`), `sw.js does not cache ${file}`);
  }
});
