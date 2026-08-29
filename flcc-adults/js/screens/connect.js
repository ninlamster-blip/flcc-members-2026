// CONNECT.
//
// The church, not the app. Everything on this screen points at something that
// happens in a room with other people — and where the app cannot do a thing
// (registering, joining, asking for help), it says who to speak to rather than
// pretending there is a button.

import { h, block, section, label, display, title, body, small,
         act, actions, go, rows, row, tag, rule, rise, note, toast, swap} from '../core/ui.js';
import * as content from '../core/content.js';
import * as store from '../core/storage.js';

const rsvps = () => new Set((store.read(store.KEYS.rsvps, null) || {}).going || []);
const setRsvps = (set) => store.write(store.KEYS.rsvps, { going: [...set] });

export default async function connectScreen(ctx) {
  const [events, updates, ministries] = await Promise.all([
    content.events(), content.updates(), content.ministries(),
  ]);
  const blocks = [];

  // ── The family ──────────────────────────────────────────────────────────
  blocks.push(block({ tone: 'forest', className: 'full',
      shape: { seed: 'flcc-family', tones: ['olive', 'coral'] }, corner: 'br', soft: true },
    label('FLCC'),
    h('div', {},
      display('The FLCC family.'),
      h('p', { class: 'lead', style: 'margin-top:1rem;max-width:30ch',
        text: 'Filipino Language Christian Congregation — one of fourteen BOTR churches in Kuwait. Built On The Rock.' })),
    h('div', {}, go('Friday, 10:00 AM, Kuwait City', () => {
      document.getElementById('upcoming')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }))));

  // ── Church updates ──────────────────────────────────────────────────────
  blocks.push(section({ className: 'full' },
    h('div', { class: 'section-head' },
      label('Church updates'),
      h('span', { class: 'row-meta', text: `${updates.length} recent` })),
    rows({},
      ...updates.map((one) => {
        const holder = h('div', {});
        let open = false;
        const paint = () => swap(holder, 
          row({
            eyebrow: one.from,
            title: one.title,
            note: open ? '' : new Date(one.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }),
            accent: one.accent,
            onclick: () => { open = !open; paint(); },
          }),
          open ? h('div', { style: 'margin-top:.5rem' },
            body(one.body),
            h('p', { class: 'row-meta', style: 'margin-top:.6rem',
              text: new Date(one.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) }))
            : null);
        paint();
        return holder;
      }))));

  // ── Upcoming ────────────────────────────────────────────────────────────
  const going = rsvps();
  blocks.push(section({ className: 'full', id: 'upcoming' },
    label('Upcoming'),
    rows({},
      ...events.map((one) => {
        const holder = h('div', {});
        const paint = () => {
          const attending = rsvps().has(one.id);
          swap(holder, 
            row({
              eyebrow: one.recurring ? 'Every week' : '',
              title: one.title,
              note: `${one.when} · ${one.where}`,
              meta: attending ? 'Going' : '',
              accent: one.accent,
            }),
            h('div', { style: 'margin-top:.4rem' },
              body(one.blurb),
              one.recurring ? null : h('div', { class: 'act-row', style: 'margin-top:.8rem' },
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
  blocks.push(section({ className: 'full' },
    h('div', { class: 'section-head' },
      label('Serve'),
      h('span', { class: 'row-meta', text: `${needing.length} asking for help` })),
    rows({},
      ...ministries.map((one) => row({
        eyebrow: one.needs ? 'Needs people' : '',
        title: one.title,
        note: `${one.blurb} · ${one.commitment}`,
        accent: one.accent,
      }))),
    small('To join one of these, speak to a leader after the Friday service. There is nobody at the other end of this app to receive a form.')));

  // ── Community prayer ────────────────────────────────────────────────────
  blocks.push(section({ className: 'full' },
    rule(),
    label('Praying together'),
    title('The Tuesday meeting'),
    body('An hour, online through the summer and in the hall from October. Bring what you have been carrying on your own list — praying it out loud with other people is the part an app cannot do for you.'),
    go('Your prayer list', () => ctx.go('pray'))));

  blocks.push(section({ className: 'full' },
    rule(),
    small('This app holds no church directory, no attendance record and no giving history. It is a companion for your own reading and prayer, and it is not the church.'),
    go('You and this device', () => ctx.go('you'))));

  const el = h('div', { style: 'display:contents' }, ...blocks);
  rise(blocks);
  return { title: 'Connect', el };
}
