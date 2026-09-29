// Playing online, from the app's side.
//
// The promise on the join screen is that only the age group and game scores
// ever leave the phone — never a name, an age, or anything typed. This builds
// every request the module can make, with a name, a birthday and a prayer
// sitting in storage, and checks none of them travels.

import test from 'node:test';
import assert from 'node:assert/strict';
import { CHEERS as SERVER_CHEERS } from '../../ask-proxy/next-play.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; },
};
globalThis.location = { origin: 'https://next.test' };
store.set('next/v1/user', JSON.stringify({ name: 'Maria Santos', age: 9, ageGroup: 'kids' }));
store.set('next/v1/prayers', JSON.stringify({ items: [{ content: 'please help my mum' }] }));

const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), body: options.body || '', headers: options.headers || {} });
  const path = new URL(url).pathname;
  const reply = path === '/api/next/play/join'
    ? { configured: true, token: 't'.repeat(64), id: 'p1', nickname: 'Brave Lion 42', ageGroup: 'kids' }
    : path === '/api/next/play/leave' ? { left: true } : { configured: true, top: [], team: { total: 0, goal: 1, players: 0 } };
  return { ok: true, status: 200, json: async () => reply };
};

const online = await import('../js/core/online.js');

test('the cheers on the phone are the cheers the server accepts', () => {
  assert.deepEqual(online.CHEERS, SERVER_CHEERS);
});

test('before joining, a finished run sends nothing', async () => {
  calls.length = 0;
  assert.equal(await online.submit('hop', 40, 'kids'), null);
  assert.equal(calls.length, 0);
});

test('joining sends the age group and nothing else, and remembers the nickname', async () => {
  calls.length = 0;
  const result = await online.join('kids');
  assert.equal(result.joined, true);
  assert.deepEqual(JSON.parse(calls[0].body), { ageGroup: 'kids' });
  assert.equal(online.me('kids').nickname, 'Brave Lion 42');
  assert.equal(online.me('teens'), null, 'a phone that becomes a teen is not on the kids board');
});

test('no request ever carries a name, an age, or anything typed', async () => {
  calls.length = 0;
  await online.submit('hop', 40, 'kids');
  await online.submit('galaga', 1200, 'kids');
  await online.board('hop', 'kids');
  await online.cheer('p2', 3);
  await online.rename();
  await online.setOnBoard(false);
  assert.ok(calls.length >= 6);
  for (const call of calls) {
    const sent = `${call.url} ${call.body} ${JSON.stringify(call.headers)}`;
    for (const secret of ['Maria', 'Santos', '"age"', 'please help', 'birthday']) {
      assert.ok(!sent.includes(secret), `"${secret}" left the phone in ${call.url}`);
    }
  }
  assert.deepEqual(Object.keys(JSON.parse(calls[0].body)).sort(), ['game', 'token', 'value']);
});

test('a score is a whole, non-negative number for a known game', async () => {
  calls.length = 0;
  await online.submit('hop', -5.7, 'kids');
  assert.equal(JSON.parse(calls[0].body).value, 0);
  assert.equal(await online.submit('chess', 10, 'kids'), null);
  assert.equal(calls.length, 1);
});

test('leaving forgets the player on the phone too', async () => {
  assert.equal(await online.leave(), true);
  assert.equal(online.me(), null);
  assert.equal(store.has('next/v1/online'), false);
});
