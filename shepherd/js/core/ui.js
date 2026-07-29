/**
 * The component kit.
 *
 * Every module builds its screens out of these, which is what keeps fourteen
 * modules looking like one product. Components are functions returning DOM
 * nodes — no lifecycle, no state, no surprises.
 */

import { h, frag, icon, render } from './dom.js';
import { initials, hash32 } from './id.js';
import { formatDate, formatDateTime, relativeTime, truncate } from './format.js';

/* ── page scaffolding ────────────────────────────────────────────────────── */

/**
 * @param {{title: string, subtitle?: string, eyebrow?: string, actions?: Node[],
 *          narrow?: boolean, children: any[]}} options
 */
export function page({ title, subtitle, eyebrow, actions = [], narrow = false, children = [] }) {
  return h('div', { class: `page${narrow ? ' page--narrow' : ''}` },
    h('header.page__head',
      eyebrow && h('p.eyebrow', null, eyebrow),
      h('div.row.row--between.row--wrap',
        h('div', null,
          h('h1', null, title),
          subtitle && h('p.muted', null, subtitle)),
        actions.length ? h('div.row', { class: 'no-print' }, ...actions) : null)),
    ...children);
}

export function card({ title, subtitle, actions = [], children = [], tight = false, className = '' } = {}) {
  const el = h('section', { class: `card${tight ? ' card--tight' : ''} ${className}`.trim() });
  if (title || actions.length) {
    el.appendChild(h('div.card__head',
      h('div', null,
        h('h2', null, title),
        subtitle && h('p.small.muted', null, subtitle)),
      h('div.spacer'),
      ...actions));
  }
  for (const child of children) if (child) el.appendChild(child);
  return el;
}

export function stat({ value, label, delta, deltaDirection, onClick }) {
  const node = h('div', { class: `stat${onClick ? ' card--link' : ''}`, ...(onClick ? { onClick, role: 'button', tabindex: 0 } : {}) },
    h('span.stat__value', null, value),
    h('span.stat__label', null, label),
    delta ? h('span', { class: `stat__delta stat__delta--${deltaDirection || 'up'}` }, delta) : null);
  return node;
}

export function statCard(props) {
  return h('div.card.card--tight', null, stat(props));
}

export function emptyState({ title, detail, iconName = 'file', action }) {
  return h('div.empty',
    icon(iconName, { size: 32 }),
    h('h3', null, title),
    detail && h('p.small.muted', null, detail),
    action ? h('div', { style: { marginTop: '16px' } }, action) : null);
}

export function sectionTitle(text, extra) {
  return h('div.row.row--between', h('h2', null, text), extra || null);
}

/* ── people ──────────────────────────────────────────────────────────────── */

const AVATAR_HUES = [12, 42, 90, 140, 175, 205, 250, 285, 320];

export function avatar(name, { size = '' } = {}) {
  const hue = AVATAR_HUES[hash32(String(name || '')) % AVATAR_HUES.length];
  return h('span', {
    class: `avatar${size ? ` avatar--${size}` : ''}`,
    style: { background: `hsl(${hue} 46% 92%)`, color: `hsl(${hue} 52% 28%)` },
    'aria-hidden': 'true',
  }, initials(name));
}

export function badge(text, variant = '') {
  return h('span', { class: `badge${variant ? ` badge--${variant}` : ''}` }, text);
}

export function aiBadge(label = 'AI draft') {
  return h('span.badge.badge--ai', icon('sparkles', { size: 12 }), label);
}

/* ── lists & tables ──────────────────────────────────────────────────────── */

/**
 * @param {{columns: {key?: string, label: string, value?: (row:any)=>any,
 *          render?: (row:any)=>Node, numeric?: boolean}[],
 *          rows: any[], onRowClick?: (row:any)=>void, empty?: Node}} options
 */
export function table({ columns, rows, onRowClick, empty }) {
  if (!rows.length && empty) return empty;
  const body = h('tbody');
  for (const row of rows) {
    const tr = h('tr', onRowClick ? {
      'data-clickable': 'true',
      tabindex: 0,
      onClick: () => onRowClick(row),
      onKeydown: (e) => { if (e.key === 'Enter') onRowClick(row); },
    } : null);
    for (const col of columns) {
      const content = col.render ? col.render(row)
        : col.value ? col.value(row)
        : row[col.key];
      tr.appendChild(h('td', { class: col.numeric ? 'num' : '' }, content == null ? '—' : content));
    }
    body.appendChild(tr);
  }
  return h('div.table-wrap',
    h('table.data',
      h('thead', h('tr', ...columns.map((c) => h('th', { class: c.numeric ? 'num' : '' }, c.label)))),
      body));
}

/** @param {{leading?: Node, title: any, meta?: any, trailing?: Node, onClick?: () => void}} item */
export function listItem({ leading, title, meta, trailing, onClick }) {
  const tag = onClick ? 'button.list__item' : 'div.list__item';
  return h(tag, onClick ? { type: 'button', onClick } : null,
    leading || null,
    h('div.list__body',
      h('div.list__title', null, title),
      meta ? h('div.list__meta', null, meta) : null),
    trailing || null);
}

export function list(items) {
  return h('div.list', ...items);
}

/* ── charts (SVG-free, CSS bars — fast and legible at any size) ──────────── */

/** @param {{label: string, value: number}[]} data */
export function barChart(data, { format = (v) => v } = {}) {
  const max = Math.max(1, ...data.map((d) => d.value));
  return h('div', { style: { paddingBottom: '22px' } },
    h('div.bars', ...data.map((d) => h('div', {
      class: `bars__bar${d.value === max ? ' bars__bar--peak' : ''}`,
      style: { height: `${Math.max(4, (d.value / max) * 100)}%` },
      title: `${d.label}: ${format(d.value)}`,
    }, h('span', null, d.label)))));
}

export function progress(value, max, { variant } = {}) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0;
  const tone = variant || (pct >= 100 ? 'danger' : pct >= 90 ? 'warn' : '');
  return h('div.progress', { role: 'progressbar', 'aria-valuenow': Math.round(pct), 'aria-valuemin': 0, 'aria-valuemax': 100 },
    h('div', { class: `progress__bar${tone ? ` progress__bar--${tone}` : ''}`, style: { width: `${pct}%` } }));
}

/* ── forms ───────────────────────────────────────────────────────────────── */

/**
 * A labelled control. `control` is any input node; the label is wired to it.
 * @param {{label: string, control: HTMLElement, help?: string, error?: string, full?: boolean}} options
 */
export function field({ label, control, help, error, full = false }) {
  const id = control.id || `f_${Math.random().toString(36).slice(2, 9)}`;
  control.id = id;
  if (error) control.setAttribute('aria-invalid', 'true');
  return h('div', { class: `field${full ? ' field--full' : ''}` },
    h('label.field__label', { for: id }, label),
    control,
    help && !error ? h('span.field__help', null, help) : null,
    error ? h('span.field__error', { role: 'alert' }, error) : null);
}

export function input(props = {}) {
  return h('input.input', { type: 'text', ...props });
}

export function textarea(props = {}) {
  return h('textarea.textarea', props, props.value || '');
}

/** @param {{options: (string|{value: string, label: string})[], value?: string}} props */
export function select({ options, value, ...props }) {
  const el = h('select.select', props);
  for (const option of options) {
    const opt = typeof option === 'string' ? { value: option, label: option } : option;
    el.appendChild(h('option', { value: opt.value, selected: opt.value === value }, opt.label));
  }
  el.value = value == null ? '' : value;
  return el;
}

export function checkbox({ label, checked, onChange, ...props }) {
  return h('label.checkbox',
    h('input', { type: 'checkbox', checked: !!checked, onChange: (e) => onChange && onChange(e.target.checked), ...props }),
    h('span', null, label));
}

export function searchField({ placeholder = 'Search…', value = '', onInput }) {
  return h('div.search-input',
    icon('search', { size: 16 }),
    h('input.input', {
      type: 'search', placeholder, value,
      'aria-label': placeholder,
      onInput: (e) => onInput && onInput(e.target.value),
    }));
}

/** Segmented control — the tab pattern used across modules. */
export function segmented({ options, value, onChange }) {
  const el = h('div.segmented', { role: 'tablist' });
  for (const option of options) {
    const opt = typeof option === 'string' ? { value: option, label: option } : option;
    el.appendChild(h('button', {
      type: 'button',
      role: 'tab',
      'aria-pressed': String(opt.value === value),
      'aria-selected': String(opt.value === value),
      onClick: () => onChange(opt.value),
    }, opt.label));
  }
  return el;
}

export function chips({ options, selected = [], onToggle }) {
  return h('div.chip-list', ...options.map((option) => {
    const opt = typeof option === 'string' ? { value: option, label: option } : option;
    return h('button.chip', {
      type: 'button',
      'aria-pressed': String(selected.includes(opt.value)),
      onClick: () => onToggle(opt.value),
    }, opt.label);
  }));
}

/** Comma-separated text ⇄ array, for `list` fields. */
export function tagInput({ value = [], placeholder = 'Add, separated, by commas', onChange }) {
  return input({
    value: (value || []).join(', '),
    placeholder,
    onChange: (e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean)),
  });
}

/* ── overlays ────────────────────────────────────────────────────────────── */

let openModals = 0;

/**
 * @param {{title: string, body: Node|Node[], actions?: Node[], wide?: boolean,
 *          onClose?: () => void}} options
 * @returns {{close: () => void, element: HTMLElement}}
 */
export function modal({ title, body, actions = [], wide = false, onClose }) {
  const previouslyFocused = document.activeElement;
  const close = () => {
    backdrop.remove();
    document.removeEventListener('keydown', onKey, true);
    openModals = Math.max(0, openModals - 1);
    if (!openModals) document.body.style.removeProperty('overflow');
    if (previouslyFocused && previouslyFocused.focus) previouslyFocused.focus();
    if (onClose) onClose();
  };

  const onKey = (e) => {
    if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
    if (e.key !== 'Tab') return;
    // Focus trap: a modal that leaks focus to the page behind it is unusable
    // with a keyboard and invisible to a screen reader.
    const focusable = panel.querySelectorAll('a[href], button:not([disabled]), input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])');
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  };

  const panel = h('div', { class: `modal${wide ? ' modal--wide' : ''}`, role: 'dialog', 'aria-modal': 'true', 'aria-label': title },
    h('div.modal__head',
      h('h2', null, title),
      h('div.spacer'),
      h('button.icon-btn', { type: 'button', 'aria-label': 'Close', onClick: close }, icon('x', { size: 18 }))),
    h('div.modal__body', ...(Array.isArray(body) ? body : [body])),
    actions.length ? h('div.modal__foot', ...actions) : null);

  const backdrop = h('div.modal-backdrop', {
    onMousedown: (e) => { if (e.target === backdrop) close(); },
  }, panel);

  document.body.appendChild(backdrop);
  document.body.style.overflow = 'hidden';
  openModals += 1;
  document.addEventListener('keydown', onKey, true);
  const firstInput = panel.querySelector('input, select, textarea, button:not([aria-label="Close"])');
  if (firstInput) setTimeout(() => firstInput.focus(), 40);

  return { close, element: panel };
}

/**
 * A modal wrapping a form. Resolves with the values, or null if cancelled.
 * @param {{title: string, fields: Node[], submitLabel?: string, wide?: boolean,
 *          onSubmit: (form: HTMLFormElement) => any}} options
 */
export function formModal({ title, fields, submitLabel = 'Save', wide = false, onSubmit, danger = false }) {
  const form = h('form.stack', { onSubmit: (e) => { e.preventDefault(); submit(); } }, ...fields);
  const errorBox = h('div.field__error', { role: 'alert', style: { display: 'none' } });
  form.appendChild(errorBox);

  // The footer sits outside the <form> (it is sticky), so the button cannot
  // rely on native submission — it calls the same handler Enter does.
  const submitBtn = h('button', {
    class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`,
    type: 'button',
    onClick: () => submit(),
  }, submitLabel);
  const cancelBtn = h('button.btn', { type: 'button', onClick: () => ref.close() }, 'Cancel');

  async function submit() {
    submitBtn.disabled = true;
    errorBox.style.display = 'none';
    try {
      const result = await onSubmit(form);
      if (result !== false) ref.close();
    } catch (err) {
      errorBox.textContent = err.message || String(err);
      errorBox.style.display = '';
    } finally {
      submitBtn.disabled = false;
    }
  }

  const ref = modal({ title, body: form, wide, actions: [cancelBtn, submitBtn] });
  return ref;
}

/** @returns {Promise<boolean>} */
export function confirm({ title, message, confirmLabel = 'Confirm', danger = false }) {
  return new Promise((resolve) => {
    let settled = false;
    const done = (value) => { if (!settled) { settled = true; resolve(value); } };
    const ref = modal({
      title,
      body: h('p.muted', null, message),
      onClose: () => done(false),
      actions: [
        h('button.btn', { type: 'button', onClick: () => { done(false); ref.close(); } }, 'Cancel'),
        h('button', { class: `btn ${danger ? 'btn--danger' : 'btn--primary'}`, onClick: () => { done(true); ref.close(); } }, confirmLabel),
      ],
    });
  });
}

let toastHost = null;

/** @param {string} message @param {{variant?: 'ok'|'danger'|'', timeout?: number}} [opts] */
export function toast(message, { variant = '', timeout = 4200 } = {}) {
  if (!toastHost) {
    toastHost = h('div.toasts', { role: 'status', 'aria-live': 'polite' });
    document.body.appendChild(toastHost);
  }
  const el = h('div', { class: `toast${variant ? ` toast--${variant}` : ''}` },
    h('span', null, message),
    h('button', { type: 'button', 'aria-label': 'Dismiss', onClick: () => el.remove() }, '×'));
  toastHost.appendChild(el);
  if (timeout) setTimeout(() => el.remove(), timeout);
  return el;
}

/* ── AI presentation ─────────────────────────────────────────────────────── */

/**
 * Renders an AI result with its provenance visible. Nothing generated leaves
 * this component without the badge attached.
 *
 * @param {{result: {text: string, model: string, source: string, createdAt: string},
 *          actions?: Node[]}} options
 */
export function aiOutput({ result, actions = [] }) {
  return h('div.ai-output',
    h('div.ai-output__head',
      aiBadge(result.source === 'model' ? `AI draft · ${result.model}` : 'Drafted on this device'),
      h('span.tiny.subtle', null, relativeTime(result.createdAt)),
      h('div.spacer'),
      ...actions),
    h('div.prose', null, result.text),
    result.sources && result.sources.length
      ? h('p.tiny.subtle', { style: { marginTop: '12px' } },
        `Drawn from ${result.sources.length} church record${result.sources.length === 1 ? '' : 's'}.`)
      : null,
    h('p.tiny.subtle', { style: { marginTop: '8px' } },
      'Read it before you send it. Shepherd assists preparation; it does not replace it.'));
}

/* ── misc helpers ────────────────────────────────────────────────────────── */

export function metaLine(...parts) {
  return parts.filter(Boolean).join(' · ');
}

export function dateBadge(value) {
  return h('span.badge', null, formatDate(value));
}

export function whenLabel(value) {
  return `${formatDateTime(value)} · ${relativeTime(value)}`;
}

export function lockedNotice(what = 'This information') {
  return h('div.locked',
    icon('lock', { size: 18 }),
    h('div', null,
      h('div', { style: { fontWeight: 550 } }, `${what} is encrypted`),
      h('p.small.muted', null, 'Your account cannot open it. Ask a church administrator to grant access.')));
}

export function preview(text, max = 140) {
  return truncate(text, max);
}

/** Replace a container's contents — used by modules that re-render in place. */
export { render, frag, h, icon };
