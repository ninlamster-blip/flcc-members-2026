// GROW.
//
// Four learning paths. The one you are furthest into gets the deep block; the
// rest are rows. What you have finished sits at the bottom as three counts —
// counts, not scores.

import { h, block, card, badge, display, title, body, small, figure, nextLine,
         act, actions, go, rows, row, section, thread, rise, note } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import { seasonOf, wants } from '../core/profile.js';

export default async function growScreen(ctx) {
  const paths = await content.paths();
  const parts = [];

  const states = await Promise.all(paths.map(async (one) => {
    try {
      const sessions = await content.sessions(one.id);
      return { path: one, sessions, where: progress.through('session', sessions.map((s) => `${one.id}:${s.id}`)) };
    } catch {
      return { path: one, sessions: [], where: { finished: 0, total: one.sessions || 0, percent: 0, next: null } };
    }
  }));

  // The one you are in the middle of beats the one the teaching team featured.
  // A member with a path half-read does not need to be sold another one.
  const going = states.find((one) => one.where.finished > 0 && !one.where.done);
  const featured = going || states.find((one) => one.path.featured) || states[0];
  const rest = states.filter((one) => one !== featured);

  if (featured) {
    const next = featured.sessions.find((s) => !progress.isDone('session', `${featured.path.id}:${s.id}`))
      || featured.sessions[0];
    parts.push(block({ className: 'full' },
      badge(going ? 'Where you are' : featured.path.kicker),
      display(featured.path.title),
      h('p', { class: 'lead', text: next ? next.title : featured.path.blurb }),
      featured.where.finished ? thread(featured.where.percent) : null,
      h('p', { class: 'cite', text: featured.where.finished
        ? `${featured.where.finished} of ${featured.where.total} sessions · ${featured.path.minutes}`
        : `${featured.where.total} sessions · ${featured.path.minutes}` }),
      actions(
        act(featured.where.finished ? 'Continue' : 'Start', () =>
          ctx.go(next ? `session/${featured.path.id}/${next.id}` : `path/${featured.path.id}`)),
        go('All sessions', () => ctx.go(`path/${featured.path.id}`)))));
  }

  parts.push(section({ className: 'full' },
    nextLine(`Learning paths · ${states.length} in all`),
    rows({}, ...rest.map((one) => row({
      eyebrow: one.path.kicker,
      title: one.path.title,
      note: one.path.blurb,
      meta: one.where.finished ? `${one.where.finished}/${one.where.total}` : `${one.where.total} sessions`,
      accent: one.path.tone,
      onclick: () => ctx.go(`path/${one.path.id}`),
    })))));

  // ── Where to start, if nothing is ───────────────────────────────────────
  if (!states.some((one) => one.where.finished > 0)) {
    const season = seasonOf();
    const suggested = states.find((one) => (one.path.forSeason || []).includes(season.id))
      || states.find((one) => (one.path.forFocus || []).some((f) => wants(f)))
      || states[0];
    if (suggested) {
      parts.push(card({ tone: 'paper', className: 'full', symbol: suggested.path.symbol,
          foot: `Because you said: ${season.label.toLowerCase()}` },
        badge('Where to start'),
        title(`Start with ${suggested.path.title}`),
        body(suggested.path.blurb),
        go('Open it', () => ctx.go(`path/${suggested.path.id}`))));
    }
  }

  // ── What you have done ──────────────────────────────────────────────────
  const state = progress.getProgress();
  parts.push(section({ className: 'full' },
    nextLine('So far'),
    h('div', { class: 'figures' },
      figureCount(progress.count('session'), 'sessions'),
      figureCount(progress.count('reading'), 'readings'),
      figureCount(progress.count('prayer'), 'prayers')),
    small(`These are counts, not scores. Nobody else can see them, and they are not a measure of anything. Best run of days so far: ${state.days.best}.`)));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Grow', el };
}

function figureCount(value, name) {
  return h('div', {},
    h('p', { class: 'numeral', text: String(value) }),
    h('p', { class: 'label', text: name }));
}
