// The crisis screen.
//
// This is the one suite in the app where a failure is not a bug report, it is
// somebody not getting help. The patterns are deliberately wide: a false
// positive costs a reader one unnecessary card about where to get help, and a
// false negative costs something that does not bear writing down.
//
// The second half matters as much as the first. A screen that fired on "I am
// struggling at work" would put a crisis card in front of every third question
// and teach members to scroll past it — which is how a screen stops working.

import test from 'node:test';
import assert from 'node:assert/strict';
import { isConcerning, SAFETY_CARD } from '../js/core/safety.js';

const CATCH = [
  'I want to die',
  'i dont want to be here anymore',
  'I have been thinking about suicide',
  'sometimes I think about ending it all',
  'everyone would be better off without me',
  'I cut myself last week and I have not told anyone',
  'I have been hurting myself again',
  'my husband hits me when he has been drinking',
  'my wife threatens me and I am ashamed to say it',
  'he beats me and the children have seen it',
  'I am scared to go home to him',
  'is it a sin to leave a domestic violence situation',
  'I was abused as a child and I have never told anyone',
  'my partner forces me to sleep with him',
];

const LEAVE_ALONE = [
  'Why does God allow suffering?',
  'I am struggling at work and I do not know what to do',
  'How do I forgive my father?',
  'My marriage has gone quiet. Is that a spiritual problem?',
  'I feel far from God and I have for about a year',
  'My mother is dying. What am I supposed to pray for?',
  'I am tired of church people',
  'What does the Bible say about debt?',
  'Is it wrong to be angry with God?',
  'I killed a houseplant, does that count as stewardship',
  'David killed Goliath — was that murder?',
  'How do I talk to my son about faith without pushing him away?',
];

test('it catches the ways an adult actually says it', () => {
  for (const line of CATCH) {
    assert.equal(isConcerning(line), true, `missed: "${line}"`);
  }
});

test('it leaves an ordinary hard question alone', () => {
  for (const line of LEAVE_ALONE) {
    assert.equal(isConcerning(line), false, `false positive: "${line}"`);
  }
});

test('nothing at all is not a crisis', () => {
  for (const value of ['', null, undefined, '   ']) {
    assert.equal(isConcerning(value), false);
  }
});

test('the card names people and numbers rather than offering counsel', () => {
  assert.ok(SAFETY_CARD.title.length > 0);
  assert.ok(SAFETY_CARD.body.length >= 3);
  assert.ok(SAFETY_CARD.lines.length >= 3, 'a card with no numbers on it is a card that does nothing');
  for (const line of SAFETY_CARD.lines) {
    assert.ok(line.name, 'a help line with no name');
    assert.ok(line.number || line.detail, `${line.name} has neither a number nor a detail`);
  }
  const text = [SAFETY_CARD.title, ...SAFETY_CARD.body].join(' ').toLowerCase();
  assert.ok(/not your fault|will not be judged/.test(text),
    'the card should say the one thing somebody in this position needs to hear');
  // It must not quote Scripture at somebody in danger, and it must not offer
  // to keep talking. Both were in an early draft and both were wrong.
  assert.equal(/psalm|romans|john \d|jeremiah 29/i.test(text), false,
    'the crisis card quotes Scripture at somebody who needs a phone number');
});

test('the card is the adult one, not the kids edition’s', () => {
  const text = [SAFETY_CARD.title, ...SAFETY_CARD.body].join(' ').toLowerCase();
  assert.equal(/grown-?up|tell a teacher|your parents|guardian/.test(text), false,
    'the kids edition’s card has been copied in — an adult in crisis is not a child in crisis');
});
