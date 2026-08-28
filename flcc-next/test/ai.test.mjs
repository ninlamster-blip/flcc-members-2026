import test from 'node:test';
import assert from 'node:assert/strict';
import { systemPrompt, buildRequest, parseParts, PARTS, MAX_TOKENS, isConfigured, DISCLOSURE } from '../js/core/ai.js';
import * as store from '../js/core/storage.js';

test('the prompt fixes the five parts and the rules that cannot bend', () => {
  const prompt = systemPrompt('teens');
  for (const marker of ['[TALK]', '[BIBLE]', '[THINK]', '[PRAY]', '[STEP]']) {
    assert.ok(prompt.includes(marker), `missing ${marker}`);
  }
  assert.match(prompt, /not God and you are not Jesus/i);
  assert.match(prompt, /never replace a parent|do not give medical|never replace a parent, a guardian/i);
  assert.match(prompt, /trusted adult/i);
  assert.match(prompt, /disagree/i);
});

test('the two age groups get different registers and different lengths', () => {
  assert.notEqual(systemPrompt('kids'), systemPrompt('teens'));
  assert.match(systemPrompt('kids'), /child between 7 and 12/i);
  assert.match(systemPrompt('teens'), /teenager between 13 and 18/i);
  assert.ok(MAX_TOKENS.kids < MAX_TOKENS.teens);
});

test('nothing the child has saved can reach the request', () => {
  // Seed the app with everything private it can hold, then build a request and
  // check the wire payload for each of those exact strings. The five-part
  // prompt legitimately contains words like "prayer", so the test looks for
  // the stored *values*, not for vocabulary.
  store.wipe();
  store.write(store.KEYS.user, { name: 'Zephaniah Okonkwo', age: 15, birthday: '2011-04-02' });
  store.write(store.KEYS.prayers, { items: [{ id: 'p1', text: 'My mum is in hospital again.' }] });
  store.write(store.KEYS.ask, { turns: [{ role: 'user', text: 'I felt invisible at school.' }] });

  const body = buildRequest({ question: 'Is it okay to doubt?', mode: 'teens' });
  const payload = JSON.stringify(body);
  for (const secret of ['Zephaniah Okonkwo', '2011-04-02', 'My mum is in hospital again.',
    'I felt invisible at school.', 'next/v1']) {
    assert.ok(!payload.includes(secret), `must not send: ${secret}`);
  }
  store.wipe();
});

test('only the question, the recent turns and the age group are sent', () => {
  const body = buildRequest({ question: 'Is it okay to doubt?', mode: 'teens',
    history: [{ role: 'user', text: 'earlier' }, { role: 'assistant', text: 'a reply' }] });
  assert.deepEqual(Object.keys(body).sort(), ['max_tokens', 'messages', 'model', 'system']);
  assert.equal(body.messages.at(-1).content, 'Is it okay to doubt?');
  assert.deepEqual(body.messages.slice(0, 2), [
    { role: 'user', content: 'earlier' },
    { role: 'assistant', content: 'a reply' },
  ]);
  assert.equal(body.max_tokens, MAX_TOKENS.teens);
});

test('only the last four turns travel with the question', () => {
  const history = Array.from({ length: 9 }, (_, i) => ({ role: 'user', text: `turn ${i}` }));
  const body = buildRequest({ question: 'and now?', mode: 'kids', history });
  assert.equal(body.messages.length, 5);
  assert.equal(body.messages[0].content, 'turn 5');
});

test('a very long question is truncated rather than sent whole', () => {
  assert.equal(buildRequest({ question: 'x'.repeat(9000), mode: 'kids' }).messages.at(-1).content.length, 1500);
});

test('an answer is split into the five parts the app renders', () => {
  const reply = [
    '[TALK] That is a hard question, and asking it is not a failure.',
    '[BIBLE] Psalm 34:18 says the Lord is near to the broken-hearted.',
    '[THINK] Where have you felt most alone this week?',
    '[PRAY] God, I do not understand this. Stay close anyway.',
    '[STEP] Tell one person you trust how you actually are.',
  ].join('\n');
  const parts = parseParts(reply);
  assert.deepEqual(parts.map((p) => p.key), ['talk', 'bible', 'think', 'pray', 'step']);
  assert.match(parts[1].body, /Psalm 34:18/);
  assert.deepEqual(PARTS.map((p) => p.key), ['talk', 'bible', 'think', 'pray', 'step']);
});

test('a reply that ignores the shape is shown, not silently dropped', () => {
  const parts = parseParts('Just a paragraph with no markers.');
  assert.equal(parts.length, 1);
  assert.equal(parts[0].body, 'Just a paragraph with no markers.');
  assert.deepEqual(parseParts(''), []);
});

test('Ask NEXT stays off until a ministry leader configures it', () => {
  assert.equal(isConfigured(null), false);
  assert.equal(isConfigured({ aiEnabled: true, aiWorker: '' }), false);
  assert.equal(isConfigured({ aiEnabled: false, aiWorker: 'https://x.workers.dev' }), false);
  assert.equal(isConfigured({ aiEnabled: true, aiWorker: 'https://x.workers.dev' }), true);
  assert.match(DISCLOSURE, /can get things wrong/i);
});
