// A Scripture moment, at length.
//
// Home shows the verse on a card. This unpacks it: a short reflection, one
// question, one prayer, one practice — each on its own card, because that is
// how this app separates one thought from the next.

import { h, card, badge, title, body, small, scripture, reference,
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

  cards.push(card({ solid: true, className: 'full', symbol: moment.symbol,
      foot: reference(`${moment.ref} · ${moment.translation}`, ctx.go) },
    badge(moment.theme),
    scripture(moment.text, { flow: true })));

  cards.push(card({ tone: 'paper' }, badge('Reflection'), body(moment.reflection)));

  cards.push(card({ tone: 'paper', symbol: 'blob', figureSize: 'sm' },
    badge('Sit with this'),
    h('p', { class: 'scripture scripture--flow', text: moment.question })));

  cards.push(card({ tone: 'paper' }, badge('Pray'), body(moment.prayer)));

  cards.push(card({ tone: 'paper' }, badge('Today'), body(moment.practice)));

  // ── Write something ─────────────────────────────────────────────────────
  const input = h('textarea', { placeholder: 'What is this saying to you? One sentence is enough.',
    'aria-label': 'Your reflection' });
  const done = progress.isDone('reflection', moment.id);

  cards.push(card({ tone: 'sky', className: 'full', foot: 'Stays on this device' },
    badge('Your own words'),
    input,
    actions(
      act('Keep this', () => {
        const text = input.value.trim();
        if (!text) { toast('Write a line first.'); input.focus(); return; }
        prayers.reflect({ text, guide: moment.theme, ref: moment.ref });
        progress.complete('reflection', moment.id);
        input.value = '';
        toast('Kept. It is in Pray, under Reflections.');
        ctx.refresh();
      }),
      done ? null : act('Mark as read', () => {
        progress.complete('reflection', moment.id);
        toast('Marked.');
        ctx.refresh();
      }, { quiet: true }))));

  const el = h('div', { style: 'display:contents' }, ...cards);
  rise(cards);
  return { title: moment.theme, el };
}
