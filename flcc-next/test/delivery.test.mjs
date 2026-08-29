// The one rule: never report a delivery that did not happen.
//
// Every case below is a way sending can go wrong — switched off, offline,
// refused, timed out, answered with nonsense — and in every one of them
// `delivered` must be false, because a teenager once read "Sent to a ministry
// leader" about a prayer that had gone nowhere.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as delivery from '../js/core/delivery.js';

const realFetch = globalThis.fetch;
const origin = 'https://church.example';

/** Stand in for the network. `reply` sees the URL and the parsed body. */
function serve(reply) {
  const calls = [];
  globalThis.location = { origin };
  globalThis.fetch = async (url, options = {}) => {
    const body = options.body ? JSON.parse(options.body) : null;
    calls.push({ url: String(url), method: options.method || 'GET', body, headers: options.headers || {} });
    const answer = await reply(String(url), body, options);
    if (answer instanceof Error) throw answer;
    return {
      ok: answer.status >= 200 && answer.status < 300,
      status: answer.status,
      json: async () => answer.data,
    };
  };
  return calls;
}

test.afterEach(() => { globalThis.fetch = realFetch; });

test('availability is asked before anything is promised', async () => {
  const calls = serve(() => ({ status: 200, data: { ok: true, nextPrayers: true } }));
  assert.equal(await delivery.available(), true);
  assert.equal(calls[0].url, `${origin}/ping`);

  serve(() => ({ status: 200, data: { ok: true, nextPrayers: false } }));
  assert.equal(await delivery.available(), false, 'a Worker with nowhere to put a prayer is not available');

  serve(() => new Error('offline'));
  assert.equal(await delivery.available(), false, 'an unreachable Worker is not available');

  serve(() => ({ status: 200, data: null }));
  assert.equal(await delivery.available(), false, 'an empty answer is not availability');
});

test('a confirmed delivery is the only thing reported as delivered', async () => {
  const calls = serve(() => ({ status: 200, data: { configured: true, delivered: true, id: 'abc123' } }));
  const sent = await delivery.send({ content: 'Please pray for my mum', mood: 'worried', firstName: 'Sam', ageGroup: 'teens' });
  assert.deepEqual(sent, { delivered: true, id: 'abc123' });
  assert.equal(calls[0].url, `${origin}/api/next/prayers`);
  assert.equal(calls[0].method, 'POST');
  assert.deepEqual(calls[0].body, {
    content: 'Please pray for my mum', mood: 'worried', firstName: 'Sam', ageGroup: 'teens', urgent: false,
  });
});

test('every way it can fail comes back as not delivered', async () => {
  const cases = [
    ['switched off', () => ({ status: 200, data: { configured: false } }), 'off'],
    ['offline', () => new Error('network down'), 'offline'],
    ['server error', () => ({ status: 500, data: { error: { message: 'boom' } } }), 'refused'],
    ['rejected', () => ({ status: 400, data: { error: { message: 'no' } } }), 'refused'],
    ['a 200 that does not confirm', () => ({ status: 200, data: { configured: true } }), 'refused'],
    ['a 200 with no body at all', () => ({ status: 200, data: null }), 'refused'],
  ];
  for (const [name, reply, reason] of cases) {
    serve(reply);
    const sent = await delivery.send({ content: 'help' });
    assert.equal(sent.delivered, false, `${name}: must not claim delivery`);
    assert.equal(sent.reason, reason, name);
  }
});

test('an empty prayer never reaches the network', async () => {
  const calls = serve(() => ({ status: 200, data: { delivered: true } }));
  const sent = await delivery.send({ content: '   ' });
  assert.deepEqual(sent, { delivered: false, reason: 'empty' });
  assert.equal(calls.length, 0, 'nothing was sent');
});

test('the urgency hint travels, and is only ever a hint', async () => {
  const calls = serve(() => ({ status: 200, data: { configured: true, delivered: true, id: 'x' } }));
  const sent = await delivery.send({ content: 'I cannot do this any more', urgent: true });
  assert.equal(calls[0].body.urgent, true);
  assert.equal(sent.delivered, true, 'an urgent prayer is delivered like any other');
});

test('the leader key is sent as a header, never in the body or the URL', async () => {
  const calls = serve(() => ({ status: 200, data: { configured: true, prayers: [{ id: '1', content: 'hi' }] } }));
  const result = await delivery.queue('secret-key');
  assert.equal(result.ok, true);
  assert.equal(result.prayers.length, 1);
  assert.equal(calls[0].headers['x-leader-key'], 'secret-key');
  assert.ok(!calls[0].url.includes('secret-key'), 'a key in a URL ends up in logs');
  assert.equal(calls[0].body, null);
});

test('a child’s app never sends a key, because it does not have one', async () => {
  const calls = serve(() => ({ status: 200, data: { configured: true, delivered: true, id: 'x' } }));
  await delivery.send({ content: 'a prayer' });
  assert.ok(!('x-leader-key' in calls[0].headers), 'the send path carries no credential');
});

test('reading the queue without a key does not even ask', async () => {
  const calls = serve(() => ({ status: 200, data: { prayers: [] } }));
  const result = await delivery.queue('');
  assert.deepEqual(result, { ok: false, reason: 'no-key', prayers: [] });
  assert.equal(calls.length, 0);
});

test('a refused or unconfigured queue returns no prayers and says why', async () => {
  serve(() => ({ status: 401, data: { error: { message: 'nope' } } }));
  assert.deepEqual(await delivery.queue('wrong'), { ok: false, reason: 'bad-key', prayers: [] });

  serve(() => ({ status: 200, data: { configured: false } }));
  assert.deepEqual(await delivery.queue('any'), { ok: false, reason: 'off', missing: [], prayers: [] });

  serve(() => new Error('down'));
  assert.deepEqual(await delivery.queue('any'), { ok: false, reason: 'offline', prayers: [] });
});

test('marking a prayer is confirmed by the server, not assumed', async () => {
  serve(() => ({ status: 200, data: { configured: true, id: '1', status: 'read' } }));
  assert.equal(await delivery.mark('key', '1', 'read'), true);

  serve(() => ({ status: 200, data: { configured: true, id: '1', status: 'pending' } }));
  assert.equal(await delivery.mark('key', '1', 'read'), false, 'a different status back is not success');

  serve(() => ({ status: 401, data: null }));
  assert.equal(await delivery.mark('key', '1', 'read'), false);

  serve(() => new Error('down'));
  assert.equal(await delivery.mark('key', '1', 'read'), false);
});

// ── Diagnosability ─────────────────────────────────────────────────────────
// "Delivery is off" left whoever was setting it up hunting through two
// unrelated settings pages. The Worker now says which half is missing.

test('readiness names the missing half, not just "off"', async () => {
  serve(() => ({ status: 200, data: { ok: true, nextPrayers: false, nextDatabase: false, nextLeaderKey: true } }));
  assert.deepEqual(await delivery.readiness(), { reachable: true, ready: false, missing: ['database'] });

  serve(() => ({ status: 200, data: { ok: true, nextPrayers: false, nextDatabase: true, nextLeaderKey: false } }));
  assert.deepEqual(await delivery.readiness(), { reachable: true, ready: false, missing: ['leaderKey'] });

  serve(() => ({ status: 200, data: { ok: true, nextPrayers: false, nextDatabase: false, nextLeaderKey: false } }));
  assert.deepEqual(await delivery.readiness(), { reachable: true, ready: false, missing: ['database', 'leaderKey'] });

  serve(() => ({ status: 200, data: { ok: true, nextPrayers: true, nextDatabase: true, nextLeaderKey: true } }));
  assert.deepEqual(await delivery.readiness(), { reachable: true, ready: true, missing: [] });
});

test('an unreachable Worker is distinguished from a misconfigured one', async () => {
  serve(() => new Error('offline'));
  assert.deepEqual(await delivery.readiness(), { reachable: false, ready: false, missing: [] });
});

test('an older deployment that does not report the halves still reads as off', async () => {
  // A Worker predating this change answers /ping without the new fields.
  serve(() => ({ status: 200, data: { ok: true, keySet: true } }));
  const state = await delivery.readiness();
  assert.equal(state.ready, false);
  assert.deepEqual(state.missing, ['database', 'leaderKey'], 'absent fields read as absent, never as ready');
});

test('the queue carries the missing pieces through to the dashboard', async () => {
  serve(() => ({ status: 200, data: { configured: false, missing: ['leaderKey'] } }));
  const result = await delivery.queue('any');
  assert.equal(result.reason, 'off');
  assert.deepEqual(result.missing, ['leaderKey']);

  serve(() => ({ status: 200, data: { configured: false } }));
  assert.deepEqual((await delivery.queue('any')).missing, [], 'an older Worker simply says nothing');
});
