// Date, calendar, and math helpers shared across the Daily Blessing module.

export function todayKey(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function daysBetween(aKey, bKey) {
  const a = new Date(`${aKey}T00:00:00`);
  const b = new Date(`${bKey}T00:00:00`);
  return Math.round((b - a) / 86400000);
}

export function isFriday(d = new Date()) {
  return d.getDay() === 5;
}

// Anonymous Gregorian algorithm for the date of Easter Sunday.
export function computeEaster(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function seasonFor(d = new Date()) {
  const year = d.getFullYear();
  const easter = computeEaster(year);
  const easterKey = todayKey(easter);
  const key = todayKey(d);
  const holyWeekStart = new Date(easter);
  holyWeekStart.setDate(easter.getDate() - 6);

  if (key === easterKey) return { id: 'resurrection', label: 'Resurrection Sunday' };
  if (d >= holyWeekStart && d < easter) return { id: 'holyWeek', label: 'Holy Week' };
  if (d.getMonth() === 11 && d.getDate() >= 1 && d.getDate() <= 26) return { id: 'christmas', label: 'Christmas Season' };
  return { id: 'standard', label: '' };
}

// Simple mulberry32 PRNG for deterministic, per-day "seeded" randomness.
export function mulberry32(seed) {
  let a = seed;
  return function () {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashString(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = (Math.imul(31, h) + str.charCodeAt(i)) | 0;
  }
  return h;
}

export function seededRandom(seedStr) {
  return mulberry32(hashString(seedStr));
}

export function weightedPick(rng, entries) {
  // entries: [{ value, weight }]
  const total = entries.reduce((s, e) => s + e.weight, 0);
  let roll = rng() * total;
  for (const e of entries) {
    if (roll < e.weight) return e.value;
    roll -= e.weight;
  }
  return entries[entries.length - 1].value;
}

export function shuffle(array, rng = Math.random) {
  const a = array.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

const XP_BASE = 50;
export function levelForXp(xp) {
  let level = 1;
  while (xp >= xpForLevel(level + 1)) level++;
  return level;
}
export function xpForLevel(level) {
  return Math.round(XP_BASE * Math.pow(level - 1, 1.5));
}
export function xpProgress(xp) {
  const level = levelForXp(xp);
  const floor = xpForLevel(level);
  const ceil = xpForLevel(level + 1);
  return { level, floor, ceil, pct: Math.min(1, (xp - floor) / (ceil - floor)) };
}

export function formatNumber(n) {
  return n.toLocaleString('en-US');
}

export const STREAK_MILESTONES = [7, 14, 30, 50, 100, 365];

export function prefersReducedMotion() {
  return window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}
