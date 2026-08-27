// THE READER
//
// The best-designed screen in the app, and the quietest. Scripture set as
// prose — not as a list of rows — with generous leading, wide margins and
// almost no interface. The controls sit low and small; everything else is a
// tap on the words themselves.

import { h, spinner, notice, sheet, toast, go } from '../core/ui.js';
import { bookById } from '../core/books.js';
import { stepChapter, chapterId } from '../core/refs.js';
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
  if (speechSynthesis.speaking) { speechSynthesis.cancel(); return; }
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.rate = 0.86;
  speechSynthesis.speak(utterance);
}

export default async function readerScreen(ctx) {
  const [bookId, chapterRaw] = ctx.route.args;
  const book = bookById(bookId);
  const chapter = Number(chapterRaw || 1);
  const trans = translationId(ctx.settings);

  if (!book) return { title: 'Read', el: notice('That book is not in the Bible.'), tab: 'bible' };

  const el = h('div');
  const settings = getSettings();
  const body = h('div', { class: 'reader', dataset: { readerTheme: settings.readerTheme || 'day' } }, spinner());

  el.appendChild(h('header', { class: 'reader-head' },
    h('h1', { class: 'reader-book', text: book.name }),
    h('p', { class: 'reader-chapter', text: `Chapter ${chapter}` })));
  el.appendChild(body);

  const previous = stepChapter(book.id, chapter, -1);
  const next = stepChapter(book.id, chapter, 1);
  // The previous chapter points backwards, which "go" cannot do.
  const back = (label, onclick) => h('button', { class: 'go go-plain go-back', type: 'button', onclick }, label);
  el.appendChild(h('nav', { class: 'chapter-nav' },
    previous ? back(`${previous.book.name} ${previous.chapter}`, () => ctx.go(`read/${previous.book.id}/${previous.chapter}`)) : h('span'),
    next ? go(`${next.book.name} ${next.chapter}`, () => ctx.go(`read/${next.book.id}/${next.chapter}`), { plain: true }) : h('span')));

  const key = chapterId(book.id, chapter);
  let chapterText = '';

  const verseActions = (verse) => {
    const dialog = sheet(`${book.name} ${chapter}:${verse.n}`,
      h('p', { class: 'scripture', style: 'font-size:1rem;margin-bottom:1.25rem', text: verse.text }),
      h('div', { class: 'btn-row' },
        h('button', { class: 'btn', type: 'button', onclick: () => { dialog.close(); ctx.go(`ask?about=${encodeURIComponent(`${book.id}.${chapter}.${verse.n}`)}&q=${encodeURIComponent(`What does ${book.name} ${chapter}:${verse.n} mean?`)}`); } }, 'What does this mean?'),
        h('button', { class: 'btn', type: 'button', onclick: () => { speak(verse.text); dialog.close(); } }, 'Listen'),
        h('button', { class: 'btn', type: 'button', onclick: () => { memory.addVerse(`${book.id}.${chapter}.${verse.n}`, trans); toast('Saved to your memory verses.'); dialog.close(); } }, 'Remember'),
        h('button', { class: 'btn', type: 'button', onclick: () => { dialog.close(); ctx.go(`prayer?verse=${encodeURIComponent(`${book.id}.${chapter}.${verse.n}`)}`); } }, 'Pray')),
      h('p', { class: 'eyebrow', style: 'margin:1.5rem 0 .7rem', text: 'Mark' }),
      h('div', { class: 'btn-row' },
        ...COLOURS.map(([id, label]) => h('button', { class: 'btn', type: 'button', onclick: () => { setHighlight(key, verse.n, id); dialog.close(); ctx.refresh(); } }, label)),
        h('button', { class: 'btn btn-quiet', type: 'button', onclick: () => { setHighlight(key, verse.n, null); dialog.close(); ctx.refresh(); } }, 'None')));
  };

  try {
    const data = await getChapter(book.id, chapter, trans);
    const highlights = highlightsFor(key);
    chapterText = data.verses.map((v) => v.text).join(' ');

    // Prose, not rows: each verse is inline text you can tap.
    const prose = h('p', { style: 'margin:0' });
    for (const verse of data.verses) {
      const span = h('button', {
        class: 'verse', type: 'button',
        dataset: highlights[verse.n] ? { verse: String(verse.n), hl: highlights[verse.n] } : { verse: String(verse.n) },
        onclick: () => verseActions(verse),
      }, h('span', { class: 'verse-num', text: String(verse.n) }), verse.text);
      prose.append(span, ' ');
    }
    body.replaceChildren(prose,
      h('p', { class: 'ref', style: 'margin-top:2rem', text: `${trans}${data.offline ? ' · saved on this device' : ''}` }));

    recordReading(key, data.verses.length ? data.verses[data.verses.length - 1].n : 0, data.verses.length);
  } catch (error) {
    body.replaceChildren(notice(error.message));
  }

  // ── The controls, low and quiet ───────────────────────────────────────────
  const toolbar = h('div', { class: 'toolbar', role: 'toolbar', 'aria-label': 'Reading' },
    h('button', { type: 'button', title: 'Text size and theme', 'aria-label': 'Text size and theme', onclick: () => {
      const current = getSettings();
      const dialog = sheet('Reading',
        h('p', { class: 'eyebrow', text: 'Size' }),
        h('div', { class: 'btn-row' }, ...[0.9, 1, 1.15, 1.35].map((scale) => h('button', {
          class: `btn ${readerScale(current, ctx.band) === scale ? 'btn-primary' : ''}`.trim(), type: 'button',
          onclick: () => { saveSettings({ readerScale: scale }); document.documentElement.style.setProperty('--reader-scale', String(scale)); dialog.close(); },
        }, `${Math.round(scale * 100)}%`))),
        h('p', { class: 'eyebrow', style: 'margin:1.5rem 0 .7rem', text: 'Paper' }),
        h('div', { class: 'btn-row' }, ...[['day', 'Day'], ['sepia', 'Sepia'], ['night', 'Night']].map(([id, label]) => h('button', {
          class: `btn ${(current.readerTheme || 'day') === id ? 'btn-primary' : ''}`.trim(), type: 'button',
          onclick: () => { saveSettings({ readerTheme: id }); body.dataset.readerTheme = id; dialog.close(); },
        }, label))));
    } }, 'Aa'),
    h('button', { type: 'button', title: 'Listen', 'aria-label': 'Listen to this chapter', onclick: () => speak(chapterText) }, '♪'),
    h('button', { type: 'button', title: 'Understand this passage', 'aria-label': 'Understand this passage',
      onclick: () => ctx.go(`ask?about=${encodeURIComponent(`${book.id}.${chapter}`)}`) }, '?'),
    h('button', { type: 'button', title: 'Notes', 'aria-label': 'Your notes', onclick: () => ctx.go('reflect') }, '✎'),
  );
  el.appendChild(toolbar);
  // Room for the toolbar, so the last verses are never read through it.
  el.appendChild(h('div', { style: 'height:4rem', 'aria-hidden': 'true' }));

  return { title: `${book.name} ${chapter}`, el, tab: 'bible' };
}
