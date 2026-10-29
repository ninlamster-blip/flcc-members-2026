// One message.
//
// The shape is the same every time: what it was preached from, what it said,
// the question it left behind, and room to write one line back. Three
// takeaways is the ceiling on purpose — a member reading this on a phone at
// the end of a shift will read three and skim seven.

import { h, poster, label, display, headline, art, go, pill,
         rows, row, reference, note, rise, toast, swap } from '../core/ui.js';
import * as content from '../core/content.js';
import * as progress from '../core/progress.js';
import * as notes from '../core/notes.js';
import * as prayers from '../core/prayers.js';
import * as video from '../core/video.js';

const toneOf = (name) => (name === 'poppy' ? 'rose' : (name === 'navy' ? 'ink' : (name || 'paper')));

export default async function messageScreen(ctx) {
  const [id] = ctx.route.args;
  const all = await content.messages();
  const one = all.find((item) => item.id === id);
  if (!one) {
    return { title: 'Watch', el: poster({ tone: 'paper' }, label('Watch'), note('That message has moved.')) };
  }

  const when = new Date(`${one.date}T00:00:00`)
    .toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' });
  const opened = progress.isDone('message', one.id);
  const tone = toneOf(one.tone);
  const rec = video.recording(one);
  const parts = [];

  parts.push(poster({ tone, tall: true },
    // The first message of a series usually shares its name, and printing it
    // as the label above itself says the same words twice in two sizes.
    label(one.series === one.title ? 'Message' : one.series),
    h('div', {},
      display(String(one.title).toUpperCase()),
      h('p', { class: 'lead dim', style: 'margin-top:1rem', text: `${one.speaker} · ${when} · ${one.minutes} min` }),
      reference(one.ref, ctx.go, { style: 'margin-top:1rem' })),
    h('div', { class: 'poster-foot' },
      rec.youtube || rec.facebook
        ? h('span', { class: 'go', text: 'The recording is below.' })
        : note('No recording has been published for this one. What was said is below.'),
      art(one.symbol || 'book', { tone, size: 'sm' }))));

  // ── The recording ───────────────────────────────────────────────────────
  //
  // YouTube's player is not loaded until Play is pressed: before that this
  // poster asks nothing of anybody (core/video.js has why). Facebook's
  // recording opens on Facebook, which will not play it here.
  if (rec.youtube || rec.facebook) {
    const screen = h('div', { class: 'video' });
    let playButton = null;
    const play = () => {
      swap(screen, h('iframe', {
        src: video.playerUrl(rec.youtube),
        title: `Recording: ${one.title}`,
        allow: 'autoplay; encrypted-media; picture-in-picture; fullscreen',
        allowfullscreen: '',
      }));
      if (playButton) playButton.remove();
    };
    playButton = rec.youtube ? pill('Play the recording', play) : null;
    const facebook = rec.facebook
      ? pill(rec.youtube ? 'Or on Facebook' : 'Watch on Facebook',
          () => window.open(rec.facebook, '_blank', 'noopener'), { quiet: !!rec.youtube })
      : null;
    parts.push(poster({ tone: 'ink' },
      label('The recording'),
      rec.youtube ? screen : null,
      h('div', { class: 'poster-foot' },
        h('div', { class: 'pill-row' },
          playButton,
          facebook),
        h('span', { class: 'row-meta', text: rec.youtube ? 'Plays from YouTube' : 'Opens Facebook' }))));
  }

  parts.push(poster({ tone: 'paper' },
    label('What it was about'),
    h('p', { class: 'body', text: one.blurb })));

  parts.push(poster({ tone: 'paper' },
    label('What it said'),
    rows(...one.takeaways.map((line, i) => row({ title: `${i + 1}. ${line}` })))));

  parts.push(poster({ tone: 'sky' },
    label('Sit with this'),
    headline(one.question),
    h('div', { class: 'poster-foot' }, h('span'), art('blob', { tone: 'sky', size: 'sm' }))));

  const input = h('textarea', { placeholder: 'What is this saying to you? One sentence is enough.',
    'aria-label': 'Your reflection' });
  const mark = h('div', {});

  parts.push(poster({ tone: 'sunshine' },
    label('Your own words'),
    h('div', {}, input, mark),
    h('div', { class: 'poster-foot' },
      h('div', { class: 'pill-row' },
        pill('Keep this', () => {
          const text = input.value.trim();
          if (!text) { toast('Write a line first.'); input.focus(); return; }
          prayers.reflect({ text, guide: `${one.series}: ${one.title}`, ref: one.ref });
          progress.complete('message', one.id);
          input.value = '';
          swap(mark, h('p', { class: 'note', style: 'margin-top:.8rem', text: 'Kept — it is in Pray, under Reflections.' }));
        }),
        opened ? null : pill('Mark as heard', () => {
          progress.complete('message', one.id);
          swap(mark, h('p', { class: 'note', style: 'margin-top:.8rem', text: 'Marked as heard.' }));
        }, { quiet: true })),
      h('span', { class: 'row-meta', text: 'Stays on this device' }))));

  // ── Notes on this one ───────────────────────────────────────────────────
  //
  // A reflection is one kept line; a note is a page. Starting one from here
  // fills in the title, the preacher and the passage, which is the whole
  // difference between "I'll write that down later" and writing it down.
  const already = notes.list().find((one0) => one0.messageId === one.id);
  parts.push(poster({ tone: 'paper' },
    label(already ? 'Your note on this' : 'Notes'),
    h('p', { class: 'body', text: already
      ? 'You have already started a page on this message.'
      : 'A page of your own on this message, with the title, the preacher and the passage already filled in.' }),
    h('div', { class: 'poster-foot' },
      pill(already ? 'Open your note' : 'Take notes on this', () => {
        const target = already || notes.create({
          title: one.title, speaker: one.speaker, ref: one.ref, messageId: one.id,
        });
        ctx.go(`note/${target.id}`);
      }, { quiet: true }),
      art('book', { tone: 'paper', size: 'sm' }))));

  parts.push(poster({ tone: 'paper' },
    label('Every message'),
    note('Nothing you write here is sent to the church, to the preacher, or to us. It is on this phone.'),
    h('div', { class: 'poster-foot' }, go('All messages', () => ctx.go('watch')), h('span'))));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: one.title, el };
}
