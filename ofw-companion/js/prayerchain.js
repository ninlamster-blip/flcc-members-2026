// Kadena ng Panalangin — the anonymous prayer chain on the Kapwa tab.
// Kapatid around the world leave a prayer request; others tap
// "Sinasamahan kita sa panalangin" and the count rises. No names, no
// accounts: interactions are deduplicated with an un-linkable SHA-256 of a
// random device id + the prayer id, computed right here on the device.
import { getConnection } from './ai.js';
import { escapeHtml, friendlyDate, uid } from './utils.js';

const DEVICE_KEY = 'flcc-kasama-device-uuid';
const PRAYED_KEY = 'flcc-kasama-my-prayed-list';
const COUNTRY_KEY = 'flcc-kasama-country';

const COUNTRIES = [
  ['KWT', '🇰🇼 Kuwait'], ['SAU', '🇸🇦 K.S.A.'], ['ARE', '🇦🇪 U.A.E.'], ['QAT', '🇶🇦 Qatar'],
  ['BHR', '🇧🇭 Bahrain'], ['OMN', '🇴🇲 Oman'], ['HKG', '🇭🇰 Hong Kong'], ['SGP', '🇸🇬 Singapore'],
  ['TWN', '🇹🇼 Taiwan'], ['JPN', '🇯🇵 Japan'], ['ITA', '🇮🇹 Italy'], ['PHL', '🇵🇭 Pilipinas'], ['OTH', '🌏 Iba pa'],
];

const COUNTRY_FLAGS = Object.fromEntries(COUNTRIES.map(([code, label]) => [code, label.split(' ')[0]]));

let toast = () => {};
let container = null;

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

// ── UI ───────────────────────────────────────────────────────────────────────

export function initPrayerChain(context) {
  toast = context.toast;
  container = document.getElementById('oc-prayer-chain');
  render();
}

async function render() {
  container.innerHTML = `
    <h2 class="oc-section-title">🕊️ Kadena ng Panalangin</h2>
    <p class="oc-muted" style="margin-bottom:10px">Mag-iwan ng anonymous na prayer request, at samahan sa panalangin ang ibang kapatid sa buong mundo. Walang pangalan, walang husga.</p>
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
    ${renderComposer()}
    ${prayers.length
      ? prayers.map((p) => renderPrayer(p, prayed.has(p.id))).join('')
      : '<p class="oc-muted" style="margin-top:8px">Wala pang laman ang kadena — ikaw ang mauna, kapatid. 🤍</p>'}`;

  wireComposer(body);
  body.querySelectorAll('[data-pray]').forEach((btn) => {
    btn.addEventListener('click', () => onPray(btn));
  });
}

function renderComposer() {
  const saved = localStorage.getItem(COUNTRY_KEY) || 'KWT';
  return `
    <div class="oc-pc-composer">
      <textarea id="oc-pc-input" class="oc-journal-input" rows="2" maxlength="500"
        placeholder="Ano ang maipapanalangin namin para sa'yo, kapatid? (anonymous)"></textarea>
      <div class="oc-pc-composer-row">
        <select id="oc-pc-country" class="oc-pc-country" aria-label="Saan ka nagtatrabaho?">
          ${COUNTRIES.map(([code, label]) => `<option value="${code}" ${code === saved ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <button type="button" class="oc-ghost-btn" id="oc-pc-send">Idagdag sa kadena</button>
      </div>
    </div>`;
}

function renderPrayer(p, alreadyPrayed) {
  const flag = COUNTRY_FLAGS[p.country_code] || '🌏';
  const count = p.prayer_count || 0;
  return `
    <div class="oc-pc-item" data-prayer-item="${escapeHtml(p.id)}">
      <p class="oc-pc-content">${escapeHtml(p.content)}</p>
      <div class="oc-pc-meta">
        <span>${flag} · ${friendlyDate(String(p.created_at || '').slice(0, 10))}</span>
        <span class="oc-pc-count" data-count>${count ? `🙏 ${count} kapatid` : ''}</span>
      </div>
      <button type="button" class="oc-pc-pray-btn${alreadyPrayed ? ' is-prayed' : ''}" data-pray="${escapeHtml(p.id)}" ${alreadyPrayed ? 'disabled' : ''}>
        ${alreadyPrayed ? '🤍 Sinamahan mo na siya sa panalangin' : '🙏 Sinasamahan kita sa panalangin'}
      </button>
    </div>`;
}

function wireComposer(body) {
  body.querySelector('#oc-pc-send')?.addEventListener('click', async () => {
    const input = body.querySelector('#oc-pc-input');
    const country = body.querySelector('#oc-pc-country').value;
    const content = input.value.trim();
    if (content.length < 5) { toast('Isulat mo lang nang kaunti pa, kapatid.'); return; }
    try { localStorage.setItem(COUNTRY_KEY, country); } catch { /* fine */ }
    const btn = body.querySelector('#oc-pc-send');
    btn.disabled = true;
    try {
      await api('/api/prayers', {
        method: 'POST',
        body: JSON.stringify({ content, countryCode: country === 'OTH' ? null : country }),
      });
      toast('Nasa kadena na — ipapanalangin ka namin. 🤍');
      render();
    } catch (err) {
      toast(`Hindi naipadala: ${err.message}`);
      btn.disabled = false;
    }
  });
}

// Optimistic UI: count rises and the button softens the instant it's tapped;
// everything rolls back if the request cannot reach the chain.
async function onPray(btn) {
  const prayerId = btn.dataset.pray;
  const item = container.querySelector(`[data-prayer-item="${CSS.escape(prayerId)}"]`);
  const countEl = item.querySelector('[data-count]');
  const previous = { text: btn.textContent, count: countEl.textContent };
  const shown = parseInt((countEl.textContent.match(/\d+/) || [0])[0], 10);

  navigator.vibrate?.(8);
  btn.disabled = true;
  btn.classList.add('is-prayed');
  btn.textContent = '🤍 Sinamahan mo na siya sa panalangin';
  countEl.textContent = `🙏 ${shown + 1} kapatid`;
  const list = myPrayedList();
  if (!list.includes(prayerId)) { list.push(prayerId); savePrayedList(list); }

  try {
    const userHash = await interactionHash(prayerId);
    const data = await api('/api/prayers/pray', {
      method: 'POST',
      body: JSON.stringify({ prayerId, userHash }),
    });
    if (data.counted === false) {
      // Another day, same kapatid — the server lovingly kept the first one.
      toast(data.message || 'Sinalo na natin ito dati pa. 🤍');
      countEl.textContent = previous.count;
    } else if (typeof data.prayerCount === 'number') {
      countEl.textContent = `🙏 ${data.prayerCount} kapatid`;
    }
  } catch (err) {
    // Rollback — the tap didn't reach the chain.
    btn.disabled = false;
    btn.classList.remove('is-prayed');
    btn.textContent = previous.text;
    countEl.textContent = previous.count;
    savePrayedList(myPrayedList().filter((id) => id !== prayerId));
    toast(`Hindi umabot, kapatid — subukan ulit. (${err.message})`);
  }
}
