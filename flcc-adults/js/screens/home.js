// HOME — one screen, one centre of gravity.
//
// The old dashboard instinct is to show everything the app can do. This screen
// shows today's Scripture at the size it deserves, and then four quiet lines
// saying where you were when you left. Everything else is a tab away.

import { h, block, section, label, display, title, lead, small, scripture, cite, reference,
         act, go, thread, rows, row, rule, rise, waiting, swap} from '../core/ui.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';
import * as progress from '../core/progress.js';
import * as plan from '../core/plan.js';
import * as prayers from '../core/prayers.js';
import { seasonOf, wants } from '../core/profile.js';

/**
 * Fill a section from the network, and say so if it does not arrive.
 *
 * These sections load after the screen is already on the page, which means a
 * failed fetch used to remove them — a reader on a bad connection simply lost
 * "Continue your journey", with nothing left to say it had ever been there. A
 * silently missing section is indistinguishable from having finished the path,
 * so the two that carry real state say what happened and offer the retry.
 */
function fill(el, work, { quiet = false, retry } = {}) {
  work().catch(() => {
    if (quiet) { el.remove(); return; }
    swap(el, small('This did not load — it needs a connection the first time.'), go('Try again', retry));
  });
}

/** The fourteen-day rhythm: a row of marks, and never a broken chain. */
function rhythmLine() {
  const days = progress.rhythm(14);
  const on = days.filter((day) => day.on).length;
  const strip = h('div', { style: 'display:flex;gap:.3rem;align-items:center', 'aria-hidden': 'true' },
    ...days.map((day) => h('i', {
      style: `width:6px;height:6px;border-radius:99px;background:${day.on ? 'var(--forest)' : 'var(--ink-16)'}`,
    })));
  return section({},
    h('div', { class: 'section-head' },
      label('The last fortnight'),
      h('span', { class: 'row-meta', text: `${on} of 14 days` })),
    strip,
    small(on === 0
      ? 'Nothing recorded yet. One day counts.'
      : 'Days you opened something. There is no streak to break here.'));
}

export default async function home(ctx) {
  const el = h('div', { style: 'display:contents' });
  const blocks = [];

  // ── Today's Scripture moment ────────────────────────────────────────────
  let moment = null;
  try {
    moment = rotation.pick(await content.moments());
  } catch { /* the rest of the screen still stands */ }

  if (moment) {
    blocks.push(block({ tone: 'paper', tall: true, className: 'full',
        shape: { seed: moment.id, tones: moment.tones }, corner: 'br', soft: true },
      h('div', {},
        label(`Today · ${moment.theme}`),
        h('div', { style: 'margin-top:1.4rem' }, scripture(moment.text)),
        h('div', { style: 'margin-top:1.1rem' }, reference(moment.ref, ctx.go))),
      h('div', { class: 'act-row' },
        act('Sit with this', () => ctx.go(`moment/${moment.id}`)),
        go('Read the chapter', async () => {
          const module = await import('../core/scripture.js');
          const { books } = await module.manifest();
          const found = module.parseRef(moment.ref, books);
          ctx.go(found ? `bible/${found.book.n}/${found.chapter}` : 'bible');
        }))));
  } else {
    blocks.push(block({ tone: 'paper', className: 'full' },
      label('Today'), title('Today’s Scripture did not load'),
      small('It needs a connection the first time. Everything else here still works.')));
  }

  // ── Continue your journey ───────────────────────────────────────────────
  const journey = section({ className: 'full' }, waiting());
  blocks.push(journey);
  fill(journey, async () => {
    const paths = await content.paths();
    // In parallel: four paths fetched one after another is four round trips
    // a reader waits through before the section they came back for appears.
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
    swap(journey,
      label(going ? 'Continue your journey' : 'Suggested for you'),
      h('div', {},
        title(pick.path.title),
        h('p', { class: 'lead', style: 'margin-top:.5rem', text: next.title }),
        h('div', { style: 'margin-top:1.1rem' }, thread(pick.where.percent)),
        h('p', { class: 'small', style: 'margin-top:.5rem',
          text: pick.where.finished
            ? `${pick.where.finished} of ${pick.where.total} sessions`
            : `${pick.where.total} sessions · ${pick.path.minutes}` })),
      go(going ? 'Continue reading' : 'Start the first session',
        () => ctx.go(`session/${pick.path.id}/${next.id}`)));
  }, { retry: ctx.refresh });

  // ── Today's reading ─────────────────────────────────────────────────────
  const reading = section({}, waiting());
  blocks.push(reading);
  fill(reading, async () => {
    const plans = await content.plans();
    const state = plan.state();
    const current = plans.find((one) => one.id === state.id);
    if (!current) {
      swap(reading,
        label('Reading plan'),
        h('div', {}, title('Nothing on the go'),
          h('p', { class: 'lead', style: 'margin-top:.5rem', text: 'A chapter a day, and a gospel is read inside three weeks.' })),
        go('Choose a plan', () => ctx.go('bible')));
      return;
    }
    const at = plan.positionIn(current);
    swap(reading,
      label(`${current.title} · day ${at.day} of ${at.total}`),
      h('div', {},
        title(at.done ? 'Finished' : at.at.ref),
        at.at && !at.done ? h('p', { class: 'lead', style: 'margin-top:.5rem', text: at.at.note }) : null,
        h('div', { style: 'margin-top:1.1rem' }, thread(at.percent, 'gold'))),
      go(at.done ? 'See the plan' : 'Read today', () => ctx.go(`plan/${current.id}`)));
  }, { retry: ctx.refresh });

  // ── Take a moment ───────────────────────────────────────────────────────
  const pray = section({}, waiting());
  blocks.push(pray);
  fill(pray, async () => {
    const guides = await content.guides();
    const guide = rotation.pick(guides, { offset: 3 });
    const open = prayers.open().length;
    swap(pray,
      label('Take a moment'),
      h('div', {}, title(guide.title),
        h('p', { class: 'lead', style: 'margin-top:.5rem', text: guide.line })),
      go('Pray now', () => ctx.go(`guide/${guide.id}`)),
      open ? small(`${open} prayer${open === 1 ? '' : 's'} on your list.`) : null);
  }, { quiet: true });

  blocks.push(rhythmLine());

  // ── One line from church ────────────────────────────────────────────────
  const church = section({}, waiting());
  blocks.push(church);
  fill(church, async () => {
    const [events, updates] = await Promise.all([content.events(), content.updates()]);
    const next = events.find((one) => !one.recurring) || events[0];
    const latest = updates[0];
    swap(church,
      label('From FLCC'),
      rows({ tight: true },
        latest ? row({ title: latest.title, note: latest.from, accent: latest.accent,
          onclick: () => ctx.go('connect') }) : null,
        next ? row({ title: next.title, note: next.when, accent: next.accent,
          onclick: () => ctx.go('connect') }) : null),
      go('Everything from church', () => ctx.go('connect')));
  }, { quiet: true });

  el.append(...blocks);
  rise(blocks);
  return { title: 'Home', el };
}
