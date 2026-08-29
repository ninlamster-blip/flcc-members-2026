// PRAY.
//
// Two halves that most church apps confuse. Guided prayer is for the person
// who wants to pray and does not know how to start; the prayer list is for the
// person who prays constantly and cannot hold it all in their head.
//
// Nothing here leaves the device, and the screen says so where it matters
// rather than in a policy nobody opens.

import { h, block, section, label, display, title, lead, body, small, scripture, cite, reference,
         act, actions, go, rows, row, rule, tag, rise, note, toast, waiting, swap} from '../core/ui.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';
import * as prayers from '../core/prayers.js';

export default async function prayScreen(ctx) {
  const blocks = [];
  const [guides, categories] = await Promise.all([content.guides(), content.categories()]);
  const accentOf = (id) => (categories.find((one) => one.id === id) || {}).accent || 'sage';
  const labelOf = (id) => (categories.find((one) => one.id === id) || {}).label || 'Personal';

  // ── Take a moment ───────────────────────────────────────────────────────
  const today = rotation.pick(guides, { offset: 3 });
  blocks.push(block({ tone: 'paper', tall: true, className: 'full',
      shape: { seed: 'pray-today', tones: ['peach', 'gold'] }, corner: 'tr', soft: true },
    h('div', {},
      label('Pray'),
      h('div', { style: 'margin-top:1.2rem' }, display('Take a moment.')),
      h('p', { class: 'lead', style: 'margin-top:.9rem;max-width:26ch', text: 'What is on your heart today?' })),
    h('div', {},
      h('p', { class: 'row-meta', style: 'margin-bottom:.7rem', text: `Today · ${today.title}` }),
      actions(
        act('Pray now', () => ctx.go(`guide/${today.id}`)),
        go('Other guides', () => document.getElementById('guides')?.scrollIntoView({ behavior: 'smooth', block: 'start' }))))));

  // ── The list ────────────────────────────────────────────────────────────
  const input = h('textarea', { placeholder: 'What do you want to pray about?', 'aria-label': 'A prayer to add',
    style: 'min-height:5.5rem' });
  let category = 'personal';
  const chips = h('div', { class: 'act-row', style: 'margin-top:.9rem' },
    ...categories.map((one) => {
      const button = act(one.label, () => {
        category = one.id;
        [...chips.children].forEach((child) => child.setAttribute('data-quiet', ''));
        button.removeAttribute('data-quiet');
      }, { small: true, quiet: one.id !== category });
      return button;
    }));

  const add = section({ className: 'full' },
    label('Add to your list'),
    input, chips,
    actions(act('Keep it', () => {
      const text = input.value.trim();
      if (!text) { toast('Write it first.'); input.focus(); return; }
      prayers.add({ text, category });
      input.value = '';
      toast('On your list.');
      ctx.refresh();
    })),
    small('Your prayer list is stored on this phone only. It is not sent to the church, to a leader, or to us.'));
  blocks.push(add);

  const open = prayers.open();
  if (open.length) {
    const grouped = categories
      .map((one) => ({ ...one, items: open.filter((item) => item.category === one.id) }))
      .filter((one) => one.items.length);
    // Anything whose category was removed from the content file still shows.
    const orphans = open.filter((item) => !categories.some((one) => one.id === item.category));
    if (orphans.length) grouped.push({ id: 'other', label: 'Other', accent: 'sage', items: orphans });

    blocks.push(section({ className: 'full' },
      h('div', { class: 'section-head' },
        label('My prayer list'),
        h('span', { class: 'row-meta', text: `${open.length} open` })),
      ...grouped.map((group) => section({},
        h('div', { class: 'section-head' },
          tag(group.label, group.accent),
          h('span', { class: 'row-meta', text: String(group.items.length) })),
        rows({ tight: true }, ...group.items.map((item) => prayerRow(ctx, item, group.accent)))))));
  } else {
    blocks.push(section({ className: 'full' },
      label('My prayer list'),
      note('Nothing on the list yet. Most people start with one name and one worry.')));
  }

  // ── Answered ────────────────────────────────────────────────────────────
  const answered = prayers.answered();
  if (answered.length) {
    blocks.push(section({ className: 'full' },
      h('div', { class: 'section-head' },
        label('Answered'),
        h('span', { class: 'row-meta', text: String(answered.length) })),
      rows({ tight: true },
        ...answered.slice(0, 8).map((item) => h('div', {},
          h('p', { class: 'row-title', text: item.text }),
          item.answered.note ? h('p', { class: 'row-note', text: item.answered.note }) : null,
          h('div', { class: 'act-row', style: 'margin-top:.5rem' },
            h('span', { class: 'row-meta', text: new Date(item.answered.at).toLocaleDateString() }),
            act('Reopen', () => { prayers.reopen(item.id); ctx.refresh(); }, { quiet: true, small: true })))))));
  }

  // ── The guides ──────────────────────────────────────────────────────────
  blocks.push(section({ className: 'full', id: 'guides' },
    label('Guided prayer'),
    small('Each one is a few minutes, with a timer you can ignore.'),
    rows({},
      ...guides.map((one) => row({
        title: one.title,
        note: one.line,
        meta: `${Math.round(one.steps.reduce((sum, step) => sum + (step.seconds || 60), 0) / 60)} min`,
        accent: one.accent,
        onclick: () => ctx.go(`guide/${one.id}`),
      })))));

  // ── Reflections ─────────────────────────────────────────────────────────
  const written = prayers.reflections();
  if (written.length) {
    blocks.push(section({ className: 'full' },
      h('div', { class: 'section-head' },
        label('Reflections'),
        h('span', { class: 'row-meta', text: String(written.length) })),
      rows({ tight: true },
        ...written.slice(0, 6).map((entry) => h('div', {},
          h('p', { class: 'body', text: entry.text }),
          h('div', { class: 'act-row', style: 'margin-top:.5rem' },
            entry.ref ? reference(entry.ref, ctx.go) : h('span', { class: 'row-meta', text: entry.guide || '' }),
            h('span', { class: 'row-meta', text: new Date(entry.at).toLocaleDateString() }),
            act('Remove', () => { prayers.unreflect(entry.id); ctx.refresh(); }, { quiet: true, small: true })))))));
  }

  // ── The church ──────────────────────────────────────────────────────────
  blocks.push(section({ className: 'full' },
    rule(),
    label('Praying with other people'),
    body('This app cannot pass a prayer request to anyone — there is no server behind it and nothing typed here is sent. For prayer with the church, come to the Tuesday meeting, or speak to a leader after the service.'),
    go('Church prayer meeting', () => ctx.go('connect'))));

  const el = h('div', { style: 'display:contents' }, ...blocks);
  rise(blocks);
  return { title: 'Pray', el };
}

/** One prayer, with its actions revealed on tap rather than always shown. */
function prayerRow(ctx, item, accent) {
  const holder = h('div', {});
  let open = false;

  const paint = () => {
    swap(holder, 
      h('button', { class: 'row', type: 'button', 'aria-expanded': String(open),
        onclick: () => { open = !open; paint(); } },
        h('i', { class: 'stem', dataset: { accent } }),
        h('div', {},
          h('p', { class: 'row-title', text: item.text })),
        h('span', { class: 'row-meta', text: prayers.carriedFor(item) })),
      open ? answerBox(ctx, item) : null);
  };

  paint();
  return holder;
}

function answerBox(ctx, item) {
  const noteInput = h('input', { type: 'text', placeholder: 'What happened? (optional)', 'aria-label': 'How it was answered' });
  return h('div', { style: 'margin-top:.7rem' },
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
