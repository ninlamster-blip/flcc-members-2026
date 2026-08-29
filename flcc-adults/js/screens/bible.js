// THE BIBLE — the whole thing, on the device, in three translations.
//
// The calmest screen in the app on purpose. Cream, a muted blue for anything
// selected, forest for navigation, and no other colour at all: nothing should
// compete with the text.
//
// Nothing here can edit Scripture. The reader keeps a bookmark, a translation,
// a reading plan and any verses they choose to save, and all of it stays on
// this device.

import { h, block, section, label, display, title, lead, body, small, scripture, cite,
         reference, act, actions, go, rows, row, thread, rule, rise, note, waiting, toast, swap} from '../core/ui.js';
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
    return { title: entry.name, el: section({ className: 'full' },
      label(entry.name),
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
    section({ className: 'full' },
      h('div', { class: 'section-head' },
        label(`${entry.name} ${at}`),
        h('span', { class: 'row-meta', text: `${translation.short} · ${at} of ${entry.chapters}` })),
      lines,
      rule(),
      h('div', { class: 'section-head' },
        actions(
          at > 1 ? act('‹ Before', () => jump(at - 1), { quiet: true, small: true }) : null,
          at < entry.chapters ? act('Next ›', () => jump(at + 1), { quiet: true, small: true }) : null),
        go('All chapters', () => ctx.go(`bible/${entry.n}`)))),
    section({ className: 'full' },
      label('Read it in'),
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
    block({ tone: 'paper', className: 'full', shape: { seed: entry.name, tones: ['mist', 'sage'] }, corner: 'tr', soft: true },
      label(entry.testament === 'old' ? 'Old Testament' : 'New Testament'),
      h('div', {},
        display(entry.name),
        entry.tagalog && entry.tagalog !== entry.name
          ? h('p', { class: 'cite', style: 'margin-top:.9rem', text: `Sa Tagalog: ${entry.tagalog}` }) : null),
      h('div', {}, act('Start at chapter 1', () => ctx.go(`bible/${entry.n}/1`)))),
    section({ className: 'full' },
      label(`${entry.chapters} chapter${entry.chapters === 1 ? '' : 's'}`),
      grid));

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
    section({ className: 'full' }, label(`Searching for “${term}”`), status, list));

  const found = [];
  const draw = () => {
    swap(list, ...found.map((hit) => {
      const ref = scriptureCore.refText(hit.book, hit.chapter, hit.verse);
      return h('div', {},
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
    return { title: 'Bible', el: section({ className: 'full' },
      label('The Bible'), note(`The Bible did not load. ${error.message}`, 'warn')) };
  }

  const byNumber = (n) => bible.books.find((one) => one.n === Number(n));
  if (where === 'search') return searchScreen(ctx, ctx.route.params.q || second || '');
  if (where && byNumber(where)) {
    return second ? reader(ctx, byNumber(where), Number(second)) : bookScreen(ctx, byNumber(where));
  }

  const code = chosen(bible);
  const state = scriptureCore.getState();
  const blocks = [];

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

  blocks.push(block({ tone: 'paper', className: 'full',
      shape: { seed: 'the-bible', tones: ['mist', 'forest'] }, corner: 'br', soft: true },
    label('The Bible'),
    h('div', {},
      display('The whole thing.'),
      h('p', { class: 'lead', style: 'margin-top:.8rem;max-width:28ch',
        text: '66 books in three translations, already on this device. No signal needed once a book has been opened.' }),
      h('div', { style: 'margin-top:1.5rem' }, form))));

  // ── Carry on ────────────────────────────────────────────────────────────
  const last = state.last && byNumber(state.last.n);
  if (last) {
    blocks.push(section({},
      label('Where you stopped'),
      title(`${last.name} ${state.last.chapter}`),
      go('Carry on', () => ctx.go(`bible/${last.n}/${state.last.chapter}`))));
  }

  // ── Reading plans ───────────────────────────────────────────────────────
  const plansSection = section({ className: 'full' }, waiting());
  blocks.push(plansSection);
  (async () => {
    try {
      const plans = await content.plans();
      const active = plan.state().id;
      swap(plansSection, 
        h('div', { class: 'section-head' },
          label('Reading plans'),
          h('span', { class: 'row-meta', text: active ? 'One on the go' : `${plans.length} to choose` })),
        rows({},
          ...plans.map((one) => {
            const at = plan.positionIn(one);
            const holder = h('div', {});
            holder.appendChild(row({
              eyebrow: one.id === active ? 'Reading now' : one.kicker,
              title: one.title,
              note: one.id === active ? `Day ${at.day} of ${at.total}${at.at ? ` · ${at.at.ref}` : ''}` : one.blurb,
              meta: `${one.days.length} days`,
              accent: one.accent,
              onclick: () => ctx.go(`plan/${one.id}`),
            }));
            if (one.id === active) holder.appendChild(h('div', { style: 'margin-top:.9rem' }, thread(at.percent, 'gold')));
            return holder;
          })));
    } catch { plansSection.remove(); }
  })();

  // ── Verses you kept ─────────────────────────────────────────────────────
  if (state.saved.length) {
    blocks.push(section({ className: 'full' },
      h('div', { class: 'section-head' },
        label('Verses you kept'),
        h('span', { class: 'row-meta', text: String(state.saved.length) })),
      rows({},
        ...state.saved.slice(0, 6).map((one) => h('div', {},
          scripture(one.text, { flow: true }),
          h('div', { style: 'margin-top:.5rem' }, reference(`${one.ref} · ${one.code.toUpperCase()}`, ctx.go))))),
      state.saved.length > 6 ? small(`and ${state.saved.length - 6} more on this device.`) : null));
  }

  // ── The shelves ─────────────────────────────────────────────────────────
  for (const testament of TESTAMENTS) {
    const books = bible.books.filter((one) => one.testament === testament.id);
    blocks.push(section({ className: 'full' },
      h('div', { class: 'section-head' },
        label(testament.label),
        h('span', { class: 'row-meta', text: `${books.length} books` })),
      small(testament.line),
      h('div', { class: 'book-list' },
        ...books.map((one) => h('button', { class: 'book', type: 'button', onclick: () => ctx.go(`bible/${one.n}`) },
          h('span', { class: 'book-name', text: one.name }),
          h('span', { class: 'book-count', text: String(one.chapters) }))))));
  }

  // ── Translations ────────────────────────────────────────────────────────
  blocks.push(section({ className: 'full' },
    label('Translations'),
    rows({ tight: true },
      ...bible.translations.map((one) => row({
        title: `${one.language} — ${one.name}`,
        note: `${one.note} ${one.licence}.`,
        meta: one.short,
      }))),
    translationRow(bible, code, () => ctx.refresh())));

  const el = h('div', { style: 'display:contents' }, ...blocks);
  rise(blocks);
  return { title: 'Bible', el };
}
