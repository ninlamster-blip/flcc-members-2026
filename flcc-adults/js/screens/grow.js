// GROW.
//
// Four learning paths. The featured one gets a full card with its character at
// size; the rest are rows. What you have finished sits at the bottom as three
// counts — counts, not scores.

import { h, card, badge, display, title, body, small, starRow, figure,
         act, actions, go, rows, row, section, thread, rise, note } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import { seasonOf, wants } from '../core/profile.js';

export default async function growScreen(ctx) {
  const paths = await content.paths();
  const cards = [];

  const states = await Promise.all(paths.map(async (one) => {
    try {
      const sessions = await content.sessions(one.id);
      return { path: one, sessions, where: progress.through('session', sessions.map((s) => `${one.id}:${s.id}`)) };
    } catch {
      return { path: one, sessions: [], where: { finished: 0, total: one.sessions || 0, percent: 0, next: null } };
    }
  }));

  const featured = states.find((one) => one.path.featured) || states[0];
  const rest = states.filter((one) => one !== featured);

  // ── The featured path ───────────────────────────────────────────────────
  if (featured) {
    const next = featured.sessions.find((s) => !progress.isDone('session', `${featured.path.id}:${s.id}`)) || featured.sessions[0];
    cards.push(card({ tone: featured.path.tone, tall: true, className: 'full', symbol: featured.path.symbol,
        foot: [`${featured.where.total} sessions · ${featured.path.minutes}`,
               starRow(Math.max(1, Math.round((featured.where.percent / 100) * 5)))] },
      h('div', {},
        badge(featured.path.kicker),
        h('div', { style: 'margin-top:1rem' }, display(featured.path.title)),
        h('p', { class: 'lead', style: 'margin-top:.7rem;max-width:28ch', text: featured.path.blurb })),
      h('div', {},
        featured.where.finished ? h('div', { style: 'margin-bottom:.9rem' }, thread(featured.where.percent, 'sunshine')) : null,
        actions(
          act(featured.where.finished ? 'Continue' : 'Start', () =>
            ctx.go(next ? `session/${featured.path.id}/${next.id}` : `path/${featured.path.id}`)),
          go('All sessions', () => ctx.go(`path/${featured.path.id}`))))));
  }

  // ── The rest ────────────────────────────────────────────────────────────
  cards.push(section({ className: 'full' },
    badge(`Learning paths · ${states.length} in all`),
    rows({}, ...rest.map((one) => row({
      eyebrow: one.path.kicker,
      title: one.path.title,
      note: one.path.blurb,
      meta: one.where.finished ? `${one.where.finished}/${one.where.total}` : `${one.where.total} parts`,
      accent: one.path.tone,
      onclick: () => ctx.go(`path/${one.path.id}`),
    })))));

  // ── Suggested, if nothing is started ────────────────────────────────────
  if (!states.some((one) => one.where.finished > 0)) {
    const season = seasonOf();
    const suggested = states.find((one) => (one.path.forSeason || []).includes(season.id))
      || states.find((one) => (one.path.forFocus || []).some((f) => wants(f)))
      || states[0];
    if (suggested) {
      cards.push(card({ tone: 'paper', className: 'full', symbol: suggested.path.symbol, figureSize: 'sm',
          foot: `Because you said: ${season.label.toLowerCase()}` },
        badge('Where to start'),
        title(`Start with ${suggested.path.title}`),
        body(suggested.path.blurb),
        go('Open it', () => ctx.go(`path/${suggested.path.id}`))));
    }
  }

  // ── What you have done ──────────────────────────────────────────────────
  const state = progress.getProgress();
  cards.push(card({ tone: 'paper', className: 'full', foot: `${state.days.best} days at your best` },
    badge('So far'),
    h('div', { class: 'figures' },
      figureCount(progress.count('session'), 'sessions'),
      figureCount(progress.count('reading'), 'readings'),
      figureCount(progress.count('prayer'), 'prayers')),
    small('These are counts, not scores. Nobody else can see them, and they are not a measure of anything.')));

  const el = h('div', { style: 'display:contents' }, ...cards);
  rise(cards);
  return { title: 'Grow', el };
}

function figureCount(value, name) {
  return h('div', {},
    h('p', { class: 'numeral', text: String(value) }),
    h('p', { class: 'label', text: name }));
}
