// Achievement definitions. Fun little milestones, not sermons — checked
// against cumulative stats after every game event.
export const ACHIEVEMENTS = [
  { id: 'first_light', title: 'First Light', desc: 'Clear your first line.', icon: '✨', check: (s) => s.totalLinesCleared >= 1 },
  { id: 'faithful_beginner', title: 'Faithful Beginner', desc: 'Clear 25 lines.', icon: '🌱', check: (s) => s.totalLinesCleared >= 25 },
  { id: 'persevering', title: 'Persevering', desc: 'Reach Level 5.', icon: '🔥', check: (s) => s.highestLevelEver >= 5 },
  { id: 'overcomer', title: 'Overcomer', desc: 'Score 10,000 points in a single game.', icon: '🏆', check: (s) => s.highestScore >= 10000 },
  { id: 'sword_of_the_spirit', title: 'Sword of the Spirit', desc: 'Clear 100 lines.', icon: '⚔️', check: (s) => s.totalLinesCleared >= 100 },
  { id: 'first_tetris', title: 'Tetris!', desc: 'Clear four lines at once.', icon: '💥', check: (s) => s.tetrisCount >= 1 },
  { id: 'tspin_master', title: 'Precision', desc: 'Land your first T-Spin.', icon: '🌀', check: (s) => s.tSpinCount >= 1 },
  { id: 'champion_of_faith', title: 'Champion of Faith', desc: 'Clear 1,000 lines.', icon: '👑', check: (s) => s.totalLinesCleared >= 1000 },
  { id: 'seven_day_walk', title: 'Seven Day Walk', desc: 'Play on 7 different days.', icon: '📅', check: (s) => s.dailyStreakDays >= 7 },
  { id: 'devoted_reader', title: 'Devoted Reader', desc: 'View 100 verses.', icon: '📖', check: (s) => s.versesViewed >= 100 },
];

// Returns newly-unlocked achievement objects (does not mutate stats).
export function checkAchievements(stats) {
  const unlocked = new Set(stats.unlockedAchievements || []);
  const fresh = [];
  for (const a of ACHIEVEMENTS) {
    if (!unlocked.has(a.id) && a.check(stats)) fresh.push(a);
  }
  return fresh;
}
