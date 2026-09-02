// EXPLORE — what do you need today?
//
// Four posters, each a whole block of colour with one word on it. The kids and
// teens edition opens its Explore on the same shape, and for the same reason:
// a member who came here knows roughly what they want, and a grid of small
// tiles makes them read twelve things to find one.

import { h, poster, label, display, headline, art, go, pill, track,
         rows, row, waiting, note, rise, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import * as plan from '../core/plan.js';
import * as prayers from '../core/prayers.js';
import * as scripture from '../core/scripture.js';

// The eyebrow says what KIND of thing is behind the door; the arrow word says
// what you will do there. Setting them to the same words, which an earlier
// draft did, wastes the line and makes the poster read as a stutter.
const DOORS = [
  { name: 'READ',  eyebrow: 'Scripture', tone: 'sky',      symbol: 'book',   route: 'bible',
    what: 'The whole Bible, in three translations, already on this device.', action: 'Open the Bible' },
  { name: 'PRAY',  eyebrow: 'Prayer',    tone: 'rose',     symbol: 'flame',  route: 'pray',
    what: 'Guided prayer for when you do not know how to start, and a list for when you cannot hold it all in your head.', action: 'Take a moment' },
  { name: 'GROW',  eyebrow: 'Teaching',  tone: 'sunshine', symbol: 'sprout', route: 'grow',
    what: 'Four learning paths — foundations, the Bible itself, faith at work, marriage and relationships.', action: 'Keep going' },
  { name: 'PLAN',  eyebrow: 'A habit',   tone: 'captain',  symbol: 'mountain', route: 'bible',
    what: 'A reading plan that is a sequence, not a calendar. Miss a fortnight and it is exactly where you left it.', action: 'Choose a plan' },
];

export default async function exploreScreen(ctx) {
  const parts = DOORS.map((door) => poster({ tone: door.tone, tall: true, as: 'button',
      onclick: () => ctx.go(door.route) },
    label(door.eyebrow),
    h('div', {},
      display(door.name),
      h('p', { class: 'lead dim', style: 'margin-top:1rem', text: door.what })),
    h('div', { class: 'poster-foot' },
      h('span', { class: 'go' }, door.action),
      art(door.symbol, { tone: door.tone, size: 'sm' }))));

  // ── Where you already are ───────────────────────────────────────────────
  //
  // Under the four doors, not above them. A member who came here to find
  // something should meet the choice first; this is for the one who came back
  // to carry on and could not remember where they were.
  const carry = h('div', { style: 'display:contents' });
  parts.push(carry);
  (async () => {
    try {
      const [paths, plans] = await Promise.all([content.paths(), content.plans()]);
      const lines = [];

      const bible = scripture.getState();
      if (bible.last) {
        const { books } = await scripture.manifest();
        const book = books.find((one) => one.n === bible.last.n);
        if (book) {
          lines.push(row({
            title: `${book.name} ${bible.last.chapter}`,
            note: 'Where you stopped reading',
            meta: 'Bible',
            onclick: () => ctx.go(`bible/${book.n}/${bible.last.chapter}`),
          }));
        }
      }

      const state = plan.state();
      const reading = plans.find((one) => one.id === state.id);
      if (reading) {
        const at = plan.positionIn(reading);
        lines.push(row({
          title: at.done ? `${reading.title} — finished` : at.at.ref,
          note: `${reading.title} · day ${at.day} of ${at.total}`,
          meta: `${at.percent}%`,
          onclick: () => ctx.go(`plan/${reading.id}`),
        }));
      }

      for (const one of paths) {
        const sessions = await content.sessions(one.id).catch(() => []);
        const where = progress.through('session', sessions.map((s) => `${one.id}:${s.id}`));
        if (!where.finished || where.finished === where.total) continue;
        const step = sessions.find((s) => !progress.isDone('session', `${one.id}:${s.id}`));
        lines.push(row({
          title: step ? step.title : 'Next session',
          note: `${one.title} · ${where.finished} of ${where.total} read`,
          meta: `${where.percent}%`,
          onclick: () => ctx.go(step ? `session/${one.id}/${step.id}` : `path/${one.id}`),
        }));
      }

      const open = prayers.open().length;
      if (open) {
        lines.push(row({
          title: `${open} ${open === 1 ? 'prayer' : 'prayers'} you are carrying`,
          note: 'On this phone, and nowhere else',
          meta: 'Pray',
          onclick: () => ctx.go('pray'),
        }));
      }

      if (!lines.length) { carry.remove(); return; }
      swap(carry, poster({ tone: 'paper' },
        label('Pick up where you were'),
        rows(...lines),
        h('div', { class: 'poster-foot' },
          note('Everything here works with no signal once it has been opened once.'), h('span'))));
    } catch { carry.remove(); }
  })();

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Explore', el };
}
