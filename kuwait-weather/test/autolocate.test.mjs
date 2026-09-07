// Locating on load is what people want from a weather app. Asking for it
// badly is how the permission gets denied for good. These are the rules that
// keep the two apart.

import test from 'node:test';
import assert from 'node:assert/strict';
import { shouldAutoLocate, permissionState, isRefusal, placeFromFix, PERMISSIONS } from '../js/core/autolocate.js';

test('a first visit locates, because that is what the app is for', () => {
  assert.equal(shouldAutoLocate({ permission: 'prompt', chosen: null }), true);
});

test('once granted it locates every load, with no dialog to be rude with', () => {
  assert.equal(shouldAutoLocate({ permission: 'granted', chosen: null }), true);
  assert.equal(shouldAutoLocate({ permission: 'granted', chosen: { id: 'here' } }), true);
});

test('a place picked off the list is never overruled', () => {
  // Someone who chose Jahra means it. Opening on their GPS fix instead would
  // be the app quietly undoing that decision every morning.
  for (const permission of PERMISSIONS) {
    assert.equal(shouldAutoLocate({ permission, chosen: { id: 'jahra' } }), false, permission);
  }
});

test('"here" is not a pinned place — it is what this mechanism writes', () => {
  assert.equal(shouldAutoLocate({ permission: 'granted', chosen: { id: 'here' } }), true);
  assert.equal(shouldAutoLocate({ permission: 'prompt', chosen: { id: 'here' } }), true);
});

test('a refusal is taken for an answer', () => {
  // Asking again on the next load is exactly the behaviour that earns a
  // permanent Block, and it costs the feature for good.
  assert.equal(shouldAutoLocate({ permission: 'prompt', declined: true }), false);
  assert.equal(shouldAutoLocate({ permission: 'denied' }), false);
  assert.equal(shouldAutoLocate({ permission: 'denied', declined: false }), false);
});

test('a decline can be undone by granting it later', () => {
  // Tapping the button and allowing it clears the record, so the next load
  // locates again rather than staying sulking.
  assert.equal(shouldAutoLocate({ permission: 'granted', declined: true }), true);
});

test('no geolocation at all means no attempt', () => {
  assert.equal(shouldAutoLocate({ permission: 'granted', supported: false }), false);
});

test('the default is the cautious one', () => {
  assert.equal(shouldAutoLocate(), true, 'a first run on a fresh browser still locates');
  assert.equal(shouldAutoLocate({ permission: 'something-new' }), false, 'an unknown state is not consent');
});

test('a browser that will not answer is treated as "prompt", not as permission', () => {
  const throws = { permissions: { query: () => { throw new Error('unsupported'); } } };
  const rejects = { permissions: { query: () => Promise.reject(new Error('no')) } };
  const missing = {};
  return Promise.all([
    permissionState(throws).then((s) => assert.equal(s, 'prompt')),
    permissionState(rejects).then((s) => assert.equal(s, 'prompt')),
    permissionState(missing).then((s) => assert.equal(s, 'prompt')),
  ]);
});

test('a browser that does answer is believed', async () => {
  for (const state of PERMISSIONS) {
    const nav = { permissions: { query: async () => ({ state }) } };
    assert.equal(await permissionState(nav), state);
  }
  const odd = { permissions: { query: async () => ({ state: 'maybe' }) } };
  assert.equal(await permissionState(odd), 'prompt', 'an unrecognised answer is not permission');
});

test('a timeout is not a refusal, and must not be remembered as one', () => {
  // Losing a fix in a basement or a lift is not somebody saying no. Recording
  // it as one would silently switch the feature off for them.
  assert.equal(isRefusal({ code: 1 }), true, 'PERMISSION_DENIED');
  assert.equal(isRefusal({ code: 2 }), false, 'POSITION_UNAVAILABLE');
  assert.equal(isRefusal({ code: 3 }), false, 'TIMEOUT');
  assert.equal(isRefusal(null), false);
  assert.equal(isRefusal(new Error('something else')), false);
});

// ── turning a fix into a place ───────────────────────────────────────────────

test('a fix near a listed area takes that area\'s name', () => {
  // "Fahaheel" is more use to somebody standing in it than "29.08, 48.13".
  const p = placeFromFix({ latitude: 29.0826, longitude: 48.1305 });
  assert.equal(p.id, 'fahaheel');
  assert.equal(p.name, 'Fahaheel');
  assert.equal(p.gov, 'Ahmadi');
});

test('a fix out in the desert says which area it is near', () => {
  // Between Wafra and Khiran: inside Kuwait, nowhere in particular.
  const p = placeFromFix({ latitude: 28.72, longitude: 48.15 });
  assert.equal(p.id, 'here');
  assert.match(p.name, /^Near /);
  assert.equal(p.gov, 'Kuwait');
});

test('a fix outside Kuwait is not quietly pretended to be inside it', () => {
  const dubai = placeFromFix({ latitude: 25.2048, longitude: 55.2708 });
  assert.equal(dubai.id, 'here');
  assert.equal(dubai.gov, 'Outside Kuwait');
  assert.equal(dubai.name, 'Your location');
  assert.equal(dubai.lat, 25.2048);
});

test('every fix is marked as one, including the ones that snap to a name', () => {
  // The mark is what lets the app say "this is where you are" rather than
  // "this is somewhere you picked". Snapping onto Fahaheel is still a fix.
  for (const coords of [
    { latitude: 29.0826, longitude: 48.1305 },  // on a listed area
    { latitude: 28.72, longitude: 48.15 },      // near one
    { latitude: 25.2048, longitude: 55.2708 },  // another country
  ]) {
    assert.equal(placeFromFix(coords).fromFix, true, JSON.stringify(coords));
  }
});

test('a fix carries a real coordinate when it is not a listed place', () => {
  const p = placeFromFix({ latitude: 28.72, longitude: 48.15 });
  assert.equal(typeof p.lat, 'number');
  assert.equal(typeof p.lon, 'number');
});
