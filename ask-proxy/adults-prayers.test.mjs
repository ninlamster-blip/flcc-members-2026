// The Adults prayer wall — the Worker side, against a real SQLite engine
// standing in for D1 (the same approach as next-play.test.mjs).
//
// What it holds: a request carries a first name and its text and nothing
// else, only the phone that shared it can take it down, enough reports hide
// it, "I prayed" counts once per phone, and old requests are swept.
//
// Run with: node --test ask-proxy/adults-prayers.test.mjs

import test from 'node:test';
import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import worker from './worker.js';
import { REPORTS_TO_HIDE, SHARES_PER_DAY, RETENTION_DAYS, NOTE_MAX, REACTIONS, sweepAdultPrayers } from './adults-prayers.js';

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
const device = (n) => String(n).repeat(32).slice(0, 32).replace(/[^0-9a-f]/g, 'a');
async function call(e, method, path, body, headers = {}) {
  const res = await worker.fetch(new Request(`https://adults.test${path}`, {
    method, headers: { ...(body ? { 'Content-Type': 'application/json' } : {}), ...headers },
    body: body ? JSON.stringify(body) : undefined,
  }), e, { waitUntil() {} });
  return { status: res.status, data: await res.json().catch(() => null) };
}
const share = (e, extra = {}) => call(e, 'POST', '/api/adults/prayers',
  { text: 'For my mother’s surgery on Monday', firstName: 'Allen', device: device(1), ...extra });
const wall = async (e, d) => (await call(e, 'GET', '/api/adults/prayers', null, d ? { 'x-prayer-device': d } : {})).data.prayers;

test('without a database, the wall says so instead of pretending', async () => {
  assert.equal((await call({}, 'GET', '/api/adults/prayers')).data.configured, false);
  assert.equal((await call({ KASAMA_DB: fakeD1() }, 'GET', '/ping')).data.adultsPrayers, true);
});

test('a shared request carries its text and a first name, and nothing else is stored', async () => {
  const e = env();
  const res = await share(e, { season: 'grieving', lastName: 'Santos', email: 'a@b.c' });
  assert.equal(res.data.shared, true);
  const [one] = await wall(e);
  assert.deepEqual(Object.keys(one).sort(), ['answered', 'at', 'avatar', 'firstName', 'id', 'prayed', 'prayedByYou', 'reactions', 'text', 'yourReactions']);
  assert.equal(one.firstName, 'Allen');
  const stored = JSON.stringify(e.KASAMA_DB.raw.prepare('SELECT * FROM adult_prayers').all());
  for (const leak of ['grieving', 'Santos', 'a@b.c', res.data.token, device(1)]) {
    assert.equal(stored.includes(leak), false, `"${leak}" was stored`);
  }
});

test('a request needs words and a name', async () => {
  const e = env();
  assert.equal((await share(e, { text: 'hi' })).status, 400);
  assert.equal((await share(e, { firstName: '  ' })).status, 400);
  assert.equal((await share(e, { device: 'not-a-device' })).status, 400);
  const long = await share(e, { text: 'x'.repeat(900) });
  assert.equal(long.status, 200);
  assert.equal((await wall(e))[0].text.length, 500, 'a long request is cut, not refused');
});

test('one phone cannot flood the wall', async () => {
  const e = env();
  for (let i = 0; i < SHARES_PER_DAY; i++) assert.equal((await share(e)).status, 200);
  assert.equal((await share(e)).status, 429);
  assert.equal((await share(e, { device: device(2) })).status, 200, 'another phone still can');
});

test('"I prayed" counts once per phone', async () => {
  const e = env();
  const { id } = (await share(e)).data;
  await call(e, 'POST', '/api/adults/prayers/pray', { id, device: device(2) });
  await call(e, 'POST', '/api/adults/prayers/pray', { id, device: device(2) });
  const res = await call(e, 'POST', '/api/adults/prayers/pray', { id, device: device(3) });
  assert.equal(res.data.prayed, 2);
  assert.equal((await wall(e, device(2)))[0].prayedByYou, true);
  assert.equal((await wall(e, device(4)))[0].prayedByYou, false);
});

test('only the phone that shared it can take it down, and it goes completely', async () => {
  const e = env();
  const { id, token } = (await share(e)).data;
  await call(e, 'POST', '/api/adults/prayers/pray', { id, device: device(2) });
  assert.equal((await call(e, 'POST', '/api/adults/prayers/remove', { id, token: 'guess', device: device(2) })).status, 403);
  assert.equal((await call(e, 'POST', '/api/adults/prayers/remove', { id, token, device: device(1) })).data.removed, true);
  assert.equal((await wall(e)).length, 0);
  assert.equal(e.KASAMA_DB.raw.prepare('SELECT COUNT(*) AS n FROM adult_prayer_marks').get().n, 0);
});

test(`${REPORTS_TO_HIDE} reports from different phones hide a request`, async () => {
  const e = env();
  const { id } = (await share(e)).data;
  for (let i = 0; i < REPORTS_TO_HIDE - 1; i++) {
    await call(e, 'POST', '/api/adults/prayers/report', { id, device: device(2) });   // the same phone, again
  }
  assert.equal((await wall(e)).length, 1, 'one phone reporting twice counts once');
  for (let i = 0; i < REPORTS_TO_HIDE; i++) {
    await call(e, 'POST', '/api/adults/prayers/report', { id, device: device(i + 3) });
  }
  assert.equal((await wall(e)).length, 0);
});

test(`requests are swept after ${RETENTION_DAYS} days`, async () => {
  const e = env();
  const { id } = (await share(e)).data;
  e.KASAMA_DB.raw.prepare('UPDATE adult_prayers SET created_ms = ? WHERE id = ?')
    .run(Date.now() - (RETENTION_DAYS + 1) * 86400000, id);
  assert.equal((await wall(e)).length, 0, 'an expired request is not shown even before the sweep');
  await sweepAdultPrayers(e);
  assert.equal(e.KASAMA_DB.raw.prepare('SELECT COUNT(*) AS n FROM adult_prayers').get().n, 0);
});

test('a server error is answered with its reason, not a bare failure', async () => {
  const broken = { KASAMA_DB: { prepare() { throw new Error('boom'); }, batch() { throw new Error('boom'); } } };
  const res = await call(broken, 'GET', '/api/adults/prayers');
  assert.equal(res.status, 500);
  assert.match(res.data.error.message, /server error: boom/);
});

test('reactions are from the list, once per phone each, and a second tap takes one back', async () => {
  const e = env();
  const { id } = (await share(e)).data;
  const react = (kind, d = device(2)) => call(e, 'POST', '/api/adults/prayers/react', { id, device: d, kind });
  assert.equal((await react('love')).data.count, 1);
  assert.equal((await react('with', device(3))).data.count, 1);
  assert.equal((await react('love')).data.count, 0, 'tapped again, it is taken back');
  assert.equal((await react('love')).data.count, 1);
  assert.equal((await react('you are wrong')).status, 400, 'nothing typed');
  assert.equal((await react('praise')).status, 400, '🙌 waits for an answer');
  const [one] = await wall(e, device(2));
  assert.deepEqual(one.reactions, { prayed: 0, love: 1, with: 1, praise: 0 });
  assert.deepEqual(one.yourReactions, ['love']);
  assert.deepEqual(Object.keys(REACTIONS), ['prayed', 'love', 'with', 'praise']);
});

test('only the sharer can mark it answered, with a short note, and take that back', async () => {
  const e = env();
  const { id, token } = (await share(e)).data;
  assert.equal((await call(e, 'POST', '/api/adults/prayers/answer', { id, token: 'guess', device: device(2), note: 'x' })).status, 403);
  const done = await call(e, 'POST', '/api/adults/prayers/answer', { id, token, device: device(1), note: `Surgery went well. ${'!'.repeat(400)}` });
  assert.equal(done.data.answered.note.length, NOTE_MAX, 'a long note is cut');
  const [one] = await wall(e);
  assert.ok(one.answered.at && one.answered.note.startsWith('Surgery went well.'));
  assert.equal((await call(e, 'POST', '/api/adults/prayers/react', { id, device: device(3), kind: 'praise' })).data.count, 1, '🙌 opens');
  await call(e, 'POST', '/api/adults/prayers/answer', { id, token, device: device(1), answered: false });
  const [again] = await wall(e);
  assert.equal(again.answered, null);
  assert.equal(again.reactions.praise, 0, 'un-answering clears the 🙌');
});

test('a request can carry a drawn avatar or a small photo, and nothing else', async () => {
  const e = env();
  await share(e, { avatar: 'draw:heart:rose' });
  await share(e, { avatar: `data:image/jpeg;base64,${'A'.repeat(200)}` });
  await share(e, { avatar: 'https://tracker.example/pixel.gif' });
  await share(e, { avatar: `data:image/jpeg;base64,${'A'.repeat(20000)}` });
  const avatars = (await wall(e)).map((one) => one.avatar);
  assert.ok(avatars.includes('draw:heart:rose'));
  assert.equal(avatars.filter((one) => /^data:image\/jpeg;base64,A{200}$/.test(one || '')).length, 1, 'the small photo is kept');
  assert.equal(avatars.filter((one) => one === null).length, 2, 'a link elsewhere, and a photo too big, are both refused');
});

test('once the tables exist, a request makes no schema change', async () => {
  // Three ALTERs before every read — each failing because the column was
  // already there — is how the wall came to time out on phones. Look first.
  const e = env();
  const alters = [];
  const prepare = e.KASAMA_DB.prepare;
  e.KASAMA_DB.prepare = (sql) => { if (/^\s*ALTER/i.test(sql)) alters.push(sql); return prepare(sql); };
  await share(e);
  assert.equal(alters.length, 3, 'a brand-new database gets its three columns, once');
  alters.length = 0;
  await wall(e);
  await share(e, { device: device(2) });
  await wall(e, device(2));
  assert.deepEqual(alters, [], 'after that, not one ALTER per request');
});
