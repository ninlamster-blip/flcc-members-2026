// MEMORY VERSE — one verse a week, hidden a few words at a time.
//
// Read it, then hide some words and say it anyway, then more, until nothing is
// left on the screen and it is all in your head. A hidden word can be tapped to
// peek at it. Kids see each hidden word's first letter; teens see a blank.

import { h, poster, label, display, headline, art, pill, track, note, toast, celebrate, reference } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import * as memory from '../core/memory.js';

export default async function memoryScreen(ctx) {
  const week = memory.weekOf(progress.today());
  let verse = null;
  try { verse = memory.verseFor(await content.verses(), ctx.mode, week); } catch { /* below */ }
  if (!verse) return { title: 'Memory verse', el: poster({ tone: 'paper', className: 'full' }, note('This week’s verse could not be loaded.')) };

  const tone = 'rose';
  const words = verse.text.split(/\s+/);
  let step = progress.isDone('memory', week) ? memory.STEPS.length - 1 : 0;
  const peeked = new Set();

  const block = poster({ tone, tall: true, className: 'full' });
  const learned = h('div', { style: 'display:contents' });

  const paint = () => {
    const hidden = memory.hiddenAt(words, step);
    const last = step === memory.STEPS.length - 1;
    const line = h('p', { class: 'verse', style: 'margin-top:1.4rem;display:flex;flex-wrap:wrap;gap:.2em .45em' },
      ...words.map((word, i) => {
        if (!hidden.has(i) || peeked.has(i)) return h('span', { text: word });
        return h('button', {
          type: 'button', class: 'memory-blank', 'aria-label': 'Hidden word — tap to peek',
          text: memory.blank(word, ctx.mode),
          onclick: () => { peeked.add(i); paint(); setTimeout(() => { peeked.delete(i); paint(); }, 1500); },
        });
      }));

    const done = progress.isDone('memory', week);
    const actions = last
      ? h('div', { class: 'pill-row' },
        done ? pill('Learned ✓', () => {}, { disabled: '' }) : pill('I can say it by heart', () => {
          const result = progress.complete('memory', week);
          if (result.first) toast(`+${progress.XP.memory} XP`);
          celebrate(result);
          paint();
          showLearned();
        }),
        pill('Start again', () => { step = 0; paint(); }, { quiet: true }))
      : h('div', { class: 'pill-row' },
        pill(step === 0 ? 'Hide some words' : 'Hide more words', () => { step += 1; peeked.clear(); paint(); }),
        step > 0 ? pill('Show more', () => { step -= 1; paint(); }, { quiet: true }) : null);

    block.replaceChildren(
      h('div', { class: 'poster-head' }, label('This week’s memory verse'), label(`Step ${step + 1} of ${memory.STEPS.length}`)),
      h('div', {},
        display(step === 0 ? 'READ IT OUT LOUD.' : last ? 'NOW SAY IT ALL.' : 'SAY IT ANYWAY.'),
        line,
        reference(verse.ref, ctx.go, { style: 'margin-top:.9rem' }),
        h('p', { class: 'body dim', style: 'margin-top:1rem', text: step === 0
          ? 'Read it three times. Then hide some words and see if you can still say it.'
          : 'Say the whole verse, out loud, filling the gaps from memory. Tap a gap to peek.' })),
      h('div', { style: 'display:flex;flex-direction:column;gap:1rem' },
        track((step / (memory.STEPS.length - 1)) * 100),
        h('div', { class: 'poster-foot' }, actions, art('heart', { tone, size: 'sm' }))));
  };

  const showLearned = () => {
    if (!progress.isDone('memory', week)) return;
    learned.replaceChildren(poster({ tone: 'paper', className: 'full' },
      label('Hidden in your heart'),
      headline('SEE YOU NEXT WEEK.'),
      h('p', { class: 'body dim', style: 'margin-top:.8rem', text: `You have learned ${progress.count('memory')} memory ${progress.count('memory') === 1 ? 'verse' : 'verses'}. A new one comes every Monday — say this one again before then, so it stays.` })));
  };

  paint();
  showLearned();
  return { title: 'Memory verse', el: h('div', { style: 'display:contents' }, block, learned) };
}
