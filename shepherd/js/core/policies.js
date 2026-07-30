/**
 * Policies — the rules that are not simply "does this role hold this
 * permission", gathered in one place because they are the ones that matter.
 *
 * They live in core rather than inside a module for two reasons: they are
 * tested here, and a rule about who may read a counselling note should not be
 * a detail of how a profile screen happens to be drawn.
 */

import { can } from './rbac.js';

/** Default: an expense over this needs a second person. Overridden per church. */
export const DEFAULT_APPROVAL_THRESHOLD = 100;

/* ── finance ─────────────────────────────────────────────────────────────── */

/**
 * Does this entry have to go through approval before it counts as recorded?
 * @param {{kind: string, amount: number, status?: string}} tx
 * @param {number} threshold
 */
export function needsApproval(tx, threshold = DEFAULT_APPROVAL_THRESHOLD) {
  if (!tx || tx.kind !== 'expense') return false;
  if (tx.status === 'approved' || tx.status === 'rejected' || tx.status === 'pending-approval') return false;
  return Number(tx.amount || 0) > Number(threshold);
}

/**
 * Nobody approves their own spending. This is the single most common way a
 * small church's finances go wrong, and it is worth refusing outright rather
 * than leaving to a convention.
 *
 * @param {{id: string, role: string}} user
 * @param {{createdBy?: string, status?: string}} tx
 * @returns {{ok: boolean, reason?: string}}
 */
export function canApproveTransaction(user, tx) {
  if (!can(user, 'finance:approve')) {
    return { ok: false, reason: 'Your role cannot approve payments.' };
  }
  if (tx.createdBy && user && tx.createdBy === user.id) {
    return { ok: false, reason: 'You recorded this entry, so you cannot approve it. Ask another approver.' };
  }
  if (tx.status === 'approved') return { ok: false, reason: 'It is already approved.' };
  return { ok: true };
}

/* ── prayer ──────────────────────────────────────────────────────────────── */

/**
 * Prayer visibility. Three levels, and the distinction is the whole point of
 * the module: a request marked private must not surface on a wall because
 * someone happens to hold a broad role.
 *
 * @param {{id: string, role: string}} user
 * @param {{visibility?: string, createdBy?: string}} request
 */
export function canSeePrayer(user, request) {
  if (!request) return false;
  if (!can(user, 'prayer:read')) return false;
  if (request.visibility === 'private') {
    return !!(user && request.createdBy && request.createdBy === user.id);
  }
  if (request.visibility === 'leaders') {
    return can(user, 'leadership:read') || can(user, 'care:read');
  }
  return true;
}

/* ── counselling ─────────────────────────────────────────────────────────── */

/**
 * A restricted counselling note is readable by its author and by the senior
 * pastor, and by nobody else — holding `counseling:read` is necessary but not
 * sufficient.
 *
 * @param {{id: string, role: string}} user
 * @param {{restricted?: boolean, createdBy?: string}} note
 */
export function canReadCounselingNote(user, note) {
  if (!can(user, 'counseling:read')) return false;
  if (!note || !note.restricted) return true;
  if (user && note.createdBy && note.createdBy === user.id) return true;
  return !!user && user.role === 'senior_pastor';
}

/* ── knowledge ───────────────────────────────────────────────────────────── */

/**
 * Collections the knowledge centre will never draw on, for anyone. Retrieval
 * already filters by permission; this is the second, blunter rule: the most
 * sensitive records are read in their own module by the people who hold those
 * permissions, and are never summarised into an answer.
 */
export const KNOWLEDGE_EXCLUDED = ['counseling', 'transactions', 'budgets', 'projects', 'users', 'audit'];

export function knowledgeMayUse(collection) {
  return !KNOWLEDGE_EXCLUDED.includes(collection);
}

/**
 * The same list governs the global search index, so a counselling subject or a
 * gift amount cannot surface in ⌘K either. These records are found in their own
 * modules, by people who hold those permissions — not by typing a name into a
 * search box over someone's shoulder.
 */
export const NEVER_INDEXED = KNOWLEDGE_EXCLUDED;

/* ── leadership: ministry-scoped instance write ─────────────────────────── */

/**
 * `leadership:write` is a broad grant across meetings, decisions,
 * committees, goals, action items and annual plans — right for a
 * church-wide leadership role, wrong for a ministry head, who should be able
 * to touch only the two record types that actually carry a `ministryId`:
 * their own ministry's tasks and its annual plan. Meetings, decisions,
 * committees and goals have no ministry dimension in the data model (a
 * "meeting" belongs to a committee, which is a different thing from a
 * ministry by design), so there is no honest way to scope those down —
 * `ministry_head` gets `leadership:read` for them and nothing narrower.
 *
 * These are the fallback `Database.insert`/`update` checks when the coarse
 * `leadership:write` permission is absent (see `Database._assertWritable`
 * and each collection's `instanceWrite` in schema.js).
 */
export function canWriteActionItem(user, record, db) {
  if (user && user.memberId && record.ownerId === user.memberId) return true; // completing your own assignment is always yours to do
  if (!record.ministryId) return false;
  return ledMinistries(db, user).some((m) => m.id === record.ministryId);
}

export function canWriteAnnualPlan(user, record, db) {
  if (!record.ministryId) return false;
  return ledMinistries(db, user).some((m) => m.id === record.ministryId);
}

/* ── ministry workspaces ─────────────────────────────────────────────────── */

/**
 * A ministry workspace is narrower than the `leadership` permission: "runs the
 * whole leadership hub" and "leads the Worship ministry" are different
 * things. Access is: church-wide leadership roles (full access to every
 * workspace), or being the specific ministry's recorded lead.
 *
 * @param {{id: string, role: string, memberId?: string|null}} user
 * @param {{leadId?: string|null}} ministry
 */
export function canAccessMinistryWorkspace(user, ministry) {
  if (!user) return false;
  if (can(user, 'leadership:manage') || user.role === 'church_admin' || user.role === 'senior_pastor') return true;
  if (!ministry || !ministry.leadId) return false;
  return !!user.memberId && user.memberId === ministry.leadId;
}

/** Ministries a given user leads, church-wide roles aside. */
export function ledMinistries(db, user) {
  if (!user || !user.memberId) return [];
  return db.all('ministries').filter((m) => m.leadId === user.memberId);
}

/* ── documents ───────────────────────────────────────────────────────────── */

/**
 * Whether a document is close enough to expiry to nag about, and how loudly.
 * @returns {{due: boolean, days: number, severity: 'urgent'|'attention'|'info'}}
 */
export function expiryStatus(expiresOn, now = new Date()) {
  if (!expiresOn) return { due: false, days: Infinity, severity: 'info' };
  const days = Math.round((new Date(expiresOn).setHours(12, 0, 0, 0) - new Date(now).setHours(12, 0, 0, 0)) / 864e5);
  return {
    due: days <= 60,
    days,
    severity: days < 14 ? 'urgent' : days <= 60 ? 'attention' : 'info',
  };
}
