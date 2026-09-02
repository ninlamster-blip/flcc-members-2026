// THE BIBLE — the whole thing, on the device, in three translations.
//
// The calmest screen in the app, and the one place the colour stops. The
// reader is a paper poster: the text at reading size, the verse number small
// and out of the way, and nothing else on the block at all. Every other screen
// is a slab of colour so that this one does not have to be.
//
// Nothing here can edit Scripture. The reader keeps a bookmark, a translation,
// a reading plan and any verses they choose to save, and all of it stays on
// this device.

import { h, poster, label, display, headline, art, go, pill, track,
         rows, row, scripture, reference, waiting, note, rise, toast, swap } from '../core/ui.js';
import * as scriptureCore from '../core/scripture.js';
import * as content from '../core/content.js';
import * as plan from '../core/plan.js';

const TESTAMENTS = [
  { id: 'old', label: 'Old Testament', line: 'Creation to the last prophet — 39 books, before Jesus was born.' },
  { id: 'new', label: 'New Testament', line: 'Jesus, the first Christians, and the letters they wrote — 27 books.' },
];

const toneOf = (name) => (name === 'poppy' ? 'rose' : (name === 'navy' ? 'ink' : (name || 'paper')));

/** The reader's translation, remembered between visits. */
function chosen(bible) {
  const state = scriptureCore.getState();
  return bible.translations.some((one) => one.code === state.code) ? state.code : scriptureCore.DEFAULT_CODE;
}

function translationRow(bible, code, onpick) {
  return h('div', { class: 'pill-row' }, ...bible.translations.map((one) => pill(one.language, () => {
    scriptureCore.setState({ code: one.code });
    onpick(one.code);
  }, one.code === code ? {} : { quiet: true })));
}

// ── The reader ─────────────────────────────────────────────────────────────

async function reader(ctx, entry, chapter) {
  const bible = await scriptureCore.manifest();
  const code = chosen(bible);
  const at = Math.min(Math.max(1, chapter), entry.chapters);
  scriptureCore.setState({ last: { n: entry.n, chapter: at } });

  let read;
  try {
    read = await scriptureCore.passage(code, entry, at);
  } catch {
    return { title: entry.name, el: poster({ tone: 'rose' },
      label(entry.name),
      note('This book is not on the device yet, and there is no connection. Open it once online and it stays.')) };
  }

  const translation = bible.translations.find((one) => one.code === code);
  const landing = Number(ctx.route.params.v) || null;
  let open = landing;
  const lines = h('div', { class: 'passage' });

  const paint = () => {
    swap(lines, ...read.verses.map((verse) => {
      const ref = scriptureCore.refText(entry, at, verse.n);
      const isOpen = open === verse.n;
      const holder = h('div', { class: 'passage-verse', dataset: isOpen ? { open: '' } : {} },
        h('button', { class: 'passage-line', type: 'button', 'aria-expanded': String(isOpen),
          onclick: () => { open = isOpen ? null : verse.n; paint(); } },
          h('span', { class: 'passage-num', text: String(verse.n) }),
          h('span', { text: verse.text })));
      if (isOpen) {
        const kept = scriptureCore.isSaved(ref, code);
        holder.appendChild(h('div', { class: 'row-actions' },
          pill(kept ? 'Saved' : 'Keep this verse', () => {
            if (kept) { scriptureCore.unsaveVerse(ref, code); toast('Removed.'); }
            else { scriptureCore.saveVerse({ ref, text: verse.text, code }); toast('Kept — it is under “Verses you kept”.'); }
            paint();
          }, { quiet: true }),
          pill('Copy', async () => {
            try { await navigator.clipboard.writeText(`“${verse.text}” — ${ref} (${translation.short})`); toast('Copied.'); }
            catch { toast('Hold the text to copy it.'); }
          }, { quiet: true })));
      }
      return holder;
    }));
  };
  paint();

  const jump = (to) => ctx.go(`bible/${entry.n}/${to}`);

  const el = h('div', { style: 'display:contents' },
    poster({ tone: 'paper' },
      h('div', { class: 'poster-head' },
        label(`${entry.name} ${at}`),
        h('span', { class: 'row-meta', text: `${translation.short} · ${at} of ${entry.chapters}` })),
      lines,
      h('div', { class: 'poster-foot' },
        h('div', { class: 'pill-row' },
          at > 1 ? pill('‹ Before', () => jump(at - 1), { quiet: true }) : null,
          at < entry.chapters ? pill('Next ›', () => jump(at + 1), { quiet: true }) : null),
        go('All chapters', () => ctx.go(`bible/${entry.n}`)))),
    poster({ tone: 'paper' },
      label('Read it in'),
      translationRow(bible, code, () => ctx.refresh()),
      note(`${translation.name} · ${translation.licence}. ${translation.note}`)));

  // The shell scrolls to the top after a screen is appended, so a landing
  // verse has to be brought back into view after that has happened.
  if (landing) {
    requestAnimationFrame(() => {
      const holder = lines.children[read.verses.findIndex((verse) => verse.n === landing)];
      if (holder) holder.scrollIntoView({ block: 'center' });
    });
  }

  return { title: `${entry.name} ${at}`, el };
}

// ── One book ───────────────────────────────────────────────────────────────

async function bookScreen(ctx, entry) {
  const grid = h('div', { class: 'chapter-grid' },
    ...Array.from({ length: entry.chapters }, (_, i) => h('button', {
      class: 'chapter', type: 'button', text: String(i + 1),
      onclick: () => ctx.go(`bible/${entry.n}/${i + 1}`),
    })));

  const el = h('div', { style: 'display:contents' },
    poster({ tone: 'sky', tall: true },
      label(entry.testament === 'old' ? 'Old Testament' : 'New Testament'),
      h('div', {},
        display(String(entry.name).toUpperCase()),
        entry.tagalog && entry.tagalog !== entry.name
          ? h('p', { class: 'lead dim', style: 'margin-top:.8rem', text: `Sa Tagalog: ${entry.tagalog}` }) : null),
      h('div', { class: 'poster-foot' },
        pill('Start at chapter 1', () => ctx.go(`bible/${entry.n}/1`)),
        art('book', { tone: 'sky', size: 'sm' }))),
    poster({ tone: 'paper' },
      label(`Every chapter · ${entry.chapters}`),
      grid));

  return { title: entry.name, el };
}

// ── Search ─────────────────────────────────────────────────────────────────

async function searchScreen(ctx, term) {
  const bible = await scriptureCore.manifest();
  const code = chosen(bible);

  const status = h('p', { class: 'note', text: 'Looking…' });
  const list = h('div', { class: 'rows' });
  const controller = new AbortController();
  const el = h('div', { style: 'display:contents' },
    poster({ tone: 'paper' }, label(`Searching for “${term}”`), status, list));

  const found = [];
  const draw = () => {
    swap(list, ...found.map((hit) => {
      const ref = scriptureCore.refText(hit.book, hit.chapter, hit.verse);
      return h('button', { class: 'row', type: 'button',
        onclick: () => ctx.go(`bible/${hit.book.n}/${hit.chapter}?v=${hit.verse}`) },
        h('p', { class: 'row-title', style: 'font-weight:400', text: hit.text }),
        h('p', { class: 'row-note', text: `${ref} · ${code.toUpperCase()}` }));
    }));
  };

  scriptureCore.search(term, {
    code, books: bible.books, signal: controller.signal,
    onFound: (hits) => { found.push(...hits); draw(); },
    onProgress: (done, total) => {
      if (done < total) status.textContent = `${found.length} so far · looked in ${done} of ${total} books`;
    },
  }).then((all) => {
    status.textContent = all.length
      ? `${all.length}${all.length >= 60 ? '+' : ''} verse${all.length === 1 ? '' : 's'} contain “${term}”.`
      : `No verse in this translation contains “${term}”. Try fewer words, or a different spelling.`;
  }).catch(() => { status.textContent = 'The search stopped early. Try again.'; });

  window.addEventListener('hashchange', () => controller.abort(), { once: true });
  return { title: 'Search', el };
}

// ── The way in ─────────────────────────────────────────────────────────────

export default async function bibleScreen(ctx) {
  const [where, second] = ctx.route.args;

  let bible;
  try { bible = await scriptureCore.manifest(); }
  catch (error) {
    return { title: 'Bible', el: poster({ tone: 'rose' },
      label('The Bible'), note(`The Bible did not load. ${error.message}`)) };
  }

  const byNumber = (n) => bible.books.find((one) => one.n === Number(n));
  if (where === 'search') return searchScreen(ctx, ctx.route.params.q || second || '');
  if (where && byNumber(where)) {
    return second ? reader(ctx, byNumber(where), Number(second)) : bookScreen(ctx, byNumber(where));
  }

  const code = chosen(bible);
  const state = scriptureCore.getState();
  const parts = [];

  // ── Look something up ───────────────────────────────────────────────────
  const input = h('input', { type: 'search', id: 'bible-look', autocomplete: 'off',
    placeholder: 'A reference, or any word' });
  const look = () => {
    const raw = input.value.trim();
    if (!raw) return;
    const ref = scriptureCore.parseRef(raw, bible.books);
    if (ref) { ctx.go(`bible/${ref.book.n}/${ref.chapter}${ref.verse ? `?v=${ref.verse}` : ''}`); return; }
    ctx.go(`bible/search?q=${encodeURIComponent(raw)}`);
  };
  input.addEventListener('keydown', (event) => { if (event.key === 'Enter') { event.preventDefault(); look(); } });

  parts.push(poster({ tone: 'captain', tall: true },
    label('66 books · 3 translations'),
    h('div', {},
      display('THE WHOLE THING.'),
      h('p', { class: 'lead dim', style: 'margin-top:1rem',
        text: 'Already on this device. No signal needed once a book has been opened.' }),
      h('div', { style: 'margin-top:1.4rem' }, input)),
    h('div', { class: 'poster-foot' },
      pill('Look it up', look),
      art('book', { tone: 'captain', size: 'sm' }))));

  // ── Carry on ────────────────────────────────────────────────────────────
  const last = state.last && byNumber(state.last.n);
  if (last) {
    parts.push(poster({ tone: 'sunshine', as: 'button', onclick: () => ctx.go(`bible/${last.n}/${state.last.chapter}`) },
      label('Where you stopped'),
      headline(`${String(last.name).toUpperCase()} ${state.last.chapter}`),
      h('div', { class: 'poster-foot' }, h('span', { class: 'go' }, 'Carry on'), h('span'))));
  }

  // ── Reading plans ───────────────────────────────────────────────────────
  const plansBlock = h('div', { style: 'display:contents' });
  parts.push(plansBlock);
  (async () => {
    try {
      const plans = await content.plans();
      const active = plan.state().id;
      swap(plansBlock, poster({ tone: 'paper' },
        label(active ? 'Reading plans · one on the go' : `Reading plans · ${plans.length} to choose`),
        rows(...plans.map((one) => {
          const at = plan.positionIn(one);
          return row({
            title: one.title,
            note: one.id === active ? `Reading now · ${at.at ? at.at.ref : 'finished'}` : one.kicker,
            meta: one.id === active ? `${at.day}/${at.total}` : `${one.days.length} days`,
            onclick: () => ctx.go(`plan/${one.id}`),
          });
        }))));
    } catch { plansBlock.remove(); }
  })();

  // ── Verses you kept ─────────────────────────────────────────────────────
  if (state.saved.length) {
    parts.push(poster({ tone: 'rose' },
      label(`Verses you kept · ${state.saved.length}`),
      h('div', {}, ...state.saved.slice(0, 6).map((one) => h('div', { style: 'padding:.7rem 0' },
        scripture(one.text, { flow: true }),
        reference(`${one.ref} · ${one.code.toUpperCase()}`, ctx.go, { style: 'margin-top:.5rem' })))),
      state.saved.length > 6 ? note(`and ${state.saved.length - 6} more on this device.`) : null));
  }

  // ── The shelves ─────────────────────────────────────────────────────────
  for (const testament of TESTAMENTS) {
    const books = bible.books.filter((one) => one.testament === testament.id);
    parts.push(poster({ tone: 'paper' },
      h('div', { class: 'poster-head' },
        label(testament.label),
        h('span', { class: 'row-meta', text: `${books.length} books` })),
      note(testament.line),
      h('div', { class: 'book-list' },
        ...books.map((one) => h('button', { class: 'book', type: 'button', onclick: () => ctx.go(`bible/${one.n}`) },
          h('span', { class: 'book-name', text: one.name }),
          h('span', { class: 'book-count', text: String(one.chapters) }))))));
  }

  // ── Translations ────────────────────────────────────────────────────────
  parts.push(poster({ tone: 'paper' },
    label('Translations · all three are public domain'),
    rows(...bible.translations.map((one) => row({
      title: `${one.language} — ${one.name}`,
      note: `${one.note} ${one.licence}.`,
      meta: one.short,
    }))),
    translationRow(bible, code, () => ctx.refresh())));

  const el = h('div', { style: 'display:contents' }, ...parts);
  rise(parts);
  return { title: 'Bible', el };
}
