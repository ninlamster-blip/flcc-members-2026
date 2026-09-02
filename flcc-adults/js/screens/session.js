// One session of a path.
//
// The shape is fixed and deliberately short: the passage, three paragraphs, a
// question to sit with, one thing to do, and a prayer. An adult with forty
// spare minutes a week will finish this. An adult with ten will finish it too.

import { h, block, card, badge, display, title, body, small, scripture, reference,
         act, actions, go, rise, note, toast } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import * as prayers from '../core/prayers.js';

export default async function sessionScreen(ctx) {
  const [pathId, sessionId] = ctx.route.args;
  const [paths, sessions] = await Promise.all([content.paths(), content.sessions(pathId).catch(() => [])]);
  const path = paths.find((one) => one.id === pathId);
  const index = sessions.findIndex((one) => one.id === sessionId);
  const session = sessions[index];
  if (!path || !session) return { title: 'Grow', el: card({ tone: 'paper', className: 'full' }, note('That session has moved.')) };

  const key = `${pathId}:${session.id}`;
  const done = progress.isDone('session', key);
  const next = sessions[index + 1] || null;
  const cards = [];

  cards.push(block({ className: 'full' },
    badge(`${path.title} · ${index + 1} of ${sessions.length}`),
    display(session.title),
    scripture(session.text, { flow: true }),
    reference(session.ref, ctx.go)));

  cards.push(card({ tone: 'paper', className: 'full' },
    ...session.body.map((paragraph) => body(paragraph))));

  cards.push(card({ tone: 'paper', className: 'full', symbol: 'blob' },
    badge('Sit with this'),
    h('p', { class: 'scripture scripture--flow', text: session.question })));

  cards.push(card({ tone: 'paper', className: 'full' }, badge('This week'), body(session.practice)));
  cards.push(card({ tone: 'paper', className: 'full' }, badge('Pray'), body(session.prayer)));

  const input = h('textarea', { placeholder: 'Anything you want to keep? (optional)', 'aria-label': 'Your notes' });
  cards.push(card({ tone: 'paper', className: 'full',
      foot: done ? 'You have read this one before' : 'Notes stay on this device' },
    badge('Your own words'),
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
           : act('Back to the path', () => ctx.go(`path/${pathId}`), { quiet: true }))));

  const el = h('div', { style: 'display:contents' }, ...cards);
  rise(cards);
  return { title: session.title, el };
}
