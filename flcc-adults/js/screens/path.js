// One learning path, and everything in it.

import { h, block, section, label, display, title, body, small,
         act, actions, go, rows, row, thread, rise, note } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';

export default async function pathScreen(ctx) {
  const [id] = ctx.route.args;
  const [paths, sessions] = await Promise.all([content.paths(), content.sessions(id).catch(() => [])]);
  const path = paths.find((one) => one.id === id);
  if (!path) return { title: 'Grow', el: section({ className: 'full' }, note('That path has moved.')) };

  const where = progress.through('session', sessions.map((one) => `${id}:${one.id}`));
  const next = sessions.find((one) => !progress.isDone('session', `${id}:${one.id}`)) || sessions[0];
  const blocks = [];

  blocks.push(block({ tone: 'paper', className: 'full',
      shape: { seed: path.id, tones: path.tones }, corner: 'tr', soft: true },
    label(path.kicker),
    h('div', {},
      display(path.title),
      h('p', { class: 'lead', style: 'margin-top:.9rem;max-width:32ch', text: path.blurb })),
    h('div', {},
      where.finished ? h('div', { style: 'margin-bottom:.9rem' }, thread(where.percent)) : null,
      h('p', { class: 'row-meta', style: 'margin-bottom:.9rem',
        text: where.finished ? `${where.finished} of ${where.total} finished` : `${where.total} sessions · ${path.minutes}` }),
      next ? actions(act(where.finished ? 'Continue' : 'Start the first session',
        () => ctx.go(`session/${path.id}/${next.id}`))) : null)));

  blocks.push(section({ className: 'full' },
    label('Sessions'),
    rows({},
      ...sessions.map((one, i) => row({
        number: i + 1,
        title: one.title,
        note: one.ref,
        meta: progress.isDone('session', `${id}:${one.id}`) ? 'Read' : '',
        onclick: () => ctx.go(`session/${path.id}/${one.id}`),
      })))));

  if (where.done) {
    blocks.push(section({ className: 'full' },
      label('Finished'),
      title('That is the whole path.'),
      body('Take one thing from it into this week. A path read and not acted on is a path read.'),
      go('Back to Grow', () => ctx.go('grow'))));
  }

  const el = h('div', { style: 'display:contents' }, ...blocks);
  rise(blocks);
  return { title: path.title, el };
}
