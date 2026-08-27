// READ — where the day begins and where Scripture is.
//
// Not a dashboard. A greeting, the day's Scripture set as the hero, what you
// were reading, the way into the Bible, and one invitation to reflect.

import { h, strip, go, spinner, notice, reveal } from '../core/ui.js';
import * as content from '../core/content.js';
import { pickFor } from '../core/daily.js';
import { getProgress, continueReading, today as todayKey } from '../core/progress.js';
import { pick } from '../core/age.js';
import { parseRef, formatRef } from '../core/refs.js';
import { getPassage, joinText } from '../core/bible.js';
import { translationId } from '../core/profile.js';
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

  // ── Into the Bible itself ─────────────────────────────────────────────────
  el.appendChild(strip('The Bible',
    h('p', { class: 'lede', text: ctx.band === '15-18'
      ? 'Sixty-six books, and a field that takes a reference or a word.'
      : 'Somewhere to start, or all sixty-six books.' }),
    go('Browse the Bible', () => ctx.go('bible'))));

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

  reveal([...el.children].filter((child) => child.tagName === 'SECTION'));
  return { title: 'Read', el };
}
