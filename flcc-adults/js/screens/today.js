// TODAY — a vertical run of posters, not a dashboard.
//
// The day's word, what is next at church, where you were up to, and one thing
// the church has said. Each one takes a whole block of colour and says one
// thing.
//
// What is on it changes through the week. `agenda.pulse()` decides the framing
// in one place so no two screens can drift out of step: the church gathered,
// the hours after it, the eve of it, and the ordinary days that are most of
// them.

import { h, poster, label, display, headline, lead, art, go, pill, track, tag,
         rows, row, scripture, reference, waiting, note, rise, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';
import * as agenda from '../core/agenda.js';
import * as progress from '../core/progress.js';
import * as plan from '../core/plan.js';
import * as prayers from '../core/prayers.js';
import { seasonOf, wants } from '../core/profile.js';

const LINES = {
  gathered: 'The church is gathered right now.',
  after:    'Do not lose the moment.',
  eve:      'Worship is coming.',
};

export default async function todayScreen(ctx) {
  const el = h('div', { style: 'display:contents' });
  const parts = [];

  const events = await content.events().catch(() => []);
  const pulse = agenda.pulse(events);

  // ── The day's word ──────────────────────────────────────────────────────
  //
  // The poster this screen exists for. Type does all of the work: the verse at
  // reading size on a whole block of colour, the reference under it, and one
  // action.
  const wordBlock = poster({ tone: 'sky', tall: true }, waiting());
  parts.push(wordBlock);

  let moment = null;
  try { moment = rotation.pick(await content.moments()); } catch { /* the rest still stands */ }

  if (moment) {
    wordBlock.dataset.tone = moment.tone || 'sky';
    swap(wordBlock,
      label(`Today’s word · ${moment.theme}`),
      h('div', {},
        display(String(moment.theme).toUpperCase()),
        h('div', { style: 'margin-top:1.4rem' }, scripture(moment.text)),
        reference(`${moment.ref} · ${moment.translation}`, ctx.go, { style: 'margin-top:.9rem' })),
      h('div', { class: 'poster-foot' },
        go('Read & reflect', () => ctx.go(`moment/${moment.id}`)),
        art(moment.symbol || 'book', { tone: moment.tone || 'sky', size: 'sm' })));
  } else {
    swap(wordBlock, label('Today’s word'), headline('TODAY’S SCRIPTURE DID NOT LOAD'),
      note('It needs a connection the first time. Everything else here still works.'));
  }

  // ── Next up ─────────────────────────────────────────────────────────────
  //
  // The app's own name, made into a poster. Whatever is next on the church's
  // calendar, with a countdown against it, so a member never has to remember
  // what week it is.
  const next = agenda.nextUp(events);
  if (next) {
    const { event } = next;
    parts.push(poster({ tone: 'sunshine', tall: true },
      h('div', { class: 'poster-head' },
        label(LINES[pulse.state] ? 'Next up' : 'Next up'),
        tag(next.now ? 'Happening now' : next.countdown)),
      h('div', {},
        display(String(event.title).toUpperCase()),
        h('p', { class: 'lead', style: 'margin-top:1rem', text: agenda.stamp(next.at) }),
        h('p', { class: 'body dim', style: 'margin-top:.5rem', text: event.where }),
        h('p', { class: 'body dim', style: 'margin-top:1rem', text: event.blurb })),
      h('div', { class: 'poster-foot' },
        go('What is happening', () => ctx.go('community')),
        art('church', { tone: 'sunshine', size: 'sm' }))));
  }

  // ── At FLCC this week ───────────────────────────────────────────────────
  //
  // The one place the app comes close to showing "activity", and the one place
  // it would be easiest to lie. There is no server behind this app, so there
  // is no honest way to say how many members are praying right now — and a
  // made-up number on a church app is worse than no number at all.
  //
  // So every figure here is either this device's own or the church's published
  // calendar, and the poster says which is which.
  const week = h('div', { style: 'display:contents' });
  parts.push(week);
  content.updates().then((updates) => {
    const recent = updates.filter((one) => {
      const days = agenda.daysBetween(new Date(one.date), new Date());
      return days >= 0 && days <= 30;
    }).length;
    const mine = prayers.open().length;
    const soon = agenda.nextUp(events.filter((one) => one.gathering));

    // A figure that is a word rather than a number cannot take the numeral
    // size — "Today" set at 20vw runs straight out of half a screen.
    const count = (value) => (typeof value === 'number'
      ? h('p', { class: 'numeral', text: String(value) })
      : h('p', { class: 'display', text: value }));

    swap(week, h('div', { class: 'figures' },
      poster({ tone: 'rose' },
        count(mine),
        h('div', { class: 'poster-foot' },
          label(mine === 1 ? 'Prayer you carry' : 'Prayers you carry'), h('span'))),
      poster({ tone: 'paper' },
        count(!soon ? '—' : soon.days === 0 ? 'Today' : soon.days),
        h('div', { class: 'poster-foot' },
          label(!soon ? 'Nothing scheduled' : soon.days === 0 ? 'We gather' : soon.days === 1 ? 'Day until we gather' : 'Days until we gather'),
          h('span')))),
      poster({ tone: 'paper' },
        label(`From FLCC · ${recent} in the last month`),
        note('Your prayers are counted on this phone and nowhere else — nobody at the church can see them. The rest comes from what FLCC has published.'),
        h('div', { class: 'poster-foot' },
          go('What the church has said', () => ctx.go('community')), h('span'))));
  }).catch(() => week.remove());

  // ── Where you were up to ────────────────────────────────────────────────
  const journey = h('div', { style: 'display:contents' });
  parts.push(journey);
  (async () => {
    try {
      const [paths, plans, messages] = await Promise.all([
        content.paths(), content.plans(), content.messages().catch(() => []),
      ]);

      const started = await Promise.all(paths.map(async (one) => {
        const sessions = await content.sessions(one.id).catch(() => []);
        return { path: one, sessions, where: progress.through('session', sessions.map((s) => `${one.id}:${s.id}`)) };
      }));
      const going = started.find((one) => one.where.finished > 0 && !one.where.done);
      const suggested = started.find((one) => (one.path.forSeason || []).includes(seasonOf().id))
        || started.find((one) => (one.path.forFocus || []).some((f) => wants(f)))
        || started[0];
      const learning = going || suggested;

      const blocks = [];

      if (learning) {
        const step = learning.sessions.find((s) => !progress.isDone('session', `${learning.path.id}:${s.id}`))
          || learning.sessions[0];
        if (step) {
          blocks.push(poster({ tone: learning.path.tone === 'poppy' ? 'rose' : (learning.path.tone || 'captain'), tall: true },
            label(going ? 'Carry on' : 'Where to start'),
            h('div', {},
              display(String(step.title).toUpperCase()),
              h('p', { class: 'lead dim', style: 'margin-top:1rem', text: learning.path.title }),
              learning.where.finished
                ? h('div', { style: 'margin-top:1.6rem' }, track(learning.where.percent))
                : null),
            h('div', { class: 'poster-foot' },
              pill(going ? 'Continue' : 'Start', () => ctx.go(`session/${learning.path.id}/${step.id}`)),
              art(learning.path.symbol || 'sprout', { tone: learning.path.tone || 'captain', size: 'sm' }))));
        }
      }

      const state = plan.state();
      const reading = plans.find((one) => one.id === state.id);
      if (reading) {
        const at = plan.positionIn(reading);
        blocks.push(poster({ tone: 'paper' },
          label(`Reading plan · day ${at.day} of ${at.total}`),
          h('div', {},
            headline(at.done ? 'FINISHED' : String(at.at.ref).toUpperCase()),
            h('div', { style: 'margin-top:1.2rem' }, track(at.percent))),
          h('div', { class: 'poster-foot' },
            go('Read today', () => ctx.go(`plan/${reading.id}`)),
            art('book', { tone: 'paper', size: 'sm' }))));
      }

      const nextMessage = messages.find((one) => !progress.isDone('message', one.id));
      if (nextMessage) {
        blocks.push(poster({ tone: 'paper' },
          label(nextMessage.series === nextMessage.title ? 'From the Friday service' : nextMessage.series),
          headline(String(nextMessage.title).toUpperCase()),
          h('div', { class: 'poster-foot' },
            go('Open it', () => ctx.go(`message/${nextMessage.id}`)),
            h('span', { class: 'row-meta', text: `${nextMessage.speaker} · ${nextMessage.minutes} min` }))));
      }

      if (!blocks.length) { journey.remove(); return; }
      swap(journey, ...blocks);
      rise(blocks);
    } catch { journey.remove(); }
  })();

  // ── One thing from church ───────────────────────────────────────────────
  const church = h('div', { style: 'display:contents' });
  parts.push(church);
  content.updates().then((updates) => {
    swap(church, poster({ tone: 'paper' },
      label('From FLCC'),
      rows(...updates.slice(0, 3).map((one) => row({
        title: one.title,
        note: one.from,
        meta: new Date(one.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
        onclick: () => ctx.go('community'),
      }))),
      h('div', { class: 'poster-foot' },
        go('Everything from church', () => ctx.go('community')), h('span'))));
  }).catch(() => church.remove());

  el.append(...parts);
  rise(parts);
  return { title: 'Today', el };
}
