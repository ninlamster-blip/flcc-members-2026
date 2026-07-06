// LocalStorage-backed state for Daily Blessing. All persistence lives here.
import { todayKey } from './utils.js';

const STORAGE_KEY = 'flcc-daily-blessing:v1';

function defaultState() {
  return {
    coins: 0,
    xp: 0,
    streak: { current: 0, longest: 0, lastOpenDate: null, milestonesUnlocked: [] },
    history: [],
    collection: { ownedCharacterIds: [], badges: [] },
    pools: {},
    todayResolved: null,
    settings: { sound: true },
  };
}

let state = load();

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    const parsed = JSON.parse(raw);
    return { ...defaultState(), ...parsed };
  } catch {
    return defaultState();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode, quota) — app still works for this session.
  }
}

export function getState() {
  return state;
}

export function updateState(mutator) {
  mutator(state);
  save();
  return state;
}

export function addHistoryEntry(entry) {
  state.history.unshift({ date: todayKey(), ...entry });
  if (state.history.length > 200) state.history.length = 200;
  save();
}

export function resetAll() {
  state = defaultState();
  save();
}
