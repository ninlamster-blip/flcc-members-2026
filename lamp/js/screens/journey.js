// JOURNEY — reading, memory verses, challenges and the five stages.
// Milestones unlock by what has been read, memorised and reflected on. Never
// by time spent in the app.

import { h, section, card, eyebrow, bar, button, ring, pips } from '../core/ui.js';
import { getProgress, chaptersRead, storiesRead } from '../core/progress.js';
import * as memory from '../core/memory.js';
import * as challenges from '../core/challenges.js';
import { parseRef, formatRef } from '../core/refs.js';

const STAGES = [
  { name: 'Discover', items: 'Creation · Abraham · Moses · David', need: 1 },
  { name: 'Know',     items: 'Jesus · Gospels · Holy Spirit',      need: 4 },
  { name: 'Grow',     items: 'Prayer · Faith · Wisdom · Character', need: 9 },
  { name: 'Live',     items: 'Serving · Forgiveness · Leadership · Mission', need: 16 },
  { name: 'Share',    items: 'Evangelism · Discipleship · Calling', need: 25 },
];

export default async function journeyScreen(ctx) {
  const progress = getProgress();
  const memoryState = memory.getMemory();
  const mastered = memoryState.verses.filter((v) => v.stage === 'mastered').length;
  const done = challenges.completedCount();
  const understanding = chaptersRead(progress) + storiesRead(progress) + mastered + Math.floor(done / 2);

  const stat = (label, value, sub) => card({},
    eyebrow(label),
    h('div', { class: 'card-title', text: String(value) }),
    sub ? h('div', { class: 'card-meta', text: sub }) : null);

  // The next stage, as a shape rather than a number — the youngest band reads
  // a ring far faster than "9 of 16".
  const nextStage = STAGES.find((stage) => understanding < stage.need) || STAGES[STAGES.length - 1];
  const towardsNext = Math.min(100, Math.round((understanding / nextStage.need) * 100));

  const el = h('div', {},
    ctx.band === '15-18' ? null : section(null, card({ dataset: { rail: '' }, style: '--rail-colour: var(--accent)' },
      h('div', { style: 'display:flex;align-items:center;gap:1.1rem' },
        ring(towardsNext, { size: 68, label: `${towardsNext}% of the way to ${nextStage.name}` }),
        h('div', { style: 'flex:1;min-width:0' },
          eyebrow('Growing towards'),
          h('div', { class: 'card-title', text: nextStage.name }),
          h('div', { class: 'card-meta', text: nextStage.items }))))),

    section(null, h('div', { class: 'grid grid-2' },
      stat('Streak', `${progress.streak.count || 0} day${(progress.streak.count || 0) === 1 ? '' : 's'}`, `Best: ${progress.streak.best || 0}`),
      stat('Chapters read', chaptersRead(progress)),
      stat('Stories', storiesRead(progress)),
      stat('Verses mastered', mastered))),

    section('Memory verses',
      memoryState.verses.length
        ? h('ul', { class: 'list' }, ...memoryState.verses.slice(0, 6).map((verse) => h('li', {},
            h('button', { class: 'row', type: 'button', onclick: () => ctx.go('memory') },
              h('span', { class: 'row-main' },
                h('span', { class: 'row-title', text: formatRef(parseRef(verse.ref)) || verse.ref }),
                h('span', { class: 'row-sub', text: memory.STAGE_LABEL[verse.stage] })),
              pips(memory.STAGES.indexOf(verse.stage) + 1)))))
        : h('p', { class: 'lede small', text: 'Tap “Remember” on any verse and it starts here.' }),
      h('div', { class: 'btn-row', style: 'margin-top:1rem' },
        button('Practise verses', { onclick: () => ctx.go('memory') }),
        button('Today’s challenge', { onclick: () => ctx.go('challenge') }))),

    section('Your journey',
      h('p', { class: 'lede small', style: 'margin-bottom:1.25rem',
        text: 'You are not levelling up. You are growing in understanding — these open as you read, memorise and reflect.' }),
      ...STAGES.map((stage) => h('div', { class: 'stage', dataset: { done: understanding >= stage.need ? 'yes' : 'no' } },
        h('div', { class: 'stage-name', text: stage.name }),
        h('div', { class: 'stage-items', text: stage.items }),
        understanding >= stage.need ? null : h('div', { style: 'margin-top:.5rem;max-width:12rem' },
          bar((understanding / stage.need) * 100))))),
  );

  return { title: 'Journey', el };
}
