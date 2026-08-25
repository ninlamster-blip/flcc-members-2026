/* =============================================================================
   SERMON NOTES — the screen.
   -----------------------------------------------------------------------------
   The whole app is one page: the service at the top, the note under it. There
   is no new-note button, no folder, no first-run setup and nothing to choose
   before writing — open it during a service and the right note is already
   there, because the church publishes when its services are.

   What it deliberately does not do: transcribe, summarise, scan, suggest or
   send anything anywhere. A sermon note is somebody listening. The app's whole
   job is to keep up with them and then get out of the way.
   ========================================================================== */

import {
  todayISO, dateLabel, shortDate, relativeDay, servicesFrom, chooseService,
  switchableServices, readNote, noteIsEmpty, noteSummary, listNotes, searchNotes,
  groupByMonth, noteToText, parseNoteId, fromSiteRoot,
} from './notes.js';
import { loadNotes, saveNote, deleteNote, cacheServices, cachedServices } from './storage.js';
import { normalize } from './scripture.js';

const $ = (id) => document.getElementById(id);
const CHURCH = window.FLCC || {
  name: '', data: (f) => './' + f, url: (p) => p, key: (k) => k,
};

/* The fields, and the note key each one is stored under. Everything else in
   here works off this list, so adding a field is one line plus its markup. */
const FIELDS = [
  { key: 'title',    el: 'f-title' },
  { key: 'passage',  el: 'f-passage' },
  { key: 'body',     el: 'f-body' },
  { key: 'takeaway', el: 'f-takeaway' },
];

const state = {
  services: [],
  service: null,
  notes: {},
  note: readNote(null),
  /** Fields the member has changed since this note was opened. Only these are
   *  written, so opening an older note and leaving it alone never rewrites it —
   *  it may hold a rich-text body from the members app that this screen shows
   *  as plain text, and quietly flattening it on an unrelated edit would be a
   *  small theft. */
  touched: new Set(),
  saveTimer: null,
  stateTimer: null,
  lastPanelTrigger: null,
};

/* ── Loading ──────────────────────────────────────────────────────────────── */

async function boot() {
  $('back').href = CHURCH.url('../');
  wire();

  try {
    state.services = await loadServices();
  } catch (err) {
    return showError(err);
  }
  if (!state.services.length) return showEmpty();

  state.notes = loadNotes();
  $('state-loading').hidden = true;
  $('app').hidden = false;

  openService(serviceFromHash() || chooseService(state.services, todayISO()));
  refreshCount();
  registerWorker();
}

/**
 * The schedule, from the church's own data.json — and from the last copy this
 * device saw when there is no answer. `?t=` is how every page in this app
 * defeats a stale cache (see CHURCHES.md).
 */
async function loadServices() {
  try {
    const res = await fetch(fromSiteRoot(CHURCH.data('data.json')) + '?t=' + Date.now(), { cache: 'no-store' });
    if (!res.ok) throw new Error(`data.json responded ${res.status}`);
    const services = servicesFrom(await res.json());
    if (services.length) cacheServices(services);
    return services;
  } catch (err) {
    const cached = cachedServices();
    if (cached && cached.services.length) return cached.services;
    throw err;
  }
}

/** The schedule loaded and has nothing in it — a church that has not published
 *  one yet, which is most of the network today. */
function showEmpty() {
  $('state-loading').hidden = true;
  $('state-empty').hidden = false;
  $('empty-back').href = CHURCH.url('../');
  if (CHURCH.name) {
    $('empty-detail').textContent =
      `Sermon Notes puts your notes on the service they belong to, and takes the dates from ${CHURCH.name}'s published schedule. As soon as the leaders publish one, this opens on the right day by itself.`;
  }
}

function showError(err) {
  $('state-loading').hidden = true;
  $('state-error').hidden = false;
  if (err && err.message) {
    $('error-detail').textContent =
      `This app takes its dates, services and preachers from the church schedule, and it hasn't been able to reach it (${err.message}). Once it has loaded here once, it works with no signal.`;
  }
}

/** The service is in the address, so a reload, a bookmark or a back button all
 *  land on the same note rather than on whichever one is nearest today. */
function serviceFromHash() {
  const id = decodeURIComponent((location.hash || '').replace(/^#/, ''));
  return state.services.find((s) => s.id === id) || null;
}

/* ── Opening a service ────────────────────────────────────────────────────── */

function openService(service) {
  if (!service) return;
  flushSave();
  state.service = service;
  // Read from storage rather than from what boot() happened to load: the
  // members app may be open in another tab, and this app is reached by hash
  // as well as by button, without the page reloading in between.
  state.notes = loadNotes();
  state.note = readNote(state.notes[service.id]);
  state.touched = new Set();

  if (decodeURIComponent((location.hash || '').slice(1)) !== service.id) {
    history.replaceState(null, '', '#' + encodeURIComponent(service.id));
  }

  const when = relativeDay(service.date, todayISO());
  $('svc-when').textContent = when || 'Service';
  $('svc-date').textContent = dateLabel(service.date);
  $('svc-label').textContent = [service.label, service.time].filter(Boolean).join(' · ');
  $('svc-preacher').textContent = service.preacher ? `Preaching: ${service.preacher}` : '';

  const theme = $('svc-theme');
  const parts = [service.special, service.theme && `Theme: ${service.theme}`].filter(Boolean);
  theme.hidden = !parts.length;
  theme.textContent = parts.join(' · ');

  for (const field of FIELDS) $(field.el).value = state.note[field.key] || '';
  renderVerses();
  autoGrow($('f-body'));
  showSaveState('');
  hideDeleteConfirm();
  refreshDeleteButton();
}

function refreshDeleteButton() {
  $('btn-delete').hidden = noteIsEmpty(state.note);
}

function refreshCount() {
  const count = listNotes(state.notes, state.services).length;
  const badge = $('note-count');
  badge.hidden = count === 0;
  badge.textContent = String(count);
}

/* ── Writing ──────────────────────────────────────────────────────────────── */

function change(key, value) {
  if (state.note[key] === value) return;
  state.note[key] = value;
  state.touched.add(key);
  queueSave();
}

/** Saves 700ms after the last keystroke — long enough not to write on every
 *  letter, short enough that putting the phone down saves. */
function queueSave() {
  showSaveState('saving');
  clearTimeout(state.saveTimer);
  state.saveTimer = setTimeout(flushSave, 700);
}

function flushSave() {
  clearTimeout(state.saveTimer);
  state.saveTimer = null;
  if (!state.service || !state.touched.size) return;

  const patch = {};
  for (const key of state.touched) patch[key] = state.note[key];

  const ok = saveNote(state.service.id, patch);
  state.notes = loadNotes();
  showSaveState(ok ? 'saved' : 'error');
  refreshDeleteButton();
  refreshCount();
}

function showSaveState(kind) {
  const el = $('save-state');
  clearTimeout(state.stateTimer);
  const text = { saving: 'Saving…', saved: 'Saved', error: 'Not saved' }[kind] || '';
  el.textContent = text;
  el.dataset.state = kind || '';
  if (kind === 'saved') {
    state.stateTimer = setTimeout(() => { el.textContent = ''; el.dataset.state = ''; }, 2400);
  }
  if (kind === 'error') {
    el.title = 'This device would not store the note — private browsing, or no room left.';
  }
}

/**
 * A textarea prints what its box shows and no more, so the body is copied into
 * a plain element for printing. The two blocks below it are dropped when they
 * are empty: on screen they are fields waiting to be filled in, on paper they
 * would be headings over nothing.
 */
function prepareForPrint() {
  $('print-body').textContent = $('f-body').value;
  $('block-verses').toggleAttribute('data-empty', state.note.verses.length === 0);
  $('block-takeaway').toggleAttribute('data-empty', !$('f-takeaway').value.trim());
}

/** The notes field grows with what is in it, so the page scrolls rather than a
 *  box inside it: on a phone, a scrollbar inside a textarea is a trap. */
function autoGrow(el) {
  el.style.height = 'auto';
  el.style.height = el.scrollHeight + 'px';
}

/* ── Verses ───────────────────────────────────────────────────────────────── */

function renderVerses() {
  const list = $('verse-list');
  list.textContent = '';
  state.note.verses.forEach((ref, index) => {
    const li = document.createElement('li');
    li.className = 'verse';

    const link = document.createElement('a');
    link.href = CHURCH.url('../verse-lookup.html?ref=' + encodeURIComponent(ref));
    link.textContent = ref;
    li.append(link);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${ref}`);
    remove.addEventListener('click', () => {
      state.note.verses = state.note.verses.filter((_, i) => i !== index);
      state.touched.add('verses');
      renderVerses();
      queueSave();
    });
    li.append(remove);

    list.append(li);
  });
}

function addVerse(raw) {
  const ref = normalize(raw);
  if (!ref) return;
  if (state.note.verses.includes(ref)) return;   // said twice, written once
  state.note.verses = [...state.note.verses, ref];
  state.touched.add('verses');
  renderVerses();
  queueSave();
}

/* ── Share, print, delete ─────────────────────────────────────────────────── */

async function share() {
  flushSave();
  const text = noteToText(state.note, state.service, CHURCH.name);
  const title = noteSummary(state.note);
  if (navigator.share) {
    try {
      await navigator.share({ title, text });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;   // they changed their mind
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    showSaveState('saved');
    $('save-state').textContent = 'Copied';
  } catch {
    showSaveState('error');
    $('save-state').textContent = 'Could not copy';
  }
}

function hideDeleteConfirm() {
  $('confirm-delete').hidden = true;
  $('actions').hidden = false;
}

/* ── Panels ───────────────────────────────────────────────────────────────── */

function openPanel(id, trigger) {
  closePanel();
  state.lastPanelTrigger = trigger || null;
  $('overlay').hidden = false;
  $(id).hidden = false;
  const close = $(id).querySelector('[data-close]');
  if (close) close.focus();
}

function closePanel() {
  $('overlay').hidden = true;
  for (const id of ['panel-services', 'panel-notes']) $(id).hidden = true;
  if (state.lastPanelTrigger) {
    state.lastPanelTrigger.focus();
    state.lastPanelTrigger = null;
  }
}

function renderServicePanel() {
  const body = $('services-body');
  body.textContent = '';
  const today = todayISO();
  const services = switchableServices(state.services, today, state.notes);

  for (const service of services) {
    const stored = readNote(state.notes[service.id]);
    const row = document.createElement('button');
    row.type = 'button';
    row.className = 'row';
    if (state.service && service.id === state.service.id) row.setAttribute('aria-current', 'true');

    const top = document.createElement('div');
    top.className = 'row-top';
    top.append(el('span', 'row-date', shortDate(service.date)));
    const when = relativeDay(service.date, today);
    if (when) top.append(el('span', 'row-when', when));
    if (!noteIsEmpty(stored)) {
      const dot = el('span', 'row-dot', '');
      dot.title = 'You have notes for this service';
      top.append(dot);
    }
    row.append(top);
    row.append(el('div', 'row-title', service.label + (service.time ? ` · ${service.time}` : '')));
    if (service.preacher) row.append(el('div', 'row-sub', service.preacher));

    row.addEventListener('click', () => { openService(service); closePanel(); });
    body.append(row);
  }
}

function renderNotesPanel() {
  const body = $('notes-body');
  body.textContent = '';
  const all = listNotes(state.notes, state.services);
  const found = searchNotes(all, $('f-search').value);

  if (!found.length) {
    const empty = document.createElement('div');
    empty.className = 'empty';
    empty.append(el('p', '', all.length ? 'Nothing matches that.' : 'No notes yet.'));
    empty.append(el('p', 'small', all.length
      ? 'Try a word from the sermon, a preacher, or a book of the Bible.'
      : 'Whatever you write during a service will be listed here.'));
    body.append(empty);
    return;
  }

  for (const group of groupByMonth(found)) {
    body.append(el('h3', 'group-title', group.label));
    for (const item of group.notes) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'row';
      if (state.service && item.id === state.service.id) row.setAttribute('aria-current', 'true');

      const top = el('div', 'row-top', '');
      top.append(el('span', 'row-date', shortDate(item.date)));
      top.append(el('span', 'row-when', item.label));
      row.append(top);
      row.append(el('div', 'row-title', noteSummary(item.note)));
      const sub = [item.preacher, item.note.passage].filter(Boolean).join(' · ');
      if (sub) row.append(el('div', 'row-sub', sub));

      row.addEventListener('click', () => {
        const service = state.services.find((s) => s.id === item.id);
        if (service) openService(service);
        else openService(serviceFromNote(item));
        closePanel();
      });
      body.append(row);
    }
  }
}

/** A note whose service is no longer in the published schedule — an older year,
 *  a row that was edited away — still opens, on what its own id remembers. */
function serviceFromNote(item) {
  const { date, service } = parseNoteId(item.id);
  return { id: item.id, date, service, label: `${service} Service`, time: '', preacher: '', theme: '', special: '' };
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

/* ── Wiring ───────────────────────────────────────────────────────────────── */

function wire() {
  $('btn-retry').addEventListener('click', () => location.reload());

  for (const field of FIELDS) {
    const input = $(field.el);
    input.addEventListener('input', () => {
      change(field.key, input.value);
      if (field.key === 'body') autoGrow(input);
    });
  }

  // A passage is tidied when the member leaves the field, never while they are
  // still typing it: rewriting "1 c" to something under the cursor is the kind
  // of help nobody asked for.
  $('f-passage').addEventListener('blur', () => {
    const tidy = normalize($('f-passage').value);
    if (tidy !== $('f-passage').value) {
      $('f-passage').value = tidy;
      change('passage', tidy);
    }
    flushSave();
  });

  $('verse-form').addEventListener('submit', (event) => {
    event.preventDefault();
    addVerse($('f-verse').value);
    $('f-verse').value = '';
    $('f-verse').focus();
  });

  $('btn-switch').addEventListener('click', (event) => {
    renderServicePanel();
    openPanel('panel-services', event.currentTarget);
  });

  $('btn-all').addEventListener('click', (event) => {
    flushSave();
    renderNotesPanel();
    openPanel('panel-notes', event.currentTarget);
  });

  $('f-search').addEventListener('input', renderNotesPanel);

  $('overlay').addEventListener('click', closePanel);
  for (const button of document.querySelectorAll('[data-close]')) {
    button.addEventListener('click', closePanel);
  }
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closePanel();
  });

  $('btn-share').addEventListener('click', share);
  $('btn-print').addEventListener('click', () => { flushSave(); window.print(); });
  // Fires for the button and for the browser's own print command alike.
  window.addEventListener('beforeprint', prepareForPrint);

  $('btn-delete').addEventListener('click', () => {
    $('confirm-delete').hidden = false;
    $('actions').hidden = true;
    $('btn-delete-cancel').focus();
  });
  $('btn-delete-cancel').addEventListener('click', () => { hideDeleteConfirm(); $('btn-delete').focus(); });
  $('btn-delete-yes').addEventListener('click', () => {
    clearTimeout(state.saveTimer);
    deleteNote(state.service.id);
    state.notes = loadNotes();
    hideDeleteConfirm();
    openService(state.service);
    refreshCount();
  });

  // A phone does not close a tab, it walks away from it. Both of these fire
  // where 'unload' no longer does.
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', () => { if (document.hidden) flushSave(); });
  window.addEventListener('hashchange', () => {
    const service = serviceFromHash();
    if (service && (!state.service || service.id !== state.service.id)) openService(service);
  });
}

function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  navigator.serviceWorker.register('sw.js').catch(() => { /* offline shell is a bonus, not a requirement */ });
}

boot();
