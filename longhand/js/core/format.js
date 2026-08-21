/** Dates, clocks and durations. Every screen agrees on these. */

/** `00:14` under an hour, `1:02:14` over it — the shape a transcript needs. */
export function clock(seconds) {
  const s = Math.max(0, Math.floor(Number(seconds) || 0));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

/** `42 min`, `1 h 12 min` — for lists, where precision to the second is noise. */
export function duration(seconds) {
  const s = Math.max(0, Math.round(Number(seconds) || 0));
  if (s < 60) return `${s} sec`;
  const mins = Math.round(s / 60);
  if (mins < 60) return `${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `${h} h ${m} min` : `${h} h`;
}

export function isoDate(date = new Date()) {
  const d = date instanceof Date ? date : new Date(date);
  return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 10);
}

const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December'];

/** `August 21, 2026` */
export function longDate(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return `${MONTHS[d.getMonth()]} ${d.getDate()}, ${d.getFullYear()}`;
}

/** `Aug 19` — same year — or `Aug 19, 2025`. */
export function shortDate(value, now = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const month = MONTHS[d.getMonth()].slice(0, 3);
  return d.getFullYear() === now.getFullYear()
    ? `${month} ${d.getDate()}`
    : `${month} ${d.getDate()}, ${d.getFullYear()}`;
}

/** `Today`, `Yesterday`, then a short date. Lists read better this way. */
export function dayLabel(value, now = new Date()) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((startOfDay(now) - startOfDay(d)) / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days > 1 && days < 7) return d.toLocaleDateString(undefined, { weekday: 'long' });
  return shortDate(d, now);
}

export function timeOfDay(value) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

function startOfDay(value) {
  const d = new Date(value);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
}

/** Morning / afternoon / evening, by the clock and nothing else. */
export function greeting(now = new Date()) {
  const hour = now.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}

/** `Due Friday` / `Due Aug 29` / `Overdue` — how a task states its deadline. */
export function dueLabel(dueDate, now = new Date()) {
  if (!dueDate) return '';
  const d = new Date(dueDate);
  if (Number.isNaN(d.getTime())) return '';
  const days = Math.round((startOfDay(d) - startOfDay(now)) / 86400000);
  if (days < 0) return 'Overdue';
  if (days === 0) return 'Due today';
  if (days === 1) return 'Due tomorrow';
  if (days < 7) return `Due ${d.toLocaleDateString(undefined, { weekday: 'long' })}`;
  return `Due ${shortDate(d, now)}`;
}

export function bytes(n) {
  const size = Number(n) || 0;
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024) return `${(size / 1024).toFixed(0)} KB`;
  return `${(size / 1024 / 1024).toFixed(1)} MB`;
}

/** Initials for the People index — two letters, never more. */
export function initials(name) {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return '?';
  return (parts[0][0] + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase();
}
