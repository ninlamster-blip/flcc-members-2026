// COMMUNITY.
//
// People, not data. Everything on this screen points at something that happens
// in a room with other people, and where the app cannot do a thing —
// registering, joining, asking for help — it says who to speak to rather than
// pretending there is a button.
//
// This is the screen where a church app is most tempted to lie, and the
// blueprint for this redesign asked for exactly the things that would make it
// lie: a live prayer wall, a count of members praying right now, whose
// birthday it is today. This app has no server and holds no directory, so
// there is nobody to count and no birthdays to know. What replaced them is not
// a smaller version of the same idea — it is the true version: the prayers you
// are carrying, the meeting where the church prays together, and a calendar
// with real dates against it.

import { h, block, card, badge, display, title, body, small, pageTitle, nextLine,
         act, actions, go, rows, row, section, tag, rise, note, toast, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as agenda from '../core/agenda.js';
import * as prayers from '../core/prayers.js';
import * as store from '../core/storage.js';

const rsvps = () => new Set((store.read(store.KEYS.rsvps, null) || {}).going || []);
const setRsvps = (set) => store.write(store.KEYS.rsvps, { going: [...set] });

export default async function communityScreen(ctx) {
  const [events, updates, ministries] = await Promise.all([
    content.events(), content.updates(), content.ministries(),
  ]);
  const parts = [];

  parts.push(pageTitle('Community', 'We are better together'));

  // ── Pray together ───────────────────────────────────────────────────────
  //
  // The one deep block on this screen, and the one action it wants from you.
  // The number on it is your own list — the only prayer count in this app that
  // is true.
  const meeting = events.find((one) => one.id === 'prayer-tuesday') || events.find((one) => one.gathering);
  const nextMeeting = meeting ? agenda.nextOccurrence(meeting) : null;
  const mine = prayers.open().length;

  parts.push(block({ className: 'full' },
    badge('Pray with someone'),
    display(mine ? `${mine} on your list.` : 'Pray with the church.'),
    h('p', { class: 'lead', text: meeting
      ? `${meeting.title} — ${agenda.countdown(nextMeeting).toLowerCase()}, ${meeting.where.toLowerCase()}. Bring what you have been carrying on your own. Praying it out loud with other people is the part an app cannot do for you.`
      : 'Bring what you have been carrying on your own to the church prayer meeting.' }),
    meeting ? h('p', { class: 'cite', text: agenda.stamp(nextMeeting) }) : null,
    actions(
      act(mine ? 'Open your prayer list' : 'Start a prayer list', () => ctx.go('pray')),
      go('What is happening', () => scrollTo('happening')))));

  // ── What is happening ───────────────────────────────────────────────────
  //
  // Sorted by when it actually is, with a countdown against each one, which is
  // the whole reason events carry a machine-readable date as well as the
  // sentence a member reads. A list in the order somebody typed it into a JSON
  // file is not a calendar.
  const soon = agenda.upcoming(events);
  parts.push(section({ className: 'full', id: 'happening' },
    nextLine('What is happening'),
    ...soon.map((one) => eventBlock(ctx, one))));

  parts.push(small('“I plan to be there” is a note to yourself on this phone. It does not tell the church you are coming — nothing here is sent anywhere.'));

  // ── From the church ─────────────────────────────────────────────────────
  parts.push(section({ className: 'full' },
    nextLine(`From FLCC · ${updates.length} recent`),
    rows({}, ...updates.map((one) => {
      const holder = h('div', {});
      let open = false;
      const paint = () => swap(holder,
        row({
          eyebrow: one.from,
          title: one.title,
          note: new Date(one.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }),
          accent: one.tone,
          chev: true,
          onclick: () => { open = !open; paint(); },
        }),
        open ? h('div', { style: 'padding:0 0 1rem' }, body(one.body)) : null);
      paint();
      return holder;
    }))));

  // ── Where help is needed ────────────────────────────────────────────────
  const needing = ministries.filter((one) => one.needs);
  parts.push(section({ className: 'full' },
    nextLine(`Serve · ${needing.length} asking for help`),
    rows({}, ...ministries.map((one) => row({
      eyebrow: one.needs ? 'Needs people' : '',
      title: one.title,
      note: `${one.blurb} · ${one.commitment}`,
      accent: one.tone,
    }))),
    small('To join one of these, speak to a leader after the Friday service. There is nobody at the other end of this app to receive a form.')));

  // ── What this app is not ────────────────────────────────────────────────
  parts.push(card({ tone: 'paper', className: 'full' },
    badge('People, not data'),
    body('This app holds no member directory, no birthdays, no attendance record and no giving history — so it cannot show you who is praying, who is here, or whose birthday it is today. Those things belong to the church and to the people in it, not to a phone.'),
    go('You and this device', () => ctx.go('you'))));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Community', el };
}

/** One event, with its countdown and — where it is not weekly — an RSVP. */
function eventBlock(ctx, one) {
  const { event } = one;
  const holder = h('div', {});
  const paint = () => {
    const attending = rsvps().has(event.id);
    swap(holder, card({ tone: 'paper', className: 'full',
        foot: [event.where, attending ? 'You plan to be there' : (event.recurring ? 'Every week' : '')] },
      h('div', { class: 'card-head' },
        title(event.title),
        one.now ? tag('Now', 'gold') : one.countdown ? tag(one.countdown, 'gold') : null),
      h('p', { class: 'row-note', text: one.at ? agenda.stamp(one.at) : event.when }),
      body(event.blurb),
      event.recurring ? null : actions(
        act(attending ? 'Going · tap to undo' : 'I plan to be there', () => {
          const set = rsvps();
          if (set.has(event.id)) set.delete(event.id); else set.add(event.id);
          setRsvps(set);
          toast(set.has(event.id) ? 'Noted on this phone.' : 'Removed.');
          paint();
        }, { quiet: !attending, small: true }))));
  };
  paint();
  return holder;
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
