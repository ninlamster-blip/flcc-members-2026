/**
 * Shared module helpers.
 *
 * Every module edits records that are already described by the schema, so the
 * forms are generated from it: one definition, one editor, no drift between
 * what the database validates and what the form asks for. Modules override
 * individual controls where a purpose-built one is better (lyrics, minutes,
 * money), and get the rest for free.
 */

import { h, icon } from '../core/dom.js';
import {
  field, input, textarea, select, checkbox, tagInput, formModal, confirm, toast, badge, avatar,
} from '../core/ui.js';
import { collectionDef, blank, COLLECTIONS } from '../core/schema.js';
import { formatDate, formatMoney, isoDate } from '../core/format.js';
import { ValidationError } from '../core/db.js';
import { PermissionError } from '../core/rbac.js';

/** Human name for a referenced record. */
export function refLabel(db, collection, id) {
  if (!id) return '';
  const doc = db.find(collection, id);
  if (!doc) return '';
  const def = COLLECTIONS[collection];
  return String(doc[def.titleField] || doc.name || doc.title || id);
}

export function memberName(db, id, fallback = 'Unassigned') {
  return refLabel(db, 'members', id) || fallback;
}

export function refOptions(db, collection, { allowEmpty = true, emptyLabel = '—' } = {}) {
  const def = COLLECTIONS[collection];
  const options = db.all(collection)
    .map((doc) => ({ value: doc.id, label: String(doc[def.titleField] || doc.id) }))
    .sort((a, b) => a.label.localeCompare(b.label));
  return allowEmpty ? [{ value: '', label: emptyLabel }, ...options] : options;
}

/**
 * A control for one schema field.
 * @returns {{control: HTMLElement, read: () => any, spec: object}}
 */
export function schemaControl(ctx, collection, name, value) {
  const spec = collectionDef(collection).fields[name];
  const db = ctx.db;

  switch (spec.type) {
    case 'text': {
      const control = textarea({ value: value || '' });
      return { control, spec, read: () => control.value };
    }
    case 'bool': {
      let checked = !!value;
      const control = checkbox({ label: spec.label, checked, onChange: (v) => { checked = v; } });
      return { control, spec, read: () => checked, inlineLabel: true };
    }
    case 'enum': {
      const control = select({
        options: (spec.required ? [] : [{ value: '', label: '—' }])
          .concat((spec.options || []).map((o) => ({ value: o, label: sentence(o) }))),
        value: value ?? spec.default ?? '',
      });
      return { control, spec, read: () => control.value || null };
    }
    case 'ref': {
      const control = select({ options: refOptions(db, spec.ref), value: value || '' });
      return { control, spec, read: () => control.value || null };
    }
    case 'list': {
      if (spec.ref) {
        const control = multiSelect(db, spec.ref, value || []);
        return { control, spec, read: () => control.read() };
      }
      let items = Array.isArray(value) ? value : [];
      const control = tagInput({ value: items, onChange: (next) => { items = next; } });
      return { control, spec, read: () => items };
    }
    case 'number':
      return numeric(value, spec, 1);
    case 'money':
      return numeric(value, spec, 0.001);
    case 'date': {
      const control = input({ type: 'date', value: value ? isoDate(value) : '' });
      return { control, spec, read: () => control.value || null };
    }
    case 'datetime': {
      const control = input({ type: 'datetime-local', value: value ? toLocalInput(value) : '' });
      return { control, spec, read: () => (control.value ? new Date(control.value).toISOString() : null) };
    }
    case 'object': {
      const control = textarea({ value: value ? JSON.stringify(value, null, 2) : '' });
      return { control, spec, read: () => (control.value.trim() ? JSON.parse(control.value) : null) };
    }
    default: {
      const control = input({ value: value == null ? '' : String(value), required: !!spec.required });
      return { control, spec, read: () => control.value.trim() || null };
    }
  }
}

function numeric(value, spec, step) {
  const control = input({ type: 'number', step, value: value == null ? '' : value, inputmode: 'decimal' });
  return { control, spec, read: () => (control.value === '' ? null : Number(control.value)) };
}

function toLocalInput(value) {
  const date = new Date(value);
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function sentence(text) {
  const str = String(text || '').replace(/[-_]/g, ' ');
  return str.charAt(0).toUpperCase() + str.slice(1);
}

/** Multi-select built from checkboxes — clearer than a native multiple select. */
function multiSelect(db, collection, selected) {
  const chosen = new Set(selected);
  const def = COLLECTIONS[collection];
  const box = h('div', {
    style: { maxHeight: '180px', overflowY: 'auto', border: '1px solid var(--border)', borderRadius: '8px', padding: '8px' },
  });
  const docs = db.all(collection).sort((a, b) =>
    String(a[def.titleField]).localeCompare(String(b[def.titleField])));
  if (!docs.length) box.appendChild(h('p.small.subtle', null, 'Nothing to choose from yet.'));
  for (const doc of docs) {
    box.appendChild(checkbox({
      label: String(doc[def.titleField]),
      checked: chosen.has(doc.id),
      onChange: (on) => (on ? chosen.add(doc.id) : chosen.delete(doc.id)),
    }));
  }
  box.read = () => [...chosen];
  return box;
}

/**
 * Open a create/edit modal for a record, generated from the schema.
 *
 * @param {object} ctx
 * @param {{collection: string, doc?: object|null, title?: string,
 *          fields?: string[], hidden?: string[], defaults?: object,
 *          wide?: boolean, onSaved?: (doc: object) => void}} options
 */
export function openRecordModal(ctx, {
  collection, doc = null, title, fields, hidden = [], defaults = {}, wide = true, onSaved,
}) {
  const def = collectionDef(collection);
  const editing = !!doc;
  const source = doc || blank(collection, defaults);
  const names = (fields || Object.keys(def.fields)).filter((name) => !hidden.includes(name));

  const controls = names.map((name) => {
    const built = schemaControl(ctx, collection, name, source[name]);
    const node = built.inlineLabel
      ? h('div.field', built.control)
      : field({
        label: built.spec.label + (built.spec.required ? ' *' : ''),
        control: built.control,
        help: built.spec.help,
        full: ['text', 'object'].includes(built.spec.type) || built.spec.type === 'list',
      });
    return { name, built, node };
  });

  return formModal({
    title: title || `${editing ? 'Edit' : 'New'} ${def.label.replace(/s$/, '').toLowerCase()}`,
    submitLabel: editing ? 'Save changes' : 'Create',
    wide,
    fields: [h('div.form-grid', ...controls.map((c) => c.node))],
    onSubmit: async () => {
      const patch = {};
      for (const { name, built } of controls) patch[name] = built.read();
      try {
        const saved = editing
          ? ctx.db.update(collection, doc.id, patch)
          : ctx.db.insert(collection, { ...source, ...patch });
        await ctx.db.flush();
        toast(`${def.label.replace(/s$/, '')} saved.`, { variant: 'ok' });
        if (onSaved) onSaved(saved);
        ctx.refresh();
        return saved;
      } catch (err) {
        throw friendly(err);
      }
    },
  });
}

/** Turn internal errors into something a church secretary can act on. */
export function friendly(err) {
  if (err instanceof ValidationError) return new Error(err.message);
  if (err instanceof PermissionError) return new Error(err.message);
  if (err && err.name === 'StorageQuotaError') return new Error(err.message);
  return err;
}

/** Delete with a confirmation that names what is going. */
export async function deleteRecord(ctx, collection, id, label) {
  const def = collectionDef(collection);
  const ok = await confirm({
    title: `Delete ${label || def.label.toLowerCase()}?`,
    message: 'It disappears from every list. The audit log keeps a record that it existed and who removed it.',
    confirmLabel: 'Delete',
    danger: true,
  });
  if (!ok) return false;
  try {
    ctx.db.remove(collection, id);
    await ctx.db.flush();
    toast('Deleted.');
    ctx.refresh();
    return true;
  } catch (err) {
    toast(friendly(err).message, { variant: 'danger' });
    return false;
  }
}

/** The standard "＋ New …" button, hidden when the user cannot write. */
export function newButton(ctx, resource, label, onClick) {
  if (!ctx.can(`${resource}:write`)) return null;
  return h('button.btn.btn--primary', { onClick }, icon('plus', { size: 16 }), label);
}

export function iconButton(name, label, onClick, { danger = false } = {}) {
  return h('button', {
    class: `icon-btn${danger ? ' btn--danger' : ''}`,
    type: 'button',
    'aria-label': label,
    title: label,
    onClick,
  }, icon(name, { size: 16 }));
}

/** A person row: avatar, name, meta. Used in every people-facing list. */
export function personRow(db, memberId, meta) {
  const member = db.find('members', memberId);
  const name = member ? member.fullName : 'Unknown';
  return h('div.row',
    avatar(name, { size: 'sm' }),
    h('div', { style: { minWidth: 0 } },
      h('div.truncate', { style: { fontSize: '.875rem', fontWeight: '500' } }, name),
      meta ? h('div.tiny.subtle.truncate', null, meta) : null));
}

export const STATUS_TONES = {
  open: '', 'in-progress': 'info', done: 'ok', dropped: '',
  planning: 'warn', confirmed: 'info', cancelled: 'danger',
  draft: '', approved: 'ok', sent: 'ok', recorded: '', 'pending-approval': 'warn', rejected: 'danger',
  answered: 'ok', praying: 'info', closed: '',
  visitor: 'info', regular: '', member: 'ok', inactive: 'warn', transferred: '',
  idea: '', drafting: 'warn', ready: 'info', preached: 'ok',
  urgent: 'danger', priority: 'danger', watch: 'warn', normal: '', low: '',
};

/** Badge tone for a computed ministry health score (see core/ai.js ministryHealthScore). */
export function healthTone(score) {
  return score >= 90 ? 'ok' : score >= 75 ? 'accent' : score >= 60 ? 'warn' : 'danger';
}

export function statusBadge(value) {
  if (!value) return null;
  return badge(sentence(value), STATUS_TONES[value] ?? '');
}

/** "12 Feb · Friday Worship" style meta lines. */
export function dateMeta(value, ...rest) {
  return [formatDate(value), ...rest.filter(Boolean)].join(' · ');
}

export function money(value) {
  return formatMoney(value);
}

/** Filter helper: case-insensitive contains across several fields. */
export function matches(doc, query, fields) {
  if (!query) return true;
  const needle = query.toLowerCase();
  return fields.some((f) => String(doc[f] == null ? '' : doc[f]).toLowerCase().includes(needle));
}

/** Re-render one container without touching the rest of the page. */
export function localRender(container, build) {
  const draw = () => {
    container.textContent = '';
    const node = build(draw);
    if (node) container.appendChild(node);
  };
  draw();
  return container;
}
