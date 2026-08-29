// HOME — today's card, then where you left off.
//
// One card per thing, in the order a person actually wants them: the verse
// first and at size, then the three places they were part-way through, then
// what is happening at church. Nothing on this screen is a dashboard tile.

import { h, card, badge, display, title, lead, body, small, scripture, reference, starRow,
         act, actions, go, thread, rows, row, section, swap, rise, waiting, figure } from '../core/ui.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';
import * as progress from '../core/progress.js';
import * as plan from '../core/plan.js';
import * as prayers from '../core/prayers.js';
import { seasonOf, wants } from '../core/profile.js';

/**
 * Fill a card from the network, and say so if it does not arrive.
 *
 * These load after the screen is already on the page, so a failed fetch used
 * to remove them — a reader on a bad connection simply lost "Continue your
 * journey", with nothing left to say it had ever been there.
 */
function fill(el, work, { quiet = false, retry } = {}) {
  work().catch(() => {
    if (quiet) { el.remove(); return; }
    swap(el, small('This did not load — it needs a connection the first time.'), go('Try again', retry));
  });
}

/** The fortnight: fourteen marks, and never a broken chain. */
function fortnight() {
  const days = progress.rhythm(14);
  const on = days.filter((day) => day.on).length;
  return card({ tone: 'paper', foot: [`${on} of 14 days`, starRow(Math.round((on / 14) * 5))] },
    badge('The last fortnight'),
    h('div', { style: 'display:flex;gap:.35rem;align-items:center;flex-wrap:wrap', 'aria-hidden': 'true' },
      ...days.map((day) => h('i', {
        style: 'width:14px;height:14px;border-radius:5px;border:2px solid var(--ink);'
          + `background:${day.on ? 'var(--yellow)' : 'var(--white)'}`,
      }))),
    small(on === 0
      ? 'Nothing recorded yet. One day counts.'
      : 'Days you opened something. There is no streak to break here.'));
}

export default async function home(ctx) {
  const el = h('div', { style: 'display:contents' });
  const cards = [];

  // ── Today ───────────────────────────────────────────────────────────────
  let moment = null;
  try { moment = rotation.pick(await content.moments()); } catch { /* the rest still stands */ }

  if (moment) {
    // The character goes in the header rather than under the verse. Below it,
    // a long psalm pushes the card past a phone screen and leaves the mascot
    // sitting in a field of empty colour.
    cards.push(card({ tone: moment.tone, className: 'full',
        foot: [reference(moment.ref, ctx.go), starRow(5)] },
      h('div', { class: 'card-head' },
        badge(`Today · ${moment.theme}`),
        figure(moment.symbol, moment.tone, { size: 'sm' })),
      scripture(moment.text),
      actions(
        act('Sit with this', () => ctx.go(`moment/${moment.id}`)),
        go('Read the chapter', async () => {
          const module = await import('../core/scripture.js');
          const { books } = await module.manifest();
          const found = module.parseRef(moment.ref, books);
          ctx.go(found ? `bible/${found.book.n}/${found.chapter}` : 'bible');
        }))));
  } else {
    cards.push(card({ tone: 'rose', className: 'full', symbol: 'cloud', figureSize: 'sm' },
      badge('Today'), title('Today’s Scripture did not load'),
      small('It needs a connection the first time. Everything else here still works.')));
  }

  // ── Continue your journey ───────────────────────────────────────────────
  const journey = card({ tone: 'paper', className: 'full' }, waiting());
  cards.push(journey);
  fill(journey, async () => {
    const paths = await content.paths();
    // In parallel: four paths fetched one after another is four round trips
    // a reader waits through before the card they came back for appears.
    const started = await Promise.all(paths.map(async (one) => {
      const sessions = await content.sessions(one.id);
      return { path: one, sessions, where: progress.through('session', sessions.map((s) => `${one.id}:${s.id}`)) };
    }));
    const going = started.find((one) => one.where.finished > 0 && !one.where.done)
      || started.find((one) => one.where.finished > 0);
    const suggested = started.find((one) => (one.path.forSeason || []).includes(seasonOf().id))
      || started.find((one) => (one.path.forFocus || []).some((f) => wants(f)))
      || started[0];
    const pick = going || suggested;
    if (!pick) { journey.remove(); return; }

    const next = pick.sessions.find((s) => !progress.isDone('session', `${pick.path.id}:${s.id}`)) || pick.sessions[0];
    journey.dataset.tone = pick.path.tone;
    swap(journey,
      h('div', { class: 'card-body' },
        h('div', { class: 'card-head' },
          h('div', {},
            badge(going ? 'Continue' : 'Suggested for you'),
            h('div', { style: 'margin-top:.8rem' }, title(pick.path.title)),
            h('p', { class: 'lead', style: 'margin-top:.3rem', text: next.title })),
          figure(pick.path.symbol, pick.path.tone, { size: 'sm' })),
        thread(pick.where.percent),
        actions(act(going ? 'Continue reading' : 'Start the first session',
          () => ctx.go(`session/${pick.path.id}/${next.id}`)))),
      h('div', { class: 'card-foot' },
        h('span', { text: pick.where.finished
          ? `${pick.where.finished} of ${pick.where.total} sessions`
          : `${pick.where.total} sessions · ${pick.path.minutes}` }),
        starRow(Math.max(1, Math.round((pick.where.percent / 100) * 5)))));
  }, { retry: ctx.refresh });

  // ── Today's reading ─────────────────────────────────────────────────────
  const reading = card({ tone: 'paper' }, waiting());
  cards.push(reading);
  fill(reading, async () => {
    const plans = await content.plans();
    const state = plan.state();
    const current = plans.find((one) => one.id === state.id);
    if (!current) {
      reading.dataset.tone = 'paper';
      swap(reading,
        h('div', { class: 'card-body' },
          h('div', { class: 'card-head' },
            h('div', {}, badge('Reading plan'),
              h('div', { style: 'margin-top:.8rem' }, title('Nothing on the go')),
              h('p', { class: 'lead', style: 'margin-top:.3rem', text: 'A chapter a day, and a gospel is read inside three weeks.' })),
            figure('book', 'paper', { size: 'sm' })),
          actions(act('Choose a plan', () => ctx.go('bible'), { quiet: true }))),
        h('div', { class: 'card-foot' }, h('span', { text: 'Three to choose from' })));
      return;
    }
    const at = plan.positionIn(current);
    reading.dataset.tone = current.tone;
    swap(reading,
      h('div', { class: 'card-body' },
        h('div', { class: 'card-head' },
          h('div', {}, badge(`Day ${at.day} of ${at.total}`),
            h('div', { style: 'margin-top:.8rem' }, title(at.done ? 'Finished' : at.at.ref)),
            at.at && !at.done ? h('p', { class: 'lead', style: 'margin-top:.3rem', text: at.at.note }) : null),
          figure(current.symbol, current.tone, { size: 'sm' })),
        thread(at.percent, 'sunshine'),
        actions(act(at.done ? 'See the plan' : 'Read today', () => ctx.go(`plan/${current.id}`)))),
      h('div', { class: 'card-foot' },
        h('span', { text: current.title }),
        starRow(Math.max(1, Math.round((at.percent / 100) * 5)))));
  }, { retry: ctx.refresh });

  // ── Take a moment ───────────────────────────────────────────────────────
  const pray = card({ tone: 'paper' }, waiting());
  cards.push(pray);
  fill(pray, async () => {
    const guides = await content.guides();
    const guide = rotation.pick(guides, { offset: 3 });
    const open = prayers.open().length;
    pray.dataset.tone = guide.tone;
    swap(pray,
      h('div', { class: 'card-body' },
        h('div', { class: 'card-head' },
          h('div', {}, badge('Take a moment'),
            h('div', { style: 'margin-top:.8rem' }, title(guide.title)),
            h('p', { class: 'lead', style: 'margin-top:.3rem', text: guide.line })),
          figure(guide.symbol, guide.tone, { size: 'sm' })),
        actions(act('Pray now', () => ctx.go(`guide/${guide.id}`)))),
      h('div', { class: 'card-foot' },
        h('span', { text: open ? `${open} on your prayer list` : 'Your prayer list is empty' })));
  }, { quiet: true });

  cards.push(fortnight());

  // ── From church ─────────────────────────────────────────────────────────
  const church = section({ className: 'full' }, waiting());
  cards.push(church);
  fill(church, async () => {
    const [events, updates] = await Promise.all([content.events(), content.updates()]);
    const next = events.find((one) => !one.recurring) || events[0];
    const latest = updates[0];
    swap(church,
      badge('From FLCC'),
      rows({},
        latest ? row({ title: latest.title, note: latest.from, accent: latest.tone,
          onclick: () => ctx.go('connect') }) : null,
        next ? row({ title: next.title, note: next.when, accent: next.tone,
          onclick: () => ctx.go('connect') }) : null),
      go('Everything from church', () => ctx.go('connect')));
  }, { quiet: true });

  el.append(...cards);
  rise(cards);
  return { title: 'Home', el };
}
