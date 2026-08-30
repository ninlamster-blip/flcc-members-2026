// One reading plan.
//
// A plan is a sequence, not a calendar: day 12 is the twelfth reading you have
// done, not the twelfth day since you started. See js/core/plan.js for why
// that is the single decision that keeps adults reading.

import { h, card, badge, display, title, body, small,
         act, actions, go, rows, row, section, thread, rise, note, toast } from '../core/ui.js';
import * as content from '../core/content.js';
import * as plan from '../core/plan.js';

export default async function planScreen(ctx) {
  const [id] = ctx.route.args;
  const plans = await content.plans();
  const current = plans.find((one) => one.id === id);
  if (!current) return { title: 'Reading plan', el: card({ tone: 'paper', className: 'full' }, note('That plan has moved.')) };

  const active = plan.state().id === current.id;
  const at = plan.positionIn(current);
  const cards = [];

  const openAt = async (ref) => {
    const module = await import('../core/scripture.js');
    const { books } = await module.manifest();
    const found = module.parseRef(ref, books);
    ctx.go(found ? `bible/${found.book.n}/${found.chapter}` : 'bible');
  };

  cards.push(card({ tone: current.tone, className: 'full', symbol: current.symbol,
      foot: active ? (at.done ? `Finished · all ${at.total} days` : `Day ${at.day} of ${at.total}`) : `${current.days.length} days` },
    badge(current.kicker),
    h('div', {},
      display(current.title),
      h('p', { class: 'lead', style: 'margin-top:.7rem;max-width:30ch', text: current.blurb })),
    active ? thread(at.percent, 'sunshine') : null,
    active ? null : actions(act('Start this plan', () => {
      plan.start(current.id); toast('Started. It is on your Home screen.'); ctx.refresh();
    }))));

  if (active && !at.done && at.at) {
    cards.push(card({ tone: 'paper', className: 'full', symbol: 'book', figureSize: 'sm',
        foot: `Day ${at.day} of ${at.total}` },
      badge(`Day ${at.day}`),
      title(at.at.ref),
      body(at.at.note),
      actions(
        act('Read it', () => openAt(at.at.ref)),
        act('Mark as read', () => {
          plan.markRead(current, at.day);
          toast(at.day >= at.total ? 'That is the whole plan. Well done.' : `Marked. Day ${at.day + 1} next time.`);
          ctx.refresh();
        }, { quiet: true }))));
  }

  if (active && at.done) {
    cards.push(card({ tone: 'sunshine', className: 'full', symbol: 'star', figureSize: 'sm',
        foot: ['The whole plan'] },
      badge('Finished'),
      title('You read the whole thing.'),
      body('It stays here if you want to go through it again — the days are marked, and starting another plan does not erase them.'),
      actions(act('Choose another plan', () => ctx.go('bible'), { quiet: true }))));
  }

  cards.push(section({ className: 'full' },
    badge(`Every day · ${current.days.length} readings`),
    rows({}, ...current.days.map((day, i) => row({
      number: i + 1,
      title: day.ref,
      note: day.note,
      meta: plan.isRead(current, i + 1) ? 'Read' : '',
      onclick: () => openAt(day.ref),
    })))));

  if (active) {
    cards.push(card({ tone: 'paper', className: 'full' },
      small('Stopping a plan keeps every day you have already read. You can pick it up later exactly where it was.'),
      actions(act('Stop this plan', () => {
        plan.stop(); toast('Stopped. Nothing was lost.'); ctx.refresh();
      }, { quiet: true, small: true }))));
  }

  const el = h('div', { style: 'display:contents' }, ...cards);
  rise(cards);
  return { title: current.title, el };
}
