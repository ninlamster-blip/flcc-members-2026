// GROW.
//
// Four learning paths, one of them given the whole width because a featured
// thing that looks like everything else is not featured. The rest are rows —
// a title, a line, and how far in you are — which is what a person choosing
// between four courses actually needs to see.

import { h, block, section, label, display, title, lead, body, small,
         act, actions, go, rows, row, thread, rule, rise, note, waiting } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import { seasonOf, wants } from '../core/profile.js';

export default async function growScreen(ctx) {
  const paths = await content.paths();
  const blocks = [];

  // Where each path stands. One fetch per path, in parallel.
  const states = await Promise.all(paths.map(async (one) => {
    try {
      const sessions = await content.sessions(one.id);
      const where = progress.through('session', sessions.map((s) => `${one.id}:${s.id}`));
      return { path: one, sessions, where };
    } catch {
      return { path: one, sessions: [], where: { finished: 0, total: one.sessions || 0, percent: 0, next: null } };
    }
  }));

  const featured = states.find((one) => one.path.featured) || states[0];
  const rest = states.filter((one) => one !== featured);

  // ── The featured path ───────────────────────────────────────────────────
  if (featured) {
    const next = featured.sessions.find((s) => !progress.isDone('session', `${featured.path.id}:${s.id}`)) || featured.sessions[0];
    blocks.push(block({ tone: 'paper', tall: true, className: 'full',
        shape: { seed: featured.path.id, tones: featured.path.tones }, corner: 'br', soft: true },
      h('div', {},
        label(featured.path.kicker),
        h('div', { style: 'margin-top:1.2rem' }, display(featured.path.title)),
        h('p', { class: 'lead', style: 'margin-top:1rem;max-width:30ch', text: featured.path.blurb })),
      h('div', {},
        featured.where.finished ? h('div', { style: 'margin-bottom:1rem' }, thread(featured.where.percent)) : null,
        h('p', { class: 'row-meta', style: 'margin-bottom:.8rem',
          text: `${featured.where.total} sessions · ${featured.path.minutes}` }),
        actions(
          act(featured.where.finished ? 'Continue' : 'Start', () =>
            ctx.go(next ? `session/${featured.path.id}/${next.id}` : `path/${featured.path.id}`)),
          go('All sessions', () => ctx.go(`path/${featured.path.id}`))))));
  }

  // ── The rest ────────────────────────────────────────────────────────────
  blocks.push(section({ className: 'full' },
    h('div', { class: 'section-head' },
      label('Learning paths'),
      h('span', { class: 'row-meta', text: `${states.length} in all` })),
    rows({},
      ...rest.map((one) => {
        const holder = h('div', {});
        holder.appendChild(row({
          eyebrow: one.path.kicker,
          title: one.path.title,
          note: one.path.blurb,
          meta: one.where.finished ? `${one.where.finished}/${one.where.total}` : `${one.where.total} parts`,
          accent: one.path.accent,
          onclick: () => ctx.go(`path/${one.path.id}`),
        }));
        if (one.where.finished) holder.appendChild(h('div', { style: 'margin-top:.9rem' }, thread(one.where.percent, one.path.accent === 'mist' ? '' : one.path.accent)));
        return holder;
      }))));

  // ── Suggested, if nothing is started ────────────────────────────────────
  const anyStarted = states.some((one) => one.where.finished > 0);
  if (!anyStarted) {
    const season = seasonOf();
    const suggested = states.find((one) => (one.path.forSeason || []).includes(season.id))
      || states.find((one) => (one.path.forFocus || []).some((f) => wants(f)))
      || states[0];
    if (suggested) {
      blocks.push(section({ className: 'full' },
        label(`Because you said: ${season.label.toLowerCase()}`),
        title(`Start with ${suggested.path.title}`),
        body(suggested.path.blurb),
        go('Open it', () => ctx.go(`path/${suggested.path.id}`))));
    }
  }

  // ── What you have done ──────────────────────────────────────────────────
  const state = progress.getProgress();
  blocks.push(section({ className: 'full' },
    rule(),
    label('So far'),
    h('div', { class: 'figures' },
      figure(progress.count('session'), 'sessions'),
      figure(progress.count('reading'), 'readings'),
      figure(progress.count('prayer'), 'prayers')),
    small(state.days.count > 1
      ? `${state.days.count} days running, and ${state.days.best} at your best. Nothing is lost when a run ends.`
      : 'These are counts, not scores. Nobody else can see them, and they are not a measure of anything.')));

  const el = h('div', { style: 'display:contents' }, ...blocks);
  rise(blocks);
  return { title: 'Grow', el };
}

function figure(value, name) {
  return h('div', {},
    h('p', { class: 'numeral', text: String(value) }),
    h('p', { class: 'label', text: name }));
}
