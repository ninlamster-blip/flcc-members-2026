// Kapwa — safe community: fellowship groups, values, off-day connection.
// Deliberately NOT social media: no likes, no followers, no feeds. The
// Community Brain (see js/agent-brain.js for the full five-brain map),
// paired with prayerchain.js (Kadena ng Panalangin).
import { escapeHtml } from './utils.js';
import { getState, toggleGroupInterest } from './state.js';

let goTo = () => {};

export function initCommunity(context) {
  const { biblestudy, resources } = context;
  goTo = context.goTo;
  const body = document.getElementById('oc-community-body');

  body.innerHTML = `
    <div class="oc-card" id="oc-prayer-chain"></div>

    <div class="oc-card" id="oc-testimonies"></div>

    <div class="oc-card">
      <h2 class="oc-section-title">How this community works</h2>
      <ul class="oc-values-list">
        ${biblestudy.communityValues.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}
      </ul>
    </div>

    <div class="oc-card">
      <h2 class="oc-section-title">Fellowship groups</h2>
      <div id="oc-fellowship-groups"></div>
      <p class="oc-muted" style="margin-top:10px">To join a group, message your fellowship leader — a real person will welcome you in.</p>
    </div>

    <div class="oc-card">
      <h2 class="oc-section-title">${escapeHtml(resources.offday.title)}</h2>
      <p class="oc-muted" style="margin-bottom:8px">${escapeHtml(resources.offday.note)}</p>
      ${resources.offday.ideas.map((idea) => `
        <div class="oc-idea">
          <span class="oc-idea-icon" aria-hidden="true">${idea.icon}</span>
          <div>
            <div class="oc-idea-title">${escapeHtml(idea.title)}</div>
            <div class="oc-idea-detail">${escapeHtml(idea.detail)}</div>
          </div>
        </div>`).join('')}
    </div>`;

  renderFellowshipGroups(biblestudy.groups);
}

// Rendered into its own #oc-fellowship-groups mount point (not the whole
// #oc-community-body) so tapping "I'm interested" doesn't wipe out
// #oc-prayer-chain/#oc-testimonies, which prayerchain.js/testimonies.js
// render into independently and don't re-render on their own.
function renderFellowshipGroups(groups) {
  const wrap = document.getElementById('oc-fellowship-groups');
  const interested = new Set(getState().interestedGroups);

  wrap.innerHTML = groups.map((g) => {
    const isInterested = interested.has(g.name);
    return `
      <div class="oc-group">
        <div class="oc-group-icon" aria-hidden="true">${g.icon}</div>
        <div style="flex:1">
          <div class="oc-group-name">${escapeHtml(g.name)}</div>
          <div class="oc-group-detail">${escapeHtml(g.detail)}</div>
          <div class="oc-group-meets">${escapeHtml(g.meets)}</div>
          ${isInterested ? `<p class="oc-muted" style="margin-top:6px">💌 Nakatala ang interes mo. <a href="#" data-goto-tulong>Tingnan ang church contact sa Tulong</a> para makipag-ugnayan.</p>` : ''}
        </div>
        <button type="button" class="oc-ghost-btn oc-group-interest-btn${isInterested ? ' is-interested' : ''}" data-group-interest="${escapeHtml(g.name)}" style="white-space:nowrap;align-self:center">
          ${isInterested ? '💌 Interesado ✓' : '💌 Interesado ako'}
        </button>
      </div>`;
  }).join('');

  wrap.querySelectorAll('[data-group-interest]').forEach((btn) => {
    btn.addEventListener('click', () => {
      navigator.vibrate?.(8);
      toggleGroupInterest(btn.dataset.groupInterest);
      renderFellowshipGroups(groups);
    });
  });

  wrap.querySelectorAll('[data-goto-tulong]').forEach((a) => {
    a.addEventListener('click', (evt) => {
      evt.preventDefault();
      goTo('support');
    });
  });
}
