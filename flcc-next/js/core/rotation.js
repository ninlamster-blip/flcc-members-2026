// What today's content is.
//
// The problem this solves: a child who opens FLCC NEXT every morning should
// meet something they have not met before, for as long as the authored content
// can possibly hold out. A plain shuffle cannot do that — it re-rolls each
// time, so day two repeats day one and nothing guarantees the whole bank is
// ever seen.
//
// So the app deals rather than shuffles. A bank is permuted once per *cycle*
// and handed out in slices, one slice per day. Inside a cycle nothing repeats
// and everything is eventually dealt; when the bank runs out the cycle number
// changes, the permutation changes with it, and the order is different next
// time round.
//
// It is a pure function of the day, which buys two more things: everyone in
// the ministry gets the same puzzle on the same morning, and a child cannot
// re-roll a hard question by closing the app and opening it again.

/** Days since the Unix epoch, in the reader's own timezone. */
export function dayIndex(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

/** A seeded permutation. Same seed, same order, every device, every time. */
export function permute(list, seed) {
  const out = [...list];
  let value = (Math.abs(Math.trunc(seed)) % 2147483647) + 1;
  const next = () => (value = (value * 48271) % 2147483647) / 2147483647;
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(next() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Deal today's slice out of a bank.
 *
 * @param {Array} bank      everything eligible — filter by age group first, so
 *                          each mode cycles through its own material.
 * @param {object} options
 * @param {Date}   options.date    which day to deal for
 * @param {number} options.count   how many items today needs
 * @param {number} options.offset  shifts one bank against another, so the
 *                                 quiz and the verse game do not move in step
 * @returns {Array} `count` items (or the whole bank, if it is smaller)
 */
export function deal(bank, { date = new Date(), count = 1, offset = 0 } = {}) {
  const list = Array.isArray(bank) ? bank : [];
  if (!list.length) return [];
  const size = Math.min(Math.max(1, Math.trunc(count)), list.length);
  const slots = Math.floor(list.length / size);          // days a cycle lasts
  const index = dayIndex(date) + offset;
  const cycle = Math.floor(index / slots);
  const slot = ((index % slots) + slots) % slots;
  return permute(list, cycle + 1).slice(slot * size, slot * size + size);
}

/** Deal exactly one item — today's word, today's puzzle, today's game. */
export function pick(bank, options = {}) {
  return deal(bank, { ...options, count: 1 })[0] ?? null;
}

/**
 * How long this bank lasts before anything comes round again, and where today
 * sits in that run. Shown in the app and in the ministry dashboard, so "it is
 * getting repetitive" is a number somebody can act on rather than a feeling.
 */
export function cycleOf(bank, { count = 1, date = new Date(), offset = 0 } = {}) {
  const total = Array.isArray(bank) ? bank.length : 0;
  if (!total) return { total, perDay: 0, days: 0, day: 0 };
  const size = Math.min(Math.max(1, Math.trunc(count)), total);
  const days = Math.floor(total / size);
  const index = dayIndex(date) + offset;
  return { total, perDay: size, days, day: (((index % days) + days) % days) + 1 };
}
