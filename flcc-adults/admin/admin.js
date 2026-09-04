// The events and notices admin.
//
// A page for whoever runs the church calendar, so that changing what is on the
// Community tab does not mean a GitHub account and a JSON file. It is NOT part
// of the FLCC NEXT Adults app: it shares the stylesheet so it looks like the
// thing it edits, and nothing else — no router, no storage module, no
// `adults/v1/` key, and it is never loaded by the app or precached by its
// service worker.
//
// HOW IT WORKS, AND WHY THIS WAY
//
// It reads the live `content/*.json` straight off the origin — the same files
// the app reads — and POSTs the edited version to `/api/publish/adults`, which
// checks the passcode, validates the shape, and commits the file back to the
// repository. Cloudflare rebuilds and the change is live.
//
// So the repository stays the single source of truth. Every save is an
// ordinary commit with a date and an editor's name on it, the history is the
// real history, a mistake is one revert away, and the app keeps reading static
// files it can cache and serve with no signal. A database would have bought
// nothing here and cost all of that.
//
// The passcode is kept in `sessionStorage` and nowhere else, so closing the
// tab signs you out. It is a shared church passcode, not an account: it says
// who may publish, not who anybody is.

const FILES = {
  events: {
    label: 'events',
    source: '../content/events.json',
    blank: () => ({
      id: '', title: '', when: '', where: '', blurb: '',
      date: '', start: '19:00', minutes: 90, tone: 'sky',
    }),
  },
  updates: {
    label: 'announcements',
    source: '../content/updates.json',
    blank: () => ({ id: '', title: '', date: today(), from: '', body: '', tone: 'sky' }),
  },
};

const TONES = ['sky', 'rose', 'sunshine', 'captain', 'navy', 'paper'];
const DAYS = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);

const el = (tag, props = {}, ...kids) => {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === null || value === undefined || value === false) continue;
    if (key === 'class') node.className = value;
    else if (key === 'text') node.textContent = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else if (value === true) node.setAttribute(key, '');
    else node.setAttribute(key, value);
  }
  for (const kid of kids.flat()) if (kid) node.appendChild(kid);
  return node;
};

let passcode = sessionStorage.getItem('flcc-adults-admin') || '';
let which = 'events';
let rows = [];
let dirty = false;

// ── The door ───────────────────────────────────────────────────────────────

function setStatus(text, tone = '') {
  $('status').textContent = text;
  $('status').style.color = tone === 'bad' ? 'var(--poppy)' : 'var(--ink-70)';
}

/**
 * The door checks the passcode before it opens.
 *
 * It used to take any text and let you in, leaving the passcode unchecked
 * until you pressed Save — so somebody with the wrong one could fill in a
 * whole calendar before finding out, and a door that opens for anything
 * teaches people the passcode does not matter.
 *
 * A wrong passcode is answered here. So is a Worker that has not been set up:
 * that message names the secret it is still waiting for, which is the most
 * useful thing anybody opening this page for the first time can be told.
 */
async function enter() {
  const typed = $('pass').value.trim();
  if (!typed) { $('pass').focus(); return; }

  const button = $('enter');
  button.disabled = true;
  $('gate-note').textContent = 'Checking…';
  $('gate-note').style.color = '';

  let response;
  try {
    response = await fetch('/api/publish/adults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode: typed, verify: true }),
    });
  } catch {
    button.disabled = false;
    $('gate-note').textContent = 'Could not reach the church’s server. Check your connection and try again.';
    $('gate-note').style.color = 'var(--poppy)';
    return;
  }

  const payload = await response.json().catch(() => ({}));
  button.disabled = false;

  if (!response.ok) {
    $('gate-note').textContent = payload?.error?.message || `Something went wrong (HTTP ${response.status}).`;
    $('gate-note').style.color = 'var(--poppy)';
    $('pass').select();
    return;
  }

  passcode = typed;
  sessionStorage.setItem('flcc-adults-admin', passcode);
  $('gate-note').textContent = '';
  $('gate').hidden = true;
  $('editor').hidden = false;
  $('bar').hidden = false;
  if (payload.editor) $('who').textContent = `Signed in as ${payload.editor}`;
  await load();
}

$('enter').addEventListener('click', enter);
$('pass').addEventListener('keydown', (e) => { if (e.key === 'Enter') enter(); });
$('sign-out').addEventListener('click', () => {
  if (dirty && !confirm('You have unsaved changes. Sign out anyway?')) return;
  sessionStorage.removeItem('flcc-adults-admin');
  location.reload();
});

// ── Loading what is live now ───────────────────────────────────────────────

async function load() {
  setStatus('Loading what is live…');
  try {
    // `cache: 'no-store'` matters: the app's own service worker caches these
    // files, and an editor who just published would otherwise be handed their
    // previous version to edit and would quietly undo their own change.
    const response = await fetch(`${FILES[which].source}?t=${Date.now()}`, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    rows = await response.json();
  } catch (error) {
    rows = [];
    setStatus(`Could not load the current ${FILES[which].label}: ${error.message}`, 'bad');
    return;
  }
  dirty = false;
  render();
  setStatus(`${rows.length} ${FILES[which].label} live now.`);
}

function pick(name) {
  if (dirty && !confirm('You have unsaved changes. Discard them?')) return;
  which = name;
  $('tab-events').toggleAttribute('data-quiet', name !== 'events');
  $('tab-updates').toggleAttribute('data-quiet', name !== 'updates');
  load();
}
$('tab-events').addEventListener('click', () => pick('events'));
$('tab-updates').addEventListener('click', () => pick('updates'));

$('add').addEventListener('click', () => {
  rows.push(FILES[which].blank());
  touch();
  render();
  document.querySelector('.entry:last-of-type input')?.focus();
});

function touch() { dirty = true; setStatus('Unsaved changes.'); }

// ── The form ───────────────────────────────────────────────────────────────

function field(label, value, onInput, { type = 'text', area = false, placeholder = '', key = '' } = {}) {
  const input = area
    ? el('textarea', { rows: '3', placeholder, 'data-k': key, 'aria-label': label })
    : el('input', { type, placeholder, 'data-k': key, 'aria-label': label });
  input.value = value ?? '';
  input.addEventListener('input', () => { onInput(input.value); touch(); });
  return el('label', { class: 'field' }, el('span', { text: label }), input);
}

function choose(label, value, options, onChange, key = '') {
  const select = el('select', { 'data-k': key, 'aria-label': label });
  for (const option of options) {
    select.appendChild(el('option', { value: String(option.value), text: option.label,
      ...(String(option.value) === String(value) ? { selected: true } : {}) }));
  }
  select.addEventListener('change', () => { onChange(select.value); touch(); render(); });
  return el('label', { class: 'field' }, el('span', { text: label }), select);
}

/** Move an entry, so the order on the tab is the order here. */
function reorder(index, step) {
  const to = index + step;
  if (to < 0 || to >= rows.length) return;
  [rows[index], rows[to]] = [rows[to], rows[index]];
  touch();
  render();
}

function tools(index) {
  return el('div', { class: 'tools' },
    el('button', { type: 'button', text: 'Move up', onclick: () => reorder(index, -1) }),
    el('button', { type: 'button', text: 'Move down', onclick: () => reorder(index, 1) }),
    el('button', { type: 'button', text: 'Remove', onclick: () => {
      const name = rows[index].title || 'this entry';
      if (!confirm(`Remove “${name}”? It disappears from the app when you publish.`)) return;
      rows.splice(index, 1);
      touch();
      render();
    } }));
}

/**
 * An event says when it is twice: `when` is the sentence a member reads, and
 * the day/time fields are what the countdown on Today is computed from. Two
 * fields that must agree are two fields that will not, so the editor writes
 * the machine-readable one and the sentence is offered ready-made.
 */
function suggestWhen(row) {
  const time = prettyTime(row.start);
  if (row.weekday !== undefined && row.weekday !== '') return `Every ${DAYS[row.weekday]} · ${time}`;
  if (Array.isArray(row.dates) && row.dates.length) return `${row.dates.length} dates · ${time}`;
  if (row.date) {
    const when = new Date(`${row.date}T00:00:00`);
    if (!Number.isNaN(when.getTime())) {
      return `${DAYS[when.getDay()]} ${when.getDate()} ${when.toLocaleDateString(undefined, { month: 'long' })} · ${time}`;
    }
  }
  return '';
}

function prettyTime(start) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(start || ''));
  if (!match) return '';
  const hour = Number(match[1]);
  const suffix = hour < 12 ? 'AM' : 'PM';
  return `${((hour + 11) % 12) + 1}:${match[2]} ${suffix}`;
}

function eventEntry(row, index) {
  const repeats = row.weekday !== undefined && row.weekday !== '';

  /**
   * The suggested sentence, kept live without rebuilding the form.
   *
   * Re-rendering on every keystroke would take the cursor out of whatever the
   * editor was typing in, so the three fields the suggestion is derived from
   * update this one node in place instead.
   */
  const preview = el('div', { class: 'preview', hidden: true });
  const refresh = () => {
    const suggestion = suggestWhen(row);
    // Only offered while the line is empty. An event whose sentence somebody
    // has already written does not need the app second-guessing the wording.
    if (!suggestion || String(row.when || '').trim()) { preview.hidden = true; return; }
    preview.hidden = false;
    preview.replaceChildren(
      el('span', { text: 'Suggested: ' }),
      el('strong', { text: suggestion }),
      el('button', { type: 'button', class: 'go', style: 'margin-left:.6rem', text: 'use this',
        onclick: () => {
          row.when = suggestion;
          const input = preview.parentElement.querySelector('[data-k=when]');
          if (input) input.value = suggestion;
          refresh();
          touch();
        } }));
  };

  const entry = el('div', { class: 'entry' },
    el('div', { class: 'entry-head' },
      el('p', { class: 'label', text: `Event ${index + 1}` }),
      el('p', { class: 'note', text: row.gathering ? 'The gathering' : '' })),

    field('What it is called', row.title, (v) => {
      row.title = v;
      if (!row.id) row.id = slug(v);
    }, { placeholder: 'Men’s breakfast', key: 'title' }),

    choose('When', repeats ? 'weekly' : 'once', [
      { value: 'once', label: 'A one-off, or a short series' },
      { value: 'weekly', label: 'Every week' },
    ], (mode) => {
      if (mode === 'weekly') {
        row.weekday = row.weekday === undefined || row.weekday === '' ? 5 : row.weekday;
        row.recurring = true;
        delete row.date;
        delete row.dates;
      } else {
        delete row.weekday;
        delete row.recurring;
        row.date = row.date || today();
      }
    }, 'repeats'),

    repeats
      ? choose('Which day', String(row.weekday), DAYS.map((name, n) => ({ value: n, label: name })),
          (v) => { row.weekday = Number(v); row.recurring = true; }, 'weekday')
      : field('Date', row.date, (v) => { row.date = v; refresh(); }, { type: 'date', key: 'date' }),

    el('div', { class: 'row2' },
      field('Starts', row.start, (v) => { row.start = v; refresh(); }, { type: 'time', key: 'start' }),
      field('Runs for (minutes)', row.minutes, (v) => { row.minutes = Number(v) || 0; }, { type: 'number', key: 'minutes' })),

    field('Where', row.where, (v) => { row.where = v; }, { placeholder: 'FLCC hall', key: 'where' }),

    field('The line members read', row.when, (v) => { row.when = v; refresh(); },
      { placeholder: suggestWhen(row) || 'Friday 7 November · 10:00 AM', key: 'when' }),
    preview,

    field('A sentence about it', row.blurb, (v) => { row.blurb = v; }, { area: true, key: 'blurb' }),

    el('div', { class: 'row2' },
      choose('Colour', row.tone, TONES.map((t) => ({ value: t, label: t })), (v) => { row.tone = v; }, 'tone'),
      choose('Is this the main gathering?', row.gathering ? 'yes' : 'no',
        [{ value: 'no', label: 'No' }, { value: 'yes', label: 'Yes — the church together' }],
        (v) => { if (v === 'yes') row.gathering = true; else delete row.gathering; }, 'gathering')),

    tools(index));

  refresh();
  return entry;
}

function updateEntry(row, index) {
  return el('div', { class: 'entry' },
    el('div', { class: 'entry-head' }, el('p', { class: 'label', text: `Announcement ${index + 1}` })),
    field('Headline', row.title, (v) => { row.title = v; if (!row.id) row.id = `u-${slug(v)}`; },
      { placeholder: 'Membership class opens in September', key: 'title' }),
    el('div', { class: 'row2' },
      field('Date', row.date, (v) => { row.date = v; }, { type: 'date', key: 'date' }),
      field('Who it is from', row.from, (v) => { row.from = v; }, { placeholder: 'Pastoral team', key: 'from' })),
    field('What it says', row.body, (v) => { row.body = v; }, { area: true, key: 'body' }),
    choose('Colour', row.tone, TONES.map((t) => ({ value: t, label: t })), (v) => { row.tone = v; }, 'tone'),
    tools(index));
}

const slug = (text) => String(text).toLowerCase().replace(/[^a-z0-9]+/g, '-')
  .replace(/^-+|-+$/g, '').slice(0, 40) || `x${Date.now().toString(36)}`;

function render() {
  $('hint').textContent = which === 'events'
    ? 'The order here is the order on the Community tab. One event must be marked as the main gathering — Today counts down to it.'
    : 'Newest first is usual. These appear under “From FLCC” on Today and on the Community tab.';
  const list = $('list');
  list.replaceChildren(...rows.map((row, i) =>
    (which === 'events' ? eventEntry : updateEntry)(row, i)));
  if (!rows.length) {
    list.appendChild(el('p', { class: 'note', text: `Nothing here yet. Press “Add another”.` }));
  }
}

// ── Publishing ─────────────────────────────────────────────────────────────

$('save').addEventListener('click', async () => {
  const problem = check();
  if (problem) { setStatus(problem, 'bad'); return; }

  $('save').disabled = true;
  setStatus('Publishing…');
  try {
    const response = await fetch('/api/publish/adults', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ passcode, file: which, content: rows }),
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(payload?.error?.message || `HTTP ${response.status}`);
    dirty = false;
    setStatus('Published. It is live on members’ phones in about a minute.');
  } catch (error) {
    setStatus(error.message, 'bad');
  } finally {
    $('save').disabled = false;
  }
});

/**
 * The same rules the Worker enforces, checked here first.
 *
 * Not instead of the server check — that one is the real one, because anything
 * in a browser can be bypassed. This one exists so a missing field is a
 * sentence under the button rather than a round trip and a rejection.
 */
const FIELD_NAMES = {
  title: 'name', when: 'line for members to read', where: 'place',
  blurb: 'description', from: 'sender', body: 'text',
};

function check() {
  const seen = new Set();
  for (const [i, row] of rows.entries()) {
    const at = `${which === 'events' ? 'Event' : 'Announcement'} ${i + 1}`;
    const need = which === 'events'
      ? ['title', 'when', 'where', 'blurb']
      : ['title', 'from', 'body'];
    for (const key of need) {
      if (!String(row[key] || '').trim()) return `${at} has no ${FIELD_NAMES[key] || key}.`;
    }
    if (!row.id) row.id = slug(row.title);
    if (seen.has(row.id)) return `${at} has the same name as an earlier one — change its title.`;
    seen.add(row.id);

    if (which === 'events') {
      if (row.weekday === undefined && !row.date && !(row.dates || []).length) {
        return `${at} has no day, so nothing can count down to it.`;
      }
      if (!/^\d{1,2}:\d{2}$/.test(String(row.start || ''))) return `${at} has no start time.`;
      if (!Number.isInteger(row.minutes) || row.minutes <= 0) return `${at} does not say how long it runs.`;
    } else if (!/^\d{4}-\d{2}-\d{2}$/.test(String(row.date || ''))) {
      return `${at} has no date.`;
    }
  }
  if (which === 'events' && !rows.some((row) => row.gathering)) {
    return 'One event has to be marked as the main gathering — Today counts the week around it.';
  }
  if (which === 'events' && !rows.length) return 'There has to be at least one event.';
  return null;
}

window.addEventListener('beforeunload', (event) => {
  if (!dirty) return;
  event.preventDefault();
  event.returnValue = '';
});

// A passcode already in this tab's session still goes through the door: the
// church may have rotated it since it was typed.
if (passcode) { $('pass').value = passcode; enter(); }
