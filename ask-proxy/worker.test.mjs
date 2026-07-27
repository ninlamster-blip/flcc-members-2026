// Exercises the Worker's HTTP surface for FLCC Kasama — the prayer chain and
// push-notification routes — end to end: real SQL execution (Node's
// built-in node:sqlite standing in for the D1 binding, so actual CREATE
// TABLE/INSERT/UPDATE/DELETE statements run for real, not a hand-rolled
// reinterpretation), real subscriber ECDH keys, a mocked push service that
// captures what the Worker actually sent, and the vendored reference
// decoder confirming the notification the server encrypted decrypts back to
// exactly the intended title/body/url.
//
// Run with: node ask-proxy/worker.test.mjs
import { DatabaseSync } from 'node:sqlite';
import nodeCrypto from 'node:crypto';
import { createRequire } from 'node:module';
import worker from './worker.js';

const require = createRequire(import.meta.url);
const ece = require('./test/vendor/http_ece.cjs');

let failures = 0;
function assert(cond, msg) {
  if (!cond) { failures++; console.log('FAIL:', msg); }
  else console.log('ok:', msg);
}

// ── Fake D1, backed by a real SQLite engine ──────────────────────────────
class BoundStatement {
  constructor(db, sql) { this.db = db; this.sql = sql; this.args = []; }
  bind(...args) { this.args = args; return this; }
  run() {
    const info = this.db.prepare(this.sql).run(...this.args);
    return { meta: { changes: Number(info.changes), last_row_id: Number(info.lastInsertRowid) }, success: true };
  }
  first() { return this.db.prepare(this.sql).get(...this.args) ?? null; }
  all() { return { results: this.db.prepare(this.sql).all(...this.args), success: true }; }
}
function fakeD1() {
  const db = new DatabaseSync(':memory:');
  return { prepare: (sql) => new BoundStatement(db, sql), batch: (stmts) => stmts.map((s) => s.run()) };
}

function makeCtx() {
  const pending = [];
  return { waitUntil: (p) => pending.push(p), flush: () => Promise.allSettled(pending) };
}

async function call(env, ctx, method, path, body, cf) {
  const req = new Request(`https://kasama.test${path}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  // request.cf is a Cloudflare-only extension (edge geolocation, etc.) not
  // part of the standard Request constructor — simulate it the same way the
  // real edge stamps it, so the Worker's request.cf.country reads work here.
  req.cf = cf ?? { country: 'KW' };
  const res = await worker.fetch(req, env, ctx);
  const data = await res.json().catch(() => null);
  return { status: res.status, data, headers: res.headers };
}

function bytesToBase64Url(bytes) {
  let bin = ''; for (const b of bytes) bin += String.fromCharCode(b);
  return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function makeSubscriber(endpoint) {
  const curve = nodeCrypto.createECDH('prime256v1');
  curve.generateKeys();
  const authSecret = nodeCrypto.randomBytes(16);
  return {
    endpoint,
    curve,
    authSecret,
    p256dh: bytesToBase64Url(new Uint8Array(curve.getPublicKey())),
    auth: bytesToBase64Url(new Uint8Array(authSecret)),
  };
}

const vapidKeyPair = await crypto.subtle.generateKey({ name: 'ECDSA', namedCurve: 'P-256' }, true, ['sign']);
const vapidPrivateJwk = await crypto.subtle.exportKey('jwk', vapidKeyPair.privateKey);
const vapidPublicB64url = bytesToBase64Url(new Uint8Array(await crypto.subtle.exportKey('raw', vapidKeyPair.publicKey)));

// ── Scenario 1: no KASAMA_DB bound → every route degrades gracefully ──────
{
  const env = {};
  const ctx = makeCtx();
  const a = await call(env, ctx, 'GET', '/api/prayers');
  assert(a.status === 200 && a.data.configured === false, 'GET /api/prayers with no binding: configured:false, not an error');
  const b = await call(env, ctx, 'GET', '/api/push/vapid-public-key');
  assert(b.status === 200 && b.data.configured === false, 'vapid-public-key with no VAPID secret: configured:false');
}

// A single shared database from here on, exactly as a real deployment has
// exactly one D1 binding for the lifetime of the Worker — worker.js caches
// "schema already ensured" at module scope, which is only valid under that
// real-world assumption of one persistent database, not a fresh one per test.
const db = fakeD1();

// ── Scenario 2: prayer chain CRUD + validation ────────────────────────────
{
  const env = { KASAMA_DB: db };
  const ctx = makeCtx();

  const empty = await call(env, ctx, 'GET', '/api/prayers');
  assert(empty.status === 200 && Array.isArray(empty.data.prayers) && empty.data.prayers.length === 0, 'empty chain returns []');

  const tooShort = await call(env, ctx, 'POST', '/api/prayers', { content: 'hi' });
  assert(tooShort.status === 400, 'a too-short prayer is rejected');

  // The client sends a spoofed/legacy countryCode; the Worker must ignore it
  // entirely and use the Cloudflare-stamped request.cf.country instead
  // (call() defaults cf to { country: 'KW' } — see the helper above).
  const created = await call(env, ctx, 'POST', '/api/prayers', {
    content: '  Panalangin   po para sa pamilya ko.  ', moodTag: 'lungkot', countryCode: 'ZZ-SPOOFED',
    firstName: '  Maria  ', originCountry: ' Philippines ',
  });
  assert(created.status === 200 && created.data.prayer.content === 'Panalangin po para sa pamilya ko.', 'whitespace collapsed/trimmed on create');
  assert(created.data.prayer.country_code === 'KW', 'client-supplied countryCode is ignored — request.cf.country wins');
  assert(created.data.prayer.country_name === 'Kuwait', 'a readable country_name is derived for the response');
  assert(created.data.prayer.first_name === 'Maria', 'first_name is trimmed and stored');
  assert(created.data.prayer.origin_country === 'Philippines', 'origin_country is trimmed and stored');
  const prayerId = created.data.prayer.id;

  const listed = await call(env, ctx, 'GET', '/api/prayers');
  assert(listed.data.prayers.length === 1 && listed.data.prayers[0].id === prayerId, 'new prayer appears in the feed');
  assert(listed.data.prayers[0].country_name === 'Kuwait', 'country_name is also present when listing the feed');
  assert(listed.data.prayers[0].first_name === 'Maria' && listed.data.prayers[0].origin_country === 'Philippines',
    'first_name and origin_country round-trip through the feed');

  const anonymous = await call(env, ctx, 'POST', '/api/prayers', { content: 'Panalangin lang, walang pangalan.' });
  assert(anonymous.data.prayer.first_name === null && anonymous.data.prayer.origin_country === null,
    'first_name and origin_country stay optional — omitting them degrades to null, not an error');

  const fromSingapore = await call(env, ctx, 'POST', '/api/prayers',
    { content: 'Sana po ma-renew ang aking visa dito.' }, { country: 'SG' });
  assert(fromSingapore.data.prayer.country_code === 'SG' && fromSingapore.data.prayer.country_name === 'Singapore',
    'a different edge country is picked up correctly');

  const noCf = await call(env, ctx, 'POST', '/api/prayers', { content: 'Walang cf sa request na ito, dapat okay pa rin.' }, {});
  assert(noCf.status === 200 && noCf.data.prayer.country_code === null,
    'missing/unknown request.cf.country degrades to null instead of erroring');

  const badHash = await call(env, ctx, 'POST', '/api/prayers/pray', { prayerId, userHash: 'not-a-hash' });
  assert(badHash.status === 400, 'malformed userHash is rejected');

  const realHash = nodeCrypto.createHash('sha256').update('device+prayer').digest('hex');
  const pray1 = await call(env, ctx, 'POST', '/api/prayers/pray', { prayerId, userHash: realHash });
  assert(pray1.status === 200 && pray1.data.counted === true && pray1.data.prayerCount === 1, 'first prayer tap counts');

  const pray2 = await call(env, ctx, 'POST', '/api/prayers/pray', { prayerId, userHash: realHash });
  assert(pray2.status === 200 && pray2.data.counted === false, 'duplicate tap from the same hash does not double-count');
  assert(/Sinalo na natin/.test(pray2.data.message), 'duplicate tap gets the supportive Filipino message');
}

// ── Scenario 3: push subscribe / unsubscribe ──────────────────────────────
{
  const env = { KASAMA_DB: db, VAPID_PUBLIC_KEY: vapidPublicB64url };
  const ctx = makeCtx();

  const key = await call(env, ctx, 'GET', '/api/push/vapid-public-key');
  assert(key.data.configured === true && key.data.publicKey === vapidPublicB64url, 'public key exposed once VAPID_PUBLIC_KEY is set');

  const sub = makeSubscriber('https://push.test/device-x');
  const subscribed = await call(env, ctx, 'POST', '/api/push/subscribe', {
    subscription: { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
  });
  assert(subscribed.status === 200 && subscribed.data.subscribed === true, 'subscribe stores the subscription');

  // Re-subscribing the same endpoint with new keys should upsert, not duplicate.
  const sub2 = makeSubscriber(sub.endpoint);
  await call(env, ctx, 'POST', '/api/push/subscribe', {
    subscription: { endpoint: sub2.endpoint, keys: { p256dh: sub2.p256dh, auth: sub2.auth } },
  });
  const rows = db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').first();
  assert(rows.n === 1, 'resubscribing the same endpoint upserts instead of duplicating');

  const invalid = await call(env, ctx, 'POST', '/api/push/subscribe', { subscription: { endpoint: 'not-https', keys: {} } });
  assert(invalid.status === 400, 'a malformed subscription is rejected');

  const unsub = await call(env, ctx, 'POST', '/api/push/unsubscribe', { endpoint: sub.endpoint });
  assert(unsub.data.subscribed === false, 'unsubscribe reports subscribed:false');
  const afterUnsub = db.prepare('SELECT COUNT(*) AS n FROM push_subscriptions').first();
  assert(afterUnsub.n === 0, 'unsubscribe actually removes the row');
}

// ── Scenario 4: end-to-end push fan-out on a new prayer, with real decryption ──
{
  const env = {
    KASAMA_DB: db,
    VAPID_PRIVATE_KEY_JWK: JSON.stringify(vapidPrivateJwk),
    VAPID_PUBLIC_KEY: vapidPublicB64url,
    VAPID_SUBJECT: 'mailto:test@example.com',
  };
  const ctx = makeCtx();

  const live1 = makeSubscriber('https://push.test/live-1');
  const live2 = makeSubscriber('https://push.test/live-2');
  const stale = makeSubscriber('https://push.test/stale-device');
  for (const s of [live1, live2, stale]) {
    await call(env, ctx, 'POST', '/api/push/subscribe', {
      subscription: { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
    });
  }

  const sentTo = [];
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (url, opts) => {
    sentTo.push({ url: String(url), opts });
    if (url === stale.endpoint) return new Response(null, { status: 410 }); // gone
    return new Response(null, { status: 201 });
  };

  try {
    const created = await call(env, ctx, 'POST', '/api/prayers', {
      content: 'Ipanalangin sana ang aking pamilya na malayo sa akin ngayon.',
    });
    assert(created.status === 200, 'prayer creation still succeeds even with push subscribers present');
    await ctx.flush();
  } finally {
    globalThis.fetch = originalFetch;
  }

  assert(sentTo.length === 3, `push was attempted for all 3 subscribers (got ${sentTo.length})`);

  const toLive1 = sentTo.find((s) => s.url === live1.endpoint);
  assert(!!toLive1, 'a push was sent to live-1');
  const auth = toLive1.opts.headers.Authorization || toLive1.opts.headers.get?.('Authorization');
  assert(/^vapid t=.+, k=.+$/.test(auth), 'Authorization header has the vapid t=.., k=.. shape');
  assert(toLive1.opts.headers['Content-Encoding'] === 'aes128gcm', 'Content-Encoding: aes128gcm header set');

  // Decrypt what the Worker actually sent, using the reference decoder, and
  // confirm it is a real, well-formed notification about this exact prayer.
  const rawBody = Buffer.from(toLive1.opts.body);
  const decrypted = ece.decrypt(rawBody, { version: 'aes128gcm', privateKey: live1.curve, authSecret: live1.authSecret });
  const notification = JSON.parse(decrypted.toString('utf8'));
  assert(/Bagong panalangin/.test(notification.title), 'decrypted notification has the expected Filipino title');
  assert(notification.body.startsWith('Ipanalangin sana'), 'decrypted notification body is the actual prayer excerpt');
  assert(typeof notification.url === 'string', 'decrypted notification carries a url to open');

  const remaining = db.prepare('SELECT endpoint FROM push_subscriptions ORDER BY endpoint').all().results;
  assert(remaining.length === 2 && !remaining.some((r) => r.endpoint === stale.endpoint),
    'the subscriber whose push service returned 410 was pruned from the database');
}

// ── POST /api/publish/attendance — a steward publishes with a passcode ─────
// The property that matters: the church comes from the passcode, never from
// the request, so a steward cannot reach another church's file.
{
  console.log('\n— attendance publish —');

  const env = {
    ATTENDANCE_PASSCODES: JSON.stringify({ shekinah: 'shek-pass', abundance: 'abun-pass' }),
    GITHUB_TOKEN: 'gh-token',
    GITHUB_REPO: 'example/repo',
  };
  const validBody = (passcode, extra = {}) => JSON.stringify({
    passcode,
    steward: 'Sis. Ana',
    content: {
      meta: { churchName: 'FLCC - Shekinah' },
      sessions: [{ id: 's1', date: '2026-07-24', records: [] }],
    },
    ...extra,
  });
  const post = (body, e = env) => worker.fetch(
    new Request('https://x/api/publish/attendance', {
      method: 'POST', headers: { 'Content-Type': 'application/json' }, body,
    }), e, { waitUntil() {} }
  );

  // Capture the GitHub calls instead of making them.
  const originalFetch = globalThis.fetch;
  let puts = [];
  globalThis.fetch = async (url, opts = {}) => {
    if (String(url).includes('api.github.com')) {
      if ((opts.method || 'GET') === 'GET') return new Response('{}', { status: 404 });
      puts.push({ url: String(url), body: JSON.parse(opts.body) });
      return new Response(JSON.stringify({ commit: { sha: 'deadbeef' } }), { status: 200 });
    }
    return originalFetch(url, opts);
  };

  try {
    const ok = await post(validBody('shek-pass'));
    const okBody = await ok.json();
    assert(ok.status === 200, 'a valid passcode publishes');
    assert(okBody.church === 'shekinah', 'the response names the church the passcode belongs to');
    assert(puts.length === 1 && puts[0].url.endsWith('/contents/churches/shekinah/attendance.json'),
      `the write went to that church's own file (${puts[0]?.url})`);
    assert(/Sis\. Ana/.test(puts[0].body.message), 'the commit message credits the steward');

    // Abundance's files predate the churches/ folder and stayed at the root.
    puts = [];
    await post(validBody('abun-pass'));
    assert(puts[0].url.endsWith('/contents/attendance.json'), 'abundance still publishes to the repo root');

    // The attack this design exists to stop.
    puts = [];
    const crossChurch = await post(validBody('shek-pass', { church: 'abundance', path: 'index.html' }));
    assert(crossChurch.status === 200, 'naming another church in the body is not an error…');
    assert(puts[0].url.endsWith('/contents/churches/shekinah/attendance.json'),
      '…it is simply ignored — the passcode still decides the file');

    puts = [];
    const wrong = await post(validBody('not-a-passcode'));
    assert(wrong.status === 401, 'an unknown passcode is rejected');
    assert(puts.length === 0, 'nothing is written when the passcode is wrong');

    const junk = await post(JSON.stringify({ passcode: 'shek-pass', content: { hello: 'world' } }));
    assert(junk.status === 400, 'a valid passcode still cannot write arbitrary content');

    const off = await post(validBody('shek-pass'), { ATTENDANCE_PASSCODES: '', GITHUB_TOKEN: '' });
    assert(off.status === 503, 'the endpoint stays off until the Worker has its secrets');
  } finally {
    globalThis.fetch = originalFetch;
  }
}

console.log(failures ? `\n${failures} FAILURE(S)` : '\nALL PASSED');
process.exit(failures ? 1 : 0);
