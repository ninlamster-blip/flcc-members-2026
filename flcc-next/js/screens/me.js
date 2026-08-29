// ME — the journey so far, as a set of objects worth collecting.

import { h, poster, label, display, art, track, pill, rise, toast, note } from '../core/ui.js';
import * as content from '../core/content.js';
import * as store from '../core/storage.js';
import * as progress from '../core/progress.js';
import { getUser, saveUser, mode, MODE } from '../core/profile.js';

export default async function meScreen(ctx) {
  const user = getUser() || {};
  const state = progress.getProgress();
  const xp = state.xp;

  const figure = (value, caption, tone = 'paper') => poster({ tone },
    label(caption),
    h('p', { class: 'numeral', text: String(value) }));

  const stamps = h('div', { style: 'display:contents' });

  const el = h('div', { style: 'display:contents' },
    poster({ tone: 'sunshine', tall: true, className: 'full' },
      label('Your journey'),
      h('div', {},
        h('p', { class: 'numeral', text: String(state.streak.count) }),
        h('p', { class: 'label', style: 'margin-top:.6rem', text: state.streak.count === 1 ? 'day streak' : 'day streak' }),
        h('p', { class: 'body dim', style: 'margin-top:1rem', text: `Best so far: ${state.streak.best} days` })),
      h('div', { style: 'display:flex;flex-direction:column;gap:.8rem' },
        track(progress.intoLevel(xp)),
        h('div', { class: 'poster-foot' },
          h('div', {},
            h('p', { class: 'label', text: `Level ${progress.level(xp)}` }),
            h('p', { class: 'headline', style: 'margin-top:.3rem', text: progress.levelTitle(xp).toUpperCase() })),
          art('rocket', { tone: 'sunshine', size: 'sm' })))),

    h('div', { class: 'figures full' },
      figure(progress.count('lesson'), 'lessons', 'sky'),
      figure(progress.count('game'), 'games', 'captain'),
      figure(progress.count('devotional'), 'devotionals', 'rose'),
      figure(xp, 'total XP')),

    stamps,

    poster({ tone: 'paper', className: 'full' },
      label('You'),
      h('p', { class: 'headline', text: (user.name || 'Friend').toUpperCase() }),
      h('p', { class: 'body dim', style: 'margin-top:.5rem',
        text: `${user.age ?? '—'} years old · ${MODE[mode()].label} mode · sessions of about ${MODE[mode()].minutes}` }),
      h('div', { class: 'poster-foot' },
        h('div', { class: 'pill-row' },
          pill('Change my name', () => {
            const input = h('input', { type: 'text', value: user.name || '', maxlength: '24', 'aria-label': 'Your name' });
            const block = poster({ tone: 'sky', tall: true, className: 'full' },
              label('You'), h('div', {}, display('WHAT SHOULD WE CALL YOU?'), h('div', { style: 'margin-top:1.4rem' }, input)),
              h('div', { class: 'poster-foot' }, pill('Save', () => {
                saveUser({ name: input.value.trim() || user.name });
                toast('Saved.');
                ctx.refresh();
              })));
            ctx.route.params.editing = '1';
            document.getElementById('screen').replaceChildren(block);
          }, { quiet: true }),
          pill('Delete everything', () => {
            const block = poster({ tone: 'ink', tall: true, className: 'full' },
              label('Are you sure?'),
              h('div', {}, display('THIS REMOVES EVERYTHING.'),
                h('p', { class: 'body dim', style: 'margin-top:1rem', text: 'Your name, your progress, your prayers and your games — all gone from this device. It cannot be undone.' })),
              h('div', { class: 'pill-row' },
                pill('Delete it all', () => {
                  const removed = store.wipe();
                  toast(`${removed} things deleted.`);
                  location.hash = '';
                  location.reload();
                }),
                pill('Keep my things', () => ctx.refresh(), { quiet: true })));
            document.getElementById('screen').replaceChildren(block);
          }, { quiet: true })))),

    poster({ tone: 'paper', className: 'full' },
      label('What FLCC NEXT keeps'),
      h('p', { class: 'body dim', text: 'On this device: your name, your age, what you have finished, your prayers and your game scores. Nothing is sent anywhere except a prayer you choose to send to a ministry leader. There is no public profile, no messaging, and no advertising.' })),
  );

  (async () => {
    let list = [];
    try { list = await content.achievements(); } catch { return; }
    const earned = (row) => {
      if (row.need.kind === 'streak') return state.streak.best >= row.need.count;
      return progress.count(row.need.kind) >= row.need.count;
    };
    const grid = h('div', { class: 'stamp-grid' }, ...list.map((row) => {
      const has = earned(row);
      const stamp = h('div', { class: 'stamp', dataset: { tone: has ? row.tone : 'paper', ...(has ? {} : { locked: '' }) },
        title: row.how },
        art(row.symbol, { tone: has ? row.tone : 'paper', size: 'sm' }),
        h('p', { class: 'stamp-name', text: row.title }));
      return stamp;
    }));
    stamps.replaceChildren(poster({ tone: 'paper', className: 'full' },
      label(`Achievements · ${list.filter(earned).length} of ${list.length}`),
      grid));
  })();

  rise([...el.children]);
  return { title: 'Me', el };
}
