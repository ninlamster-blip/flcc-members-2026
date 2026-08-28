// The safety layer is the most important code in a children's app, so its
// fixtures are explicit and its failures are loud.

import test from 'node:test';
import assert from 'node:assert/strict';
import { isConcerning, SAFETY_CARD } from '../js/core/safety.js';

const MUST_STOP = [
  'i want to die',
  'I want to kill myself',
  'sometimes I think about suicide',
  'I have been cutting myself',
  'everyone would be better off dead without me',
  "I don't want to live any more",
  'my dad is hitting me',
  // Present tense, which the patterns missed until a real prayer went through
  // the urgency check and came back clean.
  'my dad hits me',
  'my mum hurts me',
  "I don't want to be here any more",
  // Written out in full, which is how it was actually typed.
  'I do not want to be here any more and I cannot tell anyone',
  'there is no point in carrying on',
  'someone is hurting me at home',
  'he touched me in my private parts',
  'he made me promise to keep it a secret',
  'a man online asked me to send a nude photo',
  'my uncle has been abusing me',
  'I am thinking of running away from home',
];

const MUST_ANSWER = [
  'Why does God allow suffering?',
  'How do I deal with stress?',
  'Is it okay to doubt?',
  'Why do I feel far from God?',
  'My grandad died last year and I miss him',
  'I am scared about my exams',
  'Who killed Goliath?',
  'What does the Bible say about anger?',
  'How do I know God’s will?',
];

test('every crisis fixture stops before anything is sent', () => {
  for (const message of MUST_STOP) assert.equal(isConcerning(message), true, `missed: "${message}"`);
});

test('hard questions are questions, not crises', () => {
  for (const message of MUST_ANSWER) assert.equal(isConcerning(message), false, `over-triggered: "${message}"`);
});

test('the card names a person, and does not counsel', () => {
  const text = SAFETY_CARD.body.join(' ');
  assert.match(text, /grown-up you trust/i);
  assert.match(text, /not your fault/i);
  assert.match(text, /app, not a person/i);
});
