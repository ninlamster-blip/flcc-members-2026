// ASK.
//
// The thing worth testing here is not that a model answers well — nothing in a
// unit test can hold that. It is everything around the model: that the crisis
// screen runs before the network, that the request carries the question and
// nothing about the person, that a reply which ignores the required shape is
// visible as one block rather than passing as five parts, and that a member
// who switched ASK off gets no request at all.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as ai from '../js/core/ai.js';

test('the five parts are the five the prompt asks for', () => {
  assert.deepEqual(ai.PARTS.map((one) => one.key),
    ['heard', 'scripture', 'meaning', 'pray', 'step']);
  const prompt = ai.systemPrompt();
  for (const marker of ['[HEARD]', '[SCRIPTURE]', '[MEANING]', '[PRAY]', '[STEP]']) {
    assert.ok(prompt.includes(marker), `the prompt never asks for ${marker}`);
  }
});

test('the prompt forbids the things that would do real damage', () => {
  const prompt = ai.systemPrompt().toLowerCase();
  assert.ok(prompt.includes('you are not god'), 'it may claim to be God');
  assert.ok(/never say what god is telling this person/.test(prompt),
    'it may tell somebody what God is saying to them');
  assert.ok(/pastor, a doctor, a counsellor/.test(prompt), 'it may stand in for a professional');
  assert.ok(/christians genuinely disagree/.test(prompt), 'it may present one side as settled');
  assert.ok(/never tell someone their suffering is a lesson/.test(prompt),
    'it may tell a grieving adult their loss was a lesson');
});

test('it is written for an adult, not softened for a child', () => {
  const prompt = ai.systemPrompt();
  assert.ok(/talking to an adult/i.test(prompt));
  // The kids edition's register would be wrong here, and this is the line that
  // catches a copy-paste from it.
  assert.equal(/child between|teenager between|simple words/i.test(prompt), false,
    'the kids edition’s register has been copied in');
});

test('the request carries the question and nothing about the person', () => {
  const body = ai.buildRequest({ question: 'Why does prayer feel like talking to the ceiling?' });
  const wire = JSON.stringify(body);
  assert.equal(body.messages.at(-1).content, 'Why does prayer feel like talking to the ceiling?');
  for (const leak of ['season', 'focus', 'prayers', 'journal', 'reflection', 'firstName', 'adults/v1']) {
    assert.equal(wire.includes(leak), false, `the request carries "${leak}"`);
  }
});

test('a very long question is cut rather than sent whole', () => {
  const body = ai.buildRequest({ question: 'x'.repeat(9000) });
  assert.equal(body.messages.at(-1).content.length, 2000);
});

test('only the last few turns are sent back', () => {
  const history = Array.from({ length: 12 }, (_, i) => ({ role: 'user', text: `turn ${i}` }));
  const body = ai.buildRequest({ question: 'and now?', history });
  assert.equal(body.messages.length, 5, 'four turns of history plus the question');
  assert.equal(body.messages[0].content, 'turn 8');
});

test('a reply in the right shape becomes five posters', () => {
  const parts = ai.parseParts([
    '[HEARD] You are asking whether it is normal.',
    '[SCRIPTURE] Psalm 88 ends in darkness.',
    '[MEANING] The Bible has a genre for this.',
    '[PRAY] God, I do not have words.',
    '[STEP] Tell one person this week.',
  ].join('\n'));
  assert.deepEqual(parts.map((one) => one.key), ['heard', 'scripture', 'meaning', 'pray', 'step']);
  assert.equal(parts[1].body, 'Psalm 88 ends in darkness.');
});

test('a reply that ignores the shape arrives as one block, not as fake parts', () => {
  const parts = ai.parseParts('Here is a nice paragraph with no markers at all.');
  assert.equal(parts.length, 1);
  assert.equal(parts[0].key, 'heard');
  assert.equal(parts[0].body, 'Here is a nice paragraph with no markers at all.');
});

test('an empty reply is nothing, not an empty poster', () => {
  assert.deepEqual(ai.parseParts(''), []);
  assert.deepEqual(ai.parseParts(null), []);
});

/**
 * The default endpoint is same-origin.
 *
 * This app and `ask-proxy/worker.js` are served by the same Worker, so ASK
 * works with nothing to configure. The override exists only for a church
 * running the app somewhere else.
 */
test('ASK points at the church’s own proxy by default', () => {
  assert.equal(ai.endpointFor({}), '/proxy');
  assert.equal(ai.endpointFor({ aiWorker: 'https://elsewhere.workers.dev' }), 'https://elsewhere.workers.dev/proxy');
  assert.equal(ai.endpointFor({ aiWorker: 'https://elsewhere.workers.dev/' }), 'https://elsewhere.workers.dev/proxy');
});

test('ASK is on unless it was switched off', () => {
  assert.equal(ai.isEnabled({}), true);
  assert.equal(ai.isEnabled({ ask: 'on' }), true);
  assert.equal(ai.isEnabled({ ask: 'off' }), false);
});

/**
 * Nothing reaches the network when it should not.
 *
 * `fetch` is replaced with something that fails the test if it is called at
 * all, which is the only way to prove the crisis screen and the off switch
 * come BEFORE the request rather than after it.
 */
test('a question in crisis is never sent anywhere', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = () => { throw new Error('ASK sent a crisis message to the network'); };
  try {
    assert.equal((await ai.ask({ question: 'I want to die' })).kind, 'safety');
    assert.equal((await ai.ask({ question: 'my husband hits me' })).kind, 'safety');
    assert.equal((await ai.ask({ question: 'anything', settings: { ask: 'off' } })).kind, 'off');
  } finally { globalThis.fetch = real; }
});

test('a proxy that cannot be reached is offline, not an error page', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = () => Promise.reject(new Error('down'));
  try {
    assert.equal((await ai.ask({ question: 'why is prayer hard?' })).kind, 'offline');
  } finally { globalThis.fetch = real; }
});

test('an answer comes back parsed', async () => {
  const real = globalThis.fetch;
  globalThis.fetch = () => Promise.resolve({
    ok: true,
    json: () => Promise.resolve({ content: [{ type: 'text', text: '[HEARD] ok\n[STEP] go' }] }),
  });
  try {
    const result = await ai.ask({ question: 'what now?' });
    assert.equal(result.kind, 'answer');
    assert.deepEqual(result.parts.map((one) => one.key), ['heard', 'step']);
  } finally { globalThis.fetch = real; }
});
