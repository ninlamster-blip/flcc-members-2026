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
import { cycleOf } from '../core/rotation.js';

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
 * How much a child gets through in a day, per feature. These match what the
 * screens actually deal, so the run lengths below are real rather than
 * aspirational.
 */
export const PER_DAY = { 'Daily word': 1, 'Bible quiz': 10, 'Speed quiz': 20, 'Our church': 5, 'Who am I?': 5, 'Verse builder': 5, Crossword: 1 };

/**
 * Which game each quiz round is, so its topics can be read from games.json
 * rather than restated here. A round whose topics are edited in the dashboard
 * is then measured against the questions it will actually deal.
 */
const ROUNDS = { 'Bible quiz': 'quiz', 'Speed quiz': 'speed', 'Our church': 'church' };

/** The topics a question may carry. A round deals some subset of these. */
const TOPIC_NAMES = new Set(['bible', 'jesus', 'flcc']);

/**
 * A bank shorter than this many days of use gets flagged as repetitive.
 *
 * Two weeks is the floor because that is roughly how long a child keeps
 * opening something before recognising it. Raising this number is how you
 * commission more writing: the dashboard immediately names what falls short.
 */
export const THIN = 14;

/**
 * The speed quiz is a recall drill against a clock. Meeting a question you
 * have seen before is the exercise, not a failure of the content, so it is
 * reported but never warned about — otherwise the dashboard would carry a
 * warning nobody should act on.
 */
export const DRILLS = new Set(['Speed quiz']);

/**
 * Rounds whose material only the church itself can write — the questions are
 * facts about this church, its network and its vision, and nobody outside it
 * can invent more without making things up. They are still measured and still
 * warned about, because a thin bank is still thin; what they are exempt from
 * is the test suite, which cannot fix them by being red.
 */
export const LOCAL = new Set(['Our church']);

const eligible = (rows, band) => (rows || []).filter((row) =>
  !row.ageGroup || row.ageGroup === 'both' || row.ageGroup === band);

const onTopic = (rows, topics) =>
  (Array.isArray(topics) && topics.length ? (rows || []).filter((row) => topics.includes(row.topic || 'bible')) : rows);

/**
 * @param {object} bundle every content file, already parsed, keyed by filename.
 * @returns {{problems: Array<{level: string, where: string, text: string}>, counts: object, rotation: Array}}
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
  const asked = new Set();
  for (const row of quiz) {
    const where = `quiz · ${row.q}`;
    if (!row.options || row.options[row.answer] === undefined) {
      problems.push({ level: ERROR, where, text: 'points at an answer that is not in its options' });
    }
    if (!row.why) problems.push({ level: WARN, where, text: 'gives no explanation after the answer' });
    if (row.topic && !TOPIC_NAMES.has(row.topic)) {
      problems.push({ level: ERROR, where, text: `has a topic "${row.topic}" that no round deals` });
    }
    // Dealing promises nothing repeats inside a cycle, which two identical
    // questions quietly break.
    const same = String(row.q || '').trim().toLowerCase();
    if (asked.has(same)) problems.push({ level: ERROR, where, text: 'is asked twice in this file' });
    asked.add(same);
  }
  for (const game of games) {
    if (!Array.isArray(game.topics) || !game.topics.length) continue;
    for (const band of ['kids', 'teens']) {
      if (onTopic(eligible(quiz, band), game.topics).length) continue;
      problems.push({ level: ERROR, where: `games.json · ${game.title || game.id}`,
        text: `deals ${game.topics.join(', ')} questions, and there are none for ${band}` });
    }
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

  // ── The Bible's own guide ────────────────────────────────────────────────
  //
  // Not Scripture — Scripture lives under bible/ and is not audited, because
  // it is not ours to get wrong. These are the ministry's own notes about it:
  // the line above each book's chapters, and the "where do I look?" lists.

  const bookLines = file('bible-books.json', []);
  counts['Bible book lines'] = bookLines.length;
  const numbered = new Set();
  for (const row of bookLines) {
    const where = `bible-books.json · book ${row.n}`;
    if (!(row.n >= 1 && row.n <= 66)) problems.push({ level: ERROR, where, text: 'is not one of the 66 books' });
    else if (numbered.has(row.n)) problems.push({ level: ERROR, where, text: 'is described twice' });
    numbered.add(row.n);
    if (!String(row.about || '').trim()) problems.push({ level: WARN, where, text: 'has no line saying what the book is' });
  }
  if (bookLines.length && numbered.size < 66) {
    problems.push({ level: WARN, where: 'bible-books.json',
      text: `${66 - numbered.size} of the 66 books have no line saying what they are` });
  }

  const finders = file('bible-find.json', []);
  counts['Where do I look? lists'] = finders.length;
  for (const topic of finders) {
    const where = `bible-find.json · ${topic.id}`;
    look(problems, topic, where);
    bothModes(problems, topic.title, `${where} · title`);
    bothModes(problems, topic.need, `${where} · when you would open this`);
    const refs = Array.isArray(topic.refs) ? topic.refs : [];
    if (!refs.length) problems.push({ level: ERROR, where, text: 'has no places to read' });
    for (const ref of refs) {
      // The reader resolves a reference itself; what the audit can catch is a
      // line that is plainly not one, which is the mistake people actually make.
      if (!/^(\d\s*)?[^\d]+\s+\d+(:\d+([-–]\d+)?)?$/.test(String(ref).trim())) {
        problems.push({ level: ERROR, where, text: `"${ref}" is not a reference the reader can open` });
      }
    }
  }

  // ── Help lines ───────────────────────────────────────────────────────────
  const help = file('help-lines.json', { lines: [] });
  counts['Help lines'] = (help.lines || []).length;
  // Unverified is the warning, and so is verified-by-nobody: deleting the flag
  // without naming who checked the numbers is the failure mode worth catching,
  // because it looks exactly like having done the work.
  if (help.verifyBeforeLaunch) {
    problems.push({ level: WARN, where: 'help-lines.json',
      text: 'is still marked unverified — check every number before this app reaches a child' });
  } else if (!help.verifiedBy) {
    problems.push({ level: WARN, where: 'help-lines.json',
      text: 'is marked verified but nobody is named — record who checked the numbers, and when' });
  }
  for (const line of help.lines || []) {
    if (!line.name) problems.push({ level: ERROR, where: 'help-lines.json', text: 'a line has no name' });
    else if (!line.number && !line.detail) problems.push({ level: ERROR, where: `help-lines.json · ${line.name}`, text: 'has neither a number nor a description' });
  }

  // ── How long before a child sees the same thing twice ────────────────────
  //
  // The app deals rather than shuffles, so a bank lasts exactly as long as its
  // size divided by what a day consumes. That is the number worth watching:
  // "it is getting repetitive" should be visible here before a child says it.
  const rotation = [];
  const run = (what, rows, band) => {
    const round = games.find((one) => one.id === ROUNDS[what]);
    const bank = onTopic(eligible(rows, band), round && round.topics);
    const perDay = PER_DAY[what];
    const { days } = cycleOf(bank, { count: perDay });
    rotation.push({ what, band, total: bank.length, perDay, days });
    if (days < THIN && !DRILLS.has(what)) {
      problems.push({ level: WARN, where: `${what} · ${band}`,
        text: `only ${days} day${days === 1 ? '' : 's'} of material before it comes round again (${bank.length} items, ${perDay} a day)` });
    }
  };
  for (const band of ['kids', 'teens']) {
    run('Daily word', daily, band);
    run('Bible quiz', quiz, band);
    run('Speed quiz', quiz, band);
    run('Our church', quiz, band);
    run('Who am I?', who, band);
    run('Verse builder', verses, band);
    run('Crossword', crosswords, band);
  }

  return { problems, counts, rotation };
}

/** Every authored file, in the order the dashboard lists them. */
export const FILES = [
  'daily.json', 'journeys.json', 'real-life.json', 'games.json',
  'games/quiz.json', 'games/who-am-i.json', 'games/verse-builder.json', 'games/crossword.json',
  'events.json', 'achievements.json', 'help-lines.json',
  'bible-books.json', 'bible-find.json',
];
