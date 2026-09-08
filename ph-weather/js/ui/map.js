// The map: a few hundred absolutely positioned images and the four equations
// in `tiles.js`. No mapping library, because this app has no build step and
// no dependencies, and a slippy map does not actually need one.
//
// Two tile layers. Underneath, a plain base map. Over it, the radar frame —
// which is the point; the base map exists only so the rain has somewhere to
// be. Coastline and a few place names are the whole job.

import { viewport, pointIn, panBy, TILE_SIZE } from './tiles.js';
import { icon } from './icons.js';
import * as radar from '../core/radar.js';

// OpenStreetMap's own tiles.
//
// The first version of this used CARTO, whose basemaps have a light and a dark
// style and would have matched the app's two themes. They came back reading
// "API key required" — CARTO gates anonymous use, and a static page cannot
// hold a key. OSM's standard tiles need none, which is worth more here than
// matching the dark theme: **a base map behind a rain radar has one job, and
// it has to keep doing it without an account.**
//
// So the map stays light in both themes. OSM publishes no dark style, and
// inverting these tiles in CSS makes a muddy, misread map rather than a dark
// one. Attribution is required and is drawn on the map, not hidden in a
// footer.
const BASE_HOST = 'https://tile.openstreetmap.org';

const MIN_ZOOM = 4;
const MAX_ZOOM = 10;
const FRAME_MS = 500;

// No query string: nothing to put a key in, and nothing to get gated on.
const baseUrl = ({ z, x, y }) => `${BASE_HOST}/${z}/${x}/${y}.png`;

const el = (tag, className) => {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
};

export function createMap(host, { lat, lon, zoom = 7, label = '' } = {}) {
  // Two coordinates, not one. `centre` is where the map is looking, and moves
  // when the map is dragged; `place` is the town this app is about, and does
  // not. Holding them in a single pair means the marker rides along with the
  // drag and sits in the middle of the screen forever, saying nothing.
  const state = {
    centre: { lat, lon },
    place: { lat, lon, label },
    zoom,
    frames: [], radarHost: '', index: 0, playing: false,
    error: null, loading: true,
  };

  host.innerHTML = '';
  host.classList.add('map');
  const base = el('div', 'map-layer map-base');
  const rain = el('div', 'map-layer map-rain');
  const pin = el('div', 'map-pin');
  const controls = el('div', 'map-controls');
  const zoomIn = el('button', 'map-btn'); zoomIn.type = 'button'; zoomIn.textContent = '+'; zoomIn.setAttribute('aria-label', 'Zoom in');
  const zoomOut = el('button', 'map-btn'); zoomOut.type = 'button'; zoomOut.textContent = '−'; zoomOut.setAttribute('aria-label', 'Zoom out');
  const home = el('button', 'map-btn map-btn--home'); home.type = 'button';
  home.innerHTML = icon('pin', { size: 20 });
  home.setAttribute('aria-label', 'Back to this place');
  controls.append(zoomIn, zoomOut, home);
  const attrib = el('p', 'map-attrib');
  attrib.innerHTML = 'Radar <a href="https://www.rainviewer.com/" rel="noopener">RainViewer</a> · '
    + '© <a href="https://www.openstreetmap.org/copyright" rel="noopener">OpenStreetMap</a> contributors';
  host.append(base, rain, pin, controls, attrib);

  function size() {
    return { width: host.clientWidth || 320, height: host.clientHeight || 260 };
  }

  // Tiles are reused between renders rather than rebuilt, so panning does not
  // make the browser re-fetch every image it already has.
  function paint(layer, urlFor) {
    const { width, height } = size();
    const view = viewport({ ...state.centre, zoom: state.zoom, width, height });
    const seen = new Set();
    for (const tile of view.tiles) {
      const id = `${tile.key}|${layer.dataset.stamp || ''}`;
      seen.add(id);
      let img = layer.querySelector(`[data-id="${CSS.escape(id)}"]`);
      if (!img) {
        img = el('img', 'map-tile');
        img.dataset.id = id;
        img.alt = '';
        img.loading = 'eager';
        // Without this the browser starts its own image drag on the first
        // pointermove, which cancels the pointer stream and leaves the map
        // stuck one frame into every pan.
        img.draggable = false;
        img.decoding = 'async';
        img.src = urlFor(tile);
        img.addEventListener('error', () => { img.style.visibility = 'hidden'; });
        layer.append(img);
      }
      img.style.left = `${tile.left}px`;
      img.style.top = `${tile.top}px`;
    }
    for (const img of [...layer.children]) {
      if (!seen.has(img.dataset.id)) img.remove();
    }
    return view;
  }

  function render() {
    const view = paint(base, baseUrl);

    const frame = state.frames[state.index];
    rain.dataset.stamp = frame ? String(frame.time) : '';
    if (frame) paint(rain, (t) => radar.tileUrl(state.radarHost, frame.path, t));
    else rain.innerHTML = '';

    const at = pointIn(state.place, { ...view, zoom: state.zoom, tileSize: TILE_SIZE });
    pin.style.left = `${at.left}px`;
    pin.style.top = `${at.top}px`;
    pin.title = state.place.label;

    zoomIn.disabled = state.zoom >= MAX_ZOOM;
    zoomOut.disabled = state.zoom <= MIN_ZOOM;
    home.disabled = centred();
    host.dispatchEvent(new CustomEvent('mapstate', { detail: status() }));
  }

  // Close enough that moving the map back would not visibly change it.
  function centred() {
    return Math.abs(state.centre.lat - state.place.lat) < 1e-4
      && Math.abs(state.centre.lon - state.place.lon) < 1e-4;
  }

  function status() {
    const frame = state.frames[state.index];
    return {
      loading: state.loading,
      error: state.error,
      frames: state.frames.length,
      centred: centred(),
      index: state.index,
      frame,
      label: frame ? radar.frameLabel(frame) : null,
      forecast: Boolean(frame?.forecast),
    };
  }

  // ── interaction ───────────────────────────────────────────────────────────

  let dragging = null;
  host.addEventListener('pointerdown', (e) => {
    if (e.target.closest('.map-controls') || e.target.closest('a')) return;
    e.preventDefault();
    dragging = { x: e.clientX, y: e.clientY };
    host.setPointerCapture(e.pointerId);
    host.classList.add('is-dragging');
  });
  host.addEventListener('pointermove', (e) => {
    if (!dragging) return;
    const dx = e.clientX - dragging.x;
    const dy = e.clientY - dragging.y;
    dragging = { x: e.clientX, y: e.clientY };
    state.centre = panBy({ ...state.centre, zoom: state.zoom }, dx, dy);
    render();
  });
  const endDrag = (e) => {
    if (!dragging) return;
    dragging = null;
    host.classList.remove('is-dragging');
    if (e.pointerId != null && host.hasPointerCapture?.(e.pointerId)) host.releasePointerCapture(e.pointerId);
  };
  host.addEventListener('pointerup', endDrag);
  host.addEventListener('pointercancel', endDrag);

  const setZoom = (next) => {
    state.zoom = Math.max(MIN_ZOOM, Math.min(MAX_ZOOM, next));
    base.innerHTML = '';
    rain.innerHTML = '';
    render();
  };
  zoomIn.addEventListener('click', () => setZoom(state.zoom + 1));
  zoomOut.addEventListener('click', () => setZoom(state.zoom - 1));
  home.addEventListener('click', () => { state.centre = { ...state.place }; render(); });

  let timer = null;
  function play(on) {
    state.playing = on;
    clearInterval(timer);
    if (!on) return;
    timer = setInterval(() => {
      state.index = (state.index + 1) % Math.max(1, state.frames.length);
      render();
    }, FRAME_MS);
  }

  // ── the radar itself ──────────────────────────────────────────────────────

  async function loadRadar() {
    state.loading = true;
    render();
    try {
      const index = await radar.load();
      if (!index) throw new Error('no frames published');
      state.frames = index.frames;
      state.radarHost = index.host;
      state.index = radar.latestObserved(index.frames);
      state.error = null;
    } catch (err) {
      state.frames = [];
      state.error = 'Radar is unavailable right now.';
    } finally {
      state.loading = false;
      render();
    }
  }

  render();
  loadRadar();

  return {
    status,
    render,
    play,
    step(to) { state.index = Math.max(0, Math.min(state.frames.length - 1, to)); render(); },
    goTo({ lat: nextLat, lon: nextLon, label: nextLabel }) {
      state.place = { lat: nextLat, lon: nextLon, label: nextLabel ?? state.place.label };
      state.centre = { lat: nextLat, lon: nextLon };
      render();
    },
    refresh: loadRadar,
    destroy() {
      clearInterval(timer);
      host.innerHTML = '';
    },
  };
}

export { MIN_ZOOM, MAX_ZOOM };
