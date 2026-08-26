import test from 'node:test';
import assert from 'node:assert/strict';
import { buildRequest, systemPrompt, parseTiers, citedRefs, MAX_TOKENS, isConfigured, DISCLOSURE } from '../js/core/ai.js';

test('the system prompt fixes the three-tier contract and the refusal set', () => {
  const prompt = systemPrompt('11-14', 'John 3:16');
  assert.match(prompt, /\[SCRIPTURE\]/);
  assert.match(prompt, /\[BELIEVE\]/);
  assert.match(prompt, /\[DEBATE\]/);
  assert.match(prompt, /never claim to be|not a person/i);
  assert.match(prompt, /trusted adult/i);
  assert.match(prompt, /self-harm/i);
  assert.match(prompt, /John 3:16/, 'the screen context is passed through');
});

test('answers are sized for the reader, not for the model', () => {
  assert.ok(MAX_TOKENS['7-10'] < MAX_TOKENS['11-14']);
  assert.ok(MAX_TOKENS['11-14'] < MAX_TOKENS['15-18']);
  assert.equal(buildRequest({ question: 'Who was Moses?', band: '7-10' }).max_tokens, MAX_TOKENS['7-10']);
});

test('nothing about the child beyond the question and the band is sent', () => {
  const body = buildRequest({
    question: 'What does forgiveness mean?',
    band: '15-18',
    contextLabel: 'Matthew 18',
    history: [{ role: 'user', text: 'earlier question' }, { role: 'assistant', text: 'earlier answer' }],
  });
  const payload = JSON.stringify(body).toLowerCase();
  for (const word of ['joshua', 'birthyear', 'journal', 'prayer', 'lamp/v1']) {
    assert.ok(!payload.includes(word), `must not send ${word}`);
  }
  assert.equal(body.messages.at(-1).content, 'What does forgiveness mean?');
  assert.equal(body.messages.length, 3, 'the current question plus a short history');
});

test('a very long question is truncated rather than sent whole', () => {
  const body = buildRequest({ question: 'x'.repeat(5000), band: '11-14' });
  assert.equal(body.messages.at(-1).content.length, 2000);
});

test('answers are split into the tiers a child can see', () => {
  const answer = [
    'Here is the short version.',
    '[SCRIPTURE] Jesus says in John 14:6 that he is the way.',
    '[BELIEVE] Christians have held this since the earliest creeds.',
    '[DEBATE] Christians disagree about what this means for those who never hear.',
  ].join('\n');
  const tiers = parseTiers(answer);
  assert.deepEqual(tiers.map((t) => t.tier), ['plain', 'scripture', 'believe', 'debate']);
  assert.match(tiers[1].body, /John 14:6/);

  const unmarked = parseTiers('Just a plain answer.');
  assert.deepEqual(unmarked, [{ tier: 'plain', body: 'Just a plain answer.' }]);
  assert.deepEqual(parseTiers(''), []);
});

test('every reference an answer claims can be pulled out and checked', () => {
  const refs = citedRefs('See John 3:16 and 1 Corinthians 13:4-7, but not Hesitations 4:2.');
  assert.deepEqual(refs.map((r) => r.pretty), ['John 3:16', '1 Corinthians 13:4–7']);
});

test('Ask stays off until someone configures it', () => {
  assert.equal(isConfigured(null), false);
  assert.equal(isConfigured({ aiEnabled: true, aiWorker: '' }), false);
  assert.equal(isConfigured({ aiEnabled: false, aiWorker: 'https://example.workers.dev' }), false);
  assert.equal(isConfigured({ aiEnabled: true, aiWorker: 'https://example.workers.dev' }), true);
  assert.match(DISCLOSURE, /can make mistakes/i);
});
