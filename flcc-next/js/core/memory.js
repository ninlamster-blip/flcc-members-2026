// The memory verse: one verse a week, learned by heart a few words at a time.
//
// Pure, like rotation.js. The verse is a function of the week — everyone in the
// ministry learns the same one, Monday to Sunday — and which words disappear at
// each step is a function of the verse, so a step always hides the same words
// and every step hides everything the step before it did, plus some more.

import { pick, hash } from './rotation.js';

/** How much of the verse is hidden at each step: read it, then less and less. */
export const STEPS = [0, 0.25, 0.5, 0.75, 1];

/** The longest verse a kid is asked to learn, in words. */
export const KIDS_MAX_WORDS = 16;

/** The Monday of the week `day` ('YYYY-MM-DD') falls in, as 'YYYY-MM-DD'. */
export function weekOf(day) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - ((date.getDay() + 6) % 7));
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

/** Which verses suit a reader: their age group's, and for kids, short ones. */
export function eligible(bank, band) {
  return bank.filter((row) => (!row.ageGroup || row.ageGroup === 'both' || row.ageGroup === band)
    && (band !== 'kids' || row.text.split(/\s+/).length <= KIDS_MAX_WORDS));
}

/** This week's verse for this reader. The same all week, for everyone their age. */
export function verseFor(bank, band, week) {
  return pick(eligible(bank, band), { date: new Date(`${week}T12:00:00`), offset: 5 });
}

/**
 * Which word positions are hidden at step `step`. The order words disappear
 * in is fixed by the verse, so each step's set contains the one before it.
 */
export function hiddenAt(words, step) {
  const order = words.map((word, i) => ({ i, key: hash(`${words.join(' ')}#${i}`) }))
    .sort((a, b) => a.key - b.key || a.i - b.i)
    .map((row) => row.i);
  const count = Math.round(words.length * STEPS[Math.max(0, Math.min(step, STEPS.length - 1))]);
  return new Set(order.slice(0, count));
}

/** A hidden word, as it is shown: its first letter for a kid, a blank for a teen. */
export function blank(word, band) {
  const letters = word.replace(/[^A-Za-z']/g, '');
  const tail = word.slice(word.search(/[^A-Za-z']*$/));
  if (band === 'kids') return `${letters.charAt(0)}${'_'.repeat(Math.max(1, letters.length - 1))}${tail}`;
  return `${'_'.repeat(Math.max(2, letters.length))}${tail}`;
}
