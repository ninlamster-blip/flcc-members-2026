// One message.
//
// The shape is the same every time: what it was preached from, what it said,
// the question it left behind, and room to write one line back. Three
// takeaways is the ceiling on purpose — a member reading this on a phone at
// the end of a shift will read three and skim seven.

import { h, block, card, badge, display, title, body, small, scripture, reference,
         act, actions, go, nextLine, rows, row, section, doneMark,
         rise, note, toast, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import * as prayers from '../core/prayers.js';

export default async function messageScreen(ctx) {
  const [id] = ctx.route.args;
  const all = await content.messages();
  const one = all.find((item) => item.id === id);
  if (!one) {
    return { title: 'Watch', el: card({ tone: 'paper', className: 'full' }, note('That message has moved.')) };
  }

  const when = new Date(`${one.date}T00:00:00`)
    .toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const opened = progress.isDone('message', one.id);
  const parts = [];

  parts.push(block({ className: 'full' },
    // The first message of a series usually shares its name, and printing it
    // as the eyebrow above itself says the same words twice in two sizes.
    badge(one.series === one.title ? 'Message' : one.series),
    display(one.title),
    h('p', { class: 'lead', text: `${one.speaker} · ${when} · ${one.minutes} min` }),
    reference(one.ref, ctx.go),
    one.url
      ? actions(act('Watch the recording', () => window.open(one.url, '_blank', 'noopener')))
      : h('p', { class: 'small', text: 'No recording has been published for this one. What was said is below.' })));

  parts.push(card({ tone: 'paper', className: 'full' },
    badge('What it was about'),
    body(one.blurb)));

  parts.push(section({ className: 'full' },
    nextLine('What it said'),
    rows({}, ...one.takeaways.map((line, i) => row({ number: i + 1, title: line })))));

  parts.push(card({ tone: 'paper', className: 'full', symbol: 'blob' },
    badge('Sit with this'),
    h('p', { class: 'scripture scripture--flow', text: one.question })));

  // ── Write one line back ─────────────────────────────────────────────────
  const input = h('textarea', { placeholder: 'What is this saying to you? One sentence is enough.',
    'aria-label': 'Your reflection' });
  const mark = h('div', {});

  parts.push(card({ tone: 'paper', className: 'full', foot: 'Stays on this device' },
    badge('Your own words'),
    input,
    mark,
    actions(
      act('Keep this', () => {
        const text = input.value.trim();
        if (!text) { toast('Write a line first.'); input.focus(); return; }
        prayers.reflect({ text, guide: `${one.series}: ${one.title}`, ref: one.ref });
        progress.complete('message', one.id);
        input.value = '';
        swap(mark, doneMark('Kept · it is in Pray, under reflections'));
      }),
      opened ? null : act('Mark as heard', () => {
        progress.complete('message', one.id);
        swap(mark, doneMark('Marked as heard'));
      }, { quiet: true }))));

  parts.push(section({ className: 'full' },
    go('All messages', () => ctx.go('watch')),
    small('Nothing you write here is sent to the church, to the preacher, or to us. It is on this phone.')));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: one.title, el };
}
