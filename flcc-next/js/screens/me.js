// ME — the journey so far, as a set of objects worth collecting.

import { h, poster, label, display, fit, art, track, pill, rise, toast, note } from '../core/ui.js';
import * as content from '../core/content.js';
import * as store from '../core/storage.js';
import * as progress from '../core/progress.js';
import * as rewards from '../core/rewards.js';
import { getUser, saveUser, mode, MODE } from '../core/profile.js';

const REWARD_ART = { hopHat: ['chicken', 'sunshine'], galagaShip: ['rocket', 'sky'] };

/**
 * The streak rewards: what is unlocked, what is being worn, and how far away
 * the next one is. A tap wears a reward, a second tap takes it off again. The
 * choice lives beside the games' own settings, under `next/v1/arcade`.
 */
function rewardShelf(streak) {
  const block = poster({ tone: 'paper', className: 'full' });
  const paint = () => {
    const arcade = store.read(store.KEYS.arcade, {}) || {};
    const have = rewards.unlocked(streak.best);
    const upNext = rewards.next(streak.best);
    const toGo = upNext ? Math.max(1, upNext.days - streak.count) : 0;
    const tiles = rewards.REWARDS.map((reward) => {
      const open = have.includes(reward);
      const worn = rewards.wearing(reward.slot, arcade[reward.slot], streak.best) === reward.value;
      const [symbol, tone] = REWARD_ART[reward.slot];
      return h('button', {
        class: 'stamp', type: 'button', dataset: { tone: open ? tone : 'paper', ...(open ? {} : { locked: '' }) },
        'aria-pressed': open ? String(worn) : null, disabled: !open,
        'aria-label': open ? `${reward.title} for ${reward.game}${worn ? ', wearing' : ''}` : `${reward.title}, unlocks at a ${reward.days}-day streak`,
        onclick: () => {
          store.write(store.KEYS.arcade, { ...arcade, [reward.slot]: worn ? null : reward.value });
          paint();
        },
      },
        art(symbol, { tone: worn ? 'ink' : open ? tone : 'paper', size: 'sm' }),
        h('p', { class: 'stamp-name', text: reward.title }),
        h('p', { class: 'stamp-when', text: open ? (worn ? 'Wearing' : reward.game) : `${reward.days} days` }));
    });
    block.replaceChildren(
      label(`Streak rewards · ${have.length} of ${rewards.REWARDS.length}`),
      h('div', { style: 'display:flex;align-items:center;gap:1rem' },
        art('fire', { tone: 'paper', size: 'sm' }),
        h('p', { class: 'body', text: upNext
          ? `${toGo} more ${toGo === 1 ? 'day' : 'days'} in a row unlocks the ${upNext.title} for ${upNext.game}.`
          : 'Every reward unlocked. Well done — keep the fire going.' })),
      h('div', { class: 'stamp-grid', style: 'margin-top:1.2rem' }, ...tiles),
      h('p', { class: 'label dim', style: 'margin-top:1rem', text: 'Rewards go by your best streak, so a missed day never takes one away. Tap one to wear it.' }));
  };
  paint();
  return block;
}

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
            fit(h('p', { class: 'headline', style: 'margin-top:.3rem', text: progress.levelTitle(xp).toUpperCase() }))),
          art('rocket', { tone: 'sunshine', size: 'sm' })))),

    rewardShelf(state.streak),

    h('div', { class: 'figures full' },
      figure(progress.count('lesson'), 'lessons', 'sky'),
      figure(progress.count('game'), 'games', 'captain'),
      figure(progress.count('devotional'), 'devotionals', 'rose'),
      figure(xp, 'total XP')),

    stamps,

    poster({ tone: 'paper', className: 'full' },
      label('You'),
      fit(h('p', { class: 'headline', text: (user.name || 'Friend').toUpperCase() })),
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
