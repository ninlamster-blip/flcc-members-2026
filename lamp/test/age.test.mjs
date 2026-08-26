import test from 'node:test';
import assert from 'node:assert/strict';
import { bandForAge, bandForBirthYear, ageFromBirthYear, pick, BANDS } from '../js/core/age.js';

test('every age between 7 and 18 lands on exactly one band', () => {
  for (let age = 7; age <= 18; age++) assert.ok(BANDS.includes(bandForAge(age)), `age ${age}`);
  assert.equal(bandForAge(7), '7-10');
  assert.equal(bandForAge(10), '7-10');
  assert.equal(bandForAge(11), '11-14');
  assert.equal(bandForAge(14), '11-14');
  assert.equal(bandForAge(15), '15-18');
  assert.equal(bandForAge(18), '15-18');
});

test('ages outside the range clamp rather than break', () => {
  assert.equal(bandForAge(4), '7-10');
  assert.equal(bandForAge(25), '15-18');
  assert.equal(bandForAge('nonsense'), '11-14');
});

test('a birth year is enough to know the band', () => {
  const now = new Date('2026-08-26T00:00:00Z');
  assert.equal(ageFromBirthYear(2014, now), 12);
  assert.equal(bandForBirthYear(2014, now), '11-14');
  assert.equal(bandForBirthYear(2018, now), '7-10');
  assert.equal(bandForBirthYear(2009, now), '15-18');
});

test('pick falls back downward, never to nothing', () => {
  const all = { '7-10': 'a', '11-14': 'b', '15-18': 'c' };
  assert.equal(pick(all, '15-18'), 'c');
  assert.equal(pick({ '7-10': 'a' }, '15-18'), 'a');
  assert.equal(pick({ '11-14': 'b' }, '15-18'), 'b');
  assert.equal(pick({ '15-18': 'c' }, '7-10'), 'c');
  assert.equal(pick('plain string', '7-10'), 'plain string');
  assert.equal(pick(null, '7-10'), null);
});
