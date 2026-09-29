// PRAY.
//
// Two halves that most church apps confuse. Guided prayer is for the person
// who wants to pray and does not know how to start; the prayer list is for the
// person who prays constantly and cannot hold it all in their head.
//
// The list stays on the device, and the screen says so where it matters rather
// than in a policy nobody opens. One prayer leaves only when the member taps
// "Share with the church" on it, which opens the prayer wall with it written
// in — signed with their first name, and sent only from there.

import { h, poster, label, display, headline, art, go, pill, choice,
         rows, row, note, rise, toast, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';
import * as prayers from '../core/prayers.js';
import * as agenda from '../core/agenda.js';

const toneOf = (name) => (name === 'poppy' ? 'rose' : (name === 'navy' ? 'ink' : (name || 'paper')));

export default async function prayScreen(ctx) {
  const parts = [];
  const [guides, categories, events] = await Promise.all([
    content.guides(), content.categories(), content.events().catch(() => []),
  ]);
  const today = rotation.pick(guides, { offset: 3 });
  const catTone = (id) => toneOf((categories.find((one) => one.id === id) || {}).tone);

  // ── Take a moment ───────────────────────────────────────────────────────
  parts.push(poster({ tone: toneOf(today.tone), tall: true },
    label(`Today · ${today.title}`),
    h('div', {},
      display('TAKE A MOMENT.'),
      h('p', { class: 'lead dim', style: 'margin-top:1.2rem', text: today.line })),
    h('div', { class: 'poster-foot' },
      pill('Pray now', () => ctx.go(`guide/${today.id}`)),
      art(today.symbol || 'flame', { tone: toneOf(today.tone), size: 'sm' }))));

  // ── Add to the list ─────────────────────────────────────────────────────
  const input = h('textarea', { placeholder: 'What do you want to pray about?', 'aria-label': 'A prayer to add' });
  let category = 'personal';
  const chips = h('div', { class: 'choice-list', style: 'margin-top:1rem' });
  const paintChips = () => swap(chips, ...categories.map((one) => choice(one.label, () => {
    category = one.id; paintChips();
  }, one.id === category ? { 'data-chosen': '' } : {})));
  paintChips();

  parts.push(poster({ tone: 'paper' },
    label('New prayer'),
    h('div', {},
      input,
      chips),
    h('div', { class: 'poster-foot' },
      pill('Add to my list', () => {
        const text = input.value.trim();
        if (!text) { toast('Write it first.'); input.focus(); return; }
        prayers.add({ text, category });
        input.value = '';
        toast('On your list.');
        ctx.refresh();
      }),
      note('Stored on this phone only. To ask the church to pray too, open it in your list and share it.'))));

  // ── The list ────────────────────────────────────────────────────────────
  //
  // Grouped by what it is about, because a prayer list read straight through
  // is a wall of worry. Each group is its own poster in its own colour.
  const open = prayers.open();
  if (open.length) {
    const grouped = categories
      .map((one) => ({ ...one, items: open.filter((item) => item.category === one.id) }))
      .filter((one) => one.items.length);
    const orphans = open.filter((item) => !categories.some((one) => one.id === item.category));
    if (orphans.length) grouped.push({ id: 'other', label: 'Other', line: '', tone: 'paper', items: orphans });

    for (const group of grouped) {
      parts.push(poster({ tone: toneOf(group.tone) },
        h('div', { class: 'poster-head' },
          label(group.label),
          h('span', { class: 'numeral', style: 'font-size:2rem', text: String(group.items.length) })),
        rows(...group.items.map((item) => prayerRow(ctx, item)))));
    }
  } else {
    parts.push(poster({ tone: 'paper' },
      label('My prayer list'),
      h('p', { class: 'body', text: 'Nothing on the list yet. Most people start with one name and one worry.' }),
      h('div', { class: 'poster-foot' }, h('span'), art('heart', { tone: 'paper', size: 'sm' }))));
  }

  // ── Answered ────────────────────────────────────────────────────────────
  //
  // Kept, never deleted. The point of a prayer list is being able to look back
  // at what God did with it, and an app that clears the row the moment it is
  // ticked destroys exactly the thing worth keeping.
  const answered = prayers.answered();
  if (answered.length) {
    parts.push(poster({ tone: 'sunshine' },
      label(`Answered · ${answered.length}`),
      rows(...answered.slice(0, 8).map((item) => h('div', {},
        h('p', { class: 'row-title', text: item.text }),
        item.answered.note ? h('p', { class: 'row-note', text: item.answered.note }) : null,
        h('div', { class: 'row-actions' },
          h('span', { class: 'row-meta', text: new Date(item.answered.at).toLocaleDateString() }),
          pill('Reopen', () => { prayers.reopen(item.id); ctx.refresh(); }, { quiet: true }))))),
      h('div', { class: 'poster-foot' }, h('span'), art('star', { tone: 'sunshine', size: 'sm' }))));
  }

  // ── The guides ──────────────────────────────────────────────────────────
  parts.push(poster({ tone: 'sky' },
    label('Guided prayer'),
    note('Each one is a few minutes, with a timer you can ignore.'),
    rows(...guides.map((one) => row({
      title: one.title,
      note: one.line,
      meta: `${Math.round(one.steps.reduce((sum, step) => sum + (step.seconds || 60), 0) / 60)} min`,
      onclick: () => ctx.go(`guide/${one.id}`),
    })))));

  // ── Reflections ─────────────────────────────────────────────────────────
  const written = prayers.reflections();
  if (written.length) {
    parts.push(poster({ tone: 'paper' },
      label(`Reflections · ${written.length} kept`),
      rows(...written.slice(0, 6).map((entry) => h('div', {},
        h('p', { class: 'row-title', text: entry.text }),
        h('div', { class: 'row-actions' },
          h('span', { class: 'row-meta', text: `${entry.guide || ''} · ${new Date(entry.at).toLocaleDateString()}` }),
          pill('Remove', () => { prayers.unreflect(entry.id); ctx.refresh(); }, { quiet: true })))))));
  }

  // ── The church ──────────────────────────────────────────────────────────
  //
  // The prayer meeting moves from week to week, so it is found by name in the
  // calendar — the soonest one still ahead — and named by its own day.
  const meeting = agenda.upcoming(events.filter((one) => /prayer meeting/i.test(one.title))).find((one) => one.at);
  const day = meeting ? meeting.at.toLocaleDateString(undefined, { weekday: 'long' }) : '';
  parts.push(poster({ tone: 'paper' },
    label('Praying with other people'),
    h('p', { class: 'body', text: meeting
      ? `Share a request on the prayer wall and the church can pray with you — it is signed with your first name. Or pray together at ${day}’s prayer meeting: ${agenda.stamp(meeting.at)}, ${meeting.event.where}.`
      : 'Share a request on the prayer wall and the church can pray with you — it is signed with your first name. Or speak to a leader after the service.' }),
    h('div', { class: 'pill-row', style: 'margin-top:1rem' },
      go('The prayer wall', () => ctx.go('wall')),
      meeting ? go(`${day}’s prayer meeting`, () => ctx.go('community')) : null),
    h('div', { class: 'poster-foot' }, h('span'), art('church', { tone: 'paper', size: 'sm' }))));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Pray', el };
}

/** One prayer, with its actions revealed on tap rather than always shown. */
function prayerRow(ctx, item) {
  const holder = h('div', {});
  let open = false;
  const noteInput = h('input', { type: 'text', placeholder: 'What happened? (optional)', 'aria-label': 'How it was answered' });

  const paint = () => {
    swap(holder,
      h('button', { class: 'row', type: 'button', 'aria-expanded': String(open),
        onclick: () => { open = !open; paint(); } },
        h('div', { class: 'row-top' },
          h('p', { class: 'row-title', text: item.text }),
          h('span', { class: 'row-meta', text: prayers.carriedFor(item) }))),
      open ? h('div', { class: 'row-actions', style: 'width:100%' },
        noteInput,
        pill('Answered', () => {
          prayers.answer(item.id, noteInput.value);
          toast('Moved to Answered. It is kept, not deleted.');
          ctx.refresh();
        }),
        pill('Share with the church', () => ctx.go(`wall?share=${encodeURIComponent(item.text)}`), { quiet: true }),
        pill('Remove', () => {
          prayers.remove(item.id);
          toast('Removed.');
          ctx.refresh();
        }, { quiet: true })) : null);
  };

  paint();
  return holder;
}
