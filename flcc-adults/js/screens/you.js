// YOU — the profile, and the plain truth about what this app holds.
//
// Every number here is a this-device number, and it says so. There is no
// account, no sync and no server: a second phone starts empty, and clearing
// the browser's data clears everything. An app that keeps a person's prayers
// owes them that sentence somewhere they can find it.

import { h, card, badge, display, title, body, small, starRow, choice,
         act, actions, go, rows, row, section, rise, note, toast, swap } from '../core/ui.js';
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
  const cards = [];

  cards.push(card({ tone: 'yellow', className: 'full', symbol: 'blob',
      foot: [seasonOf().label, starRow(5)] },
    badge('You'),
    h('div', {},
      display(user.name || 'Friend'),
      h('p', { class: 'lead', style: 'margin-top:.6rem', text: seasonOf().line }))));

  cards.push(card({ tone: 'paper', className: 'full' },
    badge('The season you are in'),
    h('div', { class: 'choice-list' },
      ...SEASONS.map((season) => choice(season.label, () => {
        saveUser({ season: season.id });
        toast('Saved.');
        ctx.refresh();
      }, season.id === (user.season || 'growing') ? { 'data-chosen': '' } : {})))));

  cards.push(card({ tone: 'paper', className: 'full' },
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
      }))));

  // ── Appearance ──────────────────────────────────────────────────────────
  cards.push(card({ tone: 'cream', className: 'full', symbol: 'sun', figureSize: 'sm' },
    badge('Appearance'),
    body('Every card in this app carries one of twelve little characters. If you would rather read without them, turn them off — the cards, the colours and the layout all stay exactly as they are.'),
    actions(act(settings.figures === 'off' ? 'Turn the characters on' : 'Turn the characters off', () => {
      saveSettings({ figures: settings.figures === 'off' ? 'on' : 'off' });
      ctx.refresh();
    }, { quiet: true }))));

  // ── What is on this device ──────────────────────────────────────────────
  const bible = scripture.getState();
  cards.push(card({ tone: 'paper', className: 'full', foot: 'All of it, on this phone' },
    badge('What is on this device'),
    rows({},
      row({ title: 'Prayers on your list', meta: String(prayers.open().length) }),
      row({ title: 'Prayers marked answered', meta: String(prayers.answered().length) }),
      row({ title: 'Reflections written', meta: String(prayers.reflections().length) }),
      row({ title: 'Verses kept', meta: String(bible.saved.length) }),
      row({ title: 'Sessions read', meta: String(progress.count('session')) }),
      row({ title: 'Plan readings marked', meta: String(progress.count('reading')) }),
      row({ title: 'Days opened', meta: String(state.days.count) })),
    small('All of it is stored in this browser, on this phone. Nothing is sent to the church or to anyone else, there is no account, and a second device starts empty.')));

  // ── How long the content lasts ──────────────────────────────────────────
  const runs = card({ tone: 'paper', className: 'full' });
  cards.push(runs);
  (async () => {
    try {
      const [moments, guides] = await Promise.all([content.moments(), content.guides()]);
      const momentRun = rotation.cycleOf(moments);
      const guideRun = rotation.cycleOf(guides, { offset: 3 });
      swap(runs, h('div', { class: 'card-body' },
        badge('How long the writing lasts'),
        rows({},
          row({ title: 'Scripture moments', note: `Day ${momentRun.day} of ${momentRun.days}`, meta: `${momentRun.total} written` }),
          row({ title: 'Prayer guides', note: `Day ${guideRun.day} of ${guideRun.days}`, meta: `${guideRun.total} written` })),
        small('Nothing repeats inside a run. When a run ends the order changes, so the sequence is different next time round — but if these numbers look short to you, that is a real answer, and the teaching team can write more.')));
    } catch { runs.remove(); }
  })();

  // ── Start again ─────────────────────────────────────────────────────────
  const erase = card({ tone: 'blush', className: 'full', foot: 'This cannot be undone' });
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
  cards.push(erase);

  cards.push(card({ tone: 'paper', className: 'full' },
    small('FLCC NEXT for adults · a companion for reading and prayer, not a replacement for the church. Scripture: World English Bible, Bible in Basic English, and Ang Dating Biblia (1905) — all public domain.')));

  const el = h('div', { style: 'display:contents' }, ...cards);
  rise(cards);
  return { title: 'You', el };
}
