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
const COUNTRY_KEY = 'flcc-kasama-country';

const MOOD_TAGS = [
  ['lungkot', '💧 Lungkot'],
  ['kaba', '😰 Kaba'],
  ['pagod', '😮‍💨 Pagod'],
  ['salamat', '🌼 Salamat'],
];
const MOOD_LABELS = Object.fromEntries(MOOD_TAGS);

const COUNTRIES = [
  ['KWT', '🇰🇼 Kuwait'], ['SAU', '🇸🇦 K.S.A.'], ['ARE', '🇦🇪 U.A.E.'], ['QAT', '🇶🇦 Qatar'],
  ['BHR', '🇧🇭 Bahrain'], ['OMN', '🇴🇲 Oman'], ['HKG', '🇭🇰 Hong Kong'], ['SGP', '🇸🇬 Singapore'],
  ['TWN', '🇹🇼 Taiwan'], ['JPN', '🇯🇵 Japan'], ['ITA', '🇮🇹 Italy'], ['PHL', '🇵🇭 Pilipinas'], ['OTH', '🌏 Iba pa'],
];
const COUNTRY_FLAGS = Object.fromEntries(COUNTRIES.map(([code, label]) => [code, label.split(' ')[0]]));

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

function apiBase() {
  const { proxyUrl } = getConnection();
  return proxyUrl ? proxyUrl.replace(/\/+$/, '') : '';
}

async function api(path, options = {}) {
  const base = apiBase();
  if (!base) return { configured: false };
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

// ── Flow A: Ang Paghingi ng Saklolo (composer) ──────────────────────────────

function composerHtml() {
  const savedCountry = localStorage.getItem(COUNTRY_KEY) || 'KWT';
  return `
    <div class="oc-pc-composer">
      <textarea id="oc-pc-input" class="oc-journal-input" rows="2" maxlength="500"
        placeholder="Anong dinadalangin mo ngayon, kapatid?"></textarea>
      <div class="oc-pc-tags" role="group" aria-label="Ano ang nararamdaman mo? (optional)">
        ${MOOD_TAGS.map(([id, label]) => `<button type="button" class="oc-chip oc-pc-tag" data-mood="${id}">${label}</button>`).join('')}
      </div>
      <div class="oc-pc-composer-row">
        <select id="oc-pc-country" class="oc-pc-country" aria-label="Saan ka nagtatrabaho?">
          ${COUNTRIES.map(([code, label]) => `<option value="${code}" ${code === savedCountry ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <button type="button" class="oc-primary-btn oc-pc-send" id="oc-pc-send">Ipadala 🕊️</button>
      </div>
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

  body.querySelector('#oc-pc-send').addEventListener('click', async () => {
    const input = body.querySelector('#oc-pc-input');
    const country = body.querySelector('#oc-pc-country').value;
    const content = input.value.trim();
    if (content.length < 5) { toast('Isulat mo lang nang kaunti pa, kapatid.'); return; }
    try { localStorage.setItem(COUNTRY_KEY, country); } catch { /* fine */ }

    const btn = body.querySelector('#oc-pc-send');
    btn.disabled = true;
    btn.textContent = 'Ipinapadala…';
    try {
      const data = await api('/api/prayers', {
        method: 'POST',
        body: JSON.stringify({
          content,
          moodTag: selectedMood || null,
          countryCode: country === 'OTH' ? null : country,
        }),
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

// ── Flow B: Ang Pag-Salo (feed cards) ────────────────────────────────────────

function counterSentence(count) {
  if (!count) return '';
  return `${count} na mga kapatid ang nanalangin para sa'yo.`;
}

function prayerCardHtml(p, alreadyPrayed, isNew = false) {
  const flag = COUNTRY_FLAGS[p.country_code] || '🌏';
  const countryBadge = p.country_code ? `<span class="oc-pc-badge">${flag} ${escapeHtml(p.country_code)}</span>` : `<span class="oc-pc-badge">🌏</span>`;
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
