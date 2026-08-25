/* =============================================================================
   ENGINE — the rules, with no screen and no storage attached.
   ========================================================================== */

import { STORIES, ERAS, AGE_BANDS, TIERS } from './stories.js';
import { QUESTIONS } from './questions.js';

export const QUIZ_LENGTH = 5;
export const PASS_MARK = 0.6;      // three out of five

/* ── Age and tier ─────────────────────────────────────────────────────────── */

export function bandById(id) {
  return AGE_BANDS.find((b) => b.id === id) || AGE_BANDS[1];
}

/** A tier is a floor: a fourteen-year-old also gets the younger questions,
 *  a seven-year-old only gets their own. */
export function tiersUpTo(tier) {
  const index = TIERS.indexOf(tier);
  return index === -1 ? [TIERS[0]] : TIERS.slice(0, index + 1);
}

export function storyById(id) {
  return STORIES.find((s) => s.id === id) || null;
}

export function storyText(story, tier) {
  if (!story) return '';
  return story.text[tier] || story.text.middle || story.text.young;
}

/** The extra paragraph is for the teenagers. Handing it to a nine-year-old
 *  would bury the story they just read under a second, harder one. */
export function showsDeeper(tier) {
  return tier === 'older';
}

/** The stories grouped the way the map shows them. */
export function storiesByEra() {
  return ERAS.map((era) => ({
    ...era,
    stories: STORIES.filter((s) => s.era === era.id),
  })).filter((e) => e.stories.length);
}

/* ── The quiz ─────────────────────────────────────────────────────────────── */

export function questionsFor(storyId, tier) {
  const allowed = new Set(tiersUpTo(tier));
  return QUESTIONS.filter((q) => q.story === storyId && allowed.has(q.tier));
}

/**
 * Deal a quiz.
 *
 * The bank stores every question with its right answer first, so that a person
 * reading the file — or checking it against a Bible — can see at a glance what
 * it claims. That is exactly the pattern a child would spot inside two
 * questions, so the options are shuffled here, on the way to the screen. The
 * bank stays readable; the quiz stays honest.
 */
export function buildQuiz(storyId, tier, random = Math.random, length = QUIZ_LENGTH) {
  // Hardest first. A tier is a floor, so a teenager is eligible for the
  // seven-year-olds' questions too — but dealing all of them at random hands a
  // seventeen-year-old a quiz that is mostly "what did God make first?", and
  // they will rightly stop taking it seriously. Their own level is dealt first
  // and the easier ones only fill what is left.
  const eligible = questionsFor(storyId, tier);
  const pool = tiersUpTo(tier).reverse()
    .flatMap((band) => shuffle(eligible.filter((q) => q.tier === band), random));

  return pool.slice(0, Math.min(length, pool.length)).map((question) => {
    const options = shuffle(question.a.map((text, index) => ({ text, right: index === question.correct })), random);
    return {
      story: question.story,
      tier: question.tier,
      question: question.q,
      reference: question.ref,
      options: options.map((o) => o.text),
      answer: options.findIndex((o) => o.right),
    };
  });
}

function shuffle(list, random) {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function scoreQuiz(quiz, answers) {
  const right = quiz.reduce((total, q, i) => total + (answers[i] === q.answer ? 1 : 0), 0);
  return { right, total: quiz.length, passed: quiz.length > 0 && right / quiz.length >= PASS_MARK };
}

/* ── Memory verses ────────────────────────────────────────────────────────── */

export const VERSE_LEVELS = [
  { level: 0, label: 'Read it' },
  { level: 1, label: 'A few words gone' },
  { level: 2, label: 'Most words gone' },
  { level: 3, label: 'First letters only' },
];

/**
 * A verse with words taken away, as tokens the screen can render.
 *
 * Which words go is worked out from the position rather than at random, so the
 * same verse hides the same words every time. A child practising a verse three
 * evenings in a row is trying to learn *this* sentence; reshuffling the gaps
 * each time turns it into a different puzzle every evening.
 */
export function maskVerse(text, level) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (level >= 3) {
    return words.map((word) => ({ word, hidden: true, hint: firstLetter(word) }));
  }
  const everyNth = level === 1 ? 3 : level === 2 ? 2 : 0;   // 1 in 3, then 1 in 2
  return words.map((word, index) => {
    const hidden = everyNth > 0 && index % everyNth === everyNth - 1;
    return { word, hidden, hint: hidden ? firstLetter(word) : '' };
  });
}

function firstLetter(word) {
  const match = /[A-Za-z]/.exec(word);
  return match ? match[0] : word[0] || '';
}

/** Did they say it? Punctuation, capitals and double spaces are not the point. */
export function verseMatches(typed, actual) {
  const tidy = (s) => String(s || '').toLowerCase().replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
  return tidy(typed) === tidy(actual) && tidy(actual) !== '';
}

/* ── Where you are up to ──────────────────────────────────────────────────── */

export const EMPTY_PROGRESS = { read: [], quizzes: {}, verses: [] };

export function readProgress(stored) {
  const p = stored || {};
  return {
    read: Array.isArray(p.read) ? p.read : [],
    quizzes: p.quizzes && typeof p.quizzes === 'object' ? p.quizzes : {},
    verses: Array.isArray(p.verses) ? p.verses : [],
  };
}

export function storyState(progress, storyId) {
  const p = readProgress(progress);
  const quiz = p.quizzes[storyId] || null;
  return {
    read: p.read.includes(storyId),
    quiz,                                   // { right, total } best attempt
    passed: !!(quiz && quiz.right / quiz.total >= PASS_MARK),
    verse: p.verses.includes(storyId),
  };
}

/** A story counts as finished when it has been read, its quiz passed and its
 *  verse learned — all three, because any one of them alone is not knowing it. */
export function isComplete(progress, storyId) {
  const s = storyState(progress, storyId);
  return s.read && s.passed && s.verse;
}

export function completedCount(progress) {
  return STORIES.filter((s) => isComplete(progress, s.id)).length;
}

/** Where to take somebody who taps Continue: the first story they have not
 *  finished, which keeps the order of the Bible rather than of their taps. */
export function nextStory(progress) {
  return STORIES.find((s) => !isComplete(progress, s.id)) || null;
}

/** True when this story is the furthest they have reached — used to point at
 *  it on the map without locking anything: every story is always open, because
 *  a child whose class is doing Jonah this week should be able to open Jonah. */
export function isNext(progress, storyId) {
  const next = nextStory(progress);
  return !!next && next.id === storyId;
}
