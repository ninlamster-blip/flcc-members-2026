// The audit is what a ministry leader sees instead of a test run. If it ever
// reports the shipped content as broken — or, worse, passes content that is —
// this suite fails first.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { audit, FILES } from '../js/admin/audit.js';

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

test('the unverified help lines are flagged until someone checks them', () => {
  const warned = audit(bundle()).problems
    .filter((problem) => problem.level === 'warning' && problem.where === 'help-lines.json');
  assert.equal(warned.length, 1);
  assert.match(warned[0].text, /unverified/);
});
