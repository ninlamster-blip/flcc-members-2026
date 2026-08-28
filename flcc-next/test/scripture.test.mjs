// The Bible that ships with the app.
//
// Two jobs. First, that the built text is a whole Bible rather than a mostly
// whole one — a missing chapter would only be found by a child who went
// looking for it. Second, that every reference the authored content quotes
// actually resolves, because a "where do I look?" list that opens on nothing
// is worse than not offering it.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import * as scripture from '../js/core/scripture.js';

const bible = JSON.parse(readFileSync(new URL('../bible/books.json', import.meta.url), 'utf8'));
const content = (path) => JSON.parse(readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8'));
const book = (code, n) => JSON.parse(readFileSync(new URL(`../bible/${code}/${n}.json`, import.meta.url), 'utf8'));

const CHAPTERS = 1189;      // the canonical total, Genesis 1 to Revelation 22

test('the manifest describes 66 books and the translations that carry them', () => {
  assert.equal(bible.books.length, 66);
  assert.equal(bible.books.filter((one) => one.testament === 'old').length, 39);
  assert.equal(bible.books.filter((one) => one.testament === 'new').length, 27);
  assert.equal(bible.books.reduce((sum, one) => sum + one.chapters, 0), CHAPTERS);

  assert.ok(bible.translations.length >= 2, 'a reader should have something to switch to');
  for (const one of bible.translations) {
    assert.ok(one.code && one.name && one.short && one.language, `${one.code}: incomplete`);
    assert.match(one.licence, /public domain/i, `${one.name} must be free to redistribute`);
  }
  assert.ok(bible.translations.some((one) => one.code === scripture.DEFAULT_CODE), 'the default must exist');

  for (const one of bible.books) {
    assert.ok(one.n >= 1 && one.n <= 66 && one.name && one.chapters > 0, `book ${one.n}: incomplete`);
    assert.ok(one.tagalog, `${one.name} has no Tagalog name`);
  }
});

test('every book of every translation is on disk and complete', () => {
  for (const translation of bible.translations) {
    let verses = 0;
    for (const entry of bible.books) {
      const path = new URL(`../bible/${translation.code}/${entry.n}.json`, import.meta.url);
      assert.ok(existsSync(path), `${translation.short} is missing ${entry.name}`);
      const data = book(translation.code, entry.n);
      assert.equal(data.chapters.length, entry.chapters,
        `${translation.short} ${entry.name}: ${data.chapters.length} chapters, expected ${entry.chapters}`);
      for (const [i, rows] of data.chapters.entries()) {
        assert.ok(rows.length, `${translation.short} ${entry.name} ${i + 1} is empty`);
      }
      verses += data.chapters.reduce((sum, rows) => sum + rows.filter(Boolean).length, 0);
    }
    // Every printed Bible lands near 31,100 verses; anything far off means the
    // parse dropped something.
    assert.ok(verses > 30500 && verses < 31500, `${translation.short} has ${verses} verses`);
  }
});

test('the first and last verse of the Bible read correctly', () => {
  const genesis = book('web', 1).chapters[0][0];
  assert.match(genesis, /^In the beginning, God created/);
  const revelation = book('web', 66).chapters[21].at(-1);
  assert.match(revelation, /grace of the Lord Jesus/i);
  assert.match(book('tgl', 43).chapters[2][15], /Sapagka.t gayon na lamang/);
});

test('references resolve — English, Tagalog, and the abbreviations people type', () => {
  const cases = [
    ['John 3:16', 'John', 3, 16],
    ['john 3', 'John', 3, null],
    ['1 John 4:8', '1 John', 4, 8],
    ['1 jn 4:8', '1 John', 4, 8],
    ['I John 4:8', '1 John', 4, 8],
    ['Ps 119:105', 'Psalms', 119, 105],
    ['Psalm 23', 'Psalms', 23, null],
    ['Mga Awit 23', 'Psalms', 23, null],
    ['Juan 3:16', 'John', 3, 16],
    ['Apocalipsis 21:4', 'Revelation', 21, 4],
    ['Mga Kawikaan 3:5', 'Proverbs', 3, 5],
    ['gn 1:1', 'Genesis', 1, 1],
    ['2 tim 1:7', '2 Timothy', 1, 7],
    ['sos 2:1', 'Song of Solomon', 2, 1],
    ['matt 6:9-13', 'Matthew', 6, 9],
  ];
  for (const [text, name, chapter, verse] of cases) {
    const found = scripture.parseRef(text, bible.books);
    assert.ok(found, `"${text}" did not resolve`);
    assert.equal(found.book.name, name, `"${text}" → ${found.book.name}`);
    assert.equal(found.chapter, chapter, `"${text}" chapter`);
    assert.equal(found.verse, verse, `"${text}" verse`);
  }

  // The two genuinely ambiguous short forms resolve the way print does.
  assert.equal(scripture.parseRef('phil 4:13', bible.books).book.name, 'Philippians');
  assert.equal(scripture.parseRef('philemon 1', bible.books).book.name, 'Philemon');
  assert.equal(scripture.parseRef('jud 6', bible.books).book.name, 'Judges');
  assert.equal(scripture.parseRef('jude 1', bible.books).book.name, 'Jude');

  assert.equal(scripture.parseRef('', bible.books), null);
  assert.equal(scripture.parseRef('not a book 3:16', bible.books), null);
});

test('a chapter beyond a book is clamped rather than opening on nothing', () => {
  const found = scripture.parseRef('Jude 40', bible.books);
  assert.equal(found.book.name, 'Jude');
  assert.equal(found.chapter, 1, 'Jude has one chapter');
});

test('every reference the content quotes points at a verse that exists', () => {
  const refs = [];
  for (const topic of content('bible-find.json')) {
    for (const ref of topic.refs) refs.push([`bible-find · ${topic.id}`, ref]);
  }
  for (const journey of content('journeys.json')) {
    for (const lesson of content(`journeys/${journey.id}.json`)) refs.push([lesson.id, lesson.ref]);
  }

  assert.ok(refs.length > 60, 'the content should be quoting plenty of Scripture');
  for (const [where, ref] of refs) {
    const found = scripture.parseRef(ref, bible.books);
    assert.ok(found, `${where}: "${ref}" cannot be resolved`);
    const rows = book('web', found.book.n).chapters[found.chapter - 1];
    assert.ok(rows, `${where}: ${ref} — no such chapter`);
    const from = found.verse || 1;
    const to = found.verse ? (found.verseEnd || found.verse) : rows.length;
    assert.ok(rows[from - 1], `${where}: ${ref} — verse ${from} is not there`);
    assert.ok(to <= rows.length, `${where}: ${ref} runs past the end of the chapter`);
  }
});

test('the lessons quote the translation the app ships', () => {
  // Tapping a lesson's reference opens the Bible, so a lesson quoting some
  // other translation would show the child two different sentences.
  //
  // A lesson may quote part of a long verse — the first half of 1 Samuel
  // 17:45, the last line of Esther 4:14 — because a whole verse of Samuel does
  // not fit on a poster. What it may not do is say something the verse does
  // not say, so the check is that the lesson's words are IN the verse, not
  // that they are all of it.
  const bare = (text) => String(text).replace(/[“”"'’.,;:!?\s]+$/, '').trim();

  for (const journey of content('journeys.json')) {
    for (const lesson of content(`journeys/${journey.id}.json`)) {
      const found = scripture.parseRef(lesson.ref, bible.books);
      const rows = book('web', found.book.n).chapters[found.chapter - 1];
      const from = found.verse || 1;
      const to = found.verseEnd || from;
      const passage = [];
      for (let n = from; n <= to; n++) if (rows[n - 1]) passage.push(rows[n - 1]);

      const quoted = bare(lesson.text);
      const actual = bare(passage.join(' '));
      assert.ok(actual.includes(quoted),
        `${lesson.id} (${lesson.ref}) is not the World English Bible\n  lesson: ${quoted.slice(0, 90)}\n  verse : ${actual.slice(0, 90)}`);
      assert.ok(quoted.length >= Math.min(40, actual.length),
        `${lesson.id} (${lesson.ref}) quotes too little of the verse to stand alone`);
    }
  }
});

test('the guide describes all 66 books, once each', () => {
  const lines = content('bible-books.json');
  assert.equal(lines.length, 66);
  const numbers = new Set(lines.map((one) => one.n));
  assert.equal(numbers.size, 66, 'a book is described twice');
  for (const one of lines) {
    assert.ok(one.n >= 1 && one.n <= 66, `${one.n} is not a book`);
    assert.ok(String(one.about || '').trim().length > 20, `book ${one.n}: the line is too thin to help`);
  }
});
