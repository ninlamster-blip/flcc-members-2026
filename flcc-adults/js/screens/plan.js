// One reading plan.
//
// A plan is a sequence, not a calendar: day 12 is the twelfth reading you have
// done, not the twelfth day since you started. There is nothing to catch up on
// and no red number for a week away — see js/core/plan.js for why that is the
// single decision that keeps adults reading.

import { h, block, section, label, display, title, lead, body, small, reference,
         act, actions, go, rows, row, thread, rule, rise, note, toast } from '../core/ui.js';
import * as content from '../core/content.js';
import * as plan from '../core/plan.js';

export default async function planScreen(ctx) {
  const [id] = ctx.route.args;
  const plans = await content.plans();
  const current = plans.find((one) => one.id === id);
  if (!current) return { title: 'Reading plan', el: section({ className: 'full' }, note('That plan has moved.')) };

  const active = plan.state().id === current.id;
  const at = plan.positionIn(current);
  const blocks = [];

  const openAt = async (ref) => {
    const module = await import('../core/scripture.js');
    const { books } = await module.manifest();
    const found = module.parseRef(ref, books);
    ctx.go(found ? `bible/${found.book.n}/${found.chapter}` : 'bible');
  };

  blocks.push(block({ tone: 'paper', className: 'full',
      shape: { seed: current.id, tones: current.tones }, corner: 'br', soft: true },
    label(current.kicker),
    h('div', {},
      display(current.title),
      h('p', { class: 'lead', style: 'margin-top:.9rem;max-width:32ch', text: current.blurb })),
    h('div', {},
      active
        ? h('div', {}, thread(at.percent, 'gold'),
            h('p', { class: 'small', style: 'margin-top:.5rem',
              text: at.done ? `Finished · all ${at.total} days` : `Day ${at.day} of ${at.total} · ${at.finished} read` }))
        : actions(act('Start this plan', () => { plan.start(current.id); toast('Started. It is on your Home screen.'); ctx.refresh(); })))));

  // ── Today's reading ─────────────────────────────────────────────────────
  if (active && !at.done && at.at) {
    blocks.push(section({ className: 'full' },
      label(`Day ${at.day}`),
      title(at.at.ref),
      body(at.at.note),
      actions(
        act('Read it', () => openAt(at.at.ref)),
        act('Mark as read', () => {
          plan.markRead(current, at.day);
          toast(at.day >= at.total ? 'That is the whole plan. Well done.' : 'Marked. Day ' + (at.day + 1) + ' next time.');
          ctx.refresh();
        }, { quiet: true }))));
  }

  if (active && at.done) {
    blocks.push(section({ className: 'full' },
      label('Finished'),
      title('You read the whole thing.'),
      body('It stays here if you want to go through it again — the days are marked, and starting another plan does not erase them.'),
      actions(act('Choose another plan', () => ctx.go('bible'), { quiet: true }))));
  }

  // ── Every day ───────────────────────────────────────────────────────────
  blocks.push(section({ className: 'full' },
    h('div', { class: 'section-head' },
      label('Every day'),
      h('span', { class: 'row-meta', text: `${current.days.length} readings` })),
    rows({ tight: true },
      ...current.days.map((day, i) => {
        const n = i + 1;
        const read = plan.isRead(current, n);
        return row({
          number: n,
          title: day.ref,
          note: day.note,
          meta: read ? 'Read' : '',
          onclick: () => openAt(day.ref),
        });
      }))));

  if (active) {
    blocks.push(section({ className: 'full' },
      rule(),
      small('Stopping a plan keeps every day you have already read. You can pick it up later exactly where it was.'),
      actions(act('Stop this plan', () => { plan.stop(); toast('Stopped. Nothing was lost.'); ctx.refresh(); }, { quiet: true, small: true }))));
  }

  const el = h('div', { style: 'display:contents' }, ...blocks);
  rise(blocks);
  return { title: current.title, el };
}
