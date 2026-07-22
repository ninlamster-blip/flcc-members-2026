// Tulong — OFW Support Center: emergency lines, government agencies,
// support organizations, church contacts, and a private document vault.
import { getState, addDocument, deleteDocument } from './state.js';
import { escapeHtml, friendlyDate, compressImageFile } from './utils.js';

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
      <h2 class="oc-section-title">Aking mga dokumento <span class="oc-muted">· my documents</span></h2>
      <p class="oc-setting-sub" style="margin-bottom:10px">Passport, visa, kontrata — kunin ang litrato para andito kahit kailan mo kailanganin, kahit walang internet. Nananatili lang ito sa device mo, hindi ipinapadala kahit saan.</p>
      <input type="file" id="oc-doc-input" accept="image/*" hidden>
      <input type="text" id="oc-doc-name" class="oc-text-input" maxlength="60" placeholder="e.g. Passport, Visa, Kontrata">
      <button type="button" class="oc-ghost-btn" id="oc-doc-pick" style="margin-top:8px;width:100%">📷 Kumuha ng litrato ng dokumento</button>
      <div id="oc-doc-list" class="oc-doc-list" style="margin-top:12px"></div>
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

  setupDocumentVault();
  renderDocuments();
}

// ── Document vault (SAFETY pillar) ───────────────────────────────────────────
// Higher resolution/quality than a casual chat photo (js/companion.js's
// compressImageFile call) — a document needs to stay legible if someone
// ever has to read fine print off it later, not just look presentable.
const DOC_MAX_DIM = 1600;
const DOC_QUALITY = 0.75;

function setupDocumentVault() {
  const pickBtn = document.getElementById('oc-doc-pick');
  const fileInput = document.getElementById('oc-doc-input');
  const nameInput = document.getElementById('oc-doc-name');

  pickBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    try {
      const image = await compressImageFile(file, DOC_MAX_DIM, DOC_QUALITY);
      addDocument({ name: nameInput.value, image });
      nameInput.value = '';
      fileInput.value = '';
      renderDocuments();
    } catch {
      // Unreadable/corrupt file — fail quiet, they can just try again.
      fileInput.value = '';
    }
  });

  document.getElementById('oc-doc-viewer-close').addEventListener('click', () => {
    document.getElementById('oc-doc-viewer').hidden = true;
  });
}

function openDocumentViewer(doc) {
  document.getElementById('oc-doc-viewer-title').textContent = doc.name;
  document.getElementById('oc-doc-viewer-img').src = doc.image;
  document.getElementById('oc-doc-viewer').hidden = false;
}

function renderDocuments() {
  const list = document.getElementById('oc-doc-list');
  const docs = getState().documents;
  if (!docs.length) {
    list.innerHTML = '<div class="oc-muted">Wala pang naka-save na dokumento.</div>';
    return;
  }
  list.innerHTML = docs.map((d) => `
    <div class="oc-doc-item" data-doc="${d.id}">
      <img class="oc-doc-thumb" src="${escapeHtml(d.image)}" alt="">
      <div class="oc-doc-meta">
        <div class="oc-doc-name">${escapeHtml(d.name)}</div>
        <div class="oc-doc-date">${friendlyDate(d.dateAdded)}</div>
      </div>
      <button type="button" class="oc-entry-delete" data-delete-doc="${d.id}" aria-label="Delete ${escapeHtml(d.name)}">✕</button>
    </div>`).join('');

  list.querySelectorAll('[data-delete-doc]').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      if (!confirm('Delete this document forever?')) return;
      deleteDocument(btn.dataset.deleteDoc);
      renderDocuments();
    });
  });

  list.querySelectorAll('[data-doc]').forEach((el) => {
    el.addEventListener('click', () => {
      const doc = getState().documents.find((d) => d.id === el.dataset.doc);
      if (doc) openDocumentViewer(doc);
    });
  });
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
