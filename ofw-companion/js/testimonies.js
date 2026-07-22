// Mga Sagot sa Panalangin — the Kapwa tab's answered-prayer feed. Community
// Brain (see js/agent-brain.js for the full five-brain map), alongside
// prayerchain.js.
//
// Deliberately read/react only — no free-text composer here. A testimony
// only ever originates from a member's own personal, on-device prayer log
// once marked answered (js/faith.js's "Sagot na?" flow), which offers to
// share it here as encouragement. That keeps this feed genuinely tied to
// real answered prayers instead of becoming a second general posting board.
//
// Reaction ("🙌 Papuri!") is deduplicated the same un-linkable way the
// prayer chain's "pray" tap already is — reusing prayerchain.js's own
// device-uuid + SHA-256 hash helper rather than a second copy of it.
import { getConnection } from './ai.js';
import { escapeHtml, friendlyDate } from './utils.js';
import { interactionHash } from './prayerchain.js';

const PRAISED_KEY = 'flcc-kasama-my-praised-list';

function readIdList(key) {
  try { return JSON.parse(localStorage.getItem(key)) || []; } catch { return []; }
}
function writeIdList(key, list) {
  try { localStorage.setItem(key, JSON.stringify(list.slice(-500))); } catch { /* best effort */ }
}
const myPraisedList = () => readIdList(PRAISED_KEY);
const savePraisedList = (list) => writeIdList(PRAISED_KEY, list);

function flagEmoji(code) {
  if (!/^[A-Z]{2}$/.test(code || '')) return '🌏';
  return String.fromCodePoint(...[...code].map((c) => 0x1f1e6 + (c.charCodeAt(0) - 65)));
}

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

let toast = () => {};
let container = null;

export function initTestimonies(context) {
  toast = context.toast;
  container = document.getElementById('oc-testimonies');
  if (!container) return;
  render();
}

async function render() {
  container.innerHTML = `
    <h2 class="oc-section-title">🙌 Mga Sagot sa Panalangin</h2>
    <p class="oc-muted" style="margin-bottom:12px">Mga panalanging sinagot ng Diyos, ibinahagi ng mga kapatid bilang inspirasyon. Mula sa "Aking mga panalangin" sa Faith tab — markahan lang na sinagot na, at may pagkakataon kang ibahagi rito.</p>
    <div id="oc-tm-body"><p class="oc-muted">Binubuksan…</p></div>`;
  const body = container.querySelector('#oc-tm-body');

  let data;
  try {
    data = await api('/api/testimonies');
  } catch (err) {
    body.innerHTML = `<p class="oc-muted">Hindi maabot ngayon (${escapeHtml(err.message)}). Subukan ulit mamaya.</p>`;
    return;
  }

  if (!data.configured) {
    body.innerHTML = `<p class="oc-muted">🌱 Malapit na: inihahanda pa ng church ang bahaging ito.</p>`;
    return;
  }

  const praised = new Set(myPraisedList());
  const testimonies = data.testimonies || [];
  body.innerHTML = testimonies.length
    ? testimonies.map((t) => testimonyCardHtml(t, praised.has(t.id))).join('')
    : '<p class="oc-muted">Wala pang naibahagi — sa susunod na sagutin ang panalangin mo, ikaw ang mauna, kapatid. 🤍</p>';

  body.querySelectorAll('[data-praise]').forEach((btn) => {
    btn.addEventListener('click', () => handlePraiseClick(btn.dataset.praise));
  });
}

function praiseSentence(count) {
  if (!count) return '';
  return `${count} na kapatid ang sumama sa papuri.`;
}

function testimonyCardHtml(t, alreadyPraised) {
  const countryBadge = t.country_code
    ? `<span class="oc-pc-badge">${flagEmoji(t.country_code)} ${escapeHtml(t.country_name || t.country_code)}</span>`
    : `<span class="oc-pc-badge">🌏</span>`;
  const count = t.praise_count || 0;
  const nameLine = t.first_name || t.origin_country
    ? `<p class="oc-pc-name">${t.first_name ? escapeHtml(t.first_name) : 'Isang kapatid'}${t.origin_country ? ` · ${escapeHtml(t.origin_country)}` : ''}</p>`
    : '';
  return `
    <div class="oc-pc-item" data-testimony-item="${escapeHtml(t.id)}">
      <div class="oc-pc-badges">
        ${countryBadge}
        <span class="oc-pc-time">${escapeHtml(friendlyDate(String(t.created_at || '').slice(0, 10)))}</span>
      </div>
      ${nameLine}
      <p class="oc-pc-content">${escapeHtml(t.content)}</p>
      <p class="oc-pc-counter" data-count data-n="${count}">${praiseSentence(count)}</p>
      <button type="button" class="oc-pc-pray-btn${alreadyPraised ? ' is-prayed' : ''}" data-praise="${escapeHtml(t.id)}" ${alreadyPraised ? 'disabled' : ''}>
        ${alreadyPraised ? '🙌 Sumama ka na' : '🙌 Papuri!'}
      </button>
    </div>`;
}

async function handlePraiseClick(testimonyId) {
  const item = container.querySelector(`[data-testimony-item="${CSS.escape(testimonyId)}"]`);
  const btn = item.querySelector('[data-praise]');
  const countEl = item.querySelector('[data-count]');
  const previousCount = parseInt(countEl.dataset.n, 10) || 0;

  navigator.vibrate?.(8);
  btn.disabled = true;
  btn.classList.add('is-prayed', 'is-glowing');
  btn.textContent = '🙌 Sumama ka na';
  countEl.dataset.n = String(previousCount + 1);
  countEl.textContent = praiseSentence(previousCount + 1);
  const list = myPraisedList();
  if (!list.includes(testimonyId)) { list.push(testimonyId); savePraisedList(list); }

  try {
    const userHash = await interactionHash(testimonyId);
    const data = await api('/api/testimonies/praise', {
      method: 'POST',
      body: JSON.stringify({ testimonyId, userHash }),
    });
    if (data.counted === false) {
      countEl.dataset.n = String(previousCount);
      countEl.textContent = praiseSentence(previousCount);
    } else if (typeof data.praiseCount === 'number') {
      countEl.dataset.n = String(data.praiseCount);
      countEl.textContent = praiseSentence(data.praiseCount);
    }
  } catch (err) {
    btn.disabled = false;
    btn.classList.remove('is-prayed', 'is-glowing');
    btn.textContent = '🙌 Papuri!';
    countEl.dataset.n = String(previousCount);
    countEl.textContent = praiseSentence(previousCount);
    savePraisedList(myPraisedList().filter((id) => id !== testimonyId));
    toast(`Hindi umabot — subukan ulit. (${err.message})`);
  }
}

// Shares one already-answered personal prayer request (js/faith.js) into
// this feed. Kept here (not in faith.js) so the API/interaction-hash
// plumbing for testimonies lives in exactly one place.
export async function shareTestimony({ content, firstName, originCountry }) {
  return api('/api/testimonies', {
    method: 'POST',
    body: JSON.stringify({ content, firstName, originCountry }),
  });
}
