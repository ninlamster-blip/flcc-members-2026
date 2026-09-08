// Numbers and times, formatted once so every screen agrees.
//
// The clock belongs to the place being looked at, not to this app. It used to
// be a hardcoded `Asia/Kuwait`, which was fine while every place in the list
// was in Kuwait and wrong the moment somebody abroad used their own location:
// the forecast was correct and every hour on the page was labelled on Kuwait's
// clock. Opened from Manila, five o'clock read as noon.
//
// So the zone and offset come from the forecast response — Open-Meteo is asked
// for `timezone=auto` and answers with the location's own — and `setLocale()`
// installs them before anything is drawn.

export const DEFAULT_ZONE = 'Asia/Kuwait';
export const DEFAULT_OFFSET_SECONDS = 3 * 3600;

let zone = DEFAULT_ZONE;
let offsetSeconds = DEFAULT_OFFSET_SECONDS;
const formatters = new Map();

/**
 * @param {{timeZone?: string, utcOffsetSeconds?: number}} locale from a reading
 * @returns {{timeZone: string, utcOffsetSeconds: number}} what was actually set
 */
export function setLocale({ timeZone: tz, utcOffsetSeconds: offset } = {}) {
  let next = DEFAULT_ZONE;
  if (typeof tz === 'string' && tz) {
    // An unknown zone name makes Intl throw, which would take the whole render
    // with it. Falling back to Kuwait is wrong by a few hours; a blank screen
    // is wrong by all of them.
    try { new Intl.DateTimeFormat('en-GB', { timeZone: tz }); next = tz; } catch { /* keep default */ }
  }
  zone = next;
  offsetSeconds = Number.isFinite(offset) ? offset : DEFAULT_OFFSET_SECONDS;
  formatters.clear();
  return { timeZone: zone, utcOffsetSeconds: offsetSeconds };
}

export const timeZone = () => zone;
export const utcOffsetSeconds = () => offsetSeconds;

function formatter(key, options) {
  const id = `${zone}|${key}`;
  if (!formatters.has(id)) {
    formatters.set(id, new Intl.DateTimeFormat('en-GB', { timeZone: zone, ...options }));
  }
  return formatters.get(id);
}

export const UNITS = ['C', 'F'];
export const DEFAULT_UNITS = 'C';

export function toDisplayTemp(celsius, units = DEFAULT_UNITS) {
  if (celsius == null || !Number.isFinite(celsius)) return null;
  return units === 'F' ? (celsius * 9) / 5 + 32 : celsius;
}

/** A temperature for a headline: rounded, with its degree sign. */
export function temp(celsius, units = DEFAULT_UNITS, { sign = true } = {}) {
  const value = toDisplayTemp(celsius, units);
  if (value == null) return '—';
  return `${Math.round(value)}${sign ? `°${units}` : '°'}`;
}

export function num(value, digits = 0, suffix = '') {
  if (value == null || !Number.isFinite(value)) return '—';
  return `${value.toFixed(digits)}${suffix}`;
}

/** Metres of visibility, said the way people say it. */
export function visibility(metres) {
  if (metres == null || !Number.isFinite(metres)) return '—';
  if (metres >= 10000) return '10+ km';
  if (metres >= 1000) return `${(metres / 1000).toFixed(1)} km`;
  return `${Math.round(metres / 100) * 100} m`;
}

export function minutes(total) {
  if (total == null || !Number.isFinite(total)) return '—';
  const h = Math.floor(total / 60);
  const m = Math.round(total % 60);
  if (h && m) return `${h} h ${m} min`;
  if (h) return `${h} h`;
  return `${m} min`;
}

export const hourLabel = (d) => formatter('hour', { hour: 'numeric', hour12: true })
  .format(d).replace(' ', '').toLowerCase();
export const clock = (d) => formatter('clock', { hour: '2-digit', minute: '2-digit', hour12: false }).format(d);
export const weekday = (d) => formatter('weekday', { weekday: 'short' }).format(d);
export const dayAndMonth = (d) => formatter('date', { day: 'numeric', month: 'short' }).format(d);
/** "Wednesday 15 July" — the card's own heading, and the only date in the app. */
export const longDate = (d) => formatter('long', { weekday: 'long', day: 'numeric', month: 'long' }).format(d);

/** "Updated 3 min ago" — the only relative time this app needs. */
export function ago(then, now = new Date()) {
  const mins = Math.round((now - then) / 60000);
  if (!Number.isFinite(mins) || mins < 0) return 'just now';
  if (mins < 1) return 'just now';
  if (mins === 1) return '1 min ago';
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  return hrs === 1 ? '1 hour ago' : `${hrs} hours ago`;
}

/**
 * The forecast returns local wall-clock strings without a zone
 * ("2026-07-15T14:00") because it was asked for the location's own time.
 * Reading them as UTC would shift every hour on the page by the offset, so
 * the offset the response reported is subtracted back out.
 */
export function parseLocal(stamp, offset = offsetSeconds) {
  if (typeof stamp !== 'string') return null;
  const m = stamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  return new Date(Date.UTC(y, mo - 1, d, h, mi) - offset * 1000);
}
