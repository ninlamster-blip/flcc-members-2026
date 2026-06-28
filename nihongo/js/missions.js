// Daily missions — reset each day, track against live stats.
import { State, save, today, addXp, toast } from './core.js';

const MISSION_DEFS = [
  { id: 'words', label: 'Learn 8 new words', unit: 'words', goal: 8, xp: 20, stat: 'wordsLearned' },
  { id: 'lessons', label: 'Complete 2 lessons', unit: 'lessons', goal: 2, xp: 25, stat: 'lessonsDone' },
  { id: 'sentences', label: 'Read 5 sentences', unit: 'sentences', goal: 5, xp: 15, stat: 'sentencesRead' },
  { id: 'speak', label: 'Practice speaking 3 times', unit: 'reps', goal: 3, xp: 20, stat: 'speakReps' },
];

function ensureToday() {
  if (State.dailyDate !== today()) {
    State.dailyDate = today();
    State.daily = {};
    // snapshot baseline stat values so progress counts only today's gains
    State._dailyBase = {};
    for (const m of MISSION_DEFS) State._dailyBase[m.id] = State.stats[m.stat] || 0;
    save();
  }
  if (!State._dailyBase) {
    State._dailyBase = {};
    for (const m of MISSION_DEFS) State._dailyBase[m.id] = State.stats[m.stat] || 0;
    save();
  }
}

export function getMissions() {
  ensureToday();
  return MISSION_DEFS;
}

export function missionProgress(m) {
  ensureToday();
  const gained = (State.stats[m.stat] || 0) - (State._dailyBase[m.id] || 0);
  const value = Math.max(0, gained);
  const done = value >= m.goal;
  // award XP once when crossing the goal
  if (done && !State.daily[m.id]) {
    State.daily[m.id] = Date.now();
    addXp(m.xp);
    save();
    setTimeout(() => toast(`Mission complete: ${m.label} (+${m.xp} XP)`), 50);
  }
  return { value, done };
}

// Call after any stat change to keep missions in sync.
export function checkMissions() {
  getMissions().forEach(missionProgress);
}
