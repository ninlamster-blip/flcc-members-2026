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
import * as resources from '../core/resources.js';

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

  // ── A few minutes today, from Cru ───────────────────────────────────────
  //
  // Cru's daily devotional, linked rather than copied: a page per calendar
  // day on cru.org. And the member's own list of Cru material, kept here.
  let bank = null;
  try { bank = await content.resources(); } catch { /* the paths still stand */ }
  if (bank) {
    const promise = bank.todaysPromise;
    const today = new Date();
    parts.push(poster({ tone: 'captain' },
      label(`Bite-size · from ${bank.source.name}`),
      h('div', {},
        headline(`${String(promise.title).toUpperCase()}.`),
        h('p', { class: 'body dim', style: 'margin-top:.8rem', text: `${promise.line} By ${promise.by}.` })),
      h('div', { class: 'poster-foot' },
        pill('Read today’s', () =>
          resources.open(resources.todaysPromiseUrl(promise.base, today))),
        art('sun', { tone: 'captain', size: 'sm' }))));

    const mine = resources.mine(bank);
    const KIND = { page: 'Open', pdf: 'Download', video: 'Watch' };
    parts.push(poster({ tone: 'paper' },
      label(mine.length ? `My resources · ${mine.filter((one) => one.done).length} of ${mine.length} done` : 'My resources'),
      mine.length
        ? rows(...mine.map((one) => h('div', {},
          h('p', { class: 'row-title', text: `${one.done ? '✓ ' : ''}${one.title}` }),
          h('p', { class: 'row-note', text: one.summary }),
          h('div', { class: 'row-actions' },
            pill(KIND[one.kind] || 'Open', () => resources.open(one.url)),
            pill(one.done ? 'Not finished' : 'Finished', () => { resources.setDone(one.id, !one.done); ctx.refresh(); }, { quiet: true }),
            pill('Remove', () => { resources.remove(one.id); ctx.refresh(); }, { quiet: true })))))
        : h('p', { class: 'body', text: `Free studies, guides and booklets from ${bank.source.name}. Add the ones you want and they wait for you here.` }),
      h('div', { class: 'poster-foot', style: 'margin-top:1rem' },
        go(mine.length ? 'Browse more from Cru' : 'Browse resources from Cru', () => ctx.go('resources')),
        art('book', { tone: 'paper', size: 'sm' }))));
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
