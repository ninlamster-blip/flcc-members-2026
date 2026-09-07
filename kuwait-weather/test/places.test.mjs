import test from 'node:test';
import assert from 'node:assert/strict';
import * as places from '../js/core/places.js';

test('every place has an id, a name, a governorate and a coordinate', () => {
  for (const p of places.PLACES) {
    assert.ok(p.id && p.name, JSON.stringify(p));
    assert.ok(places.GOVERNORATES.includes(p.gov), `${p.name} is in "${p.gov}", which is not a governorate`);
    assert.equal(typeof p.lat, 'number');
    assert.equal(typeof p.lon, 'number');
  }
});

test('ids are unique — a duplicate would silently shadow a place', () => {
  const ids = places.PLACES.map((p) => p.id);
  assert.equal(new Set(ids).size, ids.length);
});

test('every place is actually in Kuwait', () => {
  for (const p of places.PLACES) {
    assert.ok(places.inKuwait(p.lat, p.lon), `${p.name} at ${p.lat},${p.lon} falls outside the bounds`);
  }
});

test('all six governorates are represented', () => {
  const covered = new Set(places.PLACES.map((p) => p.gov));
  assert.equal(covered.size, places.GOVERNORATES.length);
  assert.equal(places.GOVERNORATES.length, 6);
});

test('the default place exists and lookups fail softly', () => {
  assert.ok(places.defaultPlace());
  assert.equal(places.defaultPlace().id, places.DEFAULT_PLACE_ID);
  assert.equal(places.place('atlantis'), null);
  assert.equal(places.place(undefined), null);
});

test('grouping keeps every place and drops no governorate', () => {
  const grouped = places.byGovernorate();
  assert.equal(grouped.flatMap((g) => g.places).length, places.PLACES.length);
  assert.deepEqual(grouped.map((g) => g.gov), places.GOVERNORATES);
});

test('the nearest place to a coordinate is the obvious one', () => {
  assert.equal(places.nearest(29.3339, 48.0757).place.id, 'salmiya');
  assert.equal(places.nearest(29.0826, 48.1305).place.id, 'fahaheel');
  const { place, km } = places.nearest(29.3759, 47.9774);
  assert.equal(place.id, 'kuwait-city');
  assert.ok(km < 0.5);
});

test('somewhere well outside Kuwait is recognised as outside', () => {
  assert.ok(!places.inKuwait(25.2048, 55.2708), 'Dubai');
  assert.ok(!places.inKuwait(14.5995, 120.9842), 'Manila');
  assert.ok(places.inKuwait(29.3759, 47.9774), 'Kuwait City');
});

test('distance is measured on the sphere, not on the numbers', () => {
  // Kuwait City to Fahaheel is about 35 km.
  const km = places.distanceKm(29.3759, 47.9774, 29.0826, 48.1305);
  assert.ok(km > 30 && km < 42, `got ${km} km`);
  assert.equal(places.distanceKm(29, 48, 29, 48), 0);
});
