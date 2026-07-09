// Kadena ng Panalangin — the anonymous prayer chain on the Kapwa tab.
//
// Two flows, echo-free by design:
//   A. Ang Paghingi ng Saklolo — leave an anonymous request (no names, no
//      emails, no handles — there are simply no such fields).
//   B. Ang Pag-Salo — carry a kapatid in prayer: one tap, the button becomes
//      a glowing candle, and the count of praying kapatid rises.
//
// Privacy: interactions are deduplicated with an un-linkable SHA-256 of a
// random device id + the prayer id, computed right here on the device.
import { getConnection } from './ai.js';
import { escapeHtml, friendlyDate, uid } from './utils.js';

const DEVICE_KEY = 'flcc-kasama-device-uuid';
const PRAYED_KEY = 'flcc-kasama-my-prayed-list';
const SEEN_KEY = 'flcc-kasama-last-seen-prayer-at';

// "Bulong" — one-tap mood pills for prayer REQUESTS specifically (not
// gratitude posts, which don't fit the "asking for prayer" framing).
const MOOD_TAGS = [
  ['lungkot', '💧 Lungkot'],
  ['kaba', '😰 Kaba'],
  ['pagod', '😮‍💨 Pagod'],
];
const MOOD_LABELS = Object.fromEntries(MOOD_TAGS);

// Regional-indicator flag emoji built from any ISO 3166-1 alpha-2 code —
// no lookup table needed, works for whatever country Cloudflare reports.
function flagEmoji(code) {
  if (!/^[A-Z]{2}$/.test(code || '')) return '🌏';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)));
}

let toast = () => {};
let container = null;
let selectedMood = null;

// ── Privacy utilities ────────────────────────────────────────────────────────

function deviceUuid() {
  try {
    let id = localStorage.getItem(DEVICE_KEY);
    if (!id) {
      id = crypto.randomUUID ? crypto.randomUUID() : uid() + uid();
      localStorage.setItem(DEVICE_KEY, id);
    }
    return id;
  } catch {
    return 'ephemeral-' + uid();
  }
}

// SHA-256 hex of deviceUuid + prayerId — completely un-linkable to a person.
export async function interactionHash(prayerId) {
  const data = new TextEncoder().encode(`${deviceUuid()}:${prayerId}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function myPrayedList() {
  try { return JSON.parse(localStorage.getItem(PRAYED_KEY)) || []; } catch { return []; }
}

function savePrayedList(list) {
  try { localStorage.setItem(PRAYED_KEY, JSON.stringify(list.slice(-500))); } catch { /* best effort */ }
}

// ── API ──────────────────────────────────────────────────────────────────────
// FLCC Kasama is served by the same Worker that hosts /api/prayers, so an
// empty base simply means "this same site" (a relative fetch resolves
// against the current origin). The AI-chat proxy URL in Settings is a
// separate, optional override for members pointing at a different Worker —
// its absence must never disable this feature.

function apiBase() {
  const { proxyUrl } = getConnection();
  return proxyUrl ? proxyUrl.replace(/\/+$/, '') : '';
}

async function api(path, options = {}) {
  const base = apiBase();
  const { proxySecret } = getConnection();
  const headers = { 'Content-Type': 'application/json' };
  if (proxySecret) headers['x-proxy-secret'] = proxySecret;
  const res = await fetch(base + path, { headers, ...options });
  const data = await res.json().catch(() => null);
  if (!res.ok) throw new Error(data?.error?.message || `HTTP ${res.status}`);
  return data;
}

// ── Mount ────────────────────────────────────────────────────────────────────

export function initPrayerChain(context) {
  toast = context.toast;
  container = document.getElementById('oc-prayer-chain');
  render();
}

// ── "New prayer since your last visit" badge on the Kapwa nav icon ──────────
// SQLite's datetime('now') format ("YYYY-MM-DD HH:MM:SS") sorts correctly as
// plain strings, so no date parsing is needed to compare freshness.
function updateUnreadBadge(prayers) {
  const badge = document.getElementById('oc-kapwa-badge');
  if (!badge) return;
  const latest = prayers[0]?.created_at || '';
  const seen = localStorage.getItem(SEEN_KEY) || '';
  badge.hidden = !latest || latest <= seen;
}

// Called when the member actually opens the Kapwa tab.
export function markPrayersSeen() {
  const badge = document.getElementById('oc-kapwa-badge');
  if (badge) badge.hidden = true;
  try {
    if (latestSeenCandidate) localStorage.setItem(SEEN_KEY, latestSeenCandidate);
  } catch { /* best effort */ }
}

let latestSeenCandidate = null;

async function render() {
  container.innerHTML = `
    <h2 class="oc-section-title">🕊️ Kadena ng Panalangin</h2>
    <p class="oc-muted" style="margin-bottom:12px">Walang pangalan, walang husga — panalangin lang. Ang kapatid na nag-iwan nito ay hinding-hindi malalaman kung sino ka, at ikaw rin sa kanya.</p>
    <div id="oc-pc-body"><p class="oc-muted">Binubuksan ang kadena…</p></div>`;
  const body = container.querySelector('#oc-pc-body');

  let data;
  try {
    data = await api('/api/prayers');
  } catch (err) {
    body.innerHTML = `<p class="oc-muted">Hindi maabot ang kadena ngayon (${escapeHtml(err.message)}). Subukan ulit mamaya, kapatid.</p>`;
    return;
  }

  if (!data.configured) {
    body.innerHTML = `<p class="oc-muted">🌱 Malapit na: inihahanda pa ng church ang Kadena ng Panalangin. Pansamantala, maaari mong dalhin ang iyong kahilingan sa Bible study o sa fellowship group mo.</p>`;
    return;
  }

  const prayed = new Set(myPrayedList());
  const prayers = data.prayers || [];
  latestSeenCandidate = prayers[0]?.created_at || null;
  updateUnreadBadge(prayers);

  body.innerHTML = `
    ${composerHtml()}
    <div id="oc-pc-feed">
      ${prayers.length
        ? prayers.map((p) => prayerCardHtml(p, prayed.has(p.id))).join('')
        : '<p class="oc-muted" style="margin-top:10px">Wala pang laman ang kadena — ikaw ang mauna, kapatid. 🤍</p>'}
    </div>`;

  wireComposer(body);
  body.querySelectorAll('[data-pray]').forEach((btn) => {
    btn.addEventListener('click', () => handlePrayButtonClick(btn.dataset.pray));
  });
}

// (Push-notification opt-in now lives in Settings — see app.js — since it's
// a device preference, not something tied to viewing the prayer chain.)

// ── Flow A: Ang Paghingi ng Saklolo (composer) ──────────────────────────────

// Just a text/mic area, optional mood pills, and one Send button — no
// country picker. Country is stamped server-side from request.cf.country
// (see ask-proxy/worker.js), so the client never needs to ask or send one.
function composerHtml() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return `
    <div class="oc-pc-composer">
      <div class="oc-pc-input-row">
        <textarea id="oc-pc-input" class="oc-journal-input" rows="2" maxlength="500"
          placeholder="Anong dinadalangin mo ngayon, kapatid?"></textarea>
        ${SR ? `<button type="button" class="oc-icon-btn oc-pc-mic" id="oc-pc-mic" title="Tap to speak" aria-label="Tap to speak your prayer">🎤</button>` : ''}
      </div>
      <div class="oc-pc-tags" role="group" aria-label="Bulong — ano ang nararamdaman mo? (optional)">
        ${MOOD_TAGS.map(([id, label]) => `<button type="button" class="oc-chip oc-pc-tag" data-mood="${id}">${label}</button>`).join('')}
      </div>
      <button type="button" class="oc-primary-btn oc-pc-send" id="oc-pc-send">Ipadala 🕊️</button>
    </div>`;
}

function wireComposer(body) {
  selectedMood = null;
  body.querySelectorAll('.oc-pc-tag').forEach((chip) => {
    chip.addEventListener('click', () => {
      navigator.vibrate?.(8);
      const mood = chip.dataset.mood;
      selectedMood = selectedMood === mood ? null : mood;
      body.querySelectorAll('.oc-pc-tag').forEach((c) => c.classList.toggle('is-selected', c.dataset.mood === selectedMood));
    });
  });

  wireMic(body);

  body.querySelector('#oc-pc-send').addEventListener('click', async () => {
    const input = body.querySelector('#oc-pc-input');
    const content = input.value.trim();
    if (content.length < 5) { toast('Isulat mo lang nang kaunti pa, kapatid.'); return; }

    const btn = body.querySelector('#oc-pc-send');
    btn.disabled = true;
    btn.textContent = 'Ipinapadala…';
    try {
      const data = await api('/api/prayers', {
        method: 'POST',
        body: JSON.stringify({ content, moodTag: selectedMood || null }),
      });
      // Clear the form and smoothly prepend the new prayer to the feed.
      input.value = '';
      selectedMood = null;
      body.querySelectorAll('.oc-pc-tag').forEach((c) => c.classList.remove('is-selected'));
      const feed = body.querySelector('#oc-pc-feed');
      feed.insertAdjacentHTML('afterbegin', prayerCardHtml({ ...data.prayer, created_at: new Date().toISOString() }, false, true));
      const newBtn = feed.querySelector('[data-pray]');
      newBtn.addEventListener('click', () => handlePrayButtonClick(newBtn.dataset.pray));
      toast('Nasa kadena na — ipapanalangin ka namin. 🤍');
    } catch (err) {
      toast(`Hindi naipadala: ${err.message}`);
    }
    btn.disabled = false;
    btn.textContent = 'Ipadala 🕊️';
  });
}

// 🎤 Tap to speak — transcribes straight into the textarea for kapatid too
// tired to type after a long shift. Hidden entirely where unsupported.
function wireMic(body) {
  const micBtn = body.querySelector('#oc-pc-mic');
  if (!micBtn) return;
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const input = body.querySelector('#oc-pc-input');
  let recognition = null;

  micBtn.addEventListener('click', () => {
    if (recognition) { recognition.stop(); return; }
    recognition = new SR();
    recognition.lang = 'fil-PH';
    recognition.interimResults = true;
    recognition.continuous = false;

    micBtn.classList.add('is-listening');
    let finalText = '';

    recognition.onresult = (e) => {
      let interim = '';
      for (const result of e.results) {
        if (result.isFinal) finalText += result[0].transcript;
        else interim += result[0].transcript;
      }
      input.value = (finalText + interim).trim();
    };
    recognition.onerror = () => stopListening();
    recognition.onend = () => stopListening();
    recognition.start();
  });

  function stopListening() {
    recognition = null;
    micBtn.classList.remove('is-listening');
    input.focus();
  }
}

// ── Flow B: Ang Pag-Salo (feed cards) ────────────────────────────────────────

function counterSentence(count) {
  if (!count) return '';
  return `${count} na mga kapatid ang nanalangin para sa'yo.`;
}

function prayerCardHtml(p, alreadyPrayed, isNew = false) {
  const countryBadge = p.country_code
    ? `<span class="oc-pc-badge">${flagEmoji(p.country_code)} ${escapeHtml(p.country_name || p.country_code)}</span>`
    : `<span class="oc-pc-badge">🌏</span>`;
  const moodBadge = p.mood_tag && MOOD_LABELS[p.mood_tag] ? `<span class="oc-pc-badge oc-pc-badge-mood">${MOOD_LABELS[p.mood_tag]}</span>` : '';
  const count = p.prayer_count || 0;
  return `
    <div class="oc-pc-item${isNew ? ' oc-pc-item-new' : ''}" data-prayer-item="${escapeHtml(p.id)}">
      <div class="oc-pc-badges">
        ${moodBadge}${countryBadge}
        <span class="oc-pc-time">${escapeHtml(friendlyDate(String(p.created_at || '').slice(0, 10)))}</span>
      </div>
      <p class="oc-pc-content">${escapeHtml(p.content)}</p>
      <p class="oc-pc-counter" data-count data-n="${count}">${counterSentence(count)}</p>
      <button type="button" class="oc-pc-pray-btn${alreadyPrayed ? ' is-prayed' : ''}" data-pray="${escapeHtml(p.id)}" ${alreadyPrayed ? 'disabled' : ''}>
        ${alreadyPrayed ? '🕯️ Nanalangin ka na' : '🙏 Sinasamahan kita sa panalangin'}
      </button>
    </div>`;
}

// Optimistic UI: the instant a kapatid taps, the button becomes a glowing
// candle, the counter rises, and the SHA-256-hashed interaction is dispatched
// in the background. Everything rolls back if it cannot reach the chain.
async function handlePrayButtonClick(prayerId) {
  const item = container.querySelector(`[data-prayer-item="${CSS.escape(prayerId)}"]`);
  const btn = item.querySelector('[data-pray]');
  const countEl = item.querySelector('[data-count]');
  const previousCount = parseInt(countEl.dataset.n, 10) || 0;

  navigator.vibrate?.(8);
  btn.disabled = true;
  btn.classList.add('is-prayed', 'is-glowing');
  btn.textContent = '🕯️ Nanalangin ka na';
  countEl.dataset.n = String(previousCount + 1);
  countEl.textContent = counterSentence(previousCount + 1);
  const list = myPrayedList();
  if (!list.includes(prayerId)) { list.push(prayerId); savePrayedList(list); }

  try {
    const userHash = await interactionHash(prayerId);
    const data = await api('/api/prayers/pray', {
      method: 'POST',
      body: JSON.stringify({ prayerId, userHash }),
    });
    if (data.counted === false) {
      // Same kapatid, same prayer — the server lovingly kept the first one.
      toast(data.message || 'Sinalo na natin ito dati pa. 🤍');
      countEl.dataset.n = String(previousCount);
      countEl.textContent = counterSentence(previousCount);
    } else if (typeof data.prayerCount === 'number') {
      countEl.dataset.n = String(data.prayerCount);
      countEl.textContent = counterSentence(data.prayerCount);
    }
  } catch (err) {
    // Rollback — the tap didn't reach the chain.
    btn.disabled = false;
    btn.classList.remove('is-prayed', 'is-glowing');
    btn.textContent = '🙏 Sinasamahan kita sa panalangin';
    countEl.dataset.n = String(previousCount);
    countEl.textContent = counterSentence(previousCount);
    savePrayedList(myPrayedList().filter((id) => id !== prayerId));
    toast(`Hindi umabot, kapatid — subukan ulit. (${err.message})`);
  }
}
