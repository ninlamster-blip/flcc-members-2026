// CONNECT — prayer, what is on, and the ministry's own memory wall.

import { h, poster, label, display, headline, art, go, pill, rise, note } from '../core/ui.js';
import * as content from '../core/content.js';
import * as store from '../core/storage.js';
import { forMode } from '../core/profile.js';

export default async function connectScreen(ctx) {
  const prayers = (store.read(store.KEYS.prayers, { items: [] }) || {}).items || [];
  const rsvps = (store.read(store.KEYS.rsvps, { going: [] }) || {}).going || [];

  const prayerBlock = poster({ tone: 'pink', tall: true, className: 'full' },
    label('Prayer'),
    h('div', {},
      display('YOU DON’T HAVE TO CARRY IT ALONE.'),
      h('p', { class: 'body dim', style: 'margin-top:1.1rem',
        text: prayers.length
          ? `You have shared ${prayers.length} prayer${prayers.length === 1 ? '' : 's'}. Every one goes to a ministry leader, not to a public feed.`
          : 'Tell God, and tell someone. Anything you share goes to a ministry leader — never to a public feed.' })),
    h('div', { class: 'poster-foot' },
      pill('Share a prayer', () => ctx.go('prayer')),
      art('hands', { tone: 'pink', size: 'sm' })));

  const events = h('div', { style: 'display:contents' });

  const el = h('div', { style: 'display:contents' }, prayerBlock, events);

  (async () => {
    let list = [];
    try { list = await content.events(); }
    catch { events.replaceChildren(note('Events could not be loaded.')); return; }

    const mine = list.filter((event) => event.for === 'both' || event.for === ctx.mode);
    const blocks = mine.map((event) => {
      const going = rsvps.includes(event.id);
      const button = pill(going ? 'You’re going' : 'I’m going', () => {
        const state = store.read(store.KEYS.rsvps, { going: [] }) || { going: [] };
        const set = new Set(state.going);
        if (set.has(event.id)) set.delete(event.id); else set.add(event.id);
        store.write(store.KEYS.rsvps, { going: [...set] });
        button.textContent = set.has(event.id) ? 'You’re going' : 'I’m going';
        ctx.toast(set.has(event.id) ? 'See you there.' : 'Taken off the list.');
      }, going ? {} : { quiet: false });

      return poster({ tone: event.tone, className: 'full' },
        label('What’s on'),
        h('div', {},
          display(forMode(event.title, ctx.mode)),
          h('p', { class: 'lead', style: 'margin-top:1rem', text: `${event.when} · ${event.where}` }),
          h('p', { class: 'body dim', style: 'margin-top:.7rem', text: event.blurb })),
        h('div', { class: 'poster-foot' }, button, art(event.symbol, { tone: event.tone, size: 'sm' })));
    });

    const ask = poster({ tone: 'blue', className: 'full' },
      label('Ask NEXT'),
      headline('GOT A QUESTION ABOUT GOD?'),
      h('p', { class: 'body dim', text: 'Ask it here. You will get the Bible on it, something to think about, a prayer and one thing to do — not a lecture, and not a person pretending to be one.' }),
      h('div', { class: 'poster-foot' },
        pill('Ask a question', () => ctx.go('ask')),
        art('question', { tone: 'blue', size: 'sm' })));

    const moments = poster({ tone: 'paper', className: 'full' },
      label('Community moments'),
      headline('WHAT WE HAVE BEEN UP TO'),
      h('p', { class: 'body dim', text: 'Photos from camps, fellowship and worship — added by ministry leaders, and checked before they appear.' }),
      h('div', { class: 'poster-foot' },
        h('p', { class: 'label dimmer', text: 'Nothing posted yet' }),
        art('camera', { tone: 'paper', size: 'sm' })));

    events.replaceChildren(...blocks, ask, moments);
    rise([...blocks, ask, moments]);
  })();

  return { title: 'Connect', el };
}
