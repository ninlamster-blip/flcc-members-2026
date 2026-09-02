// ONE NOTE — a page, and a keyboard.
//
// This screen is deliberately the least designed thing in the app. Somebody is
// using it while a sermon is happening: they are half-listening to the screen
// and fully listening to the room, and every extra control is a decision they
// have to make instead of writing down the thing they just heard.
//
// So: a title, two small fields, and a text area that grows. It saves as you
// type — there is no Save button, because a Save button is a thing to forget
// to press, and a sermon note lost to a locked screen is the whole feature
// wasted.

import { h, poster, label, art, go, pill, note as noteLine, rise, toast, reference } from '../core/ui.js';
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

  const title = h('input', { type: 'text', value: held.title, 'aria-label': 'What the sermon was about',
    placeholder: 'What was it about?' });
  const speaker = h('input', { type: 'text', value: held.speaker, 'aria-label': 'Who preached', placeholder: 'Who preached' });
  const ref = h('input', { type: 'text', value: held.ref, 'aria-label': 'The passage', placeholder: 'The passage' });
  const body = h('textarea', { rows: '16', 'aria-label': 'Your notes',
    placeholder: 'Whatever you want to remember.\n\nThe point he made about verse 4.\nThe thing that was uncomfortable.\nWhat to do about it this week.' });
  body.value = held.body;

  const fields = () => ({ title: title.value, speaker: speaker.value, ref: ref.value, body: body.value });
  for (const field of [title, speaker, ref, body]) field.addEventListener('input', () => patch(fields));

  // Leaving the screen must not lose the last second of typing, and must not
  // leave an empty note behind either.
  const settle = () => {
    clearTimeout(timer);
    notes.update(id, fields());
    notes.tidy();
  };
  window.addEventListener('hashchange', settle, { once: true });
  window.addEventListener('pagehide', settle);

  const parts = [
    poster({ tone: 'paper' },
      label('The sermon'),
      h('div', { style: 'margin-top:.8rem;display:flex;flex-direction:column;gap:.6rem' },
        title, speaker, ref),
      held.ref
        ? reference(held.ref, ctx.go, { style: 'margin-top:.9rem' })
        : noteLine('Type a passage like “Romans 8:28” and it becomes a link to the Bible next time you open this.')),

    poster({ tone: 'paper' }, body),

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
      noteLine('It saves itself as you write. Nothing here leaves this phone.')),
  ];

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Note', el };
}
