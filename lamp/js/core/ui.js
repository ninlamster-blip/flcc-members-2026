// The component kit every screen builds from. Small on purpose: a screen is
// mostly a list of these, and re-rendering a whole screen is cheap.

import { h, icon, clear } from './dom.js';

export function section(title, ...children) {
  return h('section', { class: 'section' }, title ? h('h2', { text: title }) : null, children);
}

export function eyebrow(text) {
  return h('div', { class: 'eyebrow', text });
}

export function card(props, ...children) {
  const { as = 'div', ...rest } = props || {};
  return h(as, { class: 'card', ...rest }, children);
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
  return h('div', { class: 'bar', role: 'progressbar', 'aria-valuenow': Math.round(percent), 'aria-valuemin': '0', 'aria-valuemax': '100' },
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
  const dialog = h('dialog', { class: 'card', style: 'border:0;max-width:24rem;width:calc(100% - 2rem);' },
    h('h2', { text: title, style: 'font-size:1.05rem;margin-bottom:.9rem' }),
    children,
  );
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
