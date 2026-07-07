// Journal — daily wellbeing check-in (<30s), gentle insights, private entries.
import { getState, todaysCheckin, saveCheckin, addJournalEntry, deleteJournalEntry } from './state.js';
import { wellbeingInsight, isConnected } from './ai.js';
import { escapeHtml, friendlyDate } from './utils.js';

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
}

// Re-render when the tab is opened, so entries added elsewhere (e.g. a
// "truth to carry" saved from the Faith tab) appear immediately.
export function refreshJournal() {
  renderCheckin();
  renderInsightCard();
  renderEntries(document.getElementById('oc-journal-search').value.trim().toLowerCase());
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

function setupFreeWriting() {
  const input = document.getElementById('oc-journal-input');
  const saveBtn = document.getElementById('oc-journal-save');
  saveBtn.addEventListener('click', () => {
    const text = input.value.trim();
    if (!text) return;
    addJournalEntry(text);
    input.value = '';
    toast('Saved — for your eyes only 🔒');
    renderEntries();
  });

  document.getElementById('oc-journal-search').addEventListener('input', (e) => {
    renderEntries(e.target.value.trim().toLowerCase());
  });
}

function renderEntries(query = '') {
  const list = document.getElementById('oc-journal-list');
  let entries = getState().journal;
  if (query) entries = entries.filter((e) => e.text.toLowerCase().includes(query));

  if (!entries.length) {
    list.innerHTML = `<li class="oc-journal-entry oc-muted">${query ? 'No entries match your search.' : 'Your entries will appear here. Ang journal na ito ay sa\'yo lang.'}</li>`;
    return;
  }

  list.innerHTML = entries.slice(0, 100).map((e) => `
    <li class="oc-journal-entry">
      <div class="oc-entry-meta">
        <span>${friendlyDate(e.date)} · ${escapeHtml(e.time)}</span>
        <button type="button" class="oc-entry-delete" data-delete="${e.id}" aria-label="Delete this entry">✕</button>
      </div>
      <div class="oc-entry-text">${escapeHtml(e.text)}</div>
    </li>`).join('');

  list.querySelectorAll('[data-delete]').forEach((btn) => {
    btn.addEventListener('click', () => {
      if (!confirm('Delete this entry forever?')) return;
      deleteJournalEntry(btn.dataset.delete);
      renderEntries(query);
    });
  });
}
