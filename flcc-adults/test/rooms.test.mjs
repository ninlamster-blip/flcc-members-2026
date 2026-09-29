// LIVE ROOMS.
//
// The second thing in this app that sends anything anywhere, so the tests are
// about the edges rather than the game: every request is built here and read
// back, and none of them may carry a name, a season, a prayer, a note or any
// typed text. What is said in a room is an index into a fixed list, and that
// list must be the one the server holds. And the quiz itself must be the same
// on every phone, or a room would be ten people answering different questions.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import * as store from '../js/core/storage.js';
import * as rooms from '../js/core/rooms.js';

const read = (path) => readFileSync(new URL(path, import.meta.url), 'utf8');
const bank = JSON.parse(read('../content/quiz.json')).questions;

// Every request the module makes, captured instead of sent.
const sent = [];
globalThis.location = { origin: 'https://example.test', hash: '' };
globalThis.fetch = async (url, init = {}) => {
  sent.push({ url, method: init.method || 'GET', headers: init.headers || {}, body: init.body || '' });
  const path = new URL(url).pathname;
  const reply = path === '/ping' ? { nextPlay: true }
    : path.endsWith('/join') && !path.includes('/room/') ? { token: 't0ken', id: 7, nickname: 'Quiet Cedar', ageGroup: 'adults' }
      : path.includes('/room/create') ? { code: 'ABCD' }
        : path.startsWith('/api/next/play/room') ? { code: 'ABCD', now: Date.now(), players: [], says: [] }
          : { ok: true };
  return { ok: true, status: 200, json: async () => reply };
};

test('a member who never opens a room sends nothing and has no nickname', () => {
  store.wipe();
  assert.equal(rooms.me(), null);
});

test('every request carries the edition, and nothing about the person', async () => {
  store.wipe();
  store.write(store.KEYS.user, { name: 'Allen Ramos', season: 'grieving', focus: 'prayer', created: 1 });
  store.write(store.KEYS.prayers, [{ text: 'my brother’s surgery' }]);
  sent.length = 0;

  const joined = await rooms.join();
  assert.equal(joined.joined, true);
  assert.deepEqual(JSON.parse(sent[0].body), { ageGroup: 'adults' }, 'joining sends only the edition');

  await rooms.createRoom();
  await rooms.joinRoom(' abcd ');
  await rooms.startRoom('ABCD');
  await rooms.answer('ABCD', 3, 'yes');
  await rooms.say('ABCD', 7);
  await rooms.room('ABCD');
  await rooms.leaveRoom('ABCD');
  await rooms.leave();

  const wire = JSON.stringify(sent);
  for (const leak of ['Allen', 'Ramos', 'grieving', 'season', 'focus', 'surgery', 'prayer', 'adults/v1']) {
    assert.equal(wire.includes(leak), false, `a request carries "${leak}"`);
  }
  for (const request of sent) {
    assert.ok(new URL(request.url).origin === 'https://example.test', `${request.url} leaves the app's own origin`);
    const body = request.body ? JSON.parse(request.body) : {};
    assert.equal('text' in body || 'message' in body || 'name' in body, false, `${request.url} carries free text`);
  }
  const answered = sent.find((r) => r.url.includes('/room/answer'));
  assert.deepEqual(JSON.parse(answered.body), { token: 't0ken', code: 'ABCD', question: 3, right: true },
    'an answer is whether it was right, not what was chosen');
  const said = sent.find((r) => r.url.includes('/room/say'));
  assert.deepEqual(JSON.parse(said.body), { token: 't0ken', code: 'ABCD', kind: 7 }, 'a line is sent as its number');
  assert.equal(JSON.parse(sent.find((r) => r.url.includes('/room/join')).body).code, 'ABCD');
  assert.equal(rooms.me(), null, 'leaving forgets the nickname on this phone');
});

test('a nickname from the kids and teens app is not taken as this one', () => {
  store.wipe();
  store.write(store.KEYS.online, { token: 'x', id: 1, nickname: 'Brave Otter', ageGroup: 'teens' });
  assert.equal(rooms.me(), null);
});

test('the lines a member can tap are the ones the server holds', () => {
  const server = read('../../ask-proxy/next-play.js');
  const line = server.match(/export const ROOM_SAYS = (\[.*\]);/);
  assert.ok(line, 'the server list has moved');
  assert.deepEqual(rooms.ROOM_SAYS, JSON.parse(line[1].replace(/'/g, '"')));
});

test('the room screen has no way to type a message', () => {
  const screen = read('../js/screens/room.js');
  assert.equal(/textarea/.test(screen), false);
  assert.equal((screen.match(/h\('input'/g) || []).length, 1, 'the only field is the room code');
  assert.ok(/maxlength: '4'/.test(screen), 'the room code field takes four letters and no more');
});

test('this edition keeps no score: the rooms module never stores one', () => {
  const source = read('../js/core/rooms.js');
  assert.equal(/store\.write\([^)]*score/i.test(source), false);
  assert.equal(/\/score|\/board|\/cheer/.test(source), false, 'the rooms module calls the leaderboard');
});

test('every phone deals the same ten questions from the same seed', () => {
  const one = rooms.questionsFor(bank, 123456, 10).map((q) => q.q);
  const two = rooms.questionsFor([...bank], 123456, 10).map((q) => q.q);
  assert.deepEqual(one, two);
  assert.equal(new Set(one).size, 10, 'a question is dealt twice in one game');
  assert.notDeepEqual(rooms.questionsFor(bank, 99, 10).map((q) => q.q), one, 'every room gets the same game');
});

test('the right answer is not always in the same place', () => {
  const places = bank.map((question) => {
    const shown = rooms.shown(question);
    assert.equal(shown.options[shown.answer], question.options[question.answer], question.q);
    assert.deepEqual([...shown.options].sort(), [...question.options].sort());
    return shown.answer;
  });
  for (const place of [0, 1, 2]) {
    assert.ok(places.filter((p) => p === place).length >= bank.length / 6, `the answer is rarely option ${place + 1}`);
  }
});

test('the question bank is complete and written the same way throughout', () => {
  assert.ok(bank.length >= 30, 'too few questions to deal a fresh game');
  const seen = new Set();
  for (const question of bank) {
    assert.equal(typeof question.q, 'string');
    assert.ok(!seen.has(question.q), `asked twice: ${question.q}`);
    seen.add(question.q);
    assert.equal(question.options.length, 3, question.q);
    assert.equal(new Set(question.options).size, 3, `an option repeats: ${question.q}`);
    assert.ok(Number.isInteger(question.answer) && question.options[question.answer], question.q);
    assert.ok(question.why && question.why.length > 10, `no why: ${question.q}`);
    assert.ok(/\d/.test(question.ref), `no reference: ${question.q}`);
    assert.equal('kids' in question || 'teens' in question, false, 'this edition has no age variants');
  }
});
