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

/**
 * Scatter a counter into a seed.
 *
 * Every seed in this file is a counter — cycle 7, cycle 8; today, tomorrow —
 * and a Lehmer generator started on n and on n+1 runs almost in step: its first
 * outputs differ by about two parts in a hundred thousand, which is far too
 * little to change where a shuffle puts anything. Left alone, that means cycle
 * 8 deals a bank in nearly the order cycle 7 did, and today's questions are
 * arranged almost exactly like yesterday's. One xorshift round first makes
 * neighbouring counters unrelated, which is the whole point of reseeding.
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

/**
 * Which order a question's answers are offered in today.
 *
 * Every question in this app is authored with the right answer written first —
 * it is the only way a reviewer can check a bank of two hundred questions in a
 * diff. Rendered in that order, the game teaches "always pick the top one",
 * which a nine-year-old works out somewhere around the fourth question.
 *
 * So the options are permuted before they are shown, on the same terms as
 * everything else here: a pure function of the day and the question. The whole
 * ministry sees the same arrangement on the same morning, and closing the app
 * to re-roll a hard question gets you the same question back.
 */
export function askOrder(options, answer, key, date = new Date()) {
  const list = Array.isArray(options) ? options : [];
  if (list.length < 2) return { options: list, answer };
  const order = permute(list.map((_, i) => i), hash(String(key ?? '') + list.join('')) + dayIndex(date));
  return { options: order.map((i) => list[i]), answer: order.indexOf(answer) };
}

/** FNV-1a. Small, stable, and the same number in every browser. */
export function hash(text) {
  let value = 2166136261;
  for (let i = 0; i < text.length; i++) {
    value ^= text.charCodeAt(i);
    value = Math.imul(value, 16777619);
  }
  return Math.abs(value | 0);
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
