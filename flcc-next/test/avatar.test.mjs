// AVATARS.
//
// Kids and teens see each other's avatars, so an avatar is a drawing from the
// app's own set and never a photo. This holds both halves: the phone only ever
// sends `draw:<symbol>:<tone>` from its own lists, and the server refuses a
// photo from these two age groups however it arrives.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { cleanAvatar } from '../../ask-proxy/next-play.js';

const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k), key: (i) => [...store.keys()][i] ?? null, get length() { return store.size; },
};
globalThis.location = { origin: 'https://next.test' };
const calls = [];
globalThis.fetch = async (url, options = {}) => {
  calls.push({ url: String(url), body: options.body || '' });
  return { ok: true, status: 200, json: async () => ({ configured: true, token: 't'.repeat(64), id: 'p1', nickname: 'Brave Lion 42', ageGroup: 'kids' }) };
};

const avatars = await import('../js/core/avatar.js');
const online = await import('../js/core/online.js');
const artSource = readFileSync(new URL('../js/core/art.js', import.meta.url), 'utf8');

test('every avatar picture is one of the app’s own drawings', () => {
  for (const name of avatars.SYMBOLS) {
    assert.ok(new RegExp(`\\b${name}: \\(`).test(artSource), `"${name}" is not in art.js`);
  }
});

test('the server accepts every avatar the picker can make, for kids and for teens', () => {
  for (const name of avatars.SYMBOLS) for (const tone of avatars.TONES) {
    const spec = avatars.make(name, tone);
    assert.equal(cleanAvatar(spec, 'kids'), spec);
    assert.equal(cleanAvatar(spec, 'teens'), spec);
  }
});

test('the server refuses a photo from a child, however it is dressed', () => {
  for (const photo of [
    `data:image/jpeg;base64,${'A'.repeat(300)}`, `data:image/png;base64,${'A'.repeat(300)}`,
    'https://example.com/me.jpg', 'draw:rocket:neon', '<img src=x>',
  ]) {
    assert.equal(cleanAvatar(photo, 'kids'), null, photo.slice(0, 30));
    assert.equal(cleanAvatar(photo, 'teens'), null, photo.slice(0, 30));
  }
});

test('joining sends the picked drawing, and a photo sitting in storage is never sent', async () => {
  store.set('next/v1/user', JSON.stringify({ name: 'Maria', age: 9, ageGroup: 'kids', avatar: 'draw:rocket:sky' }));
  calls.length = 0;
  await online.join('kids');
  assert.deepEqual(JSON.parse(calls[0].body), { ageGroup: 'kids', avatar: 'draw:rocket:sky' });

  store.set('next/v1/user', JSON.stringify({ name: 'Maria', age: 9, ageGroup: 'kids', avatar: `data:image/jpeg;base64,${'A'.repeat(300)}` }));
  calls.length = 0;
  await online.join('kids');
  assert.deepEqual(JSON.parse(calls[0].body), { ageGroup: 'kids' });
  assert.equal(await online.setAvatar(`data:image/jpeg;base64,${'A'.repeat(300)}`), false);
  assert.equal(calls.length, 1, 'setAvatar with a photo makes no request at all');
});

test('a player with no avatar gets a steady one, not a different one every poll', () => {
  assert.equal(avatars.fallback('p-123'), avatars.fallback('p-123'));
  assert.ok(avatars.parse(avatars.fallback('anything')));
});

test('there is no way to upload a picture in the kids and teens app', () => {
  const me = readFileSync(new URL('../js/screens/me.js', import.meta.url), 'utf8');
  assert.equal(/type: 'file'|type="file"|getUserMedia|capture/.test(me), false);
});
