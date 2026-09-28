// Achievements: what the app can count, and whether a stamp has been earned.
//
// One list of countable things, read by the Me screen, the dashboard's editor,
// the dashboard's audit and the content suite, so a stamp can never be written
// against something nothing records. Pure: the screen gathers the facts from
// storage and hands them in, so every rule here can be tested without one.

/** What a stamp can be counted from, and what the dashboard calls it. */
export const KINDS = {
  streak: 'Best streak, in days',
  devotional: 'Devotionals read',
  lesson: 'Journey lessons finished',
  game: 'Games played',
  challenge: 'Daily challenges done',
  prayer: 'Prayers written',
  memory: 'Memory verses learned',
  service: 'Service notes kept',
  hop: 'Furthest Hop Across row',
  galaga: 'Best Galaga score',
};

export const KIND_NAMES = Object.keys(KINDS);

/**
 * The numbers a stamp is judged against:
 * `{ best, counts: { devotional, … }, arcade: { hop, galaga } }`.
 */
export function tally(kind, facts = {}) {
  if (kind === 'streak') return facts.best || 0;
  if (kind === 'hop' || kind === 'galaga') return (facts.arcade && facts.arcade[kind]) || 0;
  return (facts.counts && facts.counts[kind]) || 0;
}

export function earned(row, facts) {
  return Boolean(row && row.need && KINDS[row.need.kind]) && tally(row.need.kind, facts) >= row.need.count;
}

/**
 * How a stamp shows on the Me screen. A hidden stamp keeps its name and how
 * to earn it secret until it is earned — the reason to go looking.
 */
export function face(row, facts) {
  const has = earned(row, facts);
  if (has || !row.hidden) return { has, title: row.title, how: row.how, symbol: row.symbol };
  return { has, title: '???', how: 'A secret. Keep exploring the app to find it.', symbol: 'question' };
}
