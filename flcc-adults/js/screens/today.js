// TODAY.
//
// The screen answers three questions in this order and refuses to answer a
// fourth: what is meaningful today, what is happening next, and where was I.
//
// It is deliberately not a dashboard. There is one deep block — the Daily Word
// — and everything under it is a heading and a list. The version of this app
// that opened on eight coloured tiles told a member everything it could do and
// nothing about their day; this one tells them their day.
//
// What is on it changes through the week. `agenda.pulse()` decides the framing
// in one place so no two screens can drift out of step: the church gathered,
// the hours after it, the eve of it, and the ordinary days that are most of
// them.

import { h, block, card, badge, display, title, lead, small, scripture, reference,
         act, actions, go, nextLine, rail, tile, tag, thread, rows, row, section,
         swap, rise, waiting, figure } from '../core/ui.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';
import * as agenda from '../core/agenda.js';
import * as progress from '../core/progress.js';
import * as plan from '../core/plan.js';
import * as prayers from '../core/prayers.js';
import { greeting, firstName, seasonOf, wants } from '../core/profile.js';

/**
 * Fill a section from the network, and say so if it does not arrive.
 *
 * These load after the screen is already on the page, so a failed fetch used
 * to remove them — a member on a bad connection simply lost "Continue your
 * journey", with nothing left to say it had ever been there.
 */
function fill(el, work, { quiet = false, retry } = {}) {
  work().catch(() => {
    if (quiet) { el.remove(); return; }
    swap(el, small('This did not load — it needs a connection the first time.'), go('Try again', retry));
  });
}

const NAMES = {
  gathered: 'The church is gathered.',
  after:    'Do not lose the moment.',
  eve:      'Worship is coming.',
};

export default async function todayScreen(ctx) {
  const el = h('div', { style: 'display:contents' });
  const parts = [];

  // ── The greeting ────────────────────────────────────────────────────────
  //
  // Not "Welcome back". It is the time of day and the member's own name, and
  // the line under it is the only thing on this screen that changes with the
  // church's week rather than with the member's own use of the app.
  const events = await content.events().catch(() => []);
  const pulse = agenda.pulse(events);
  const hello = h('header', {},
    display(`${greeting()}, ${firstName()}.`),
    h('p', { class: 'said', text: NAMES[pulse.state] || pulse.line }));
  parts.push(hello);

  // ── The Daily Word ──────────────────────────────────────────────────────
  //
  // The one deep block this screen is allowed, and the centrepiece of the app.
  // Type does all of the work: no photograph behind it, no gradient, and no
  // second call to action competing with the first.
  let moment = null;
  try { moment = rotation.pick(await content.moments()); } catch { /* the rest still stands */ }

  if (moment) {
    parts.push(block({ className: 'full' },
      badge('Daily word'),
      scripture(moment.text),
      reference(`${moment.ref} · ${moment.translation}`, ctx.go),
      actions(
        act('Read & reflect', () => ctx.go(`moment/${moment.id}`)),
        go('Read the chapter', () => openChapter(ctx, moment.ref)))));
  } else {
    parts.push(card({ tone: 'paper', className: 'full', symbol: 'cloud' },
      badge('Daily word'), title('Today’s Scripture did not load'),
      small('It needs a connection the first time. Everything else here still works.')));
  }

  // ── Next up ─────────────────────────────────────────────────────────────
  //
  // The app's own name, made into a feature. Whatever is next on the church's
  // calendar is on the home screen with a countdown against it, so a member
  // never has to remember what week it is.
  const next = agenda.nextUp(events);
  if (next) {
    const { event } = next;
    parts.push(section({ className: 'full' },
      nextLine('Next up'),
      card({ tone: 'paper', className: 'full', foot: event.where },
        h('div', { class: 'card-head' },
          title(event.title),
          tag(next.now ? 'Happening now' : next.countdown, 'gold')),
        h('p', { class: 'row-note', text: agenda.stamp(next.at) }),
        h('p', { class: 'lead', text: event.blurb }),
        go('View experience', () => ctx.go('community')))));
  }

  // ── At FLCC this week ───────────────────────────────────────────────────
  //
  // The one place the app comes close to showing "activity", and the one place
  // it would be easiest to lie. There is no server behind this app, so there
  // is no honest way to say how many members are praying right now — and a
  // made-up number on a church app is worse than no number at all.
  //
  // So every figure here is either this device's own or the church's published
  // calendar, and the line underneath says which is which.
  const week = section({ className: 'full' }, waiting());
  parts.push(week);
  fill(week, async () => {
    const updates = await content.updates();
    const recent = updates.filter((one) => {
      const days = agenda.daysBetween(new Date(one.date), new Date());
      return days >= 0 && days <= 30;
    }).length;
    const mine = prayers.open().length;
    const soon = agenda.nextUp(events.filter((one) => one.gathering));

    swap(week,
      nextLine('At FLCC this week'),
      h('div', { class: 'figures' },
        count(mine, mine === 1 ? 'prayer you are carrying' : 'prayers you are carrying'),
        count(recent, recent === 1 ? 'update from church' : 'updates from church'),
        gathering(soon)),
      small('Your prayers are counted on this phone and nowhere else — nobody at the church can see them. The rest comes from what FLCC has published.'));
  }, { quiet: true });

  // ── Continue your journey ───────────────────────────────────────────────
  //
  // A rail rather than three more panels: these are things a member is
  // part-way through, and a horizontal row of them says "pick up" in a way a
  // vertical stack of cards never has.
  const journey = section({ className: 'full' }, waiting());
  parts.push(journey);
  fill(journey, async () => {
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

    const state = plan.state();
    const reading = plans.find((one) => one.id === state.id);
    const heard = messages.filter((one) => progress.isDone('message', one.id));
    const nextMessage = messages.find((one) => !progress.isDone('message', one.id));

    const tiles = [];
    if (learning) {
      const step = learning.sessions.find((s) => !progress.isDone('session', `${learning.path.id}:${s.id}`))
        || learning.sessions[0];
      if (step) {
        tiles.push(tile({
          name: step.title,
          by: learning.path.title,
          meta: learning.where.finished ? `${learning.where.finished} of ${learning.where.total} done` : `${learning.where.total} sessions`,
          percent: learning.where.percent,
          onclick: () => ctx.go(`session/${learning.path.id}/${step.id}`),
        }));
      }
    }
    if (reading) {
      const where = plan.positionIn(reading);
      tiles.push(tile({
        name: where.done ? 'Finished' : where.at.ref,
        by: reading.title,
        meta: `Day ${where.day} of ${where.total}`,
        percent: where.percent,
        onclick: () => ctx.go(`plan/${reading.id}`),
      }));
    }
    if (nextMessage) {
      tiles.push(tile({
        name: nextMessage.title,
        by: nextMessage.speaker,
        meta: `${nextMessage.minutes} min`,
        onclick: () => ctx.go(`message/${nextMessage.id}`),
      }));
    }
    if (!tiles.length) { journey.remove(); return; }

    swap(journey,
      nextLine(going || reading || heard.length ? 'Continue your journey' : 'Where to start',
        { more: 'Explore', onmore: () => ctx.go('explore') }),
      rail({}, ...tiles));
  }, { quiet: true });

  // ── One thing from church ───────────────────────────────────────────────
  const church = section({ className: 'full' }, waiting());
  parts.push(church);
  fill(church, async () => {
    const updates = await content.updates();
    swap(church,
      nextLine('From FLCC', { more: 'All of it', onmore: () => ctx.go('community') }),
      rows({}, ...updates.slice(0, 3).map((one) => row({
        eyebrow: one.from,
        title: one.title,
        note: new Date(one.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }),
        accent: one.tone,
        chev: true,
        onclick: () => ctx.go('community'),
      }))));
  }, { quiet: true });

  el.append(...parts);
  rise(parts);
  return { title: 'Today', el };
}

function count(value, name) {
  return h('div', {},
    h('p', { class: 'numeral', text: String(value) }),
    h('p', { class: 'label', text: name }));
}

/**
 * How long until the church is together.
 *
 * A figure, except on the day itself — "0 days until we gather" is arithmetic
 * showing through the writing, and the answer a member wants that morning is
 * the word "today".
 */
function gathering(soon) {
  if (!soon) return count('—', 'nothing scheduled');
  if (soon.now) return word('Now', 'we are gathered');
  if (soon.days === 0) return word('Today', 'we gather');
  return count(soon.days, soon.days === 1 ? 'day until we gather' : 'days until we gather');
}

function word(value, name) {
  return h('div', {},
    h('p', { class: 'numeral', dataset: { word: '' }, text: value }),
    h('p', { class: 'label', text: name }));
}

async function openChapter(ctx, ref) {
  try {
    const module = await import('../core/scripture.js');
    const { books } = await module.manifest();
    const found = module.parseRef(ref, books);
    ctx.go(found ? `bible/${found.book.n}/${found.chapter}` : 'bible');
  } catch { ctx.go('bible'); }
}
