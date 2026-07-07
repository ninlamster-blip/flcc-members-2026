// LocalStorage-backed state for FLCC Kasama. All persistence lives here.
// Everything is private to this device — nothing is uploaded anywhere.
import { todayKey, uid } from './utils.js';

const STORAGE_KEY = 'flcc-ofw-companion:v1';

function defaultState() {
  return {
    profile: { name: '' },
    settings: {
      faithEnabled: true,
      voiceReplies: false,
      largeText: false,
      model: 'claude-sonnet-4-6',
    },
    // Daily wellbeing check-ins, newest first: { date, mood 1-5, energy 1-5,
    // loneliness 1-5, hope 1-5, connected (bool), gratitude (string) }
    checkins: [],
    // Private journal entries, newest first: { id, date, time, text }
    journal: [],
    // Companion conversation: rolling window of { role, content, t }
    chat: { messages: [], lastTalkedDate: null },
    // Things the companion should remember about the user: { t, text }
    memories: [],
    // Heart check-in chip chosen today: { date, feeling }
    heart: { date: null, feeling: null },
    // Bible study: what the user is bringing this week { date, choiceId, note }
    bringing: null,
    onboarded: false,
  };
}

let state = load();

function mergeDefaults(defaults, saved) {
  const merged = { ...defaults, ...saved };
  for (const key of Object.keys(defaults)) {
    const d = defaults[key];
    const s = saved[key];
    if (d && s && typeof d === 'object' && typeof s === 'object' && !Array.isArray(d) && !Array.isArray(s)) {
      merged[key] = { ...d, ...s };
    }
  }
  return merged;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return mergeDefaults(defaultState(), JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

function save() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Storage unavailable (private mode, quota) — session still works in memory.
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

// ── Check-ins ────────────────────────────────────────────────────────────────
export function todaysCheckin() {
  const today = todayKey();
  return state.checkins.find((c) => c.date === today) || null;
}

export function saveCheckin(data) {
  const today = todayKey();
  state.checkins = state.checkins.filter((c) => c.date !== today);
  state.checkins.unshift({ date: today, ...data });
  if (state.checkins.length > 366) state.checkins.length = 366;
  save();
}

// ── Journal ──────────────────────────────────────────────────────────────────
export function addJournalEntry(text) {
  const now = new Date();
  const entry = {
    id: uid(),
    date: todayKey(now),
    time: now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    text,
  };
  state.journal.unshift(entry);
  save();
  return entry;
}

export function deleteJournalEntry(id) {
  state.journal = state.journal.filter((e) => e.id !== id);
  save();
}

// ── Companion chat ───────────────────────────────────────────────────────────
const CHAT_WINDOW = 60;

export function addChatMessage(role, content) {
  state.chat.messages.push({ role, content, t: Date.now() });
  if (state.chat.messages.length > CHAT_WINDOW) {
    state.chat.messages = state.chat.messages.slice(-CHAT_WINDOW);
  }
  state.chat.lastTalkedDate = todayKey();
  save();
}

export function clearChat() {
  state.chat.messages = [];
  save();
}

// ── Memories ─────────────────────────────────────────────────────────────────
const MEMORY_LIMIT = 40;

export function addMemory(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return;
  // Skip near-duplicates so "misses her daughter" doesn't pile up daily.
  const lower = trimmed.toLowerCase();
  if (state.memories.some((m) => m.text.toLowerCase() === lower)) return;
  state.memories.unshift({ t: Date.now(), text: trimmed.slice(0, 200) });
  if (state.memories.length > MEMORY_LIMIT) state.memories.length = MEMORY_LIMIT;
  save();
}

export function deleteMemory(index) {
  state.memories.splice(index, 1);
  save();
}

// ── Heart check-in ───────────────────────────────────────────────────────────
export function setHeartToday(feeling) {
  state.heart = { date: todayKey(), feeling };
  save();
}

export function heartToday() {
  return state.heart.date === todayKey() ? state.heart.feeling : null;
}

// ── Privacy controls ─────────────────────────────────────────────────────────
export function exportAll() {
  return JSON.stringify(state, null, 2);
}

export function eraseAll() {
  state = defaultState();
  save();
}
