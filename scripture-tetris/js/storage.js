// LocalStorage-backed stats and settings. Kept as a small key/value layer so
// the rest of the app never touches localStorage directly.
const STATS_KEY = 'st_stats_v1';
const SETTINGS_KEY = 'st_settings_v1';

const DEFAULT_STATS = {
  highestScore: 0,
  longestSurvivalMs: 0,
  totalLinesCleared: 0,
  versesViewed: 0,
  categoryCounts: {},
  currentStreak: 0,
  bestStreak: 0,
  lastClearStreakAt: 0,
  gamesPlayed: 0,
  totalPlayTimeMs: 0,
  unlockedAchievements: [],
  lastPlayedDay: null,
  dailyChallenge: null, // { day, goal, done }
  highestLevelEver: 1,
  tetrisCount: 0,
  tSpinCount: 0,
  dailyStreakDays: 0,
  lastDailyPlayDay: null,
};

const DEFAULT_SETTINGS = {
  highContrast: false,
  colorBlind: false,
  reducedMotion: false,
  largeText: false,
};

function load(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return { ...fallback };
    return { ...fallback, ...JSON.parse(raw) };
  } catch {
    return { ...fallback };
  }
}

export function loadStats() {
  return load(STATS_KEY, DEFAULT_STATS);
}

export function saveStats(stats) {
  localStorage.setItem(STATS_KEY, JSON.stringify(stats));
}

export function loadSettings() {
  return load(SETTINGS_KEY, DEFAULT_SETTINGS);
}

export function saveSettings(settings) {
  localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
}

export function favoriteCategory(stats) {
  const entries = Object.entries(stats.categoryCounts || {});
  if (!entries.length) return null;
  entries.sort((a, b) => b[1] - a[1]);
  return entries[0][0];
}
