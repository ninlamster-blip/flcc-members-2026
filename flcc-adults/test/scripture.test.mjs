// Scripture, and the writing that quotes it.
//
// Three jobs. That the shared Bible is where this app thinks it is; that every
// reference the authored writing uses actually resolves; and — the one that
// matters most — that every verse this app prints is word for word what the
// shipped translation says. A devotional that misquotes Scripture is worse
// than a devotional that omits it, and no reviewer can catch a dropped clause
// by eye across forty passages.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, readdirSync } from 'node:fs';
import * as scripture from '../js/core/scripture.js';

const BIBLE = new URL('../../flcc-next/bible/', import.meta.url);
const bible = JSON.parse(readFileSync(new URL('books.json', BIBLE), 'utf8'));
const content = (path) => JSON.parse(readFileSync(new URL(`../content/${path}`, import.meta.url), 'utf8'));
const book = (code, n) => JSON.parse(readFileSync(new URL(`${code}/${n}.json`, BIBLE), 'utf8'));

test('the shared Bible is where the app says it is', () => {
  // scripture.js states the path once. If it moves, this fails rather than the
  // app quietly losing Scripture in a browser nobody is watching.
  assert.equal(scripture.BIBLE, '../../../flcc-next/bible/');
  assert.ok(existsSync(new URL('books.json', BIBLE)), 'the shared Bible is missing');
  assert.equal(bible.books.length, 66);
  assert.ok(bible.translations.some((one) => one.code === scripture.DEFAULT_CODE));
});

/** Every reference printed anywhere in this app's authored writing. */
function everyReference() {
  const found = [];
  const add = (ref, where, text = null) => { if (ref) found.push({ ref, where, text }); };

  for (const moment of content('moments.json')) add(moment.ref, `moments/${moment.id}`, moment.text);
  for (const file of readdirSync(new URL('../content/paths/', import.meta.url))) {
    for (const session of content(`paths/${file}`)) add(session.ref, `${file}/${session.id}`, session.text);
  }
  for (const guide of content('prayer-guides.json')) add(guide.ref, `guides/${guide.id}`);
  for (const plan of content('reading-plans.json')) {
    plan.days.forEach((day, i) => add(day.ref, `${plan.id}/day ${i + 1}`));
  }
  return found;
}

test('every reference the writing quotes resolves to a real passage', () => {
  const refs = everyReference();
  assert.ok(refs.length >= 60, `only found ${refs.length} references — has the content moved?`);
  for (const { ref, where } of refs) {
    const parsed = scripture.parseRef(ref, bible.books);
    assert.ok(parsed, `${where}: "${ref}" does not parse`);
    const data = book(scripture.DEFAULT_CODE, parsed.book.n);
    const rows = data.chapters[parsed.chapter - 1];
    assert.ok(rows, `${where}: ${ref} — no chapter ${parsed.chapter} in ${parsed.book.name}`);
    if (parsed.verse) assert.ok(rows[parsed.verse - 1] !== undefined, `${where}: ${ref} — no verse ${parsed.verse}`);
  }
});

test('every verse the writing prints is word for word the shipped text', () => {
  const quoted = everyReference().filter((one) => one.text);
  assert.ok(quoted.length >= 30, `only ${quoted.length} quoted passages`);
  for (const { ref, where, text } of quoted) {
    const parsed = scripture.parseRef(ref, bible.books);
    const rows = book(scripture.DEFAULT_CODE, parsed.book.n).chapters[parsed.chapter - 1];
    const from = parsed.verse || 1;
    const to = parsed.verseEnd || parsed.verse || rows.length;
    const shipped = rows.slice(from - 1, to).filter(Boolean).join(' ');
    assert.equal(text, shipped, `${where} (${ref}) does not match the World English Bible`);
  }
});

test('a reference is written out the way a reader would write it', () => {
  const john = bible.books.find((one) => one.n === 43);
  assert.equal(scripture.refText(john, 3, 16), 'John 3:16');
  assert.equal(scripture.refText(john, 3, 16, 18), 'John 3:16–18');
  assert.equal(scripture.refText(john, 3), 'John 3');
});

test('the ways an adult might type a reference all land somewhere sensible', () => {
  const cases = [
    ['John 3:16', 43, 3, 16], ['1 jn 2:1', 62, 2, 1], ['Psalm 23', 19, 23, null],
    ['Mga Awit 23', 19, 23, null], ['phil 4:6', 50, 4, 6], ['rev 21:4', 66, 21, 4],
    ['1 Corinthians 13:4-5', 46, 13, 4],
  ];
  for (const [text, n, chapter, verse] of cases) {
    const parsed = scripture.parseRef(text, bible.books);
    assert.ok(parsed, `"${text}" did not parse`);
    assert.equal(parsed.book.n, n, `"${text}" found ${parsed.book.name}`);
    assert.equal(parsed.chapter, chapter);
    assert.equal(parsed.verse, verse);
  }
  assert.equal(scripture.parseRef('', bible.books), null);
  assert.equal(scripture.parseRef('not a reference at all', bible.books), null);
});
