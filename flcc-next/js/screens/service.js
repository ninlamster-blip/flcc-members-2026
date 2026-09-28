// AT CHURCH — the notes sheet for service day, and the notes already kept.
//
// Four prompts, all optional: the passage, one thing learned, one thing to do,
// and a question — which can go straight to Ask NEXT. Kept on this phone only,
// like everything else a young person writes here.

import { h, poster, label, display, headline, art, pill, go, note, toast, celebrate, reference } from '../core/ui.js';
import * as content from '../core/content.js';
import * as store from '../core/storage.js';
import * as progress from '../core/progress.js';
import * as service from '../core/service.js';
import { forMode } from '../core/profile.js';

export default async function serviceScreen(ctx) {
  const day = progress.today();
  let sermon = null;
  try { sermon = service.sermonFor(await content.sermons(), day); } catch { /* the sheet works without one */ }

  const saved = () => (store.read(store.KEYS.notes, { items: [] }) || {}).items || [];
  const todays = saved().find((row) => row.date === day) || {};

  const fields = {};
  const form = service.PROMPTS.map((prompt) => {
    const input = prompt.key === 'passage'
      ? h('input', { type: 'text', value: todays.passage || (sermon && sermon.ref) || '', placeholder: forMode(prompt, ctx.mode) || prompt.kids, 'aria-label': prompt.label })
      : h('textarea', { placeholder: forMode(prompt, ctx.mode) || prompt.kids, 'aria-label': prompt.label, style: 'min-height:5rem' });
    if (prompt.key !== 'passage') input.value = todays[prompt.key] || '';
    fields[prompt.key] = input;
    return h('label', { class: 'field' }, h('span', { text: prompt.label }), input);
  });

  const past = h('div', { style: 'display:contents' });
  const paintPast = () => {
    const items = saved().filter((row) => row.date !== day).slice(0, 6);
    past.replaceChildren(...items.map((row) => poster({ tone: 'paper', className: 'full' },
      label(new Date(`${row.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })),
      row.passage ? h('p', { class: 'lead', text: row.passage }) : null,
      ...service.PROMPTS.slice(1).filter((prompt) => row[prompt.key]).map((prompt) =>
        h('p', { class: 'body', style: 'margin-top:.6rem' }, h('strong', { text: `${prompt.label}: ` }), row[prompt.key])))));
  };

  const save = () => {
    const record = { date: day };
    for (const prompt of service.PROMPTS) record[prompt.key] = fields[prompt.key].value.trim();
    if (!service.worthKeeping(record)) { toast('Write one thing you learned first.'); return; }
    store.write(store.KEYS.notes, { items: service.keep(saved(), record) });
    const result = progress.complete('service', day);
    // Said on the button rather than in a toast: a toast sits exactly where
    // the Ask NEXT button appears below, and would cover it.
    saveButton.textContent = result.first ? `Kept · +${progress.XP.service} XP` : 'Updated ✓';
    setTimeout(() => { saveButton.textContent = 'Update my notes'; }, 2500);
    celebrate(result);
    if (record.question) {
      askBlock.replaceChildren(poster({ tone: 'sky', className: 'full' },
        label('Your question'),
        h('p', { class: 'lead', text: record.question }),
        h('div', { class: 'poster-foot' },
          pill('Ask NEXT about it', () => ctx.go(`ask?q=${encodeURIComponent(record.question)}`)),
          art('question', { tone: 'sky', size: 'sm' }))));
    }
  };
  const askBlock = h('div', { style: 'display:contents' });
  const saveButton = pill(todays.date ? 'Update my notes' : 'Keep my notes', save);

  const el = h('div', { style: 'display:contents' },
    poster({ tone: 'captain', tall: true, className: 'full' },
      label(service.isServiceDay(day) ? 'At church today' : 'Church notes'),
      h('div', {},
        display(sermon ? forMode(sermon.title, ctx.mode) || 'LISTEN FOR ONE THING.' : 'LISTEN FOR ONE THING.'),
        sermon && sermon.ref ? reference(sermon.ref, ctx.go, { style: 'margin-top:.9rem' }) : null,
        h('p', { class: 'body dim', style: 'margin-top:1rem', text: sermon && sermon.idea
          ? forMode(sermon.idea, ctx.mode)
          : 'Keep this open during the message, or fill it in on the way home. One thing you learned is enough.' })),
      h('div', { class: 'poster-foot' }, h('span'), art('words', { tone: 'captain', size: 'sm' }))),

    poster({ tone: 'paper', className: 'full' },
      label('My notes'),
      ...form,
      h('div', { class: 'poster-foot', style: 'margin-top:1.2rem' },
        saveButton,
        h('p', { class: 'label dimmer', text: 'Kept on this phone only' }))),

    askBlock,
    past,
  );
  paintPast();
  return { title: 'Church notes', el };
}
