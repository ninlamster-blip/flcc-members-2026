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
      faithBlocksSound: true, // soft synthesized tones — off doesn't affect haptics
    },
    // Daily wellbeing check-ins, newest first: { date, mood 1-5, energy 1-5,
    // loneliness 1-5, hope 1-5, connected (bool), gratitude (string) }
    checkins: [],
    // Private journal entries, newest first: { id, date, time, text }
    journal: [],
    // LIFE pillar: a private log of remittances sent, newest first —
    // { id, date, amount, currency, note }. Kept separate from `life`
    // (which is single current-state facts) since this is a growing history.
    remittances: [],
    // LIFE pillar: a fuller monthly budget — both income and categorized
    // expenses — newest first: { id, date, type: 'income'|'expense',
    // category (expense only), amount, currency, note }. Kept separate from
    // `remittances` above (a member can keep using the quick padala log,
    // the budget card, or both — logging a padala twice, once in each, is
    // a mild inconvenience, not a bug worth a risky data migration).
    budgetEntries: [],
    // COMMUNITY pillar: fellowship group names the member tapped "I'm
    // interested" on (data/biblestudy.json groups have no stable id — the
    // group's own `name` is the key, same tolerance for admin-editable
    // content as teachingNotes below being keyed by date rather than id).
    // Purely a personal, on-device reminder to follow up — never sent
    // anywhere; joining still happens the same human way it always has
    // (message your fellowship leader).
    interestedGroups: [],
    // Faith Blocks (wellness mini-game, js/faith-blocks.js): a light session
    // log, newest first — { date, startedAt (epoch ms), durationMs,
    // linesCleared }. Purely local, same as everything else — this is the
    // foundation for Agent Brain to eventually notice patterns ("you often
    // play after a hard day"), not a behavioral-analytics system in itself.
    faithBlocksSessions: [],
    // SAFETY pillar: a private on-device photo library of important
    // documents (passport, visa, contract) — { id, name, dateAdded, image
    // (data URL) }, newest first. On-device only, same as everything else
    // here — never sent to the AI or anywhere else. No extra encryption
    // beyond the device's own lock screen (explicit product decision, not
    // an oversight — see the "My documents" card's own on-screen note).
    documents: [],
    // FAITH pillar: a private log of personal prayer requests, newest
    // first — { id, date, text, answered, answeredDate, answeredNote }.
    // Distinct from the community Kadena ng Panalangin (prayerchain.js,
    // server-backed, shared with the congregation) — this is a personal,
    // on-device-only list so the member can mark their own prayers
    // answered over time and Kaibigan can genuinely follow up ("you
    // prayed for this a while ago — kumusta na?") or celebrate when one is
    // marked answered, without any of it ever leaving the device.
    prayerRequests: [],
    // Companion conversation: rolling window of { role, content, t }.
    // lastSeenAt (epoch ms) tracks the last time the app was actually in
    // the foreground — distinct from lastTalkedDate (the calendar date of
    // the last real message) — so Kaibigan can proactively greet after a
    // real gap in presence, not just once per calendar day.
    chat: { messages: [], lastTalkedDate: null, lastSeenAt: null },
    // Things the companion should remember about the user: { t, text }
    memories: [],
    // Heart check-in chosen today: { date, feeling (primary), feelings [] }
    heart: { date: null, feeling: null, feelings: [] },
    // Cached place for the weather greeting: { lat, lon }
    geo: null,
    // Cached weather: { at, code, temp }
    weatherCache: null,
    // Cached world/Philippines/showbiz/tech headlines for Kaibigan's conversation
    // context: { at, items: [{ headline, summary, source, date }] }
    newsCache: null,
    // Cached exchange rate for the remittance card (Journal tab) — how many
    // Philippine Pesos per 1 KWD today: { at, phpPerKwd }
    exchangeRateCache: null,
    // Bible study: what the user is bringing this week { date, choiceId, note }
    bringing: null,
    // Private notes on Faith-tab teachings, keyed by teaching date
    teachingNotes: {},
    // A standing, general-purpose notes area for live Bible study / Sunday
    // preaching — separate from the per-teaching notes above.
    sermonNotes: '',
    onboarded: false,
    // LIFE pillar: structured facts about their life abroad — distinct from
    // `memories` below (free-text things the AI noticed in conversation).
    // This is the foundation for countdowns and proactive nudges (contract
    // ending soon, an upcoming vacation, a family birthday) — features that
    // need an actual date to work from, not a sentence buried in a memory.
    // Birthdays only ever use the month+day of the stored date to recur
    // annually; whatever year was picked in the date input is not used for
    // anything (a member who doesn't remember/want to share the exact year
    // can pick any plausible one).
    life: {
      employer: '',
      contractEndDate: '',   // YYYY-MM-DD, optional
      vacationDate: '',      // YYYY-MM-DD, optional — next planned trip home
      family: [],            // { id, name, relation, birthday: 'YYYY-MM-DD' | '' }
    },
    // Agent Brain (js/agent-brain.js): which suggestion card the member
    // dismissed today, so it doesn't reappear until conditions change or a
    // new day starts; when they last saw a weekly reflection (surfaces at
    // most once a week); and when they last saw a growth highlight (at
    // most once a month). Covered by the same export/erase controls as
    // everything else. (Field name kept as `companionBrain` — renaming a
    // state.js key means writing a migration for existing members' saved
    // data, for a cosmetic gain that isn't worth that risk.)
    companionBrain: { dismissedId: null, dismissedDate: null, lastReflectionDate: null, lastGrowthDate: null },
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

// ── Remittances (LIFE pillar) ────────────────────────────────────────────────
export function addRemittance({ amount, currency, note }) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return;
  state.remittances.unshift({
    id: uid(),
    date: todayKey(),
    amount: num,
    currency: String(currency || '').trim().toUpperCase().slice(0, 6) || 'KWD',
    note: String(note || '').trim().slice(0, 120),
  });
  save();
}

export function deleteRemittance(id) {
  state.remittances = state.remittances.filter((r) => r.id !== id);
  save();
}

// ── Budget (LIFE pillar) ─────────────────────────────────────────────────────
// Amounts are logged per their own currency and never summed across
// currencies, same reasoning as the remittance log above.
export const BUDGET_CATEGORIES = ['Padala', 'Pagkain', 'Pabahay', 'Kuryente/Tubig', 'Transportasyon', 'Ipon', 'Iba pa'];

export function addBudgetEntry({ type, category, amount, currency, note }) {
  const num = Number(amount);
  if (!Number.isFinite(num) || num <= 0) return;
  if (type !== 'income' && type !== 'expense') return;
  state.budgetEntries.unshift({
    id: uid(),
    date: todayKey(),
    type,
    category: type === 'expense' ? (BUDGET_CATEGORIES.includes(category) ? category : 'Iba pa') : null,
    amount: num,
    currency: String(currency || '').trim().toUpperCase().slice(0, 6) || 'KWD',
    note: String(note || '').trim().slice(0, 120),
  });
  save();
}

export function deleteBudgetEntry(id) {
  state.budgetEntries = state.budgetEntries.filter((e) => e.id !== id);
  save();
}

// ── Fellowship group interest (COMMUNITY pillar) ─────────────────────────────
export function toggleGroupInterest(groupName) {
  const i = state.interestedGroups.indexOf(groupName);
  if (i === -1) state.interestedGroups.push(groupName);
  else state.interestedGroups.splice(i, 1);
  save();
}

// ── Faith Blocks sessions (wellness mini-game) ────────────────────────────────
export function logFaithBlocksSession({ startedAt, durationMs, linesCleared }) {
  if (!Number.isFinite(durationMs) || durationMs < 3000) return; // too short to mean anything
  state.faithBlocksSessions.unshift({
    date: todayKey(),
    startedAt,
    durationMs,
    linesCleared: linesCleared || 0,
  });
  if (state.faithBlocksSessions.length > 60) state.faithBlocksSessions.length = 60;
  save();
}

// ── Documents (SAFETY pillar) ────────────────────────────────────────────────
export function addDocument({ name, image }) {
  if (!image) return;
  state.documents.unshift({
    id: uid(),
    name: String(name || '').trim().slice(0, 60) || 'Document',
    dateAdded: todayKey(),
    image,
  });
  save();
}

export function deleteDocument(id) {
  state.documents = state.documents.filter((d) => d.id !== id);
  save();
}

// ── Prayer requests (FAITH pillar) ───────────────────────────────────────────
export function addPrayerRequest(text) {
  const trimmed = String(text || '').trim();
  if (!trimmed) return;
  state.prayerRequests.unshift({
    id: uid(),
    date: todayKey(),
    text: trimmed.slice(0, 300),
    answered: false,
    answeredDate: null,
    answeredNote: '',
  });
  save();
}

export function markPrayerAnswered(id, note) {
  const p = state.prayerRequests.find((r) => r.id === id);
  if (!p) return;
  p.answered = true;
  p.answeredDate = todayKey();
  p.answeredNote = String(note || '').trim().slice(0, 300);
  save();
}

export function deletePrayerRequest(id) {
  state.prayerRequests = state.prayerRequests.filter((r) => r.id !== id);
  save();
}

// ── Companion chat ───────────────────────────────────────────────────────────
const CHAT_WINDOW = 60;
// A compressed photo is still tens to low-hundreds of KB — keeping all of
// them across a 60-message window risks pushing localStorage toward its
// quota. Only the most recent few keep their actual image data; older
// ones fall back to a plain text placeholder (the AI itself is only ever
// shown the most recent photo anyway — see companionReply in ai.js).
const MAX_STORED_IMAGES = 4;

export function addChatMessage(role, content, image) {
  const msg = { role, content, t: Date.now() };
  if (image) msg.image = image;
  state.chat.messages.push(msg);
  if (state.chat.messages.length > CHAT_WINDOW) {
    state.chat.messages = state.chat.messages.slice(-CHAT_WINDOW);
  }
  let kept = 0;
  for (let i = state.chat.messages.length - 1; i >= 0; i--) {
    const m = state.chat.messages[i];
    if (!m.image) continue;
    kept++;
    if (kept > MAX_STORED_IMAGES) {
      if (!m.content) m.content = '[Nagpadala ng litrato / sent a photo]';
      delete m.image;
    }
  }
  state.chat.lastTalkedDate = todayKey();
  save();
}

export function clearChat() {
  state.chat.messages = [];
  save();
}

// Records "the app was just in the foreground" and returns the *previous*
// value, so the caller can measure the gap before it's overwritten.
export function touchLastSeen() {
  const previous = state.chat.lastSeenAt;
  state.chat.lastSeenAt = Date.now();
  save();
  return previous;
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

// Marked once the Relationship Engine (js/relationship-engine.js) has had
// the AI proactively ask about this memory, so the same one isn't picked
// again while older, never-yet-followed-up memories are still waiting.
export function markMemoryFollowedUp(text) {
  const memory = state.memories.find((m) => m.text === text);
  if (memory) {
    memory.followedUpAt = Date.now();
    save();
  }
}

// ── Life details (LIFE pillar: employer, contract, vacation, family) ────────
export function setLifeInfo({ employer, contractEndDate, vacationDate }) {
  state.life.employer = String(employer || '').trim().slice(0, 80);
  state.life.contractEndDate = contractEndDate || '';
  state.life.vacationDate = vacationDate || '';
  save();
}

export function addFamilyMember({ name, relation, birthday }) {
  const trimmedName = String(name || '').trim().slice(0, 40);
  if (!trimmedName) return;
  state.life.family.push({
    id: uid(),
    name: trimmedName,
    relation: String(relation || '').trim().slice(0, 30),
    birthday: birthday || '',
  });
  save();
}

export function deleteFamilyMember(id) {
  state.life.family = state.life.family.filter((m) => m.id !== id);
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

// ── Agent Brain (js/agent-brain.js) ────────────────────────────────────────────
export function dismissCompanionSuggestion(id) {
  state.companionBrain = { dismissedId: id, dismissedDate: todayKey() };
  save();
}

export function isCompanionSuggestionDismissed(id) {
  return state.companionBrain.dismissedDate === todayKey() && state.companionBrain.dismissedId === id;
}

export function markReflectionShown() {
  state.companionBrain.lastReflectionDate = todayKey();
  save();
}

export function markGrowthShown() {
  state.companionBrain.lastGrowthDate = todayKey();
  save();
}

// ── Privacy controls ─────────────────────────────────────────────────────────
export function exportAll() {
  return JSON.stringify(state, null, 2);
}

export function eraseAll() {
  state = defaultState();
  save();
}
