// One session of a path.
//
// The shape is fixed and deliberately short: the passage, three paragraphs, a
// question to sit with, one thing to do, and a prayer. An adult with forty
// spare minutes a week will finish this. An adult with ten will finish it too.

import { h, block, section, label, display, title, body, small, scripture, reference,
         act, actions, go, rule, rise, note, toast } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import * as prayers from '../core/prayers.js';

export default async function sessionScreen(ctx) {
  const [pathId, sessionId] = ctx.route.args;
  const [paths, sessions] = await Promise.all([content.paths(), content.sessions(pathId).catch(() => [])]);
  const path = paths.find((one) => one.id === pathId);
  const index = sessions.findIndex((one) => one.id === sessionId);
  const session = sessions[index];
  if (!path || !session) return { title: 'Grow', el: section({ className: 'full' }, note('That session has moved.')) };

  const key = `${pathId}:${session.id}`;
  const done = progress.isDone('session', key);
  const next = sessions[index + 1] || null;
  const blocks = [];

  blocks.push(block({ tone: 'paper', className: 'full',
      shape: { seed: `${pathId}-${session.id}`, tones: path.tones }, corner: index % 2 ? 'tl' : 'br', soft: true },
    label(`${path.title} · ${index + 1} of ${sessions.length}`),
    h('div', {},
      display(session.title),
      h('div', { style: 'margin-top:1.6rem' }, scripture(session.text, { flow: true })),
      h('div', { style: 'margin-top:1rem' }, reference(session.ref, ctx.go)))));

  blocks.push(section({ className: 'full' },
    ...session.body.map((paragraph) => body(paragraph))));

  blocks.push(section({},
    label('Sit with this'),
    h('p', { class: 'scripture scripture--flow', text: session.question })));

  blocks.push(section({},
    label('This week'),
    body(session.practice)));

  blocks.push(section({},
    label('Pray'),
    body(session.prayer)));

  const input = h('textarea', { placeholder: 'Anything you want to keep? (optional)', 'aria-label': 'Your notes' });
  blocks.push(section({ className: 'full' },
    rule(),
    label('Your own words'),
    input,
    actions(
      act(done ? 'Read again' : 'Mark as read', () => {
        const text = input.value.trim();
        if (text) prayers.reflect({ text, guide: `${path.title}: ${session.title}`, ref: session.ref });
        progress.complete('session', key);
        toast(next ? 'Marked. The next session is ready.' : 'That is the last one in this path.');
        if (next) ctx.go(`session/${pathId}/${next.id}`); else ctx.go(`path/${pathId}`);
      }),
      next ? act('Next session', () => ctx.go(`session/${pathId}/${next.id}`), { quiet: true })
           : act('Back to the path', () => ctx.go(`path/${pathId}`), { quiet: true })),
    small(done ? 'You have read this one before. Reading it again does not change anything.' : 'Notes stay on this device.')));

  const el = h('div', { style: 'display:contents' }, ...blocks);
  rise(blocks);
  return { title: session.title, el };
}
