// FLCC NEXT — the ministry dashboard.
//
// What this can honestly do, and what it cannot, in one place:
//
//   · Authored content (content/*.json) is public, read-only and served from
//     this domain. The dashboard reads it, audits it against the same rules as
//     the test suite, and hands back JSON to commit. It cannot write to it —
//     there is no server here to write to.
//   · What it CAN do is keep a pack of changes on this device and lay it over
//     that content, so a leader can add a question the day a child asks it
//     without waiting for a developer. See Library, and js/core/library.js.
//     The pack lives on one device until somebody exports it or commits the
//     finished file; the page says so wherever it matters.
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
import { audit, FILES, THIN, DRILLS } from './audit.js';
import * as ai from '../core/ai.js';
import * as library from '../core/library.js';

const headEl = document.getElementById('app-head');
const tabsEl = document.getElementById('admin-tabs');
const screenEl = document.getElementById('screen');

const SECTIONS = [
  { name: 'overview', label: 'Overview' },
  { name: 'library', label: 'Library' },
  { name: 'content', label: 'Content' },
  { name: 'prayers', label: 'Prayers' },
  { name: 'events', label: 'Events' },
  { name: 'ask', label: 'Ask NEXT' },
];

// ── Loading the authored content ───────────────────────────────────────────

let committed = null;

/** Every authored file exactly as it was committed, with nothing laid over it. */
async function loadCommitted() {
  if (committed) return committed;
  const loaded = {};
  const fetchOne = async (name) => {
    try {
      const response = await fetch(new URL(`../../content/${name}`, import.meta.url));
      loaded[name] = response.ok ? await response.json() : undefined;
    } catch { loaded[name] = undefined; }
  };
  await Promise.all(FILES.map(fetchOne));
  // Journeys name their own lesson files, so those can only be found once
  // journeys.json has landed.
  const journeys = library.apply('journeys.json', loaded['journeys.json'] || []);
  await Promise.all(journeys.map((journey) => fetchOne(`journeys/${journey.id}.json`)));
  committed = loaded;
  return committed;
}

/**
 * The same files with this device's pack laid over them — which is what the
 * app renders, so it is what the audit has to check. Auditing the committed
 * files instead would report a clean bill of health on content nobody sees.
 */
async function loadBundle() {
  const base = await loadCommitted();
  const merged = {};
  for (const [name, value] of Object.entries(base)) {
    merged[name] = value === undefined ? undefined : library.apply(name, value);
  }
  return merged;
}

/** Forget the fetched files, so a reset or an import is reflected at once. */
function reload() { committed = null; }

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
  const { problems, counts, rotation } = audit(await loadBundle());
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

  const shelf = poster({ tone: 'paper', className: 'full' },
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

  const runs = poster({ tone: 'paper', className: 'full' },
    label('Before it repeats'),
    h('p', { class: 'row-note', text: 'The app deals a fresh slice each day and works through a whole bank before anything comes round again. These are the run lengths that gives, per age group.' }),
    h('div', { class: 'rows', style: 'margin-top:.8rem' },
      ...['kids', 'teens'].map((band) => row({
        title: band === 'kids' ? 'Kids · 7–12' : 'Teens · 13–18',
        note: rotation.filter((one) => one.band === band)
          .map((one) => `${one.what} ${one.days}d`).join('   ·   '),
      })),
      row({
        title: 'The shortest run',
        note: (() => {
          const real = rotation.filter((one) => !DRILLS.has(one.what));
          const worst = real.reduce((low, one) => (one.days < low.days ? one : low), real[0]);
          return worst
            ? `${worst.what} for ${worst.band}: ${worst.days} days on ${worst.total} items. Adding to that file is the highest-value content work.`
            : 'Nothing to report.';
        })(),
        right: (() => {
          const real = rotation.filter((one) => !DRILLS.has(one.what));
          const worst = real.reduce((low, one) => (one.days < low.days ? one : low), real[0]);
          return worst ? flag(worst.days < THIN ? 'warning' : 'ok', `${worst.days} days`) : null;
        })(),
      })));

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

  return h('div', { style: 'display:contents' }, health, shelf, runs, device, attention);
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
    h('p', { class: 'row-note', text: 'What each file holds after this device’s own changes are laid over it. To change one, open Library. To make a change permanent for the whole ministry, copy the finished file from there and commit it.' }),
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
      text: 'Every item needs a kids version and a teens version, one of the five colours, and an illustration that already exists in the kit. This page runs exactly the checks the test suite runs, on the content the app actually shows — your own additions included — so if it is clean here it will be clean in the build.' }),
    h('div', { class: 'row-actions' }, pill('Open Library', () => go('library'), { quiet: true })));

  return h('div', { style: 'display:contents' },
    problemBlock('Problems', bad, bad.length ? 'pink' : 'sage'),
    warn.length ? problemBlock('Worth a look', warn, 'cream') : null,
    files, howTo);
}

// ── Library: editing the authored content ──────────────────────────────────
//
// One editor for every kind of content, driven by the field list each kind
// declares in js/core/library.js. Adding a content type later means adding a
// kind there, not another form here.
//
// What a leader does here changes THIS DEVICE. Export the pack to carry it to
// another one, or copy the finished file and commit it to change it for the
// whole ministry. Both buttons are on this page, and so is that sentence.

let openKind = null;      // which kind's list is showing
let editing = null;       // { key, draft } — the row being written

function fieldEditor(field, draft) {
  const value = library.get(draft, field.path);
  const wrap = (...children) => h('label', { class: 'field' },
    h('span', { text: field.label }), ...children,
    field.help ? h('p', { class: 'row-note', text: field.help }) : null);

  if (field.type === 'dual') {
    // Two registers, always both. The app falls back when one is missing, and
    // a nine-year-old getting the teen wording is exactly what that hides.
    const box = (band) => h('label', { class: 'field' },
      h('span', { text: `${field.label} · ${band}` }),
      h('textarea', { rows: '3', text: (value && value[band]) || '',
        oninput: (event) => library.set(draft, field.path, { ...(library.get(draft, field.path) || {}), [band]: event.target.value }) }));
    return h('div', {}, box('kids'), box('teens'),
      field.help ? h('p', { class: 'row-note', text: field.help }) : null);
  }

  if (field.type === 'answers') {
    // The right answer is chosen with a radio button rather than typed as an
    // index, because an index is exactly the sort of thing that ends up
    // pointing at an option that no longer exists.
    const options = Array.isArray(value) ? [...value] : ['', '', ''];
    const answer = Number(library.get(draft, field.answerPath) || 0);
    const name = `answer-${Math.random().toString(36).slice(2)}`;
    const draw = (holder) => holder.replaceChildren(...options.map((text, index) => h('div', { class: 'answer-row' },
      h('input', { type: 'radio', name, checked: index === answer,
        'aria-label': `Answer ${index + 1} is the right one`,
        onchange: () => library.set(draft, field.answerPath, index) }),
      h('input', { type: 'text', value: text, placeholder: `Answer ${index + 1}`,
        oninput: (event) => { options[index] = event.target.value; library.set(draft, field.path, [...options]); } }))));
    const holder = h('div', { class: 'answers' });
    draw(holder);
    return wrap(holder);
  }

  if (field.type === 'list') {
    const items = Array.isArray(value) ? [...value] : [''];
    const holder = h('div', { class: 'rows' });
    const draw = () => {
      library.set(draft, field.path, items.filter((one) => String(one).trim()));
      holder.replaceChildren(...items.map((text, index) => h('div', { class: 'answer-row' },
        h('input', { type: 'text', value: text, placeholder: `${field.label} ${index + 1}`,
          oninput: (event) => { items[index] = event.target.value; library.set(draft, field.path, items.filter((one) => String(one).trim())); } }),
        field.size ? null : pill('Remove', () => { items.splice(index, 1); draw(); }, { quiet: true }))
        ).concat(field.size ? [] : [pill('Add another', () => { items.push(''); draw(); }, { quiet: true })]));
    };
    draw();
    return wrap(holder);
  }

  if (field.type === 'pairs') {
    const items = Array.isArray(value) && value.length ? value.map((one) => ({ ...one })) : [{}];
    const holder = h('div', { class: 'rows' });
    const draw = () => {
      library.set(draft, field.path, items.filter((one) => Object.values(one).some((v) => String(v || '').trim())));
      holder.replaceChildren(...items.map((item, index) => h('div', {},
        ...field.of.map(([key, caption]) => h('input', { type: 'text', value: item[key] || '', placeholder: caption,
          oninput: (event) => { item[key] = event.target.value; library.set(draft, field.path, items); } })),
        pill('Remove', () => { items.splice(index, 1); draw(); }, { quiet: true }))),
      pill('Add another', () => { items.push({}); draw(); }, { quiet: true }));
    };
    draw();
    return wrap(holder);
  }

  if (field.type === 'choice') {
    return wrap(h('select', { onchange: (event) => library.set(draft, field.path, event.target.value) },
      ...field.options.map((option) => h('option', { value: option, text: option, ...(option === value ? { selected: '' } : {}) }))));
  }

  if (field.type === 'number') {
    return wrap(h('input', { type: 'number', value: value ?? '', min: String(field.min ?? 0), max: String(field.max ?? 9999),
      oninput: (event) => library.set(draft, field.path, Number(event.target.value)) }));
  }

  if (field.type === 'long') {
    return wrap(h('textarea', { rows: '3', text: value || '',
      oninput: (event) => library.set(draft, field.path, event.target.value) }));
  }

  return wrap(h('input', { type: 'text', value: value ?? '',
    oninput: (event) => library.set(draft, field.path, event.target.value) }));
}

/** Every kind there is, including one per journey for its lessons. */
async function kindsNow() {
  const base = await loadCommitted();
  const journeys = library.apply('journeys.json', base['journeys.json'] || []);
  return [
    ...library.KINDS.filter((kind) => kind.id === 'daily' || kind.id === 'quiz'),
    ...journeys.map((journey) => library.lessonKind(journey.id, journey.title)),
    ...library.KINDS.filter((kind) => kind.id !== 'daily' && kind.id !== 'quiz'),
  ];
}

async function librarySection(refresh) {
  const base = await loadCommitted();
  const kinds = await kindsNow();
  const kind = kinds.find((one) => one.id === openKind) || null;
  const state = library.summary();

  // ── What has changed, and how to move it ────────────────────────────────
  const header = poster({ tone: state.total ? 'cream' : 'paper', className: 'full' },
    label('The library'),
    h('div', {},
      display(state.total ? `${state.total} CHANGE${state.total === 1 ? '' : 'S'}` : 'NOTHING CHANGED YET'),
      h('p', { class: 'body', style: 'margin-top:.9rem',
        text: state.total
          ? `${state.added} added, ${state.edited} rewritten, ${state.removed} taken out — on this device, since ${when(state.updated)}.`
          : 'Every file is as it was committed. Open one below and add to it — a question, a lesson, a daily word, anything a young person has asked for.' })),
    h('p', { class: 'row-note', style: 'margin-top:1rem',
      text: 'FLCC NEXT has no server, so what you write here is saved on this device. Export the pack to carry it to another phone, or copy the finished file and commit it to change it for everybody.' }),
    state.total ? h('div', { class: 'row-actions' },
      pill('Export the pack', () => download('flcc-next-content-pack.json', library.getPack())),
      pill('Import a pack', () => importDialog(refresh), { quiet: true }),
      pill('Undo everything', () => {
        if (!confirm('Undo every change on this device and go back to the committed content?')) return;
        library.resetAll();
        reload();
        toast('Back to the committed content.');
        refresh();
      }, { quiet: true }),
    ) : h('div', { class: 'row-actions' },
      pill('Import a pack', () => importDialog(refresh), { quiet: true })));

  // ── Pick a kind ────────────────────────────────────────────────────────
  const shelf = poster({ tone: 'paper', className: 'full' },
    label('What would you like to change?'),
    h('div', { class: 'rows', style: 'margin-top:.6rem' },
      ...kinds.map((one) => {
        const rows = library.rowsOf(one, one.path ? base[one.file] : (base[one.file] || []));
        const changed = state.files.find((file) => file.file === one.file);
        return row({
          title: one.label,
          note: `${rows.length} ${rows.length === 1 ? one.one : `${one.one}s`}${changed ? ` · ${changed.added} added, ${changed.edited} rewritten, ${changed.removed} out` : ''}`,
          right: changed ? flag('warning', 'edited') : null,
          actions: [pill(one.id === openKind ? 'Close' : 'Open', () => {
            openKind = one.id === openKind ? null : one.id;
            editing = null;
            refresh();
          }, { quiet: one.id !== openKind })],
        });
      })));

  if (!kind) return h('div', { style: 'display:contents' }, header, shelf, howItWorks());

  // ── One kind: its rows, and the editor ─────────────────────────────────
  const baseRows = kind.path ? base[kind.file] : (base[kind.file] || []);
  const rows = library.rowsOf(kind, baseRows);
  const gone = library.removedOf(kind, baseRows);

  const startEditing = (key, draft) => { editing = { key, draft }; refresh(); };

  const editor = editing ? (() => {
    const problems = h('div', { class: 'rows' });
    return poster({ tone: 'blue', className: 'full' },
      label(editing.key === null ? `New ${kind.one}` : `Editing · ${kind.title(editing.draft) || kind.one}`),
      ...kind.fields.map((field) => fieldEditor(field, editing.draft)),
      problems,
      h('div', { class: 'row-actions', style: 'margin-top:1.4rem' },
        pill('Save on this device', () => {
          const trouble = check(kind, editing.draft, rows, editing.key);
          if (trouble.length) {
            problems.replaceChildren(...trouble.map((text) => row({ title: text, right: flag('error', 'fix this') })));
            return;
          }
          if (editing.key === null) library.addRow(kind, editing.draft);
          else library.editRow(kind, editing.key, editing.draft);
          editing = null;
          toast('Saved on this device.');
          refresh();
        }),
        pill('Cancel', () => { editing = null; refresh(); }, { quiet: true })));
  })() : null;

  const list = poster({ tone: 'paper', className: 'full' },
    h('div', { class: 'poster-head' },
      label(`${kind.label} · ${rows.length}`),
      pill(`Add a ${kind.one}`, () => startEditing(null, kind.blank()), { quiet: true })),
    h('p', { class: 'row-note', text: kind.note }),
    h('div', { class: 'rows', style: 'margin-top:.8rem' },
      ...rows.map(({ row: item, key, state: how }) => row({
        title: kind.title(item) || key,
        note: how === 'added' ? 'Added on this device.' : how === 'edited' ? 'Rewritten on this device.' : '',
        right: how === 'shipped' ? null : flag(how === 'added' ? 'ok' : 'warning', how),
        actions: [
          pill('Edit', () => startEditing(key, structuredClone(item)), { quiet: true }),
          pill('Take out', () => {
            if (!confirm(`Take "${kind.title(item) || key}" out of the app on this device?`)) return;
            library.removeRow(kind, key);
            toast('Taken out on this device.');
            refresh();
          }, { quiet: true }),
          how === 'edited' ? pill('Undo my changes', () => {
            library.resetRow(kind, key);
            toast('Back to the committed wording.');
            refresh();
          }, { quiet: true }) : null,
        ].filter(Boolean),
      }))));

  const restore = gone.length ? poster({ tone: 'ink', className: 'full' },
    label(`Taken out · ${gone.length}`),
    h('p', { class: 'row-note', text: 'Still in the committed file, hidden on this device. Nothing has been deleted.' }),
    h('div', { class: 'rows', style: 'margin-top:.6rem' },
      ...gone.map((item) => row({
        title: kind.title(item) || kind.key(item),
        actions: [pill('Put it back', () => { library.restoreRow(kind, kind.key(item)); refresh(); }, { quiet: true })],
      })))) : null;

  const finished = poster({ tone: 'sage', className: 'full' },
    label('Make it permanent'),
    h('p', { class: 'row-note',
      text: `Everything above is on this device only. To give it to the whole ministry, copy the finished ${kind.file} and commit it to the repository — then undo the changes here, because the committed file will carry them.` }),
    h('div', { class: 'row-actions' },
      pill('Copy the finished file', () => copy(JSON.stringify(library.apply(kind.file, baseRows), null, 2))),
      pill('Download it', () => download(kind.file, library.apply(kind.file, baseRows)), { quiet: true }),
      pill('Undo changes to this file', () => {
        if (!confirm(`Undo every change to ${kind.file} on this device?`)) return;
        library.resetFile(kind.file);
        toast('Back to the committed file.');
        refresh();
      }, { quiet: true })));

  // The editor renders after the shelf, which on a phone puts it off the
  // bottom of the screen — so opening a row would look like nothing happened.
  if (editor) requestAnimationFrame(() => editor.scrollIntoView({ block: 'start', behavior: 'smooth' }));

  return h('div', { style: 'display:contents' }, header, shelf, editor, list, restore, finished);
}

/**
 * The checks that would otherwise be found by the audit after the fact, run
 * while the row is still on screen and can still be fixed.
 */
function check(kind, draft, rows, key) {
  const trouble = [];
  for (const field of kind.fields) {
    const value = library.get(draft, field.path);
    if (field.type === 'dual') {
      for (const band of ['kids', 'teens']) {
        if (!String((value || {})[band] || '').trim()) trouble.push(`${field.label} needs the ${band} version.`);
      }
    } else if (field.type === 'answers') {
      const options = Array.isArray(value) ? value : [];
      if (options.filter((one) => String(one).trim()).length < 2) trouble.push(`${field.label}: at least two of them.`);
      if (!String(options[Number(library.get(draft, field.answerPath) || 0)] || '').trim()) {
        trouble.push(`${field.label}: mark which one is right.`);
      }
    } else if (field.type === 'list') {
      const items = (Array.isArray(value) ? value : []).filter((one) => String(one).trim());
      if (field.size && items.length !== field.size) trouble.push(`${field.label}: exactly ${field.size}.`);
      if (!items.length) trouble.push(`${field.label} cannot be empty.`);
    } else if (field.type === 'pairs') {
      if (!(Array.isArray(value) && value.length)) trouble.push(`${field.label} cannot be empty.`);
    } else if (field.type === 'number') {
      if (!Number.isFinite(Number(value))) trouble.push(`${field.label} needs a number.`);
    } else if (field.path !== 'number' && field.path !== 'reviewedBy' && !String(value ?? '').trim()) {
      trouble.push(`${field.label} cannot be empty.`);
    }
  }
  const now = kind.key(draft);
  if (!String(now ?? '').trim()) trouble.push('This needs something that identifies it.');
  else if (now !== key && rows.some((one) => one.key === now)) trouble.push('Something with that name is already here.');
  return trouble;
}

function importDialog(refresh) {
  const area = h('textarea', { rows: '6', placeholder: 'Paste an exported pack here' });
  const file = h('input', { type: 'file', accept: 'application/json',
    onchange: async (event) => {
      const chosen = event.target.files && event.target.files[0];
      if (chosen) area.value = await chosen.text();
    } });
  const problem = h('p', { class: 'row-note' });

  const screen = h('div', { class: 'moment', role: 'dialog', 'aria-modal': 'true', style: 'background:var(--paper);overflow-y:auto' },
    label('Import a pack'),
    h('p', { class: 'body', style: 'margin-top:.6rem',
      text: 'A pack exported from another dashboard. It is laid on top of what is already on this device — nothing here is thrown away.' }),
    h('label', { class: 'field' }, h('span', { text: 'Choose a file' }), file),
    h('label', { class: 'field' }, h('span', { text: 'Or paste it' }), area),
    problem,
    h('div', { class: 'row-actions', style: 'margin-top:auto' },
      pill('Import', () => {
        try {
          library.importPack(area.value);
          reload();
          screen.remove();
          toast('Imported.');
          refresh();
        } catch (error) { problem.textContent = error.message; }
      }),
      pill('Cancel', () => screen.remove(), { quiet: true })));
  document.body.appendChild(screen);
  return screen;
}

const howItWorks = () => poster({ tone: 'ink', className: 'full' },
  label('How this works'),
  h('div', { class: 'rows', style: 'margin-top:.6rem' },
    row({ title: 'Changes live on this device',
      note: 'There is no account and no server. What you write here is in this browser, and clearing the browser clears it.' }),
    row({ title: 'The committed files are never overwritten',
      note: 'Your changes are kept separately and laid over the committed content when the app reads it. "Undo everything" always gets you back.' }),
    row({ title: 'To change it for everybody, commit it',
      note: 'Open a kind, copy the finished file, and put it in the repository. Then undo your changes here, so the same edit is not applied twice.' }),
    row({ title: 'The audit checks what you wrote',
      note: 'Overview and Content audit the content the app actually shows, edits included — so a question with no right answer is caught here, not by a child.' }),
    row({ title: 'Scripture is not in here',
      note: 'The 66 books under bible/ are the text of the Bible. Nothing on this page can change a word of them, which is deliberate.' })));

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
  library: () => librarySection(() => go(current, { keep: true })),
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
