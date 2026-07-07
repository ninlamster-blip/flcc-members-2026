// Kapwa — safe community: fellowship groups, values, off-day connection.
// Deliberately NOT social media: no likes, no followers, no feeds.
import { escapeHtml } from './utils.js';

export function initCommunity(context) {
  const { biblestudy, resources } = context;
  const body = document.getElementById('oc-community-body');

  body.innerHTML = `
    <div class="oc-card">
      <h2 class="oc-section-title">How this community works</h2>
      <ul class="oc-values-list">
        ${biblestudy.communityValues.map((v) => `<li>${escapeHtml(v)}</li>`).join('')}
      </ul>
    </div>

    <div class="oc-card">
      <h2 class="oc-section-title">Fellowship groups</h2>
      ${biblestudy.groups.map((g) => `
        <div class="oc-group">
          <div class="oc-group-icon" aria-hidden="true">${g.icon}</div>
          <div>
            <div class="oc-group-name">${escapeHtml(g.name)}</div>
            <div class="oc-group-detail">${escapeHtml(g.detail)}</div>
            <div class="oc-group-meets">${escapeHtml(g.meets)}</div>
          </div>
        </div>`).join('')}
      <p class="oc-muted" style="margin-top:10px">To join a group, message your church contact or ask in the FLCC members app — a real person will welcome you in.</p>
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
}
