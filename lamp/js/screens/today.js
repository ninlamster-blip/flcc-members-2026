// TODAY — the daily spiritual experience. One screen, no clutter.

import { h, section, eyebrow, card, button, bar, spinner, notice, toast, heroEl, ring, reveal } from '../core/ui.js';
import * as content from '../core/content.js';
import { pickFor } from '../core/daily.js';
import { getProgress, continueReading, chapterPercent } from '../core/progress.js';
import { pick } from '../core/age.js';
import { parseRef, formatRef } from '../core/refs.js';
import { getPassage, joinText, translation } from '../core/bible.js';
import { translationId } from '../core/profile.js';
import * as challenges from '../core/challenges.js';
import { today } from '../core/progress.js';
import { bookById } from '../core/books.js';

export default async function todayScreen(ctx) {
  const el = h('div');
  const now = new Date();
  const trans = translationId(ctx.settings);

  // The youngest bands open with a picture of the time of day; the oldest
  // opens straight into words. Same screen, three registers.
  el.appendChild(heroEl());

  el.appendChild(h('h1', { class: 'greeting' },
    ctx.greeting().replace(/,.*$/, '') + (ctx.profile && ctx.profile.name ? ', ' : ''),
    ctx.profile && ctx.profile.name ? h('span', { class: 'greeting-name', text: ctx.profile.name }) : null,
    ctx.profile && ctx.profile.name ? '.' : ''));

  // ── Continue reading ──────────────────────────────────────────────────────
  const progress = getProgress();
  const resume = continueReading(progress);
  if (resume) {
    const [bookId, chapter] = resume.chapter.split('.');
    const book = bookById(bookId);
    if (book) {
      el.appendChild(section(null,
        card({ as: 'button', dataset: { rail: '' }, style: '--rail-colour: var(--accent)',
               onclick: () => ctx.go(`read/${book.id}/${chapter}`) },
          h('div', { style: 'display:flex;align-items:center;gap:1rem' },
            h('div', { style: 'flex:1;min-width:0' },
              eyebrow('Continue reading'),
              h('div', { class: 'card-title', text: `${book.name} ${chapter}` }),
              h('div', { class: 'card-meta', text: 'Pick up where you stopped' })),
            ring(resume.percent, { label: `${resume.percent}% through ${book.name} ${chapter}` })))));
    }
  }

  // ── Today's Word ──────────────────────────────────────────────────────────
  const wordSection = section(null, spinner());
  el.appendChild(wordSection);

  // ── Today's Challenge ─────────────────────────────────────────────────────
  const challengeSection = section(null);
  el.appendChild(challengeSection);

  // ── Quick actions ─────────────────────────────────────────────────────────
  el.appendChild(h('div', { class: 'quick-actions' },
    button('Read Bible', { onclick: () => ctx.go('bible'), variant: 'btn-quiet' }),
    button('Pray', { onclick: () => ctx.go('prayer'), variant: 'btn-quiet' }),
    button('Journal', { onclick: () => ctx.go('journal'), variant: 'btn-quiet' }),
    button('Ask', { onclick: () => ctx.go('ask'), variant: 'btn-quiet' })));

  // Content loads after the frame is on screen, so Today never blocks on it.
  (async () => {
    let daily = null;
    try {
      const pool = await content.daily();
      daily = pickFor(pool, now);
    } catch {
      wordSection.replaceChildren(notice('Today’s Word could not be loaded.'));
      return;
    }
    if (!daily) return;

    const ref = parseRef(daily.ref);
    const body = h('div');
    const holder = card({ dataset: { rail: '' }, style: '--rail-colour: var(--good)' },
      eyebrow('Today’s Word'),
      h('div', { class: 'card-title', text: daily.title }),
      h('div', { class: 'card-meta', text: `${formatRef(ref)} · ${daily.minutes || 3} min · ${translation(trans).id}` }),
      h('div', { style: 'margin-top:1rem' }, body),
      h('div', { class: 'card-foot' },
        button('Read', { variant: 'btn-primary', onclick: () => ctx.go(`read/${ref.book.id}/${ref.chapter}`) }),
        button('Remember', { onclick: async () => {
          const memory = await import('../core/memory.js');
          memory.addVerse(daily.ref, trans);
          toast('Added to your memory verses.');
        } })));
    wordSection.replaceChildren(holder);

    body.appendChild(spinner());
    try {
      const passage = await getPassage(ref, trans);
      body.replaceChildren(
        h('p', { class: 'scripture', text: joinText(passage.verses) }),
        h('div', { class: 'scripture-ref', text: `${formatRef(ref)} · ${trans}` }),
        daily.note ? h('p', { class: 'lede small', style: 'margin-top:1rem', text: pick(daily.note, ctx.band) }) : null,
      );
    } catch (error) {
      body.replaceChildren(notice(error.message));
    }
  })();

  (async () => {
    let pools = null;
    try { pools = await content.challenges(); } catch { return; }
    const challenge = challenges.challengeFor(pools, ctx.band, now);
    if (!challenge) return;
    const done = challenges.resultFor(today(now));
    challengeSection.replaceChildren(card({ dataset: { rail: '' }, style: '--rail-colour: var(--warn)' },
      eyebrow('Today’s challenge'),
      h('div', { class: 'card-title', text: challenges.TYPE_LABEL[challenge.type] }),
      h('p', { style: 'margin-top:.4rem', text: pick(challenge.prompt, ctx.band) }),
      h('div', { class: 'card-foot' },
        done
          ? h('span', { class: 'chip chip-accent', text: 'Done today' })
          : button('Start challenge', { variant: 'btn-primary', onclick: () => ctx.go('challenge') }))));
  })();

  reveal([...el.children].filter((child) => child.tagName === 'SECTION'));
  return { title: 'Today', el };
}
