// RESOURCES FROM CRU.
//
// Cru's material is linked, never copied, so the file holds only a title, a
// line of our own and a link — and the tests hold it to that: every link goes
// to cru.org over https, every entry says what it is, nothing is stored about
// the member but which ones they kept, and Today's Promise resolves to a real
// day's page every day of the year.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/storage.js';
import * as resources from '../js/core/resources.js';

const bank = JSON.parse(readFileSync(new URL('../content/resources.json', import.meta.url), 'utf8'));
const items = resources.all(bank);

test('every resource is a link to cru.org, and says what it is in our words', () => {
  assert.ok(items.length >= 10);
  const ids = new Set();
  for (const one of items) {
    assert.ok(!ids.has(one.id), `duplicate id ${one.id}`);
    ids.add(one.id);
    assert.match(one.url, /^https:\/\/www\.cru\.org\//, `${one.id}: only cru.org, over https`);
    assert.ok(one.title && one.summary && one.summary.length >= 30, `${one.id}: needs a title and a real line`);
    assert.ok(one.summary.length <= 200, `${one.id}: a summary, not a copy`);
    assert.ok(['page', 'pdf', 'video'].includes(one.kind), `${one.id}: kind`);
    if (one.kind === 'pdf') assert.match(one.url, /\.pdf$/, `${one.id}: a PDF link that is not a PDF`);
  }
  assert.match(bank.source.url, /^https:\/\/www\.cru\.org\//);
  assert.match(bank.about, /copyright/i, 'the file must still say whose the material is');
});

test('Today’s Promise opens a page for every day of the year', () => {
  const base = bank.todaysPromise.base;
  assert.match(base, /^https:\/\/www\.cru\.org\/.+\/todays-promise\/$/);
  const seen = new Set();
  for (let d = new Date(2028, 0, 1); d.getFullYear() === 2028; d.setDate(d.getDate() + 1)) {
    const url = resources.todaysPromiseUrl(base, d);
    assert.match(url, /\/(0[1-9]|1[0-2])\/(0[1-9]|[12]\d|3[01])\.html$/);
    seen.add(url);
  }
  assert.equal(seen.size, 365, 'a leap year still maps to the 365 pages — 29 February opens the 28th');
  assert.equal(resources.todaysPromiseUrl(base, new Date(2026, 8, 29)), `${base}09/29.html`);
});

test('My resources keeps only which ones were added, and which are finished', () => {
  store.wipe();
  resources.add('the-community');
  resources.add('knowing-god-personally');
  resources.add('the-community');
  assert.equal(resources.saved().length, 2, 'adding twice keeps one');
  resources.setDone('the-community');
  const mine = resources.mine(bank);
  assert.deepEqual(mine.map((one) => one.id), ['knowing-god-personally', 'the-community'], 'newest first');
  assert.equal(mine.find((one) => one.id === 'the-community').done, true);
  const kept = JSON.stringify(store.read(store.KEYS.resources));
  assert.equal(/cru\.org|summary|title/.test(kept), false, 'nothing of Cru’s is stored, only ids');
  resources.remove('the-community');
  assert.deepEqual(resources.saved().map((one) => one.id), ['knowing-god-personally']);
});

test('a resource that leaves the file drops out of My resources instead of breaking it', () => {
  store.wipe();
  resources.add('no-longer-listed');
  resources.add('passages');
  assert.deepEqual(resources.mine(bank).map((one) => one.id), ['passages']);
});

test('opening a resource makes no request of its own — it is a link in a new tab', () => {
  const source = readFileSync(new URL('../js/core/resources.js', import.meta.url), 'utf8');
  assert.equal(/fetch\(/.test(source), false);
  assert.match(source, /window\.open\(url, '_blank', 'noopener'\)/);
});
