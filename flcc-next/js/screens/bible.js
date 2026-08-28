// THE BIBLE — the whole thing, on the device, in three translations.
//
// Four ways in, because a young person arrives with four different questions:
//
//   "John 3:16"          a reference they were given → look it up
//   "shepherd"           a word they half-remember   → search for it
//   "I'm scared"         a feeling, not a reference  → the finder
//   "…where do I start?" no question at all          → the book list, with a
//                                                      line saying what each
//                                                      book actually is
//
// Nothing here can edit Scripture. The reader keeps a bookmark, a translation
// and any verses they choose to save, and all three stay on this device.

import { h, poster, label, display, headline, art, pill, go, note, waiting, rise, toast, reference } from '../core/ui.js';
import * as scripture from '../core/scripture.js';
import * as content from '../core/content.js';
import { forMode, isKids } from '../core/profile.js';

const TESTAMENTS = [
  { id: 'old', label: 'Old Testament', line: 'Creation to the last prophet — 39 books, before Jesus was born.' },
  { id: 'new', label: 'New Testament', line: 'Jesus, the first Christians, and the letters they wrote — 27 books.' },
];

/** The reader's translation, remembered between visits. */
function chosen(bible) {
  const state = scripture.getState();
  return bible.translations.some((one) => one.code === state.code) ? state.code : scripture.DEFAULT_CODE;
}

function translationRow(bible, code, onpick) {
  return h('div', { class: 'pill-row', style: 'margin-top:1rem' },
    ...bible.translations.map((one) => pill(one.language, () => {
      scripture.setState({ code: one.code });
      onpick(one.code);
    }, one.code === code ? {} : { quiet: true, 'aria-pressed': 'false' })));
}

// ── The reader ─────────────────────────────────────────────────────────────

async function reader(ctx, entry, chapter) {
  const bible = await scripture.manifest();
  const code = chosen(bible);
  const el = h('div', { style: 'display:contents' }, waiting());

  const at = Math.min(Math.max(1, chapter), entry.chapters);
  scripture.setState({ last: { n: entry.n, chapter: at } });

  let read;
  try {
    read = await scripture.passage(code, entry, at);
  } catch {
    return { title: entry.name, el: poster({ tone: 'paper', className: 'full' },
      label(entry.name),
      note('This book has not been downloaded yet, and the device is offline. Open it once with a connection and it will stay.')) };
  }

  const translation = bible.translations.find((one) => one.code === code);

  // A verse opens its own small action row rather than a menu: keep it, or
  // copy it. Only one verse is ever open at a time.
  //
  // `?v=` is how a reference elsewhere in the app arrives here: a lesson quotes
  // Luke 2:49 and the reader lands on Luke 2 with verse 49 already open and
  // scrolled to, rather than at the top of the chapter hunting for it.
  const landing = Number(ctx.route.params.v) || null;
  let open = landing;
  const lines = h('div', { class: 'passage' });

  const paint = () => {
    lines.replaceChildren(...read.verses.map((verse) => {
      const ref = scripture.refText(entry, at, verse.n);
      const isOpen = open === verse.n;
      const row = h('div', { class: 'passage-verse', dataset: isOpen ? { open: '' } : {} },
        h('button', { class: 'passage-line', type: 'button',
          'aria-expanded': String(isOpen),
          onclick: () => { open = isOpen ? null : verse.n; paint(); } },
          h('span', { class: 'passage-num', text: String(verse.n) }),
          h('span', { text: verse.text })));
      if (isOpen) {
        const kept = scripture.isSaved(ref, code);
        row.appendChild(h('div', { class: 'row-actions' },
          pill(kept ? 'Saved' : 'Keep this verse', () => {
            if (kept) { scripture.unsaveVerse(ref, code); toast('Removed.'); }
            else { scripture.saveVerse({ ref, text: verse.text, code }); toast('Kept. It is in the Bible tab under “Verses you kept”.'); }
            paint();
          }, { quiet: true }),
          pill('Copy', async () => {
            try { await navigator.clipboard.writeText(`“${verse.text}” — ${ref} (${translation.short})`); toast('Copied.'); }
            catch { toast('Hold the text to copy it.'); }
          }, { quiet: true })));
      }
      return row;
    }));
  };
  paint();

  const jump = (to) => ctx.go(`bible/${entry.n}/${to}`);

  const block = poster({ tone: 'paper', className: 'full' },
    h('div', { class: 'poster-head' },
      label(`${entry.name} ${at}`),
      label(`${translation.short} · ${at} of ${entry.chapters}`)),
    h('div', {}, lines),
    h('div', { class: 'poster-foot' },
      h('div', { class: 'pill-row' },
        at > 1 ? pill('‹ Before', () => jump(at - 1), { quiet: true }) : null,
        at < entry.chapters ? pill('Next ›', () => jump(at + 1), { quiet: true }) : null),
      go('All chapters', () => ctx.go(`bible/${entry.n}`))));

  const switcher = poster({ tone: 'ink', className: 'full' },
    label('Read it in'),
    translationRow(bible, code, () => ctx.refresh()),
    h('p', { class: 'row-note', style: 'margin-top:.9rem', text: `${translation.name} · ${translation.licence}. ${translation.note}` }));

  el.replaceChildren(block, switcher);

  // The shell scrolls to the top after a screen is appended, so the landing
  // verse has to be brought back into view after that has happened.
  if (landing) {
    requestAnimationFrame(() => {
      const row = lines.children[read.verses.findIndex((verse) => verse.n === landing)];
      if (row) row.scrollIntoView({ block: 'center' });
    });
  }

  return { title: `${entry.name} ${at}`, el };
}

// ── One book: what it is, and every chapter in it ──────────────────────────

async function bookScreen(ctx, entry) {
  let about = '';
  try {
    const lines = await content.bibleBooks();
    about = (lines.find((one) => Number(one.n) === entry.n) || {}).about || '';
  } catch { /* the guide is a nicety; the book still opens without it */ }

  const grid = h('div', { class: 'chapter-grid' },
    ...Array.from({ length: entry.chapters }, (_, i) => h('button', {
      class: 'chapter', type: 'button', text: String(i + 1),
      onclick: () => ctx.go(`bible/${entry.n}/${i + 1}`),
    })));

  const el = h('div', { style: 'display:contents' },
    poster({ tone: 'cream', tall: true, className: 'full' },
      label(entry.testament === 'old' ? 'Old Testament' : 'New Testament'),
      h('div', {},
        display(entry.name.toUpperCase()),
        about ? h('p', { class: 'lead', style: 'margin-top:1.2rem', text: about }) : null,
        entry.tagalog && entry.tagalog !== entry.name
          ? h('p', { class: 'ref', style: 'margin-top:.9rem', text: `Sa Tagalog: ${entry.tagalog}` }) : null),
      h('div', { class: 'poster-foot' },
        pill('Start at chapter 1', () => ctx.go(`bible/${entry.n}/1`)),
        art('book', { tone: 'cream', size: 'sm' }))),
    poster({ tone: 'paper', className: 'full' },
      label(`${entry.chapters} chapter${entry.chapters === 1 ? '' : 's'}`),
      h('div', { style: 'margin-top:1rem' }, grid)));

  return { title: entry.name, el };
}

// ── Search results ─────────────────────────────────────────────────────────

async function searchScreen(ctx, term) {
  const bible = await scripture.manifest();
  const code = chosen(bible);
  const el = h('div', { style: 'display:contents' });

  const status = h('p', { class: 'row-note', text: 'Looking…' });
  const list = h('div', { class: 'rows', style: 'margin-top:.6rem' });
  const controller = new AbortController();

  const block = poster({ tone: 'paper', className: 'full' },
    label(`Searching for “${term}”`), status, list);
  el.appendChild(block);

  const results = [];
  const draw = () => {
    list.replaceChildren(...results.map((hit) => {
      const ref = scripture.refText(hit.book, hit.chapter, hit.verse);
      return h('div', {},
        h('button', { class: 'passage-line', type: 'button',
          onclick: () => ctx.go(`bible/${hit.book.n}/${hit.chapter}`) },
          h('span', { text: hit.text })),
        h('p', { class: 'ref', style: 'margin-top:.4rem', text: `${ref} · ${code.toUpperCase()}` }));
    }));
  };

  // Results appear while the rest is still being read, so a search over 66
  // books never looks frozen. Leaving the screen stops it.
  scripture.search(term, {
    code,
    books: bible.books,
    signal: controller.signal,
    onFound: (hits) => { results.push(...hits); draw(); },
    onProgress: (done, total) => {
      if (done < total) status.textContent = `${results.length} so far · looked in ${done} of ${total} books`;
    },
  }).then((found) => {
    status.textContent = found.length
      ? `${found.length}${found.length >= 60 ? '+' : ''} verse${found.length === 1 ? '' : 's'} contain “${term}”.`
      : `No verse in this translation contains “${term}”. Try fewer words, or a different spelling.`;
  }).catch(() => { status.textContent = 'The search stopped early. Try again.'; });

  window.addEventListener('hashchange', () => controller.abort(), { once: true });

  return { title: 'Search', el };
}

// ── The way in ─────────────────────────────────────────────────────────────

export default async function bibleScreen(ctx) {
  const [where, second] = ctx.route.args;

  let bible;
  try { bible = await scripture.manifest(); }
  catch (error) {
    return { title: 'The Bible', el: poster({ tone: 'paper', className: 'full' },
      label('The Bible'), note(`The Bible did not load. ${error.message}`)) };
  }

  const byNumber = (n) => bible.books.find((one) => one.n === Number(n));

  if (where === 'search') return searchScreen(ctx, ctx.route.params.q || second || '');
  if (where === 'find' && second) return finderScreen(ctx, bible, second);
  if (where && byNumber(where)) {
    return second ? reader(ctx, byNumber(where), Number(second)) : bookScreen(ctx, byNumber(where));
  }

  const code = chosen(bible);
  const state = scripture.getState();

  // ── Look something up ──────────────────────────────────────────────────
  const input = h('input', { type: 'search', id: 'bible-look', autocomplete: 'off',
    placeholder: isKids() ? 'John 3:16 — or a word like “sheep”' : 'A reference, or any word' });
  const lookup = () => {
    const raw = input.value.trim();
    if (!raw) return;
    const ref = scripture.parseRef(raw, bible.books);
    if (ref) { ctx.go(`bible/${ref.book.n}/${ref.chapter}`); return; }
    ctx.go(`bible/search?q=${encodeURIComponent(raw)}`);
  };
  const form = h('form', { onsubmit: (event) => { event.preventDefault(); lookup(); } },
    input,
    h('div', { style: 'margin-top:1.1rem' }, pill('Look it up', null, { type: 'submit' })));

  const opening = poster({ tone: 'blue', tall: true, className: 'full' },
    label('The Bible'),
    h('div', {},
      display(isKids() ? 'LOOK IT UP.' : 'THE WHOLE THING.'),
      h('p', { class: 'body dim', style: 'margin-top:.9rem',
        text: isKids()
          ? 'All 66 books are already on your phone. Type where you want to go.'
          : '66 books, three translations, no signal needed once a book has been opened.' }),
      h('div', { style: 'margin-top:1.4rem' }, form)),
    h('div', { class: 'poster-foot' }, h('span'), art('book', { tone: 'blue', size: 'sm' })));

  // ── Carry on ───────────────────────────────────────────────────────────
  const last = state.last && byNumber(state.last.n);
  const carryOn = last ? poster({ tone: 'sage', as: 'button', className: 'full',
    onclick: () => ctx.go(`bible/${last.n}/${state.last.chapter}`) },
    label('Carry on'),
    h('div', {}, headline(`${last.name} ${state.last.chapter}`),
      h('p', { class: 'body dim', style: 'margin-top:.7rem', text: 'Where you stopped reading.' })),
    h('div', { class: 'poster-foot' }, go('Open', () => ctx.go(`bible/${last.n}/${state.last.chapter}`)),
      art('book', { tone: 'sage', size: 'sm' }))) : null;

  // ── Where do I look? ───────────────────────────────────────────────────
  let finders = [];
  try {
    const topics = await content.bibleFind();
    finders = topics.map((topic) => poster({ tone: topic.tone, as: 'button',
      onclick: () => ctx.go(`bible/find/${topic.id}`) },
      label('Where do I look?'),
      h('div', {}, headline(forMode(topic.title, ctx.mode)),
        h('p', { class: 'body dim', style: 'margin-top:.7rem', text: forMode(topic.need, ctx.mode) })),
      h('div', { class: 'poster-foot' },
        h('span', { class: 'label', text: `${topic.refs.length} places` }),
        art(topic.symbol, { tone: topic.tone, size: 'sm' }))));
  } catch { /* the finder is authored content; the Bible works without it */ }

  // ── Verses you kept ────────────────────────────────────────────────────
  const kept = state.saved.length ? poster({ tone: 'cream', className: 'full' },
    label(`Verses you kept · ${state.saved.length}`),
    h('div', { class: 'rows', style: 'margin-top:.6rem' },
      ...state.saved.slice(0, 8).map((one) => h('div', {},
        h('p', { class: 'verse', text: `“${one.text}”` }),
        h('div', { style: 'display:flex;align-items:baseline;gap:.5rem;margin-top:.4rem' },
          reference(one.ref, ctx.go),
          h('span', { class: 'ref dim', text: one.code.toUpperCase() }))))),
    state.saved.length > 8
      ? h('p', { class: 'row-note', style: 'margin-top:.8rem', text: `and ${state.saved.length - 8} more on this device.` })
      : null) : null;

  // ── The books ──────────────────────────────────────────────────────────
  const shelves = TESTAMENTS.map((testament) => {
    const books = bible.books.filter((one) => one.testament === testament.id);
    return poster({ tone: 'paper', className: 'full' },
      label(`${testament.label} · ${books.length} books`),
      h('p', { class: 'row-note', text: testament.line }),
      h('div', { class: 'book-list', style: 'margin-top:1rem' },
        ...books.map((one) => h('button', { class: 'book', type: 'button', onclick: () => ctx.go(`bible/${one.n}`) },
          h('span', { class: 'book-name', text: one.name }),
          h('span', { class: 'book-count', text: String(one.chapters) })))));
  });

  const about = poster({ tone: 'ink', className: 'full' },
    label('About these translations'),
    h('div', { class: 'rows', style: 'margin-top:.6rem' },
      ...bible.translations.map((one) => h('div', {},
        h('div', { class: 'row-top' },
          h('p', { class: 'row-title', text: `${one.language} — ${one.name}` }),
          h('span', { class: 'label', text: one.short })),
        h('p', { class: 'row-note', text: `${one.note} ${one.licence}.` })))),
    translationRow(bible, code, () => ctx.refresh()));

  const blocks = [opening, carryOn, ...finders, kept, ...shelves, about].filter(Boolean);
  const el = h('div', { style: 'display:contents' }, ...blocks);
  rise(blocks);
  return { title: 'The Bible', el };
}

// ── One feeling, and the places to read ────────────────────────────────────

async function finderScreen(ctx, bible, id) {
  const topics = await content.bibleFind();
  const topic = topics.find((one) => one.id === id);
  if (!topic) return { title: 'The Bible', el: poster({ tone: 'paper', className: 'full' }, note('That list has moved.')) };

  const code = chosen(bible);
  const el = h('div', { style: 'display:contents' },
    poster({ tone: topic.tone, tall: true, className: 'full' },
      label('Where do I look?'),
      h('div', {}, display(forMode(topic.title, ctx.mode)),
        h('p', { class: 'body dim', style: 'margin-top:1rem', text: forMode(topic.need, ctx.mode) })),
      h('div', { class: 'poster-foot' }, h('span'), art(topic.symbol, { tone: topic.tone, size: 'sm' }))));

  for (const raw of topic.refs) {
    const parsed = scripture.parseRef(raw, bible.books);
    const block = poster({ tone: 'paper', className: 'full' }, label(raw), waiting());
    el.appendChild(block);
    if (!parsed) { block.replaceChildren(label(raw), note('That reference could not be found.')); continue; }
    // Each passage is fetched on its own so one missing book cannot blank the
    // whole list, and the ones that load appear as they arrive.
    scripture.passage(code, parsed.book, parsed.chapter, parsed.verse, parsed.verseEnd)
      .then((read) => {
        block.replaceChildren(
          h('div', { class: 'poster-head' }, label(read.ref), label(code.toUpperCase())),
          h('div', {}, ...read.verses.map((verse) =>
            h('p', { class: 'verse', style: 'margin-top:.6rem', text: `${read.verses.length > 1 ? `${verse.n}. ` : ''}${verse.text}` }))),
          h('div', { class: 'poster-foot' },
            go('Read the whole chapter', () => ctx.go(`bible/${parsed.book.n}/${parsed.chapter}`)),
            h('span')));
      })
      .catch(() => block.replaceChildren(label(raw), note('This one needs a connection the first time.')));
  }

  return { title: forMode(topic.title, ctx.mode), el };
}
