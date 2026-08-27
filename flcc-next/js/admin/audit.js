// Content audit.
//
// The test suite checks the authored JSON on the way into the repository. This
// runs the same rules in the browser, so a ministry leader who edits a file and
// pushes it can see what broke without running `node --test`.
//
// It is pure: give it the loaded bundle, get back a list of problems. That is
// what lets the audit itself be tested.

import { hasSymbol, TONES } from '../core/art.js';
import { MODES } from '../core/profile.js';
import { build } from '../games/crossword.js';

const ERROR = 'error';
const WARN = 'warning';

const known = new Set(TONES.concat(['paper', 'ink']));

function bothModes(problems, value, where) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    problems.push({ level: ERROR, where, text: 'should be written once per age group' });
    return;
  }
  for (const band of MODES) {
    if (typeof value[band] !== 'string' || !value[band].trim()) {
      problems.push({ level: ERROR, where, text: `is missing the ${band} version` });
    }
  }
}

function look(problems, row, where) {
  if (!known.has(row.tone)) problems.push({ level: ERROR, where, text: `has an unknown colour "${row.tone}"` });
  if (!hasSymbol(row.symbol)) problems.push({ level: ERROR, where, text: `has no illustration called "${row.symbol}"` });
}

/**
 * @param {object} bundle every content file, already parsed, keyed by filename.
 * @returns {{problems: Array<{level: string, where: string, text: string}>, counts: object}}
 */
export function audit(bundle) {
  const problems = [];
  const counts = {};
  const file = (name, fallback) => {
    const value = bundle[name];
    if (value === undefined || value === null) {
      problems.push({ level: ERROR, where: name, text: 'did not load' });
      return fallback;
    }
    return value;
  };

  // ── The daily word ───────────────────────────────────────────────────────
  const daily = file('daily.json', []);
  counts['Daily words'] = daily.length;
  if (daily.length < 7) problems.push({ level: WARN, where: 'daily.json', text: `only ${daily.length} entries — the week will repeat` });
  daily.forEach((row, i) => {
    const where = `daily.json · ${row.title || `entry ${i + 1}`}`;
    look(problems, row, where);
    if (!row.text || !row.ref) problems.push({ level: ERROR, where, text: 'needs both the verse and its reference' });
    if (!row.translation) problems.push({ level: WARN, where, text: 'does not say which translation it quotes' });
    bothModes(problems, row.reflection, `${where} · reflection`);
    bothModes(problems, row.prayer, `${where} · prayer`);
    if (!row.reviewedBy) problems.push({ level: WARN, where, text: 'has not been signed off by anyone' });
  });

  // ── Journeys and their lessons ───────────────────────────────────────────
  const journeys = file('journeys.json', []);
  counts.Journeys = journeys.length;
  let lessonTotal = 0;
  for (const journey of journeys) {
    const where = `journeys.json · ${journey.title || journey.id}`;
    look(problems, journey, where);
    bothModes(problems, journey.blurb, `${where} · blurb`);
    const lessons = bundle[`journeys/${journey.id}.json`];
    if (!lessons) { problems.push({ level: ERROR, where, text: `has no lesson file (journeys/${journey.id}.json)` }); continue; }
    lessonTotal += lessons.length;
    if (lessons.length !== journey.lessons) {
      problems.push({ level: ERROR, where, text: `says ${journey.lessons} lessons but the file holds ${lessons.length}` });
    }
    lessons.forEach((lesson, i) => {
      const at = `${journey.id} · ${lesson.title || `lesson ${i + 1}`}`;
      if (!lesson.title) problems.push({ level: ERROR, where: at, text: 'has no title' });
      if (!lesson.ref || !lesson.text) problems.push({ level: ERROR, where: at, text: 'needs Scripture and its reference' });
      bothModes(problems, lesson.body, `${at} · body`);
      if (!lesson.quiz) { problems.push({ level: ERROR, where: at, text: 'has no question at the end' }); return; }
      bothModes(problems, lesson.quiz.q, `${at} · question`);
      bothModes(problems, lesson.quiz.why, `${at} · answer note`);
      if (!lesson.quiz.options || lesson.quiz.options[lesson.quiz.answer] === undefined) {
        problems.push({ level: ERROR, where: at, text: 'points at an answer that is not among its options' });
      }
    });
  }
  counts.Lessons = lessonTotal;

  // ── Real life ────────────────────────────────────────────────────────────
  const topics = file('real-life.json', []);
  counts['Real-life topics'] = topics.length;
  for (const topic of topics) {
    const where = `real-life.json · ${topic.title || topic.id}`;
    look(problems, topic, where);
    for (const field of ['hook', 'body', 'step']) bothModes(problems, topic[field], `${where} · ${field}`);
    if (!topic.verse || !topic.ref) problems.push({ level: ERROR, where, text: 'needs Scripture and its reference' });
  }

  // ── Games ────────────────────────────────────────────────────────────────
  const games = file('games.json', []);
  counts.Games = games.length;
  for (const game of games) {
    const where = `games.json · ${game.title || game.id}`;
    look(problems, game, where);
    bothModes(problems, game.blurb, `${where} · blurb`);
    if (!(game.difficulty >= 1 && game.difficulty <= 5)) problems.push({ level: ERROR, where, text: 'needs a difficulty from 1 to 5' });
  }

  const quiz = file('games/quiz.json', []);
  counts['Quiz questions'] = quiz.length;
  for (const row of quiz) {
    const where = `quiz · ${row.q}`;
    if (!row.options || row.options[row.answer] === undefined) {
      problems.push({ level: ERROR, where, text: 'points at an answer that is not in its options' });
    }
    if (!row.why) problems.push({ level: WARN, where, text: 'gives no explanation after the answer' });
  }

  const who = file('games/who-am-i.json', []);
  counts['Who am I? rounds'] = who.length;
  for (const row of who) {
    const where = `who-am-i · ${row.answer}`;
    if (!row.clues || row.clues.length !== 3) problems.push({ level: ERROR, where, text: 'needs exactly three clues' });
    if (!row.options || !row.options.includes(row.answer)) problems.push({ level: ERROR, where, text: 'is not among its own options' });
    for (const clue of row.clues || []) {
      if (clue.toLowerCase().includes(String(row.answer).toLowerCase())) {
        problems.push({ level: ERROR, where, text: 'has a clue that gives the answer away' });
      }
    }
  }

  const verses = file('games/verse-builder.json', []);
  counts['Verse-builder verses'] = verses.length;
  for (const row of verses) {
    if (String(row.text || '').split(' ').length < 4) {
      problems.push({ level: ERROR, where: `verse-builder · ${row.ref || row.text}`, text: 'is too short to rebuild' });
    }
    if (!row.ref) problems.push({ level: ERROR, where: `verse-builder · ${row.text}`, text: 'has no reference' });
  }

  const crosswords = file('games/crossword.json', []);
  counts['Crossword puzzles'] = crosswords.length;
  for (const puzzle of crosswords) {
    const where = `crossword · ${puzzle.title || puzzle.id}`;
    const grid = build(puzzle.words || []);
    for (const answer of grid.skipped) {
      problems.push({ level: ERROR, where, text: `${answer} crosses nothing and cannot be placed` });
    }
    if (grid.width > 13 || grid.height > 13) {
      problems.push({ level: WARN, where, text: `lays out ${grid.width}×${grid.height} — large for a phone` });
    }
    for (const word of puzzle.words || []) {
      if (String(word.clue || '').toUpperCase().includes(String(word.answer).toUpperCase())) {
        problems.push({ level: ERROR, where, text: `the clue for ${word.answer} contains the answer` });
      }
    }
  }

  // ── Events ───────────────────────────────────────────────────────────────
  const events = file('events.json', []);
  counts.Events = events.length;
  for (const event of events) {
    const where = `events.json · ${event.id}`;
    look(problems, event, where);
    bothModes(problems, event.title, `${where} · title`);
    if (!event.when || !event.where || !event.blurb) problems.push({ level: ERROR, where, text: 'needs a time, a place and a line about it' });
    if (!['kids', 'teens', 'both'].includes(event.for)) problems.push({ level: ERROR, where, text: 'needs to say who it is for' });
  }

  // ── Achievements ─────────────────────────────────────────────────────────
  const achievements = file('achievements.json', []);
  counts.Achievements = achievements.length;
  const kinds = new Set(['streak', 'devotional', 'lesson', 'game', 'challenge', 'prayer']);
  for (const row of achievements) {
    const where = `achievements.json · ${row.title || row.id}`;
    look(problems, row, where);
    if (!row.how) problems.push({ level: WARN, where, text: 'does not say how to earn it' });
    if (!row.need || !kinds.has(row.need.kind)) {
      problems.push({ level: ERROR, where, text: `is earned by "${row.need && row.need.kind}", which nothing records` });
    } else if (!(row.need.count >= 1)) {
      problems.push({ level: ERROR, where, text: 'needs a count of at least 1' });
    }
  }

  // ── Help lines ───────────────────────────────────────────────────────────
  const help = file('help-lines.json', { lines: [] });
  counts['Help lines'] = (help.lines || []).length;
  if (help.verifyBeforeLaunch) {
    problems.push({ level: WARN, where: 'help-lines.json',
      text: 'is still marked unverified — check every number before this app reaches a child' });
  }
  for (const line of help.lines || []) {
    if (!line.name) problems.push({ level: ERROR, where: 'help-lines.json', text: 'a line has no name' });
    else if (!line.number && !line.detail) problems.push({ level: ERROR, where: `help-lines.json · ${line.name}`, text: 'has neither a number nor a description' });
  }

  return { problems, counts };
}

/** Every authored file, in the order the dashboard lists them. */
export const FILES = [
  'daily.json', 'journeys.json', 'real-life.json', 'games.json',
  'games/quiz.json', 'games/who-am-i.json', 'games/verse-builder.json', 'games/crossword.json',
  'events.json', 'achievements.json', 'help-lines.json',
];
