// YOU — the profile, and the plain truth about what this app holds.
//
// Every number on this screen is a this-device number, and it says so. There
// is no account, no sync and no server: a second phone starts empty, and
// clearing the browser's data clears everything here. An app that keeps a
// person's prayers owes them that sentence in a place they can find it.

import { h, block, section, label, display, title, body, small,
         act, actions, go, rows, row, choice, rule, rise, note, toast, swap} from '../core/ui.js';
import { getUser, saveUser, SEASONS, FOCUS, seasonOf, getSettings, saveSettings } from '../core/profile.js';
import * as store from '../core/storage.js';
import * as progress from '../core/progress.js';
import * as prayers from '../core/prayers.js';
import * as scripture from '../core/scripture.js';
import * as content from '../core/content.js';
import * as rotation from '../core/rotation.js';

export default async function youScreen(ctx) {
  const user = getUser() || {};
  const settings = getSettings();
  const state = progress.getProgress();
  const blocks = [];

  blocks.push(block({ tone: 'paper', className: 'full',
      shape: { seed: user.id || 'you', tones: ['sage', 'gold'] }, corner: 'tr', soft: true },
    label('You'),
    h('div', {},
      display(user.name || 'Friend'),
      h('p', { class: 'lead', style: 'margin-top:.8rem', text: seasonOf().line }))));

  // ── Season ──────────────────────────────────────────────────────────────
  blocks.push(section({ className: 'full' },
    label('The season you are in'),
    h('div', { class: 'choice-list' },
      ...SEASONS.map((season) => choice(season.label, () => {
        saveUser({ season: season.id });
        toast('Saved.');
        ctx.refresh();
      }, season.id === (user.season || 'growing') ? { 'data-chosen': '' } : {})))));

  // ── Focus ───────────────────────────────────────────────────────────────
  blocks.push(section({ className: 'full' },
    label('What you came for'),
    h('div', { class: 'choice-list' },
      ...FOCUS.map((one) => {
        const chosen = (user.focus || []).includes(one.id);
        return choice(one.label, () => {
          const set = new Set(user.focus || []);
          if (set.has(one.id)) set.delete(one.id); else set.add(one.id);
          saveUser({ focus: [...set] });
          ctx.refresh();
        }, chosen ? { 'data-chosen': '' } : {});
      }))));

  // ── The shapes ──────────────────────────────────────────────────────────
  blocks.push(section({ className: 'full' },
    label('Appearance'),
    body('The flowing shapes behind the Scripture moments are this app’s signature. If you find them distracting, turn them off — every screen keeps its layout and simply goes flat.'),
    actions(
      act(settings.shapes === 'off' ? 'Turn the shapes on' : 'Turn the shapes off', () => {
        saveSettings({ shapes: settings.shapes === 'off' ? 'on' : 'off' });
        ctx.refresh();
      }, { quiet: true }))));

  // ── What is on this device ──────────────────────────────────────────────
  const bible = scripture.getState();
  blocks.push(section({ className: 'full' },
    rule(),
    label('What is on this device'),
    rows({ tight: true },
      row({ title: 'Prayers on your list', meta: String(prayers.open().length) }),
      row({ title: 'Prayers marked answered', meta: String(prayers.answered().length) }),
      row({ title: 'Reflections written', meta: String(prayers.reflections().length) }),
      row({ title: 'Verses kept', meta: String(bible.saved.length) }),
      row({ title: 'Sessions read', meta: String(progress.count('session')) }),
      row({ title: 'Plan readings marked', meta: String(progress.count('reading')) }),
      row({ title: 'Days opened', meta: String(state.days.count) })),
    small('All of it is stored in this browser, on this phone. Nothing is sent to the church or to anyone else, there is no account, and a second device starts empty.')));

  // ── How long the content lasts ──────────────────────────────────────────
  const runs = section({ className: 'full' });
  blocks.push(runs);
  (async () => {
    try {
      const [moments, guides] = await Promise.all([content.moments(), content.guides()]);
      const momentRun = rotation.cycleOf(moments);
      const guideRun = rotation.cycleOf(guides, { offset: 3 });
      swap(runs, 
        label('How long the writing lasts'),
        rows({ tight: true },
          row({ title: 'Scripture moments', note: `Day ${momentRun.day} of ${momentRun.days}`, meta: `${momentRun.total} written` }),
          row({ title: 'Prayer guides', note: `Day ${guideRun.day} of ${guideRun.days}`, meta: `${guideRun.total} written` })),
        small('Nothing repeats inside a run. When a run ends the order changes, so the sequence is different next time round — but if these numbers look short to you, that is a real answer, and the teaching team can write more.'));
    } catch { runs.remove(); }
  })();

  // ── Start again ─────────────────────────────────────────────────────────
  blocks.push(section({ className: 'full' },
    rule(),
    label('Start again'),
    body('This erases everything above — your prayers, your reflections, your reading, your verses. There is no copy anywhere else, so it cannot be undone.'),
    actions(act('Erase everything on this device', () => {
      const holder = h('div', { class: 'act-row', style: 'margin-top:.8rem' },
        act('Yes, erase it', () => {
          const count = store.wipe();
          toast(`${count} record${count === 1 ? '' : 's'} erased.`);
          location.hash = '';
          location.reload();
        }),
        act('Keep it', () => ctx.refresh(), { quiet: true }));
      blocks[blocks.length - 1].appendChild(holder);
    }, { quiet: true }))));

  blocks.push(section({ className: 'full' },
    rule(),
    small('FLCC NEXT for adults · a companion for reading and prayer, not a replacement for the church. Scripture: World English Bible, Bible in Basic English, and Ang Dating Biblia (1905) — all public domain.')));

  const el = h('div', { style: 'display:contents' }, ...blocks);
  rise(blocks);
  return { title: 'You', el };
}
