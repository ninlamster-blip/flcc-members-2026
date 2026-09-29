// FLCC NEXT playing online — the Worker side, against a real SQLite engine
// standing in for D1 (the same approach as worker.test.mjs).
//
// What it holds: no name or typed word is ever stored, kids and teens never
// share a board, a cheer can only be one from the list, and leaving deletes
// everything.
//
// Run with: node --test ask-proxy/next-play.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from './worker.js';
import { CHEERS, weekOf, nickname, sweepNextPlay } from './next-play.js';

class BoundStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  run() { const info = this.db.prepare(this.sql).run(...this.args); return { meta: { changes: Number(info.changes) }, success: true }; }
  first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  all() { return { results: this.db.prepare(this.sql).all(...this.args), success: true }; }
}
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  return { raw: db, prepare: (sql) => new BoundStatement(db, sql), batch: (stmts) => stmts.map((s) => s.run()) };
}

const env = () => ({ KASAMA_DB: fakeD1() });
async function call(e, method, path, body, headers = {}) {
  const res = await worker.fetch(new Request(`https://next.test${path}`, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  }), e, { waitUntil() {} });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const join = async (e, ageGroup) => (await call(e, 'POST', '/api/next/play/join', { ageGroup, name: 'Real Name', age: 9 })).data;

test('without a database, the feature says so instead of pretending', async () => {
  const res = await call({}, 'POST', '/api/next/play/join', { ageGroup: 'kids' });
  assert.equal(res.data.configured, false);
});

test('joining gives a server-chosen nickname, and nothing typed is stored', async () => {
  const e = env();
  const me = await join(e, 'kids');
  assert.match(me.nickname, /^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/);
  assert.ok(me.token.length >= 40);
  const stored = JSON.stringify(e.KASAMA_DB.raw.prepare('SELECT * FROM next_players').all());
  assert.ok(!stored.includes('Real Name'), 'a name sent anyway is never stored');
  assert.ok(!stored.includes(me.token), 'only a hash of the token is kept');
  assert.equal((await call(e, 'POST', '/api/next/play/join', { ageGroup: 'adults' })).status, 400);
});

test('a score counts for the board and the team, and the best is kept', async () => {
  const e = env();
  const me = await join(e, 'kids');
  await call(e, 'POST', '/api/next/play/score', { token: me.token, game: 'hop', value: 20 });
  const after = (await call(e, 'POST', '/api/next/play/score', { token: me.token, game: 'hop', value: 12 })).data;
  assert.equal(after.mine.best, 20, 'a worse run does not lower the best');
  assert.equal(after.team.total, 32, 'but every row counts towards the team goal');
  assert.equal(after.top[0].nickname, me.nickname);
  assert.equal(after.top[0].you, true);
  assert.equal((await call(e, 'POST', '/api/next/play/score', { token: me.token, game: 'hop', value: 999999 })).status, 400, 'an impossible score is refused');
  assert.equal((await call(e, 'POST', '/api/next/play/score', { token: 'x'.repeat(40), game: 'hop', value: 5 })).status, 401);
});

test('kids and teens never share a board', async () => {
  const e = env();
  const kid = await join(e, 'kids');
  const teen = await join(e, 'teens');
  await call(e, 'POST', '/api/next/play/score', { token: kid.token, game: 'galaga', value: 500 });
  await call(e, 'POST', '/api/next/play/score', { token: teen.token, game: 'galaga', value: 900 });
  const kids = (await call(e, 'GET', '/api/next/play/board?ageGroup=kids&game=galaga')).data;
  assert.deepEqual(kids.top.map((row) => row.nickname), [kid.nickname]);
  assert.equal(kids.team.total, 500);
  const peek = await call(e, 'GET', '/api/next/play/board?ageGroup=kids&game=galaga', null, { 'x-play-token': teen.token });
  assert.equal(peek.status, 403, 'a teen cannot open the kids board as themselves');
  const cross = await call(e, 'POST', '/api/next/play/cheer', { token: teen.token, to: kid.id, kind: 0 });
  assert.equal(cross.status, 400, 'a teen cannot cheer a kid');
});

test('off the board still counts for the team, but is not listed', async () => {
  const e = env();
  const me = await join(e, 'kids');
  await call(e, 'POST', '/api/next/play/board-visibility', { token: me.token, show: false });
  const res = (await call(e, 'POST', '/api/next/play/score', { token: me.token, game: 'hop', value: 40 })).data;
  assert.equal(res.top.length, 0);
  assert.equal(res.team.total, 40);
});

test('a cheer is only ever one from the list, and cannot flood', async () => {
  const e = env();
  const a = await join(e, 'kids');
  const b = await join(e, 'kids');
  assert.equal((await call(e, 'POST', '/api/next/play/cheer', { token: a.token, to: b.id, kind: 'You are great' })).status, 400, 'text is refused');
  assert.equal((await call(e, 'POST', '/api/next/play/cheer', { token: a.token, to: b.id, kind: CHEERS.length })).status, 400);
  assert.equal((await call(e, 'POST', '/api/next/play/cheer', { token: a.token, to: a.id, kind: 0 })).status, 400, 'not yourself');
  assert.equal((await call(e, 'POST', '/api/next/play/cheer', { token: a.token, to: b.id, kind: 2 })).data.sent, CHEERS[2]);
  const got = (await call(e, 'GET', '/api/next/play/cheers', null, { 'x-play-token': b.token })).data.cheers;
  assert.deepEqual(got.map((c) => [c.text, c.from]), [[CHEERS[2], a.nickname]]);
  let last;
  for (let i = 0; i < 25; i++) last = await call(e, 'POST', '/api/next/play/cheer', { token: a.token, to: b.id, kind: 0 });
  assert.equal(last.status, 429);
});

test('leaving deletes the player, their scores and their cheers', async () => {
  const e = env();
  const a = await join(e, 'kids');
  const b = await join(e, 'kids');
  await call(e, 'POST', '/api/next/play/score', { token: a.token, game: 'hop', value: 10 });
  await call(e, 'POST', '/api/next/play/cheer', { token: b.token, to: a.id, kind: 1 });
  assert.equal((await call(e, 'POST', '/api/next/play/leave', { token: a.token })).data.left, true);
  const db = e.KASAMA_DB.raw;
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM next_players WHERE id = ?').get(a.id).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM next_scores WHERE player_id = ?').get(a.id).n, 0);
  assert.equal(db.prepare('SELECT COUNT(*) AS n FROM next_cheers').get().n, 0);
  assert.equal((await call(e, 'POST', '/api/next/play/rename', { token: a.token })).status, 401, 'the old token is dead');
});

test('idle players are swept, and a new nickname never carries anything typed', async () => {
  const e = env();
  const a = await join(e, 'kids');
  e.KASAMA_DB.raw.prepare(`UPDATE next_players SET seen_at = datetime('now', '-120 days')`).run();
  await sweepNextPlay(e);
  assert.equal(e.KASAMA_DB.raw.prepare('SELECT COUNT(*) AS n FROM next_players').get().n, 0);
  const renamed = (await call(e, 'POST', '/api/next/play/join', { ageGroup: 'teens' })).data;
  const next = (await call(e, 'POST', '/api/next/play/rename', { token: renamed.token, nickname: 'my real name' })).data;
  assert.match(next.nickname, /^[A-Z][a-z]+ [A-Z][a-z]+ \d{2}$/);
  assert.match(nickname(() => 0), /^Brave Lion 10$/);
  assert.equal(weekOf(new Date('2026-10-04T12:00:00Z')), '2026-09-28');
});
