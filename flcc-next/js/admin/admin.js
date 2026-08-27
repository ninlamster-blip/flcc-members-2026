// FLCC NEXT — the ministry dashboard.
//
// What this can honestly do, and what it cannot, in one place:
//
//   · Authored content (content/*.json) is public, read-only and served from
//     this domain. The dashboard reads it, audits it against the same rules as
//     the test suite, and hands back JSON to commit. It cannot write to it —
//     there is no server here to write to.
//   · Everything else it shows — progress, prayers, RSVPs — belongs to THIS
//     DEVICE. There is no account system, so there is no church-wide view to
//     show. Every figure on this page is labelled accordingly.
//   · A prayer marked "only me and God" is never displayed here. It is counted
//     and nothing more. The child was told nobody would read it.
//
// ARCHITECTURE.md describes the ten tables that would move this to a server
// and make roles, real moderation and church-wide numbers possible.

import { h, clear } from '../core/dom.js';
import { poster, label, display, headline, pill, art, toast, note } from '../core/ui.js';
import * as store from '../core/storage.js';
import * as progress from '../core/progress.js';
import { getUser, getSettings, saveSettings, MODE, mode } from '../core/profile.js';
import { audit, FILES } from './audit.js';
import * as ai from '../core/ai.js';

const headEl = document.getElementById('app-head');
const tabsEl = document.getElementById('admin-tabs');
const screenEl = document.getElementById('screen');

const SECTIONS = [
  { name: 'overview', label: 'Overview' },
  { name: 'content', label: 'Content' },
  { name: 'prayers', label: 'Prayers' },
  { name: 'events', label: 'Events' },
  { name: 'ask', label: 'Ask NEXT' },
];

// ── Loading the authored content ───────────────────────────────────────────

let bundle = null;

async function loadBundle() {
  if (bundle) return bundle;
  const loaded = {};
  await Promise.all(FILES.map(async (name) => {
    try {
      const response = await fetch(new URL(`../../content/${name}`, import.meta.url));
      loaded[name] = response.ok ? await response.json() : undefined;
    } catch { loaded[name] = undefined; }
  }));
  await Promise.all((loaded['journeys.json'] || []).map(async (journey) => {
    const path = `journeys/${journey.id}.json`;
    try {
      const response = await fetch(new URL(`../../content/${path}`, import.meta.url));
      loaded[path] = response.ok ? await response.json() : undefined;
    } catch { loaded[path] = undefined; }
  }));
  bundle = loaded;
  return bundle;
}

// ── Small pieces ───────────────────────────────────────────────────────────

const tally = (pairs) => h('div', { class: 'tally' }, ...pairs.map(([value, caption]) => h('div', {},
  h('p', { class: 'label dim', text: caption }),
  h('p', { class: 'numeral', style: 'margin-top:.2rem', text: String(value) }))));

const row = ({ title, note: text, right, actions = [] }) => h('div', {},
  h('div', { class: 'row-top' },
    h('p', { class: 'row-title', text: title }),
    right || null),
  text ? h('p', { class: 'row-note', text }) : null,
  actions.length ? h('div', { class: 'row-actions' }, ...actions) : null);

const flag = (level, text) => h('span', { class: 'flag', dataset: { level }, text });

function download(name, data) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = h('a', { href: url, download: name.replace(/\//g, '-') });
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function copy(text) {
  try { await navigator.clipboard.writeText(text); toast('Copied.'); }
  catch { toast('Select the text and copy it by hand.'); }
}

const when = (iso) => {
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? 'unknown date'
    : date.toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
};

// ── Overview ───────────────────────────────────────────────────────────────

async function overview() {
  const { problems, counts } = audit(await loadBundle());
  const bad = problems.filter((problem) => problem.level === 'error');
  const warn = problems.filter((problem) => problem.level === 'warning');

  const state = progress.getProgress();
  const user = getUser();
  const prayers = (store.read(store.KEYS.prayers, { items: [] }) || { items: [] }).items || [];
  const queue = prayers.filter((prayer) => prayer.visibility === 'leader' && prayer.moderation_status === 'pending');
  const settings = getSettings();

  const health = poster({ tone: bad.length ? 'pink' : 'sage', tall: true, className: 'full' },
    label('Content health'),
    h('div', {},
      display(bad.length ? `${bad.length} PROBLEM${bad.length === 1 ? '' : 'S'}` : 'ALL GOOD'),
      h('p', { class: 'body', style: 'margin-top:1rem',
        text: bad.length
          ? 'Something in the authored content will not render as intended. Open Content for the list.'
          : `Every authored file passes. ${warn.length} thing${warn.length === 1 ? '' : 's'} worth a look.` })),
    h('div', { class: 'poster-foot' },
      pill('Open content', () => go('content'), { quiet: !bad.length }),
      art(bad.length ? 'shield' : 'light', { tone: bad.length ? 'pink' : 'sage', size: 'sm' })));

  const library = poster({ tone: 'paper', className: 'full' },
    label('The library'),
    h('div', { style: 'margin-top:1rem' }, tally(Object.entries(counts).map(([name, value]) => [value, name]))));

  const device = poster({ tone: 'ink', className: 'full' },
    label('This device'),
    h('p', { class: 'body dim', style: 'margin-top:.5rem',
      text: user
        ? `${user.name || 'Someone'} · ${user.age ?? '—'} years old · ${MODE[mode()].label} mode`
        : 'Nobody has set this device up yet.' }),
    h('div', { style: 'margin-top:1.2rem' }, tally([
      [state.xp, 'XP'],
      [progress.level(state.xp), 'Level'],
      [state.streak.count, 'Day streak'],
      [progress.count('lesson'), 'Lessons'],
      [progress.count('game'), 'Games'],
      [progress.count('devotional'), 'Devotionals'],
    ])),
    h('p', { class: 'row-note', style: 'margin-top:1.2rem',
      text: 'These numbers are this device only. FLCC NEXT has no accounts and no server, so there is nothing church-wide to add them up.' }));

  const attention = poster({ tone: 'cream', className: 'full' },
    label('Waiting on you'),
    h('div', { class: 'rows', style: 'margin-top:.6rem' },
      row({
        title: `${queue.length} prayer${queue.length === 1 ? '' : 's'} to read`,
        note: queue.length ? 'Shared with a ministry leader from this device.' : 'Nothing in the queue on this device.',
        actions: queue.length ? [pill('Open prayers', () => go('prayers'), { quiet: true })] : [],
      }),
      row({
        title: ai.isConfigured(settings) ? 'Ask NEXT is on' : 'Ask NEXT is off',
        note: ai.isConfigured(settings)
          ? `Answers come through ${settings.aiWorker}.`
          : 'Until a worker address is set, Ask NEXT tells the young person it is unavailable rather than answering.',
        actions: [pill(ai.isConfigured(settings) ? 'Check it' : 'Set it up', () => go('ask'), { quiet: true })],
      }),
      row({
        title: warn.length ? `${warn.length} thing${warn.length === 1 ? '' : 's'} to look at` : 'No warnings',
        note: warn.length ? warn[0].where + ' — ' + warn[0].text : 'Nothing flagged in the authored content.',
        actions: warn.length ? [pill('See all', () => go('content'), { quiet: true })] : [],
      })));

  return h('div', { style: 'display:contents' }, health, library, device, attention);
}

// ── Content ────────────────────────────────────────────────────────────────

async function contentSection() {
  const loaded = await loadBundle();
  const { problems } = audit(loaded);
  const bad = problems.filter((problem) => problem.level === 'error');
  const warn = problems.filter((problem) => problem.level === 'warning');

  const problemBlock = (title, list, tone) => poster({ tone, className: 'full' },
    label(`${title} · ${list.length}`),
    list.length
      ? h('div', { class: 'rows', style: 'margin-top:.6rem' },
        ...list.map((problem) => row({ title: problem.where, note: problem.text })))
      : h('p', { class: 'body dim', style: 'margin-top:.6rem', text: 'Nothing here.' }));

  const size = (value) => (Array.isArray(value) ? `${value.length} entries`
    : value && typeof value === 'object' ? `${Object.keys(value).length} keys` : '—');

  const files = poster({ tone: 'paper', className: 'full' },
    label('Files'),
    h('p', { class: 'row-note', text: 'Authored content is committed to the repository and served read-only. Edit it there, or download a copy, change it and commit that.' }),
    h('div', { class: 'rows', style: 'margin-top:.8rem' },
      ...FILES.concat(Object.keys(loaded).filter((name) => name.startsWith('journeys/')).sort()).map((name) => row({
        title: name,
        note: loaded[name] === undefined ? 'did not load' : size(loaded[name]),
        right: loaded[name] === undefined ? flag('error', 'missing') : null,
        actions: loaded[name] === undefined ? [] : [
          pill('Download', () => download(name, loaded[name]), { quiet: true }),
          pill('Copy JSON', () => copy(JSON.stringify(loaded[name], null, 2)), { quiet: true }),
        ],
      }))));

  const howTo = poster({ tone: 'ink', className: 'full' },
    label('Adding something'),
    h('p', { class: 'body dim', style: 'margin-top:.6rem',
      text: 'Every item needs a kids version and a teens version, one of the five colours, and an illustration that already exists in the kit. This page runs exactly the checks the test suite runs, so if it is clean here it will be clean in the build.' }));

  return h('div', { style: 'display:contents' },
    problemBlock('Problems', bad, bad.length ? 'pink' : 'sage'),
    warn.length ? problemBlock('Worth a look', warn, 'cream') : null,
    files, howTo);
}

// ── Prayers ────────────────────────────────────────────────────────────────

function prayersSection(refresh) {
  const state = store.read(store.KEYS.prayers, { items: [] }) || { items: [] };
  const items = state.items || [];
  const shared = items.filter((prayer) => prayer.visibility === 'leader');
  const privateCount = items.length - shared.length;

  const save = () => { store.write(store.KEYS.prayers, state); refresh(); };
  const set = (prayer, status) => { prayer.moderation_status = status; save(); };

  const order = { pending: 0, read: 1, hidden: 2 };
  const queue = [...shared].sort((a, b) =>
    (order[a.moderation_status] ?? 0) - (order[b.moderation_status] ?? 0) ||
    String(b.date).localeCompare(String(a.date)));

  const card = (prayer) => {
    const status = prayer.moderation_status || 'pending';
    const actions = [];
    if (status !== 'read') actions.push(pill('Mark read', () => set(prayer, 'read'), { quiet: true }));
    if (status !== 'hidden') actions.push(pill('Hide', () => set(prayer, 'hidden'), { quiet: true }));
    if (status === 'hidden') actions.push(pill('Unhide', () => set(prayer, 'pending'), { quiet: true }));
    actions.push(pill('Delete', () => {
      state.items = items.filter((one) => one !== prayer);
      save();
      toast('Deleted from this device.');
    }, { quiet: true }));

    return row({
      title: prayer.content,
      note: `${when(prayer.date)}${prayer.mood ? ` · feeling ${prayer.mood}` : ''}`,
      right: flag(status === 'pending' ? 'warning' : status === 'read' ? 'ok' : 'error', status),
      actions,
    });
  };

  const list = poster({ tone: 'paper', className: 'full' },
    label(`Shared with a leader · ${queue.length}`),
    queue.length
      ? h('div', { class: 'rows', style: 'margin-top:.6rem' }, ...queue.map(card))
      : note('No prayers have been shared from this device.'));

  const privacy = poster({ tone: 'ink', className: 'full' },
    label('Kept private'),
    h('p', { class: 'numeral', style: 'margin-top:.4rem', text: String(privateCount) }),
    h('p', { class: 'body dim', style: 'margin-top:.8rem',
      text: privateCount === 1
        ? 'One prayer on this device was marked “only me and God”. It is counted here and nowhere else — its words are not shown on this page, and nothing sends them anywhere.'
        : `${privateCount} prayers on this device were marked “only me and God”. They are counted here and nowhere else — their words are not shown on this page, and nothing sends them anywhere.` }));

  const exportBlock = poster({ tone: 'cream', className: 'full' },
    label('Taking these with you'),
    h('p', { class: 'row-note', text: 'Prayers live on the device they were written on. To pray through them elsewhere, export the shared ones — private prayers are never included.' }),
    h('div', { class: 'row-actions' },
      pill('Download shared prayers', () => download('prayers.json', shared), { quiet: true }),
      pill('Copy as text', () => copy(shared.map((prayer) =>
        `${when(prayer.date)}${prayer.mood ? ` (${prayer.mood})` : ''}\n${prayer.content}`).join('\n\n')), { quiet: true })));

  return h('div', { style: 'display:contents' }, list, privacy, exportBlock);
}

// ── Events ─────────────────────────────────────────────────────────────────

async function eventsSection() {
  const loaded = await loadBundle();
  const events = loaded['events.json'] || [];
  const going = new Set(((store.read(store.KEYS.rsvps, { going: [] }) || {}).going) || []);

  const list = poster({ tone: 'paper', className: 'full' },
    label(`What is on · ${events.length}`),
    h('div', { class: 'rows', style: 'margin-top:.6rem' },
      ...events.map((event) => row({
        title: (event.title && (event.title.teens || event.title.kids)) || event.id,
        note: `${event.when} · ${event.where} · for ${event.for}`,
        right: going.has(event.id) ? flag('ok', 'going') : null,
      }))));

  const draft = { id: '', title: '', when: '', where: '', blurb: '', for: 'both', tone: 'cream', symbol: 'star' };
  const out = h('code', { class: 'code', text: '{}' });

  const paint = () => {
    const id = draft.id || draft.title.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'new-event';
    out.textContent = JSON.stringify({
      id,
      title: { kids: draft.title.toUpperCase(), teens: draft.title.toUpperCase() },
      tone: draft.tone,
      symbol: draft.symbol,
      when: draft.when,
      where: draft.where,
      for: draft.for,
      blurb: draft.blurb,
    }, null, 2);
  };

  const field = (name, key, placeholder) => h('label', { class: 'field' },
    h('span', { text: name }),
    h('input', { type: 'text', placeholder, oninput: (event) => { draft[key] = event.target.value; paint(); } }));

  const picker = (name, key, options) => h('label', { class: 'field' },
    h('span', { text: name }),
    h('select', { onchange: (event) => { draft[key] = event.target.value; paint(); } },
      ...options.map((option) => h('option', { value: option, text: option }))));

  const composer = poster({ tone: 'cream', className: 'full' },
    label('Add an event'),
    h('p', { class: 'row-note', text: 'There is no server to save an event to, so this writes the JSON for you. Paste it into content/events.json and commit it.' }),
    field('Title', 'title', 'Youth night'),
    field('When', 'when', 'Friday · 5:00 PM'),
    field('Where', 'where', 'NECK Compound'),
    field('One line about it', 'blurb', 'Worship, a word, and food afterwards.'),
    picker('Who it is for', 'for', ['both', 'kids', 'teens']),
    picker('Colour', 'tone', ['cream', 'pink', 'blue', 'sage', 'ink', 'paper']),
    picker('Illustration', 'symbol', ['star', 'people', 'calendar', 'camera', 'grid', 'light', 'mountain', 'rocket', 'flag', 'heart']),
    out,
    h('div', { class: 'row-actions' },
      pill('Copy JSON', () => copy(out.textContent)),
      pill('Download', () => download('event.json', JSON.parse(out.textContent)), { quiet: true })));

  paint();

  const rsvpBlock = poster({ tone: 'ink', className: 'full' },
    label('RSVPs'),
    h('p', { class: 'body dim', style: 'margin-top:.6rem',
      text: 'An RSVP is remembered on the young person’s own device so the app can say “you’re going”. Nothing is sent, so there is no attendance list to read here. A head count needs the server described in ARCHITECTURE.md.' }));

  return h('div', { style: 'display:contents' }, list, composer, rsvpBlock);
}

// ── Ask NEXT ───────────────────────────────────────────────────────────────

function askSection(refresh) {
  const settings = getSettings();
  const draft = { ...settings };

  const field = (name, key, placeholder, type = 'text') => h('label', { class: 'field' },
    h('span', { text: name }),
    h('input', { type, placeholder, value: draft[key] || '', autocomplete: 'off',
      oninput: (event) => { draft[key] = event.target.value; } }));

  const toggle = h('button', { class: 'pill', type: 'button', 'aria-pressed': String(Boolean(draft.aiEnabled)),
    onclick: () => {
      draft.aiEnabled = !draft.aiEnabled;
      toggle.setAttribute('aria-pressed', String(draft.aiEnabled));
      toggle.textContent = draft.aiEnabled ? 'Ask NEXT is on' : 'Ask NEXT is off';
    } }, draft.aiEnabled ? 'Ask NEXT is on' : 'Ask NEXT is off');

  const result = h('div', { style: 'margin-top:1rem' });

  const testIt = async () => {
    result.replaceChildren(note('Asking…'));
    const answer = await ai.ask({
      question: 'Who is Jesus?',
      mode: 'teens',
      history: [],
      settings: { ...draft },
    });
    if (answer.kind === 'answer') {
      const parts = answer.parts.map((part) => row({
        title: (ai.PARTS.find((one) => one.key === part.key) || { label: part.key }).label,
        note: part.body,
      }));
      result.replaceChildren(h('div', { class: 'rows' }, flag('ok', 'the shape came back right'), ...parts));
      return;
    }
    const said = {
      safety: 'The question was routed to the safety card before any network call — that is the on-device check working.',
      unconfigured: 'Not configured yet: it needs the worker address and the switch turned on.',
      offline: 'The worker could not be reached from this device.',
      error: answer.message || 'The worker answered, but not with an answer.',
    }[answer.kind];
    result.replaceChildren(h('div', { class: 'rows' }, row({ title: 'No answer', note: said, right: flag('error', answer.kind) })));
  };

  const settingsBlock = poster({ tone: 'paper', className: 'full' },
    label('Ask NEXT'),
    h('p', { class: 'row-note', text: 'Answers are fetched through a small proxy you deploy, so no API key ever reaches a phone. The proxy address and its shared secret live on this device only.' }),
    field('Worker address', 'aiWorker', 'https://your-worker.workers.dev'),
    field('Shared secret (optional)', 'aiSecret', 'the x-proxy-secret your worker expects', 'password'),
    field('Model', 'aiModel', ai.DEFAULT_MODEL),
    h('div', { class: 'row-actions', style: 'margin-top:1.2rem' },
      toggle,
      pill('Save', () => { saveSettings(draft); toast('Saved on this device.'); refresh(); }),
      pill('Send a test question', testIt, { quiet: true })),
    result);

  const rules = poster({ tone: 'ink', className: 'full' },
    label('What it will not do'),
    h('div', { class: 'rows', style: 'margin-top:.6rem' },
      row({ title: 'It never speaks as God or as Jesus', note: 'And it never claims to know what God is saying to a particular young person.' }),
      row({ title: 'It never stands in for a person', note: 'Parents, guardians, pastors, ministry leaders, doctors and counsellors are named as the people to go to, not replaced.' }),
      row({ title: 'It answers in five fixed parts', note: ai.PARTS.map((part) => part.label).join(' · ') }),
      row({ title: 'It is checked before it is sent', note: 'A question that suggests danger or self-harm is answered on the device with the help card. Nothing leaves the phone.' }),
      row({ title: 'It sends the question and the age group', note: 'No name, no prayers, no journal, no history beyond the last few turns of the same conversation.' })));

  const disclosure = poster({ tone: 'cream', className: 'full' },
    label('What the young person is told'),
    h('p', { class: 'body', style: 'margin-top:.6rem', text: ai.DISCLOSURE }));

  return h('div', { style: 'display:contents' }, settingsBlock, rules, disclosure);
}

// ── Frame ──────────────────────────────────────────────────────────────────

const RENDER = {
  overview: () => overview(),
  content: () => contentSection(),
  prayers: () => prayersSection(() => go(current, { keep: true })),
  events: () => eventsSection(),
  ask: () => askSection(() => go(current, { keep: true })),
};

let current = 'overview';

function renderHead() {
  clear(headEl);
  headEl.append(
    h('div', {},
      h('p', { class: 'label dimmer', text: 'FLCC NEXT' }),
      h('p', { class: 'headline', style: 'margin-top:.35rem', text: 'MINISTRY' })),
    h('a', { class: 'go', href: './', style: 'font-size:.8rem;letter-spacing:.12em;text-transform:uppercase' }, 'The app'));
}

function renderTabs() {
  clear(tabsEl);
  for (const section of SECTIONS) {
    const button = h('button', { type: 'button', text: section.label, onclick: () => go(section.name) });
    if (section.name === current) button.setAttribute('aria-current', 'page');
    tabsEl.appendChild(button);
  }
}

async function go(name, { keep = false } = {}) {
  current = SECTIONS.some((section) => section.name === name) ? name : 'overview';
  if (!keep) location.hash = current;
  renderTabs();
  clear(screenEl);
  screenEl.appendChild(poster({ tone: 'paper', className: 'full' }, note('Loading…')));
  let el;
  try {
    el = await RENDER[current]();
  } catch (error) {
    el = poster({ tone: 'pink', className: 'full' },
      label('Sorry'), headline('THAT SECTION DID NOT OPEN'),
      h('p', { class: 'body', style: 'margin-top:.8rem', text: String((error && error.message) || error) }));
  }
  clear(screenEl);
  screenEl.appendChild(el);
  if (!keep) { screenEl.scrollTop = 0; window.scrollTo(0, 0); }
}

window.addEventListener('hashchange', () => go(location.hash.replace('#', '') || 'overview'));
renderHead();
go(location.hash.replace('#', '') || 'overview');
