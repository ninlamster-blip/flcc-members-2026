// Numbers and times, formatted once so every screen agrees.

import { TIME_ZONE } from './workban.js';

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

const HOUR = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: 'numeric', hour12: true });
const CLOCK = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, hour: '2-digit', minute: '2-digit', hour12: false });
const WEEKDAY = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, weekday: 'short' });
const DATE = new Intl.DateTimeFormat('en-GB', { timeZone: TIME_ZONE, day: 'numeric', month: 'short' });

export const hourLabel = (d) => HOUR.format(d).replace(' ', '').toLowerCase();
export const clock = (d) => CLOCK.format(d);
export const weekday = (d) => WEEKDAY.format(d);
export const dayAndMonth = (d) => DATE.format(d);

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
 * The forecast returns local wall-clock strings without a zone ("2026-07-15T14:00")
 * because it was asked for Kuwait time. Parsing them as UTC and formatting them
 * back through Asia/Kuwait would shift them three hours, so they are read as
 * the Kuwait instants they already are.
 */
export function parseLocal(stamp) {
  if (typeof stamp !== 'string') return null;
  const m = stamp.match(/^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/);
  if (!m) return null;
  const [, y, mo, d, h, mi] = m.map(Number);
  // Kuwait is UTC+3 year-round, with no daylight saving to track.
  return new Date(Date.UTC(y, mo - 1, d, h - 3, mi));
}
