// A guided prayer.
//
// One step at a time, on one poster, with a timer that can be ignored. The
// timer exists because the hardest part of praying for five minutes is knowing
// whether it has been five minutes; it advances nothing on its own, and no
// step is taken from the reader before they are done with it.

import { h, poster, label, display, headline, art, go, pill, track, reference,
         note, moment, rise, toast, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import * as prayers from '../core/prayers.js';

const toneOf = (name) => (name === 'poppy' ? 'rose' : (name === 'navy' ? 'ink' : (name || 'paper')));

export default async function guideScreen(ctx) {
  const [id] = ctx.route.args;
  const guides = await content.guides();
  const guide = guides.find((one) => one.id === id);
  if (!guide) {
    return { title: 'Pray', el: poster({ tone: 'paper' }, label('Pray'), note('That guide has moved.')) };
  }

  const tone = toneOf(guide.tone);
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
    const bar = track(0);
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
      poster({ tone, tall: true },
        label(`${guide.title} · ${step + 1} of ${guide.steps.length}`),
        h('div', {},
          display(String(current.label).toUpperCase()),
          h('p', { class: 'lead dim', style: 'margin-top:1.2rem', text: current.prompt })),
        h('div', {},
          bar,
          h('div', { class: 'poster-foot', style: 'margin-top:1.2rem' },
            h('div', { class: 'pill-row' },
              pill(last ? 'Finish' : 'Next', () => { if (last) finish(); else { step += 1; paint(); } }),
              step > 0 ? pill('Back', () => { step -= 1; paint(); }, { quiet: true }) : null),
            clock))),
      guide.ref
        ? poster({ tone: 'paper' }, label('Alongside this'), reference(guide.ref, ctx.go))
        : null,
      poster({ tone: 'paper' },
        note('Nothing you pray here is recorded unless you choose to write it down at the end.')));
    window.scrollTo(0, 0);
  };

  const finish = () => {
    stop();
    progress.complete('prayer', guide.id);
    const input = h('textarea', { placeholder: 'Anything you want to keep from that? (optional)',
      'aria-label': 'A reflection' });
    swap(el,
      poster({ tone, tall: true },
        label('Amen'),
        h('div', {},
          display('THAT WAS PRAYER.'),
          h('p', { class: 'lead dim', style: 'margin-top:1.2rem',
            text: 'Whether it felt like anything or not. Both kinds count, and the ones that feel like nothing count the same.' })),
        h('div', { class: 'poster-foot' }, h('span'), art('flame', { tone, size: 'sm' }))),
      poster({ tone: 'paper' },
        label('Keep something'),
        input,
        h('div', { class: 'poster-foot' },
          h('div', { class: 'pill-row' },
            pill('Keep it', () => {
              const text = input.value.trim();
              if (!text) { toast('Write a line, or just close this.'); input.focus(); return; }
              prayers.reflect({ text, guide: guide.title, ref: guide.ref || '' });
              progress.complete('reflection', `${guide.id}-${progress.today()}`);
              toast('Kept. It is in Pray, under Reflections.');
              ctx.go('pray');
            }),
            pill('Done', () => ctx.go('pray'), { quiet: true })),
          h('span', { class: 'row-meta', text: 'Stays on this device' }))));
    window.scrollTo(0, 0);
    moment({ tone, eyebrow: guide.title, big: 'AMEN.', line: 'Come back to this whenever you need it.', action: 'Close' });
  };

  paint();
  return { title: guide.title, el };
}
