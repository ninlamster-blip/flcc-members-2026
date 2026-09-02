// GROW.
//
// Four learning paths, each its own poster in its own colour. The one you are
// furthest into leads; the rest follow. What you have finished sits at the
// bottom as three figures — figures, not scores.

import { h, poster, label, display, headline, art, go, pill, track,
         rows, row, note, rise } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import { seasonOf, wants } from '../core/profile.js';

const toneOf = (name) => (name === 'poppy' ? 'rose' : (name === 'navy' ? 'ink' : (name || 'paper')));

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

  if (featured) {
    const tone = toneOf(featured.path.tone);
    const next = featured.sessions.find((s) => !progress.isDone('session', `${featured.path.id}:${s.id}`))
      || featured.sessions[0];
    parts.push(poster({ tone, tall: true },
      label(going ? 'Where you are' : featured.path.kicker),
      h('div', {},
        display(String(featured.path.title).toUpperCase()),
        h('p', { class: 'lead dim', style: 'margin-top:1rem', text: next ? next.title : featured.path.blurb }),
        featured.where.finished ? h('div', { style: 'margin-top:1.6rem' }, track(featured.where.percent)) : null,
        h('p', { class: 'body dim', style: 'margin-top:.8rem', text: featured.where.finished
          ? `${featured.where.finished} of ${featured.where.total} sessions · ${featured.path.minutes}`
          : `${featured.where.total} sessions · ${featured.path.minutes}` })),
      h('div', { class: 'poster-foot' },
        pill(featured.where.finished ? 'Continue' : 'Start', () =>
          ctx.go(next ? `session/${featured.path.id}/${next.id}` : `path/${featured.path.id}`)),
        art(featured.path.symbol || 'sprout', { tone, size: 'sm' }))));
  }

  // ── The rest, one poster each ───────────────────────────────────────────
  for (const one of states.filter((s) => s !== featured)) {
    const tone = toneOf(one.path.tone);
    parts.push(poster({ tone, as: 'button', onclick: () => ctx.go(`path/${one.path.id}`) },
      label(one.path.kicker),
      h('div', {},
        headline(String(one.path.title).toUpperCase()),
        h('p', { class: 'body dim', style: 'margin-top:.8rem', text: one.path.blurb })),
      h('div', { class: 'poster-foot' },
        h('span', { class: 'go' }, one.where.finished
          ? `${one.where.finished} of ${one.where.total} read`
          : `${one.where.total} sessions`),
        art(one.path.symbol || 'book', { tone, size: 'sm' }))));
  }

  // ── Where to start, if nothing is ───────────────────────────────────────
  if (!states.some((one) => one.where.finished > 0)) {
    const season = seasonOf();
    const suggested = states.find((one) => (one.path.forSeason || []).includes(season.id))
      || states.find((one) => (one.path.forFocus || []).some((f) => wants(f)))
      || states[0];
    if (suggested) {
      parts.push(poster({ tone: 'paper' },
        label(`Because you said: ${season.label.toLowerCase()}`),
        headline(`START WITH ${String(suggested.path.title).toUpperCase()}`),
        h('div', { class: 'poster-foot' },
          go('Open it', () => ctx.go(`path/${suggested.path.id}`)), h('span'))));
    }
  }

  // ── What you have done ──────────────────────────────────────────────────
  const state = progress.getProgress();
  parts.push(poster({ tone: 'paper' },
    label('So far'),
    rows(
      row({ title: 'Sessions read', meta: String(progress.count('session')) }),
      row({ title: 'Plan readings marked', meta: String(progress.count('reading')) }),
      row({ title: 'Prayers prayed through', meta: String(progress.count('prayer')) })),
    h('div', { class: 'poster-foot' },
      note(`These are counts, not scores. Nobody else can see them, and they are not a measure of anything. Best run of days so far: ${state.days.best}.`),
      h('span'))));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Grow', el };
}
