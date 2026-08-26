// Age is a dimension of the architecture, not a stylesheet (SPEC.md §2).
// One band token decides content, copy register, type scale and AI depth.

export const BANDS = ['7-10', '11-14', '15-18'];

export const BAND_LABEL = {
  '7-10':  'Discover',
  '11-14': 'Explore',
  '15-18': 'Own your faith',
};

export const MIN_AGE = 7;
export const MAX_AGE = 18;

/** Clamp any age onto a band. Under 7 reads as the youngest band, over 18 the oldest. */
export function bandForAge(age) {
  const n = Number(age);
  if (!Number.isFinite(n)) return '11-14';
  if (n <= 10) return '7-10';
  if (n <= 14) return '11-14';
  return '15-18';
}

/** A birth *year* is all LAMP ever stores of a birthday (SPEC.md §11). */
export function ageFromBirthYear(birthYear, now = new Date()) {
  const year = Number(birthYear);
  if (!Number.isFinite(year)) return null;
  return now.getFullYear() - year;
}

export function bandForBirthYear(birthYear, now = new Date()) {
  const age = ageFromBirthYear(birthYear, now);
  return age === null ? '11-14' : bandForAge(age);
}

/**
 * Resolve a band-keyed field. Falls back *down* — a 15-18 reader who has no
 * 15-18 text is better served by the 11-14 text than by nothing.
 */
export function pick(value, band) {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'object' || Array.isArray(value)) return value;
  const order = [band, ...BANDS.filter((b) => b !== band).reverse()];
  const index = BANDS.indexOf(band);
  const chain = index === -1 ? BANDS : [band, ...BANDS.slice(0, index).reverse(), ...BANDS.slice(index + 1)];
  for (const candidate of chain.length ? chain : order) {
    if (value[candidate] !== undefined && value[candidate] !== null) return value[candidate];
  }
  return null;
}
