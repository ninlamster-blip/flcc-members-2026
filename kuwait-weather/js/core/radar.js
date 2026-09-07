// Live rain radar.
//
// ── Why this is the one thing that leaves Open-Meteo ────────────────────────
// Everything else in this app is Open-Meteo, which publishes model output on
// an hourly cadence and no radar at all. "Where is the rain right now" cannot
// be answered from it. Radar is a different kind of measurement — an actual
// sweep of the sky, minutes old rather than modelled — and it needs a
// different source.
//
// Kuwait is dry for most of the year, and for most of the year this map will
// be empty. The weeks it is not are the ones worth having it for: a winter
// front coming down the Gulf, or the short violent thunderstorms that arrive
// with a shamal and flood an underpass in twenty minutes.
//
// RainViewer aggregates national radar networks and publishes the tiles
// openly, with no key. Its index lists the frames it currently holds: roughly
// two hours of past sweeps and a short nowcast projected forward.
//
// ── What it does not promise ───────────────────────────────────────────────
// Radar coverage is not global and not uniform. Where no radar in the network
// reaches, frames come back empty — which looks exactly like "no rain". The
// map says which it is rather than letting an empty screen imply a dry sky.

export const INDEX_URL = 'https://api.rainviewer.com/public/weather-maps.json';

// The colour ramp. 4 is the green-yellow-red scheme, chosen over the calmer
// blues because the difference between drizzle and the kind of downpour that
// closes a road has to be visible at a glance.
export const COLOUR_SCHEME = 4;
export const TILE_SIZE = 256;

/**
 * The index response → a flat list of frames, oldest first, each knowing
 * whether it has already happened.
 *
 * @returns {{frames: Array<{time: number, path: string, forecast: boolean}>,
 *            host: string, generated: number}|null}
 */
export function parseIndex(json) {
  if (!json || typeof json.host !== 'string') return null;
  const past = Array.isArray(json.radar?.past) ? json.radar.past : [];
  const nowcast = Array.isArray(json.radar?.nowcast) ? json.radar.nowcast : [];

  const frames = [
    ...past.map((f) => ({ ...f, forecast: false })),
    ...nowcast.map((f) => ({ ...f, forecast: true })),
  ]
    .filter((f) => Number.isFinite(f.time) && typeof f.path === 'string')
    .sort((a, b) => a.time - b.time)
    .map((f) => ({ time: f.time, path: f.path, forecast: f.forecast }));

  if (!frames.length) return null;
  return { frames, host: json.host, generated: Number(json.generated) || frames[frames.length - 1].time };
}

/** The index of the most recent frame that has actually been observed. */
export function latestObserved(frames) {
  for (let i = frames.length - 1; i >= 0; i--) if (!frames[i].forecast) return i;
  return Math.max(0, frames.length - 1);
}

/**
 * One radar tile.
 * @param {string} host from the index — never hardcoded, it moves
 * @param {string} path the frame's own path
 */
export function tileUrl(host, path, { z, x, y }, { size = TILE_SIZE, colour = COLOUR_SCHEME } = {}) {
  // `1_1` is smoothed, with snow drawn separately from rain.
  return `${host}${path}/${size}/${z}/${x}/${y}/${colour}/1_1.png`;
}

/** How old a frame is, in minutes, and whether that is old enough to say so. */
export function frameAge(frame, now = new Date()) {
  if (!frame) return null;
  const minutes = Math.round((now.getTime() / 1000 - frame.time) / 60);
  return { minutes, stale: minutes > 30, forecast: Boolean(frame.forecast) };
}

/** What to write under the map for a given frame. */
export function frameLabel(frame, now = new Date()) {
  const age = frameAge(frame, now);
  if (!age) return '—';
  if (age.forecast) {
    const ahead = Math.max(0, -age.minutes);
    return ahead <= 1 ? 'Nowcast' : `Nowcast, ${ahead} min ahead`;
  }
  if (age.minutes <= 1) return 'Just now';
  return `${age.minutes} min ago`;
}

export async function load(signal) {
  const res = await fetch(INDEX_URL, { signal });
  if (!res.ok) throw new Error(`RainViewer returned HTTP ${res.status}`);
  return parseIndex(await res.json());
}
