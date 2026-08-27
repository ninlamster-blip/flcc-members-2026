// The component kit every screen builds from. Small on purpose: a screen is
// mostly a list of these, and re-rendering a whole screen is cheap.

import { h, icon, clear } from './dom.js';
import { scene as sceneSvg } from './art.js';

/** A strip: a band of the page, divided from its neighbours by one hairline. */
export function strip(label, ...children) {
  return h('section', { class: 'strip' }, label ? h('div', { class: 'eyebrow', text: label }) : null, children);
}

/** Kept for screens that still group content under a heading. */
export function section(title, ...children) {
  return h('section', { class: 'strip' }, title ? h('div', { class: 'eyebrow', text: title }) : null, children);
}

/** The app's main call to action: a line of text with an arrow. */
export function go(label, onclick, { plain = false } = {}) {
  return h('button', { class: `go ${plain ? 'go-plain' : ''}`.trim(), type: 'button', onclick }, label);
}

export function eyebrow(text) {
  return h('div', { class: 'eyebrow', text });
}

export function card(props, ...children) {
  const { as = 'div', ...rest } = props || {};
  return h(as, { class: 'card', ...rest }, children);
}

/** A horizontal rule used inside a strip, where a full strip is too much. */
export function rule() {
  return h('div', { style: 'height:1px;background:var(--rule);margin:1.25rem 0' });
}

export function button(label, props = {}) {
  const { variant = '', ...rest } = props;
  return h('button', { type: 'button', class: `btn ${variant}`.trim(), ...rest }, label);
}

export function row({ title, sub, end, onclick, chevron = true }) {
  return h('li', {},
    h('button', { class: 'row', type: 'button', onclick },
      h('span', { class: 'row-main' },
        h('span', { class: 'row-title', text: title }),
        sub ? h('span', { class: 'row-sub', text: sub }) : null),
      end ? h('span', { class: 'row-end', text: end }) : null,
      chevron ? icon('chevron', 16) : null));
}

export function list(...items) {
  return h('ul', { class: 'list' }, items);
}

export function bar(percent) {
  return h('div', { class: 'progress-line', role: 'progressbar', 'aria-valuenow': Math.round(percent), 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('i', { style: `width:${Math.max(0, Math.min(100, percent))}%` }));
}

export function empty(title, body, action) {
  return h('div', { class: 'empty' }, h('h2', { text: title }), body ? h('p', { text: body }) : null, action || null);
}

export function notice(text) {
  return h('p', { class: 'notice', text });
}

export function spinner() {
  return h('div', { class: 'spinner', role: 'status', 'aria-label': 'Loading' });
}

export function scripture(verses, { onVerse, highlights = {} } = {}) {
  const wrap = h('div', { class: 'scripture' });
  for (const verse of verses) {
    const el = h('button', {
      class: 'verse',
      type: 'button',
      dataset: { verse: String(verse.n) },
      onclick: onVerse ? () => onVerse(verse, el) : null,
    }, h('span', { class: 'verse-num', text: String(verse.n) }), verse.text);
    if (highlights[verse.n]) el.dataset.hl = highlights[verse.n];
    wrap.appendChild(el);
  }
  return wrap;
}

/** A small modal sheet — used for verse actions and confirmations. */
export function sheet(title, ...children) {
  const dialog = h('dialog', { class: 'sheet' }, h('h2', { text: title }), children);
  dialog.addEventListener('click', (event) => { if (event.target === dialog) dialog.close(); });
  dialog.addEventListener('close', () => dialog.remove());
  document.body.appendChild(dialog);
  if (typeof dialog.showModal === 'function') dialog.showModal();
  return dialog;
}

let toastTimer = null;
export function toast(message) {
  const el = document.getElementById('toast');
  if (!el) return;
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

export { h, icon, clear };

// ── Illustration, progress and small delights ───────────────────────────────


/** An illustration in a frame. `ratio` picks the shape it is cropped to. */
export function sceneEl(id, { ratio = 'story', title = '', className = '' } = {}) {
  const wrap = h('div', { class: `scene ${className}`.trim(), dataset: { ratio } });
  wrap.innerHTML = sceneSvg(id, { title });
  return wrap;
}

/** How far through the five memory stages a verse is. */
export function pips(done, total = 5) {
  const wrap = h('span', { class: 'pips', role: 'img', 'aria-label': `Step ${done} of ${total}` });
  for (let i = 0; i < total; i++) wrap.appendChild(h('i', i < done ? { 'data-on': '' } : {}));
  return wrap;
}

/** Fade sections up as they arrive. Skipped entirely when motion is reduced. */
export function reveal(...elements) {
  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nodes = elements.flat().filter(Boolean);
  if (reduced || typeof IntersectionObserver === 'undefined') return nodes;

  const observer = new IntersectionObserver((entries) => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      entry.target.dataset.shown = '';
      observer.unobserve(entry.target);
    }
  }, { rootMargin: '0px 0px -8% 0px' });

  nodes.forEach((node, index) => {
    node.classList.add('reveal');
    node.style.transitionDelay = `${Math.min(index, 4) * 45}ms`;
    observer.observe(node);
  });
  return nodes;
}

/** A short burst of sparks from an element — for getting something right. */
export function celebrate(target) {
  if (!target) return;
  target.classList.remove('popped');
  void target.offsetWidth;                       // restart the animation
  target.classList.add('popped');

  const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reduced) return;

  const burst = h('span', { class: 'sparks', 'aria-hidden': 'true' });
  for (let i = 0; i < 7; i++) {
    const angle = (Math.PI * 2 * i) / 7 - Math.PI / 2;
    const distance = 34 + (i % 3) * 10;
    burst.appendChild(h('i', {
      style: `--dx:${Math.round(Math.cos(angle) * distance)}px;--dy:${Math.round(Math.sin(angle) * distance)}px;animation-delay:${i * 18}ms`,
    }));
  }
  const holder = getComputedStyle(target).position === 'static' ? target.parentElement || target : target;
  if (getComputedStyle(holder).position === 'static') holder.style.position = 'relative';
  holder.appendChild(burst);
  setTimeout(() => burst.remove(), 900);
}

/** The gentler counterpart: a nudge, never a buzzer. */
export function nudge(target) {
  if (!target) return;
  target.classList.remove('nudged');
  void target.offsetWidth;
  target.classList.add('nudged');
}
