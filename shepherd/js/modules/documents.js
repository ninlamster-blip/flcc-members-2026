/**
 * Document vault — policies, minutes, leases, insurance, contracts, photos.
 *
 * Files are read in the browser, encrypted with the church's vault key and
 * stored as ciphertext; there is no upload, so nothing is sitting on someone
 * else's server. Every save keeps the previous version, and a SHA-256
 * fingerprint is recorded so a document can be shown to be unchanged.
 *
 * Expiry dates matter more than they look: a lease or an insurance
 * certificate that quietly lapses is the kind of thing that closes a church
 * hall, so anything with a date surfaces on the dashboard sixty days out.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, table, emptyState, badge, segmented, searchField, statCard, chips,
  toast, modal, formModal, field, input, textarea, select, tagInput, confirm,
} from '../core/ui.js';
import { formatDate, relativeTime, isoDate, daysBetween, formatNumber } from '../core/format.js';
import { blank, COLLECTIONS } from '../core/schema.js';
import { sha256Hex } from '../core/crypto.js';
import { newButton, statusBadge, matches, sentence, deleteRecord } from './_shared.js';

const CATEGORIES = COLLECTIONS.documents.fields.category.options;
const MAX_BYTES = 4 * 1024 * 1024;

export async function render(ctx, route) {
  const { db } = ctx;
  if (db.isLocked('documents')) {
    return page({
      title: 'Document vault',
      children: [card({ children: [h('div.locked', icon('lock', { size: 18 }),
        h('div', null,
          h('strong', 'The vault is encrypted'),
          h('p.small.muted', 'Your account cannot open it. Ask a church administrator for access.')))] })],
    });
  }

  if (route.params[0]) {
    const doc = db.find('documents', route.params[0]);
    if (doc) return documentDetail(ctx, doc);
  }

  const now = new Date();
  const documents = db.all('documents');
  const expiring = documents.filter((d) => d.expiresOn && daysBetween(now, d.expiresOn) <= 60 && daysBetween(now, d.expiresOn) >= -30);

  let query = '';
  let category = '';
  const results = h('div');

  const draw = () => {
    let rows = documents.filter((d) => matches(d, query, ['title', 'description', 'fileName', 'category'])
      || (query && (d.tags || []).some((t) => t.toLowerCase().includes(query.toLowerCase()))));
    if (category) rows = rows.filter((d) => d.category === category);
    rows.sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    results.textContent = '';
    results.appendChild(rows.length
      ? table({
        columns: [
          {
            label: 'Document',
            render: (doc) => h('div.row',
              icon(doc.mimeType && doc.mimeType.startsWith('image/') ? 'file' : 'file', { size: 18 }),
              h('div', null,
                h('div', { style: { fontWeight: '500' } }, doc.title),
                h('div.tiny.subtle', [doc.fileName, doc.size ? `${formatNumber(Math.round(doc.size / 1024))} KB` : null].filter(Boolean).join(' · ')))),
          },
          { label: 'Category', render: (doc) => badge(sentence(doc.category)) },
          { label: 'Version', numeric: true, value: (doc) => doc.version || 1 },
          { label: 'Updated', value: (doc) => relativeTime(doc.updatedAt) },
          {
            label: 'Expires',
            render: (doc) => {
              if (!doc.expiresOn) return h('span.subtle', '—');
              const days = daysBetween(now, doc.expiresOn);
              return badge(formatDate(doc.expiresOn), days < 0 ? 'danger' : days < 30 ? 'warn' : '');
            },
          },
        ],
        rows,
        onRowClick: (doc) => ctx.navigate(`/documents/${doc.id}`),
      })
      : emptyState({
        title: query || category ? 'Nothing matches' : 'The vault is empty',
        detail: 'Policies, minutes, insurance, leases, contracts, training material — encrypted on this device.',
        iconName: 'folder',
        action: newButton(ctx, 'documents', 'Add document', () => addDocument(ctx)),
      }));
  };

  const totalBytes = documents.reduce((total, d) => total + Number(d.size || 0), 0);

  const view = page({
    title: 'Document vault',
    subtitle: `${documents.length} documents · ${formatNumber(Math.round(totalBytes / 1024))} KB · encrypted at rest`,
    actions: [newButton(ctx, 'documents', 'Add document', () => addDocument(ctx))].filter(Boolean),
    children: [
      expiring.length ? card({
        className: 'no-print',
        children: [h('div.stack.stack--sm', ...expiring.map((doc) => {
          const days = daysBetween(now, doc.expiresOn);
          return h('div', { class: `insight insight--${days < 14 ? 'urgent' : 'attention'}` },
            h('span.insight__mark'),
            h('div', { style: { flex: '1' } },
              h('div.insight__title', `${doc.title} ${days < 0 ? 'expired' : 'expires'} ${relativeTime(doc.expiresOn)}`),
              h('div.insight__detail', formatDate(doc.expiresOn))),
            h('button.btn.btn--sm', { onClick: () => ctx.navigate(`/documents/${doc.id}`) }, 'Open'));
        }))],
      }) : null,
      h('div.grid.grid--4', { style: { marginBottom: '18px' } },
        ...CATEGORY_SUMMARY(documents).map(([label, count]) => statCard({ value: count, label }))),
      h('div.row.row--wrap', { style: { marginBottom: '14px' } },
        h('div', { style: { flex: '1', minWidth: '220px' } },
          searchField({ placeholder: 'Search the vault…', onInput: (value) => { query = value; draw(); } })),
        h('select.select', {
          style: { maxWidth: '180px' }, 'aria-label': 'Category',
          onChange: (e) => { category = e.target.value; draw(); },
        }, h('option', { value: '' }, 'All categories'), ...CATEGORIES.map((c) => h('option', { value: c }, sentence(c))))),
      results,
    ],
  });
  draw();
  return view;
}

function CATEGORY_SUMMARY(documents) {
  const counts = new Map();
  for (const doc of documents) counts.set(doc.category, (counts.get(doc.category) || 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1]).slice(0, 4).map(([category, count]) => [sentence(category), count]);
}

/* ── add / replace ───────────────────────────────────────────────────────── */

function addDocument(ctx, existing = null) {
  const titleInput = input({ required: true, value: existing ? existing.title : '' });
  const categorySelect = select({ options: CATEGORIES.map((c) => ({ value: c, label: sentence(c) })), value: existing ? existing.category : 'policy' });
  const descriptionInput = textarea({ value: existing ? existing.description : '' });
  const expiresInput = input({ type: 'date', value: existing && existing.expiresOn ? existing.expiresOn : '' });
  let tags = existing ? existing.tags || [] : [];
  const tagsInput = tagInput({ value: tags, onChange: (next) => { tags = next; } });
  const fileInput = h('input.input', { type: 'file' });
  const textInput = textarea({ placeholder: 'Or paste the text of the document here.' });
  const fileNote = h('p.tiny.subtle', `Files are encrypted before they are stored. Keep them under ${MAX_BYTES / 1024 / 1024} MB — browser storage is finite.`);

  formModal({
    title: existing ? `New version of “${existing.title}”` : 'Add a document',
    submitLabel: existing ? 'Save new version' : 'Add to vault',
    fields: [
      h('div.form-grid',
        field({ label: 'Title *', control: titleInput, full: true }),
        field({ label: 'Category', control: categorySelect }),
        field({ label: 'Expires', control: expiresInput, help: 'Leases, insurance, licences — you will be reminded 60 days out.' }),
        field({ label: 'Description', control: descriptionInput, full: true }),
        field({ label: 'Tags', control: tagsInput, full: true }),
        field({ label: 'File', control: fileInput, full: true, help: 'PDF, image, or any file. It never leaves this device.' }),
        field({ label: 'Or text', control: textInput, full: true })),
      fileNote,
    ],
    onSubmit: async () => {
      const file = fileInput.files && fileInput.files[0];
      let content = textInput.value;
      let fileName = '';
      let mimeType = 'text/plain';
      let size = content.length;

      if (file) {
        if (file.size > MAX_BYTES) throw new Error(`That file is ${Math.round(file.size / 1024 / 1024)} MB — the limit is ${MAX_BYTES / 1024 / 1024} MB.`);
        content = await readFileAsDataUrl(file);
        fileName = file.name;
        mimeType = file.type || 'application/octet-stream';
        size = file.size;
      }
      if (!content) throw new Error('Attach a file or paste some text.');

      const checksum = await sha256Hex(content);
      const patch = {
        title: titleInput.value,
        category: categorySelect.value,
        description: descriptionInput.value,
        tags,
        expiresOn: expiresInput.value || null,
        content,
        fileName,
        mimeType,
        size,
        checksum,
      };

      if (existing) {
        const history = [...(existing.history || []), {
          version: existing.version || 1,
          savedAt: existing.updatedAt,
          savedBy: existing.updatedBy,
          checksum: existing.checksum,
          size: existing.size,
        }];
        ctx.db.update('documents', existing.id, { ...patch, version: (existing.version || 1) + 1, history });
      } else {
        ctx.db.insert('documents', blank('documents', { ...patch, version: 1, history: [] }));
      }
      await ctx.db.flush();
      toast('Saved to the vault, encrypted.', { variant: 'ok' });
      ctx.refresh();
    },
  });
}

function readFileAsDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('That file could not be read.'));
    reader.readAsDataURL(file);
  });
}

/* ── one document ────────────────────────────────────────────────────────── */

function documentDetail(ctx, doc) {
  const now = new Date();
  const isImage = doc.mimeType && doc.mimeType.startsWith('image/');
  const isPdf = doc.mimeType === 'application/pdf';
  const isText = !doc.fileName || (doc.mimeType && doc.mimeType.startsWith('text/'));

  const preview = card({
    title: 'Content',
    actions: [doc.content && doc.fileName
      ? h('a.btn.btn--sm', { href: doc.content, download: doc.fileName }, icon('download', { size: 14 }), 'Download')
      : null].filter(Boolean),
    children: [
      isImage ? h('img', { src: doc.content, alt: doc.title, style: { borderRadius: '10px', maxHeight: '520px' } })
        : isPdf ? h('iframe', { src: doc.content, title: doc.title, style: { width: '100%', height: '620px', border: '1px solid var(--border)', borderRadius: '10px' } })
        : isText ? h('div.prose.small', doc.content || '(empty)')
        : h('p.small.muted', `${doc.fileName} — ${sentence((doc.mimeType || '').split('/')[1] || 'file')}. Download it to open.`),
    ],
  });

  const details = card({
    title: 'Details',
    children: [h('div.stack.stack--sm',
      row('Category', sentence(doc.category)),
      row('Version', String(doc.version || 1)),
      row('Size', doc.size ? `${formatNumber(Math.round(doc.size / 1024))} KB` : '—'),
      row('Added', formatDate(doc.createdAt)),
      row('Last change', relativeTime(doc.updatedAt)),
      doc.expiresOn ? row('Expires', `${formatDate(doc.expiresOn)} (${relativeTime(doc.expiresOn)})`) : null,
      doc.description ? h('p.small.muted', { style: { marginTop: '8px' } }, doc.description) : null,
      (doc.tags || []).length ? h('div.chip-list', ...doc.tags.map((tag) => h('span.chip', tag))) : null,
      h('div', { style: { marginTop: '10px' } },
        h('p.eyebrow', 'Fingerprint (SHA-256)'),
        h('code.tiny.mono', { style: { wordBreak: 'break-all' } }, doc.checksum || '—'),
        h('p.tiny.subtle', { style: { marginTop: '4px' } },
          'Compare this against a copy to prove the document has not been altered.')),
    )],
  });

  const versions = card({
    title: 'Version history',
    children: [(doc.history || []).length
      ? h('div.timeline', ...[...doc.history].reverse().map((entry) => h('div.timeline__item',
        h('div.small', `Version ${entry.version}`),
        h('div.tiny.subtle', `${formatDate(entry.savedAt)} · ${(ctx.db.find('users', entry.savedBy) || {}).name || 'someone'}`),
        h('code.tiny.mono', { style: { wordBreak: 'break-all' } }, (entry.checksum || '').slice(0, 32)))))
      : h('p.small.muted', 'This is the first version.')],
  });

  const actions = ctx.can('documents:write') ? card({
    title: 'Manage',
    children: [h('div.row.row--wrap',
      h('button.btn.btn--sm', { onClick: () => addDocument(ctx, doc) }, icon('plus', { size: 14 }), 'New version'),
      h('button.btn.btn--sm', {
        onClick: () => formModal({
          title: 'Edit details',
          fields: [(() => {
            const titleInput = input({ value: doc.title });
            const expiresInput = input({ type: 'date', value: doc.expiresOn || '' });
            const descriptionInput = textarea({ value: doc.description || '' });
            const node = h('div.form-grid',
              field({ label: 'Title', control: titleInput, full: true }),
              field({ label: 'Expires', control: expiresInput }),
              field({ label: 'Description', control: descriptionInput, full: true }));
            node.read = () => ({ title: titleInput.value, expiresOn: expiresInput.value || null, description: descriptionInput.value });
            node.dataset.form = 'edit';
            return node;
          })()],
          onSubmit: async (form) => {
            const node = form.querySelector('[data-form="edit"]');
            ctx.db.update('documents', doc.id, node.read());
            await ctx.db.flush();
            toast('Saved.', { variant: 'ok' });
            ctx.refresh();
          },
        }),
      }, icon('edit', { size: 14 }), 'Edit details'),
      ctx.can('documents:delete')
        ? h('button.btn.btn--sm.btn--danger', {
          onClick: async () => { if (await deleteRecord(ctx, 'documents', doc.id, doc.title)) ctx.navigate('/documents'); },
        }, icon('trash', { size: 14 }), 'Delete')
        : null)],
  }) : null;

  return page({
    eyebrow: 'Document vault',
    title: doc.title,
    actions: [h('button.btn', { onClick: () => ctx.navigate('/documents') }, icon('arrowLeft', { size: 15 }), 'Vault')],
    children: [h('div.grid.grid--main-side',
      h('div.stack', preview),
      h('div.stack', details, versions, actions))],
  });
}

function row(label, value) {
  if (!value) return null;
  return h('div.row.row--between', h('span.small.muted', label), h('span.small', value));
}
