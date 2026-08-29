// A Scripture moment, at length.
//
// Home shows the verse. This shows what to do with it: a short reflection, one
// question, one prayer, one practice — and a box to write in, because the
// difference between reading a verse and being changed by one is usually a
// sentence written down.

import { h, block, section, label, title, lead, body, small, scripture, cite, reference,
         act, actions, go, rows, rise, note, toast } from '../core/ui.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';
import * as progress from '../core/progress.js';
import * as prayers from '../core/prayers.js';

export default async function momentScreen(ctx) {
  const [id] = ctx.route.args;
  const all = await content.moments();
  const moment = all.find((one) => one.id === id) || rotation.pick(all);
  if (!moment) return { title: 'Today', el: block({ tone: 'paper', className: 'full' }, note('Nothing to read today.')) };

  const blocks = [];

  blocks.push(block({ tone: 'paper', className: 'full',
      shape: { seed: moment.id, tones: moment.tones }, corner: 'tr', soft: true },
    label(moment.theme),
    scripture(moment.text, { flow: true }),
    reference(`${moment.ref} · ${moment.translation}`, ctx.go)));

  blocks.push(section({},
    label('Reflection'),
    body(moment.reflection)));

  blocks.push(section({},
    label('Sit with this'),
    h('p', { class: 'scripture scripture--flow', text: moment.question })));

  blocks.push(section({},
    label('Pray'),
    body(moment.prayer)));

  blocks.push(section({},
    label('Today'),
    body(moment.practice)));

  // ── Write something ─────────────────────────────────────────────────────
  const input = h('textarea', { placeholder: 'What is this saying to you? One sentence is enough.',
    'aria-label': 'Your reflection' });
  const done = progress.isDone('reflection', moment.id);

  const keep = section({ className: 'full' },
    label('Your own words'),
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
      }, { quiet: true })),
    small('Reflections stay on this device. Nothing is sent to the church.'));
  blocks.push(keep);

  const el = h('div', { style: 'display:contents' }, ...blocks);
  rise(blocks);
  return { title: moment.theme, el };
}
