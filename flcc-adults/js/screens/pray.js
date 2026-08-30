// PRAY.
//
// Two halves that most church apps confuse. Guided prayer is for the person
// who wants to pray and does not know how to start; the prayer list is for the
// person who prays constantly and cannot hold it all in their head.
//
// Nothing here leaves the device, and the screen says so where it matters
// rather than in a policy nobody opens.

import { h, card, badge, display, title, body, small, tag, figure,
         act, actions, go, rows, row, section, rise, note, toast, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';
import * as prayers from '../core/prayers.js';

export default async function prayScreen(ctx) {
  const cards = [];
  const [guides, categories] = await Promise.all([content.guides(), content.categories()]);
  const toneOf = (id) => (categories.find((one) => one.id === id) || {}).tone || 'paper';
  const today = rotation.pick(guides, { offset: 3 });

  // ── Take a moment ───────────────────────────────────────────────────────
  cards.push(card({ solid: true, tall: true, className: 'full', symbol: today.symbol,
      foot: `Today · ${today.title}` },
    h('div', {},
      badge('Pray'),
      h('div', { style: 'margin-top:1rem' }, display('Take a moment.')),
      h('p', { class: 'lead', style: 'margin-top:.6rem;max-width:24ch', text: 'What is on your heart today?' })),
    actions(
      act('Pray now', () => ctx.go(`guide/${today.id}`)),
      go('Other guides', () => document.getElementById('guides')?.scrollIntoView({ behavior: 'smooth', block: 'start' })))));

  // ── Add to the list ─────────────────────────────────────────────────────
  const input = h('textarea', { placeholder: 'What do you want to pray about?', 'aria-label': 'A prayer to add' });
  let category = 'personal';
  const chips = h('div', { class: 'act-row', style: 'margin-top:.8rem' },
    ...categories.map((one) => {
      const button = act(one.label, () => {
        category = one.id;
        [...chips.children].forEach((child) => child.setAttribute('data-quiet', ''));
        button.removeAttribute('data-quiet');
      }, { small: true, quiet: one.id !== category });
      return button;
    }));

  cards.push(card({ tone: 'paper', className: 'full', foot: 'Stored on this phone only' },
    badge('Add to your list'),
    input, chips,
    actions(act('Keep it', () => {
      const text = input.value.trim();
      if (!text) { toast('Write it first.'); input.focus(); return; }
      prayers.add({ text, category });
      input.value = '';
      toast('On your list.');
      ctx.refresh();
    })),
    small('Your prayer list is not sent to the church, to a leader, or to us.')));

  // ── The list ────────────────────────────────────────────────────────────
  const open = prayers.open();
  if (open.length) {
    const grouped = categories
      .map((one) => ({ ...one, items: open.filter((item) => item.category === one.id) }))
      .filter((one) => one.items.length);
    const orphans = open.filter((item) => !categories.some((one) => one.id === item.category));
    if (orphans.length) grouped.push({ id: 'other', label: 'Other', tone: 'paper', items: orphans });

    cards.push(section({ className: 'full' },
      badge(`My prayer list · ${open.length} open`),
      ...grouped.map((group) => section({},
        h('div', { style: 'display:flex;justify-content:space-between;align-items:center' },
          tag(group.label, group.tone),
          h('span', { class: 'row-meta', text: String(group.items.length) })),
        rows({}, ...group.items.map((item) => prayerRow(ctx, item, group.tone)))))));
  } else {
    cards.push(card({ tone: 'paper', className: 'full', symbol: 'heart', figureSize: 'sm' },
      badge('My prayer list'),
      body('Nothing on the list yet. Most people start with one name and one worry.')));
  }

  // ── Answered ────────────────────────────────────────────────────────────
  const answered = prayers.answered();
  if (answered.length) {
    cards.push(card({ tone: 'sunshine', className: 'full',
        foot: [`${answered.length} answered`] },
      badge('Answered'),
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
  cards.push(section({ className: 'full', id: 'guides' },
    badge('Guided prayer'),
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
    cards.push(card({ tone: 'sky', className: 'full', foot: `${written.length} kept` },
      badge('Reflections'),
      rows({}, ...written.slice(0, 6).map((entry) => h('div', { class: 'row' },
        h('span'),
        h('div', {},
          h('p', { class: 'row-title', style: 'font-weight:500', text: entry.text }),
          h('div', { class: 'act-row', style: 'margin-top:.5rem' },
            h('span', { class: 'row-meta', text: `${entry.guide || ''} · ${new Date(entry.at).toLocaleDateString()}` }),
            act('Remove', () => { prayers.unreflect(entry.id); ctx.refresh(); }, { quiet: true, small: true }))),
        h('span'))))));
  }

  // ── The church ──────────────────────────────────────────────────────────
  cards.push(card({ tone: 'paper', className: 'full', symbol: 'church', figureSize: 'sm' },
    badge('Praying with other people'),
    body('This app cannot pass a prayer request to anyone — there is no server behind it and nothing typed here is sent. For prayer with the church, come to the Tuesday meeting, or speak to a leader after the service.'),
    go('Church prayer meeting', () => ctx.go('connect'))));

  const el = h('div', { style: 'display:contents' }, ...cards);
  rise(cards);
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
  return h('div', { style: 'margin-top:.5rem;padding:0 .2rem' },
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
