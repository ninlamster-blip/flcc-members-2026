// The library is what lets a ministry leader add content without a developer,
// which means it is also what can quietly lose their work. The merge is pure,
// so this suite pins down every case: an edit that must survive, a removal that
// must not come back, and an import that must not overwrite what was already
// here.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import * as library from '../js/core/library.js';
import * as store from '../js/core/storage.js';
import { hasSymbol, TONES } from '../js/core/art.js';

const read = (path) => JSON.parse(readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8'));
const quiz = library.kindOf('quiz');
const fresh = () => store.remove(store.KEYS.library);

test('a kind exists for every authored file, and every file for a kind', () => {
  const onDisk = new Set(readdirSync(new URL('../content/', import.meta.url))
    .filter((name) => name.endsWith('.json'))
    .concat(readdirSync(new URL('../content/games/', import.meta.url)).map((name) => `games/${name}`)));

  for (const kind of library.KINDS) {
    assert.ok(onDisk.has(kind.file), `${kind.id} points at ${kind.file}, which is not there`);
    assert.ok(kind.fields.length, `${kind.id} has no fields to edit`);
    assert.equal(typeof kind.key, 'function');
    assert.equal(typeof kind.blank, 'function');
  }
  for (const file of onDisk) {
    assert.ok(library.kindForFile(file), `${file} cannot be edited from the dashboard — it needs a kind`);
  }
});

test('every journey has an editable lesson kind', () => {
  for (const journey of read('journeys.json')) {
    const kind = library.kindForFile(`journeys/${journey.id}.json`);
    assert.ok(kind, `${journey.id} lessons cannot be edited`);
    assert.equal(kind.id, `lessons:${journey.id}`);
  }
});

test("a kind's blank row carries every field it declares", () => {
  for (const kind of library.KINDS.concat([library.lessonKind('life-of-jesus')])) {
    const blank = kind.blank();
    for (const field of kind.fields) {
      assert.notEqual(library.get(blank, field.path), undefined,
        `${kind.id}: a new ${kind.one} has nothing at ${field.path}`);
    }
  }
});

test('paths read and write through nested objects', () => {
  const row = {};
  library.set(row, 'quiz.q.kids', 'Who?');
  assert.equal(library.get(row, 'quiz.q.kids'), 'Who?');
  assert.equal(library.get(row, 'quiz.q.teens'), undefined);
  assert.equal(library.get(row, 'nothing.at.all'), undefined);
});

test('merge adds, replaces and removes, and leaves the base alone otherwise', () => {
  const base = [{ q: 'one' }, { q: 'two' }, { q: 'three' }];
  const key = (row) => row.q;

  assert.deepEqual(library.merge(base, {}, key), base);
  assert.deepEqual(library.merge(base, { added: [{ q: 'four' }] }, key).map(key),
    ['one', 'two', 'three', 'four']);
  assert.deepEqual(library.merge(base, { removed: ['two'] }, key).map(key), ['one', 'three']);
  assert.deepEqual(library.merge(base, { edited: { two: { q: 'two', why: 'edited' } } }, key)[1],
    { q: 'two', why: 'edited' });

  // A removal beats an edit of the same row: the leader's last word was "out".
  assert.deepEqual(
    library.merge(base, { removed: ['two'], edited: { two: { q: 'two' } } }, key).map(key),
    ['one', 'three']);

  // The base array is never mutated — the app reads it again next time.
  library.merge(base, { added: [{ q: 'x' }], removed: ['one'] }, key);
  assert.equal(base.length, 3);
});

test('an edit survives a round trip through storage and reaches the app', () => {
  fresh();
  const base = read('games/quiz.json');
  const first = base[0];

  library.editRow(quiz, quiz.key(first), { ...first, why: 'A different explanation.' });
  const after = library.apply('games/quiz.json', base);

  assert.equal(after.length, base.length, 'an edit must not change how many there are');
  assert.equal(after[0].why, 'A different explanation.');
  assert.equal(after[0].q, first.q);
  assert.equal(base[0].why, first.why, 'the committed file is never rewritten');
  fresh();
});

test('a question added on the dashboard is dealt by the game', () => {
  fresh();
  const base = read('games/quiz.json');
  const added = library.addRow(quiz, {
    q: 'What is the name of this church?', options: ['FLCC', 'Somewhere else', 'Nowhere'],
    answer: 0, why: 'Ours.', ageGroup: 'both', topic: 'flcc',
  });

  const after = library.apply('games/quiz.json', base);
  assert.equal(after.length, base.length + 1);
  assert.ok(after.some((row) => row.q === added.q));

  // And it can be taken back out again.
  library.removeRow(quiz, quiz.key(added));
  assert.equal(library.apply('games/quiz.json', base).length, base.length);
  fresh();
});

test('editing a row that this device added changes it rather than duplicating it', () => {
  fresh();
  const base = read('games/quiz.json');
  const added = library.addRow(quiz, { ...quiz.blank(), q: 'First wording' });
  library.editRow(quiz, 'First wording', { ...added, why: 'Now with a reason.' });

  const after = library.apply('games/quiz.json', base);
  const mine = after.filter((row) => row.q === 'First wording');
  assert.equal(mine.length, 1, 'the pack must not carry the same row twice');
  assert.equal(mine[0].why, 'Now with a reason.');
  fresh();
});

test('a removed row is hidden, not deleted, and can be put back', () => {
  fresh();
  const base = read('games/quiz.json');
  const key = quiz.key(base[3]);

  library.removeRow(quiz, key);
  assert.equal(library.apply('games/quiz.json', base).length, base.length - 1);
  assert.deepEqual(library.removedOf(quiz, base).map(quiz.key), [key]);

  library.restoreRow(quiz, key);
  assert.equal(library.apply('games/quiz.json', base).length, base.length);
  fresh();
});

test('a file with its rows nested — help-lines — merges in place', () => {
  fresh();
  const kind = library.kindOf('help-lines');
  const base = read('help-lines.json');
  library.addRow(kind, { name: 'A youth leader', number: '', detail: 'Someone at church who knows you.' });

  const after = library.apply('help-lines.json', base);
  assert.equal(after.verifyBeforeLaunch, base.verifyBeforeLaunch, 'the rest of the file is untouched');
  assert.equal(after.lines.length, base.lines.length + 1);
  assert.equal(after.lines.at(-1).name, 'A youth leader');
  fresh();
});

test('rowsOf says which rows are shipped, edited and added', () => {
  fresh();
  const base = read('games/quiz.json');
  library.editRow(quiz, quiz.key(base[1]), { ...base[1], why: 'Changed.' });
  library.addRow(quiz, { ...quiz.blank(), q: 'Brand new' });

  const rows = library.rowsOf(quiz, base);
  assert.equal(rows.filter((one) => one.state === 'edited').length, 1);
  assert.equal(rows.filter((one) => one.state === 'added').length, 1);
  assert.equal(rows.filter((one) => one.state === 'shipped').length, base.length - 1);
  fresh();
});

test('resetting puts a file back exactly as it was committed', () => {
  fresh();
  const base = read('games/quiz.json');
  library.addRow(quiz, { ...quiz.blank(), q: 'Temporary' });
  library.removeRow(quiz, quiz.key(base[0]));
  library.editRow(quiz, quiz.key(base[2]), { ...base[2], why: 'Changed.' });
  assert.equal(library.summary().total, 3);

  library.resetFile('games/quiz.json');
  assert.deepEqual(library.apply('games/quiz.json', base), base);
  assert.equal(library.summary().total, 0);
  fresh();
});

test('importing a pack lays it on top rather than throwing work away', () => {
  fresh();
  library.addRow(quiz, { ...quiz.blank(), q: 'Mine' });

  library.importPack(JSON.stringify({
    version: 1,
    files: { 'games/quiz.json': { added: [{ ...quiz.blank(), q: 'Theirs' }], edited: {}, removed: [] } },
  }));

  const questions = library.apply('games/quiz.json', []).map((row) => row.q);
  assert.deepEqual(questions, ['Mine', 'Theirs']);

  // Replacing is a separate, explicit choice.
  library.importPack(JSON.stringify({
    version: 1,
    files: { 'games/quiz.json': { added: [{ ...quiz.blank(), q: 'Only theirs' }], edited: {}, removed: [] } },
  }), { replace: true });
  assert.deepEqual(library.apply('games/quiz.json', []).map((row) => row.q), ['Only theirs']);
  fresh();
});

test('importing the same pack twice does not double its rows', () => {
  fresh();
  const pack = JSON.stringify({
    version: 1,
    files: { 'games/quiz.json': { added: [{ ...quiz.blank(), q: 'Once' }], edited: {}, removed: [] } },
  });
  library.importPack(pack);
  library.importPack(pack);
  assert.equal(library.apply('games/quiz.json', []).length, 1);
  fresh();
});

test('anything that is not a pack is refused with a reason', () => {
  assert.throws(() => library.readPack('not json'), /not JSON/i);
  assert.throws(() => library.readPack('[1,2,3]'), /not an FLCC NEXT content pack/i);
  assert.throws(() => library.readPack('{"files":{}}'), /nothing in it/i);
  // A file this version has never heard of is dropped, not applied blindly.
  assert.throws(() => library.readPack('{"files":{"made-up.json":{"added":[]}}}'), /nothing in it/i);
});

test('a file the editor does not know passes straight through', () => {
  fresh();
  const untouched = [{ a: 1 }];
  assert.equal(library.apply('something-else.json', untouched), untouched);
});

test('every colour and illustration the editor offers actually exists', () => {
  const palette = new Set([...TONES, 'paper', 'ink']);
  for (const kind of library.KINDS) {
    for (const field of kind.fields) {
      if (field.type !== 'choice') continue;
      if (field.path === 'tone') for (const one of field.options) assert.ok(palette.has(one), `${kind.id}: ${one}`);
      if (field.path === 'symbol') for (const one of field.options) assert.ok(hasSymbol(one), `${kind.id}: ${one}`);
    }
  }
});
