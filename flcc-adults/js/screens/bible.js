// THE BIBLE — the whole thing, on the device, in three translations.
//
// The calmest screen in the app on purpose, and the one place the chrome
// stops. The reader is white paper and serif type: no block, no rule, no gold,
// nothing to compete with the text. Every other screen is quiet so that
// Scripture can be the loudest thing in the app.
//
// Nothing here can edit Scripture. The reader keeps a bookmark, a translation,
// a reading plan and any verses they choose to save, and all of it stays on
// this device.

import { h, block, card, reader as paper, section, badge, display, title, body, small, scripture,
         nextLine, reference, act, actions, go, rows, row, thread,
         rise, note, waiting, toast, swap } from '../core/ui.js';
import * as scriptureCore from '../core/scripture.js';
import * as content from '../core/content.js';
import * as plan from '../core/plan.js';

const TESTAMENTS = [
  { id: 'old', label: 'Old Testament', line: 'Creation to the last prophet — 39 books, before Jesus was born.' },
  { id: 'new', label: 'New Testament', line: 'Jesus, the first Christians, and the letters they wrote — 27 books.' },
];

/** The reader's translation, remembered between visits. */
function chosen(bible) {
  const state = scriptureCore.getState();
  return bible.translations.some((one) => one.code === state.code) ? state.code : scriptureCore.DEFAULT_CODE;
}

function translationRow(bible, code, onpick) {
  return actions(...bible.translations.map((one) => act(one.language, () => {
    scriptureCore.setState({ code: one.code });
    onpick(one.code);
  }, one.code === code ? { small: true } : { small: true, quiet: true })));
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
    return { title: entry.name, el: card({ tone: 'paper', className: 'full', symbol: 'cloud' },
      badge(entry.name),
      note('This book is not on the device yet, and there is no connection. Open it once online and it stays.', 'warn')) };
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
        holder.appendChild(actions(
          act(kept ? 'Saved' : 'Keep this verse', () => {
            if (kept) { scriptureCore.unsaveVerse(ref, code); toast('Removed.'); }
            else { scriptureCore.saveVerse({ ref, text: verse.text, code }); toast('Kept — it is under “Verses you kept”.'); }
            paint();
          }, { quiet: true, small: true }),
          act('Copy', async () => {
            try { await navigator.clipboard.writeText(`“${verse.text}” — ${ref} (${translation.short})`); toast('Copied.'); }
            catch { toast('Hold the text to copy it.'); }
          }, { quiet: true, small: true })));
      }
      return holder;
    }));
  };
  paint();

  const jump = (to) => ctx.go(`bible/${entry.n}/${to}`);

  const el = h('div', { style: 'display:contents' },
    paper({ className: 'full' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:1rem' },
        badge(`${entry.name} ${at}`),
        h('span', { class: 'row-meta', text: `${translation.short} · ${at} of ${entry.chapters}` })),
      lines,
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:1rem;margin-top:1rem' },
        actions(
          at > 1 ? act('‹ Before', () => jump(at - 1), { quiet: true, small: true }) : null,
          at < entry.chapters ? act('Next ›', () => jump(at + 1), { quiet: true, small: true }) : null),
        go('All chapters', () => ctx.go(`bible/${entry.n}`)))),
    card({ tone: 'paper', className: 'full', foot: translation.short },
      badge('Read it in'),
      translationRow(bible, code, () => ctx.refresh()),
      small(`${translation.name} · ${translation.licence}. ${translation.note}`)));

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
    card({ tone: 'paper', className: 'full', symbol: 'book',
        foot: `${entry.chapters} chapter${entry.chapters === 1 ? '' : 's'}` },
      badge(entry.testament === 'old' ? 'Old Testament' : 'New Testament'),
      h('div', {},
        display(entry.name),
        entry.tagalog && entry.tagalog !== entry.name
          ? h('p', { class: 'cite', style: 'margin-top:.8rem', text: `Sa Tagalog: ${entry.tagalog}` }) : null),
      h('div', {}, act('Start at chapter 1', () => ctx.go(`bible/${entry.n}/1`)))),
    paper({ className: 'full' },
      badge('Every chapter'),
      h('div', { style: 'margin-top:.9rem' }, grid)));

  return { title: entry.name, el };
}

// ── Search ─────────────────────────────────────────────────────────────────

async function searchScreen(ctx, term) {
  const bible = await scriptureCore.manifest();
  const code = chosen(bible);

  const status = h('p', { class: 'small', text: 'Looking…' });
  const list = rows({ tight: true });
  const controller = new AbortController();
  const el = h('div', { style: 'display:contents' },
    paper({ className: 'full' }, badge(`Searching for “${term}”`), status, list));

  const found = [];
  const draw = () => {
    swap(list, ...found.map((hit) => {
      const ref = scriptureCore.refText(hit.book, hit.chapter, hit.verse);
      return h('div', { style: 'padding:.5rem 0' },
        h('button', { class: 'passage-line', type: 'button', style: 'font-size:1rem',
          onclick: () => ctx.go(`bible/${hit.book.n}/${hit.chapter}?v=${hit.verse}`) },
          h('span', { text: hit.text })),
        h('p', { class: 'cite', style: 'margin-top:.35rem', text: `${ref} · ${code.toUpperCase()}` }));
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
    return { title: 'Bible', el: card({ tone: 'paper', className: 'full' },
      badge('The Bible'), note(`The Bible did not load. ${error.message}`, 'warn')) };
  }

  const byNumber = (n) => bible.books.find((one) => one.n === Number(n));
  if (where === 'search') return searchScreen(ctx, ctx.route.params.q || second || '');
  if (where && byNumber(where)) {
    return second ? reader(ctx, byNumber(where), Number(second)) : bookScreen(ctx, byNumber(where));
  }

  const code = chosen(bible);
  const state = scriptureCore.getState();
  const cards = [];

  // ── Look something up ───────────────────────────────────────────────────
  const input = h('input', { type: 'search', id: 'bible-look', autocomplete: 'off',
    placeholder: 'A reference, or any word' });
  const form = h('form', { onsubmit: (event) => {
    event.preventDefault();
    const raw = input.value.trim();
    if (!raw) return;
    const ref = scriptureCore.parseRef(raw, bible.books);
    if (ref) { ctx.go(`bible/${ref.book.n}/${ref.chapter}${ref.verse ? `?v=${ref.verse}` : ''}`); return; }
    ctx.go(`bible/search?q=${encodeURIComponent(raw)}`);
  } }, input, h('div', { style: 'margin-top:1.2rem' }, act('Look it up', null, { type: 'submit' })));

  cards.push(block({ className: 'full' },
    badge('The Bible'),
    display('The whole thing.'),
    h('p', { class: 'lead', text: 'Already on this device. No signal needed once a book has been opened.' }),
    form,
    h('p', { class: 'cite', text: '66 books · 3 translations' })));

  // ── Carry on ────────────────────────────────────────────────────────────
  const last = state.last && byNumber(state.last.n);
  if (last) {
    cards.push(section({ className: 'full' },
      nextLine('Where you stopped'),
      rows({}, row({
        title: `${last.name} ${state.last.chapter}`,
        note: 'Carry on from here',
        accent: 'gold', chev: true,
        onclick: () => ctx.go(`bible/${last.n}/${state.last.chapter}`),
      }))));
  }

  // ── Reading plans ───────────────────────────────────────────────────────
  const plansSection = section({ className: 'full' }, waiting());
  cards.push(plansSection);
  (async () => {
    try {
      const plans = await content.plans();
      const active = plan.state().id;
      swap(plansSection,
        nextLine(active ? 'Reading plans · one on the go' : `Reading plans · ${plans.length} to choose`),
        rows({}, ...plans.map((one) => {
          const at = plan.positionIn(one);
          return row({
            title: one.title,
            note: one.id === active ? `Reading now · ${at.at ? at.at.ref : 'finished'}` : one.kicker,
            meta: one.id === active ? `${at.day}/${at.total}` : `${one.days.length} days`,
            accent: one.tone,
            onclick: () => ctx.go(`plan/${one.id}`),
          });
        })));
    } catch { plansSection.remove(); }
  })();

  // ── Verses you kept ─────────────────────────────────────────────────────
  if (state.saved.length) {
    cards.push(paper({ className: 'full' },
      nextLine(`Verses you kept · ${state.saved.length}`),
      ...state.saved.slice(0, 6).map((one) => h('div', { style: 'padding:.7rem 0' },
        scripture(one.text, { flow: true }),
        h('div', { style: 'margin-top:.4rem' }, reference(`${one.ref} · ${one.code.toUpperCase()}`, ctx.go)))),
      state.saved.length > 6 ? small(`and ${state.saved.length - 6} more on this device.`) : null));
  }

  // ── The shelves ─────────────────────────────────────────────────────────
  for (const testament of TESTAMENTS) {
    const books = bible.books.filter((one) => one.testament === testament.id);
    cards.push(paper({ className: 'full' },
      h('div', { style: 'display:flex;justify-content:space-between;align-items:center;gap:1rem' },
        badge(testament.label),
        h('span', { class: 'row-meta', text: `${books.length} books` })),
      h('div', { style: 'margin-top:.7rem' }, small(testament.line)),
      h('div', { class: 'book-list' },
        ...books.map((one) => h('button', { class: 'book', type: 'button', onclick: () => ctx.go(`bible/${one.n}`) },
          h('span', { class: 'book-name', text: one.name }),
          h('span', { class: 'book-count', text: String(one.chapters) }))))));
  }

  // ── Translations ────────────────────────────────────────────────────────
  cards.push(card({ tone: 'paper', className: 'full', foot: 'All three are public domain' },
    nextLine('Translations'),
    rows({ tight: true },
      ...bible.translations.map((one) => row({
        title: `${one.language} — ${one.name}`,
        note: `${one.note} ${one.licence}.`,
        meta: one.short,
      }))),
    translationRow(bible, code, () => ctx.refresh())));

  const el = h('div', { style: 'display:contents' }, ...cards);
  rise(cards);
  return { title: 'Bible', el };
}
