/**
 * Utils — small DOM/formatting helpers shared across components and pages.
 */
(function (global) {
  'use strict';

  function el(tag, attrs, children) {
    const node = document.createElement(tag);
    Object.entries(attrs || {}).forEach(([k, v]) => {
      if (k === 'class') node.className = v;
      else if (k === 'html') node.innerHTML = v;
      else if (k.startsWith('on') && typeof v === 'function') node.addEventListener(k.slice(2), v);
      else if (v !== null && v !== undefined) node.setAttribute(k, v);
    });
    (children || []).forEach((c) => {
      if (c === null || c === undefined) return;
      node.appendChild(typeof c === 'string' ? document.createTextNode(c) : c);
    });
    return node;
  }

  function prefersReducedMotion() {
    const override = global.DB_SAVE && global.DB_SAVE.data.settings.reducedMotion;
    if (override !== null && override !== undefined) return override;
    return global.matchMedia && global.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }

  function escapeHtml(str) {
    const div = document.createElement('div');
    div.textContent = str == null ? '' : String(str);
    return div.innerHTML;
  }

  /** Animates a number rolling from `from` to `to` inside `node`, calling `onTick` per frame. */
  function animateCount(node, from, to, duration, onTick) {
    if (prefersReducedMotion() || to === from) {
      node.textContent = to.toLocaleString();
      return;
    }
    const start = performance.now();
    function frame(now) {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      const value = Math.round(from + (to - from) * eased);
      node.textContent = value.toLocaleString();
      if (onTick) onTick(value, t);
      if (t < 1) requestAnimationFrame(frame);
    }
    requestAnimationFrame(frame);
  }

  function initials(name) {
    if (!name) return 'FL';
    return name.trim().split(/\s+/).slice(0, 2).map((w) => w[0].toUpperCase()).join('');
  }

  global.DB_UTILS = { el, prefersReducedMotion, escapeHtml, animateCount, initials };
})(window);
