// Kaibigan — the AI companion view: heart check-in, conversation, voice.
import { getState, addChatMessage, setHeartToday, heartToday, addMemory } from './state.js';
import { companionReply, companionOpener, isConnected, speakNatural } from './ai.js';
import {
  renderRichText, escapeHtml, pickRandom, todayKey,
  detectsCrisis, classifyHeart,
} from './utils.js';
import { openBreathing } from './sanctuary.js';
import { createHeaderController } from './header.js';

// Heart categories that deserve an immediate, gentle "Hinga Muna" offer.
const HEAVY_CATS = new Set(['exhausted', 'heavy', 'anxious', 'lonely', 'homesick', 'invisible']);

// Each feeling maps to a comfort/verse category; a heart can hold several at
// once, so these are multi-select. The first six show by default; "More" opens
// the full range.
const HEART_CHIPS = [
  { id: 'peaceful', label: 'Payapa', cat: 'neutral' },
  { id: 'joyful', label: 'Masaya', cat: 'happy' },
  { id: 'grateful', label: 'Thankful', cat: 'grateful' },
  { id: 'lonely', label: 'Nalulungkot', cat: 'lonely' },
  { id: 'missinghome', label: 'Namimiss ko sila', cat: 'homesick' },
  { id: 'exhausted', label: 'Pagod na pagod', cat: 'exhausted' },
  { id: 'hopeful', label: 'Umaasa', cat: 'grateful', more: true },
  { id: 'loved', label: 'Minamahal', cat: 'grateful', more: true },
  { id: 'worried', label: 'Kinakabahan', cat: 'anxious', more: true },
  { id: 'heartbroken', label: 'Sawi ang puso', cat: 'heavy', more: true },
  { id: 'discouraged', label: 'Panghina ng loob', cat: 'heavy', more: true },
  { id: 'frustrated', label: 'Frustrated', cat: 'heavy', more: true },
  { id: 'overwhelmed', label: 'Lulong sa dami', cat: 'anxious', more: true },
  { id: 'numb', label: 'Manhid na lang', cat: 'heavy', more: true },
  { id: 'forgotten', label: 'Parang nakalimutan', cat: 'invisible', more: true },
  { id: 'listen', label: 'Gusto ko lang may makinig', cat: 'lonely', more: true },
  { id: 'needprayer', label: 'Kailangan ko ng panalangin', cat: 'heavy', more: true },
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
    kaibiganUser: document.getElementById('oc-kaibigan-user'),
    heartCheckin: document.getElementById('oc-heart-checkin'),
    heartChips: document.getElementById('oc-heart-chips'),
    shareBtn: document.getElementById('oc-heart-share'),
    chat: document.getElementById('oc-chat'),
    input: document.getElementById('oc-input'),
    sendBtn: document.getElementById('oc-send-btn'),
  };

  // Header reads like a chat contact bar, one line: "Kaibigan · Name".
  const name = getState().profile.name;
  els.kaibiganUser.textContent = name ? ` · ${name}` : '';

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
      `<button type="button" class="oc-chip${selected.has(c.id) ? ' is-selected' : ''}" data-heart="${c.id}" aria-pressed="${selected.has(c.id)}">${escapeHtml(c.label)}</button>`
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

  els.shareBtn.onclick = async () => {
    if (!selected.size) return;
    const chips = HEART_CHIPS.filter((c) => selected.has(c.id));
    setHeartToday(chips.map((c) => c.cat));
    els.heartCheckin.hidden = true;
    await sendUserMessage(chips.map((c) => c.label).join(' · '), { heartChip: chips[0].cat });
    if (chips.some((c) => HEAVY_CATS.has(c.cat))) offerHingaMuna();
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

// Same WhatsApp-style collapsible header as every other tab (see
// js/header.js) — hides on scroll-down, snaps back and stays frozen in
// place on scroll-up — just driven by the chat pane's own scroll instead
// of the window's, since Kaibigan is the one tab that scrolls internally.
let homeHeader = null;

function setupHeaderCollapse() {
  homeHeader = createHeaderController({
    getScrollTop: () => els.chat.scrollTop,
    header: document.querySelector('.oc-home-header'),
    spacer: document.getElementById('view-home'),
    baselinePadding: '0px',
    // The ritual pill, audio drop, and not-okay button fold away in step
    // with the header, so scrolling the conversation clears them the room
    // WhatsApp-style collapsing promises.
    onToggle: (hidden) => document.body.classList.toggle('oc-home-compact', hidden),
  });
  homeHeader.reset(); // establish the spacer padding right away — home is visible from first load, not from a nav click
  els.chat.addEventListener('scroll', () => homeHeader.onScroll(), { passive: true });
}

// Called whenever the Kaibigan tab becomes active again, so it never opens
// with a stale collapsed header from a previous scroll position.
export function resetHomeHeader() {
  homeHeader?.reset();
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

// When the heart is heavy (Pagod, Lungkot, Kaba…), offer a breath before
// anything else — a gentle invitation right inside the conversation.
function offerHingaMuna() {
  const div = document.createElement('div');
  div.className = 'oc-bubble oc-bubble-system oc-hinga-offer';
  div.innerHTML = `Mabigat 'yan, kapatid. Bago ang lahat —
    <button type="button" class="oc-hinga-btn">🫁 Hinga muna tayo · isang minuto lang</button>`;
  els.chat.appendChild(div);
  scrollToEnd();
  div.querySelector('.oc-hinga-btn').addEventListener('click', () => {
    navigator.vibrate?.(8);
    openBreathing();
  });
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
// Only the natural voice (Worker /tts, ElevenLabs) is ever used — never the
// phone's robotic speechSynthesis. If unavailable, Kaibigan stays quiet.

function speakIfEnabled(text) {
  if (!getState().settings.voiceReplies) return;
  speakNatural(text); // fire-and-forget; silence on failure is intentional
}
