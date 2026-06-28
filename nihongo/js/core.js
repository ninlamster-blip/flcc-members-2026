// Core: persistent state, storage, text-to-speech, toasts, small helpers.

const STORE_KEY = 'nihongo-journey-v1';

const DEFAULT_STATE = {
  createdAt: null,
  // progress
  learnedKana: {},        // "あ": true
  favorites: {},          // vocab id -> true
  srs: {},                // card id -> { ease, interval, due, reps }
  vocabSeen: {},          // vocab id -> true
  kanjiSeen: {},          // kanji -> true
  // gamification
  xp: 0,
  streak: 0,
  lastActive: null,       // yyyy-mm-dd
  achievements: {},       // id -> earned timestamp
  dailyDate: null,        // yyyy-mm-dd the missions belong to
  daily: {},              // missionId -> progress number
  stats: { wordsLearned: 0, lessonsDone: 0, sentencesRead: 0, speakReps: 0 },
};

function load() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return { ...structuredClone(DEFAULT_STATE), createdAt: Date.now() };
    const parsed = JSON.parse(raw);
    return deepMerge(structuredClone(DEFAULT_STATE), parsed);
  } catch {
    return { ...structuredClone(DEFAULT_STATE), createdAt: Date.now() };
  }
}

function deepMerge(base, over) {
  for (const k in over) {
    if (over[k] && typeof over[k] === 'object' && !Array.isArray(over[k]) && typeof base[k] === 'object') {
      base[k] = deepMerge(base[k] || {}, over[k]);
    } else {
      base[k] = over[k];
    }
  }
  return base;
}

export const State = load();

let saveTimer = null;
export function save() {
  clearTimeout(saveTimer);
  saveTimer = setTimeout(() => {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(State)); } catch {}
  }, 120);
}

export function resetProgress() {
  const fresh = { ...structuredClone(DEFAULT_STATE), createdAt: Date.now() };
  for (const k in State) delete State[k];
  Object.assign(State, fresh);
  save();
}

// ---- Streak / activity --------------------------------------------------
export function today() { return new Date().toISOString().slice(0, 10); }

export function touchActivity() {
  const t = today();
  if (State.lastActive === t) return;
  if (State.lastActive) {
    const diff = Math.round((new Date(t) - new Date(State.lastActive)) / 86400000);
    State.streak = diff === 1 ? State.streak + 1 : 1;
  } else {
    State.streak = 1;
  }
  State.lastActive = t;
  if (!State.createdAt) State.createdAt = Date.now();
  save();
}

export function addXp(n) {
  State.xp = (State.xp || 0) + n;
  save();
  window.dispatchEvent(new CustomEvent('xp', { detail: n }));
}

export function level() {
  // 100 xp per level, gentle curve
  return Math.floor(State.xp / 100) + 1;
}

// ---- Text-to-speech (Japanese) -----------------------------------------
let voices = [];
let jaVoice = null;
function pickVoice() {
  voices = window.speechSynthesis ? speechSynthesis.getVoices() : [];
  jaVoice = voices.find(v => /ja[-_]?JP/i.test(v.lang)) ||
            voices.find(v => /Japanese/i.test(v.name)) || null;
}
if (window.speechSynthesis) {
  pickVoice();
  speechSynthesis.onvoiceschanged = pickVoice;
}

export function ttsAvailable() { return !!window.speechSynthesis; }

export function speak(text, { rate = 0.92, pitch = 1 } = {}) {
  if (!window.speechSynthesis) { toast('Audio not supported on this browser'); return; }
  try {
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'ja-JP';
    u.rate = rate; u.pitch = pitch;
    if (!jaVoice) pickVoice();
    if (jaVoice) u.voice = jaVoice;
    speechSynthesis.speak(u);
  } catch { /* ignore */ }
}

// ---- Toast --------------------------------------------------------------
let toastEl = null;
export function toast(msg) {
  if (!toastEl) {
    toastEl = document.createElement('div');
    toastEl.className = 'toast';
    document.body.appendChild(toastEl);
  }
  toastEl.textContent = msg;
  toastEl.classList.add('show');
  clearTimeout(toastEl._t);
  toastEl._t = setTimeout(() => toastEl.classList.remove('show'), 1900);
}

// ---- DOM helpers --------------------------------------------------------
export function el(html) {
  const t = document.createElement('template');
  t.innerHTML = html.trim();
  return t.content.firstElementChild;
}
export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, c =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
export const ICON = {
  play: '<svg class="ico" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>',
  heart: (on) => `<svg class="ico" viewBox="0 0 24 24" fill="${on ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.6l-1-1a5.5 5.5 0 1 0-7.8 7.8l1 1L12 21l7.8-7.6 1-1a5.5 5.5 0 0 0 0-7.8z"/></svg>`,
};
