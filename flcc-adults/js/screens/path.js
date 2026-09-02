// One learning path, and everything in it.

import { h, poster, label, display, headline, art, go, pill, track,
         rows, row, note, rise } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';

const toneOf = (name) => (name === 'poppy' ? 'rose' : (name === 'navy' ? 'ink' : (name || 'paper')));

export default async function pathScreen(ctx) {
  const [id] = ctx.route.args;
  const [paths, sessions] = await Promise.all([content.paths(), content.sessions(id).catch(() => [])]);
  const path = paths.find((one) => one.id === id);
  if (!path) {
    return { title: 'Grow', el: poster({ tone: 'paper' }, label('Grow'), note('That path has moved.')) };
  }

  const tone = toneOf(path.tone);
  const where = progress.through('session', sessions.map((one) => `${id}:${one.id}`));
  const next = sessions.find((one) => !progress.isDone('session', `${id}:${one.id}`)) || sessions[0];
  const parts = [];

  parts.push(poster({ tone, tall: true },
    label(path.kicker),
    h('div', {},
      display(String(path.title).toUpperCase()),
      h('p', { class: 'lead dim', style: 'margin-top:1rem', text: path.blurb }),
      where.finished ? h('div', { style: 'margin-top:1.6rem' }, track(where.percent)) : null,
      h('p', { class: 'body dim', style: 'margin-top:.8rem', text: where.finished
        ? `${where.finished} of ${where.total} finished`
        : `${where.total} sessions · ${path.minutes}` })),
    h('div', { class: 'poster-foot' },
      next ? pill(where.finished ? 'Continue' : 'Start the first session',
        () => ctx.go(`session/${path.id}/${next.id}`)) : h('span'),
      art(path.symbol || 'book', { tone, size: 'sm' }))));

  parts.push(poster({ tone: 'paper' },
    label('Sessions'),
    rows(...sessions.map((one, i) => row({
      title: `${i + 1}. ${one.title}`,
      note: one.ref,
      meta: progress.isDone('session', `${id}:${one.id}`) ? 'Read' : '',
      onclick: () => ctx.go(`session/${path.id}/${one.id}`),
    })))));

  if (where.done) {
    parts.push(poster({ tone: 'sunshine' },
      label('Finished'),
      h('div', {},
        headline('THAT IS THE WHOLE PATH.'),
        h('p', { class: 'body dim', style: 'margin-top:1rem',
          text: 'Take one thing from it into this week. A path read and not acted on is a path read.' })),
      h('div', { class: 'poster-foot' },
        go('Back to Grow', () => ctx.go('grow')),
        art('star', { tone: 'sunshine', size: 'sm' }))));
  }

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: path.title, el };
}
