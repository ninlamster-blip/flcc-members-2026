// PRAYER — Scripture → Reflection → Prayer → Journal.
// Saved prayers are private, live on this device, and are never sent anywhere.

import { h, section, card, eyebrow, button, list, row, notice, spinner, toast } from '../core/ui.js';
import * as content from '../core/content.js';
import * as store from '../core/storage.js';
import { pick } from '../core/age.js';
import { parseRef, formatRef } from '../core/refs.js';
import { getPassage, joinText } from '../core/bible.js';
import { translationId } from '../core/profile.js';
import { pickFor } from '../core/daily.js';

function getPrayers() {
  return store.read(store.KEYS.prayers, { items: [] }) || { items: [] };
}

export default async function prayerScreen(ctx) {
  const el = h('div', {}, spinner());
  const trans = translationId(ctx.settings);

  let moods;
  try { moods = await content.moods(); }
  catch (error) { return { title: 'Pray', el: notice(`Prayer content could not be loaded. ${error.message}`), tab: 'me' }; }

  const flow = h('div');
  const moodGrid = h('div', { class: 'moods' });
  let chosen = null;

  const openMood = async (mood) => {
    chosen = mood;
    [...moodGrid.children].forEach((child) => child.setAttribute('aria-pressed', String(child.dataset.mood === mood.id)));

    const verseRef = parseRef(pickFor(mood.verses, new Date()) || mood.verses[0]);
    const scriptureBox = h('div', {}, spinner());
    const prayerText = h('textarea', {
      'aria-label': 'Your prayer',
      placeholder: pick(mood.starter, ctx.band) || 'God, I want to talk to you about…',
    });
    prayerText.value = pick(mood.starter, ctx.band) || '';

    flow.replaceChildren(card({},
      eyebrow('Scripture'),
      scriptureBox,
      h('div', { style: 'margin-top:1.5rem' }, eyebrow('Reflection'),
        h('p', { text: pick(mood.reflection, ctx.band) })),
      h('div', { style: 'margin-top:1.5rem' }, eyebrow('Your prayer'), prayerText),
      h('div', { class: 'card-foot' },
        button('Save this prayer', { variant: 'btn-primary', onclick: () => {
          const state = getPrayers();
          state.items.unshift({
            id: `p${Date.now()}`,
            date: new Date().toISOString(),
            mood: mood.id,
            body: prayerText.value.trim(),
            verseRef: verseRef ? `${verseRef.book.id}.${verseRef.chapter}${verseRef.verseStart ? '.' + verseRef.verseStart : ''}` : null,
          });
          store.write(store.KEYS.prayers, state);
          toast('Saved. Only you can see this.');
          ctx.refresh();
        } }),
        button('Write more in my journal', { onclick: () => ctx.go('journal') }))));

    try {
      const passage = await getPassage(verseRef, trans);
      scriptureBox.replaceChildren(
        h('p', { class: 'scripture', text: joinText(passage.verses) }),
        h('div', { class: 'scripture-ref', text: `${formatRef(verseRef)} · ${trans}` }));
    } catch (error) {
      scriptureBox.replaceChildren(notice(error.message));
    }
  };

  for (const mood of moods) {
    moodGrid.appendChild(h('button', {
      class: 'mood', type: 'button', 'aria-pressed': 'false', dataset: { mood: mood.id },
      onclick: () => openMood(mood),
    }, h('span', { class: 'emoji', text: mood.emoji }), h('span', { class: 'name', text: mood.name })));
  }

  const saved = getPrayers().items;

  el.replaceChildren(
    section(null,
      h('p', { class: 'lede', style: 'margin-bottom:1rem', text: 'How are you feeling today?' }),
      moodGrid),
    flow,
    saved.length ? section('Your prayers', list(...saved.slice(0, 12).map((item) => row({
      title: item.body ? (item.body.length > 60 ? `${item.body.slice(0, 60)}…` : item.body) : '(no words)',
      sub: new Date(item.date).toLocaleDateString(undefined, { day: 'numeric', month: 'long' }) + (item.answeredAt ? ' · answered' : ''),
      chevron: false,
      onclick: () => {
        const state = getPrayers();
        const found = state.items.find((p) => p.id === item.id);
        if (!found) return;
        found.answeredAt = found.answeredAt ? null : new Date().toISOString();
        store.write(store.KEYS.prayers, state);
        toast(found.answeredAt ? 'Marked as answered.' : 'No longer marked as answered.');
        ctx.refresh();
      },
    })))) : null,
  );

  return { title: 'Pray', el, tab: 'me' };
}
