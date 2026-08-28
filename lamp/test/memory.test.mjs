import test from 'node:test';
import assert from 'node:assert/strict';
import { advance, grade, cloze, normalise, STAGES, INTERVALS, STAGE_LABEL } from '../js/core/memory.js';

const NOW = new Date('2026-08-26T09:00:00Z');
const days = (from, to) => Math.round((new Date(to) - from) / 86400000);

test('passing moves one stage on and schedules the next review', () => {
  let verse = { ref: 'PHP.4.13', stage: 'learn', due: NOW.toISOString(), attempts: 0, correct: 0 };
  verse = advance(verse, true, NOW);
  assert.equal(verse.stage, 'listen');
  assert.equal(verse.attempts, 1);
  assert.equal(verse.correct, 1);
  assert.equal(days(NOW, verse.due), INTERVALS[1]);

  for (const expected of ['practice', 'challenge', 'mastered']) {
    verse = advance(verse, true, NOW);
    assert.equal(verse.stage, expected);
  }
  // Mastered is the ceiling, not a trapdoor into an error.
  verse = advance(verse, true, NOW);
  assert.equal(verse.stage, 'mastered');
});

test('a miss moves back one stage, never to zero', () => {
  let verse = { ref: 'PSA.23.1', stage: 'challenge', due: NOW.toISOString(), attempts: 3, correct: 3 };
  verse = advance(verse, false, NOW);
  assert.equal(verse.stage, 'practice', 'one step back, not back to the start');
  assert.equal(verse.correct, 3, 'a miss does not remove past successes');

  let beginner = { ref: 'JHN.3.16', stage: 'learn', due: NOW.toISOString() };
  beginner = advance(beginner, false, NOW);
  assert.equal(beginner.stage, 'learn', 'the first stage is the floor');
});

test('every stage has a label a child can read', () => {
  for (const stage of STAGES) assert.ok(STAGE_LABEL[stage], stage);
});

test('grading forgives punctuation, case and about one character in ten', () => {
  const verse = 'I can do all things through Christ who strengthens me';
  assert.ok(grade('i can do all things through christ who strengthens me', verse).pass);
  assert.ok(grade('I can do all things, through Christ — who strengthens me!', verse).pass);
  assert.ok(grade('I can do all things through Christ who strengthns me', verse).pass, 'one typo is forgiven');
  assert.ok(!grade('I can do nothing at all without help from anyone', verse).pass);
  assert.ok(!grade('', verse).pass);
  assert.equal(normalise('  The   LORD’s   way! '), "the lord's way");
});

test('cloze blanks are stable for the same seed and never blank everything', () => {
  const text = 'For God so loved the world that he gave his one and only Son';
  const first = cloze(text, 3, 'JHN.3.16');
  const again = cloze(text, 3, 'JHN.3.16');
  assert.deepEqual(first.blanks, again.blanks, 'same puzzle when a child comes back');
  assert.equal(first.blanks.length, 3);
  assert.equal(new Set(first.blanks).size, 3, 'no repeated blanks');
  assert.ok(first.blanks.every((i) => first.words[i].length > 3), 'only substantial words are blanked');
  assert.ok(first.blanks.length < first.words.length);

  const patterns = new Set(['PSA.23.1', 'ROM.8.28', 'GAL.5.22', 'MIC.6.8', 'HEB.11.1']
    .map((ref) => cloze(text, 3, ref).blanks.join(',')));
  assert.ok(patterns.size > 1, 'different verses do not all get the same puzzle');
});
