// THE PRAYER WALL.
//
// The one place a prayer leaves this app, so the tests are about what leaves:
// a request goes with its text and a first name, and nothing else about the
// person or the rest of their list; words that sound like danger are not
// posted at all; and only the phone that shared a request can take it down.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/storage.js';
import * as prayers from '../js/core/prayers.js';
import * as wall from '../js/core/wall.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');

const sent = [];
let reply = () => ({});
globalThis.location = { origin: 'https://example.test', hash: '' };
globalThis.fetch = async (url, init = {}) => {
  sent.push({ url, method: init.method || 'GET', headers: init.headers || {}, body: init.body || '' });
  return { ok: true, status: 200, json: async () => reply(new URL(url).pathname) };
};

const person = () => {
  store.wipe();
  store.write(store.KEYS.user, { name: 'Allen Ramos Santos', season: 'grieving', focus: ['prayer'], created: 1 });
  prayers.add({ text: 'My marriage, which nobody knows about', category: 'family' });
  sent.length = 0;
};

test('sharing sends the text, the first name and this phone’s random id — nothing else', async () => {
  person();
  reply = () => ({ configured: true, shared: true, id: 'w1', token: 'secret-token' });
  const result = await wall.share('  For my mother’s surgery on Monday  ');
  assert.equal(result.ok, true);
  assert.equal(sent.length, 1);
  const body = JSON.parse(sent[0].body);
  assert.deepEqual(Object.keys(body).sort(), ['device', 'firstName', 'text']);
  assert.equal(body.text, 'For my mother’s surgery on Monday');
  assert.equal(body.firstName, 'Allen', 'signed with the first name only');
  assert.match(body.device, /^[0-9a-f]{32}$/);
  const wire = JSON.stringify(sent);
  for (const leak of ['Ramos', 'Santos', 'grieving', 'marriage', 'family', 'adults/v1']) {
    assert.equal(wire.includes(leak), false, `the request carries "${leak}"`);
  }
  assert.equal(new URL(sent[0].url).origin, 'https://example.test', 'it goes to the app’s own origin');
});

test('words that sound like danger are never posted to the church', async () => {
  person();
  const result = await wall.share('I want to kill myself');
  assert.equal(result.concerning, true);
  assert.equal(sent.length, 0, 'nothing was sent');
});

test('only this phone can take down what it shared', async () => {
  person();
  reply = () => ({ configured: true, shared: true, id: 'w2', token: 'only-mine' });
  await wall.share('For work to come through this month');
  reply = () => ({ configured: true, removed: true });
  assert.equal((await wall.remove('someone-elses')).ok, false);
  assert.equal(sent.length, 1, 'no request is made for a request this phone did not share');
  assert.equal((await wall.remove('w2')).ok, true);
  assert.equal(JSON.parse(sent[1].body).token, 'only-mine');
});

test('the wall marks your own requests, and the phone keeps the same id', async () => {
  person();
  reply = () => ({ configured: true, shared: true, id: 'w3', token: 't' });
  await wall.share('For the new members joining us');
  reply = () => ({ configured: true, prayers: [{ id: 'w3', firstName: 'Allen', text: 'x', at: 1, prayed: 0 }, { id: 'w4', firstName: 'Grace', text: 'y', at: 1, prayed: 2 }] });
  const list = await wall.list();
  assert.deepEqual(list.map((one) => one.yours), [true, false]);
  const ids = sent.map((r) => (r.body ? JSON.parse(r.body).device : r.headers['x-prayer-device']));
  assert.equal(new Set(ids).size, 1, 'one phone, one id');
});

test('the wall never reads the private prayer list', () => {
  const source = read('../js/core/wall.js');
  assert.equal(/from '\.\/prayers\.js'|KEYS\.prayers|KEYS\.journal/.test(source), false);
});

test('the screen says what is sent before anything is', () => {
  const screen = read('../js/screens/wall.js');
  assert.ok(/Signed “\$\{name\}”/.test(screen), 'the note naming the signature has gone');
  assert.ok(/Anyone who opens this app can read it/.test(screen), 'the note saying who reads it has gone');
});

test('when the wall cannot be read, it says why', async () => {
  person();
  reply = () => ({ configured: false });
  assert.match((await wall.list()).error, /not switched on/);
  const offline = globalThis.fetch;
  globalThis.fetch = async () => { throw new TypeError('offline'); };
  assert.match((await wall.list()).error, /needs a connection/);
  globalThis.fetch = offline;
});

test('reactions on the phone are the reactions the server accepts', () => {
  const server = read('../../ask-proxy/adults-prayers.js');
  const line = server.match(/export const REACTIONS = \{([^}]*)\}/);
  assert.ok(line, 'the server list has moved');
  const kinds = [...line[1].matchAll(/(\w+):/g)].map((m) => m[1]);
  assert.deepEqual(wall.REACTIONS.map((r) => r.kind), kinds);
});

test('a reaction sends which one and this phone’s id, nothing typed', async () => {
  person();
  reply = () => ({ configured: true, count: 1, yours: true });
  await wall.react('w9', 'love');
  assert.deepEqual(Object.keys(JSON.parse(sent[0].body)).sort(), ['device', 'id', 'kind']);
});

test('only the sharer can mark it answered, and the note is screened first', async () => {
  person();
  reply = () => ({ configured: true, shared: true, id: 'w5', token: 'mine-5' });
  await wall.share('For a job interview on Thursday');
  sent.length = 0;
  assert.equal((await wall.answer('not-mine', 'Got it!')).ok, false);
  assert.equal(sent.length, 0);
  assert.equal((await wall.answer('w5', 'I want to die')).concerning, true);
  assert.equal(sent.length, 0, 'a worrying note is not sent');
  reply = () => ({ configured: true, answered: { at: 1, note: 'Got the job!' } });
  await wall.answer('w5', `Got the job! ${'x'.repeat(400)}`);
  const body = JSON.parse(sent[0].body);
  assert.equal(body.token, 'mine-5');
  assert.equal(body.note.length, wall.NOTE_MAX);
});

test('a shared request carries the member’s picture when they set one, and never anything else', async () => {
  person();
  const user = JSON.parse(JSON.stringify(store.read(store.KEYS.user)));
  store.write(store.KEYS.user, { ...user, avatar: 'draw:heart:rose' });
  assert.equal(wall.buildShare('For my family').avatar, 'draw:heart:rose');
  store.write(store.KEYS.user, { ...user, avatar: 'https://example.com/me.jpg' });
  assert.equal('avatar' in wall.buildShare('For my family'), false, 'a link is never sent as a picture');
});
