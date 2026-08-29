// The component kit.
//
// There is no card here. Everything is a section of type, a block of colour,
// a row in a list, or an action — and the hierarchy between them is carried by
// size and space rather than by borders. If a new component needs a rounded
// rectangle with a shadow to be legible, it is the wrong component.

import { h, clear, navIcon } from './dom.js';
import * as shapes from './shapes.js';
import { showShapes } from './profile.js';

/**
 * An editorial section: an eyebrow, then whatever it holds.
 *
 * This is the app's default container. It draws nothing at all.
 */
export function section({ className = '', ...rest } = {}, ...children) {
  return h('div', { class: `section ${className}`.trim(), ...rest }, children);
}

/**
 * A block of colour, optionally with an organic field behind the type.
 *
 * `seed` decides the shapes. Pass something stable and meaningful — a verse
 * reference, a path id, the date — and the same block draws the same curve
 * every time it is opened.
 */
export function block({ tone = 'paper', shape = null, corner = 'br', soft = false, tall = false,
                        as = 'div', onclick, className = '', ...rest } = {}, ...children) {
  const el = h(as, {
    class: `block ${className}`.trim(),
    dataset: { tone, ...(tall ? { tall: '' } : {}) },
    ...(onclick ? { onclick, type: as === 'button' ? 'button' : null } : {}),
    ...rest,
  });
  if (shape && showShapes()) {
    const field = h('div', { class: 'shapes', 'aria-hidden': 'true', ...(soft ? { dataset: { soft: '' } } : {}) });
    field.innerHTML = shapes.field(shape.seed, shape.tones, { corner });
    el.appendChild(field);
  }
  for (const child of children.flat(Infinity)) if (child) el.appendChild(child);
  return el;
}

/** The small organic stone that marks a heading or covers a path. */
export function mark(seed, tone = 'sage', { size = 'sm' } = {}) {
  const el = h('span', { class: `mark-holder mark-${size}`, 'aria-hidden': 'true',
    style: 'display:inline-flex;flex:none' });
  el.innerHTML = shapes.mark(seed, tone);
  el.firstChild?.setAttribute('class', `mark mark-${size}`);
  return el;
}

export function label(text, accent = false) { return h('p', { class: 'label', ...(accent ? { dataset: { accent: '' } } : {}), text }); }
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
 * The serif is not decoration: it is the one typographic signal in the app
 * that says this text is not ours. `flow` is the long-form setting used when a
 * passage is being read rather than displayed.
 *
 * The size steps down as the passage gets longer. A display setting that is
 * right for one line of Micah turns four verses of Psalm 139 into a wall that
 * fills a phone screen and pushes everything else below the fold, so the
 * length of the text decides the size rather than the screen it sits on.
 */
export function scripture(text, { flow = false, tag = 'p' } = {}) {
  const body = String(text || '');
  const length = body.length > 300 ? 'xl' : body.length > 150 ? 'l' : 'm';
  return h(tag, { class: `scripture${flow ? ' scripture--flow' : ''}`,
    dataset: { length }, text: `“${body}”` });
}

export function cite(text) { return h('p', { class: 'cite', text }); }

export function go(text, onclick) {
  return h('button', { class: 'go', type: 'button', onclick }, text);
}

export function act(text, onclick, { quiet = false, small: compact = false, ...rest } = {}) {
  return h('button', {
    class: 'act', type: 'button', onclick,
    ...(quiet ? { 'data-quiet': '' } : {}),
    ...(compact ? { 'data-small': '' } : {}),
    ...rest,
  }, text);
}

export function actions(...children) { return h('div', { class: 'act-row' }, children.flat(Infinity).filter(Boolean)); }

/** A progress thread. Two pixels of colour, and never a percentage shouted. */
export function thread(percent, accent = '') {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return h('div', { class: 'thread', ...(accent ? { dataset: { accent } } : {}),
    role: 'progressbar', 'aria-valuenow': String(value), 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('i', { style: `width:${value}%` }));
}

export function tag(text, accent = '') {
  return h('span', { class: 'tag', ...(accent ? { dataset: { accent } } : {}), text });
}

/**
 * One row of an editorial list.
 *
 * `accent` draws a three-pixel stem of colour on the left — enough to tell a
 * ministry from a prayer category at a glance, and far short of giving every
 * item its own coloured icon in its own coloured circle.
 */
export function row({ eyebrow = '', title: heading, note: lede = '', meta = '', accent = '', number = '', onclick, ...rest } = {}) {
  const el = h(onclick ? 'button' : 'div', {
    class: 'row', ...(onclick ? { onclick, type: 'button' } : {}), ...rest,
  });
  if (accent) el.appendChild(h('i', { class: 'stem', dataset: { accent } }));
  else if (number !== '' && number !== null) el.appendChild(h('span', { class: 'row-num', text: String(number) }));
  else el.appendChild(h('span'));

  el.appendChild(h('div', {},
    eyebrow ? h('p', { class: 'label', style: 'margin-bottom:.35rem', text: eyebrow }) : null,
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
 * a reader retyping "Lamentations 3:22" into the Bible tab. `scripture.js` is
 * imported on the click rather than at the top of the file: every screen loads
 * this kit, and only a reader who actually taps a reference needs the parser.
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

/** Sections arrive as you scroll. They fade up once, and never again. */
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
    node.style.transitionDelay = `${Math.min(i, 5) * 60}ms`;
    observer.observe(node);
  });
  return nodes;
}

/**
 * A full-screen moment. The app has exactly one interruption, and this is it:
 * the end of a guided prayer, the end of a path. One line, one way out.
 */
export function moment({ eyebrow = '', big, line = '', action = 'Amen', seed = 'moment', tones = ['peach', 'gold'], onclose }) {
  const screen = h('div', { class: 'moment', role: 'dialog', 'aria-modal': 'true' });
  const field = h('div', { class: 'shapes', 'aria-hidden': 'true', dataset: { soft: '' } });
  field.innerHTML = shapes.field(seed, tones, { corner: 'tr' });
  screen.append(field,
    eyebrow ? label(eyebrow) : null,
    h('p', { class: 'display', text: big }),
    line ? lead(line) : null,
    h('div', { style: 'margin-top:1rem' }, act(action, () => { screen.remove(); if (onclose) onclose(); })));
  document.body.appendChild(screen);
  screen.querySelector('.act').focus();
  return screen;
}

let toastTimer = null;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite',
      style: 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(6rem + env(safe-area-inset-bottom));z-index:70;'
        + 'background:#253624;color:#F9F9F3;padding:.75rem 1.25rem;border-radius:99px;font-size:.85rem;font-weight:500;max-width:90vw;text-align:center' });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2800);
}

export { h, clear, navIcon };
