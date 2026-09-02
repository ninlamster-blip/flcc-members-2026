// WATCH — the messages preached at FLCC.
//
// One featured poster at full height, then the rest as posters and a list.
//
// One thing about this tab is worth stating plainly. **This church has no
// video archive, and this app will not pretend otherwise.** Every message here
// carries the passage it was preached from, what it said, and the question it
// left behind — that is a real thing to open on a Friday evening, and it works
// with no signal and no data.
//
// `url` on a message is the recording, and it is empty on all of them today.
// When the media team publishes one, filling that field in
// `content/messages.json` turns "Watch the recording" on for that message and
// nothing else changes. Until then, no button anywhere on this screen claims
// to play something that does not exist.

import { h, poster, label, display, headline, art, go, pill,
         rows, row, reference, note, rise, toneFor } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import * as notes from '../core/notes.js';

const dateOf = (one) => new Date(`${one.date}T00:00:00`);
const said = (one) => dateOf(one).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });
const heard = (one) => progress.isDone('message', one.id);
const toneOf = (name) => (name === 'poppy' ? 'rose' : (name === 'navy' ? 'ink' : (name || 'paper')));

export default async function watchScreen(ctx) {
  let messages;
  try {
    messages = await content.messages();
  } catch {
    return { title: 'Watch', el: poster({ tone: 'rose' },
      label('Watch'),
      headline('THE MESSAGES DID NOT LOAD'),
      note('They need a connection the first time, and stay on the device afterwards.')) };
  }

  const all = [...messages].sort((a, b) => dateOf(b) - dateOf(a));
  const parts = [];

  // ── The featured message ────────────────────────────────────────────────
  //
  // The most recent one, at full height. There is no photograph behind it and
  // there is not going to be a stock one: a still nobody at this church took
  // is a picture of a stranger's worship band, and members can tell.
  const featured = all[0];
  if (featured) {
    const tone = toneOf(featured.tone);
    parts.push(poster({ tone, tall: true },
      label(featured.series === featured.title ? 'Latest message' : featured.series),
      h('div', {},
        display(String(featured.title).toUpperCase()),
        h('p', { class: 'lead dim', style: 'margin-top:1rem',
          text: `${featured.speaker} · ${said(featured)} · ${featured.minutes} min` }),
        reference(featured.ref, ctx.go, { style: 'margin-top:1rem' })),
      h('div', { class: 'poster-foot' },
        pill(heard(featured) ? 'Open it again' : 'Open this message', () => ctx.go(`message/${featured.id}`)),
        art(featured.symbol || 'book', { tone, size: 'sm' }))));
  }

  // ── Keep going ──────────────────────────────────────────────────────────
  //
  // Not "continue watching" — nothing here is watched. It is the rest of the
  // series a member last opened, which is the thing they would actually want
  // next, and it disappears entirely rather than showing an empty row.
  const opened = all.filter(heard);
  const series = opened.length ? opened[0].series : null;
  const carry = series
    ? all.filter((one) => one.series === series && !heard(one))
    : all.slice(1, 3);

  carry.slice(0, 2).forEach((one, i) => {
    const tone = toneFor(i, 1);
    parts.push(poster({ tone, as: 'button', onclick: () => ctx.go(`message/${one.id}`) },
      label(series ? 'Keep going' : 'Start here'),
      headline(String(one.title).toUpperCase()),
      h('div', { class: 'poster-foot' },
        h('span', { class: 'go' }, `${one.speaker} · ${one.minutes} min`),
        art(one.symbol || 'book', { tone, size: 'sm' }))));
  });

  // ── Everything, newest first ────────────────────────────────────────────
  parts.push(poster({ tone: 'paper' },
    label(`Every message · ${all.length}`),
    rows(...all.map((one) => row({
      title: one.title,
      note: `${one.speaker} · ${said(one)}${one.series === one.title ? '' : ` · ${one.series}`}`,
      meta: heard(one) ? 'Opened' : `${one.minutes} min`,
      onclick: () => ctx.go(`message/${one.id}`),
    })))));

  // ── Series ──────────────────────────────────────────────────────────────
  const bySeries = new Map();
  for (const one of all) {
    if (!bySeries.has(one.series)) bySeries.set(one.series, []);
    bySeries.get(one.series).push(one);
  }
  parts.push(poster({ tone: 'sky' },
    label('Series'),
    rows(...[...bySeries.entries()].map(([name, items]) => {
      const done = items.filter(heard).length;
      return row({
        title: name,
        note: `${items.length} message${items.length === 1 ? '' : 's'}`,
        meta: done ? `${done}/${items.length}` : String(items.length),
        onclick: () => ctx.go(`message/${(items.find((one) => !heard(one)) || items[0]).id}`),
      });
    })),
    h('div', { class: 'poster-foot' }, h('span'), art('mug', { tone: 'sky', size: 'sm' }))));

  // ── Notes ───────────────────────────────────────────────────────────────
  //
  // Under the messages rather than above them: somebody who came to Watch came
  // for a sermon. But it is a whole poster rather than a link, because taking
  // notes on Sunday is the thing this tab is most used for during a service.
  const written = notes.list();
  parts.push(poster({ tone: 'captain' },
    label(written.length ? `Your notes · ${written.length}` : 'Sermon notes'),
    headline(written.length ? 'WHAT YOU WROTE DOWN' : 'WRITE IT DOWN'),
    written.length
      ? rows(...written.slice(0, 3).map((one) => row({
          title: String(one.title).trim() || 'Untitled',
          note: [one.speaker, one.ref].filter(Boolean).join(' · '),
          meta: new Date(one.updatedAt).toLocaleDateString(undefined, { day: 'numeric', month: 'short' }),
          onclick: () => ctx.go(`note/${one.id}`),
        })))
      : h('p', { class: 'body dim', style: 'margin-top:.8rem', text: 'A title, the passage, and a page. It saves as you type and stays on this phone.' }),
    h('div', { class: 'poster-foot' },
      pill(written.length ? 'Open your notes' : 'Start a note', () => {
        if (written.length) ctx.go('notes');
        else ctx.go(`note/${notes.create().id}`);
      }),
      art('book', { tone: 'captain', size: 'sm' }))));

  // ── What this tab is, and is not ────────────────────────────────────────
  parts.push(poster({ tone: 'paper' },
    label('About the recordings'),
    h('p', { class: 'body', text: 'FLCC does not publish a video archive, so nothing on this screen plays. What is here is what was preached — the passage, the substance and the question — written up so it can be read on the bus with no signal.' }),
    note('When the media team posts a recording, it appears here as a link on that message.')));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Watch', el };
}
