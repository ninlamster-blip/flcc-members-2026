/**
 * Community — "Today's Church Journey" progress ring. There is no backend
 * yet, so the count is a stable-per-day placeholder (see App.communityProgress)
 * that already reflects whether *you* opened today's blessing.
 */
(function (global) {
  'use strict';
  const { el } = global.DB_UTILS;

  function ring(pct) {
    const size = 200;
    const stroke = 14;
    const r = (size - stroke) / 2;
    const c = 2 * Math.PI * r;
    const offset = c - (pct / 100) * c;
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', `0 0 ${size} ${size}`);
    svg.setAttribute('class', 'progress-ring');
    svg.setAttribute('aria-hidden', 'true');
    svg.innerHTML = `
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="progress-ring-track" stroke-width="${stroke}" fill="none" />
      <circle cx="${size / 2}" cy="${size / 2}" r="${r}" class="progress-ring-fill" stroke-width="${stroke}" fill="none"
        stroke-dasharray="${c}" stroke-dashoffset="${c}" transform="rotate(-90 ${size / 2} ${size / 2})" />
    `;
    requestAnimationFrame(() => {
      const fill = svg.querySelector('.progress-ring-fill');
      fill.style.transition = global.DB_UTILS.prefersReducedMotion() ? 'none' : 'stroke-dashoffset 1.1s ease';
      requestAnimationFrame(() => { fill.setAttribute('stroke-dashoffset', String(offset)); });
    });
    return svg;
  }

  const Community = {
    render(container) {
      const App = global.DB_APP;
      const progress = App.communityProgress();
      const pct = Math.round((progress.opened / progress.total) * 100);

      const page = el('div', { class: 'page page-community' }, [
        el('header', { class: 'page-header' }, [
          el('h1', {}, ['Today’s Church Journey']),
          el('p', { class: 'page-subtitle' }, [`${progress.opened} of ${progress.total} members opened today's blessing.`])
        ]),
        el('div', { class: 'community-ring-wrap' }, [
          ring(pct),
          el('div', { class: 'community-ring-label' }, [
            el('span', { class: 'community-ring-pct' }, [`${pct}%`]),
            el('span', { class: 'community-ring-caption' }, ['together today'])
          ])
        ]),
        progress.complete ? el('p', { class: 'community-complete' }, ['Every member of the church family opened today’s blessing. What a beautiful day.']) : null
      ]);
      container.appendChild(page);
    }
  };

  global.DB_PAGES = global.DB_PAGES || {};
  global.DB_PAGES.community = Community;
})(window);
