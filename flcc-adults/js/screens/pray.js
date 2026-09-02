// PRAY.
//
// Two halves that most church apps confuse. Guided prayer is for the person
// who wants to pray and does not know how to start; the prayer list is for the
// person who prays constantly and cannot hold it all in their head.
//
// Nothing here leaves the device, and the screen says so where it matters
// rather than in a policy nobody opens.

import { h, block, card, badge, display, title, body, small, tag, figure, nextLine,
         sheet, pick as pickChip, act, actions, go, rows, row, section, doneMark,
         rise, note, toast, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';
import * as prayers from '../core/prayers.js';

export default async function prayScreen(ctx) {
  const parts = [];
  const [guides, categories] = await Promise.all([content.guides(), content.categories()]);
  const toneOf = (id) => (categories.find((one) => one.id === id) || {}).tone || 'paper';
  const today = rotation.pick(guides, { offset: 3 });

  // ── Take a moment ───────────────────────────────────────────────────────
  parts.push(block({ className: 'full' },
    badge('Pray'),
    display('Take a moment.'),
    h('p', { class: 'lead', text: today.line }),
    h('p', { class: 'cite', text: `Today · ${today.title}` }),
    actions(
      act('Pray now', () => ctx.go(`guide/${today.id}`)),
      go('Other guides', () => scrollTo('guides')))));

  // ── Add to the list ─────────────────────────────────────────────────────
  const input = h('textarea', { placeholder: 'What do you want to pray about?', 'aria-label': 'A prayer to add' });
  let category = 'personal';
  const chips = h('div', { style: 'display:flex;flex-direction:column;gap:.5rem' });
  const paintChips = () => swap(chips, ...categories.map((one) => pickChip(one.label, one.line, {
    tone: one.tone, chosen: one.id === category,
    onclick: () => { category = one.id; paintChips(); },
  })));
  paintChips();

  const keep = () => {
    const text = input.value.trim();
    if (!text) { toast('Write it first.'); input.focus(); return; }
    prayers.add({ text, category });
    input.value = '';
    toast('On your list.');
    ctx.refresh();
  };

  parts.push(sheet({ className: 'full', action: 'Add to my list', onaction: keep },
    display('New prayer', { mark: 'prayer' }),
    input,
    badge('Where it belongs'),
    chips,
    small('Stored on this phone only. Not sent to the church, to a leader, or to us.')));

  // ── The list ────────────────────────────────────────────────────────────
  //
  // Grouped by what it is about, because a prayer list read straight through
  // is a wall of worry. Each group opens where it stands.
  const open = prayers.open();
  if (open.length) {
    const grouped = categories
      .map((one) => ({ ...one, items: open.filter((item) => item.category === one.id) }))
      .filter((one) => one.items.length);
    const orphans = open.filter((item) => !categories.some((one) => one.id === item.category));
    if (orphans.length) grouped.push({ id: 'other', label: 'Other', line: '', tone: 'paper', items: orphans });

    let openGroup = null;
    const listWrap = section({ className: 'full' });
    const paintList = () => swap(listWrap,
      nextLine(`My prayer list · ${open.length} open`),
      rows({}, ...grouped.map((group) => {
        const holder = h('div', {});
        const paintGroup = () => swap(holder,
          row({
            title: group.label,
            note: group.line,
            meta: String(group.items.length),
            accent: group.tone,
            onclick: () => { openGroup = openGroup === group.id ? null : group.id; paintList(); },
          }),
          openGroup === group.id
            ? h('div', { style: 'padding:0 0 .6rem 1rem' },
                rows({ tight: true }, ...group.items.map((item) => prayerRow(ctx, item, group.tone))))
            : null);
        paintGroup();
        return holder;
      })),
      small('Tap a group to see what is on that part of the list.'));
    paintList();
    parts.push(listWrap);
  } else {
    parts.push(card({ tone: 'paper', className: 'full', symbol: 'heart' },
      badge('My prayer list'),
      body('Nothing on the list yet. Most people start with one name and one worry.')));
  }

  // ── Answered ────────────────────────────────────────────────────────────
  //
  // Kept, never deleted. The point of a prayer list is being able to look back
  // at what God did with it, and an app that clears the row the moment it is
  // ticked destroys exactly the thing worth keeping.
  const answered = prayers.answered();
  if (answered.length) {
    parts.push(section({ className: 'full' },
      nextLine(`Answered · ${answered.length}`),
      rows({}, ...answered.slice(0, 8).map((item) => h('div', { class: 'row' },
        h('i', { class: 'stem', dataset: { accent: toneOf(item.category) } }),
        h('div', {},
          h('p', { class: 'row-title', text: item.text }),
          item.answered.note ? h('p', { class: 'row-note', text: item.answered.note }) : null,
          h('div', { class: 'act-row', style: 'margin-top:.5rem' },
            h('span', { class: 'row-meta', text: new Date(item.answered.at).toLocaleDateString() }),
            act('Reopen', () => { prayers.reopen(item.id); ctx.refresh(); }, { quiet: true, small: true }))),
        h('span'))))));
  }

  // ── The guides ──────────────────────────────────────────────────────────
  parts.push(section({ className: 'full', id: 'guides' },
    nextLine('Guided prayer'),
    small('Each one is a few minutes, with a timer you can ignore.'),
    rows({}, ...guides.map((one) => row({
      title: one.title,
      note: one.line,
      meta: `${Math.round(one.steps.reduce((sum, step) => sum + (step.seconds || 60), 0) / 60)} min`,
      accent: one.tone,
      onclick: () => ctx.go(`guide/${one.id}`),
    })))));

  // ── Reflections ─────────────────────────────────────────────────────────
  const written = prayers.reflections();
  if (written.length) {
    parts.push(section({ className: 'full' },
      nextLine(`Reflections · ${written.length} kept`),
      rows({}, ...written.slice(0, 6).map((entry) => h('div', { class: 'row' },
        h('span'),
        h('div', {},
          h('p', { class: 'row-title', text: entry.text }),
          h('div', { class: 'act-row', style: 'margin-top:.5rem' },
            h('span', { class: 'row-meta', text: `${entry.guide || ''} · ${new Date(entry.at).toLocaleDateString()}` }),
            act('Remove', () => { prayers.unreflect(entry.id); ctx.refresh(); }, { quiet: true, small: true }))),
        h('span'))))));
  }

  // ── The church ──────────────────────────────────────────────────────────
  parts.push(card({ tone: 'paper', className: 'full', symbol: 'church' },
    badge('Praying with other people'),
    body('This app cannot pass a prayer request to anyone — there is no server behind it and nothing typed here is sent. For prayer with the church, come to the Tuesday meeting, or speak to a leader after the service.'),
    go('The Tuesday meeting', () => ctx.go('community'))));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Pray', el };
}

/** One prayer, with its actions revealed on tap rather than always shown. */
function prayerRow(ctx, item, tone) {
  const holder = h('div', {});
  let open = false;

  const paint = () => {
    swap(holder,
      h('button', { class: 'row', type: 'button', 'aria-expanded': String(open),
        onclick: () => { open = !open; paint(); } },
        h('i', { class: 'stem', dataset: { accent: tone } }),
        h('div', {}, h('p', { class: 'row-title', text: item.text })),
        h('span', { class: 'row-meta', text: prayers.carriedFor(item) })),
      open ? answerBox(ctx, item) : null);
  };

  paint();
  return holder;
}

function answerBox(ctx, item) {
  const noteInput = h('input', { type: 'text', placeholder: 'What happened? (optional)', 'aria-label': 'How it was answered' });
  return h('div', { style: 'margin-top:.5rem;padding:0 .2rem .8rem' },
    noteInput,
    actions(
      act('Answered', () => {
        prayers.answer(item.id, noteInput.value);
        toast('Moved to Answered. It is kept, not deleted.');
        ctx.refresh();
      }, { small: true }),
      act('Remove', () => {
        prayers.remove(item.id);
        toast('Removed.');
        ctx.refresh();
      }, { quiet: true, small: true })));
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
