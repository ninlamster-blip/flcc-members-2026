// Tulong — OFW Support Center: emergency lines, government agencies,
// support organizations, and church contacts.
import { escapeHtml } from './utils.js';

export function initSupport(context) {
  const { resources } = context;
  const body = document.getElementById('oc-support-body');

  const renderResource = (r) => {
    const inner = `
      <div class="oc-resource-name">${escapeHtml(r.name)}${r.url && r.url.startsWith('http') ? ' <span class="oc-ext">↗</span>' : ''}</div>
      <div class="oc-resource-detail">${escapeHtml(r.detail)}</div>
      <div class="oc-resource-contact">${escapeHtml(r.contact)}</div>`;
    return r.url
      ? `<a class="oc-resource" href="${escapeHtml(r.url)}" ${r.url.startsWith('http') ? 'target="_blank" rel="noopener noreferrer"' : ''}>${inner}</a>`
      : `<div class="oc-resource">${inner}</div>`;
  };

  body.innerHTML = `
    <div class="oc-emergency-card">
      <div class="oc-emergency-title">🆘 ${escapeHtml(resources.emergency.title)}</div>
      <p class="oc-emergency-note">${escapeHtml(resources.emergency.note)}</p>
    </div>

    <div class="oc-card">
      <h2 class="oc-section-title">Someone to talk to, right now</h2>
      ${resources.emergency.crisis.map(renderResource).join('')}
    </div>

    <div class="oc-card">
      <h2 class="oc-section-title">Philippine government services</h2>
      ${resources.government.map(renderResource).join('')}
    </div>

    <div class="oc-card">
      <h2 class="oc-section-title">Support organizations</h2>
      ${resources.support.map(renderResource).join('')}
    </div>

    <div class="oc-card">
      <h2 class="oc-section-title">Church family</h2>
      ${resources.church.map(renderResource).join('')}
    </div>

    <p class="oc-support-disclaimer">Numbers and services can change — please verify locally. If a number here is outdated, tell your church admin so it can be corrected for everyone.</p>`;
}

// Crisis sheet content is drawn from the same directory so the numbers only
// need updating in one place (data/resources.json).
export function renderCrisisLines(resources) {
  const wrap = document.getElementById('oc-crisis-lines');
  wrap.innerHTML = resources.emergency.crisis.map((r) => `
    <a class="oc-crisis-line" href="${escapeHtml(r.url)}" target="_blank" rel="noopener noreferrer">
      <div class="oc-crisis-line-name">${escapeHtml(r.name)}</div>
      <div class="oc-crisis-line-contact">${escapeHtml(r.contact)}</div>
      <div class="oc-crisis-line-detail">${escapeHtml(r.detail)}</div>
    </a>`).join('');
}
