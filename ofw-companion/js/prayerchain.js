// Kadena ng Panalangin — the prayer stream on the Kapwa tab. The Community
// Brain (see js/agent-brain.js for the full five-brain map), alongside
// community.js.
//
// Two flows:
//   A. Ang Paghingi ng Saklolo — leave a request, with your first name and
//      country of origin attached (both optional — a member can still send
//      one without them, but there's no name/country picker to hide behind
//      by default).
//   B. Ang Pag-Salo — carry a kapatid in prayer: one tap, the button becomes
//      a glowing candle, and the count of praying kapatid rises.
//
// Business rule: a member never sees their own request in their own feed —
// requests they've sent are filtered out client-side by id (see
// myOwnPrayerIds below), never shown back and never tappable to "pray" on.
//
// Interactions (the "pray" tap) are still deduplicated with an un-linkable
// SHA-256 of a random device id + the prayer id, computed right here on the
// device — that stays true regardless of whether a name is attached.
import { getConnection } from './ai.js';
import { getState } from './state.js';
import { escapeHtml, friendlyDate, firstNameOf, uid } from './utils.js';

const DEVICE_KEY = 'flcc-kasama-device-uuid';
const PRAYED_KEY = 'flcc-kasama-my-prayed-list';
const MY_PRAYERS_KEY = 'flcc-kasama-my-own-prayers';
const SEEN_KEY = 'flcc-kasama-last-seen-prayer-at';

// Historical mood tags — no longer collectible from the composer (removed
// to declutter), but still rendered on older entries that have one saved.
const MOOD_LABELS = { lungkot: '💧 Lungkot', kaba: '😰 Kaba', pagod: '😮‍💨 Pagod' };

// Regional-indicator flag emoji built from any ISO 3166-1 alpha-2 code —
// no lookup table needed, works for whatever country Cloudflare reports.
function flagEmoji(code) {
  if (!/^[A-Z]{2}$/.test(code || '')) return '🌏';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)));
}

let toast = () => {};
let container = null;

// ── Device-local lists ───────────────────────────────────────────────────────

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

// SHA-256 hex of deviceUuid + prayerId — un-linkable to a person, used only
// so one device can't inflate a "praying for you" count by tapping twice.
export async function interactionHash(prayerId) {
  const data = new TextEncoder().encode(`${deviceUuid()}:${prayerId}`);
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function readIdList(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}
function writeIdList(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list.slice(-500))); } catch { /* best effort */ }
}

const myPrayedList = () => readIdList(PRAYED_KEY);
const savePrayedList = (list) => writeIdList(PRAYED_KEY, list);

// The ids of prayers *this device* has submitted — used purely to filter a
// member's own requests out of their own feed. Never sent to the server.
const myOwnPrayerIds = () => readIdList(MY_PRAYERS_KEY);
function rememberMyOwnPrayer(id) {
  const list = myOwnPrayerIds();
  if (!list.includes(id)) { list.push(id); writeIdList(MY_PRAYERS_KEY, list); }
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

// ── "New prayer since your last visit" badge + banner ───────────────────────
// SQLite's datetime('now') format ("YYYY-MM-DD HH:MM:SS") sorts correctly as
// plain strings, so no date parsing is needed to compare freshness.
function updateUnreadIndicators(hasUnseen) {
  const badge = document.getElementById('oc-kapwa-badge');
  if (badge) badge.hidden = !hasUnseen;
  const alert = document.getElementById('oc-pc-alert');
  if (alert) alert.hidden = !hasUnseen;
}

// Called when the member actually opens the Kapwa tab.
export function markPrayersSeen() {
  updateUnreadIndicators(false);
  try {
    if (latestSeenCandidate) localStorage.setItem(SEEN_KEY, latestSeenCandidate);
  } catch { /* best effort */ }
}

let latestSeenCandidate = null;

async function render() {
  container.innerHTML = `
    <h2 class="oc-section-title">🕊️ Kadena ng Panalangin</h2>
    <p class="oc-muted" style="margin-bottom:12px">Panalangin mula sa mga kapatid — kasama ang pangalan at bansang pinagmulan nila, para mas personal. Hindi mo makikita ang sarili mong mga kahilingan dito.</p>
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
  const myOwnIds = new Set(myOwnPrayerIds());
  // Business rule: never show a member their own submitted requests.
  const prayers = (data.prayers || []).filter((p) => !myOwnIds.has(p.id));

  const seen = localStorage.getItem(SEEN_KEY) || '';
  latestSeenCandidate = prayers[0]?.created_at || null;
  const hasUnseen = prayers.some((p) => (p.created_at || '') > seen);

  body.innerHTML = `
    <div class="oc-pc-alert" id="oc-pc-alert" role="status" aria-live="polite" ${hasUnseen ? '' : 'hidden'}>🔔 May mga bagong panalangin mula sa kapwa OFW</div>
    ${composerHtml()}
    <div id="oc-pc-feed">
      ${prayers.length
        ? prayers.map((p) => prayerCardHtml(p, prayed.has(p.id))).join('')
        : '<p class="oc-muted" style="margin-top:10px">Wala pang laman ang kadena — ikaw ang mauna, kapatid. 🤍</p>'}
    </div>`;

  updateUnreadIndicators(hasUnseen);
  body.querySelector('#oc-pc-alert')?.addEventListener('click', () => markPrayersSeen());

  wireComposer(body);
  body.querySelectorAll('[data-pray]').forEach((btn) => {
    btn.addEventListener('click', () => handlePrayButtonClick(btn.dataset.pray));
  });
}

// (Push-notification opt-in now lives in Settings — see app.js — since it's
// a device preference, not something tied to viewing the prayer chain.)

// ── Flow A: Ang Paghingi ng Saklolo (composer) ──────────────────────────────

// A text/mic area and one explicit Send button — no mood pills. Country
// (working location) is stamped server-side from request.cf.country (see
// ask-proxy/worker.js); first name and country of origin come from the
// member's profile (set in onboarding/Settings) and ride along with the
// submission itself.
function composerHtml() {
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  return `
    <div class="oc-pc-composer">
      <div class="oc-pc-input-row">
        <textarea id="oc-pc-input" class="oc-journal-input" rows="2" maxlength="500"
          placeholder="Anong dinadalangin mo ngayon, kapatid?"></textarea>
        ${SR ? `<button type="button" class="oc-icon-btn oc-pc-mic" id="oc-pc-mic" title="Tap to speak" aria-label="Tap to speak your prayer">🎤</button>` : ''}
      </div>
      <button type="button" class="oc-primary-btn oc-pc-send" id="oc-pc-send">Ipadala</button>
    </div>`;
}

function wireComposer(body) {
  wireMic(body);

  body.querySelector('#oc-pc-send').addEventListener('click', async () => {
    const input = body.querySelector('#oc-pc-input');
    const content = input.value.trim();
    if (content.length < 5) { toast('Isulat mo lang nang kaunti pa, kapatid.'); return; }

    const btn = body.querySelector('#oc-pc-send');
    btn.disabled = true;
    btn.textContent = 'Ipinapadala…';
    try {
      const { profile } = getState();
      const data = await api('/api/prayers', {
        method: 'POST',
        body: JSON.stringify({
          content,
          firstName: firstNameOf(profile.name),
          originCountry: profile.country || '',
        }),
      });
      input.value = '';
      // A member never sees their own requests in their own feed — so the
      // new prayer is remembered locally, not inserted into the visible feed.
      rememberMyOwnPrayer(data.prayer.id);
      toast('Nasa kadena na — ipapanalangin ka namin. 🤍');
    } catch (err) {
      toast(`Hindi naipadala: ${err.message}`);
    }
    btn.disabled = false;
    btn.textContent = 'Ipadala';
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
    recognition.lang = 'tl-PH';
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
  const nameLine = p.first_name || p.origin_country
    ? `<p class="oc-pc-name">${p.first_name ? escapeHtml(p.first_name) : 'Isang kapatid'}${p.origin_country ? ` · ${escapeHtml(p.origin_country)}` : ''}</p>`
    : '';
  return `
    <div class="oc-pc-item${isNew ? ' oc-pc-item-new' : ''}" data-prayer-item="${escapeHtml(p.id)}">
      <div class="oc-pc-badges">
        ${moodBadge}${countryBadge}
        <span class="oc-pc-time">${escapeHtml(friendlyDate(String(p.created_at || '').slice(0, 10)))}</span>
      </div>
      ${nameLine}
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
