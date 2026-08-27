// The reader. The chapter, not the verse, is the unit of reading — but every
// verse is a tap away from the six actions in SPEC.md §6.

import { h, section, button, spinner, notice, sheet, scripture, toast } from '../core/ui.js';
import { bookById } from '../core/books.js';
import { stepChapter, chapterId, refId } from '../core/refs.js';
import { getChapter } from '../core/bible.js';
import { translationId, getSettings, saveSettings, readerScale } from '../core/profile.js';
import { recordReading } from '../core/progress.js';
import * as store from '../core/storage.js';
import * as memory from '../core/memory.js';

const COLOURS = [['amber', 'Amber'], ['green', 'Green'], ['blue', 'Blue'], ['rose', 'Rose']];

function highlightsFor(key) {
  const all = store.read(store.KEYS.highlights, { items: {} }) || { items: {} };
  return all.items[key] || {};
}

function setHighlight(key, verse, colour) {
  const all = store.read(store.KEYS.highlights, { items: {} }) || { items: {} };
  all.items[key] = all.items[key] || {};
  if (colour) all.items[key][verse] = colour;
  else delete all.items[key][verse];
  store.write(store.KEYS.highlights, all);
}

function speak(text) {
  if (typeof speechSynthesis === 'undefined') { toast('This device cannot read aloud.'); return; }
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.85;
  speechSynthesis.speak(utterance);
}

export default async function readerScreen(ctx) {
  const [bookId, chapterRaw] = ctx.route.args;
  const book = bookById(bookId);
  const chapter = Number(chapterRaw || 1);
  const trans = translationId(ctx.settings);

  if (!book) return { title: 'Bible', el: notice('That book is not in the Bible.'), tab: 'bible' };

  const el = h('div');
  const body = h('div', { class: 'reader', dataset: { readerTheme: getSettings().readerTheme || 'day' } }, spinner());
  el.appendChild(body);

  const nav = h('div', { class: 'btn-row', style: 'margin-top:2rem;justify-content:space-between' });
  const previous = stepChapter(book.id, chapter, -1);
  const next = stepChapter(book.id, chapter, 1);
  nav.appendChild(previous
    ? button(`‹ ${previous.book.name} ${previous.chapter}`, { onclick: () => ctx.go(`read/${previous.book.id}/${previous.chapter}`) })
    : h('span'));
  nav.appendChild(next
    ? button(`${next.book.name} ${next.chapter} ›`, { onclick: () => ctx.go(`read/${next.book.id}/${next.chapter}`) })
    : h('span'));
  el.appendChild(nav);

  const key = chapterId(book.id, chapter);

  const verseActions = (verse) => {
    const dialog = sheet(`${book.name} ${chapter}:${verse.n}`,
      h('p', { class: 'scripture small', style: 'margin-bottom:1rem', text: verse.text }),
      h('div', { class: 'btn-row' },
        button('Explain', { onclick: () => { dialog.close(); ctx.go(`ask?about=${encodeURIComponent(`${book.id}.${chapter}.${verse.n}`)}&q=${encodeURIComponent(`What does ${book.name} ${chapter}:${verse.n} mean?`)}`); } }),
        button('Listen', { onclick: () => { speak(verse.text); dialog.close(); } }),
        button('Remember', { onclick: () => {
          memory.addVerse(`${book.id}.${chapter}.${verse.n}`, trans);
          toast('Added to your memory verses.');
          dialog.close();
        } }),
        button('Ask', { onclick: () => { dialog.close(); ctx.go(`ask?about=${encodeURIComponent(`${book.id}.${chapter}.${verse.n}`)}`); } }),
        button('Pray', { onclick: () => { dialog.close(); ctx.go(`prayer?verse=${encodeURIComponent(`${book.id}.${chapter}.${verse.n}`)}`); } })),
      h('p', { class: 'eyebrow', style: 'margin-top:1.2rem', text: 'Highlight' }),
      h('div', { class: 'btn-row' },
        ...COLOURS.map(([id, label]) => button(label, { onclick: () => {
          setHighlight(key, verse.n, id);
          dialog.close();
          ctx.refresh();
        } })),
        button('None', { variant: 'btn-quiet', onclick: () => { setHighlight(key, verse.n, null); dialog.close(); ctx.refresh(); } })),
    );
  };

  try {
    const data = await getChapter(book.id, chapter, trans);
    const highlights = highlightsFor(key);
    body.replaceChildren(
      h('h2', { class: 'card-title', style: 'font-size:1.5rem;margin-bottom:1rem', text: `${book.name} ${chapter}` }),
      scripture(data.verses, { highlights, onVerse: verseActions }),
      h('p', { class: 'scripture-ref', text: `${trans}${data.offline ? ' · saved on this device' : ''}` }),
    );
    recordReading(key, data.verses.length ? data.verses[data.verses.length - 1].n : 0, data.verses.length);
  } catch (error) {
    body.replaceChildren(notice(error.message));
  }

  const action = {
    label: 'Aa',
    onclick: () => {
      const settings = getSettings();
      const dialog = sheet('Reading',
        h('p', { class: 'eyebrow', text: 'Size' }),
        h('div', { class: 'btn-row' }, ...[0.9, 1, 1.15, 1.35].map((scale) => button(`${Math.round(scale * 100)}%`, {
          variant: readerScale(settings, ctx.band) === scale ? 'btn-primary' : '',
          onclick: () => { saveSettings({ readerScale: scale }); document.documentElement.style.setProperty('--reader-scale', String(scale)); dialog.close(); },
        }))),
        h('p', { class: 'eyebrow', style: 'margin-top:1rem', text: 'Theme' }),
        h('div', { class: 'btn-row' }, ...[['day', 'Day'], ['sepia', 'Sepia'], ['night', 'Night']].map(([id, label]) => button(label, {
          variant: (settings.readerTheme || 'day') === id ? 'btn-primary' : '',
          onclick: () => { saveSettings({ readerTheme: id }); body.dataset.readerTheme = id; dialog.close(); },
        }))),
      );
    },
  };

  return { title: `${book.name} ${chapter}`, el, action, tab: 'bible' };
}
