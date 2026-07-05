/**
 * BlessingCard — renders today's revealed content (scripture, prayer,
 * encouragement, devotional, reflection, challenge, etc.) plus the Grace
 * Coins / Faith XP reward chips, with rarity-driven glow/border styling.
 */
(function (global) {
  'use strict';
  const { el, escapeHtml, animateCount } = global.DB_UTILS;

  function bodyFor(primary) {
    const d = primary.data;
    switch (primary.type) {
      case 'scripture':
        return el('div', { class: 'blessing-body' }, [
          el('p', { class: 'blessing-quote' }, [`“${d.text}”`]),
          el('p', { class: 'blessing-reference' }, [d.reference]),
          el('a', {
            class: 'blessing-link',
            href: `https://www.biblegateway.com/passage/?search=${encodeURIComponent(d.reference)}&version=ESV`,
            target: '_blank',
            rel: 'noopener noreferrer'
          }, ['Read Full Chapter'])
        ]);
      case 'prayer':
        return el('div', { class: 'blessing-body' }, [
          el('p', { class: 'blessing-quote blessing-quote--prayer' }, [d.text])
        ]);
      case 'encouragement':
        return el('div', { class: 'blessing-body' }, [
          el('p', { class: 'blessing-quote blessing-quote--large' }, [d.text])
        ]);
      case 'devotional':
        return el('div', { class: 'blessing-body' }, [
          el('h3', { class: 'blessing-subtitle' }, [d.title]),
          el('p', { class: 'blessing-reference' }, [d.verse]),
          el('p', { class: 'blessing-paragraph' }, [d.body]),
          el('p', { class: 'blessing-application' }, [d.application])
        ]);
      case 'reflection':
        return el('div', { class: 'blessing-body' }, [
          el('p', { class: 'blessing-quote' }, [d.question])
        ]);
      case 'challenge':
        return el('div', { class: 'blessing-body' }, [
          el('p', { class: 'blessing-paragraph' }, [d.prompt])
        ]);
      case 'historicalFact':
        return el('div', { class: 'blessing-body' }, [
          el('p', { class: 'blessing-paragraph' }, [d.text])
        ]);
      case 'worshipSong':
        return el('div', { class: 'blessing-body' }, [
          el('h3', { class: 'blessing-subtitle' }, [d.title]),
          el('p', { class: 'blessing-paragraph' }, [d.note])
        ]);
      case 'pastorMessage':
      case 'announcement':
        return el('div', { class: 'blessing-body' }, [
          el('p', { class: 'blessing-paragraph' }, [d.text])
        ]);
      default:
        return el('div', { class: 'blessing-body' });
    }
  }

  function render(reward) {
    const card = el('section', {
      class: `blessing-card rarity-${reward.rarity}`,
      role: 'dialog',
      'aria-label': reward.primary.label
    }, [
      el('p', { class: 'blessing-eyebrow' }, [reward.primary.label]),
      bodyFor(reward.primary),
      el('div', { class: 'blessing-rewards' }, [
        el('div', { class: 'reward-chip reward-chip--coin' }, [
          el('span', { class: 'reward-chip-icon reward-chip-icon--coin', 'aria-hidden': 'true' }),
          el('span', { class: 'reward-chip-label' }, [
            '+', el('span', { class: 'reward-count', id: 'coin-count' }, ['0']), ' Grace Coins'
          ])
        ]),
        el('div', { class: 'reward-chip reward-chip--xp' }, [
          el('span', { class: 'reward-chip-icon reward-chip-icon--xp', 'aria-hidden': 'true' }),
          el('span', { class: 'reward-chip-label' }, [
            '+', el('span', { class: 'reward-count', id: 'xp-count' }, ['0']), ' Faith XP'
          ])
        ])
      ]),
      reward.characterCard ? el('div', { class: 'blessing-character-callout' }, [
        el('p', { class: 'blessing-character-callout-label' }, ['You collected a card']),
        global.DB_CHARCARD.render(reward.characterCard, { flipped: false, size: 'small' })
      ]) : null,
      el('button', { class: 'btn-primary blessing-card-close', id: 'blessing-close', type: 'button' }, ['Amen'])
    ]);
    return card;
  }

  function animateRewards(card, reward) {
    const coinNode = card.querySelector('#coin-count');
    const xpNode = card.querySelector('#xp-count');
    let lastCoinTick = 0;
    animateCount(coinNode, 0, reward.coins, 900, (v) => {
      if (global.DB_AUDIO && v - lastCoinTick >= Math.max(1, Math.round(reward.coins / 8))) {
        lastCoinTick = v;
        global.DB_AUDIO.playTick();
      }
    });
    setTimeout(() => animateCount(xpNode, 0, reward.xp, 700), 250);
  }

  global.DB_BLESSCARD = { render, animateRewards };
})(window);
