// Wiring: pick a place, fetch it, derive it, draw it, keep it fresh.

import * as store from './core/storage.js';
import * as api from './core/api.js';
import * as places from './core/places.js';
import { derive } from './core/derive.js';
import { advisories } from './core/advisories.js';
import { toneFor } from './ui/tone.js';
import { shouldAutoLocate, permissionState, isRefusal, placeFromFix } from './core/autolocate.js';
import { DEFAULT_WORK_PROFILE, WORK_PROFILES } from './core/heat.js';
import { DEFAULT_UNITS, ago, parseLocal, clock, setLocale } from './core/format.js';
import { SIZES, DEFAULT_SIZE, nextSize, rootScale, announce } from './core/textsize.js';
import * as view from './ui/render.js';
import { createMap } from './ui/map.js';
import { icon } from './ui/icons.js';

const REFRESH_MS = 10 * 60 * 1000;   // the model publishes every 15 minutes
const RADAR_MS = 5 * 60 * 1000;      // radar moves faster than the model does
const STALE_MS = 60 * 60 * 1000;     // beyond this a cached reading is labelled old

const el = (id) => document.getElementById(id);

const state = {
  place: null,
  units: DEFAULT_UNITS,
  profile: DEFAULT_WORK_PROFILE,
  text: DEFAULT_SIZE,
  reading: null,     // normalized, as fetched
  derived: null,     // enriched, as drawn
  loading: false,
  error: null,
  cached: false,
};

// ── state, persisted ────────────────────────────────────────────────────────

function restore() {
  const savedPlace = store.read(store.KEYS.place);
  const listed = places.place(savedPlace?.id);
  state.place = (listed && savedPlace?.fromFix ? { ...listed, fromFix: true } : listed)
    || (savedPlace?.lat != null ? savedPlace : null)
    || places.defaultPlace();
  state.units = store.read(store.KEYS.units) === 'F' ? 'F' : 'C';
  const savedProfile = store.read(store.KEYS.work);
  state.profile = WORK_PROFILES.some((p) => p.id === savedProfile) ? savedProfile : DEFAULT_WORK_PROFILE;
  const savedText = store.read(store.KEYS.text);
  state.text = SIZES.some((t) => t.id === savedText) ? savedText : DEFAULT_SIZE;

  const last = store.read(store.KEYS.reading);
  if (last && last.place?.id === state.place.id) {
    state.reading = last;
    state.cached = true;
  }
}

// ── loading ─────────────────────────────────────────────────────────────────

let inFlight = null;

async function load({ force = false } = {}) {
  if (state.loading && !force) return;
  inFlight?.abort();
  inFlight = new AbortController();
  state.loading = true;
  state.error = null;
  render();

  try {
    const reading = await api.load({
      lat: state.place.lat,
      lon: state.place.lon,
      place: state.place,
      signal: inFlight.signal,
    });
    state.reading = reading;
    state.cached = false;
    store.write(store.KEYS.reading, reading);
  } catch (err) {
    if (err?.name === 'AbortError') return;
    // A cached reading is worth more than an empty screen, so a failed refresh
    // leaves the last one on the page and says so.
    state.error = navigator.onLine === false
      ? 'You are offline. Showing the last reading this device downloaded.'
      : `Could not reach the forecast (${err.message}).`;
  } finally {
    state.loading = false;
    render();
  }
}

// ── drawing ─────────────────────────────────────────────────────────────────

function applyTextSize() {
  document.documentElement.style.setProperty('--text-scale', rootScale(state.text));
  const button = el('text-size');
  button.setAttribute('aria-label', announce(state.text));
  button.title = announce(state.text);
}

function render() {
  const now = new Date();
  el('place-select').innerHTML = view.placeOptions(state.place.id);
  el('place-name').textContent = state.place.name;
  el('place-gov').textContent = state.place.gov || 'Your location';
  el('refresh').classList.toggle('is-spinning', state.loading);
  el('locate').classList.toggle('is-on', Boolean(state.place.fromFix));

  const banner = el('banner');
  if (state.error) {
    banner.hidden = false;
    banner.className = 'banner banner--warn';
    banner.textContent = state.error;
  } else if (state.cached && state.reading) {
    banner.hidden = false;
    banner.className = 'banner';
    banner.textContent = 'Showing the last saved reading while a fresh one loads.';
  } else {
    banner.hidden = true;
  }

  if (!state.reading) {
    el('screen').hidden = true;
    el('first-load').hidden = false;
    return;
  }
  el('first-load').hidden = true;
  el('screen').hidden = false;

  // Every timestamp in the reading is written on the forecast location's own
  // clock, so that clock is installed before a single one is formatted.
  setLocale(state.reading);

  const d = derive(state.reading, { profile: state.profile, now });
  d.units = state.units;
  state.derived = d;

  // The whole page takes its colour from the worst thing standing on it, so
  // the screen says how the day is before a word of it has been read.
  const alerts = advisories(d, { now });
  const tone = toneFor(alerts);
  document.documentElement.style.setProperty('--tone', `var(--${tone})`);

  el('sheet-city').textContent = view.sheetDate(now);
  el('sheet-note').innerHTML = view.sheetNote(d, tone);
  el('reading').innerHTML = view.reading(d, state.units);
  el('curve').innerHTML = view.curve(d, now);
  el('advisories').innerHTML = view.advisoryList(alerts);
  el('work').innerHTML = view.workCard(d, { profile: state.profile, now });
  el('dust').innerHTML = view.dustCard(d);
  el('hours').innerHTML = view.hourStrip(d, state.units, now);
  el('days').innerHTML = view.dayList(d, state.units);
  el('details').innerHTML = view.detailGrid(d, state.units);

  const fetched = new Date(d.fetchedAt);
  const stale = now - fetched > STALE_MS;
  el('updated').textContent = `Updated ${ago(fetched, now)}${stale ? ' — this may be out of date' : ''}`;
  el('updated').classList.toggle('is-stale', stale);
  el('model-time').textContent = d.now.time ? `Forecast hour ${clock(parseLocal(d.now.time))}` : '';
}

// ── events ──────────────────────────────────────────────────────────────────

function choosePlace(id) {
  const next = places.place(id);
  if (!next) return;
  state.place = next;
  state.reading = null;
  state.cached = false;
  store.write(store.KEYS.place, next);
  map?.goTo({ lat: next.lat, lon: next.lon, label: next.name });
  load({ force: true });
}

function fix({ timeout = 10000, maximumAge = 10 * 60 * 1000 } = {}) {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) { reject(new Error('Geolocation unavailable')); return; }
    navigator.geolocation.getCurrentPosition(resolve, reject, { timeout, maximumAge });
  });
}

/**
 * @param {{auto?: boolean}} options `auto` is the on-load path: it never puts
 *        an error on screen, because nobody asked it to do anything.
 */
async function locate({ auto = false } = {}) {
  const button = el('locate');
  button.classList.add('is-spinning');
  try {
    const { coords } = await fix();
    const chosen = placeFromFix(coords);
    store.write(store.KEYS.geo, { declined: false });
    if (chosen.id === state.place.id && state.reading) return; // already where we are
    state.place = chosen;
    state.reading = null;
    state.cached = false;
    store.write(store.KEYS.place, chosen);
    map?.goTo({ lat: chosen.lat, lon: chosen.lon, label: chosen.name });
    await load({ force: true });
  } catch (err) {
    // A refusal is remembered so the next visit does not ask again. A timeout
    // is not a refusal and must not be recorded as one.
    if (isRefusal(err)) store.write(store.KEYS.geo, { declined: true });
    if (!auto) {
      state.error = isRefusal(err)
        ? 'Location permission was declined. Pick a place from the list instead.'
        : 'Could not get a location fix. Pick a place from the list instead.';
      render();
    }
  } finally {
    button.classList.remove('is-spinning');
  }
}

/**
 * The on-load path. It runs after the first paint, so a saved reading is
 * already on screen while this resolves — the app never opens on a blank
 * waiting for a dialog to be answered.
 */
async function maybeAutoLocate() {
  const allowed = shouldAutoLocate({
    permission: await permissionState(),
    chosen: store.read(store.KEYS.place),
    declined: store.read(store.KEYS.geo)?.declined === true,
    supported: Boolean(navigator.geolocation),
  });
  if (allowed) await locate({ auto: true });
}

/* ── the radar map ─────────────────────────────────────────────────────────
 * The map keeps its own state — frames, which one is showing, whether it is
 * playing — and tells the page about it through a `mapstate` event. The page
 * only draws the bar underneath.
 */

let map = null;
let playing = false;

function paintMapBar({ loading, error, frames, index, label, forecast }) {
  const slider = el('map-time');
  const play = el('map-play');
  const when = el('map-when');

  slider.max = String(Math.max(0, frames - 1));
  slider.value = String(index);
  slider.disabled = frames < 2;
  play.disabled = frames < 2;

  when.classList.toggle('map-when--forecast', Boolean(forecast) && !error);
  when.classList.toggle('map-when--error', Boolean(error));
  if (error) when.textContent = error;
  else if (loading) when.textContent = 'Loading radar…';
  else when.textContent = label || 'No radar frames';
}

function setPlaying(on) {
  playing = on;
  map?.play(on);
  const play = el('map-play');
  play.innerHTML = icon(on ? 'pause' : 'play', { size: 20 });
  play.setAttribute('aria-label', on ? 'Pause the radar' : 'Play the last two hours');
}

function startMap() {
  const host = el('map');
  host.addEventListener('mapstate', (e) => paintMapBar(e.detail));
  map = createMap(host, { lat: state.place.lat, lon: state.place.lon, label: state.place.name });

  setPlaying(false);
  el('map-play').addEventListener('click', () => setPlaying(!playing));
  el('map-time').addEventListener('input', (e) => {
    if (playing) setPlaying(false);
    map.step(Number(e.target.value));
  });

  setInterval(() => {
    if (document.visibilityState === 'visible') map.refresh();
  }, RADAR_MS);
}

function bind() {
  el('place-select').addEventListener('change', (e) => choosePlace(e.target.value));
  el('refresh').addEventListener('click', () => { load({ force: true }); map?.refresh(); });
  el('locate').addEventListener('click', () => locate());
  el('text-size').addEventListener('click', () => {
    state.text = nextSize(state.text);
    store.write(store.KEYS.text, state.text);
    applyTextSize();
  });
  el('units').addEventListener('click', () => {
    state.units = state.units === 'C' ? 'F' : 'C';
    store.write(store.KEYS.units, state.units);
    el('units').textContent = `°${state.units}`;
    render();
  });
  document.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-profile]');
    if (!btn) return;
    state.profile = btn.dataset.profile;
    store.write(store.KEYS.work, state.profile);
    render();
  });

  // Coming back to a tab that has been open since this morning should not show
  // this morning's numbers.
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'visible' || !state.reading) return;
    if (new Date() - new Date(state.reading.fetchedAt) > REFRESH_MS) load();
  });
  window.addEventListener('online', () => load());
  setInterval(() => { if (document.visibilityState === 'visible') load(); }, REFRESH_MS);
  setInterval(render, 60 * 1000); // the "updated N min ago" line, and the ban clock
}

export function start() {
  restore();
  el('units').textContent = `°${state.units}`;
  applyTextSize();
  el('locate').innerHTML = icon('pin', { size: 18 });
  el('refresh').innerHTML = icon('refresh', { size: 18 });
  bind();
  startMap();
  render();
  load();
  maybeAutoLocate();

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register('./sw.js').catch(() => { /* offline is a bonus, not a requirement */ });
  }
}

if (typeof document !== 'undefined') start();
