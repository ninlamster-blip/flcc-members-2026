// Today's challenge — one of five kinds. "Live it" is never auto-verified.

import { h, card, eyebrow, button, notice, spinner, toast } from '../core/ui.js';
import * as content from '../core/content.js';
import * as challenges from '../core/challenges.js';
import { pick } from '../core/age.js';
import { today } from '../core/progress.js';
import { parseRef, formatRef } from '../core/refs.js';
import { grade } from '../core/memory.js';

export default async function challengeScreen(ctx) {
  const el = h('div', {}, spinner());
  const now = new Date();
  const day = today(now);

  let pools;
  try { pools = await content.challenges(); }
  catch (error) { return { title: 'Challenge', el: notice(`Challenges could not be loaded. ${error.message}`), tab: 'journey' }; }

  const challenge = challenges.challengeFor(pools, ctx.band, now);
  if (!challenge) return { title: 'Challenge', el: notice('No challenge for today.'), tab: 'journey' };

  const previous = challenges.resultFor(day);
  const prompt = pick(challenge.prompt, ctx.band);
  const body = h('div');
  const feedback = h('p', { class: 'small', style: 'margin-top:.8rem' });

  const finish = (result, message) => {
    challenges.record(day, challenge.type, result, now);
    feedback.textContent = message;
    feedback.className = `small ${result === 'right' || result === 'done' ? 'state-good' : 'state-warn'}`;
    toast('Recorded in your journey.');
  };

  if (challenge.type === 'find') {
    const ref = parseRef(challenge.ref);
    const input = h('input', { type: 'text', placeholder: 'John 3:16', 'aria-label': 'The reference you found', autocomplete: 'off' });
    body.append(
      h('p', { text: prompt }),
      h('div', { class: 'field', style: 'margin-top:1rem' }, input),
      h('div', { class: 'btn-row' },
        button('Check', { variant: 'btn-primary', onclick: () => {
          const guess = parseRef(input.value);
          const right = guess && ref && guess.book.id === ref.book.id && guess.chapter === ref.chapter
            && (!ref.verseStart || guess.verseStart === ref.verseStart);
          finish(right ? 'right' : 'wrong', right ? `Found it — ${formatRef(ref)}.` : 'Not that one. Keep looking, or open the Bible and search.');
        } }),
        button('Open the Bible', { onclick: () => ctx.go('bible') })));
  } else if (challenge.type === 'know') {
    const options = pick(challenge.options, ctx.band) || challenge.options || [];
    body.append(h('p', { text: prompt }), h('div', { class: 'btn-row', style: 'margin-top:1rem' },
      ...options.map((option, index) => button(option, { onclick: () => {
        const right = index === challenge.answer;
        finish(right ? 'right' : 'wrong', right
          ? `Yes. ${pick(challenge.explain, ctx.band) || ''}`
          : `Not quite. ${pick(challenge.explain, ctx.band) || ''}`);
      } }))));
  } else if (challenge.type === 'remember') {
    const answer = h('textarea', { placeholder: 'Write what you remember…', 'aria-label': 'The verse from memory' });
    body.append(h('p', { text: prompt }),
      challenge.text ? h('p', { class: 'small muted', style: 'margin-top:.5rem', text: 'From memory first — then check.' }) : null,
      answer,
      h('div', { class: 'btn-row' }, button('Check', { variant: 'btn-primary', onclick: () => {
        if (!challenge.text) { finish('done', 'Recorded. Practise it again tomorrow.'); return; }
        const result = grade(answer.value, challenge.text);
        finish(result.pass ? 'right' : 'wrong', result.pass ? 'That is it, word for word enough.' : 'Nearly. Try it again after another read.');
      } })));
  } else if (challenge.type === 'think') {
    const answer = h('textarea', { placeholder: 'Your thoughts stay on this device…', 'aria-label': 'Your reflection' });
    body.append(h('p', { text: prompt }), answer, h('div', { class: 'btn-row' },
      button('Keep this in my journal', { variant: 'btn-primary', onclick: async () => {
        const journal = await import('../core/storage.js');
        const state = journal.read(journal.KEYS.journal, { entries: [] }) || { entries: [] };
        state.entries.unshift({ id: `j${Date.now()}`, date: new Date().toISOString(), body: answer.value, prompts: { think: prompt } });
        journal.write(journal.KEYS.journal, state);
        finish('done', 'Saved to your journal.');
      } }),
      button('Just thinking', { onclick: () => finish('done', 'Recorded.') })));
  } else {
    body.append(
      h('p', { text: prompt }),
      challenge.ref ? h('p', { class: 'scripture-ref', text: `Inspired by ${formatRef(parseRef(challenge.ref)) || challenge.ref}` }) : null,
      h('p', { class: 'small muted', style: 'margin-top:1rem', text: 'Nobody checks this one. Mark it done when you have actually done it.' }),
      h('div', { class: 'btn-row' },
        button('I did it', { variant: 'btn-primary', onclick: () => finish('done', 'Good. That is the whole point — Bible to life.') }),
        button('Not today', { variant: 'btn-quiet', onclick: () => finish('skipped', 'That is alright. It will come round again.') })));
  }

  el.replaceChildren(card({},
    eyebrow(`Today’s challenge · ${challenges.TYPE_LABEL[challenge.type]}`),
    body,
    feedback,
    previous ? h('p', { class: 'small muted', style: 'margin-top:1rem', text: 'You already did today’s challenge — doing it again is fine.' }) : null));

  return { title: challenges.TYPE_LABEL[challenge.type], el, tab: 'journey' };
}
