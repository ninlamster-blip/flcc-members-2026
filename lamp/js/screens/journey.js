// THE PATH — the five stages, and where the reader has reached.
//
// Not a scoreboard: the numbers live in Me and the verses live in Reflect.
// This screen exists to say what growing looks like, and that it is not the
// same as time spent in an app.

import { h, strip, bar } from '../core/ui.js';
import { getProgress, chaptersRead, storiesRead } from '../core/progress.js';
import * as memory from '../core/memory.js';
import * as challenges from '../core/challenges.js';

const STAGES = [
  { name: 'Discover', items: 'Creation · Abraham · Moses · David', need: 1 },
  { name: 'Know',     items: 'Jesus · the Gospels · the Holy Spirit', need: 4 },
  { name: 'Grow',     items: 'Prayer · Faith · Wisdom · Character', need: 9 },
  { name: 'Live',     items: 'Serving · Forgiveness · Leadership · Mission', need: 16 },
  { name: 'Share',    items: 'Telling others · Discipleship · Calling', need: 25 },
];

export default async function journeyScreen(ctx) {
  const progress = getProgress();
  const mastered = memory.getMemory().verses.filter((verse) => verse.stage === 'mastered').length;
  const understanding = chaptersRead(progress) + storiesRead(progress) + mastered
    + Math.floor(challenges.completedCount() / 2);

  const next = STAGES.find((stage) => understanding < stage.need) || STAGES[STAGES.length - 1];
  const towards = Math.min(100, Math.round((understanding / next.need) * 100));

  const el = h('div', {},
    h('section', { class: 'strip strip-tight' },
      h('div', { class: 'eyebrow', text: understanding >= next.need ? 'You have reached' : 'Growing towards' }),
      h('h1', { class: 'title-lg', text: next.name }),
      h('p', { class: 'sub', style: 'margin:.5rem 0 1.25rem', text: next.items }),
      bar(towards)),

    strip('The path',
      h('p', { class: 'lede', style: 'margin-bottom:1.5rem',
        text: 'These open as you read, memorise and reflect — never by how long you spend here.' }),
      ...STAGES.map((stage) => h('div', { class: 'stage', dataset: { done: understanding >= stage.need ? 'yes' : 'no' } },
        h('div', { class: 'stage-name', text: stage.name }),
        h('div', { class: 'stage-items', text: stage.items })))),
  );

  return { title: 'The path', el, tab: 'me' };
}
