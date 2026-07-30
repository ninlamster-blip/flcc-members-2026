/**
 * Formatting — dates, money, numbers.
 *
 * Kuwait is the first market, so the defaults are Kuwait's: KWD with its three
 * decimal places (fils), and the Asia/Kuwait time zone. Both are per-tenant
 * settings, because the platform is meant to travel across the GCC.
 */

/** @type {{ locale: string, currency: string, timeZone: string }} */
const defaults = { locale: 'en-GB', currency: 'KWD', timeZone: 'Asia/Kuwait' };

/** Applied once at boot from the tenant's settings. */
export function configureFormat(partial) {
  Object.assign(defaults, partial || {});
}

export function formatMoney(amount, opts = {}) {
  const value = Number(amount) || 0;
  const currency = opts.currency || defaults.currency;
  try {
    return new Intl.NumberFormat(defaults.locale, {
      style: 'currency',
      currency,
      minimumFractionDigits: currency === 'KWD' || currency === 'BHD' || currency === 'OMR' ? 3 : 2,
    }).format(value);
  } catch {
    return `${currency} ${value.toFixed(3)}`;
  }
}

export function formatNumber(value, opts = {}) {
  return new Intl.NumberFormat(defaults.locale, opts).format(Number(value) || 0);
}

/**
 * Parse anything date-shaped into a Date.
 *
 * Always returns a NEW Date, including when handed one. Callers pass a shared
 * `now` through insight calculations, and helpers below use `setDate`/
 * `setHours`; returning the caller's own instance would let one calculation
 * silently move another's clock.
 *
 * @param {string|number|Date} value
 */
export function toDate(value) {
  if (value instanceof Date) return new Date(value.getTime());
  if (typeof value === 'number') return new Date(value);
  const str = String(value || '');
  // A bare date is read as local midnight, not UTC — "12 Feb" must not become
  // "11 Feb" for a user east of Greenwich.
  if (/^\d{4}-\d{2}-\d{2}$/.test(str)) {
    const [y, m, d] = str.split('-').map(Number);
    return new Date(y, m - 1, d);
  }
  return new Date(str);
}

export function formatDate(value, opts) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(defaults.locale, {
    day: 'numeric', month: 'short', year: 'numeric', ...opts,
  }).format(date);
}

/**
 * Exactly the parts asked for — `formatDate` merges its defaults in, which is
 * right for prose but wrong for a calendar tile that wants only "Aug".
 */
export function formatDateParts(value, opts) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(defaults.locale, opts).format(date);
}

export function formatTime(value) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return new Intl.DateTimeFormat(defaults.locale, { hour: 'numeric', minute: '2-digit' }).format(date);
}

export function formatDateTime(value) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  return `${formatDate(date)} · ${formatTime(date)}`;
}

/** "in 3 days" / "2 hours ago" — the phrasing used across dashboards. */
export function relativeTime(value, now = Date.now()) {
  const date = toDate(value);
  if (Number.isNaN(date.getTime())) return '—';
  const diff = date.getTime() - now;
  const abs = Math.abs(diff);
  const units = /** @type {const} */ ([
    ['year', 31536e6], ['month', 2592e6], ['week', 6048e5],
    ['day', 864e5], ['hour', 36e5], ['minute', 6e4],
  ]);
  const rtf = new Intl.RelativeTimeFormat(defaults.locale, { numeric: 'auto' });
  for (const [unit, ms] of units) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return rtf.format(Math.round(diff / 1000), 'second');
}

/** ISO `YYYY-MM-DD` in local time — the storage format for plain dates. */
export function isoDate(value = new Date()) {
  const date = toDate(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function addDays(value, days) {
  const date = toDate(value);
  date.setDate(date.getDate() + days);
  return date;
}

export function daysBetween(a, b) {
  return Math.round((toDate(b).setHours(12, 0, 0, 0) - toDate(a).setHours(12, 0, 0, 0)) / 864e5);
}

/**
 * Days until the next occurrence of a month/day (birthdays, anniversaries).
 * Returns 0 when it is today.
 */
export function daysUntilAnnual(dateValue, from = new Date()) {
  const date = toDate(dateValue);
  if (Number.isNaN(date.getTime())) return Infinity;
  const start = new Date(from.getFullYear(), from.getMonth(), from.getDate());
  let next = new Date(start.getFullYear(), date.getMonth(), date.getDate());
  if (next < start) next = new Date(start.getFullYear() + 1, date.getMonth(), date.getDate());
  return Math.round((next.getTime() - start.getTime()) / 864e5);
}

export function pluralize(count, singular, plural = `${singular}s`) {
  return `${formatNumber(count)} ${Math.abs(count) === 1 ? singular : plural}`;
}

/** Truncate on a word boundary for card previews. */
export function truncate(text, max = 120) {
  const str = String(text || '').trim();
  if (str.length <= max) return str;
  return `${str.slice(0, str.lastIndexOf(' ', max) || max).trim()}…`;
}

export const formatDefaults = defaults;
