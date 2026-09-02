// One session of a path.
//
// The shape is fixed and deliberately short: the passage, three paragraphs, a
// question to sit with, one thing to do, and a prayer. An adult with forty
// spare minutes a week will finish this. An adult with ten will finish it too.

import { h, poster, label, display, headline, art, go, pill, scripture, reference,
         note, rise, toast } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import * as prayers from '../core/prayers.js';

const toneOf = (name) => (name === 'poppy' ? 'rose' : (name === 'navy' ? 'ink' : (name || 'paper')));

export default async function sessionScreen(ctx) {
  const [pathId, sessionId] = ctx.route.args;
  const [paths, sessions] = await Promise.all([content.paths(), content.sessions(pathId).catch(() => [])]);
  const path = paths.find((one) => one.id === pathId);
  const index = sessions.findIndex((one) => one.id === sessionId);
  const session = sessions[index];
  if (!path || !session) {
    return { title: 'Grow', el: poster({ tone: 'paper' }, label('Grow'), note('That session has moved.')) };
  }

  const tone = toneOf(path.tone);
  const key = `${pathId}:${session.id}`;
  const done = progress.isDone('session', key);
  const next = sessions[index + 1] || null;
  const parts = [];

  parts.push(poster({ tone, tall: true },
    label(`${path.title} · ${index + 1} of ${sessions.length}`),
    h('div', {},
      display(String(session.title).toUpperCase()),
      h('div', { style: 'margin-top:1.4rem' }, scripture(session.text, { flow: true })),
      reference(session.ref, ctx.go, { style: 'margin-top:1rem' })),
    h('div', { class: 'poster-foot' }, h('span'),
      art(path.symbol || 'book', { tone, size: 'sm' }))));

  parts.push(poster({ tone: 'paper' },
    label('The reading'),
    h('div', {}, ...session.body.map((paragraph) => h('p', { class: 'body', text: paragraph })))));

  parts.push(poster({ tone: 'sky' },
    label('Sit with this'),
    headline(session.question),
    h('div', { class: 'poster-foot' }, h('span'), art('blob', { tone: 'sky', size: 'sm' }))));

  parts.push(poster({ tone: 'paper' }, label('This week'), h('p', { class: 'body', text: session.practice })));
  parts.push(poster({ tone: 'paper' }, label('Pray'), h('p', { class: 'body', text: session.prayer })));

  const input = h('textarea', { placeholder: 'Anything you want to keep? (optional)', 'aria-label': 'Your notes' });

  parts.push(poster({ tone: 'sunshine' },
    label('Your own words'),
    input,
    h('div', { class: 'poster-foot' },
      h('div', { class: 'pill-row' },
        pill(done ? 'Read again' : 'Mark as read', () => {
          const text = input.value.trim();
          if (text) prayers.reflect({ text, guide: `${path.title}: ${session.title}`, ref: session.ref });
          progress.complete('session', key);
          toast(next ? 'Marked. The next session is ready.' : 'That is the last one in this path.');
          if (next) ctx.go(`session/${pathId}/${next.id}`); else ctx.go(`path/${pathId}`);
        }),
        next
          ? pill('Next session', () => ctx.go(`session/${pathId}/${next.id}`), { quiet: true })
          : pill('Back to the path', () => ctx.go(`path/${pathId}`), { quiet: true })),
      h('span', { class: 'row-meta', text: done ? 'Read before' : 'Stays on this device' }))));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: session.title, el };
}
