/**
 * CharacterCard — Apple-Wallet-pass-style collectible for a Bible
 * character. No portrait images are shipped; the "portrait" is a soft
 * monogram emblem generated in CSS from the character's initial.
 */
(function (global) {
  'use strict';
  const { el } = global.DB_UTILS;

  function render(character, opts) {
    opts = opts || {};
    const owned = !!(global.DB_SAVE.data.collection.owned[character.id]);
    const classes = ['char-card', `char-card--${(character.difficulty || 'common').toLowerCase()}`];
    if (opts.size === 'small') classes.push('char-card--small');
    if (!owned && !opts.forceOwned) classes.push('char-card--locked');

    const locked = !owned && !opts.forceOwned;
    const card = el('div', {
      class: classes.join(' '),
      tabindex: '0',
      role: 'button',
      'aria-label': locked ? 'Not yet collected card' : `${character.name} card, tap to flip`
    }, [
      el('div', { class: 'char-card-inner' }, [
        el('div', { class: 'char-card-face char-card-front' }, [
          el('div', { class: 'char-card-emblem' }, [locked ? '?' : character.name[0]]),
          el('p', { class: 'char-card-name' }, [locked ? 'Not Yet Collected' : character.name]),
          el('p', { class: 'char-card-role' }, [locked ? '' : character.role]),
          el('span', { class: 'char-card-difficulty' }, [locked ? '' : character.difficulty])
        ]),
        el('div', { class: 'char-card-face char-card-back' }, [
          el('p', { class: 'char-card-era' }, [character.era]),
          el('p', { class: 'char-card-verse' }, [character.verse]),
          el('p', { class: 'char-card-fact' }, [character.fact])
        ])
      ])
    ]);

    if (owned || opts.forceOwned) {
      const toggle = () => card.classList.toggle('is-flipped');
      card.addEventListener('click', toggle);
      card.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); toggle(); }
      });
    }

    return card;
  }

  global.DB_CHARCARD = { render };
})(window);
