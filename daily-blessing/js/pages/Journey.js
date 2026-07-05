/**
 * Journey — a contribution-style heatmap of opened days plus a running
 * timeline of activity, in the spirit of Apple Journal / GitHub history.
 */
(function (global) {
  'use strict';
  const { el } = global.DB_UTILS;

  function heatmap(days) {
    const grid = el('div', { class: 'heatmap-grid', role: 'img', 'aria-label': 'Your last twelve weeks of daily blessings' });
    days.forEach((d) => {
      grid.appendChild(el('span', {
        class: `heatmap-cell${d.opened ? ' heatmap-cell--filled' : ''}`,
        title: `${d.key}${d.opened ? ' — opened' : ''}`
      }));
    });
    return grid;
  }

  function groupTimeline(entries) {
    const groups = [];
    let lastDate = null;
    entries.forEach((entry) => {
      if (entry.date !== lastDate) {
        groups.push({ date: entry.date, items: [] });
        lastDate = entry.date;
      }
      groups[groups.length - 1].items.push(entry);
    });
    return groups;
  }

  const Journey = {
    render(container) {
      const App = global.DB_APP;
      const streak = App.streakInfo();
      const groups = groupTimeline(App.save.data.history.timeline);

      const page = el('div', { class: 'page page-journey' }, [
        el('header', { class: 'page-header' }, [
          el('h1', {}, ['Your Journey']),
          el('p', { class: 'page-subtitle' }, [`${streak.current} day journey · longest ${streak.longest} days`])
        ]),
        el('section', { class: 'journey-heatmap-section' }, [
          heatmap(App.heatmapDays(84))
        ]),
        el('section', { class: 'journey-timeline' },
          groups.length ? groups.map((g) => el('div', { class: 'timeline-day' }, [
            el('h2', { class: 'timeline-date' }, [global.DateUtils.friendlyDate(g.date)]),
            el('ul', { class: 'timeline-list' }, g.items.map((it) => el('li', { class: 'timeline-item' }, [it.label])))
          ])) : [el('p', { class: 'empty-state' }, ['Open your first Daily Blessing to begin your journey.'])]
        )
      ]);
      container.appendChild(page);
    }
  };

  global.DB_PAGES = global.DB_PAGES || {};
  global.DB_PAGES.journey = Journey;
})(window);
