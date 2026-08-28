// Today's Word and Today's Challenge.
//
// Both are chosen deterministically from the day, so every child in a church
// sees the same thing on the same day, the choice is reproducible offline, and
// nothing has to be fetched to know what today is.

export function dayNumber(date = new Date()) {
  const start = Date.UTC(date.getFullYear(), 0, 0);
  const now = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.floor((now - start) / 86400000); // 1..366
}

/** A stable index into a pool for a given day. */
export function pickIndex(poolSize, date = new Date(), offset = 0) {
  if (!poolSize) return -1;
  const year = date.getFullYear();
  // Rotate the starting point each year so a pool shorter than a year does not
  // repeat on exactly the same dates every time.
  return (dayNumber(date) + offset + year) % poolSize;
}

export function pickFor(pool, date = new Date(), offset = 0) {
  const list = Array.isArray(pool) ? pool : [];
  const index = pickIndex(list.length, date, offset);
  return index === -1 ? null : list[index];
}
