// A Scripture moment, at length.
//
// Home shows the verse on a card. This unpacks it: a short reflection, one
// question, one prayer, one practice — each on its own card, because that is
// how this app separates one thought from the next.

import { h, block, card, badge, title, body, small, scripture, reference, doneMark,
         act, actions, rows, rise, note, toast, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';
import * as progress from '../core/progress.js';
import * as prayers from '../core/prayers.js';

export default async function momentScreen(ctx) {
  const [id] = ctx.route.args;
  const all = await content.moments();
  const moment = all.find((one) => one.id === id) || rotation.pick(all);
  if (!moment) return { title: 'Today', el: card({ tone: 'paper', className: 'full' }, note('Nothing to read today.')) };

  const cards = [];

  cards.push(block({ className: 'full' },
    badge(moment.theme),
    scripture(moment.text),
    reference(`${moment.ref} · ${moment.translation}`, ctx.go)));

  cards.push(card({ tone: 'paper', className: 'full' }, badge('Reflection'), body(moment.reflection)));

  cards.push(card({ tone: 'paper', className: 'full', symbol: 'blob' },
    badge('Sit with this'),
    h('p', { class: 'scripture scripture--flow', text: moment.question })));

  cards.push(card({ tone: 'paper', className: 'full' }, badge('Pray'), body(moment.prayer)));

  cards.push(card({ tone: 'paper', className: 'full' }, badge('Today'), body(moment.practice)));

  // ── Write something ─────────────────────────────────────────────────────
  const input = h('textarea', { placeholder: 'What is this saying to you? One sentence is enough.',
    'aria-label': 'Your reflection' });
  const done = progress.isDone('reflection', moment.id);

  const mark = h('div', {});
  cards.push(card({ tone: 'paper', className: 'full', foot: 'Stays on this device' },
    badge('Your own words'),
    input,
    mark,
    actions(
      act('Keep this', () => {
        const text = input.value.trim();
        if (!text) { toast('Write a line first.'); input.focus(); return; }
        prayers.reflect({ text, guide: moment.theme, ref: moment.ref });
        progress.complete('reflection', moment.id);
        input.value = '';
        swap(mark, doneMark('Kept · it is in Pray, under reflections'));
      }),
      done ? null : act('Mark as read', () => {
        progress.complete('reflection', moment.id);
        swap(mark, doneMark('Marked as read'));
      }, { quiet: true }))));

  const el = h('div', { style: 'display:contents' }, ...cards);
  rise(cards);
  return { title: moment.theme, el };
}
