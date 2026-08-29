// One learning path, and everything in it.

import { h, card, badge, display, title, body, small, starRow,
         act, actions, go, rows, row, section, thread, rise, note } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';

export default async function pathScreen(ctx) {
  const [id] = ctx.route.args;
  const [paths, sessions] = await Promise.all([content.paths(), content.sessions(id).catch(() => [])]);
  const path = paths.find((one) => one.id === id);
  if (!path) return { title: 'Grow', el: card({ tone: 'paper', className: 'full' }, note('That path has moved.')) };

  const where = progress.through('session', sessions.map((one) => `${id}:${one.id}`));
  const next = sessions.find((one) => !progress.isDone('session', `${id}:${one.id}`)) || sessions[0];
  const cards = [];

  cards.push(card({ tone: path.tone, className: 'full', symbol: path.symbol,
      foot: [where.finished ? `${where.finished} of ${where.total} finished` : `${where.total} sessions · ${path.minutes}`,
             starRow(Math.max(1, Math.round((where.percent / 100) * 5)))] },
    badge(path.kicker),
    h('div', {},
      display(path.title),
      h('p', { class: 'lead', style: 'margin-top:.7rem;max-width:30ch', text: path.blurb })),
    where.finished ? thread(where.percent, 'sunshine') : null,
    next ? actions(act(where.finished ? 'Continue' : 'Start the first session',
      () => ctx.go(`session/${path.id}/${next.id}`))) : null));

  cards.push(section({ className: 'full' },
    badge('Sessions'),
    rows({}, ...sessions.map((one, i) => row({
      number: i + 1,
      title: one.title,
      note: one.ref,
      meta: progress.isDone('session', `${id}:${one.id}`) ? 'Read' : '',
      onclick: () => ctx.go(`session/${path.id}/${one.id}`),
    })))));

  if (where.done) {
    cards.push(card({ tone: 'sunshine', className: 'full', symbol: 'star', figureSize: 'sm',
        foot: ['All done', starRow(5)] },
      badge('Finished'),
      title('That is the whole path.'),
      body('Take one thing from it into this week. A path read and not acted on is a path read.'),
      go('Back to Grow', () => ctx.go('grow'))));
  }

  const el = h('div', { style: 'display:contents' }, ...cards);
  rise(cards);
  return { title: path.title, el };
}
