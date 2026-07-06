import { getState, updateState } from './state.js';
import { todayKey, daysBetween, STREAK_MILESTONES } from './utils.js';

// Advances the streak when today's blessing is opened. Returns any milestone
// reached today (or null) so the UI can celebrate it once.
export function registerOpen() {
  const key = todayKey();
  let milestoneReached = null;

  updateState((s) => {
    const streak = s.streak;
    if (streak.lastOpenDate === key) return; // already opened today

    const gap = streak.lastOpenDate ? daysBetween(streak.lastOpenDate, key) : null;
    streak.current = gap === 1 ? streak.current + 1 : 1;
    streak.lastOpenDate = key;
    streak.longest = Math.max(streak.longest, streak.current);

    if (STREAK_MILESTONES.includes(streak.current) && !streak.milestonesUnlocked.includes(streak.current)) {
      streak.milestonesUnlocked.push(streak.current);
      milestoneReached = streak.current;
    }
  });

  return milestoneReached;
}

export function currentStreak() {
  return getState().streak.current;
}
