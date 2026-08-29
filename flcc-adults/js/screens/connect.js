// CONNECT.
//
// The church, not the app. Everything here points at something that happens in
// a room with other people — and where the app cannot do a thing (registering,
// joining, asking for help), it says who to speak to rather than pretending
// there is a button.

import { h, card, badge, display, title, body, small, starRow,
         act, actions, go, rows, row, section, rise, note, toast, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as store from '../core/storage.js';

const rsvps = () => new Set((store.read(store.KEYS.rsvps, null) || {}).going || []);
const setRsvps = (set) => store.write(store.KEYS.rsvps, { going: [...set] });

export default async function connectScreen(ctx) {
  const [events, updates, ministries] = await Promise.all([
    content.events(), content.updates(), content.ministries(),
  ]);
  const cards = [];

  // ── The family ──────────────────────────────────────────────────────────
  cards.push(card({ tone: 'orange', tall: true, className: 'full', symbol: 'church',
      foot: ['Friday · 10:00 AM · Kuwait City', starRow(5)] },
    h('div', {},
      badge('FLCC'),
      h('div', { style: 'margin-top:1rem' }, display('The FLCC family.')),
      h('p', { class: 'lead', style: 'margin-top:.7rem;max-width:28ch',
        text: 'Filipino Language Christian Congregation — one of fourteen BOTR churches in Kuwait. Built On The Rock.' })),
    actions(go('What is on', () => document.getElementById('upcoming')?.scrollIntoView({ behavior: 'smooth', block: 'start' })))));

  // ── Church updates ──────────────────────────────────────────────────────
  cards.push(section({ className: 'full' },
    badge(`Church updates · ${updates.length} recent`),
    rows({}, ...updates.map((one) => {
      const holder = h('div', {});
      let open = false;
      const paint = () => swap(holder,
        row({
          eyebrow: one.from,
          title: one.title,
          note: open ? '' : new Date(one.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }),
          accent: one.tone,
          onclick: () => { open = !open; paint(); },
        }),
        open ? card({ tone: 'paper', className: 'full',
          foot: new Date(one.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) },
          body(one.body)) : null);
      paint();
      return holder;
    }))));

  // ── Upcoming ────────────────────────────────────────────────────────────
  cards.push(section({ className: 'full', id: 'upcoming' },
    badge('Upcoming'),
    rows({}, ...events.map((one) => {
      const holder = h('div', {});
      const paint = () => {
        const attending = rsvps().has(one.id);
        swap(holder, card({ tone: one.tone, className: 'full',
            foot: [`${one.when} · ${one.where}`, one.recurring ? 'Every week' : (attending ? starRow(5) : '')] },
          badge(one.title),
          body(one.blurb),
          one.recurring ? null : actions(
            act(attending ? 'Going · tap to undo' : 'I plan to be there', () => {
              const set = rsvps();
              if (set.has(one.id)) set.delete(one.id); else set.add(one.id);
              setRsvps(set);
              paint();
            }, { quiet: !attending, small: true }))));
      };
      paint();
      return holder;
    })),
    small('“Going” is a note to yourself on this phone. It does not tell the church you are coming — nothing here is sent anywhere.')));

  // ── Serve ───────────────────────────────────────────────────────────────
  const needing = ministries.filter((one) => one.needs);
  cards.push(section({ className: 'full' },
    badge(`Serve · ${needing.length} asking for help`),
    rows({}, ...ministries.map((one) => row({
      eyebrow: one.needs ? 'Needs people' : '',
      title: one.title,
      note: `${one.blurb} · ${one.commitment}`,
      accent: one.tone,
    }))),
    small('To join one of these, speak to a leader after the Friday service. There is nobody at the other end of this app to receive a form.')));

  // ── Community prayer ────────────────────────────────────────────────────
  cards.push(card({ tone: 'lilac', className: 'full', symbol: 'heart', figureSize: 'sm',
      foot: 'Tuesdays · 9:00 PM' },
    badge('Praying together'),
    title('The Tuesday meeting'),
    body('An hour, online through the summer and in the hall from October. Bring what you have been carrying on your own list — praying it out loud with other people is the part an app cannot do for you.'),
    go('Your prayer list', () => ctx.go('pray'))));

  cards.push(card({ tone: 'paper', className: 'full' },
    small('This app holds no church directory, no attendance record and no giving history. It is a companion for your own reading and prayer, and it is not the church.'),
    go('You and this device', () => ctx.go('you'))));

  const el = h('div', { style: 'display:contents' }, ...cards);
  rise(cards);
  return { title: 'Connect', el };
}
