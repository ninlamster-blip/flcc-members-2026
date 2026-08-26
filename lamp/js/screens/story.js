// One story: Story → What happened → What it teaches → Think about it → Pray →
// Challenge. Every part is written for the reader's age band.

import { h, section, eyebrow, button, notice, spinner, toast, card, sceneEl, reveal, celebrate, nudge } from '../core/ui.js';
import * as content from '../core/content.js';
import { pick } from '../core/age.js';
import { displayRef, firstChapter } from '../core/refs.js';
import { markStoryRead } from '../core/progress.js';
import { hasScene } from '../core/art.js';

function part(label, bodyText, extraClass = '') {
  return h('div', { class: 'story-part' },
    eyebrow(label),
    ...(Array.isArray(bodyText) ? bodyText : [bodyText]).map((text) => h('p', { class: `body ${extraClass}`.trim(), text })));
}

export default async function storyScreen(ctx) {
  const slug = ctx.route.args[0];
  const el = h('div', {}, spinner());

  let story;
  try {
    story = await content.story(slug);
  } catch (error) {
    return { title: 'Story', el: notice(`That story could not be loaded. ${error.message}`), tab: 'stories' };
  }

  const opensAt = firstChapter(story.reference);
  const band = ctx.band;

  const challenge = story.challenge;
  const challengeBox = h('div');
  if (challenge) {
    const prompt = pick(challenge.prompt, band);
    const options = pick(challenge.options, band) || challenge.options;
    const answerIndex = challenge.answer;
    const feedback = h('p', { class: 'small', style: 'margin-top:.8rem' });
    const box = card({ dataset: { rail: '' }, style: '--rail-colour: var(--warn)' },
      eyebrow('Challenge'),
      h('p', { text: prompt }),
      h('div', { class: 'btn-row', style: 'margin-top:.9rem' },
        ...(options || []).map((option, index) => button(option, {
          onclick: (event) => {
            const right = index === answerIndex;
            feedback.textContent = right
              ? `Yes. ${pick(challenge.explain, band) || ''}`
              : `Not quite. ${pick(challenge.explain, band) || ''}`;
            feedback.className = `small ${right ? 'state-good' : 'state-warn'}`;
            if (right) celebrate(event.currentTarget);
            else nudge(event.currentTarget);
            event.currentTarget.blur();
          },
        }))),
      feedback);
    challengeBox.appendChild(box);
  }

  const parts = [
    part('Story', pick(story.story, band)),
    part('What happened?', pick(story.whatHappened, band)),
    part('What does it teach me?', pick(story.whatItTeaches, band)),
    section(null, h('div', { class: 'pull', text: pick(story.thinkAboutIt, band) })),
    part('Pray', pick(story.pray, band)),
    challengeBox,
  ];

  el.replaceChildren(
    hasScene(slug)
      ? h('div', { class: 'story-hero' }, sceneEl(slug, { ratio: 'story', title: story.title }))
      : null,
    h('h1', { class: 'card-title', style: 'font-size:1.8rem', text: story.title }),
    h('p', { class: 'card-meta', style: 'margin-bottom:1.75rem' },
      displayRef(story.reference),
      opensAt ? ' · ' : '',
      opensAt ? h('button', { class: 'btn btn-quiet', style: 'min-height:0;padding:.1rem .5rem;font-size:.8rem',
        onclick: () => ctx.go(`read/${opensAt.book.id}/${opensAt.chapter}`) }, 'Read the passage') : null),

    ...parts,

    h('div', { class: 'btn-row', style: 'margin-top:2rem' },
      button('I have read this', { variant: 'btn-primary', onclick: (event) => {
        markStoryRead(slug);
        celebrate(event.currentTarget);
        toast('Saved to your journey.');
      } }),
      button('Write about it', { onclick: () => ctx.go(`journal?story=${encodeURIComponent(slug)}`) })),
  );

  reveal(parts);
  return { title: story.title, el, tab: 'stories' };
}
