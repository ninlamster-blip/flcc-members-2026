// Kaibigan — the AI companion view: heart check-in, conversation, voice.
import { getState, addChatMessage, setHeartToday, heartToday, addMemory } from './state.js';
import { companionReply, companionOpener, isConnected } from './ai.js';
import {
  renderRichText, escapeHtml, pickRandom, todayKey,
  timeOfDayGreeting, detectsCrisis, classifyHeart,
} from './utils.js';

const HEART_CHIPS = [
  { id: 'happy', emoji: '😊', label: 'Masaya' },
  { id: 'grateful', emoji: '🌼', label: 'Grateful' },
  { id: 'neutral', emoji: '😐', label: 'Okay lang' },
  { id: 'lonely', emoji: '🥺', label: 'Nalulungkot' },
  { id: 'homesick', emoji: '🏠', label: 'Namimiss ko sila' },
  { id: 'exhausted', emoji: '😮‍💨', label: 'Pagod na pagod' },
  { id: 'anxious', emoji: '😟', label: 'Kinakabahan' },
  { id: 'heavy', emoji: '💔', label: 'Mabigat ang loob' },
];

// The offline companion acknowledges the chosen heart chip, then follows the
// user's own words. Loaded once from data/comfort.json.
let comfort = null;
let els = {};
let busy = false;
let recognition = null;
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
    chat: document.getElementById('oc-chat'),
    input: document.getElementById('oc-input'),
    sendBtn: document.getElementById('oc-send-btn'),
    voiceBtn: document.getElementById('oc-voice-btn'),
  };

  els.greeting.textContent = timeOfDayGreeting(getState().profile.name);

  renderHeartChips();
  renderHistory();
  if (!bound) {
    bound = true;
    setupComposer();
    setupVoice();
    setupHeaderCollapse();
    maybeGreetNewDay();
  }
}

function renderHeartChips() {
  const chosen = heartToday();
  if (chosen) {
    els.heartCheckin.hidden = true;
    return;
  }
  els.heartCheckin.hidden = false;
  els.heartChips.innerHTML = HEART_CHIPS.map((c) =>
    `<button type="button" class="oc-chip" data-heart="${c.id}">${c.emoji} ${escapeHtml(c.label)}</button>`
  ).join('');
  els.heartChips.querySelectorAll('.oc-chip').forEach((btn) => {
    btn.addEventListener('click', () => {
      const feeling = btn.dataset.heart;
      btn.classList.add('is-selected');
      setHeartToday(feeling);
      setTimeout(() => { els.heartCheckin.hidden = true; }, 350);
      const chip = HEART_CHIPS.find((c) => c.id === feeling);
      sendUserMessage(`${chip.emoji} ${chip.label}`, { heartChip: feeling });
    });
  });
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

// On a new day, if connected, ask the AI for a warm opener that recalls a
// memory ("Last week you mentioned missing your daughter…").
async function maybeGreetNewDay() {
  const s = getState();
  const today = todayKey();
  if (!s.chat.messages.length) return;              // welcome bubble already shows
  if (s.chat.lastTalkedDate === today) return;      // already talked today
  if (!isConnected()) {
    appendBubble('ai', pickRandom(comfort.neutral));
    return;
  }
  const typing = showTyping();
  try {
    const opener = await companionOpener();
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
  els.input.style.height = Math.min(els.input.scrollHeight, 120) + 'px';
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

// ── Voice ────────────────────────────────────────────────────────────────────

function setupVoice() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  if (!SR) return; // keep the mic hidden where unsupported
  els.voiceBtn.hidden = false;

  els.voiceBtn.addEventListener('click', () => {
    if (recognition) { recognition.stop(); return; }
    recognition = new SR();
    recognition.lang = 'fil-PH';
    recognition.interimResults = true;
    recognition.continuous = false;

    els.voiceBtn.classList.add('is-listening');
    let finalText = '';

    recognition.onresult = (e) => {
      let interim = '';
      for (const result of e.results) {
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      els.input.value = (finalText + interim).trim();
      autoGrow();
    };
    recognition.onerror = () => stopListening();
    recognition.onend = () => stopListening();
    recognition.start();
  });
}

function stopListening() {
  recognition = null;
  els.voiceBtn.classList.remove('is-listening');
  els.input.focus();
}

function speakIfEnabled(text) {
  if (!getState().settings.voiceReplies) return;
  if (!('speechSynthesis' in window)) return;
  // Strip markdown markers for natural speech.
  const plain = text.replace(/\*+/g, '');
  const utter = new SpeechSynthesisUtterance(plain);
  utter.rate = 0.98;
  utter.pitch = 1.02;
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}
