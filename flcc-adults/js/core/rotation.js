// What today's Scripture moment is.
//
// The app deals rather than shuffles. A bank is permuted once per *cycle* and
// handed out in slices, one slice per day: inside a cycle nothing repeats and
// everything is eventually seen, and when the bank runs out the cycle number
// changes, the permutation changes with it, and the order is different next
// time round.
//
// It is a pure function of the day, which buys two things worth having. The
// whole church meets the same verse on the same morning — so it can be
// preached to, texted about, and prayed over together. And nobody can re-roll
// a passage they would rather not sit with by closing the app and opening it
// again.

/** Days since the Unix epoch, in the reader's own timezone. */
export function dayIndex(date = new Date()) {
  return Math.floor(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()) / 86400000);
}

/**
 * Scatter a counter into a seed.
 *
 * Every seed here is a counter — cycle 7, cycle 8; today, tomorrow — and a
 * Lehmer generator started on n and on n+1 runs almost in step, far too close
 * to change where a shuffle puts anything. One xorshift round first makes
 * neighbouring counters unrelated, which is the entire point of reseeding.
 */
function scatter(seed) {
  let value = (Math.abs(Math.trunc(seed)) % 2147483646) + 1;
  value ^= value << 13; value >>>= 0;
  value ^= value >>> 17;
  value ^= value << 5;  value >>>= 0;
  return (value % 2147483646) + 1;
}

/** A seeded permutation. Same seed, same order, every device, every time. */
export function permute(list, seed) {
  const out = [...list];
  let value = scatter(seed);
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
 * @param {Array} bank
 * @param {object} options
 * @param {Date}   options.date   which day to deal for
 * @param {number} options.count  how many items today needs
 * @param {number} options.offset shifts one bank against another, so the
 *                                Scripture moment and the prayer guide do not
 *                                move in step
 */
export function deal(bank, { date = new Date(), count = 1, offset = 0 } = {}) {
  const list = Array.isArray(bank) ? bank : [];
  if (!list.length) return [];
  const size = Math.min(Math.max(1, Math.trunc(count)), list.length);
  const slots = Math.floor(list.length / size);
  const index = dayIndex(date) + offset;
  const cycle = Math.floor(index / slots);
  const slot = ((index % slots) + slots) % slots;
  return permute(list, cycle + 1).slice(slot * size, slot * size + size);
}

/** Deal exactly one item — today's verse, today's guide. */
export function pick(bank, options = {}) {
  return deal(bank, { ...options, count: 1 })[0] ?? null;
}

/**
 * How long a bank lasts before anything comes round again, and where today
 * sits in that run. Shown in You, so "it is getting repetitive" is a number
 * somebody can act on rather than a feeling.
 */
export function cycleOf(bank, { count = 1, date = new Date(), offset = 0 } = {}) {
  const total = Array.isArray(bank) ? bank.length : 0;
  if (!total) return { total, perDay: 0, days: 0, day: 0 };
  const size = Math.min(Math.max(1, Math.trunc(count)), total);
  const days = Math.floor(total / size);
  const index = dayIndex(date) + offset;
  return { total, perDay: size, days, day: (((index % days) + days) % days) + 1 };
}

/** FNV-1a. Small, stable, and the same number in every browser. */
export function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < String(text).length; i++) {
    value ^= String(text).charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value | 0);
}
