// WATCH — the messages preached at FLCC.
//
// A media screen rather than a list of links: one message featured at full
// width, then a rail of the series you are part-way through, then everything
// else as editorial rows.
//
// One thing about this tab is worth stating plainly, because it is the reason
// it does not look like every other church app's video page. **This church has
// no video archive, and this app will not pretend otherwise.** Every message
// here carries the passage it was preached from, what it said, and the
// question it left behind — that is a real thing to open on a Sunday evening,
// and it works with no signal and no data.
//
// `url` on a message is the recording, and it is empty on all of them today.
// When the media team publishes one, filling that field in
// `content/messages.json` turns "Watch the recording" on for that message and
// nothing else changes. Until then, no button anywhere on this screen claims
// to play something that does not exist.

import { h, block, card, badge, display, title, lead, small, pageTitle, nextLine,
         act, actions, go, rail, tile, rows, row, section, tag, reference,
         rise, note, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';

const dateOf = (one) => new Date(`${one.date}T00:00:00`);
const said = (one) => dateOf(one).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const heard = (one) => progress.isDone('message', one.id);

export default async function watchScreen(ctx) {
  let messages;
  try {
    messages = await content.messages();
  } catch {
    return { title: 'Watch', el: card({ tone: 'paper', className: 'full', symbol: 'cloud' },
      badge('Watch'),
      note('The messages did not load. They need a connection the first time, and stay on the device afterwards.', 'warn')) };
  }

  const all = [...messages].sort((a, b) => dateOf(b) - dateOf(a));
  const parts = [];

  parts.push(pageTitle('Watch', 'Encounter · learn · be transformed'));

  // ── The featured message ────────────────────────────────────────────────
  //
  // The most recent one, at full width. There is no photograph behind it and
  // there is not going to be a stock one: a still nobody at this church took
  // is a stock photo of a stranger's worship band, and members can tell.
  const featured = all[0];
  if (featured) {
    parts.push(section({ className: 'full' },
      nextLine('Featured message'),
      block({ className: 'full' },
        badge(featured.series === featured.title ? 'Message' : featured.series),
        display(featured.title),
        h('p', { class: 'lead', text: `${featured.speaker} · ${said(featured)} · ${featured.minutes} min` }),
        reference(featured.ref, ctx.go),
        actions(
          act(heard(featured) ? 'Open it again' : 'Open this message', () => ctx.go(`message/${featured.id}`)),
          featured.url ? go('Watch the recording', () => window.open(featured.url, '_blank', 'noopener')) : null))));
  }

  // ── Keep going ──────────────────────────────────────────────────────────
  //
  // Not "continue watching" — nothing here is watched. It is the rest of the
  // series a member last opened, which is the thing they would actually want
  // next, and it disappears entirely rather than showing an empty rail.
  const opened = all.filter(heard);
  const series = opened.length ? opened[0].series : null;
  const carry = series
    ? all.filter((one) => one.series === series && !heard(one))
    : all.slice(1, 4);

  if (carry.length) {
    parts.push(section({ className: 'full' },
      nextLine(series ? 'Keep going' : 'Start here'),
      rail({}, ...carry.slice(0, 6).map((one) => tile({
        name: one.title,
        by: one.speaker,
        meta: `${one.minutes} min · ${said(one)}`,
        onclick: () => ctx.go(`message/${one.id}`),
      })))));
  }

  // ── Everything, newest first ────────────────────────────────────────────
  parts.push(section({ className: 'full' },
    nextLine('Latest messages'),
    rows({}, ...all.map((one) => row({
      eyebrow: one.series === one.title ? '' : one.series,
      title: one.title,
      note: `${one.speaker} · ${said(one)}`,
      meta: heard(one) ? 'Opened' : `${one.minutes} min`,
      accent: one.tone,
      onclick: () => ctx.go(`message/${one.id}`),
    })))));

  // ── Series ──────────────────────────────────────────────────────────────
  const bySeries = new Map();
  for (const one of all) {
    if (!bySeries.has(one.series)) bySeries.set(one.series, []);
    bySeries.get(one.series).push(one);
  }
  parts.push(section({ className: 'full' },
    nextLine('Series'),
    rows({}, ...[...bySeries.entries()].map(([name, items]) => {
      const done = items.filter(heard).length;
      return row({
        title: name,
        note: `${items.length} message${items.length === 1 ? '' : 's'} · ${items[items.length - 1].speaker === items[0].speaker ? items[0].speaker : 'Several speakers'}`,
        meta: done ? `${done}/${items.length}` : String(items.length),
        accent: items[0].tone,
        chev: true,
        onclick: () => ctx.go(`message/${items.find((one) => !heard(one))?.id || items[0].id}`),
      });
    }))));

  // ── What this tab is, and is not ────────────────────────────────────────
  parts.push(card({ tone: 'paper', className: 'full' },
    badge('About the recordings'),
    h('p', { class: 'body', text: 'FLCC does not publish a video archive, so nothing on this screen plays. What is here is what was preached — the passage, the substance and the question — written up so it can be read on the bus with no signal.' }),
    small('When the media team posts a recording, it appears here as a link on that message. Ask a leader after the Friday service if you are looking for something in particular.')));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Watch', el };
}
