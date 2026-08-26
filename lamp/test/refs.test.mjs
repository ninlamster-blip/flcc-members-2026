import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRef, refId, formatRef, stepChapter, prettyRef } from '../js/core/refs.js';
import { BOOKS } from '../js/core/books.js';

test('the canon is 66 books in order, numbered for the text API', () => {
  assert.equal(BOOKS.length, 66);
  assert.equal(BOOKS[0].id, 'GEN');
  assert.equal(BOOKS[65].id, 'REV');
  assert.equal(BOOKS.filter((b) => b.testament === 'OT').length, 39);
  assert.equal(BOOKS.filter((b) => b.testament === 'NT').length, 27);
  BOOKS.forEach((book, index) => assert.equal(book.number, index + 1));
});

test('references a child might actually type', () => {
  const cases = [
    ['john 3:16', 'JHN.3.16'],
    ['John 3:16-17', 'JHN.3.16-17'],
    ['1 sam 17', '1SA.17'],
    ['1jn 4:7-8', '1JN.4.7-8'],
    ['2 cor 5:17', '2CO.5.17'],
    ['iii john 1:4', '3JN.1.4'],
    ['psalm 119:105', 'PSA.119.105'],
    ['Revelation 22:21', 'REV.22.21'],
    ['1 thess 5:16', '1TH.5.16'],
    ['JHN.3.16', 'JHN.3.16'],
    ['Gen 1', 'GEN.1'],
  ];
  for (const [input, expected] of cases) {
    const ref = parseRef(input);
    assert.ok(ref, `should parse "${input}"`);
    assert.equal(refId(ref), expected, input);
  }
});

test('nonsense and out-of-range references are refused', () => {
  assert.equal(parseRef('nope 4'), null);
  assert.equal(parseRef(''), null);
  assert.equal(parseRef('John 99:1'), null, 'John has 21 chapters');
  assert.equal(parseRef('Jude 2'), null, 'Jude has one chapter');
});

test('formatting is human and reversible', () => {
  assert.equal(formatRef(parseRef('jn 3:16')), 'John 3:16');
  assert.equal(formatRef(parseRef('1sa 17:45-47')), '1 Samuel 17:45–47');
  assert.equal(prettyRef('psalm 23'), 'Psalms 23');
  assert.equal(refId(parseRef(formatRef(parseRef('2 tim 2:15')))), '2TI.2.15');
});

test('chapters step across book boundaries and stop at the ends', () => {
  const next = stepChapter('JHN', 21, 1);
  assert.equal(next.book.id, 'ACT');
  assert.equal(next.chapter, 1);
  const back = stepChapter('MAT', 1, -1);
  assert.equal(back.book.id, 'MAL');
  assert.equal(back.chapter, 4);
  assert.equal(stepChapter('GEN', 1, -1), null);
  assert.equal(stepChapter('REV', 22, 1), null);
});
