// Kaibigan — the AI companion view: heart check-in, conversation, voice.
import { getState, addChatMessage, setHeartToday, heartToday, addMemory } from './state.js';
import { companionReply, companionOpener, isConnected } from './ai.js';
import {
  renderRichText, escapeHtml, pickRandom, todayKey,
  timeOfDayGreeting, detectsCrisis, classifyHeart,
} from './utils.js';

// Each feeling maps to a comfort/verse category; a heart can hold several at
// once, so these are multi-select. The first six show by default; "More" opens
// the full range.
const HEART_CHIPS = [
  { id: 'peaceful', emoji: '😌', label: 'Payapa', cat: 'neutral' },
  { id: 'joyful', emoji: '😄', label: 'Masaya', cat: 'happy' },
  { id: 'grateful', emoji: '🌼', label: 'Thankful', cat: 'grateful' },
  { id: 'lonely', emoji: '🥺', label: 'Nalulungkot', cat: 'lonely' },
  { id: 'missinghome', emoji: '🏠', label: 'Namimiss ko sila', cat: 'homesick' },
  { id: 'exhausted', emoji: '😴', label: 'Pagod na pagod', cat: 'exhausted' },
  { id: 'hopeful', emoji: '🙏', label: 'Umaasa', cat: 'grateful', more: true },
  { id: 'loved', emoji: '❤️', label: 'Minamahal', cat: 'grateful', more: true },
  { id: 'worried', emoji: '😰', label: 'Kinakabahan', cat: 'anxious', more: true },
  { id: 'heartbroken', emoji: '💔', label: 'Sawi ang puso', cat: 'heavy', more: true },
  { id: 'discouraged', emoji: '😞', label: 'Panghina ng loob', cat: 'heavy', more: true },
  { id: 'frustrated', emoji: '😤', label: 'Frustrated', cat: 'heavy', more: true },
  { id: 'overwhelmed', emoji: '😵‍💫', label: 'Lulong sa dami', cat: 'anxious', more: true },
  { id: 'numb', emoji: '😶', label: 'Manhid na lang', cat: 'heavy', more: true },
  { id: 'forgotten', emoji: '🥀', label: 'Parang nakalimutan', cat: 'invisible', more: true },
  { id: 'listen', emoji: '🫂', label: 'Gusto ko lang may makinig', cat: 'lonely', more: true },
  { id: 'needprayer', emoji: '🕊️', label: 'Kailangan ko ng panalangin', cat: 'heavy', more: true },
];

// The offline companion acknowledges the chosen heart chip, then follows the
// user's own words. Loaded once from data/comfort.json.
let comfort = null;
let els = {};
let busy = false;
let bound = false;

// Safe to call again after onboarding or settings changes — the composer and
// voice listeners bind only once; everything else re-renders.
export async function initCompanion(context) {
  comfort = context.comfort;
  els = {
    greeting: document.getElementById('oc-greeting'),
    subgreeting: document.getElementById('oc-subgreeting'),
    heartCheckin: document.getElementById('oc-heart-checkin'),
    heartChips: document.getElementById('oc-heart-chips'),
    shareBtn: document.getElementById('oc-heart-share'),
    chat: document.getElementById('oc-chat'),
    input: document.getElementById('oc-input'),
    sendBtn: document.getElementById('oc-send-btn'),
  };

  els.greeting.textContent = timeOfDayGreeting(getState().profile.name);

  renderHeartChips();
  renderHistory();
  if (!bound) {
    bound = true;
    setupComposer();
    setupHeaderCollapse();
    maybeGreetNewDay();
  }
}

function renderHeartChips() {
  if (heartToday()) {
    els.heartCheckin.hidden = true;
    return;
  }
  els.heartCheckin.hidden = false;
  const selected = new Set();
  let expanded = false;

  const draw = () => {
    const visible = HEART_CHIPS.filter((c) => expanded || !c.more || selected.has(c.id));
    els.heartChips.innerHTML = visible.map((c) =>
      `<button type="button" class="oc-chip${selected.has(c.id) ? ' is-selected' : ''}" data-heart="${c.id}" aria-pressed="${selected.has(c.id)}">${c.emoji} ${escapeHtml(c.label)}</button>`
    ).join('') + (expanded ? '' : `<button type="button" class="oc-chip oc-chip-more" data-more>+ Iba pa…</button>`);

    els.heartChips.querySelectorAll('[data-heart]').forEach((btn) => {
      btn.addEventListener('click', () => {
        navigator.vibrate?.(8);
        const id = btn.dataset.heart;
        if (selected.has(id)) selected.delete(id); else selected.add(id);
        draw();
      });
    });
    els.heartChips.querySelector('[data-more]')?.addEventListener('click', () => { expanded = true; draw(); });
    els.shareBtn.hidden = selected.size === 0;
  };
  draw();

  els.shareBtn.onclick = () => {
    if (!selected.size) return;
    const chips = HEART_CHIPS.filter((c) => selected.has(c.id));
    setHeartToday(chips.map((c) => c.cat));
    els.heartCheckin.hidden = true;
    sendUserMessage(chips.map((c) => `${c.emoji} ${c.label}`).join(' · '), { heartChip: chips[0].cat });
  };
}

function renderHistory() {
  const { messages } = getState().chat;
  els.chat.innerHTML = '';
  // Standing reminder at the top of every conversation — companionship only.
  appendBubble('system', 'Si Kaibigan ay kasama mo lang — hindi kapalit ng tunay na kaibigan, ng pastor, ng counselor, o ng Diyos. 🤍');
  if (!messages.length) {
    appendBubble('ai', welcomeText());
    return;
  }
  for (const m of messages) appendBubble(m.role === 'user' ? 'user' : 'ai', m.content);
  scrollToEnd(false);
}

function welcomeText() {
  const name = getState().profile.name;
  const intro = name
    ? `Kumusta, ${name}? Ako si Kaibigan — nandito ako para sa'yo, anumang oras. Walang husga, walang madaliin.`
    : `Kumusta? Ako si Kaibigan — your companion here, anytime you need someone. Walang husga, walang madaliin.`;
  return `${intro} Kwentuhan mo ako — o magtanong ka lang: Bible verse, kahit anong gustong malaman. Kumusta ang puso mo ngayon?`;
}

// On a new day, ask the AI for a warm opener that recalls a memory ("Last
// week you mentioned missing your daughter…") — and if days went by without
// a word, say what a friend would say.
async function maybeGreetNewDay() {
  const s = getState();
  const today = todayKey();
  if (!s.chat.messages.length) return;              // welcome bubble already shows
  if (s.chat.lastTalkedDate === today) return;      // already talked today
  const daysAway = s.chat.lastTalkedDate
    ? Math.round((new Date(today) - new Date(s.chat.lastTalkedDate)) / 86400000)
    : 0;
  if (!isConnected()) {
    appendBubble('ai', daysAway >= 3
      ? `Ilang araw din tayong hindi nagkausap — hindi kita nakalimutan, at sana okay ka lang. Nandito lang ako. Kumusta ka?`
      : pickRandom(comfort.neutral));
    return;
  }
  const typing = showTyping();
  try {
    const opener = await companionOpener(daysAway);
    typing.remove();
    if (opener) {
      addChatMessage('assistant', opener);
      appendBubble('ai', opener);
      speakIfEnabled(opener);
    }
  } catch {
    typing.remove();
  }
}

// Lets the "I'm not okay" sheet start the conversation for the user.
export function startNotOkayConversation() {
  if (busy) return;
  sendUserMessage('Hindi ako okay ngayon. 🌧️', { heartChip: 'heavy' });
}

function setupComposer() {
  const send = () => {
    const text = els.input.value.trim();
    if (!text || busy) return;
    els.input.value = '';
    autoGrow();
    sendUserMessage(text);
  };
  els.sendBtn.addEventListener('click', send);
  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  els.input.addEventListener('input', autoGrow);
}

function autoGrow() {
  els.input.style.height = 'auto';
  // Only grow while there is text; empty resets to a single line.
  if (els.input.value) els.input.style.height = Math.min(els.input.scrollHeight, 120) + 'px';
}

// Fold the big greeting into a slim bar while the user reads up the
// conversation (WhatsApp-style). Hysteresis (40px down / 8px up) prevents
// flapping as the header resize itself changes the scroll geometry.
function setupHeaderCollapse() {
  els.chat.addEventListener('scroll', () => {
    const compact = document.body.classList.contains('oc-home-compact');
    if (!compact && els.chat.scrollTop > 40) document.body.classList.add('oc-home-compact');
    else if (compact && els.chat.scrollTop < 8) document.body.classList.remove('oc-home-compact');
  }, { passive: true });
}

async function sendUserMessage(text, opts = {}) {
  if (busy) return;
  busy = true;
  els.sendBtn.disabled = true;

  appendBubble('user', text);
  addChatMessage('user', text);
  scrollToEnd();

  if (detectsCrisis(text)) {
    document.dispatchEvent(new CustomEvent('oc:crisis'));
  }

  const typing = showTyping();
  let reply;
  try {
    if (isConnected()) {
      reply = await companionReply(getState().chat.messages);
    } else {
      reply = offlineReply(text, opts.heartChip);
      await new Promise((r) => setTimeout(r, 700)); // a breath, not a spinner
    }
  } catch (err) {
    reply = offlineReply(text, opts.heartChip)
      + `\n\n*(Hindi ako makakonekta sa AI ngayon — ${err.message}. Pero nandito pa rin ako.)*`;
  }
  typing.remove();

  addChatMessage('assistant', reply);
  appendBubble('ai', reply);
  scrollToEnd();
  speakIfEnabled(reply);

  busy = false;
  els.sendBtn.disabled = false;
}

// Rule-based comfort when no AI connection exists. Validate first, then a
// gentle question — never generic filler.
function offlineReply(text, heartChip) {
  // Acute distress overrides everything: point to real help immediately.
  if (detectsCrisis(text)) return comfort.crisis;

  const category = heartChip || classifyHeart(text);
  const pool = comfort[category] || comfort.neutral;
  let base = pickRandom(pool);
  // Remember plainly-worded facts even offline, so the AI can recall them later.
  if (/anak|daughter|son|asawa|husband|wife|nanay|tatay|birthday/i.test(text)) {
    addMemory(`They shared: "${text.slice(0, 140)}"`);
  }
  // Every few exchanges, gently restate that this is companionship only.
  const userTurns = getState().chat.messages.filter((m) => m.role === 'user').length;
  if (userTurns > 0 && userTurns % 6 === 0) {
    base += `\n\n*${comfort.fallbackClosing}*`;
  }
  return base;
}

function appendBubble(kind, text) {
  const div = document.createElement('div');
  div.className = `oc-bubble oc-bubble-${kind}`;
  div.innerHTML = renderRichText(text);
  els.chat.appendChild(div);
  return div;
}

function showTyping() {
  const div = document.createElement('div');
  div.className = 'oc-typing';
  div.innerHTML = '<span></span><span></span><span></span>';
  els.chat.appendChild(div);
  scrollToEnd();
  return div;
}

function scrollToEnd(smooth = true) {
  requestAnimationFrame(() => {
    els.chat.scrollTo({ top: els.chat.scrollHeight, behavior: smooth ? 'smooth' : 'auto' });
  });
}

// ── Spoken replies ───────────────────────────────────────────────────────────
// Web Speech quality depends entirely on the voices installed on the phone.
// We pick the most natural one available: Filipino first, then the enhanced/
// neural English voices, instead of the browser's robotic default.

let cachedVoice = null;

function pickVoice() {
  if (cachedVoice) return cachedVoice;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  const preferences = [
    (v) => /^(fil|tl)[-_]?/i.test(v.lang),
    (v) => /en[-_]PH/i.test(v.lang),
    (v) => /natural|neural|premium|enhanced/i.test(v.name) && /^en/i.test(v.lang),
    (v) => /Google|Microsoft|Samantha|Karen/i.test(v.name) && /^en/i.test(v.lang),
    (v) => /^en/i.test(v.lang),
  ];
  for (const wanted of preferences) {
    const match = voices.find(wanted);
    if (match) { cachedVoice = match; return match; }
  }
  return voices[0];
}

if ('speechSynthesis' in window) {
  // Voice list loads asynchronously on most phones.
  window.speechSynthesis.addEventListener?.('voiceschanged', () => { cachedVoice = null; pickVoice(); });
}

function speakIfEnabled(text) {
  if (!getState().settings.voiceReplies) return;
  if (!('speechSynthesis' in window)) return;
  // Strip markdown markers and emoji — hearing "asterisk" or emoji names ruins the warmth.
  const plain = text
    .replace(/\*+/g, '')
    .replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}\u{200D}]/gu, '')
    .trim();
  if (!plain) return;
  const utter = new SpeechSynthesisUtterance(plain);
  const voice = pickVoice();
  if (voice) { utter.voice = voice; utter.lang = voice.lang; }
  utter.rate = 0.95;
  utter.pitch = 1.03;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}
