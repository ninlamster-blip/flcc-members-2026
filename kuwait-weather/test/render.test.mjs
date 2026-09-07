// The screens are strings, so they can be checked without a browser.

import test from 'node:test';
import assert from 'node:assert/strict';
import * as api from '../js/core/api.js';
import { derive } from '../js/core/derive.js';
import { advisories } from '../js/core/advisories.js';
import { toneFor } from '../js/ui/tone.js';
import * as view from '../js/ui/render.js';
import { forecast, air } from './fixtures/forecast.mjs';

const NOON = new Date('2026-07-15T09:00:00Z');
const reading = (f = forecast(), a = air()) => {
  const d = derive(api.normalize(f, a, { place: { id: 'jahra', name: 'Al Jahra', gov: 'Jahra' }, fetchedAt: NOON }), { now: NOON });
  d.units = 'C';
  return d;
};

// The illustrations are whole self-contained <svg> blocks, so they are lifted
// out before the surrounding markup is counted.
const tagsBalance = (html) => {
  const stripped = html.replace(/<svg[\s\S]*?<\/svg>/g, '');
  return {
    open: (stripped.match(/<[a-z]/g) || []).length,
    close: (stripped.match(/<\/[a-z]/g) || []).length,
  };
};

test('the reading leads with the number, at the size the design gives it', () => {
  const html = view.reading(reading(), 'C');
  assert.match(html, /class="reading-temp">48<span class="deg">°<\/span>/);
});

test('the three things beside the number are the three Kuwait needs', () => {
  // Three, not four. The reference gives the numeral most of the card, and a
  // fourth line beside it takes that room back. Today's high and low already
  // appear in the week row immediately below.
  const html = view.reading(reading(), 'C');
  assert.match(html, /Clear/, 'what the sky is doing');
  assert.match(html, /Feels like/);
  assert.match(html, /PM10/, 'the reference puts pollution here, and here it earns its place');
  assert.equal((html.match(/class="reading-pair"/g) || []).length, 2);
});

test('units switch all the way through', () => {
  assert.match(view.reading(reading(), 'F'), /class="reading-temp">118/); // 48 °C
  assert.match(view.reading(reading(), 'C'), /class="reading-temp">48/);
});

test('the note under the city says how the day is, and flags trapped humidity', () => {
  const d = reading();
  assert.match(view.sheetNote(d, 'severe'), /Stay inside/);
  assert.match(view.sheetNote(d, 'severe'), /humidity adds \d+°/);

  const dry = reading(forecast({ hour: () => ({ temperature_2m: 24, relative_humidity_2m: 20 }) }));
  assert.ok(!/humidity adds/.test(view.sheetNote(dry, 'calm')), 'a dry day has nothing to add');
});

test('the curve draws the day and labels its two lines', () => {
  const html = view.curve(reading(), NOON);
  assert.match(html, /class="curve"/);
  assert.match(html, /curve-line/);
  assert.match(html, /curve-feels/);
  assert.match(html, />Air</);
  assert.match(html, />Feels like</);
});

test('too little forecast to draw a curve draws none', () => {
  const d = reading();
  const past = new Date('2026-07-16T21:00:00Z');
  assert.equal(view.curve(d, past), '');
});

test('the advisory list never renders empty-handed', () => {
  const calm = view.advisoryList([]);
  assert.match(calm, /Nothing to warn you about/);
  assert.match(calm, /advisory--calm/);
  assert.match(calm, /<svg/, 'even the calm state gets a drawing');
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

test('the week lists every day, with today named as today', () => {
  const d = reading();
  const html = view.dayList(d, 'C');
  assert.equal((html.match(/<li class="day/g) || []).length, d.days.length);
  assert.match(html, /class="day is-today"/);
  assert.equal((html.match(/is-today/g) || []).length, 1, 'only one day is today');
  assert.match(html, /Today/);
});

test('a dusty day is marked in the week, a clear one is not', () => {
  const dusty = reading(forecast(), air({ hour: () => ({ pm10: 900 }) }));
  assert.match(view.dayList(dusty, 'C'), /day-dust dust--/);

  const clean = reading(forecast(), air({ hour: () => ({ pm10: 10, dust: 2 }) }));
  assert.ok(!/day-dust dust--/.test(view.dayList(clean, 'C')), 'clear air needs no mark');
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
    reading: view.reading(d, 'C'),
    curve: view.curve(d, NOON),
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
    view.reading(d, 'C'), view.sheetNote(d, 'calm'), view.curve(d, NOON),
    view.workCard(d, { profile: 'light', now: NOON }), view.dustCard(d),
    view.hourStrip(d, 'C', NOON), view.dayList(d, 'C'), view.detailGrid(d, 'C'),
  ].join('');
  assert.ok(!/undefined|NaN|\[object/.test(all), all.match(/.{0,40}(undefined|NaN|\[object).{0,40}/)?.[0]);
});

test('the page tint follows the advisories, not the temperature', () => {
  // A cool day with a dust storm has to be the alarming colour, and a hot
  // quiet one need not be.
  const storm = reading(forecast(), air({ hour: () => ({ pm10: 1400 }) }));
  assert.equal(toneFor(advisories(storm, { now: NOON })), 'severe');
});

test('the card is headed by the date, which nothing else in the app says', () => {
  // The city is already in the bar above the card, so repeating it there
  // spends the card's most prominent line on something already on screen.
  assert.equal(view.sheetDate(NOON), 'Wednesday 15 July');
});

test('no unit is printed inside a label the stylesheet uppercases', () => {
  // The labels beside the number are set in uppercase. Uppercasing "µg/m³"
  // prints "MG/M³" — micrograms shown as milligrams, wrong by a factor of a
  // thousand, in the number someone uses to decide whether to wear a mask.
  const html = view.reading(reading(), 'C');
  const labels = [...html.matchAll(/<span>([^<]*)<\/span>/g)].map((m) => m[1]);
  assert.ok(labels.length);
  for (const text of labels) {
    assert.equal(text, text.toUpperCase() === text.toUpperCase() ? text : text);
    for (const unit of ['µg', 'g/m', 'km/h', 'hPa', 'mm', 'kPa']) {
      assert.ok(!text.includes(unit), `"${text}" is uppercased on screen and carries the unit "${unit}"`);
    }
  }
  assert.match(html, /<i>µg\/m³<\/i>/, 'the unit belongs in the value, which is not uppercased');
});
