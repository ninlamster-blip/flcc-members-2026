// A Scripture moment, at length.
//
// Today shows the verse on a poster. This unpacks it: a short reflection, one
// question, one prayer, one practice — each on its own block of colour,
// because that is how this app separates one thought from the next.

import { h, poster, label, display, headline, art, go, pill, scripture, reference,
         note, rise, toast, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';
import * as progress from '../core/progress.js';
import * as prayers from '../core/prayers.js';

const toneOf = (name) => (name === 'poppy' ? 'rose' : (name === 'navy' ? 'ink' : (name || 'paper')));

export default async function momentScreen(ctx) {
  const [id] = ctx.route.args;
  const all = await content.moments();
  const moment = all.find((one) => one.id === id) || rotation.pick(all);
  if (!moment) {
    return { title: 'Today', el: poster({ tone: 'paper' }, label('Today'), note('Nothing to read today.')) };
  }

  const tone = toneOf(moment.tone);
  const parts = [];

  parts.push(poster({ tone, tall: true },
    label(moment.theme),
    h('div', {},
      scripture(moment.text, { flow: true }),
      reference(`${moment.ref} · ${moment.translation}`, ctx.go, { style: 'margin-top:1.2rem' })),
    h('div', { class: 'poster-foot' }, h('span'),
      art(moment.symbol || 'book', { tone, size: 'sm' }))));

  parts.push(poster({ tone: 'paper' },
    label('Reflection'),
    h('p', { class: 'body', text: moment.reflection })));

  parts.push(poster({ tone: 'sky' },
    label('Sit with this'),
    headline(moment.question),
    h('div', { class: 'poster-foot' }, h('span'), art('blob', { tone: 'sky', size: 'sm' }))));

  parts.push(poster({ tone: 'paper' }, label('Pray'), h('p', { class: 'body', text: moment.prayer })));
  parts.push(poster({ tone: 'paper' }, label('Today'), h('p', { class: 'body', text: moment.practice })));

  // ── Write something ─────────────────────────────────────────────────────
  const input = h('textarea', { placeholder: 'What is this saying to you? One sentence is enough.',
    'aria-label': 'Your reflection' });
  const done = progress.isDone('reflection', moment.id);
  const mark = h('div', {});

  parts.push(poster({ tone: 'sunshine' },
    label('Your own words'),
    h('div', {}, input, mark),
    h('div', { class: 'poster-foot' },
      h('div', { class: 'pill-row' },
        pill('Keep this', () => {
          const text = input.value.trim();
          if (!text) { toast('Write a line first.'); input.focus(); return; }
          prayers.reflect({ text, guide: moment.theme, ref: moment.ref });
          progress.complete('reflection', moment.id);
          input.value = '';
          swap(mark, h('p', { class: 'note', style: 'margin-top:.8rem', text: 'Kept — it is in Pray, under Reflections.' }));
        }),
        done ? null : pill('Mark as read', () => {
          progress.complete('reflection', moment.id);
          swap(mark, h('p', { class: 'note', style: 'margin-top:.8rem', text: 'Marked.' }));
        }, { quiet: true })),
      h('span', { class: 'row-meta', text: 'Stays on this device' }))));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: moment.theme, el };
}
