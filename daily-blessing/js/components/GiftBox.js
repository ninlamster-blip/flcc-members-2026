/**
 * GiftBox — renders the premium gift box and orchestrates the opening
 * sequence (blur, zoom, lid lift, light, particles). Purely CSS/DOM driven,
 * no image assets. Respects prefers-reduced-motion by collapsing the
 * sequence to a brief, calm fade.
 */
(function (global) {
  'use strict';
  const { el, prefersReducedMotion } = global.DB_UTILS;

  function render({ opened, isFriday, seasonId }) {
    const classes = ['giftbox'];
    if (isFriday) classes.push('giftbox--gold');
    if (seasonId) classes.push(`giftbox--${seasonId}`);
    if (opened) classes.push('giftbox--opened');

    return el('div', { class: 'giftbox-stage' }, [
      el('div', { class: classes.join(' '), id: 'giftbox', role: 'img', 'aria-label': opened ? "Today's blessing box, already opened" : "Today's blessing box, waiting to be opened" }, [
        el('div', { class: 'giftbox-glow' }),
        el('div', { class: 'giftbox-lid' }, [
          el('div', { class: 'giftbox-lid-band' }),
          el('div', { class: 'giftbox-lid-bow' })
        ]),
        el('div', { class: 'giftbox-body' }, [
          el('div', { class: 'giftbox-band-v' }),
          el('div', { class: 'giftbox-shine' })
        ]),
        el('div', { class: 'giftbox-shimmer' })
      ]),
      el('div', { class: 'giftbox-particles', id: 'giftbox-particles', 'aria-hidden': 'true' }),
      el('div', { class: 'giftbox-beam', 'aria-hidden': 'true' })
    ]);
  }

  function spawnParticles(container, count) {
    for (let i = 0; i < count; i++) {
      const p = el('span', { class: 'particle' });
      const left = 30 + Math.random() * 40;
      const drift = (Math.random() - 0.5) * 60;
      const delay = Math.random() * 0.5;
      const dur = 1.4 + Math.random() * 0.8;
      p.style.left = `${left}%`;
      p.style.setProperty('--drift', `${drift}px`);
      p.style.animationDelay = `${delay}s`;
      p.style.animationDuration = `${dur}s`;
      container.appendChild(p);
      setTimeout(() => p.remove(), (delay + dur) * 1000 + 200);
    }
  }

  /** Runs the opening animation inside `stageEl` (as produced by render()). Resolves when the reveal is ready. */
  function playOpen(stageEl) {
    const box = stageEl.querySelector('#giftbox');
    const particles = stageEl.querySelector('#giftbox-particles');
    const reduced = prefersReducedMotion();

    if (global.DB_AUDIO) global.DB_AUDIO.playOpen();

    if (reduced) {
      stageEl.classList.add('is-opening', 'is-lifting');
      box.classList.add('giftbox--opened');
      return new Promise((resolve) => setTimeout(resolve, 350));
    }

    return new Promise((resolve) => {
      stageEl.classList.add('is-opening');
      setTimeout(() => {
        stageEl.classList.add('is-lifting');
        box.classList.add('giftbox--opened');
        spawnParticles(particles, 16);
      }, 500);
      setTimeout(() => resolve(), 2400);
    });
  }

  global.DB_GIFTBOX = { render, playOpen };
})(window);
