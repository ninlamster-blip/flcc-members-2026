// The audit is what a ministry leader sees instead of a test run. If it ever
// reports the shipped content as broken — or, worse, passes content that is —
// this suite fails first.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { audit, FILES, PER_DAY, THIN, DRILLS, LOCAL } from '../js/admin/audit.js';

const read = (path) => JSON.parse(readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8'));

function bundle(overrides = {}) {
  const loaded = {};
  for (const name of FILES) loaded[name] = read(name);
  for (const journey of loaded['journeys.json']) {
    loaded[`journeys/${journey.id}.json`] = read(`journeys/${journey.id}.json`);
  }
  return { ...loaded, ...overrides };
}

const errors = (result) => result.problems.filter((problem) => problem.level === 'error');

test('the shipped content passes its own audit', () => {
  const result = audit(bundle());
  assert.deepEqual(errors(result), [], JSON.stringify(errors(result), null, 2));
});

test('the counts add up to what is actually in the files', () => {
  const { counts } = audit(bundle());
  assert.equal(counts['Daily words'], read('daily.json').length);
  assert.equal(counts.Journeys, read('journeys.json').length);
  assert.equal(counts.Lessons, read('journeys.json')
    .reduce((sum, journey) => sum + read(`journeys/${journey.id}.json`).length, 0));
  assert.equal(counts.Games, read('games.json').length);
  assert.equal(counts['Crossword puzzles'], read('games/crossword.json').length);
});

test('a missing age variant is an error, not a shrug', () => {
  const topics = read('real-life.json').map((topic, i) => (i ? topic : { ...topic, body: { kids: topic.body.kids } }));
  const result = audit(bundle({ 'real-life.json': topics }));
  assert.ok(errors(result).some((problem) => /missing the teens version/.test(problem.text)));
});

test('a lesson count that lies about its own file is caught', () => {
  const journeys = read('journeys.json').map((journey, i) => (i ? journey : { ...journey, lessons: 99 }));
  const result = audit(bundle({ 'journeys.json': journeys }));
  assert.ok(errors(result).some((problem) => /says 99 lessons/.test(problem.text)));
});

test('a quiz answer that is not among its options is caught', () => {
  const quiz = read('games/quiz.json').map((row, i) => (i ? row : { ...row, answer: 9 }));
  const result = audit(bundle({ 'games/quiz.json': quiz }));
  assert.ok(errors(result).some((problem) => /not in its options/.test(problem.text)));
});

test('a crossword answer that cannot be placed is caught', () => {
  const puzzles = read('games/crossword.json').map((puzzle, i) => (
    i ? puzzle : { ...puzzle, words: [{ answer: 'MOSES', clue: 'Led them out of Egypt' }, { answer: 'FIG', clue: 'A tree Jesus spoke about' }] }));
  const result = audit(bundle({ 'games/crossword.json': puzzles }));
  assert.ok(errors(result).some((problem) => /crosses nothing/.test(problem.text)));
});

test('an unknown colour or a missing illustration is caught', () => {
  const events = read('events.json').map((event, i) => (i ? event : { ...event, tone: 'purple', symbol: 'sparkles' }));
  const result = audit(bundle({ 'events.json': events }));
  assert.ok(errors(result).some((problem) => /unknown colour "purple"/.test(problem.text)));
  assert.ok(errors(result).some((problem) => /no illustration called "sparkles"/.test(problem.text)));
});

test('a file that fails to load is reported rather than crashing the page', () => {
  const result = audit({});
  assert.ok(errors(result).length >= FILES.length);
  assert.ok(errors(result).every((problem) => problem.where && problem.text));
});

test('help lines signed off by a named person raise nothing', () => {
  const warned = audit(bundle()).problems
    .filter((problem) => problem.level === 'warning' && problem.where === 'help-lines.json');
  assert.deepEqual(warned, [], 'a verified, signed file should be quiet');
});

test('an unverified or unsigned help-line file is flagged', () => {
  const base = read('help-lines.json');

  const unverified = audit(bundle({ 'help-lines.json': { ...base, verifyBeforeLaunch: true } })).problems
    .filter((problem) => problem.where === 'help-lines.json');
  assert.equal(unverified.length, 1);
  assert.match(unverified[0].text, /unverified/);

  // The failure mode that looks like success: the flag deleted, nobody named.
  const unsigned = { ...base, verifyBeforeLaunch: false };
  delete unsigned.verifiedBy;
  const flagged = audit(bundle({ 'help-lines.json': unsigned })).problems
    .filter((problem) => problem.where === 'help-lines.json');
  assert.equal(flagged.length, 1);
  assert.match(flagged[0].text, /nobody is named/);
});

// ── Rotation ───────────────────────────────────────────────────────────────

test('no bank we can write ourselves runs dry inside a fortnight', () => {
  const { rotation } = audit(bundle());
  assert.ok(rotation.length, 'the audit should report rotation at all');
  for (const run of rotation) {
    if (DRILLS.has(run.what)) continue;          // a speed drill is meant to repeat
    if (LOCAL.has(run.what)) continue;           // only the church can write these
    assert.ok(run.days >= THIN,
      `${run.what} (${run.band}) lasts ${run.days} days on ${run.total} items — add more`);
  }
});

test('the church-authored bank is still measured and still warned about', () => {
  // Exempt from the suite, not from the dashboard: a thin bank is thin whether
  // or not this repository is the thing that can fix it.
  const { rotation, problems } = audit(bundle());
  const local = rotation.filter((run) => LOCAL.has(run.what));
  assert.ok(local.length, 'the church bank should still be measured');
  for (const run of local) {
    if (run.days >= THIN) continue;
    assert.ok(problems.some((problem) => problem.where === `${run.what} · ${run.band}` && /comes round again/.test(problem.text)),
      `${run.what} (${run.band}) is thin but the dashboard says nothing`);
  }
});

test('both age groups get their own material, not the teens bank filtered down', () => {
  const { rotation } = audit(bundle());
  for (const band of ['kids', 'teens']) {
    const runs = rotation.filter((run) => run.band === band);
    assert.equal(runs.length, Object.keys(PER_DAY).length, `${band} is missing a bank`);
    for (const run of runs) assert.ok(run.total > 0, `${band} has nothing in ${run.what}`);
  }
});

test('the audit deals the same amounts the games actually deal', () => {
  // If a game changes how much it hands out per round and this table is not
  // updated with it, every run length on the dashboard becomes a lie.
  const source = readFileSync(new URL('../js/screens/game.js', import.meta.url), 'utf8');
  const sizes = {
    'Bible quiz': /title = 'Bible quiz', size = (\d+) \} = \{\}/,
    'Speed quiz': /if \(timed\) size = (\d+);/,
    'Our church': /title: 'Our church', size: (\d+) \}/,
    'Who am I?': /deal\(all, \{ count: (\d+), offset: OFFSET\['who-am-i'\] \}\)/,
    'Verse builder': /deal\(all, \{ count: (\d+), offset: OFFSET\['verse-builder'\] \}\)/,
  };
  for (const [what, pattern] of Object.entries(sizes)) {
    const found = source.match(pattern);
    assert.ok(found, `could not find how much ${what} deals`);
    assert.equal(Number(found[1]), PER_DAY[what], `${what}: the screen deals ${found[1]}, the audit assumes ${PER_DAY[what]}`);
  }
  assert.equal(PER_DAY.Crossword, 1, 'the crossword is one puzzle a day');
  assert.equal(PER_DAY['Daily word'], 1, 'the daily word is one a day');
});

test('a bank that shrinks is reported as repetitive', () => {
  const thin = read('games/who-am-i.json').slice(0, 6);      // 6 items, 5 a day = 1 day
  const { problems } = audit(bundle({ 'games/who-am-i.json': thin }));
  assert.ok(problems.some((problem) => /comes round again/.test(problem.text)),
    'a one-day bank should be flagged');
});
