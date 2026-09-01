// EXPLORE — what do you need today?
//
// This screen used to be four tiles in a two-by-two grid with an emoji on
// each. That shape is the single clearest tell of an app built as a menu of
// features rather than as something a person uses, and it is the shape the
// blueprint for this redesign names first.
//
// It is four editorial blocks now: a hairline, the name at display size, one
// line saying what is behind it, and the forward arrow. The whole block is the
// tap target, which is what makes it work for somebody holding a phone in one
// hand on the way to a shift.
//
// Four, and it stays four. The reason to open this tab is that you know what
// you want; a fifth block would make it a list to read rather than a choice to
// make.

import { h, eblock, badge, pageTitle, nextLine, rows, row, section, small,
         go, rise, swap, waiting } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import * as plan from '../core/plan.js';
import * as prayers from '../core/prayers.js';
import * as scripture from '../core/scripture.js';

export default async function exploreScreen(ctx) {
  const parts = [];

  parts.push(pageTitle('What do you need today?', 'Explore · grow · be still'));

  parts.push(h('div', { class: 'full' },
    eblock({
      name: 'Read',
      what: 'The whole Bible, in three translations, already on this device.',
      go: 'Open the Bible',
      onclick: () => ctx.go('bible'),
    }),
    eblock({
      name: 'Pray',
      what: 'Guided prayer for when you do not know how to start, and a list for when you cannot hold it all in your head.',
      go: 'Take a moment',
      onclick: () => ctx.go('pray'),
    }),
    eblock({
      name: 'Grow',
      what: 'Four learning paths — foundations, the Bible itself, faith at work, marriage and relationships.',
      go: 'Keep going',
      onclick: () => ctx.go('grow'),
    }),
    eblock({
      name: 'Plan',
      what: 'A reading plan that is a sequence, not a calendar. Miss a fortnight and it is exactly where you left it.',
      go: 'Choose a plan',
      onclick: () => ctx.go('bible'),
    })));

  // ── Where you already are ───────────────────────────────────────────────
  //
  // Under the four choices, not above them. A member who came here to find
  // something should meet the choice first; this is for the one who came back
  // to carry on and could not remember where they were.
  const carry = section({ className: 'full' }, waiting());
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
            eyebrow: 'Bible',
            title: `${book.name} ${bible.last.chapter}`,
            note: 'Where you stopped reading',
            accent: 'gold',
            chev: true,
            onclick: () => ctx.go(`bible/${book.n}/${bible.last.chapter}`),
          }));
        }
      }

      const state = plan.state();
      const reading = plans.find((one) => one.id === state.id);
      if (reading) {
        const at = plan.positionIn(reading);
        lines.push(row({
          eyebrow: 'Reading plan',
          title: at.done ? `${reading.title} — finished` : at.at.ref,
          note: `Day ${at.day} of ${at.total} · ${reading.title}`,
          accent: reading.tone,
          chev: true,
          onclick: () => ctx.go(`plan/${reading.id}`),
        }));
      }

      for (const one of paths) {
        const sessions = await content.sessions(one.id).catch(() => []);
        const where = progress.through('session', sessions.map((s) => `${one.id}:${s.id}`));
        if (!where.finished || where.finished === where.total) continue;
        const step = sessions.find((s) => !progress.isDone('session', `${one.id}:${s.id}`));
        lines.push(row({
          eyebrow: one.title,
          title: step ? step.title : 'Next session',
          note: `${where.finished} of ${where.total} sessions read`,
          accent: one.tone,
          chev: true,
          onclick: () => ctx.go(step ? `session/${one.id}/${step.id}` : `path/${one.id}`),
        }));
      }

      const open = prayers.open().length;
      if (open) {
        lines.push(row({
          eyebrow: 'Prayer list',
          title: `${open} ${open === 1 ? 'prayer' : 'prayers'} you are carrying`,
          note: 'On this phone, and nowhere else',
          accent: 'rose',
          chev: true,
          onclick: () => ctx.go('pray'),
        }));
      }

      if (!lines.length) { carry.remove(); return; }
      swap(carry, nextLine('Pick up where you were'), rows({}, ...lines));
    } catch { carry.remove(); }
  })();

  parts.push(section({ className: 'full' },
    small('Everything on this screen works with no signal once it has been opened once. The Bible is already on the device; nothing you read, write or mark here is sent anywhere.')));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Explore', el };
}
