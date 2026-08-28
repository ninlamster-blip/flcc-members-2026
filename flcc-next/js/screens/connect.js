// CONNECT — prayer, what is on, and the ministry's own memory wall.

import { h, poster, label, display, headline, art, go, pill, rise, note } from '../core/ui.js';
import * as content from '../core/content.js';
import * as store from '../core/storage.js';
import { forMode } from '../core/profile.js';
import { sendToLeader } from './prayer.js';
import * as delivery from '../core/delivery.js';
import { getUser, mode } from '../core/profile.js';
import { isConcerning } from '../core/safety.js';

export default async function connectScreen(ctx) {
  const prayers = (store.read(store.KEYS.prayers, { items: [] }) || {}).items || [];
  const rsvps = (store.read(store.KEYS.rsvps, { going: [] }) || {}).going || [];

  const prayerBlock = poster({ tone: 'pink', tall: true, className: 'full' },
    label('Prayer'),
    h('div', {},
      display('YOU DON’T HAVE TO CARRY IT ALONE.'),
      h('p', { class: 'body dim', style: 'margin-top:1.1rem',
        text: prayers.length
          ? `You have written ${prayers.length} prayer${prayers.length === 1 ? '' : 's'}, kept on this phone. Nothing is sent on its own — send one to a leader when you want them to see it.`
          : 'Tell God, and tell someone. What you write stays on this phone until you send it to a leader yourself — it is never put on a public feed.' })),
    h('div', { class: 'poster-foot' },
      pill('Share a prayer', () => ctx.go('prayer')),
      art('hands', { tone: 'pink', size: 'sm' })));

  // Prayers already written and marked for a leader. Without this a young
  // person who saved one has no way to get it to anybody — which is exactly
  // how a prayer goes unread.
  const waiting = prayers.filter((prayer) => prayer.visibility === 'leader' && !prayer.delivered);
  const sendRow = (prayer) => {
    const state = h('p', { class: 'label dim', style: 'margin-top:.5rem', text: 'Not sent yet' });
    const row = h('div', { style: 'padding:.8rem 0;border-top:1px solid var(--ink-12)' },
      h('p', { class: 'body', text: prayer.content }), state);

    // Try the church's own delivery first; the share sheet is the fallback,
    // and either way the label only changes on a real result.
    const retry = pill('Send it', async () => {
      state.textContent = 'Sending…';
      const sent = await delivery.send({
        content: prayer.content,
        mood: prayer.mood,
        firstName: (getUser() || {}).name,
        ageGroup: mode(),
        urgent: isConcerning(prayer.content),
      });
      if (sent.delivered) {
        const saved = store.read(store.KEYS.prayers, { items: [] }) || { items: [] };
        const mine = (saved.items || []).find((one) => one.id === prayer.id);
        if (mine) { mine.delivered = true; mine.remoteId = sent.id; mine.deliveredAt = new Date().toISOString(); }
        store.write(store.KEYS.prayers, saved);
        state.textContent = 'Sent to your leaders';
        retry.remove();
        byHand.remove();
        return;
      }
      state.textContent = sent.reason === 'off'
        ? 'Sending is not switched on — send it yourself below'
        : 'That did not send. Try again, or send it yourself below';
    }, { quiet: true });

    const byHand = pill('Send it myself', async () => {
      const how = await sendToLeader(prayer);
      if (how === 'shared') ctx.toast('Sent from your phone.');
      else if (how === 'copied') ctx.toast('Copied — paste it to your leader.');
      else if (how === 'manual') ctx.toast('Show them your phone.');
    }, { quiet: true });

    row.appendChild(h('div', { class: 'pill-row', style: 'margin-top:.6rem' }, retry, byHand));
    return row;
  };

  const waitingBlock = waiting.length
    ? poster({ tone: 'paper', className: 'full' },
      label(`Not sent yet · ${waiting.length}`),
      h('p', { class: 'body dim', text: 'You marked these for a leader, and they have not reached anyone yet.' }),
      h('div', { style: 'margin-top:.4rem' }, ...waiting.slice(0, 5).map(sendRow)))
    : null;

  const events = h('div', { style: 'display:contents' });

  const el = h('div', { style: 'display:contents' }, prayerBlock, waitingBlock, events);

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
