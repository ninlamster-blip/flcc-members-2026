// Which day's content is today's.
//
// Chosen from the date, so every child in the ministry opens the same word on
// the same morning, and so the choice is reproducible with no network.

export function dayNumber(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((now - start) / 86400000);
}

export function pickFor(pool, date = new Date(), offset = 0) {
  const list = Array.isArray(pool) ? pool : [];
  if (!list.length) return null;
  return list[(dayNumber(date) + offset + date.getFullYear()) % list.length];
}
