import test from 'node:test';
import assert from 'node:assert/strict';
import * as wind from '../js/core/wind.js';

test('the compass names the sixteen points and wraps', () => {
  assert.equal(wind.compass(0), 'N');
  assert.equal(wind.compass(90), 'E');
  assert.equal(wind.compass(180), 'S');
  assert.equal(wind.compass(315), 'NW');
  assert.equal(wind.compass(360), 'N');
  assert.equal(wind.compass(370), 'N');
  assert.equal(wind.compass(-45), 'NW');
  assert.equal(wind.compass(null), null);
});

test('Beaufort covers everything from calm to storm', () => {
  assert.equal(wind.beaufort(0).force, 0);
  assert.equal(wind.beaufort(15).force, 3);
  assert.equal(wind.beaufort(200).label, 'Storm');
  assert.equal(wind.beaufort(null), null);
});

test('a shamal is a northwesterly, and nothing else is', () => {
  assert.ok(wind.isShamalDirection(320));
  assert.ok(wind.isShamalDirection(290));
  assert.ok(wind.isShamalDirection(355));
  assert.ok(!wind.isShamalDirection(280), 'a westerly is not a shamal');
  assert.ok(!wind.isShamalDirection(10), 'a northerly past the arc is not a shamal');
  assert.ok(!wind.isShamalDirection(135), 'the humid southeasterly is the opposite wind');
});

test('a light northwesterly is just a breeze', () => {
  assert.equal(wind.shamal({ speedKmh: 12, directionDeg: 320, month: 7 }), null);
  assert.ok(wind.shamal({ speedKmh: 30, directionDeg: 320, month: 7 }));
});

test('strength steps up with speed', () => {
  const at = (kmh) => wind.shamal({ speedKmh: kmh, directionDeg: 315, gustKmh: kmh + 15, month: 7 }).strength;
  assert.equal(at(28), 'blowing');
  assert.equal(at(45), 'strong');
  assert.equal(at(60), 'severe');
});

test('the two shamal seasons are named, and the months between them are not', () => {
  assert.equal(wind.shamalSeason(6), 'summer');
  assert.equal(wind.shamalSeason(7), 'summer');
  assert.equal(wind.shamalSeason(12), 'winter');
  assert.equal(wind.shamalSeason(2), 'winter');
  assert.equal(wind.shamalSeason(9), null);

  assert.match(wind.shamal({ speedKmh: 30, directionDeg: 320, month: 7 }).label, /Summer shamal/i);
  assert.match(wind.shamal({ speedKmh: 30, directionDeg: 320, month: 1 }).label, /Winter shamal/i);
  assert.match(wind.shamal({ speedKmh: 30, directionDeg: 320, month: 9 }).label, /Shamal/);
});

test('a missing direction or speed is not a shamal', () => {
  assert.equal(wind.shamal({ speedKmh: 40, directionDeg: null, month: 7 }), null);
  assert.equal(wind.shamal({ speedKmh: null, directionDeg: 320, month: 7 }), null);
});
