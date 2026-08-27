// Sharing a prayer.
//
// Nothing here is public. A request is kept on this device and marked for a
// ministry leader to see — there is no feed, no comments, and no way for one
// young person's words to reach another's screen.

import { h, poster, label, display, art, pill, choice, note, toast } from '../core/ui.js';
import * as store from '../core/storage.js';
import * as progress from '../core/progress.js';
import { isKids } from '../core/profile.js';

const MOODS = [
  ['thankful', 'THANKFUL'], ['worried', 'WORRIED'], ['sad', 'SAD'],
  ['scared', 'SCARED'], ['angry', 'ANGRY'], ['stuck', 'STUCK'],
];

export default async function prayerScreen(ctx) {
  let mood = null;
  const text = h('textarea', { placeholder: isKids() ? 'God, I want to talk to you about…' : 'Say it however it comes out.', 'aria-label': 'Your prayer' });
  const visibility = { value: 'leader' };

  const moodRow = h('div', { class: 'pill-row' }, ...MOODS.map(([id, text_]) => {
    const button = pill(text_, () => {
      mood = id;
      [...moodRow.children].forEach((child) => child.removeAttribute('data-quiet'));
      [...moodRow.children].forEach((child) => { if (child !== button) child.setAttribute('data-quiet', ''); });
    }, { quiet: true });
    return button;
  }));

  const choices = h('div', { class: 'choice-list', style: 'margin-top:1rem' },
    ...[['leader', 'JUST A MINISTRY LEADER'], ['private', 'ONLY ME AND GOD']].map(([id, text_]) => {
      const button = choice(text_, () => {
        visibility.value = id;
        [...choices.children].forEach((child) => child.removeAttribute('data-chosen'));
        button.dataset.chosen = '';
      });
      if (id === 'leader') button.dataset.chosen = '';
      return button;
    }));

  const el = h('div', { style: 'display:contents' },
    poster({ tone: 'pink', tall: true, className: 'full' },
      label('Share a prayer'),
      h('div', {},
        display('WHAT’S GOING ON?'),
        h('div', { style: 'margin-top:1.3rem' }, moodRow),
        h('div', { style: 'margin-top:1.3rem' }, text)),
      h('div', { class: 'poster-foot' }, h('span'), art('hands', { tone: 'pink', size: 'sm' }))),

    poster({ tone: 'paper', className: 'full' },
      label('Who sees this'),
      choices,
      h('p', { class: 'body dim', style: 'margin-top:1rem',
        text: 'There is no public prayer feed in FLCC NEXT. Nothing you write is shown to other young people.' }),
      h('div', { class: 'poster-foot' },
        pill('Send it', () => {
          const body = text.value.trim();
          if (!body) { toast('Write something first.'); return; }
          const state = store.read(store.KEYS.prayers, { items: [] }) || { items: [] };
          state.items.unshift({
            id: `p${Date.now().toString(36)}`,
            date: new Date().toISOString(),
            mood,
            content: body,
            visibility: visibility.value,
            moderation_status: visibility.value === 'leader' ? 'pending' : 'private',
          });
          store.write(store.KEYS.prayers, state);
          progress.complete('prayer', `${Date.now()}`);
          toast(visibility.value === 'leader' ? 'Sent to a ministry leader.' : 'Kept between you and God.');
          ctx.go('connect');
        }))),

    poster({ tone: 'paper', className: 'full' },
      label('If it is serious'),
      h('p', { class: 'body', text: 'If someone is hurting you, or you are thinking about hurting yourself, please tell a parent, a guardian or a ministry leader today. This app is not a person, and some things need one.' })),
  );

  return { title: 'Prayer', el };
}
