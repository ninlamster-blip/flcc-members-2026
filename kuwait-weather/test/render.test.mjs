// The screens are strings, so they can be checked without a browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../js/core/api.js';
import { derive } from '../js/core/derive.js';
import { advisories } from '../js/core/advisories.js';
import * as view from '../js/ui/render.js';
import { forecast, air } from './fixtures/forecast.mjs';

const NOON = new Date('2026-07-15T09:00:00Z');
const reading = (f = forecast(), a = air()) => {
  const d = derive(api.normalize(f, a, { place: { id: 'jahra', name: 'Al Jahra', gov: 'Jahra' }, fetchedAt: NOON }), { now: NOON });
  d.units = 'C';
  return d;
};

// The icons are whole self-contained <svg> blocks, so they are lifted out
// before the surrounding markup is counted.
const tagsBalance = (html) => {
  const stripped = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  return {
    open: (stripped.match(/<[a-z]/g) || []).length,
    close: (stripped.match(/<\/[a-z]/g) || []).length,
  };
};

test('the hero shows a temperature, a condition and a feels-like', () => {
  const html = view.hero(reading(), 'C');
  assert.match(html, /48°C/);
  assert.match(html, /Clear/);
  assert.match(html, /Feels like/);
});

test('units switch all the way through', () => {
  assert.match(view.hero(reading(), 'F'), /118°F/); // 48 °C
  assert.match(view.hero(reading(), 'C'), /48°C/);
});

test('the advisory list never renders empty-handed', () => {
  const calm = view.advisoryList([]);
  assert.match(calm, /Nothing to warn you about/);
  assert.match(calm, /advisory--calm/);
});

test('advisories carry their severity into the markup', () => {
  const d = reading(forecast(), air({ hour: () => ({ pm10: 1200 }) }));
  const html = view.advisoryList(advisories(d, { now: NOON }));
  assert.match(html, /advisory--severe/);
  assert.match(html, /Dust storm/);
});

test('the work card shows the ban, the band and the profile buttons', () => {
  const html = view.workCard(reading(), { profile: 'moderate', now: NOON });
  assert.match(html, /Midday work ban in force/);
  assert.match(html, /Public Authority for Manpower/);
  assert.match(html, /Stop outdoor work/);
  assert.match(html, /data-profile="heavy"/);
  assert.match(html, /class="profile-btn is-on" data-profile="moderate"/);
  assert.match(html, /not measured/, 'the estimate has to say it is an estimate');
});

test('above 44 °C the card says the heat index is out of range', () => {
  assert.match(view.workCard(reading(), { profile: 'moderate', now: NOON }), /past the range/);
});

test('out of season the ban is shown as a fact, not as an alarm', () => {
  const winter = new Date('2026-01-15T09:00:00Z');
  const html = view.workCard(reading(), { profile: 'moderate', now: winter });
  assert.ok(!html.includes('ban--active'), 'nothing is in force in January');
  assert.ok(!html.includes('ban--idle'), 'and the row is not shown at all out of season');
});

test('the dust card degrades to a sentence when air quality is missing', () => {
  const noAir = reading(forecast({ hour: () => ({ visibility: null }) }), null);
  assert.match(view.dustCard(noAir), /isn't available/);
});

test('the hourly strip covers 24 hours and marks the banned ones', () => {
  const html = view.hourStrip(reading(), 'C', NOON);
  assert.equal((html.match(/<li class="hour/g) || []).length, 24);
  assert.match(html, /hour--banned/);
});

test('the week lists every day the forecast returned', () => {
  const d = reading();
  const html = view.dayList(d, 'C');
  assert.equal((html.match(/<li class="day">/g) || []).length, d.days.length);
  assert.match(html, /Today/);
});

test('the day bars stay inside their track', () => {
  const html = view.dayList(reading(), 'C');
  for (const [, left, width] of html.matchAll(/left:([\d.]+)%;width:([\d.]+)%/g)) {
    assert.ok(Number(left) >= 0 && Number(left) <= 100, `left ${left}`);
    assert.ok(Number(left) + Number(width) <= 100.5, `${left} + ${width} overflows`);
  }
});

test('the place list groups by governorate and marks the current place', () => {
  const html = view.placeOptions('jahra');
  assert.match(html, /<optgroup label="Ahmadi">/);
  assert.match(html, /value="jahra" selected/);
});

test('a place name from a device is escaped, not injected', () => {
  const nasty = '<img src=x onerror="alert(1)">';
  const html = view.placeOptions(nasty);
  assert.ok(!html.includes('<img'), html);
  assert.equal(view.esc(nasty), '&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');
});

test('every section closes the tags it opens', () => {
  const d = reading();
  for (const [name, html] of Object.entries({
    hero: view.hero(d, 'C'),
    work: view.workCard(d, { profile: 'moderate', now: NOON }),
    dust: view.dustCard(d),
    hours: view.hourStrip(d, 'C', NOON),
    days: view.dayList(d, 'C'),
    details: view.detailGrid(d, 'C'),
    advisories: view.advisoryList(advisories(d, { now: NOON })),
  })) {
    const { open, close } = tagsBalance(html);
    assert.equal(open, close, `${name}: ${open} opened, ${close} closed`);
  }
});

test('nothing renders the string "undefined" or "NaN" at a reader', () => {
  const sparse = forecast({ hour: () => ({ visibility: null, uv_index: null }) });
  sparse.current.pressure_msl = null;
  const d = reading(sparse, null);
  const all = [
    view.hero(d, 'C'), view.workCard(d, { profile: 'light', now: NOON }), view.dustCard(d),
    view.hourStrip(d, 'C', NOON), view.dayList(d, 'C'), view.detailGrid(d, 'C'),
  ].join('');
  assert.ok(!/undefined|NaN|\[object/.test(all), all.match(/.{0,40}(undefined|NaN|\[object).{0,40}/)?.[0]);
});
