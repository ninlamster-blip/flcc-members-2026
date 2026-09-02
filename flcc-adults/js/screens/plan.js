// One reading plan.
//
// A plan is a sequence, not a calendar: day 12 is the twelfth reading you have
// done, not the twelfth day since you started. See js/core/plan.js for why
// that is the single decision that keeps adults reading.

import { h, poster, label, display, headline, art, go, pill, track,
         rows, row, note, rise, toast } from '../core/ui.js';
import * as content from '../core/content.js';
import * as plan from '../core/plan.js';

const toneOf = (name) => (name === 'poppy' ? 'rose' : (name === 'navy' ? 'ink' : (name || 'paper')));

export default async function planScreen(ctx) {
  const [id] = ctx.route.args;
  const plans = await content.plans();
  const current = plans.find((one) => one.id === id);
  if (!current) {
    return { title: 'Reading plan', el: poster({ tone: 'paper' }, label('Reading plan'), note('That plan has moved.')) };
  }

  const tone = toneOf(current.tone);
  const active = plan.state().id === current.id;
  const at = plan.positionIn(current);
  const parts = [];

  const openAt = async (ref) => {
    try {
      const module = await import('../core/scripture.js');
      const { books } = await module.manifest();
      const found = module.parseRef(ref, books);
      ctx.go(found ? `bible/${found.book.n}/${found.chapter}` : 'bible');
    } catch { ctx.go('bible'); }
  };

  parts.push(poster({ tone, tall: true },
    label(current.kicker),
    h('div', {},
      display(String(current.title).toUpperCase()),
      h('p', { class: 'lead dim', style: 'margin-top:1rem', text: current.blurb }),
      active ? h('div', { style: 'margin-top:1.6rem' }, track(at.percent)) : null,
      h('p', { class: 'body dim', style: 'margin-top:.8rem', text: active
        ? (at.done ? `Finished · all ${at.total} days` : `Day ${at.day} of ${at.total}`)
        : `${current.days.length} days` })),
    h('div', { class: 'poster-foot' },
      active ? h('span') : pill('Start this plan', () => {
        plan.start(current.id); toast('Started. It is on your Today screen.'); ctx.refresh();
      }),
      art(current.symbol || 'book', { tone, size: 'sm' }))));

  if (active && !at.done && at.at) {
    parts.push(poster({ tone: 'sky' },
      label(`Day ${at.day} of ${at.total}`),
      h('div', {},
        headline(String(at.at.ref).toUpperCase()),
        h('p', { class: 'body dim', style: 'margin-top:.8rem', text: at.at.note })),
      h('div', { class: 'poster-foot' },
        h('div', { class: 'pill-row' },
          pill('Read it', () => openAt(at.at.ref)),
          pill('Mark as read', () => {
            plan.markRead(current, at.day);
            toast(at.day >= at.total ? 'That is the whole plan. Well done.' : `Marked. Day ${at.day + 1} next time.`);
            ctx.refresh();
          }, { quiet: true })),
        h('span'))));
  }

  if (active && at.done) {
    parts.push(poster({ tone: 'sunshine' },
      label('Finished'),
      h('div', {},
        headline('YOU READ THE WHOLE THING.'),
        h('p', { class: 'body dim', style: 'margin-top:1rem',
          text: 'It stays here if you want to go through it again — the days are marked, and starting another plan does not erase them.' })),
      h('div', { class: 'poster-foot' },
        go('Choose another plan', () => ctx.go('bible')),
        art('star', { tone: 'sunshine', size: 'sm' }))));
  }

  parts.push(poster({ tone: 'paper' },
    label(`Every day · ${current.days.length} readings`),
    rows(...current.days.map((day, i) => row({
      title: `${i + 1}. ${day.ref}`,
      note: day.note,
      meta: plan.isRead(current, i + 1) ? 'Read' : '',
      onclick: () => openAt(day.ref),
    })))));

  if (active) {
    parts.push(poster({ tone: 'paper' },
      label('Stopping'),
      note('Stopping a plan keeps every day you have already read. You can pick it up later exactly where it was.'),
      h('div', { class: 'poster-foot' },
        pill('Stop this plan', () => { plan.stop(); toast('Stopped. Nothing was lost.'); ctx.refresh(); }, { quiet: true }),
        h('span'))));
  }

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: current.title, el };
}
