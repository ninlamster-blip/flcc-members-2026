// Journal — daily wellbeing check-in (<30s), gentle insights, private entries
// with a reusable log: save, clear, and log again as many times as you like.
// The primary data source for the Wellness Brain (see js/agent-brain.js for
// the full five-brain map) — reflection-engine.js and growth-engine.js both
// read the check-ins and entries saved here.
import { getState, updateState, todaysCheckin, saveCheckin, addJournalEntry, updateJournalEntry, deleteJournalEntry, addRemittance, deleteRemittance, addBudgetEntry, deleteBudgetEntry, BUDGET_CATEGORIES } from './state.js';
import { wellbeingInsight, isConnected, getConnection } from './ai.js';
import { escapeHtml, friendlyDate, todayKey } from './utils.js';

const MOODS = [
  { value: 1, emoji: '😞' },
  { value: 2, emoji: '🙁' },
  { value: 3, emoji: '😐' },
  { value: 4, emoji: '🙂' },
  { value: 5, emoji: '😄' },
];

const SCALES = [
  { key: 'energy', label: 'Energy · Lakas' },
  { key: 'loneliness', label: 'Loneliness · Lungkot' },
  { key: 'hope', label: 'Hope · Pag-asa' },
];

let draft = {};
let toast = () => {};

export function initJournal(context) {
  toast = context.toast;
  renderCheckin();
  renderInsightCard();
  setupFreeWriting();
  renderEntries();
  setupRemittances();
  renderRemittances();
  setupBudget();
  renderBudget();
  initExchangeRate();
}

// Re-render when the tab is opened, so entries added elsewhere (e.g. a
// "truth to carry" saved from the Faith tab) appear immediately.
export function refreshJournal() {
  renderCheckin();
  renderInsightCard();
  renderEntries(document.getElementById('oc-journal-search').value.trim().toLowerCase());
  renderRemittances();
  renderBudget();
  initExchangeRate();
}

// ── Daily check-in ───────────────────────────────────────────────────────────

function renderCheckin() {
  const body = document.getElementById('oc-checkin-body');
  const done = todaysCheckin();
  if (done) {
    const moodEmoji = MOODS.find((m) => m.value === done.mood)?.emoji || '🙂';
    body.innerHTML = `
      <div class="oc-checkin-done">
        <span class="oc-big-check">${moodEmoji}</span>
        <div>
          Salamat — checked in for today.
          <div class="oc-checkin-summary">${done.gratitude ? `Grateful for: “${escapeHtml(done.gratitude)}”` : 'See you again tomorrow. Ingat ka.'}</div>
        </div>
      </div>`;
    return;
  }

  draft = { mood: 0, energy: 0, loneliness: 0, hope: 0, connected: null, gratitude: '' };
  body.innerHTML = `
    <div class="oc-checkin-row">
      <span class="oc-checkin-label">How is your heart? · Kumusta ang puso mo?</span>
      <div class="oc-mood-row" role="group" aria-label="Mood">
        ${MOODS.map((m) => `<button type="button" class="oc-mood-btn" data-mood="${m.value}" aria-label="Mood ${m.value} of 5">${m.emoji}</button>`).join('')}
      </div>
    </div>
    ${SCALES.map((s) => `
      <div class="oc-checkin-row">
        <span class="oc-checkin-label">${s.label}</span>
        <div class="oc-scale-row" role="group" aria-label="${s.label}, 1 low to 5 high">
          ${[1, 2, 3, 4, 5].map((n) => `<button type="button" class="oc-scale-dot" data-scale="${s.key}" data-value="${n}">${n}</button>`).join('')}
        </div>
      </div>`).join('')}
    <div class="oc-checkin-row">
      <span class="oc-checkin-label">Did you connect with someone today? · May nakausap ka ba?</span>
      <div class="oc-scale-row" role="group" aria-label="Connected with someone today?">
        <button type="button" class="oc-scale-dot" data-connected="yes">Oo 💬</button>
        <button type="button" class="oc-scale-dot" data-connected="no">Hindi pa</button>
      </div>
    </div>
    <div class="oc-checkin-row">
      <span class="oc-checkin-label">One small thing you're grateful for <span class="oc-muted">(optional)</span></span>
      <input type="text" class="oc-text-input" id="oc-gratitude" maxlength="120" placeholder="Kahit maliit lang…">
    </div>
    <button type="button" class="oc-primary-btn" id="oc-checkin-save" disabled>Save my check-in</button>`;

  const saveBtn = body.querySelector('#oc-checkin-save');
  const refresh = () => { saveBtn.disabled = !draft.mood; };

  body.querySelectorAll('.oc-mood-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigator.vibrate?.(8);
      draft.mood = Number(btn.dataset.mood);
      body.querySelectorAll('.oc-mood-btn').forEach((b) => b.classList.toggle('is-selected', b === btn));
      refresh();
    });
  });

  body.querySelectorAll('.oc-scale-dot[data-scale]').forEach((btn) => {
    btn.addEventListener('click', () => {
      draft[btn.dataset.scale] = Number(btn.dataset.value);
      body.querySelectorAll(`.oc-scale-dot[data-scale="${btn.dataset.scale}"]`)
        .forEach((b) => b.classList.toggle('is-selected', b === btn));
    });
  });

  body.querySelectorAll('.oc-scale-dot[data-connected]').forEach((btn) => {
    btn.addEventListener('click', () => {
      draft.connected = btn.dataset.connected === 'yes';
      body.querySelectorAll('.oc-scale-dot[data-connected]')
        .forEach((b) => b.classList.toggle('is-selected', b === btn));
    });
  });

  saveBtn.addEventListener('click', () => {
    draft.gratitude = body.querySelector('#oc-gratitude').value.trim();
    saveCheckin(draft);
    toast('Salamat sa pag-check-in 🤍');
    renderCheckin();
    renderInsightCard();
  });
}

// ── Gentle insights ──────────────────────────────────────────────────────────

function renderInsightCard() {
  const card = document.getElementById('oc-insight-card');
  const textEl = document.getElementById('oc-insight-text');
  const btn = document.getElementById('oc-insight-btn');
  const { checkins } = getState();

  if (checkins.length < 3) { card.hidden = true; return; }
  card.hidden = false;
  renderJourneyDots();
  textEl.textContent = localInsight();

  if (!isConnected()) { btn.hidden = true; return; }
  btn.hidden = false;
  btn.onclick = async () => {
    btn.disabled = true;
    btn.textContent = 'Reflecting…';
    try {
      textEl.textContent = await wellbeingInsight();
    } catch (err) {
      toast(`Hindi makakonekta: ${err.message}`);
    }
    btn.disabled = false;
    btn.textContent = 'Reflect on my week';
  };
}

// The last two weeks as a row of soft dots — a story at a glance, not a chart.
function renderJourneyDots() {
  const wrap = document.getElementById('oc-journey-dots');
  const byDate = new Map(getState().checkins.map((c) => [c.date, c]));
  const dots = [];
  for (let i = 13; i >= 0; i--) {
    const d = new Date(Date.now() - i * 86400000);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const c = byDate.get(key);
    const mood = c ? c.mood : 0;
    dots.push(`<span class="oc-dot oc-dot-${mood}" title="${key}${c ? ` · mood ${c.mood}/5` : ''}"></span>`);
  }
  wrap.innerHTML = dots.join('');
}

// A kind story of the season, told from the data — growth, not performance.
// Works fully offline and never diagnoses.
function localInsight() {
  const s = getState();
  const recent = s.checkins.slice(0, 7);
  const avg = (key) => recent.reduce((sum, c) => sum + (c[key] || 0), 0) / recent.length;
  const gratitudes = recent.filter((c) => c.gratitude).length;
  const connectedDays = recent.filter((c) => c.connected).length;
  const hardDays = recent.filter((c) => c.mood <= 2).length;

  const lines = [];
  if (hardDays >= 3 && gratitudes >= 2) {
    lines.push(`This week held ${hardDays} hard days — and still you found gratitude on ${gratitudes} of them. That is not a small thing; that is quiet strength.`);
  } else {
    lines.push(`You checked in ${recent.length} time${recent.length > 1 ? 's' : ''} this week — that's you taking care of your own heart.`);
    if (gratitudes >= 3) lines.push(`You recorded gratitude on ${gratitudes} days, kahit hindi laging madali.`);
  }
  if (s.bringing) lines.push('You brought something to Bible study this week — your faith is not standing still.');
  if (avg('loneliness') >= 3.5 && connectedDays <= 2) lines.push('Loneliness has been heavier lately. Maybe this week, one small connection — a call, a message, the Kapwa tab — could help.');
  else if (connectedDays >= 4) lines.push('You connected with people on most days — your heart tends to be lighter on those days.');
  if (avg('energy') <= 2.2) lines.push('Your energy has been low. Rest is not laziness — alagaan mo rin ang sarili mo.');
  if (avg('hope') >= 4) lines.push('Hope has been strong in you this week. 🌅');
  return lines.slice(0, 3).join(' ');
}

// ── Free writing ─────────────────────────────────────────────────────────────
// Reusable log: writing and saving never "locks" the editor — Save always
// leaves it ready to log again. Clicking a past entry loads it back in for
// editing; Save then updates that entry instead of creating a new one.

let editingId = null;

function setupFreeWriting() {
  const titleInput = document.getElementById('oc-journal-title');
  const input = document.getElementById('oc-journal-input');
  const saveBtn = document.getElementById('oc-journal-save');
  const clearBtn = document.getElementById('oc-journal-clear');

  saveBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return;
    const title = titleInput.value.trim();
    if (editingId) {
      updateJournalEntry(editingId, { title, text });
      toast('Entry updated 🔒');
    } else {
      addJournalEntry(text, title);
      toast('Saved — for your eyes only 🔒');
    }
    resetEditor();
    renderEntries(document.getElementById('oc-journal-search').value.trim().toLowerCase());
  });

  clearBtn.addEventListener('click', resetEditor);

  document.getElementById('oc-journal-search').addEventListener('input', (e) => {
    renderEntries(e.target.value.trim().toLowerCase());
  });
}

function resetEditor() {
  editingId = null;
  document.getElementById('oc-journal-title').value = '';
  document.getElementById('oc-journal-input').value = '';
  document.getElementById('oc-journal-editor-title').textContent = 'Write freely';
  document.getElementById('oc-journal-save').textContent = 'Save entry';
}

function loadEntryIntoEditor(entry) {
  editingId = entry.id;
  document.getElementById('oc-journal-title').value = entry.title || '';
  document.getElementById('oc-journal-input').value = entry.text;
  document.getElementById('oc-journal-editor-title').textContent = 'Editing entry';
  document.getElementById('oc-journal-save').textContent = 'Update entry';
  document.getElementById('oc-journal-input').scrollIntoView({ behavior: 'smooth', block: 'center' });
}

function renderEntries(query = '') {
  const list = document.getElementById('oc-journal-list');
  let entries = getState().journal;
  if (query) entries = entries.filter((e) =>
    e.text.toLowerCase().includes(query) || (e.title || '').toLowerCase().includes(query));

  if (!entries.length) {
    list.innerHTML = `<li class="oc-journal-entry oc-muted">${query ? 'No entries match your search.' : 'Your entries will appear here. Ang journal na ito ay sa\'yo lang.'}</li>`;
    return;
  }

  list.innerHTML = entries.slice(0, 100).map((e) => `
    <li class="oc-journal-entry${e.id === editingId ? ' oc-entry-editing' : ''}" data-entry="${e.id}">
      <div class="oc-entry-meta">
        <span>${friendlyDate(e.date)} · ${escapeHtml(e.time)}</span>
        <button type="button" class="oc-entry-delete" data-delete="${e.id}" aria-label="Delete this entry">✕</button>
      </div>
      ${e.title ? `<div class="oc-entry-title">${escapeHtml(e.title)}</div>` : ''}
      <div class="oc-entry-text">${escapeHtml(e.text)}</div>
    </li>`).join('');

  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (!confirm('Delete this entry forever?')) return;
      const wasEditing = btn.dataset.delete === editingId;
      deleteJournalEntry(btn.dataset.delete);
      if (wasEditing) resetEditor();
      renderEntries(query);
    });
  });

  list.querySelectorAll('[data-entry]').forEach((li) => {
    li.addEventListener('click', () => {
      const entry = getState().journal.find((e) => e.id === li.dataset.entry);
      if (entry) loadEntryIntoEditor(entry);
    });
  });
}

// ── Remittances (LIFE pillar) ────────────────────────────────────────────────
// Amounts are logged per their own currency and never converted or summed
// across currencies — a KWD total and a PHP total are different numbers
// that would be actively misleading added together.

// Same currency-defaulting rule as addRemittance() itself in state.js — an
// empty currency field means KWD, since that's the whole app's default.
function isKwdCurrency(value) {
  const trimmed = String(value || '').trim().toUpperCase();
  return trimmed === '' || trimmed === 'KWD';
}

// Live-updates the "≈ ₱X.XX" preview under the amount/currency row as a
// member types — using the same cached rate the exchange-rate chip already
// shows, so this needs no extra fetch of its own. Silently hides if the
// entered currency isn't KWD, the amount isn't a real number yet, or no
// rate has been fetched yet (offline on first-ever use, say).
function updatePhpPreview() {
  const preview = document.getElementById('oc-remit-php-preview');
  if (!preview) return;
  const amountInput = document.getElementById('oc-remit-amount');
  const currencyInput = document.getElementById('oc-remit-currency');
  const amount = Number(amountInput.value);
  const phpPerKwd = getState().exchangeRateCache?.phpPerKwd;

  if (!amount || amount <= 0 || !isKwdCurrency(currencyInput.value) || !phpPerKwd) {
    preview.hidden = true;
    return;
  }
  const php = amount * phpPerKwd;
  preview.textContent = `≈ ₱${php.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  preview.hidden = false;
}

function setupRemittances() {
  const amountInput = document.getElementById('oc-remit-amount');
  const currencyInput = document.getElementById('oc-remit-currency');
  amountInput.addEventListener('input', updatePhpPreview);
  currencyInput.addEventListener('input', updatePhpPreview);

  document.getElementById('oc-remit-save').addEventListener('click', () => {
    const noteInput = document.getElementById('oc-remit-note');
    if (!Number(amountInput.value) || Number(amountInput.value) <= 0) return;
    addRemittance({ amount: amountInput.value, currency: currencyInput.value, note: noteInput.value });
    amountInput.value = '';
    currencyInput.value = '';
    noteInput.value = '';
    updatePhpPreview();
    toast('Naitala ang padala mo 💸');
    renderRemittances();
  });
}

function remittanceThisMonthTotals() {
  const thisMonth = todayKey().slice(0, 7); // YYYY-MM
  const totals = {};
  for (const r of getState().remittances) {
    if (!r.date.startsWith(thisMonth)) continue;
    totals[r.currency] = (totals[r.currency] || 0) + r.amount;
  }
  return totals;
}

function renderRemittances() {
  const totalEl = document.getElementById('oc-remittance-total');
  const totals = remittanceThisMonthTotals();
  const totalParts = Object.entries(totals).map(([cur, amt]) => `${amt.toFixed(2)} ${cur}`);
  totalEl.textContent = totalParts.length ? `Ngayong buwan: ${totalParts.join(' · ')}` : 'Wala pang naitatala ngayong buwan.';

  const list = document.getElementById('oc-remittance-list');
  const items = getState().remittances;
  if (!items.length) {
    list.innerHTML = '<li class="oc-journal-entry oc-muted">Wala pang tala. Idagdag ang unang padala mo sa itaas.</li>';
    return;
  }
  list.innerHTML = items.slice(0, 100).map((r) => `
    <li class="oc-journal-entry" data-remit="${r.id}">
      <div class="oc-entry-meta">
        <span>${friendlyDate(r.date)} · ${r.amount.toFixed(2)} ${escapeHtml(r.currency)}</span>
        <button type="button" class="oc-entry-delete" data-delete-remit="${r.id}" aria-label="Delete this entry">✕</button>
      </div>
      ${r.note ? `<div class="oc-entry-text">${escapeHtml(r.note)}</div>` : ''}
    </li>`).join('');

  list.querySelectorAll('[data-delete-remit]').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (!confirm('Delete this entry forever?')) return;
      deleteRemittance(btn.dataset.deleteRemit);
      renderRemittances();
    });
  });
}

// ── Budget (LIFE pillar) ──────────────────────────────────────────────────────
// A fuller picture than the padala log alone: income plus categorized
// expenses. Same per-currency, never-summed-across-currencies rule as the
// remittance log above.

let budgetType = 'income';

function setupBudget() {
  const incomeBtn = document.getElementById('oc-budget-type-income');
  const expenseBtn = document.getElementById('oc-budget-type-expense');
  const categorySelect = document.getElementById('oc-budget-category');

  if (!categorySelect.options.length) {
    categorySelect.innerHTML = BUDGET_CATEGORIES.map((c) => `<option value="${c}">${c}</option>`).join('');
  }

  const setType = (type) => {
    budgetType = type;
    incomeBtn.classList.toggle('is-selected', type === 'income');
    expenseBtn.classList.toggle('is-selected', type === 'expense');
    categorySelect.hidden = type !== 'expense';
  };
  incomeBtn.addEventListener('click', () => setType('income'));
  expenseBtn.addEventListener('click', () => setType('expense'));

  document.getElementById('oc-budget-save').addEventListener('click', () => {
    const amountInput = document.getElementById('oc-budget-amount');
    const currencyInput = document.getElementById('oc-budget-currency');
    const noteInput = document.getElementById('oc-budget-note');
    if (!Number(amountInput.value) || Number(amountInput.value) <= 0) return;
    addBudgetEntry({
      type: budgetType,
      category: categorySelect.value,
      amount: amountInput.value,
      currency: currencyInput.value,
      note: noteInput.value,
    });
    amountInput.value = '';
    currencyInput.value = '';
    noteInput.value = '';
    toast(budgetType === 'income' ? 'Naitala ang kita mo 💰' : 'Naitala ang gastos mo 📝');
    renderBudget();
  });
}

function budgetThisMonthTotals() {
  const thisMonth = todayKey().slice(0, 7); // YYYY-MM
  const income = {};
  const expense = {};
  for (const e of getState().budgetEntries) {
    if (!e.date.startsWith(thisMonth)) continue;
    const bucket = e.type === 'income' ? income : expense;
    bucket[e.currency] = (bucket[e.currency] || 0) + e.amount;
  }
  return { income, expense };
}

function renderBudget() {
  const summaryEl = document.getElementById('oc-budget-summary');
  const { income, expense } = budgetThisMonthTotals();
  const currencies = new Set([...Object.keys(income), ...Object.keys(expense)]);
  const lines = [...currencies].map((cur) => {
    const inc = income[cur] || 0;
    const exp = expense[cur] || 0;
    return `${cur}: +${inc.toFixed(2)} / -${exp.toFixed(2)} = ${(inc - exp).toFixed(2)}`;
  });
  summaryEl.textContent = lines.length ? `Ngayong buwan — ${lines.join(' · ')}` : 'Wala pang naitatala ngayong buwan.';

  const list = document.getElementById('oc-budget-list');
  const items = getState().budgetEntries;
  if (!items.length) {
    list.innerHTML = '<li class="oc-journal-entry oc-muted">Wala pang tala. Idagdag ang una mong kita o gastos sa itaas.</li>';
    return;
  }
  list.innerHTML = items.slice(0, 100).map((e) => `
    <li class="oc-journal-entry" data-budget="${e.id}">
      <div class="oc-entry-meta">
        <span>${friendlyDate(e.date)} · ${e.type === 'income' ? '+' : '-'}${e.amount.toFixed(2)} ${escapeHtml(e.currency)}${e.category ? ` · ${escapeHtml(e.category)}` : ''}</span>
        <button type="button" class="oc-entry-delete" data-delete-budget="${e.id}" aria-label="Delete this entry">✕</button>
      </div>
      ${e.note ? `<div class="oc-entry-text">${escapeHtml(e.note)}</div>` : ''}
    </li>`).join('');

  list.querySelectorAll('[data-delete-budget]').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (!confirm('Delete this entry forever?')) return;
      deleteBudgetEntry(btn.dataset.deleteBudget);
      renderBudget();
    });
  });
}

// ── Exchange rate (Al Muzaini Exchange's own posted rate) ────────────────────
// KWD → PHP specifically, not a generic converter — this church's members
// are Kuwait-based (see README), so that's the one rate actually relevant
// on the padala card, same "one clearly useful thing, not a general tool"
// instinct as the rest of this app. Fetched via the church Worker's GET
// /exchange-rate (same apiBase() pattern as prayerchain.js/notifications.js —
// an unset proxy URL just means "this same site"), which scrapes Al
// Muzaini's actual counter rate server-side (a browser fetch straight to
// muzaini.com would hit CORS) and falls back to a generic mid-market rate
// on its own if that scrape ever fails — so this stays simple and doesn't
// need its own fallback logic. Same cache-then-refresh pattern as
// sanctuary.js's weather chip.
function apiBase() {
  const { proxyUrl } = getConnection();
  return proxyUrl ? proxyUrl.replace(/\/+$/, '') : '';
}

async function fetchExchangeRate() {
  const res = await fetch(apiBase() + '/exchange-rate');
  if (!res.ok) throw new Error('rate unavailable');
  const data = await res.json();
  if (!data.phpPerKwd) throw new Error('rate unavailable');
  return { phpPerKwd: data.phpPerKwd, source: data.source };
}

async function initExchangeRate() {
  const el = document.getElementById('oc-exchange-rate');
  if (!el) return;

  const show = (phpPerKwd, source) => {
    const label = source === 'muzaini' ? 'Al Muzaini' : 'pandaigdigang rate';
    el.innerHTML = `💱 Ngayon: 1 KWD ≈ ₱${phpPerKwd.toFixed(2)} (${label})`
      + `<div class="oc-exchange-rate-disclaimer">Tinatayang halaga lamang — maaaring iba sa aktwal na rate sa exchange house.</div>`;
    el.hidden = false;
    updatePhpPreview(); // the rate just became available (or changed) — refresh the live conversion too
  };

  const cached = getState().exchangeRateCache;
  if (cached && Date.now() - cached.at < 45 * 60 * 1000) { show(cached.phpPerKwd, cached.source); return; }
  if (cached) show(cached.phpPerKwd, cached.source); // stale is better than blank while we refresh
  else el.hidden = true; // nothing to show yet — don't leave an unrelated earlier render's state lingering

  try {
    const { phpPerKwd, source } = await fetchExchangeRate();
    updateState((st) => { st.exchangeRateCache = { at: Date.now(), phpPerKwd, source }; });
    show(phpPerKwd, source);
  } catch { /* offline — the cached or hidden line stands */ }
}
