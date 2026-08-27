// TODAY — the day's page.
//
// Not a dashboard. A greeting, the day's Scripture set as the hero, what you
// were reading, and one invitation to reflect. Everything else waits.

import { h, strip, go, spinner, notice, toast, sceneEl, reveal } from '../core/ui.js';
import * as content from '../core/content.js';
import { pickFor } from '../core/daily.js';
import { getProgress, continueReading, today as todayKey } from '../core/progress.js';
import { pick } from '../core/age.js';
import { parseRef, formatRef, displayRef } from '../core/refs.js';
import { getPassage, joinText } from '../core/bible.js';
import { translationId } from '../core/profile.js';
import { hasScene } from '../core/art.js';
import * as challenges from '../core/challenges.js';
import * as store from '../core/storage.js';
import { bookById } from '../core/books.js';

const LAMPLIGHT = `${store.NS}lamplight`;

/** The light arrives once a day, not every time the screen is opened. */
function firstOpenToday(now) {
  const day = todayKey(now);
  const seen = store.read(LAMPLIGHT, null);
  if (seen && seen.day === day) return false;
  store.write(LAMPLIGHT, { day });
  return true;
}

function greetingWord(now) {
  const hour = now.getHours();
  return hour < 12 ? 'Good morning' : hour < 17 ? 'Good afternoon' : 'Good evening';
}

export default async function todayScreen(ctx) {
  const now = new Date();
  const trans = translationId(ctx.settings);
  const el = h('div');

  el.appendChild(h('header', { class: 'strip strip-tight' },
    h('p', { class: 'hello', text: greetingWord(now) }),
    h('p', { class: 'today-date', text: now.toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' }) })));

  // ── The day's Scripture, and the light that brings it ─────────────────────
  const scripture = h('section', { class: 'strip' });
  el.appendChild(scripture);

  // ── What you were reading ─────────────────────────────────────────────────
  const progress = getProgress();
  const resume = continueReading(progress);
  if (resume) {
    const [bookId, chapter] = resume.chapter.split('.');
    const book = bookById(bookId);
    const left = Math.max(0, (resume.total || 0) - (resume.verse || 0));
    if (book) {
      el.appendChild(strip('Continue reading',
        h('h2', { class: 'title', text: `${book.name} ${chapter}` }),
        h('p', { class: 'sub', style: 'margin-top:.3rem',
          text: left ? `${left} verse${left === 1 ? '' : 's'} left` : 'Finished — read it again, or move on' }),
        go('Keep reading', () => ctx.go(`read/${book.id}/${chapter}`))));
    }
  }

  // ── One invitation to reflect ─────────────────────────────────────────────
  const reflect = h('section', { class: 'strip' });
  el.appendChild(reflect);

  // ── A few stories, for the readers who want pictures ──────────────────────
  const discover = h('div');
  el.appendChild(discover);

  (async () => {
    let daily = null;
    try { daily = pickFor(await content.daily(), now); }
    catch { scripture.replaceChildren(notice('Today’s Scripture could not be loaded.')); return; }
    if (!daily) return;

    const ref = parseRef(daily.ref);
    const words = h('div', {}, spinner());
    const lit = firstOpenToday(now);

    scripture.replaceChildren(
      h('div', { class: `eyebrow`, text: 'Today’s Scripture' }),
      h('div', { class: lit ? 'lamplight' : '' }, words),
      go('Read the passage', () => ctx.go(`read/${ref.book.id}/${ref.chapter}`)));

    try {
      const passage = await getPassage(ref, trans);
      words.replaceChildren(
        h('blockquote', { class: 'scripture-hero', style: 'margin:0 0 1.1rem', text: `“${joinText(passage.verses)}”` }),
        h('p', { class: 'ref', text: `${formatRef(ref)} · ${trans}` }),
        daily.note ? h('p', { class: 'lede small', style: 'margin-top:1.25rem', text: pick(daily.note, ctx.band) }) : null);
    } catch (error) {
      words.replaceChildren(
        h('p', { class: 'scripture-hero', style: 'margin:0 0 1.1rem;color:var(--muted)', text: daily.title }),
        h('p', { class: 'ref', text: formatRef(ref) }),
        notice(error.message));
    }
  })();

  (async () => {
    let challenge = null;
    try { challenge = challenges.challengeFor(await content.challenges(), ctx.band, now); } catch { /* optional */ }
    const done = challenges.resultFor(todayKey(now));

    reflect.replaceChildren(
      h('div', { class: 'eyebrow', text: 'Reflect' }),
      h('p', { class: 'scripture', style: 'font-size:1.15rem;margin-bottom:1rem',
        text: challenge ? pick(challenge.prompt, ctx.band) : 'What is God saying to you today?' }),
      h('div', { class: 'btn-row' },
        go(done ? 'Write more' : 'Open journal', () => ctx.go('journal')),
        challenge && !done ? go('Take today’s challenge', () => ctx.go('challenge'), { plain: true }) : null));
  })();

  (async () => {
    if (ctx.band === '15-18') return;      // the oldest band gets the index, not a shelf
    let index = [];
    try { index = await content.stories(); } catch { return; }
    const picks = [0, 1, 2, 3].map((offset) => pickFor(index, now, offset * 7)).filter(Boolean);
    const seen = new Set();
    const unique = picks.filter((story) => !seen.has(story.slug) && seen.add(story.slug)).slice(0, 2);
    if (!unique.length) return;

    discover.replaceChildren(strip('Stories',
      h('div', { class: 'story-grid' }, ...unique.map((story) =>
        h('button', { class: 'story-card', type: 'button', onclick: () => ctx.go(`story/${story.slug}`) },
          hasScene(story.slug) ? sceneEl(story.slug, { ratio: 'story', title: story.title }) : null,
          h('span', { class: 'name', text: story.title }),
          h('span', { class: 'ref', text: displayRef(story.reference) })))),
      go('All stories', () => ctx.go('stories'), { plain: true })));
  })();

  reveal([...el.children].filter((child) => child.tagName === 'SECTION'));
  return { title: 'Today', el };
}
