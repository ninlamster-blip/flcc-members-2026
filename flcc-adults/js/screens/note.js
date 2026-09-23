// ONE NOTE — a page, and a keyboard.
//
// This screen is deliberately the least designed thing in the app. Somebody is
// using it while a sermon is happening: they are half-listening to the screen
// and fully listening to the room, and every extra control is a decision they
// have to make instead of writing down the thing they just heard.
//
// It follows the shape of a message on the Watch tab, section for section —
// the message, what it was about, what it said in three points, the question
// to sit with, and your own words — so a note taken on Friday reads back like
// the messages beside it. Every section is optional; write in the ones you
// have. It saves as you type — there is no Save button, because a Save button
// is a thing to forget to press, and a sermon note lost to a locked screen is
// the whole feature wasted.

import { h, poster, label, art, go, pill, pillRow, note as noteLine, rise, toast, reference } from '../core/ui.js';
import * as notes from '../core/notes.js';

export default async function noteScreen(ctx) {
  const [id] = ctx.route.args;
  const held = notes.get(id);

  if (!held) {
    return { title: 'Note', el: poster({ tone: 'rose' },
      label('Note'),
      h('p', { class: 'body', text: 'That note is not on this phone any more.' }),
      h('div', { class: 'poster-foot' }, go('Back to your notes', () => ctx.go('notes')), h('span'))) };
  }

  // Saving on every keystroke would write to storage a hundred times a minute
  // for no benefit; a second's pause is imperceptible to the writer and turns
  // a paragraph into one write.
  let timer = null;
  const patch = (fields) => {
    clearTimeout(timer);
    timer = setTimeout(() => notes.update(id, fields()), 600);
  };

  const title = h('input', { type: 'text', value: held.title, 'aria-label': 'The message',
    placeholder: 'The message — e.g. Faith' });
  const speaker = h('input', { type: 'text', value: held.speaker, 'aria-label': 'Who preached', placeholder: 'Who preached' });
  const ref = h('input', { type: 'text', value: held.ref, 'aria-label': 'The passage', placeholder: 'The passage' });
  const about = h('textarea', { rows: '3', 'aria-label': 'What it was about', style: 'min-height:5rem',
    placeholder: 'In a sentence or two, what was it about?' });
  about.value = held.about || '';
  // Textareas rather than one-line inputs: a point heard in a sermon is a
  // sentence, and a one-line field hides the end of it off the side.
  const short = 'min-height:3.4rem';
  const points = notes.pointsOf(held).map((value, i) => {
    const field = h('textarea', { rows: '2', 'aria-label': `Point ${i + 1}`, placeholder: `${i + 1}.`, style: short });
    field.value = value;
    return field;
  });
  const question = h('textarea', { rows: '2', 'aria-label': 'Sit with this', style: short,
    placeholder: 'The question it left you with.' });
  question.value = held.question || '';
  const body = h('textarea', { rows: '8', 'aria-label': 'Your own words',
    placeholder: 'What is this saying to you?\n\nThe thing that was uncomfortable.\nWhat to do about it this week.' });
  body.value = held.body;

  const fields = () => ({
    title: title.value, speaker: speaker.value, ref: ref.value,
    about: about.value, points: points.map((field) => field.value),
    question: question.value, body: body.value,
  });
  for (const field of [title, speaker, ref, about, ...points, question, body]) {
    field.addEventListener('input', () => patch(fields));
  }

  const stack = (...children) => h('div', { style: 'margin-top:.8rem;display:flex;flex-direction:column;gap:.6rem' }, ...children);
  const when = new Date(held.createdAt || Date.now())
    .toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' });

  // Leaving the screen must not lose the last second of typing, and must not
  // leave an empty note behind either.
  const settle = () => {
    clearTimeout(timer);
    notes.update(id, fields());
    notes.tidy();
  };
  window.addEventListener('hashchange', settle, { once: true });

  // Sharing has to send what is on the screen, including the last second of
  // typing that has not been written to storage yet.
  const settled = () => {
    clearTimeout(timer);
    return notes.update(id, fields()) || { ...held, ...fields() };
  };
  window.addEventListener('pagehide', settle);

  const parts = [
    poster({ tone: 'paper' },
      label(`Message · ${when}`),
      stack(title, speaker, ref),
      held.ref
        ? reference(held.ref, ctx.go, { style: 'margin-top:.9rem' })
        : noteLine('Type a passage like “Romans 8:28” and it becomes a link to the Bible next time you open this.')),

    poster({ tone: 'paper' },
      label('What it was about'),
      stack(about)),

    poster({ tone: 'paper' },
      label('What it said'),
      stack(...points)),

    poster({ tone: 'sky' },
      label('Sit with this'),
      stack(question)),

    poster({ tone: 'sunshine' },
      label('Your own words'),
      stack(body)),

    poster({ tone: 'paper' },
      label('Keep a copy'),
      h('div', { class: 'poster-foot' },
        pillRow(
          pill('Share', () => share(settled())),
          pill('Save as a file', () => download(settled()), { quiet: true })),
        h('span')),
      noteLine('Share sends it wherever you choose — WhatsApp, email, your notes app. Nothing is sent until you pick where.')),

    poster({ tone: 'paper' },
      label('This note'),
      h('div', { class: 'poster-foot' },
        pill('Delete it', () => {
          clearTimeout(timer);
          notes.remove(id);
          toast('Deleted.');
          ctx.go('notes');
        }, { quiet: true }),
        art('parcel', { tone: 'paper', size: 'sm' })),
      noteLine('It saves itself as you write. Nothing here leaves this phone unless you share it.')),
  ];

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Note', el };
}

/**
 * The phone's own share sheet where there is one; a copy where there is not;
 * a file as the last resort. A share the member cancels is not an error.
 */
async function share(one) {
  const text = notes.asText(one);
  if (navigator.share) {
    try {
      await navigator.share({ title: String(one.title || '').trim() || 'Sermon notes', text });
      return;
    } catch (err) {
      if (err && err.name === 'AbortError') return;
    }
  }
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied — paste it anywhere.');
  } catch {
    download(one);
  }
}

function download(one) {
  const url = URL.createObjectURL(new Blob([notes.asText(one)], { type: 'text/plain;charset=utf-8' }));
  const link = h('a', { href: url, download: notes.fileName(one), style: 'display:none' });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
  toast('Saved as a file.');
}
