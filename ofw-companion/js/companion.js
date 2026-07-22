// Kaibigan — the AI companion view: heart check-in, conversation, voice.
// Companion Brain UI (see js/agent-brain.js for the full five-brain map) —
// paired with ai.js (the persona/system prompt) and relationship-engine.js
// (deliberate memory follow-up).
import { getState, addChatMessage, setHeartToday, heartToday, addMemory, dismissCompanionSuggestion, markReflectionShown, markGrowthShown, markMemoryFollowedUp, touchLastSeen } from './state.js';
import { companionReply, companionOpener, isConnected, speakNatural, weeklyReflection, growthInsight, transcribeAudio } from './ai.js';
import {
  renderRichText, escapeHtml, pickRandom,
  detectsCrisis, classifyHeart, compressImageFile,
} from './utils.js';
import { openBreathing } from './sanctuary.js';
import { createHeaderController } from './header.js';
import { getTopRecommendation, topRecommendationHint } from './agent-brain.js';
import { buildWeeklySummary } from './reflection-engine.js';
import { findGrowthHighlight } from './growth-engine.js';
import { pickGreetingHint } from './relationship-engine.js';

// Agent Brain suggestion cards that come with their own AI narrative
// upgrade: the structured (offline-safe) text renders first, and — only
// if connected — gets swapped for a warmer version once the AI responds.
// Kept as a lookup rather than more branches in renderBrainCard so adding a
// third upgradeable card (see reflection-engine.js / growth-engine.js for
// the pattern) means adding one entry here, not touching the render logic.
const AI_UPGRADES = {
  reflection: { markShown: markReflectionShown, buildPayload: buildWeeklySummary, fetchNarrative: weeklyReflection },
  growth: { markShown: markGrowthShown, buildPayload: findGrowthHighlight, fetchNarrative: growthInsight },
};

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
let goToTab = () => {};
let currentBrainRec = null;

// Safe to call again after onboarding or settings changes — the composer and
// voice listeners bind only once; everything else re-renders.
export async function initCompanion(context) {
  comfort = context.comfort;
  goToTab = context.goTo || (() => {});
  els = {
    kaibiganUser: document.getElementById('oc-kaibigan-user'),
    heartCheckin: document.getElementById('oc-heart-checkin'),
    heartChips: document.getElementById('oc-heart-chips'),
    shareBtn: document.getElementById('oc-heart-share'),
    chat: document.getElementById('oc-chat'),
    input: document.getElementById('oc-input'),
    sendBtn: document.getElementById('oc-send-btn'),
    photoBtn: document.getElementById('oc-photo-btn'),
    photoInput: document.getElementById('oc-photo-input'),
    photoPreview: document.getElementById('oc-photo-preview'),
    photoPreviewImg: document.getElementById('oc-photo-preview-img'),
    photoPreviewRemove: document.getElementById('oc-photo-preview-remove'),
    micBtn: document.getElementById('oc-mic-btn'),
    brainCard: document.getElementById('oc-brain-card'),
    brainTitle: document.getElementById('oc-brain-title'),
    brainMessage: document.getElementById('oc-brain-message'),
    brainCta: document.getElementById('oc-brain-cta'),
    brainDismiss: document.getElementById('oc-brain-dismiss'),
  };

  // Header reads like a chat contact bar, one line: "Kaibigan · Name".
  const name = getState().profile.name;
  els.kaibiganUser.textContent = name ? ` · ${name}` : '';

  renderHeartChips();
  renderHistory();
  renderBrainCard();
  if (!bound) {
    bound = true;
    setupComposer();
    setupHeaderCollapse();
    els.brainDismiss.addEventListener('click', () => {
      if (!currentBrainRec) return;
      dismissCompanionSuggestion(currentBrainRec.id);
      renderBrainCard();
    });
    els.brainCta.addEventListener('click', () => {
      if (!currentBrainRec) return;
      navigator.vibrate?.(8);
      handleBrainAction(currentBrainRec.action);
    });
    maybeGreetAfterGap();
  }
}

// Agent Brain (js/agent-brain.js): the one or two most helpful
// things to surface right now, decided from context the app already has —
// journal gaps, mood trend, today's heart check-in. Re-run whenever Kaibigan
// becomes active again (see exported refreshBrainCard) so it reflects
// anything the member just did on another tab.
function renderBrainCard() {
  currentBrainRec = getTopRecommendation();
  if (!currentBrainRec) {
    els.brainCard.hidden = true;
    return;
  }
  els.brainTitle.textContent = currentBrainRec.title;
  els.brainMessage.textContent = currentBrainRec.message;
  if (currentBrainRec.cta) {
    els.brainCta.textContent = currentBrainRec.cta;
    els.brainCta.hidden = false;
  } else {
    els.brainCta.hidden = true;
  }
  els.brainCard.hidden = false;

  const upgrade = currentBrainRec.aiUpgradeKind && AI_UPGRADES[currentBrainRec.aiUpgradeKind];
  if (upgrade) {
    upgrade.markShown(); // once shown (even just the structured text), don't show again until the next gate window
    if (isConnected()) {
      const recId = currentBrainRec.id;
      upgrade.fetchNarrative(upgrade.buildPayload())
        .then((text) => {
          // Guard against a stale response landing after the card moved on
          // (dismissed, or a higher-priority suggestion replaced it).
          if (currentBrainRec?.id === recId && !els.brainCard.hidden) {
            els.brainMessage.textContent = text;
          }
        })
        .catch(() => {}); // the structured fallback already shown stands on its own
    }
  }
}

export function refreshBrainCard() {
  if (els.brainCard) renderBrainCard();
}

function handleBrainAction(action) {
  if (!action) return;
  if (action.tab === 'home') {
    if (action.focus === 'breathe') openBreathing();
    else if (action.focus === 'heart') els.heartCheckin.scrollIntoView({ behavior: 'smooth' });
    return;
  }
  goToTab(action.tab);
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
    renderBrainCard();
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
  for (const m of messages) appendBubble(m.role === 'user' ? 'user' : 'ai', m.content, m.image);
  scrollToEnd(false);
}

function welcomeText() {
  const name = getState().profile.name;
  const intro = name
    ? `Kumusta, ${name}? Ako si Kaibigan — nandito ako para sa'yo, anumang oras. Walang husga, walang madaliin.`
    : `Kumusta? Ako si Kaibigan — your companion here, anytime you need someone. Walang husga, walang madaliin.`;
  return `${intro} Kwentuhan mo ako — o magtanong ka lang: Bible verse, kahit anong gustong malaman. Kumusta ang puso mo ngayon?`;
}

// Kaibigan greets proactively once someone's been away from the app for a
// real while — about an hour or more — not just once per calendar day, so
// coming back mid-afternoon after a long shift gets a "kumusta ka" instead
// of silence. lastSeenAt tracks actual foreground time (touchLastSeen(),
// called here and on every visibilitychange resume in app.js) — distinct
// from lastTalkedDate, so a tab merely left open in the background doesn't
// reset the clock. If days went by, say what a friend would actually say.
const GREET_GAP_MS = 60 * 60 * 1000; // ~1 hour away counts as "gone a while"

export async function maybeGreetAfterGap() {
  const s = getState();
  if (!s.chat.messages.length) { touchLastSeen(); return; } // welcome bubble already shows
  const previousSeenAt = touchLastSeen();
  if (!previousSeenAt) return;          // first time tracking this — nothing to compare yet
  const gapMs = Date.now() - previousSeenAt;
  if (gapMs < GREET_GAP_MS) return;     // still the same sitting
  const daysAway = Math.floor(gapMs / 86400000);
  if (!isConnected()) {
    appendBubble('ai', daysAway >= 3
      ? `Ilang araw din tayong hindi nagkausap — hindi kita nakalimutan, at sana okay ka lang. Nandito lang ako. Kumusta ka?`
      : pickRandom(comfort.neutral));
    return;
  }
  const typing = showTyping();
  try {
    const hint = pickGreetingHint(topRecommendationHint());
    const opener = await companionOpener(daysAway, hint.text);
    typing.remove();
    if (opener) {
      addChatMessage('assistant', opener);
      appendBubble('ai', opener);
      speakIfEnabled(opener);
      if (hint.followUpMemoryText) markMemoryFollowedUp(hint.followUpMemoryText);
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

// The photo a member has picked but not sent yet — cleared once the
// message actually goes out (or they remove it from the preview strip).
let pendingImage = null;

function setupComposer() {
  const send = () => {
    const text = els.input.value.trim();
    if ((!text && !pendingImage) || busy) return;
    els.input.value = '';
    autoGrow();
    const image = pendingImage;
    clearPendingImage();
    sendUserMessage(text, { image });
  };
  els.sendBtn.addEventListener('click', send);
  els.input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  });
  els.input.addEventListener('input', autoGrow);

  setupPhotoShare();
  setupVoiceInput();
}

function clearPendingImage() {
  pendingImage = null;
  els.photoPreview.hidden = true;
  els.photoPreviewImg.src = '';
  els.photoInput.value = '';
}

function setupPhotoShare() {
  els.photoBtn.addEventListener('click', () => els.photoInput.click());
  els.photoInput.addEventListener('change', async () => {
    const file = els.photoInput.files?.[0];
    if (!file) return;
    try {
      pendingImage = await compressImageFile(file);
      els.photoPreviewImg.src = pendingImage;
      els.photoPreview.hidden = false;
    } catch {
      clearPendingImage(); // corrupt/unreadable file — fail quiet, they can just try again
    }
  });
  els.photoPreviewRemove.addEventListener('click', clearPendingImage);
}

// Speech-to-text, not the existing speakNatural() (which is the opposite
// direction — the AI speaking its replies aloud). Transcribed text lands
// in the composer for them to review/edit, same as typing normally — never
// auto-sent, since a mis-heard word should be easy to fix before it goes out.
let mediaRecorder = null;
let recordedChunks = [];
let silenceCtx = null;
let silenceRaf = null;
let silenceTimer = null;
let maxDurationTimer = null;

const SILENCE_RMS_THRESHOLD = 0.02; // below this reads as quiet, not speech
const SILENCE_STOP_MS = 1800; // auto-stop this long after the voice trails off
const MAX_RECORD_MS = 60000; // hard safety cap regardless of silence detection

function setupVoiceInput() {
  els.micBtn.addEventListener('click', () => {
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      mediaRecorder.stop();
    } else {
      startRecording();
    }
  });
}

function stopIfRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') mediaRecorder.stop();
}

// Listens to the raw mic stream (separately from the MediaRecorder, which
// only ever sees the encoded output) and auto-stops recording ~1.8s after
// the member finishes talking — "type to text after I finished talking"
// without needing a second manual tap. A stray loud noise won't finalize
// early since the timer only ever starts once real voice has been heard,
// and it keeps getting pushed back for as long as they keep talking.
function watchForSilence(stream) {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return; // no Web Audio support here — manual tap-to-stop still works
  silenceCtx = new Ctx();
  const source = silenceCtx.createMediaStreamSource(stream);
  const analyser = silenceCtx.createAnalyser();
  analyser.fftSize = 512;
  source.connect(analyser);
  const data = new Uint8Array(analyser.frequencyBinCount);

  const tick = () => {
    analyser.getByteTimeDomainData(data);
    let sumSquares = 0;
    for (let i = 0; i < data.length; i++) {
      const v = (data[i] - 128) / 128;
      sumSquares += v * v;
    }
    const rms = Math.sqrt(sumSquares / data.length);
    if (rms > SILENCE_RMS_THRESHOLD) {
      clearTimeout(silenceTimer);
      silenceTimer = setTimeout(stopIfRecording, SILENCE_STOP_MS);
    }
    silenceRaf = requestAnimationFrame(tick);
  };
  tick();
}

function stopWatchingSilence() {
  if (silenceRaf) cancelAnimationFrame(silenceRaf);
  silenceRaf = null;
  clearTimeout(silenceTimer);
  silenceTimer = null;
  clearTimeout(maxDurationTimer);
  maxDurationTimer = null;
  if (silenceCtx) { silenceCtx.close().catch(() => {}); silenceCtx = null; }
}

async function startRecording() {
  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({ audio: true });
  } catch {
    els.input.placeholder = 'Hindi ma-access ang mic — check ang permission sa browser settings.';
    setTimeout(() => { els.input.placeholder = 'Kwentuhan mo ako…'; }, 3000);
    return;
  }
  recordedChunks = [];
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.addEventListener('dataavailable', (e) => { if (e.data.size) recordedChunks.push(e.data); });
  mediaRecorder.addEventListener('stop', async () => {
    stopWatchingSilence();
    stream.getTracks().forEach((t) => t.stop());
    els.micBtn.classList.remove('is-recording');
    const blob = new Blob(recordedChunks, { type: mediaRecorder.mimeType || 'audio/webm' });
    if (blob.size < 1000) return; // too short to be real speech — ignore quietly
    els.input.placeholder = 'Ginagawang text...';
    try {
      const text = await transcribeAudio(blob);
      if (text) {
        els.input.value = els.input.value ? `${els.input.value} ${text}` : text;
        autoGrow();
        els.input.placeholder = 'Kwentuhan mo ako…';
      } else {
        els.input.placeholder = 'Walang narinig — subukan ulit.';
        setTimeout(() => { els.input.placeholder = 'Kwentuhan mo ako…'; }, 3000);
      }
    } catch (err) {
      // Surfaced, not swallowed — a silent failure here reads as "the mic
      // just doesn't work" with no way to tell why (not configured on the
      // church's Worker vs. a real network hiccup vs. something else).
      els.input.placeholder = `Hindi na-gawang text: ${err.message}`;
      setTimeout(() => { els.input.placeholder = 'Kwentuhan mo ako…'; }, 4000);
    }
  });
  mediaRecorder.start();
  els.micBtn.classList.add('is-recording');
  watchForSilence(stream);
  maxDurationTimer = setTimeout(stopIfRecording, MAX_RECORD_MS);
}

function autoGrow() {
  els.input.style.height = 'auto';
  // Only grow while there is text; empty resets to a single line.
  if (els.input.value) els.input.style.height = Math.min(els.input.scrollHeight, 120) + 'px';
}

// Same WhatsApp-style collapsible header as every other tab (see
// js/header.js), sticky and driven by the window's scroll — Kaibigan
// scrolls at the window level like everything else now, rather than
// internally in .oc-chat, so its sticky header stays part of the same
// scroll iOS Safari's compositor tracks natively.
let homeHeader = null;

function isHomeActive() {
  return document.body.dataset.activeView === 'home';
}

function setupHeaderCollapse() {
  homeHeader = createHeaderController({
    getScrollTop: () => window.scrollY,
    header: document.querySelector('.oc-home-header'),
    // The ritual pill, audio drop, and not-okay button fold away in step
    // with the header, so scrolling the conversation clears them the room
    // WhatsApp-style collapsing promises.
    onToggle: (hidden) => document.body.classList.toggle('oc-home-compact', hidden),
  });
  homeHeader.reset(); // home is visible from first load, not from a nav click
  window.addEventListener('scroll', () => {
    if (isHomeActive()) homeHeader.onScroll();
  }, { passive: true });
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

  appendBubble('user', text, opts.image);
  addChatMessage('user', text, opts.image);
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

function appendBubble(kind, text, image) {
  const div = document.createElement('div');
  div.className = `oc-bubble oc-bubble-${kind}`;
  const imgHtml = image ? `<img class="oc-bubble-img" src="${escapeHtml(image)}" alt="">` : '';
  div.innerHTML = imgHtml + (text ? renderRichText(text) : '');
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

// Kaibigan scrolls at the window level now (see setupHeaderCollapse), not
// internally in .oc-chat. A huge target rather than document.body's exact
// height: bubbles use content-visibility for scroll performance on long
// conversations, so a freshly-appended (or still off-screen) bubble's true
// height may not be measured yet when this runs — reading the exact height
// at that instant can undershoot the real bottom. scrollTo() clamps any
// target to the actual max automatically, so this always lands at the true
// bottom regardless.
function scrollToEnd(smooth = true) {
  requestAnimationFrame(() => {
    window.scrollTo({ top: 1e9, behavior: smooth ? 'smooth' : 'auto' });
  });
}

// ── Spoken replies ───────────────────────────────────────────────────────────
// Only the natural voice (Worker /tts, ElevenLabs) is ever used — never the
// phone's robotic speechSynthesis. If unavailable, Kaibigan stays quiet.

function speakIfEnabled(text) {
  if (!getState().settings.voiceReplies) return;
  speakNatural(text); // fire-and-forget; silence on failure is intentional
}
