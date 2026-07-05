/**
 * Home — greeting, the gift box, and the opening → reveal flow.
 */
(function (global) {
  'use strict';
  const { el } = global.DB_UTILS;

  function renderOverlay() {
    const overlay = el('div', { class: 'card-overlay', id: 'card-overlay', hidden: 'hidden' }, []);
    return overlay;
  }

  function openCard(overlay, reward, ctaBtn) {
    overlay.innerHTML = '';
    const card = global.DB_BLESSCARD.render(reward);
    overlay.appendChild(card);
    overlay.hidden = false;
    document.body.classList.add('scroll-locked');
    requestAnimationFrame(() => overlay.classList.add('is-visible'));
    if (global.DB_AUDIO) global.DB_AUDIO.playReveal(reward.rarity);
    global.DB_BLESSCARD.animateRewards(card, reward);

    const closeBtn = card.querySelector('#blessing-close');
    closeBtn.focus();
    const close = () => {
      overlay.classList.remove('is-visible');
      document.body.classList.remove('scroll-locked');
      setTimeout(() => { overlay.hidden = true; overlay.innerHTML = ''; }, 250);
      ctaBtn.focus();
    };
    closeBtn.addEventListener('click', close);
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); }, { once: true });
    return close;
  }

  const Home = {
    render(container) {
      const App = global.DB_APP;
      const name = App.save.data.profile.name;
      const greeting = `${global.DateUtils.greetingWord()}${name ? ', ' + name : ''}`;
      const streak = App.streakInfo();
      const today = App.todayState();
      const isFriday = App.context.isFriday;
      const season = App.context.season;

      const page = el('div', { class: 'page page-home' + (season ? ' ' + season.themeClass : '') }, [
        el('header', { class: 'home-header' }, [
          el('div', {}, [
            el('h1', { class: 'home-greeting' }, [greeting]),
            el('p', { class: 'home-subtitle' }, [
              isFriday ? 'A special blessing for Church Friday.' : 'Every day is a new opportunity to walk with Christ.'
            ])
          ]),
          global.DB_STREAK.render(streak.current)
        ]),
        el('div', { class: 'home-stage-wrap' }, [
          global.DB_GIFTBOX.render({ opened: today.opened, isFriday, seasonId: season && season.id }),
          el('button', {
            class: 'btn-primary btn-large',
            id: 'open-cta',
            type: 'button'
          }, [today.opened ? "View Today's Blessing" : "Open Today's Blessing"])
        ])
      ]);

      const overlay = renderOverlay();
      container.appendChild(page);
      container.appendChild(overlay);

      const ctaBtn = page.querySelector('#open-cta');
      const stage = page.querySelector('.giftbox-stage');

      ctaBtn.addEventListener('click', async () => {
        if (global.DB_AUDIO) global.DB_AUDIO.playTap();
        if (App.hasOpenedToday()) {
          openCard(overlay, App.todayState().reward, ctaBtn);
          return;
        }
        ctaBtn.disabled = true;
        document.body.classList.add('scene-blurred');
        await global.DB_GIFTBOX.playOpen(stage);
        document.body.classList.remove('scene-blurred');
        const streakBefore = App.streakInfo().current;
        App.claimToday();
        ctaBtn.textContent = "View Today's Blessing";
        ctaBtn.disabled = false;
        const close = openCard(overlay, App.todayState().reward, ctaBtn);
        const newStreak = App.streakInfo().current;
        const milestone = global.DB_STREAK.checkNewMilestone(newStreak);
        if (milestone) {
          const originalClose = close;
          overlay.querySelector('#blessing-close').addEventListener('click', () => {
            setTimeout(() => global.DB_STREAK.showCelebration(milestone), 350);
          }, { once: true });
        }
        void streakBefore;
        // Refresh streak badge in place without a full re-render.
        const badge = page.querySelector('.streak-badge');
        badge.replaceWith(global.DB_STREAK.render(App.streakInfo().current));
      });
    }
  };

  global.DB_PAGES = global.DB_PAGES || {};
  global.DB_PAGES.home = Home;
})(window);
