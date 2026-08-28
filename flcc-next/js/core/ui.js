// The component kit. Everything is a poster, an action, or a piece of type.

import { h, clear, navIcon } from './dom.js';
import { symbol, fillFor, toneFor } from './art.js';

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

/** An illustration, sized for its poster and filled to sit on the colour. */
export function art(name, { tone = 'paper', size = '', title = '' } = {}) {
  const wrap = h('div', { class: 'art', dataset: size ? { size } : {} });
  wrap.innerHTML = symbol(name, { fill: fillFor(tone), title });
  return wrap;
}

export function go(text, onclick) {
  return h('button', { class: 'go', type: 'button', onclick }, text);
}

export function pill(text, onclick, { quiet = false, ...rest } = {}) {
  return h('button', { class: 'pill', type: 'button', onclick, ...(quiet ? { 'data-quiet': '' } : {}), ...rest }, text);
}

export function track(percent) {
  const value = Math.max(0, Math.min(100, Math.round(percent)));
  return h('div', { class: 'track', role: 'progressbar', 'aria-valuenow': value, 'aria-valuemin': '0', 'aria-valuemax': '100' },
    h('i', { style: `width:${value}%` }));
}

export function choice(text, onclick, props = {}) {
  return h('button', { class: 'choice', type: 'button', onclick, ...props }, text);
}

export function note(text) { return h('p', { class: 'note', text }); }
export function waiting() { return h('div', { class: 'wait', role: 'status', 'aria-label': 'Loading' }); }

/** Posters arrive as you scroll. They do not bounce. */
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
 * A full-screen moment: a streak milestone, a finished journey, a game result.
 * One headline, one line, one way out. It is the only interruption the app has.
 */
export function moment({ tone = 'cream', eyebrow = '', big, line = '', action = 'Keep going', onclose }) {
  const screen = h('div', { class: 'moment', role: 'dialog', 'aria-modal': 'true', style: `background:var(--${tone})` },
    eyebrow ? label(eyebrow) : null,
    h('p', { class: 'display', text: big }),
    line ? h('p', { class: 'lead dim', text: line }) : null,
    h('div', { style: 'margin-top:auto' }, pill(action, () => { screen.remove(); if (onclose) onclose(); })));
  document.body.appendChild(screen);
  screen.querySelector('.pill').focus();
  return screen;
}

let toastTimer = null;
export function toast(message) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', role: 'status', 'aria-live': 'polite',
      style: 'position:fixed;left:50%;transform:translateX(-50%);bottom:calc(5.5rem + env(safe-area-inset-bottom));z-index:50;background:#161616;color:#F7F5F0;padding:.7rem 1.2rem;border-radius:99px;font-size:.85rem;font-weight:600;max-width:90vw;text-align:center' });
    document.body.appendChild(el);
  }
  el.textContent = message;
  el.hidden = false;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { el.hidden = true; }, 2600);
}

export { h, clear, navIcon, toneFor, symbol };
