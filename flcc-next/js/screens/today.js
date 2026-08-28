// TODAY — a vertical run of posters, not a dashboard.
//
// The day's word, the day's challenge, where the reader is up to, and today's
// game. Each one takes a whole block of colour and says one thing.

import { h, poster, label, display, headline, art, go, pill, track, waiting, note, rise, toast } from '../core/ui.js';
import * as content from '../core/content.js';
import { pick as pickForDay } from '../core/rotation.js';
import { forMode } from '../core/profile.js';
import * as progress from '../core/progress.js';

export default async function todayScreen(ctx) {
  const now = new Date();
  const el = h('div', { style: 'display:contents' });
  const day = progress.today(now);

  // ── The day's word ────────────────────────────────────────────────────────
  const wordBlock = poster({ tone: 'blue', tall: true, className: 'full' }, waiting());
  el.appendChild(wordBlock);

  // ── The day's challenge ───────────────────────────────────────────────────
  const challengeBlock = poster({ tone: 'cream', tall: true, className: 'full' });
  el.appendChild(challengeBlock);

  // ── Where you are up to ───────────────────────────────────────────────────
  const journeyBlock = h('div', { style: 'display:contents' });
  el.appendChild(journeyBlock);

  // ── Today's game ──────────────────────────────────────────────────────────
  const gameBlock = h('div', { style: 'display:contents' });
  el.appendChild(gameBlock);

  (async () => {
    let entry = null;
    try { entry = pickForDay(await content.daily(), { date: now }); }
    catch { wordBlock.replaceChildren(label('Today’s word'), note('Today’s word could not be loaded.')); return; }
    if (!entry) return;

    wordBlock.dataset.tone = entry.tone || 'blue';
    wordBlock.replaceChildren(
      label('Today’s word'),
      h('div', {},
        display(entry.title),
        h('p', { class: 'verse', style: 'margin-top:1.4rem', text: `“${entry.text}”` }),
        h('p', { class: 'ref', style: 'margin-top:.9rem', text: entry.ref })),
      h('div', { class: 'poster-foot' },
        go('Read the devotional', () => ctx.go('devotion')),
        art(entry.symbol || 'light', { tone: entry.tone || 'blue', size: 'sm' })));

    const challengeText = forMode(entry.challenge, ctx.mode);
    const doneAlready = progress.isDone('challenge', day);
    const doneButton = pill(doneAlready ? 'Done today' : 'I did it', (event) => {
      const result = progress.complete('challenge', day);
      event.currentTarget.textContent = 'Done today';
      event.currentTarget.disabled = true;
      if (result.first) toast(`+${progress.XP.challenge} XP`);
      if (result.streakGrew && [3, 7, 30, 100].includes(result.streak.count)) {
        import('../core/ui.js').then(({ moment }) => moment({
          tone: 'cream', eyebrow: 'Streak', big: `${result.streak.count} DAYS.`,
          line: 'Keep going.', action: 'Thanks',
        }));
      }
    }, doneAlready ? { disabled: '' } : {});

    challengeBlock.replaceChildren(
      label('Today’s challenge'),
      h('div', {},
        display(challengeText.toUpperCase().replace(/\.$/, '')),
        entry.reflection ? h('p', { class: 'body dim', style: 'margin-top:1.2rem', text: forMode(entry.reflection, ctx.mode) }) : null),
      h('div', { class: 'poster-foot' }, doneButton, art('flag', { tone: 'cream', size: 'sm' })));
  })();

  (async () => {
    let journeys = [];
    try { journeys = await content.journeys(); } catch { return; }
    const state = progress.getProgress();
    const withProgress = journeys.map((journey) => {
      const done = Object.keys(state.done).filter((k) => k.startsWith(`lesson:${journey.id}/`)).length;
      return { journey, done, percent: Math.round((done / journey.lessons) * 100) };
    });
    const started = withProgress.find((row) => row.done > 0 && row.done < row.journey.lessons);
    const current = started || withProgress[0];

    journeyBlock.replaceChildren(poster({ tone: current.journey.tone, as: 'button', className: 'full',
      onclick: () => ctx.go(`journey/${current.journey.id}`) },
      label(current.done ? 'Continue your journey' : 'Start a journey'),
      h('div', {},
        headline(current.journey.title),
        h('p', { class: 'body dim', style: 'margin-top:.8rem', text: forMode(current.journey.blurb, ctx.mode) })),
      h('div', { style: 'display:flex;flex-direction:column;gap:.7rem' },
        track(current.percent),
        h('p', { class: 'label', text: `${current.percent}% complete` }))));
  })();

  (async () => {
    let games = [];
    try { games = await content.games(); } catch { return; }
    const pick = pickForDay(games, { date: now, offset: 2 });
    if (!pick) return;
    gameBlock.replaceChildren(poster({ tone: pick.tone, as: 'button', className: 'full',
      onclick: () => ctx.go(`game/${pick.id}`) },
      label('Today’s game'),
      h('div', { style: 'display:flex;align-items:flex-end;justify-content:space-between;gap:1rem' },
        h('div', {}, display(pick.title), h('p', { class: 'label', style: 'margin-top:1rem', text: '★'.repeat(pick.difficulty) + '☆'.repeat(5 - pick.difficulty) })),
        art(pick.symbol, { tone: pick.tone }))));
  })();

  rise([...el.children]);
  return { title: 'Today', el };
}
