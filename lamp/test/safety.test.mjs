import test from 'node:test';
import assert from 'node:assert/strict';
import { isConcerning, safetyCard } from '../js/core/safety.js';

// These fixtures are the whole point of the safety layer: each one must be
// caught on the device, before anything is sent anywhere (SPEC.md §9, §11).
const MUST_ROUTE_TO_SAFETY = [
  'i want to die',
  'I want to kill myself',
  'sometimes I think about suicide',
  'I have been cutting myself and nobody knows',
  'everyone would be better off dead without me',
  "I don't want to live any more",
  'my dad is hitting me',
  'someone is hurting me at home',
  'he touched me in my private parts',
  'he made me promise to keep it a secret',
  'a man online asked me to send a nude photo',
  'my uncle has been abusing me',
  'I am thinking of running away from home',
];

const MUST_BE_ANSWERED_NORMALLY = [
  'Why did Jesus have to die?',
  'What happens after death?',
  'Why does God allow suffering?',
  'Who killed Goliath?',
  'Was it wrong for Israel to kill their enemies?',
  'I am scared about my exams',
  'My grandad died last year and I miss him',
  'Can Christians have doubts?',
  'What does the Bible say about anger?',
];

test('every crisis fixture is caught before anything is sent', () => {
  for (const message of MUST_ROUTE_TO_SAFETY) {
    assert.equal(isConcerning(message), true, `missed: "${message}"`);
  }
});

test('hard questions are still questions, not crises', () => {
  for (const message of MUST_BE_ANSWERED_NORMALLY) {
    assert.equal(isConcerning(message), false, `over-triggered on: "${message}"`);
  }
});

test('the safety card names a person, not a diagnosis', () => {
  const card = safetyCard('kw');
  assert.match(card.title, /not carry it alone/i);
  const text = card.body.join(' ');
  assert.match(text, /trusted|grown-up/i);
  assert.match(text, /not your fault/i);
  assert.match(text, /app, not a person/i);
  assert.equal(card.region, 'kw');
});
