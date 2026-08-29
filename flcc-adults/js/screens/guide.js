// A guided prayer.
//
// One step at a time, with a timer that can be ignored. The timer exists
// because the hardest part of praying for five minutes is knowing whether it
// has been five minutes; it advances nothing on its own, and no step is taken
// from the reader before they are done with it.

import { h, card, badge, display, title, body, small, reference, starRow,
         act, actions, thread, rise, note, toast, moment, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import * as prayers from '../core/prayers.js';

export default async function guideScreen(ctx) {
  const [id] = ctx.route.args;
  const guides = await content.guides();
  const guide = guides.find((one) => one.id === id);
  if (!guide) return { title: 'Pray', el: card({ tone: 'cream', className: 'full' }, note('That guide has moved.')) };

  const el = h('div', { style: 'display:contents' });
  let step = 0;
  let timer = null;
  let elapsed = 0;

  const stop = () => { if (timer) { clearInterval(timer); timer = null; } };
  window.addEventListener('hashchange', stop, { once: true });

  const paint = () => {
    stop();
    elapsed = 0;
    const current = guide.steps[step];
    const seconds = current.seconds || 60;
    const bar = thread(0, 'yellow');
    const clock = h('span', { text: `${seconds}s` });

    timer = setInterval(() => {
      elapsed += 1;
      const left = Math.max(0, seconds - elapsed);
      bar.firstChild.style.width = `${Math.min(100, (elapsed / seconds) * 100)}%`;
      clock.textContent = left ? `${left}s` : 'when you are ready';
      if (left === 0) stop();
    }, 1000);

    const last = step === guide.steps.length - 1;
    swap(el,
      card({ tone: guide.tone, tall: true, className: 'full', symbol: guide.symbol,
          foot: [`${guide.title} · ${step + 1} of ${guide.steps.length}`, clock] },
        h('div', {},
          badge(current.label),
          h('div', { style: 'margin-top:1rem' }, display(current.label)),
          h('p', { class: 'lead', style: 'margin-top:.7rem;max-width:28ch', text: current.prompt })),
        h('div', {},
          bar,
          h('div', { class: 'act-row', style: 'margin-top:1.1rem' },
            act(last ? 'Finish' : 'Next', () => { if (last) finish(); else { step += 1; paint(); } }),
            step > 0 ? act('Back', () => { step -= 1; paint(); }, { quiet: true, small: true }) : null))),
      guide.ref
        ? card({ tone: 'paper', className: 'full' }, badge('Alongside this'), reference(guide.ref, ctx.go))
        : null,
      card({ tone: 'paper', className: 'full' },
        small('Nothing you pray here is recorded unless you choose to write it down at the end.')));
    window.scrollTo(0, 0);
  };

  const finish = () => {
    stop();
    progress.complete('prayer', guide.id);
    const input = h('textarea', { placeholder: 'Anything you want to keep from that? (optional)',
      'aria-label': 'A reflection' });
    swap(el,
      card({ tone: guide.tone, className: 'full', symbol: 'star', foot: ['Amen', starRow(5)] },
        badge('Amen'),
        h('div', {}, display('That was prayer.'),
          h('p', { class: 'lead', style: 'margin-top:.7rem;max-width:28ch',
            text: 'Whether it felt like anything or not. Both kinds count, and the ones that feel like nothing count the same.' }))),
      card({ tone: 'paper', className: 'full', foot: 'Reflections stay on this device' },
        badge('Keep something'),
        input,
        actions(
          act('Keep it', () => {
            const text = input.value.trim();
            if (!text) { toast('Write a line, or just close this.'); input.focus(); return; }
            prayers.reflect({ text, guide: guide.title, ref: guide.ref || '' });
            progress.complete('reflection', `${guide.id}-${progress.today()}`);
            toast('Kept. It is in Pray, under Reflections.');
            ctx.go('pray');
          }),
          act('Done', () => ctx.go('pray'), { quiet: true }))));
    window.scrollTo(0, 0);
    moment({ eyebrow: guide.title, big: 'Amen.', line: 'Come back to this whenever you need it.',
      action: 'Close', symbol: guide.symbol, tone: guide.tone });
  };

  paint();
  return { title: guide.title, el };
}
