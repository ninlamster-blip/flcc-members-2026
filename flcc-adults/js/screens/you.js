// YOU — your own space, and the plain truth about what this app holds.
//
// Every number here is a this-device number, and it says so. There is no
// account, no sync and no server: a second phone starts empty, and clearing
// the browser's data clears everything. An app that keeps a person's prayers
// owes them that sentence somewhere they can find it, in the same size type as
// everything else.
//
// The order is deliberate. What you have made comes first, then how you have
// been, then the settings, then the way out. An app that opens its profile
// screen on a settings list is telling you the settings are the interesting
// part.

import { h, block, card, badge, display, title, body, small, choice, pageTitle, nextLine,
         act, actions, go, rows, row, section, thread, rise, note, toast, swap, waiting } from '../core/ui.js';
import { getUser, saveUser, SEASONS, FOCUS, seasonOf, getSettings, saveSettings } from '../core/profile.js';
import * as store from '../core/storage.js';
import * as progress from '../core/progress.js';
import * as prayers from '../core/prayers.js';
import * as scripture from '../core/scripture.js';
import * as content from '../core/content.js';
import * as plan from '../core/plan.js';
import * as rotation from '../core/rotation.js';

export default async function youScreen(ctx) {
  const user = getUser() || {};
  const settings = getSettings();
  const state = progress.getProgress();
  const bible = scripture.getState();
  const parts = [];

  // ── Who you are ─────────────────────────────────────────────────────────
  parts.push(block({ className: 'full' },
    badge('You'),
    display(user.name || 'Friend'),
    h('p', { class: 'lead', text: seasonOf().line }),
    actions(go('Change any of this', () => scrollTo('settings')))));

  // ── What you have made ──────────────────────────────────────────────────
  //
  // Rows that go somewhere. A profile screen listing things you have made and
  // then not letting you open them is a receipt, not a screen.
  const journey = section({ className: 'full' }, waiting());
  parts.push(journey);
  (async () => {
    const lines = [
      row({
        title: 'Prayer journal',
        note: 'What you wrote after a guided prayer or a session',
        meta: String(prayers.reflections().length),
        accent: 'rose',
        chev: true,
        onclick: () => ctx.go('pray'),
      }),
      row({
        title: 'Verses you kept',
        note: 'Saved while reading, in whichever translation you were in',
        meta: String(bible.saved.length),
        accent: 'sky',
        chev: true,
        onclick: () => ctx.go('bible'),
      }),
    ];

    try {
      const plans = await content.plans();
      const current = plans.find((one) => one.id === plan.state().id);
      if (current) {
        const at = plan.positionIn(current);
        lines.push(row({
          title: 'Bible reading',
          note: `${current.title} · day ${at.day} of ${at.total}`,
          meta: `${at.percent}%`,
          accent: current.tone,
          chev: true,
          onclick: () => ctx.go(`plan/${current.id}`),
        }));
      } else {
        lines.push(row({
          title: 'Bible reading',
          note: 'No plan on the go — a chapter a day reads a gospel inside three weeks',
          meta: '—',
          accent: 'paper',
          chev: true,
          onclick: () => ctx.go('bible'),
        }));
      }

      const paths = await content.paths();
      const states = await Promise.all(paths.map(async (one) => {
        const sessions = await content.sessions(one.id).catch(() => []);
        return { path: one, where: progress.through('session', sessions.map((s) => `${one.id}:${s.id}`)) };
      }));
      const learning = states.find((one) => one.where.finished > 0 && !one.where.done) || states[0];
      if (learning) {
        lines.push(row({
          title: 'Learning',
          note: `${learning.path.title} · ${learning.where.finished} of ${learning.where.total} sessions`,
          meta: `${learning.where.percent}%`,
          accent: learning.path.tone,
          chev: true,
          onclick: () => ctx.go(`path/${learning.path.id}`),
        }));
      }

      const messages = await content.messages().catch(() => []);
      lines.push(row({
        title: 'Messages opened',
        note: 'What you have read up on from the Friday service',
        meta: `${messages.filter((one) => progress.isDone('message', one.id)).length}/${messages.length}`,
        accent: 'gold',
        chev: true,
        onclick: () => ctx.go('watch'),
      }));
    } catch { /* the rows that did build are still worth showing */ }

    swap(journey, nextLine('Your journey'), rows({}, ...lines));
  })();

  // ── How you have been ───────────────────────────────────────────────────
  //
  // Fourteen marks, and never a broken chain. This app counts days it was
  // opened and refuses to keep a score — no XP, no levels, no streak that
  // breaks, and `test/progress.test.mjs` fails if any of those appear.
  const fortnight = progress.rhythm(14);
  const on = fortnight.filter((day) => day.on).length;
  parts.push(section({ className: 'full' },
    nextLine('The last fortnight'),
    h('div', { style: 'display:flex;gap:.35rem;align-items:center;flex-wrap:wrap', 'aria-hidden': 'true' },
      ...fortnight.map((day) => h('i', {
        style: 'width:10px;height:10px;border-radius:50%;'
          + `background:${day.on ? 'var(--gold)' : 'var(--ink-12)'}`,
      }))),
    small(on === 0
      ? `Nothing recorded yet. One day counts. Best run so far: ${state.days.best} ${state.days.best === 1 ? 'day' : 'days'}.`
      : `${on} of the last 14 days. There is no streak to break here — this is a record, not a score.`)));

  // ── Settings ────────────────────────────────────────────────────────────
  parts.push(section({ className: 'full', id: 'settings' },
    nextLine('Settings'),
    card({ tone: 'paper', className: 'full' },
      badge('The season you are in'),
      small('This only changes what the app offers you first. It never withholds anything.'),
      h('div', { class: 'choice-list' },
        ...SEASONS.map((season) => choice(season.label, () => {
          saveUser({ season: season.id });
          toast('Saved.');
          ctx.refresh();
        }, season.id === (user.season || 'growing') ? { 'data-chosen': '' } : {})))),
    card({ tone: 'paper', className: 'full' },
      badge('What you came for'),
      h('div', { class: 'choice-list' },
        ...FOCUS.map((one) => {
          const chosen = (user.focus || []).includes(one.id);
          return choice(one.label, () => {
            const set = new Set(user.focus || []);
            if (set.has(one.id)) set.delete(one.id); else set.add(one.id);
            saveUser({ focus: [...set] });
            ctx.refresh();
          }, chosen ? { 'data-chosen': '' } : {});
        }))),
    card({ tone: 'paper', className: 'full' },
      badge('Appearance'),
      body('Some headings in this app carry a small line drawing beside them. If you would rather read without them, turn them off — the type, the spacing and the layout all stay exactly as they are.'),
      actions(act(settings.figures === 'off' ? 'Turn the drawings on' : 'Turn the drawings off', () => {
        saveSettings({ figures: settings.figures === 'off' ? 'on' : 'off' });
        ctx.refresh();
      }, { quiet: true })))));

  // ── What is on this device ──────────────────────────────────────────────
  parts.push(section({ className: 'full' },
    nextLine('What is on this device'),
    rows({ tight: true },
      row({ title: 'Prayers on your list', meta: String(prayers.open().length) }),
      row({ title: 'Prayers marked answered', meta: String(prayers.answered().length) }),
      row({ title: 'Reflections written', meta: String(prayers.reflections().length) }),
      row({ title: 'Verses kept', meta: String(bible.saved.length) }),
      row({ title: 'Sessions read', meta: String(progress.count('session')) }),
      row({ title: 'Plan readings marked', meta: String(progress.count('reading')) }),
      row({ title: 'Messages opened', meta: String(progress.count('message')) }),
      row({ title: 'Days opened', meta: String(state.days.count) })),
    small('All of it is stored in this browser, on this phone. Nothing is sent to the church or to anyone else, there is no account, and a second device starts empty.')));

  // ── How long the writing lasts ──────────────────────────────────────────
  const runs = section({ className: 'full' });
  parts.push(runs);
  (async () => {
    try {
      const [moments, guides] = await Promise.all([content.moments(), content.guides()]);
      const momentRun = rotation.cycleOf(moments);
      const guideRun = rotation.cycleOf(guides, { offset: 3 });
      swap(runs,
        nextLine('How long the writing lasts'),
        rows({ tight: true },
          row({ title: 'Scripture moments', note: `Day ${momentRun.day} of ${momentRun.days}`, meta: `${momentRun.total} written` }),
          row({ title: 'Prayer guides', note: `Day ${guideRun.day} of ${guideRun.days}`, meta: `${guideRun.total} written` })),
        small('Nothing repeats inside a run. When a run ends the order changes, so the sequence is different next time round — but if these numbers look short to you, that is a real answer, and the teaching team can write more.'));
    } catch { runs.remove(); }
  })();

  // ── Start again ─────────────────────────────────────────────────────────
  const erase = card({ tone: 'paper', className: 'full', foot: 'This cannot be undone' });
  swap(erase, h('div', { class: 'card-body' },
    badge('Start again'),
    body('This erases everything above — your prayers, your reflections, your reading, your verses. There is no copy anywhere else.'),
    actions(act('Erase everything on this device', () => {
      swap(erase, h('div', { class: 'card-body' },
        badge('Are you sure?'),
        body('Everything on this phone goes. There is no copy anywhere else, so this cannot be undone.'),
        actions(
          act('Yes, erase it', () => {
            const count = store.wipe();
            toast(`${count} record${count === 1 ? '' : 's'} erased.`);
            location.hash = '';
            location.reload();
          }),
          act('Keep it', () => ctx.refresh(), { quiet: true }))));
    }, { quiet: true }))));
  parts.push(erase);

  parts.push(small('FLCC NEXT for adults · Faith for real life. A companion for reading and prayer, not a replacement for the church. Scripture: World English Bible, Bible in Basic English, and Ang Dating Biblia (1905) — all public domain.'));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'You', el };
}

function scrollTo(id) {
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
