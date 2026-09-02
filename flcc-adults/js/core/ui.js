// The component kit. Everything is a poster, an action, or a piece of type.
//
// This is the kids and teens edition's kit, with the same names and the same
// shapes, plus the three things the adult app needs and that one does not: a
// list of rows inside a poster, a tag for a countdown, and a field to write a
// prayer into. Nothing new invents a second visual language — a row is a
// hairline, a tag is an outlined pill, a field is a paper block with the same
// inset outline as everything else.
//
// The two apps share no code by design, so this file and `flcc-next`'s are
// deliberate duplicates. A change to the poster language belongs in both or in
// neither.

import { h, clear, navIcon } from './dom.js';
import { symbol, fillFor, toneFor } from './art.js';
import { showFigures } from './profile.js';

/**
 * The app's one layout primitive: a block of colour with a label, a headline,
 * an illustration, and at most one action.
 */
export function poster({ tone = 'paper', tall = false, as = 'div', onclick, className = '', ...rest } = {}, ...children) {
  return h(as, {
    class: `poster ${className}`.trim(),
    dataset: { tone, ...(tall ? { tall: '' } : {}) },
    ...(onclick ? { onclick, type: as === 'button' ? 'button' : null } : {}),
    ...rest,
  }, children);
}

export function label(text) { return h('div', { class: 'label', text }); }
export function display(text) { return h('h1', { class: 'display', text }); }
export function headline(text, tag = 'h2') { return h(tag, { class: 'headline', text }); }
export function lead(text) { return h('p', { class: 'lead', text }); }
export function body(text) { return h('p', { class: 'body', text }); }
export function dim(text) { return h('p', { class: 'body dim', text }); }
export function note(text) { return h('p', { class: 'note', text }); }
export function numeral(value) { return h('p', { class: 'numeral', text: String(value) }); }

/**
 * Scripture.
 *
 * Set in the same face as everything else — the kids edition does not reach
 * for a serif and neither does this one. What marks Scripture out is the size
 * it is given and the space around it. A short verse gets the larger setting;
 * four verses of a psalm get the reading size, because the large one turns
 * them into a wall that fills a phone.
 */
export function scripture(text, { flow = false } = {}) {
  const source = String(text || '').trim();
  // Some passages open with a quotation mark of their own — anything Jesus
  // says, for a start — and wrapping those again prints ““Come to me.
  const quoted = /^[“"]/.test(source);
  return h('p', {
    class: 'verse',
    dataset: { length: flow || source.length > 150 ? 'l' : 'm' },
    text: quoted ? source : `“${source}”`,
  });
}

/**
 * An illustration, sized for its poster and filled to sit on the colour.
 *
 * The reader's choice to switch the drawings off is honoured HERE rather than
 * at each call site: a screen that reached for `symbol()` directly would keep
 * drawing them, and turning them off in You would clear some screens and not
 * others.
 */
export function art(name, { tone = 'paper', size = '', title = '' } = {}) {
  if (!showFigures()) return h('span', { hidden: true });
  const wrap = h('div', { class: 'art', dataset: size ? { size } : {} });
  wrap.innerHTML = symbol(name, { fill: fillFor(tone), title });
  return wrap;
}

/**
 * The same drawing, as markup rather than an element.
 *
 * The match-three board sets sixty-four tiles at once and re-sets them on
 * every cascade, so building sixty-four wrapper elements a frame is wasteful —
 * but a screen that reached into `art.js` for the SVG itself would step around
 * the drawings-off setting, and turning the drawings off would clear the whole
 * app except the game board. This is the way through: it honours the setting
 * exactly as `art()` does, and hands back a string.
 */
export function artMarkup(name, tone = 'paper') {
  return showFigures() ? symbol(name, { fill: fillFor(tone) }) : '';
}

export function go(text, onclick) {
  return h('button', { class: 'go', type: 'button', onclick }, text);
}

export function pill(text, onclick, { quiet = false, ...rest } = {}) {
  return h('button', { class: 'pill', type: 'button', onclick, ...(quiet ? { 'data-quiet': '' } : {}), ...rest }, text);
}

export function pillRow(...children) {
  return h('div', { class: 'pill-row' }, children.flat(Infinity).filter(Boolean));
}

export function track(percent) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return h('div', { class: 'track', role: 'progressbar', 'aria-valuenow': value, 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('i', { style: `width:${value}%` }));
}

export function choice(text, onclick, props = {}) {
  return h('button', { class: 'choice', type: 'button', onclick, ...props }, text);
}

/** A countdown beside a heading. Nothing else uses it. */
export function tag(text) { return h('span', { class: 'tag', text }); }

// ── Rows ───────────────────────────────────────────────────────────────────
//
// A list inside a poster, for the places where a set of things genuinely is a
// list — the sessions in a path, the days of a plan, what is on this device.
// Hairlines, so a list never becomes a second grid of boxes.

export function rows(...children) {
  return h('div', { class: 'rows' }, children.flat(Infinity).filter(Boolean));
}

export function row({ title: heading, note: lede = '', meta = '', onclick, ...rest } = {}) {
  return h(onclick ? 'button' : 'div', {
    class: 'row', ...(onclick ? { onclick, type: 'button' } : {}), ...rest,
  },
    h('div', { class: 'row-top' },
      h('p', { class: 'row-title', text: heading }),
      meta ? h('span', { class: 'row-meta', text: meta }) : null),
    lede ? h('p', { class: 'row-note', text: lede }) : null);
}

export function waiting() { return h('div', { class: 'wait', role: 'status', 'aria-label': 'Loading' }); }

/**
 * A Scripture reference that opens the Bible.
 *
 * The whole Bible ships with this app, so a reference rendered as dead text is
 * an adult retyping "Lamentations 3:22" into the Bible tab. `scripture.js` is
 * imported on the click rather than at the top of the file: every screen loads
 * this kit, and only a reader who taps a reference needs the parser.
 *
 * A reference that will not parse is not left as a dead button — it falls
 * through to a search for the same words, which is what a reader wanted anyway.
 */
export function reference(text, navigate, { className = 'ref', style = '' } = {}) {
  if (!text) return h('span');
  if (typeof navigate !== 'function') return h('p', { class: className, style, text });
  return h('button', {
    class: `${className} ref-link`, type: 'button', style,
    'aria-label': `Open ${text} in the Bible`,
    onclick: async () => {
      try {
        const module = await import('./scripture.js');
        const { books } = await module.manifest();
        const found = module.parseRef(text, books);
        if (!found) { navigate(`bible/search?q=${encodeURIComponent(text)}`); return; }
        navigate(`bible/${found.book.n}/${found.chapter}${found.verse ? `?v=${found.verse}` : ''}`);
      } catch { toast('The Bible could not be opened just now.'); }
    },
  }, text);
}

/**
 * Replace an element's children, dropping the ones that are not there.
 *
 * `Element.replaceChildren()` stringifies whatever it is given, so a
 * conditional child written as `condition ? thing() : null` — the pattern used
 * everywhere in these screens — puts the word "null" on the page. This is the
 * only way a screen should swap its contents, and `test/modules.test.mjs`
 * fails a screen that calls `replaceChildren` directly.
 */
export function swap(el, ...children) {
  el.replaceChildren(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
  return el;
}

/** Posters arrive as you scroll. They land once, and they do not bounce. */
export function rise(elements) {
  const nodes = [].concat(elements).filter(Boolean);
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced || typeof IntersectionObserver === 'undefined') return nodes;
  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.dataset.in = '';
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -6% 0px' });
  nodes.forEach((node, i) => {
    node.classList.add('rise');
    node.style.transitionDelay = `${Math.min(i, 5) * 55}ms`;
    observer.observe(node);
  });
  return nodes;
}

/**
 * A full-screen moment: the end of a guided prayer, the end of a path. One
 * headline, one line, one way out. It is the only interruption the app has.
 *
 * Because it covers the whole screen — the tab bar included — it has to be
 * impossible to leave behind. Its own pill closes it, Escape closes it, and a
 * route change closes it: without that last one a member who used the back
 * gesture at "AMEN." would find every tap in the app swallowed by an invisible
 * sheet from a prayer they had already finished.
 */
export function moment({ tone = 'sunshine', eyebrow = '', big, line = '', action = 'Amen', onclose }) {
  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    window.removeEventListener('hashchange', close);
    document.removeEventListener('keydown', onKey);
    screen.remove();
    if (onclose) onclose();
  };
  const onKey = (e) => { if (e.key === 'Escape') close(); };

  const screen = h('div', { class: 'moment', role: 'dialog', 'aria-modal': 'true', style: `background:var(--${tone})` },
    eyebrow ? label(eyebrow) : null,
    h('p', { class: 'display', text: big }),
    line ? h('p', { class: 'lead dim', text: line }) : null,
    h('div', { style: 'margin-top:auto' }, pill(action, close)));

  window.addEventListener('hashchange', close);
  document.addEventListener('keydown', onKey);
  document.body.appendChild(screen);
  screen.querySelector('.pill').focus();
  screen.close = close;
  return screen;
}

let toastTimer = null;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    // `pointer-events:none` matters more than it looks. The toast sits just
    // above the tab bar for two and a half seconds, and without it it swallows
    // taps on the tabs directly underneath.
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite',
      style: 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(5.5rem + env(safe-area-inset-bottom));z-index:50;'
        + 'pointer-events:none;background:#2B4C6D;color:#FBF8F0;padding:.7rem 1.2rem;border-radius:99px;'
        + 'font-size:.85rem;font-weight:600;max-width:90vw;text-align:center' });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

export { h, clear, navIcon, toneFor, symbol };
