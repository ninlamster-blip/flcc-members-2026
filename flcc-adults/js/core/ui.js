// The component kit.
//
// Everything the reader touches is a card: a navy outline, a hard shadow, a
// flat colour, and a band along the bottom. The kit exists so that is true by
// default rather than by discipline — there is no way to build a surface in
// this app that quietly loses its outline.
//
// The one deliberate exception is Scripture. `reader()` and the passage type
// below are plain paper: the Bible screen is where the chrome stops.

import { h, clear, navIcon } from './dom.js';
import * as art from './art.js';
import { showFigures } from './profile.js';

/**
 * A card.
 *
 * @param {object} options
 * @param {string} options.tone    the card's colour; its band is derived in CSS
 * @param {string} options.symbol  a character from js/core/art.js, drawn at the
 *                                 end of the body. One per card, at most.
 * @param {*}      options.foot    what goes in the bottom band — a string, an
 *                                 element, or [left, right]
 * @param {boolean} options.tall   a hero card: taller, and its content spreads
 */
export function card({ tone = 'cream', symbol = '', figureSize = '', foot = null, tall = false,
                       as = 'div', onclick, className = '', ...rest } = {}, ...children) {
  const el = h(as, {
    class: `card ${className}`.trim(),
    dataset: { tone, ...(tall ? { tall: '' } : {}) },
    ...(onclick ? { onclick, type: as === 'button' ? 'button' : null } : {}),
    ...rest,
  });
  const body = h('div', { class: 'card-body' }, children.flat(Infinity).filter(Boolean));
  if (symbol) body.appendChild(figure(symbol, tone, { size: figureSize }));
  el.appendChild(body);
  if (foot !== null && foot !== undefined && foot !== false) el.appendChild(band(foot));
  return el;
}

/** The band along the bottom of a card. */
export function band(content) {
  const parts = (Array.isArray(content) ? content : [content]).filter((one) => one !== null && one !== undefined && one !== false);
  return h('div', { class: 'card-foot' },
    ...parts.map((one) => (one instanceof Node ? one : h('span', { text: String(one) }))));
}

/**
 * One of the characters.
 *
 * The fill is chosen against the surface it sits on rather than passed in:
 * a character has to be a different colour from its own card or it disappears,
 * and leaving that to each call site is how a set stops looking like a set.
 */
const ON = {
  cream: 'coral', yellow: 'blush', blush: 'sky', sky: 'lilac',
  lilac: 'yellow', coral: 'cream', orange: 'cream', paper: 'yellow',
};

export function figure(name, on = 'cream', { size = '' } = {}) {
  // The reader's choice is honoured HERE rather than at each call site: a
  // screen that reaches for a character directly must go dark too, or turning
  // them off in You clears some screens and not others.
  if (!showFigures()) return h('span', { hidden: true });
  const el = h('div', { class: 'figure', ...(size ? { dataset: { size } } : {}) });
  el.innerHTML = art.mascot(art.isMascot(name) ? name : art.pick(name), ON[on] || 'coral');
  return el;
}

/** A white pill with a navy outline — the app's eyebrow. */
export function badge(text, { tone = '' } = {}) {
  return h('span', { class: 'badge', ...(tone ? { dataset: { tone } } : {}), text });
}

/** A small aside with a tail, for the thing worth saying in four words. */
export function bubble(text) { return h('span', { class: 'bubble', text }); }

/** Five stars, `lit` of them filled. Ornament, and the odd small count. */
export function starRow(lit = 5, total = 5) {
  const el = h('span', { style: 'display:inline-flex' });
  el.innerHTML = art.stars(lit, total);
  return el;
}

/** A group with no chrome at all: used to hold cards, and on the Bible screen. */
export function section({ className = '', ...rest } = {}, ...children) {
  return h('div', { class: `section ${className}`.trim(), style: 'display:flex;flex-direction:column;gap:.85rem', ...rest },
    children.flat(Infinity).filter(Boolean));
}

/** Plain paper. Scripture is read on this, and nothing else uses it. */
export function reader({ className = '', ...rest } = {}, ...children) {
  return h('div', { class: `reader ${className}`.trim(), ...rest }, children.flat(Infinity).filter(Boolean));
}

export function label(text) { return h('p', { class: 'label', text }); }
export function display(text) { return h('h1', { class: 'display', text }); }
export function title(text, tag = 'h2') { return h(tag, { class: 'title', text }); }
export function lead(text) { return h('p', { class: 'lead', text }); }
export function body(text) { return h('p', { class: 'body', text }); }
export function note(text, level = '') { return h('p', { class: 'note', ...(level ? { dataset: { level } } : {}), text }); }
export function small(text) { return h('p', { class: 'small', text }); }
export function rule() { return h('hr', { class: 'rule' }); }
export function waiting() { return h('div', { class: 'wait', role: 'status', 'aria-label': 'Loading' }); }

/**
 * Scripture, set as Scripture.
 *
 * The serif is the one typographic signal in the app that says this text is
 * not ours. The size steps down as the passage gets longer, because a setting
 * that is right for one line of Micah turns four verses of Psalm 139 into a
 * wall that fills a phone.
 */
export function scripture(text, { flow = false, tag = 'p' } = {}) {
  const source = String(text || '');
  const length = source.length > 300 ? 'xl' : source.length > 150 ? 'l' : 'm';
  return h(tag, { class: `scripture${flow ? ' scripture--flow' : ''}`, dataset: { length }, text: `“${source}”` });
}

export function cite(text) { return h('p', { class: 'cite', text }); }

export function go(text, onclick) { return h('button', { class: 'go', type: 'button', onclick }, text); }

export function act(text, onclick, { quiet = false, small: compact = false, ...rest } = {}) {
  return h('button', {
    class: 'act', type: 'button', onclick,
    ...(quiet ? { 'data-quiet': '' } : {}),
    ...(compact ? { 'data-small': '' } : {}),
    ...rest,
  }, text);
}

export function actions(...children) { return h('div', { class: 'act-row' }, children.flat(Infinity).filter(Boolean)); }

export function thread(percent, accent = '') {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return h('div', { class: 'thread', ...(accent ? { dataset: { accent } } : {}),
    role: 'progressbar', 'aria-valuenow': String(value), 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('i', { style: `width:${value}%` }));
}

export function tag(text, accent = '') {
  return h('span', { class: 'tag', ...(accent ? { dataset: { accent } } : {}), text });
}

/** One row of a list — itself a small card. */
export function row({ eyebrow = '', title: heading, note: lede = '', meta = '', accent = '', number = '', onclick, ...rest } = {}) {
  const el = h(onclick ? 'button' : 'div', {
    class: 'row', ...(onclick ? { onclick, type: 'button' } : {}), ...rest,
  });
  if (accent) el.appendChild(h('i', { class: 'stem', dataset: { accent } }));
  else if (number !== '' && number !== null) el.appendChild(h('span', { class: 'row-num', text: String(number) }));
  else el.appendChild(h('span'));

  el.appendChild(h('div', {},
    eyebrow ? h('p', { class: 'label', style: 'margin-bottom:.3rem', text: eyebrow }) : null,
    h('p', { class: 'row-title', text: heading }),
    lede ? h('p', { class: 'row-note', text: lede }) : null));
  el.appendChild(meta ? h('span', { class: 'row-meta', text: meta }) : h('span'));
  return el;
}

export function rows({ tight = false } = {}, ...children) {
  return h('div', { class: 'rows', ...(tight ? { dataset: { tight: '' } } : {}) },
    children.flat(Infinity).filter(Boolean));
}

export function choice(text, onclick, props = {}) {
  return h('button', { class: 'choice', type: 'button', onclick, ...props }, text);
}

/**
 * A Scripture reference that opens the Bible.
 *
 * The whole Bible ships with this app, so a reference rendered as dead text is
 * an adult retyping "Lamentations 3:22" into the Bible tab. `scripture.js` is
 * imported on the click rather than at the top of the file: every screen loads
 * this kit, and only a reader who taps a reference needs the parser.
 */
export function reference(text, navigate, { className = 'cite', style = '' } = {}) {
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

/** Cards arrive as you scroll. They land once, and never again. */
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
  }, { rootMargin: '0px 0px -5% 0px' });
  nodes.forEach((node, i) => {
    node.classList.add('rise');
    node.style.transitionDelay = `${Math.min(i, 5) * 50}ms`;
    observer.observe(node);
  });
  return nodes;
}

/**
 * A full-screen moment. The app has exactly one interruption, and this is it:
 * the end of a guided prayer, the end of a path. One line, one way out.
 */
export function moment({ eyebrow = '', big, line = '', action = 'Amen', symbol = 'star', tone = 'yellow', onclose }) {
  const screen = h('div', { class: 'moment', role: 'dialog', 'aria-modal': 'true', style: `background:var(--${tone})` });
  screen.append(
    figure(symbol, tone),
    eyebrow ? badge(eyebrow) : null,
    h('p', { class: 'display', text: big }),
    line ? lead(line) : null,
    h('div', { style: 'margin-top:.4rem' }, act(action, () => { screen.remove(); if (onclose) onclose(); })));
  document.body.appendChild(screen);
  screen.querySelector('.act').focus();
  return screen;
}

let toastTimer = null;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite',
      style: 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(6.5rem + env(safe-area-inset-bottom));z-index:70;'
        + 'background:#FFFDF7;color:#1B2A5C;padding:.7rem 1.1rem;border:2px solid #1B2A5C;border-radius:99px;'
        + 'box-shadow:3px 4px 0 #1B2A5C;font-size:.84rem;font-weight:700;max-width:90vw;text-align:center' });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

export { h, clear, navIcon };
