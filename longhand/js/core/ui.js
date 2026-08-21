/**
 * The component kit.
 *
 * Everything the views build from. The constraint that keeps this file
 * small: a component earns its place by being used on at least two screens,
 * and nothing here exists to decorate.
 */

import { h, icon } from './dom.js';
import { MEETING_STATUS } from './schema.js';

export function pageHead({ title, subtitle, actions = [] }) {
  return h('div.view__head',
    h('div.grow',
      h('h1.page-title', title),
      subtitle ? h('p.lede', { style: { marginTop: '6px' } }, subtitle) : null),
    actions.length ? h('div.row.row--tight', actions) : null);
}

export function section({ title, aside = null, actions = [] }, ...children) {
  return h('section.section',
    title ? h('div.section__head',
      h('h2.subhead', title),
      h('div.spacer'),
      aside ? h('span.meta-sm', aside) : null,
      ...actions) : null,
    ...children);
}

export function button(label, { onClick, variant = '', iconName = null, type = 'button', title = null, disabled = false, size = '' } = {}) {
  const classes = ['btn', variant ? `btn--${variant}` : '', size ? `btn--${size}` : ''].filter(Boolean).join('.');
  return h(`button.${classes}`, {
    type, onClick, title, disabled: disabled || null,
    'aria-label': label ? null : title,
  }, iconName ? icon(iconName, { size: 16 }) : null, label || null);
}

export function linkRow({ href, title, lines = [], side = [], leading = null, onClick = null }) {
  const node = href
    ? h('a.row-item', { href })
    : h('button.row-item', { type: 'button', onClick });
  node.append(
    leading || '',
    h('div.row-item__main',
      h('span.row-item__title', title),
      ...lines.map((line) => (typeof line === 'string' ? h('span.meta', line) : line))),
    side.length ? h('div.row-item__side', ...side) : '');
  return node;
}

export function rows(...children) {
  return h('div.rows', ...children);
}

export function tag(text, tone = '') {
  return h(`span.tag${tone ? `.tag--${tone}` : ''}`, text);
}

/** Status always carries its word — colour alone is never the signal. */
export function statusTag(status) {
  const tone = { recording: 'record', transcribing: 'attention', processing: 'attention', ready: '', failed: 'attention' }[status] || '';
  if (status === 'ready') return null;   // "Ready" on every row is noise
  return tag(MEETING_STATUS[status] || status, tone);
}

export function empty({ title, body, action = null }) {
  return h('div.empty', h('h3', title), body ? h('p', body) : null, action);
}

export function notice({ tone = '', title, body, actions = [] }) {
  return h(`div.notice${tone ? `.notice--${tone}` : ''}`,
    title ? h('h4', title) : null,
    body ? h('p', body) : null,
    actions.length ? h('div.row.row--tight', { style: { marginTop: '8px' } }, actions) : null);
}

export function field(label, control, hint = '') {
  const id = control.id || `f${Math.random().toString(36).slice(2, 8)}`;
  control.id = id;
  return h('div.field',
    h('label', { for: id }, label),
    control,
    hint ? h('span.hint', hint) : null);
}

export function searchField({ value = '', placeholder = 'Search', onInput, onEnter }) {
  const input = h('input.input', {
    type: 'search', value, placeholder, 'aria-label': placeholder,
    onInput: (event) => onInput && onInput(event.target.value),
    onKeydown: (event) => { if (event.key === 'Enter' && onEnter) onEnter(event.target.value); },
  });
  return h('div.search-field', icon('search', { size: 16 }), input);
}

/* ── overlays ────────────────────────────────────────────────────────────── */

/**
 * A modal that resolves to whatever its buttons resolve to. Focus moves in,
 * Escape closes, and focus returns to whatever opened it.
 */
export function dialog({ title, body, actions }) {
  const opener = document.activeElement;
  return new Promise((resolve) => {
    const close = (value) => {
      scrim.remove();
      document.removeEventListener('keydown', onKey);
      if (opener && opener.focus) opener.focus();
      resolve(value);
    };
    const onKey = (event) => {
      if (event.key === 'Escape') { event.preventDefault(); close(null); }
      if (event.key === 'Tab') trapFocus(panel, event);
    };
    const panel = h('div.dialog', { role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
      h('h2', title),
      body,
      h('div.dialog__actions', ...actions(close)));
    const scrim = h('div.scrim', { onClick: (event) => { if (event.target === scrim) close(null); } }, panel);
    document.body.appendChild(scrim);
    document.addEventListener('keydown', onKey);
    const first = panel.querySelector('input, textarea, select, button');
    if (first) first.focus();
  });
}

function trapFocus(panel, event) {
  const focusable = [...panel.querySelectorAll('a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])')];
  if (!focusable.length) return;
  const first = focusable[0];
  const last = focusable[focusable.length - 1];
  if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
  else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
}

export function confirm({ title, body, confirmLabel = 'Confirm', danger = false }) {
  return dialog({
    title,
    body: h('p.body.muted-text', body),
    actions: (close) => [
      button('Cancel', { onClick: () => close(false) }),
      button(confirmLabel, { variant: danger ? 'danger' : 'primary', onClick: () => close(true) }),
    ],
  });
}

export function promptDialog({ title, label, value = '', hint = '', confirmLabel = 'Save', multiline = false }) {
  const input = multiline
    ? h('textarea.textarea', { rows: 4 }, value)
    : h('input.input', { type: 'text', value });
  return dialog({
    title,
    body: h('div.stack', field(label, input, hint)),
    actions: (close) => [
      button('Cancel', { onClick: () => close(null) }),
      button(confirmLabel, { variant: 'primary', onClick: () => close(input.value.trim()) }),
    ],
  });
}

/** A menu anchored under a button. Closes on Escape, click-away or choice. */
export function menu(anchor, items) {
  const existing = document.querySelector('.menu');
  if (existing) existing.remove();
  const node = h('div.menu', { role: 'menu' });
  for (const item of items) {
    if (item === '-') { node.appendChild(h('hr')); continue; }
    node.appendChild(h('button', {
      type: 'button', role: 'menuitem',
      class: item.danger ? 'is-danger' : null,
      onClick: () => { node.remove(); item.onSelect(); },
    }, item.iconName ? icon(item.iconName, { size: 15 }) : null, item.label));
  }
  document.body.appendChild(node);
  const box = anchor.getBoundingClientRect();
  const width = node.offsetWidth;
  node.style.top = `${Math.round(box.bottom + window.scrollY + 4)}px`;
  node.style.left = `${Math.round(Math.min(box.left + window.scrollX, window.innerWidth - width - 12))}px`;
  const dismiss = (event) => {
    if (node.contains(event.target)) return;
    node.remove();
    document.removeEventListener('mousedown', dismiss);
    document.removeEventListener('keydown', onKey);
  };
  const onKey = (event) => { if (event.key === 'Escape') dismiss({ target: document.body }); };
  setTimeout(() => {
    document.addEventListener('mousedown', dismiss);
    document.addEventListener('keydown', onKey);
  }, 0);
  const first = node.querySelector('button');
  if (first) first.focus();
}

let toastTimer = null;
export function toast(message) {
  const existing = document.querySelector('.toast');
  if (existing) existing.remove();
  const node = h('div.toast', { role: 'status', 'aria-live': 'polite' }, message);
  document.body.appendChild(node);
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => node.remove(), 3200);
}

/** A live region for things a screen reader must hear but nobody needs to see. */
export function announce(message) {
  let region = document.getElementById('lh-live');
  if (!region) {
    region = h('div#lh-live.sr-only', { 'aria-live': 'polite', 'aria-atomic': 'true' });
    document.body.appendChild(region);
  }
  region.textContent = message;
}

export function spinner(size = 16) {
  return h('svg.spin', { viewBox: '0 0 24 24', width: size, height: size, fill: 'none', 'aria-hidden': 'true' },
    h('circle', { cx: 12, cy: 12, r: 9, stroke: 'currentColor', 'stroke-width': 2, 'stroke-opacity': .2 }),
    h('path', { d: 'M21 12a9 9 0 0 0-9-9', stroke: 'currentColor', 'stroke-width': 2, 'stroke-linecap': 'round' }));
}
