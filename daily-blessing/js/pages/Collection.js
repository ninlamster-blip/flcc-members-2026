/**
 * Collection — the monthly "Heroes of Faith" bookshelf of Bible Character
 * Cards, Apple-Wallet-pass style, flippable for owned cards.
 */
(function (global) {
  'use strict';
  const { el } = global.DB_UTILS;

  const Collection = {
    render(container) {
      const App = global.DB_APP;
      const meta = App.content.characterCollection;
      const characters = App.content.characters;
      const owned = App.save.data.collection.owned;
      const collectedCount = characters.filter((c) => owned[c.id]).length;
      const pct = Math.round((collectedCount / characters.length) * 100);

      const page = el('div', { class: 'page page-collection' }, [
        el('header', { class: 'page-header' }, [
          el('p', { class: 'page-eyebrow' }, [meta.month]),
          el('h1', {}, [meta.title]),
          el('p', { class: 'page-subtitle' }, [meta.description]),
          el('div', { class: 'progress-track', role: 'progressbar', 'aria-valuenow': String(pct), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Collection completion' }, [
            el('div', { class: 'progress-fill', style: `width:${pct}%` })
          ]),
          el('p', { class: 'progress-caption' }, [`${collectedCount} of ${characters.length} collected`])
        ]),
        el('div', { class: 'char-card-shelf' }, characters.map((c) => global.DB_CHARCARD.render(c)))
      ]);
      container.appendChild(page);

      if (collectedCount === characters.length) {
        page.appendChild(el('div', { class: 'collection-complete-banner' }, [
          'Collection complete — an exclusive badge has been added to your Profile.'
        ]));
        const badges = App.save.data.profile.badges;
        if (!badges.includes(`collection-${meta.month.toLowerCase()}`)) {
          badges.push(`collection-${meta.month.toLowerCase()}`);
          App.save.save();
        }
      }
    }
  };

  global.DB_PAGES = global.DB_PAGES || {};
  global.DB_PAGES.collection = Collection;
})(window);
