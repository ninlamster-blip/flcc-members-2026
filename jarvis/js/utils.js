// Shared helpers for JARVIS. Deliberately standalone — no imports from
// ../ofw-companion or any other app, so this folder can be lifted out on
// its own the same way ofw-companion and daily-blessing are.

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function nowIso() {
  return new Date().toISOString();
}

// Whole days between a YYYY-MM-DD date key and another (default: today).
export function daysBetween(dateKey, otherKey = todayKey()) {
  if (!dateKey) return null;
  return Math.round((new Date(otherKey) - new Date(dateKey)) / 86400000);
}

export function uid() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

export function hourOfDay(d = new Date()) {
  return d.getHours();
}

// Coarse part-of-day label, used by Observe/Plan instead of raw hours —
// most rules care about "is this evening", not "is it 20:00 vs 21:00".
export function partOfDay(d = new Date()) {
  const h = hourOfDay(d);
  if (h < 5) return 'late-night';
  if (h < 12) return 'morning';
  if (h < 17) return 'afternoon';
  if (h < 21) return 'evening';
  return 'late-night';
}
