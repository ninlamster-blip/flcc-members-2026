// A guided prayer.
//
// One step at a time, with a timer that can be ignored. The timer exists
// because the hardest part of praying for five minutes is knowing whether it
// has been five minutes; it advances nothing on its own, and no step can be
// taken from the reader before they are done with it.

import { h, block, section, label, display, title, lead, body, small, scripture, reference,
         act, actions, go, thread, rise, note, toast, moment, swap} from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import * as prayers from '../core/prayers.js';

export default async function guideScreen(ctx) {
  const [id] = ctx.route.args;
  const guides = await content.guides();
  const guide = guides.find((one) => one.id === id);
  if (!guide) return { title: 'Pray', el: section({ className: 'full' }, note('That guide has moved.')) };

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
    const bar = thread(0, 'peach');
    const clock = h('span', { class: 'row-meta', text: `${seconds}s` });

    timer = setInterval(() => {
      elapsed += 1;
      const left = Math.max(0, seconds - elapsed);
      bar.firstChild.style.width = `${Math.min(100, (elapsed / seconds) * 100)}%`;
      clock.textContent = left ? `${left}s` : 'when you are ready';
      if (left === 0) stop();
    }, 1000);

    const last = step === guide.steps.length - 1;
    swap(el, 
      block({ tone: 'paper', tall: true, className: 'full',
          shape: { seed: `${guide.id}-${step}`, tones: guide.tones }, corner: step % 2 ? 'tl' : 'br', soft: true },
        h('div', {},
          label(`${guide.title} · ${step + 1} of ${guide.steps.length}`),
          h('div', { style: 'margin-top:1.4rem' }, display(current.label)),
          h('p', { class: 'lead', style: 'margin-top:1rem;max-width:30ch', text: current.prompt })),
        h('div', {},
          h('div', { class: 'section-head', style: 'margin-bottom:.6rem' },
            h('span', { class: 'row-meta', text: 'Take your time' }), clock),
          bar,
          h('div', { class: 'act-row', style: 'margin-top:1.4rem' },
            act(last ? 'Finish' : 'Next', () => { if (last) finish(); else { step += 1; paint(); } }),
            step > 0 ? act('Back', () => { step -= 1; paint(); }, { quiet: true, small: true }) : null))),
      guide.ref
        ? section({ className: 'full' }, label('Alongside this'), reference(guide.ref, ctx.go))
        : null,
      section({ className: 'full' },
        small('Nothing you pray here is recorded unless you choose to write it down at the end.')));
    window.scrollTo(0, 0);
  };

  const finish = () => {
    stop();
    progress.complete('prayer', guide.id);
    const input = h('textarea', { placeholder: 'Anything you want to keep from that? (optional)',
      'aria-label': 'A reflection' });
    swap(el, 
      block({ tone: 'paper', className: 'full', shape: { seed: `${guide.id}-end`, tones: guide.tones }, corner: 'tr', soft: true },
        label('Amen'),
        h('div', {}, display('That was prayer.'),
          h('p', { class: 'lead', style: 'margin-top:.9rem;max-width:30ch',
            text: 'Whether it felt like anything or not. Both kinds count, and the ones that feel like nothing count the same.' }))),
      section({ className: 'full' },
        label('Keep something'),
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
          act('Done', () => ctx.go('pray'), { quiet: true }))),
      section({ className: 'full' },
        small('Reflections stay on this device.')));
    window.scrollTo(0, 0);
    moment({ eyebrow: guide.title, big: 'Amen.', line: 'Come back to this whenever you need it.',
      action: 'Close', seed: guide.id, tones: guide.tones });
  };

  paint();
  return { title: guide.title, el };
}
