// Streak rewards: something to show for coming back.
//
// Every reward is unlocked by the BEST streak reached, not the current one, so
// a missed day never takes anything away — the same promise progress.js makes
// about XP. Nothing here can be bought, lost or compared with anybody else's;
// a reward is a small thing to wear in a game, chosen on the Me screen.
//
// Pure data and pure functions, so the ladder can be tested without a browser.

/** The ladder, in the order it is climbed. `slot` is where the choice is kept. */
export const REWARDS = [
  { id: 'hop-cap', days: 3, slot: 'hopHat', value: 'cap', title: 'Baseball cap', game: 'Hop Across' },
  { id: 'galaga-sunshine', days: 5, slot: 'galagaShip', value: 'sunshine', title: 'Sunshine ship', game: 'Galaga' },
  { id: 'hop-bow', days: 7, slot: 'hopHat', value: 'bow', title: 'Bow', game: 'Hop Across' },
  { id: 'galaga-rose', days: 10, slot: 'galagaShip', value: 'rose', title: 'Rose ship', game: 'Galaga' },
  { id: 'hop-crown', days: 14, slot: 'hopHat', value: 'crown', title: 'Crown', game: 'Hop Across' },
  { id: 'galaga-poppy', days: 21, slot: 'galagaShip', value: 'poppy', title: 'Poppy ship', game: 'Galaga' },
  { id: 'hop-party', days: 30, slot: 'hopHat', value: 'party', title: 'Party hat', game: 'Hop Across' },
];

/** What a best streak of `best` days has unlocked. */
export const unlocked = (best) => REWARDS.filter((reward) => (best || 0) >= reward.days);

/** The next reward still to reach, or null once the ladder is climbed. */
export const next = (best) => REWARDS.find((reward) => (best || 0) < reward.days) || null;

/** What moving the best streak from `before` to `after` has just unlocked. */
export const newlyUnlocked = (before, after) =>
  REWARDS.filter((reward) => (before || 0) < reward.days && (after || 0) >= reward.days);

/**
 * What a slot is actually wearing: the saved choice if it is still unlocked,
 * otherwise nothing. A hand-edited or stale choice can never wear a reward
 * that was not earned.
 */
export function wearing(slot, choice, best) {
  if (!choice) return null;
  return unlocked(best).some((reward) => reward.slot === slot && reward.value === choice) ? choice : null;
}
