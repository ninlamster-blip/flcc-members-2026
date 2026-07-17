// LocalStorage-backed state for FLCC Kasama. All persistence lives here.
// Everything is private to this device — nothing is uploaded anywhere.
import { todayKey, uid } from './utils.js';

const STORAGE_KEY = 'flcc-ofw-companion:v1';

function defaultState() {
  return {
    // country: "Country of Origin" — a member-chosen, free-text home
    // country, attached (optionally) to prayer requests they send. Distinct
    // from the auto-detected "working in" country stamped server-side.
    profile: { name: '', country: '' },
    settings: {
      faithEnabled: true,
      voiceReplies: false,
      largeText: false,
      // Haiku by default: warm, capable, and roughly a tenth of Sonnet's
      // cost per message — kind to the church's shared API budget.
      model: 'claude-haiku-4-5-20251001',
      modelChosenByUser: false,
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
    // Heart check-in chosen today: { date, feeling (primary), feelings [] }
    heart: { date: null, feeling: null, feelings: [] },
    // Cached place for the weather greeting: { lat, lon }
    geo: null,
    // Cached weather: { at, code, temp }
    weatherCache: null,
    // Bible study: what the user is bringing this week { date, choiceId, note }
    bringing: null,
    // Private notes on Faith-tab teachings, keyed by teaching date
    teachingNotes: {},
    // A standing, general-purpose notes area for live Bible study / Sunday
    // preaching — separate from the per-teaching notes above.
    sermonNotes: '',
    onboarded: false,
    // Companion Brain: which suggestion card the member dismissed today, so
    // it doesn't reappear until conditions change or a new day starts.
    // Covered by the same export/erase controls as everything else here.
    companionBrain: { dismissedId: null, dismissedDate: null },
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
    const merged = mergeDefaults(defaultState(), JSON.parse(raw));
    // The thrifty default applies until the member explicitly picks a model
    // in Settings — early saves carried Sonnet without anyone choosing it.
    if (!merged.settings.modelChosenByUser) {
      merged.settings.model = defaultState().settings.model;
    }
    return merged;
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
export function addJournalEntry(text, title = '') {
  const now = new Date();
  const entry = {
    id: uid(),
    date: todayKey(now),
    time: now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' }),
    timestamp: now.toISOString(),
    title: title || '',
    text,
  };
  state.journal.unshift(entry);
  save();
  return entry;
}

// Re-save an existing entry in place (same id) — used when a member reopens
// a past entry, edits it, and hits Save again.
export function updateJournalEntry(id, { title = '', text }) {
  const entry = state.journal.find((e) => e.id === id);
  if (!entry) return null;
  const now = new Date();
  entry.title = title || '';
  entry.text = text;
  entry.time = now.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
  entry.timestamp = now.toISOString();
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

// ── Teaching notes ───────────────────────────────────────────────────────────
export function saveTeachingNote(teachingDate, text) {
  const trimmed = String(text || '').trim();
  if (trimmed) state.teachingNotes[teachingDate] = trimmed.slice(0, 4000);
  else delete state.teachingNotes[teachingDate];
  save();
}

// ── Sermon / Bible study notes (general, not tied to a specific teaching) ───
export function saveSermonNotes(text) {
  state.sermonNotes = String(text || '').slice(0, 8000);
  save();
}

// ── Heart check-in ───────────────────────────────────────────────────────────
// Real hearts hold more than one feeling at once; the first selected is the
// "primary" used for verse/prayer/comfort matching.
export function setHeartToday(feelings) {
  const list = Array.isArray(feelings) ? feelings : [feelings];
  state.heart = { date: todayKey(), feeling: list[0] || null, feelings: list };
  save();
}

export function heartToday() {
  return state.heart.date === todayKey() ? state.heart.feeling : null;
}

export function heartFeelingsToday() {
  return state.heart.date === todayKey() ? (state.heart.feelings || []) : [];
}

// ── Companion Brain ──────────────────────────────────────────────────────────
export function dismissCompanionSuggestion(id) {
  state.companionBrain = { dismissedId: id, dismissedDate: todayKey() };
  save();
}

export function isCompanionSuggestionDismissed(id) {
  return state.companionBrain.dismissedDate === todayKey() && state.companionBrain.dismissedId === id;
}

// ── Privacy controls ─────────────────────────────────────────────────────────
export function exportAll() {
  return JSON.stringify(state, null, 2);
}

export function eraseAll() {
  state = defaultState();
  save();
}
