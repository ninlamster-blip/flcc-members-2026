// The day's devotional, opened from Today's word.

import { h, poster, label, display, headline, art, pill, go, note, toast } from '../core/ui.js';
import * as content from '../core/content.js';
import { pick as pickForDay } from '../core/rotation.js';
import { forMode } from '../core/profile.js';
import * as progress from '../core/progress.js';

export default async function devotionScreen(ctx) {
  const now = new Date();
  let entry = null;
  try { entry = pickForDay(await content.daily(), { date: now }); } catch { /* handled below */ }
  if (!entry) return { title: 'Today', el: poster({ tone: 'paper', className: 'full' }, note('Today’s devotional could not be loaded.')) };

  const day = progress.today(now);
  const el = h('div', { style: 'display:contents' },
    poster({ tone: entry.tone, tall: true, className: 'full' },
      label(entry.ref),
      h('div', {},
        display(entry.title),
        h('p', { class: 'verse', style: 'margin-top:1.4rem', text: `“${entry.text}”` }),
        h('p', { class: 'label dim', style: 'margin-top:.9rem', text: entry.translation || 'WEB' })),
      h('div', { class: 'poster-foot' }, h('span'), art(entry.symbol, { tone: entry.tone, size: 'sm' }))),

    poster({ tone: 'paper', className: 'full' },
      label('Think about it'),
      h('p', { class: 'lead', text: forMode(entry.devotion, ctx.mode) })),

    poster({ tone: 'paper', className: 'full' },
      label('A prayer'),
      h('p', { class: 'lead', text: forMode(entry.prayer, ctx.mode) })),

    poster({ tone: 'sage', className: 'full' },
      label('One next step'),
      headline(forMode(entry.challenge, ctx.mode).toUpperCase().replace(/\.$/, '')),
      h('div', { class: 'poster-foot' },
        pill(progress.isDone('devotional', day) ? 'Finished' : 'I’ve read this', (event) => {
          const result = progress.complete('devotional', day);
          event.currentTarget.textContent = 'Finished';
          event.currentTarget.disabled = true;
          if (result.first) toast(`+${progress.XP.devotional} XP`);
        }, progress.isDone('devotional', day) ? { disabled: '' } : {}),
        go('Ask about this', () => ctx.go('ask')))),
  );

  return { title: 'Devotional', el };
}
