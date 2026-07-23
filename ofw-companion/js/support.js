// Tulong — OFW Support Center: emergency lines, government agencies,
// support organizations, church contacts, and a private document vault.
import { getState, addDocument, updateDocument, deleteDocument } from './state.js';
import { escapeHtml, friendlyDate, compressImageFile, daysBetween, todayKey } from './utils.js';
import { isConnected, analyzeDocument } from './ai.js';

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
      const name = nameInput.value;
      const id = addDocument({ name, image });
      nameInput.value = '';
      fileInput.value = '';
      renderDocuments();
      readDocumentExpiry(id, image, name);
    } catch {
      // Unreadable/corrupt file — fail quiet, they can just try again.
      fileInput.value = '';
    }
  });

  document.getElementById('oc-doc-viewer-close').addEventListener('click', () => {
    document.getElementById('oc-doc-viewer').hidden = true;
  });
}

// Fire-and-forget: reads the just-added photo for an expiry date so the
// Agent Brain (see js/agent-brain.js's document-expiring-soon rule) can warn
// ahead of time. Runs after the document already shows in the list — no
// spinner, no blocking the upload flow — and fails silently offline or on a
// blurry photo, since a missing expiry date is just a document with nothing
// to remind about, not a broken feature.
async function readDocumentExpiry(id, image, name) {
  if (!isConnected()) return;
  try {
    const { expiryDate } = await analyzeDocument(image, name);
    if (expiryDate) {
      updateDocument(id, { expiryDate });
      renderDocuments();
    }
  } catch { /* offline or AI error — the document is still saved either way */ }
}

function openDocumentViewer(doc) {
  document.getElementById('oc-doc-viewer-title').textContent = doc.name;
  document.getElementById('oc-doc-viewer-img').src = doc.image;
  document.getElementById('oc-doc-viewer').hidden = false;
}

// A document within 30 days of (or past) its expiry is called out in the
// list itself, not just in the Agent Brain's home-screen nudge — someone
// scrolling through Tulong should see it too, since that's exactly where
// they'd come to check.
function expiryLineHtml(d) {
  if (!d.expiryDate) return '';
  const days = daysBetween(todayKey(), d.expiryDate);
  const urgent = days <= 30;
  const label = days < 0
    ? `Nag-expire na noong ${friendlyDate(d.expiryDate)}`
    : days === 0
      ? 'Nag-e-expire ngayon'
      : `Mag-e-expire: ${friendlyDate(d.expiryDate)} (${days} araw)`;
  return `<div class="oc-doc-expiry${urgent ? ' oc-doc-expiry-urgent' : ''}">${escapeHtml(label)}</div>`;
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
        ${expiryLineHtml(d)}
      </div>
      <button type="button" class="oc-entry-edit" data-edit-doc="${d.id}" aria-label="Edit ${escapeHtml(d.name)}">✎</button>
      <button type="button" class="oc-entry-delete" data-delete-doc="${d.id}" aria-label="Delete ${escapeHtml(d.name)}">✕</button>
    </div>`).join('');

  list.querySelectorAll('[data-edit-doc]').forEach((btn) => {
    btn.addEventListener('click', (evt) => {
      evt.stopPropagation();
      const doc = getState().documents.find((d) => d.id === btn.dataset.editDoc);
      if (!doc) return;
      const name = prompt('Anong uri ng dokumento ito?', doc.name);
      if (name === null) return; // cancelled
      updateDocument(doc.id, { name });
      renderDocuments();
    });
  });

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
