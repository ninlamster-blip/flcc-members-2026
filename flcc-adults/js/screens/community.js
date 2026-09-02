// COMMUNITY.
//
// People, not data. Everything here points at something that happens in a room
// with other people, and where the app cannot do a thing — registering,
// joining, asking for help — it says who to speak to rather than pretending
// there is a button.
//
// This is the screen where a church app is most tempted to lie. A live prayer
// wall, a count of members praying right now, whose birthday it is today: this
// app has no server and holds no directory, so there is nobody to count and no
// birthdays to know. What is here instead is not a smaller version of that —
// it is the true version: the prayers you are carrying, the meeting where the
// church prays together, and a calendar with real dates against it.

import { h, poster, label, display, headline, lead, art, go, pill, tag,
         rows, row, note, rise, toast, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as agenda from '../core/agenda.js';
import * as prayers from '../core/prayers.js';
import * as store from '../core/storage.js';

const rsvps = () => new Set((store.read(store.KEYS.rsvps, null) || {}).going || []);
const setRsvps = (set) => store.write(store.KEYS.rsvps, { going: [...set] });

/** Poppy is an accent, never a poster. A content file that names it gets rose. */
const toneOf = (name) => (name === 'poppy' ? 'rose' : (name === 'navy' ? 'ink' : (name || 'paper')));

export default async function communityScreen(ctx) {
  const [events, updates, ministries] = await Promise.all([
    content.events(), content.updates(), content.ministries(),
  ]);
  const parts = [];

  // ── Pray together ───────────────────────────────────────────────────────
  //
  // The poster this screen opens on, and the one action it wants from you. The
  // number on it is your own list — the only prayer count in this app that is
  // true.
  const meeting = events.find((one) => one.id === 'prayer-tuesday') || events.find((one) => one.gathering);
  const nextMeeting = meeting ? agenda.nextOccurrence(meeting) : null;
  const mine = prayers.open().length;

  parts.push(poster({ tone: 'captain', tall: true },
    label('Pray with someone'),
    h('div', {},
      display(mine ? `${mine} ON YOUR LIST.` : 'PRAY WITH THE CHURCH.'),
      meeting
        ? h('p', { class: 'lead dim', style: 'margin-top:1.2rem',
            text: `${meeting.title} — ${agenda.countdown(nextMeeting).toLowerCase()}, ${meeting.where.toLowerCase()}. Praying it out loud with other people is the part an app cannot do for you.` })
        : null),
    h('div', { class: 'poster-foot' },
      pill(mine ? 'Open your prayer list' : 'Start a prayer list', () => ctx.go('pray')),
      art('heart', { tone: 'captain', size: 'sm' }))));

  // ── What is happening ───────────────────────────────────────────────────
  //
  // Sorted by when it actually is, with a countdown against each one, which is
  // the whole reason events carry a machine-readable date as well as the
  // sentence a member reads. A list in the order somebody typed it into a JSON
  // file is not a calendar.
  for (const one of agenda.upcoming(events)) {
    parts.push(eventPoster(ctx, one));
  }

  parts.push(poster({ tone: 'paper' },
    label('One thing about “going”'),
    note('“I plan to be there” is a note to yourself on this phone. It does not tell the church you are coming — nothing here is sent anywhere.')));

  // ── From the church ─────────────────────────────────────────────────────
  parts.push(poster({ tone: 'paper' },
    label(`From FLCC · ${updates.length} recent`),
    rows(...updates.map((one) => {
      const holder = h('div', {});
      let open = false;
      const paint = () => swap(holder,
        row({
          title: one.title,
          note: open ? one.body : one.from,
          meta: new Date(one.date).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          onclick: () => { open = !open; paint(); },
        }));
      paint();
      return holder;
    }))));

  // ── Where help is needed ────────────────────────────────────────────────
  const needing = ministries.filter((one) => one.needs);
  parts.push(poster({ tone: 'sunshine' },
    label(`Serve · ${needing.length} asking for help`),
    rows(...ministries.map((one) => row({
      title: one.title,
      note: `${one.blurb} · ${one.commitment}`,
      meta: one.needs ? 'Needs people' : '',
    }))),
    h('div', { class: 'poster-foot' },
      note('To join one of these, speak to a leader after the Friday service. There is nobody at the other end of this app to receive a form.'),
      art('parcel', { tone: 'sunshine', size: 'sm' }))));

  // ── What this app is not ────────────────────────────────────────────────
  parts.push(poster({ tone: 'paper' },
    label('People, not data'),
    h('p', { class: 'body', text: 'This app holds no member directory, no birthdays, no attendance record and no giving history — so it cannot show you who is praying, who is here, or whose birthday it is today. Those things belong to the church and to the people in it, not to a phone.' }),
    h('div', { class: 'poster-foot' },
      go('You and this device', () => ctx.go('you')), h('span'))));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Community', el };
}

/** One event, with its countdown and — where it is not weekly — an RSVP. */
function eventPoster(ctx, one) {
  const { event } = one;
  const holder = h('div', { style: 'display:contents' });
  const tone = toneOf(event.tone);
  const paint = () => {
    const attending = rsvps().has(event.id);
    swap(holder, poster({ tone },
      h('div', { class: 'poster-head' },
        label(event.recurring ? 'Every week' : 'Coming up'),
        one.countdown ? tag(one.now ? 'Now' : one.countdown) : null),
      h('div', {},
        headline(String(event.title).toUpperCase()),
        h('p', { class: 'lead', style: 'margin-top:.8rem', text: one.at ? agenda.stamp(one.at) : event.when }),
        h('p', { class: 'body dim', style: 'margin-top:.4rem', text: event.where }),
        h('p', { class: 'body dim', style: 'margin-top:1rem', text: event.blurb })),
      h('div', { class: 'poster-foot' },
        event.recurring
          ? h('span')
          : pill(attending ? 'Going · tap to undo' : 'I plan to be there', () => {
              const set = rsvps();
              if (set.has(event.id)) set.delete(event.id); else set.add(event.id);
              setRsvps(set);
              toast(set.has(event.id) ? 'Noted on this phone.' : 'Removed.');
              paint();
            }, attending ? {} : { quiet: true }),
        art('church', { tone, size: 'sm' }))));
  };
  paint();
  return holder;
}
