/**
 * Profile — avatar, level, currencies, badges, and journey stats, plus a
 * small settings section (name, sound, reduced motion override).
 */
(function (global) {
  'use strict';
  const { el, initials } = global.DB_UTILS;

  const MILESTONE_LABELS = { 7: 'One Week Journey', 14: 'Two Week Journey', 30: '30 Day Journey', 50: '50 Day Journey', 100: '100 Day Journey', 365: 'One Year Journey' };

  function badgeList(profile, streak) {
    const items = [];
    streak.milestonesSeen.forEach((m) => items.push(MILESTONE_LABELS[m] || `${m} Day Journey`));
    (profile.badges || []).forEach((b) => {
      if (b.startsWith('collection-')) items.push(`${b.replace('collection-', '')[0].toUpperCase()}${b.replace('collection-', '').slice(1)} Collection Complete`);
    });
    const rare = profile.rareBlessingCounts || {};
    if (rare.legendary) items.push(`${rare.legendary} Legendary Blessing${rare.legendary > 1 ? 's' : ''}`);
    if (rare.miracle) items.push(`${rare.miracle} Miracle Blessing${rare.miracle > 1 ? 's' : ''}`);
    return items;
  }

  const Profile = {
    render(container) {
      const App = global.DB_APP;
      const profile = App.save.data.profile;
      const streak = App.streakInfo();
      const badges = badgeList(profile, streak);
      const recent = App.save.data.history.timeline.slice(0, 6);
      const xpIntoLevel = profile.xp % 100;

      const page = el('div', { class: 'page page-profile' }, [
        el('header', { class: 'profile-header' }, [
          el('div', { class: 'profile-avatar', 'aria-hidden': 'true' }, [initials(profile.name)]),
          el('h1', { class: 'profile-name' }, [profile.name || 'Church Member']),
          el('p', { class: 'profile-level' }, [`Faith Journey · Level ${profile.level}`]),
          el('div', { class: 'progress-track progress-track--small', role: 'progressbar', 'aria-valuenow': String(xpIntoLevel), 'aria-valuemin': '0', 'aria-valuemax': '100', 'aria-label': 'Progress to next level' }, [
            el('div', { class: 'progress-fill', style: `width:${xpIntoLevel}%` })
          ])
        ]),
        el('section', { class: 'profile-stats' }, [
          el('div', { class: 'stat-tile' }, [el('span', { class: 'stat-value' }, [String(profile.coins)]), el('span', { class: 'stat-label' }, ['Grace Coins'])]),
          el('div', { class: 'stat-tile' }, [el('span', { class: 'stat-value' }, [String(profile.xp)]), el('span', { class: 'stat-label' }, ['Faith XP'])]),
          el('div', { class: 'stat-tile' }, [el('span', { class: 'stat-value' }, [String(streak.current)]), el('span', { class: 'stat-label' }, ['Journey Days'])]),
          el('div', { class: 'stat-tile' }, [el('span', { class: 'stat-value' }, [String(profile.bibleReadingDays)]), el('span', { class: 'stat-label' }, ['Bible Reading Days'])]),
          el('div', { class: 'stat-tile' }, [el('span', { class: 'stat-value' }, [String(profile.prayerDays)]), el('span', { class: 'stat-label' }, ['Prayer Days'])])
        ]),
        el('section', { class: 'profile-section' }, [
          el('h2', { class: 'section-title' }, ['Badges']),
          badges.length
            ? el('div', { class: 'badge-row' }, badges.map((b) => el('span', { class: 'badge-pill' }, [b])))
            : el('p', { class: 'empty-state' }, ['Your first badge is waiting on your journey ahead.'])
        ]),
        el('section', { class: 'profile-section' }, [
          el('h2', { class: 'section-title' }, ['Recent Achievements']),
          recent.length
            ? el('ul', { class: 'timeline-list' }, recent.map((r) => el('li', { class: 'timeline-item' }, [r.label])))
            : el('p', { class: 'empty-state' }, ['Nothing yet — open today’s blessing to begin.'])
        ]),
        el('section', { class: 'profile-section profile-settings' }, [
          el('h2', { class: 'section-title' }, ['Settings']),
          el('label', { class: 'field-label', for: 'profile-name-input' }, ['Your Name']),
          el('input', { class: 'field-input', id: 'profile-name-input', type: 'text', value: profile.name, placeholder: 'Enter your name', maxlength: '40' }),
          el('div', { class: 'settings-row' }, [
            el('label', { class: 'field-label', for: 'sound-toggle' }, ['Sound']),
            el('input', { id: 'sound-toggle', type: 'checkbox', class: 'toggle-input', checked: global.DB_AUDIO.isEnabled() ? 'checked' : null })
          ]),
          el('div', { class: 'settings-row' }, [
            el('label', { class: 'field-label', for: 'motion-toggle' }, ['Reduce Motion']),
            el('input', { id: 'motion-toggle', type: 'checkbox', class: 'toggle-input', checked: App.save.data.settings.reducedMotion ? 'checked' : null })
          ])
        ])
      ]);
      container.appendChild(page);

      page.querySelector('#profile-name-input').addEventListener('change', (e) => {
        profile.name = e.target.value.trim().slice(0, 40);
        App.save.save();
      });
      page.querySelector('#sound-toggle').addEventListener('change', (e) => global.DB_AUDIO.setEnabled(e.target.checked));
      page.querySelector('#motion-toggle').addEventListener('change', (e) => {
        App.save.data.settings.reducedMotion = e.target.checked;
        App.save.save();
      });
    }
  };

  global.DB_PAGES = global.DB_PAGES || {};
  global.DB_PAGES.profile = Profile;
})(window);
