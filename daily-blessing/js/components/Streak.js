/**
 * Streak — the "N Day Journey" flame badge and milestone celebrations.
 * Framed as a spiritual journey rather than a game streak.
 */
(function (global) {
  'use strict';
  const { el } = global.DB_UTILS;

  const MILESTONES = [7, 14, 30, 50, 100, 365];

  function render(days) {
    return el('div', { class: 'streak-badge', role: 'status', 'aria-label': `${days} day journey` }, [
      el('span', { class: 'streak-flame', 'aria-hidden': 'true' }),
      el('span', { class: 'streak-count' }, [String(days)]),
      el('span', { class: 'streak-label' }, [days === 1 ? 'Day Journey' : 'Day Journey'])
    ]);
  }

  /** Returns the milestone number if `days` just crossed one and it hasn't been celebrated yet, else null. */
  function checkNewMilestone(days) {
    const save = global.DB_SAVE;
    const seen = save.data.streak.milestonesSeen;
    const hit = MILESTONES.find((m) => m === days && !seen.includes(m));
    if (!hit) return null;
    seen.push(hit);
    save.save();
    return hit;
  }

  function showCelebration(days) {
    if (global.DB_AUDIO) global.DB_AUDIO.playCelebrate();
    const overlay = el('div', { class: 'celebration-overlay', role: 'dialog', 'aria-modal': 'true', 'aria-label': `${days} day journey milestone` }, [
      el('div', { class: 'celebration-card' }, [
        el('div', { class: 'celebration-artwork' }),
        el('p', { class: 'celebration-eyebrow' }, ['Milestone Reached']),
        el('h2', { class: 'celebration-title' }, [`${days} Day Journey`]),
        el('p', { class: 'celebration-body' }, ['Thank you for walking with Christ, one faithful day at a time.']),
        el('button', { class: 'btn-primary', id: 'celebration-close', type: 'button' }, ['Continue'])
      ])
    ]);
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
    const close = () => { overlay.classList.remove('is-visible'); setTimeout(() => overlay.remove(), 300); };
    overlay.querySelector('#celebration-close').addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }

  global.DB_STREAK = { MILESTONES, render, checkNewMilestone, showCelebration };
})(window);
