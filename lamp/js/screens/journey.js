// JOURNEY — reading, memory verses, challenges and the five stages.
// Milestones unlock by what has been read, memorised and reflected on. Never
// by time spent in the app.

import { h, section, card, eyebrow, list, row, bar, button } from '../core/ui.js';
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

  const el = h('div', {},
    section(null, h('div', { class: 'grid grid-2' },
      stat('Streak', `${progress.streak.count || 0} day${(progress.streak.count || 0) === 1 ? '' : 's'}`, `Best: ${progress.streak.best || 0}`),
      stat('Chapters read', chaptersRead(progress)),
      stat('Stories', storiesRead(progress)),
      stat('Verses mastered', mastered))),

    section('Memory verses',
      memoryState.verses.length
        ? list(...memoryState.verses.slice(0, 6).map((verse) => row({
            title: formatRef(parseRef(verse.ref)) || verse.ref,
            sub: memory.STAGE_LABEL[verse.stage],
            end: verse.stage === 'mastered' ? '★' : '',
            onclick: () => ctx.go('memory'),
          })))
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
