/**
 * Finance — giving, expenses, budgets, projects and approvals.
 *
 * Everything in this module is encrypted at rest and gated behind
 * `finance:*`, which most roles do not hold. Two further rules are enforced
 * rather than assumed:
 *
 *   • An expense above the approval threshold cannot be marked approved by
 *     the person who recorded it. Self-approval is the single most common
 *     way small-church finances go wrong.
 *   • Giving can be recorded anonymously; when it is, the giver is not
 *     stored at all rather than stored and hidden.
 *
 * Every figure is exportable to Excel, CSV or PDF for the auditor.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, table, list, listItem, emptyState, badge, segmented, statCard, progress,
  toast, modal, searchField, barChart, aiOutput, confirm,
} from '../core/ui.js';
import { formatDate, formatDateParts, formatMoney, isoDate, relativeTime } from '../core/format.js';
import { blank } from '../core/schema.js';
import { financeSnapshot } from '../core/ai.js';
import { downloadCSV, downloadExcel, printReport } from '../core/exporters.js';
import { openRecordModal, newButton, statusBadge, memberName, matches, sentence, deleteRecord, money } from './_shared.js';
import { needsApproval, canApproveTransaction, DEFAULT_APPROVAL_THRESHOLD } from '../core/policies.js';

const TX_FIELDS = ['kind', 'date', 'amount', 'category', 'department', 'projectId', 'description', 'method', 'memberId', 'anonymous', 'receiptRef', 'status'];

export async function render(ctx, route) {
  const { db } = ctx;
  if (db.isLocked('transactions')) {
    return page({
      title: 'Finance',
      children: [card({ children: [h('div.locked',
        icon('lock', { size: 18 }),
        h('div', null,
          h('strong', 'The financial records are encrypted'),
          h('p.small.muted', 'Your account cannot open them. Ask a church administrator to give you access, then sign in again.')))] })],
    });
  }

  if (route.query.new === '1' && ctx.can('finance:write')) {
    setTimeout(() => recordTransaction(ctx, route.query.kind ? { kind: route.query.kind } : {}), 0);
  }

  const tab = route.query.tab || 'overview';
  const year = Number(route.query.year) || new Date().getFullYear();

  const body = h('div');
  body.appendChild(
    tab === 'giving' ? ledgerTab(ctx, 'giving', year)
      : tab === 'expenses' ? ledgerTab(ctx, 'expense', year)
      : tab === 'budgets' ? budgetsTab(ctx, year)
      : tab === 'approvals' ? approvalsTab(ctx)
      : overviewTab(ctx, year),
  );

  const pending = db.where('transactions', (t) => t.status === 'pending-approval').length;

  return page({
    title: 'Finance',
    subtitle: `${year} · ${ctx.settings.currency}. Encrypted on this device.`,
    actions: [
      ctx.can('finance:export') ? h('button.btn', { onClick: () => exportFinance(ctx, year) }, icon('download', { size: 15 }), 'Export') : null,
      newButton(ctx, 'finance', 'Record', () => recordTransaction(ctx)),
    ].filter(Boolean),
    children: [
      h('div', { style: { marginBottom: '18px' } },
        segmented({
          options: [
            { value: 'overview', label: 'Overview' },
            { value: 'giving', label: 'Giving' },
            { value: 'expenses', label: 'Expenses' },
            { value: 'budgets', label: 'Budgets' },
            { value: 'approvals', label: pending ? `Approvals (${pending})` : 'Approvals' },
          ],
          value: tab,
          onChange: (value) => ctx.navigate(`/finance?tab=${value}&year=${year}`),
        })),
      body,
    ],
  });
}

/* ── overview ────────────────────────────────────────────────────────────── */

function overviewTab(ctx, year) {
  const { db } = ctx;
  const from = new Date(year, 0, 1);
  const to = new Date(year, 11, 31, 23, 59, 59);
  const snapshot = financeSnapshot(db, { from, to });
  const budgets = db.where('budgets', (b) => b.year === year);
  const totalBudget = budgets.reduce((total, b) => total + Number(b.amount || 0), 0);

  const monthly = [];
  for (let month = 0; month < 12; month++) {
    const start = new Date(year, month, 1);
    const end = new Date(year, month + 1, 0, 23, 59, 59);
    const period = financeSnapshot(db, { from: start, to: end });
    monthly.push({ label: formatDateParts(start, { month: 'narrow' }), giving: period.giving, expenses: period.expenses });
  }

  return h('div.stack',
    h('div.grid.grid--4',
      statCard({ value: money(snapshot.giving), label: `Given in ${year}` }),
      statCard({ value: money(snapshot.expenses), label: 'Spent' }),
      statCard({
        value: money(snapshot.net),
        label: 'Net',
        delta: snapshot.giving ? `${Math.round((snapshot.net / snapshot.giving) * 100)}%` : '',
        deltaDirection: snapshot.net >= 0 ? 'up' : 'down',
      }),
      statCard({ value: totalBudget ? `${Math.round((snapshot.expenses / totalBudget) * 100)}%` : '—', label: 'Of annual budget' })),

    card({
      title: 'Giving by month',
      subtitle: `${year}`,
      children: [barChart(monthly.map((m) => ({ label: m.label, value: m.giving })), { format: money })],
    }),

    h('div.grid.grid--2',
      card({
        title: 'Giving by category',
        children: [snapshot.givingByCategory.length
          ? table({
            columns: [
              { label: 'Category', key: 'category' },
              { label: 'Amount', numeric: true, value: (row) => money(row.amount) },
              { label: 'Share', numeric: true, value: (row) => `${Math.round((row.amount / snapshot.giving) * 100)}%` },
            ],
            rows: snapshot.givingByCategory,
          })
          : h('p.small.muted', 'Nothing recorded yet.')],
      }),
      card({
        title: 'Spending by category',
        children: [snapshot.expensesByCategory.length
          ? table({
            columns: [
              { label: 'Category', key: 'category' },
              { label: 'Amount', numeric: true, value: (row) => money(row.amount) },
              {
                label: 'Budget',
                numeric: true,
                render: (row) => {
                  const budget = budgets.find((b) => b.category === row.category);
                  if (!budget) return h('span.subtle', '—');
                  const pct = Math.round((row.amount / budget.amount) * 100);
                  return badge(`${pct}%`, pct >= 100 ? 'danger' : pct >= 90 ? 'warn' : 'ok');
                },
              },
            ],
            rows: snapshot.expensesByCategory,
          })
          : h('p.small.muted', 'Nothing recorded yet.')],
      })),

    card({
      title: 'Projects & funds',
      actions: [newButton(ctx, 'finance', 'New project', () => openRecordModal(ctx, { collection: 'projects' }))].filter(Boolean),
      children: [(() => {
        const projects = db.all('projects');
        if (!projects.length) return h('p.small.muted', 'No designated funds. A project ring-fences giving for one purpose — a sound desk, a building, a family in need.');
        return h('div.stack.stack--sm', ...projects.map((project) => {
          const raised = db.where('transactions', (t) => t.projectId === project.id && t.kind === 'giving')
            .reduce((total, t) => total + Number(t.amount || 0), 0);
          return h('div', null,
            h('div.row.row--between',
              h('strong.small', project.name),
              h('span.small.nums', `${money(raised)}${project.goal ? ` of ${money(project.goal)}` : ''}`)),
            project.goal ? progress(raised, project.goal, { variant: '' }) : null);
        }));
      })()],
    }));
}

/* ── ledgers ─────────────────────────────────────────────────────────────── */

function ledgerTab(ctx, kind, year) {
  const { db } = ctx;
  let query = '';
  const results = h('div');

  const draw = () => {
    const rows = db.where('transactions', (t) => t.kind === kind && new Date(t.date).getFullYear() === year)
      .filter((t) => matches(t, query, ['description', 'category', 'department', 'receiptRef']))
      .sort((a, b) => new Date(b.date) - new Date(a.date));
    const total = rows.reduce((sum, t) => sum + Number(t.amount || 0), 0);

    results.textContent = '';
    results.appendChild(h('div.stack',
      h('p.small.muted', `${rows.length} entries · ${money(total)}`),
      rows.length
        ? table({
          columns: [
            { label: 'Date', value: (t) => formatDate(t.date) },
            { label: 'Category', key: 'category' },
            { label: 'Description', value: (t) => t.description || '—' },
            {
              label: kind === 'giving' ? 'Giver' : 'Department',
              value: (t) => (kind === 'giving'
                ? (t.anonymous ? 'Anonymous' : memberName(db, t.memberId, '—'))
                : t.department || '—'),
            },
            { label: 'Method', value: (t) => sentence(t.method || '') },
            { label: 'Status', render: (t) => statusBadge(t.status) },
            { label: 'Amount', numeric: true, render: (t) => h('strong.nums', money(t.amount)) },
          ],
          rows,
          onRowClick: ctx.can('finance:write') ? (t) => openRecordModal(ctx, { collection: 'transactions', doc: t, fields: TX_FIELDS }) : undefined,
        })
        : emptyState({
          title: `No ${kind === 'giving' ? 'giving' : 'expenses'} recorded in ${year}`,
          iconName: 'wallet',
          action: newButton(ctx, 'finance', 'Record', () => recordTransaction(ctx, { kind })),
        })));
  };

  const wrap = h('div.stack',
    h('div.row.row--wrap',
      h('div', { style: { flex: '1', minWidth: '220px' } },
        searchField({ placeholder: 'Search entries…', onInput: (value) => { query = value; draw(); } })),
      yearPicker(ctx, year, 'giving' === kind ? 'giving' : 'expenses')),
    results);
  draw();
  return wrap;
}

function yearPicker(ctx, year, tab) {
  const years = [];
  for (let y = new Date().getFullYear(); y >= new Date().getFullYear() - 5; y--) years.push(y);
  return h('select.select', {
    style: { maxWidth: '120px' },
    'aria-label': 'Year',
    onChange: (e) => ctx.navigate(`/finance?tab=${tab}&year=${e.target.value}`),
  }, ...years.map((y) => h('option', { value: y, selected: y === year }, String(y))));
}

/**
 * Create a transaction, applying the approval rule on the way in: an expense
 * over the church's threshold cannot simply be "recorded", it enters as
 * pending approval and waits for someone who did not write it.
 */
export function recordTransaction(ctx, defaults = {}) {
  const threshold = ctx.settings.approvalThreshold || DEFAULT_APPROVAL_THRESHOLD;
  return openRecordModal(ctx, {
    collection: 'transactions',
    fields: TX_FIELDS,
    defaults: { date: isoDate(new Date()), currency: ctx.settings.currency, ...defaults },
    onSaved: async (saved) => {
      if (!needsApproval(saved, threshold)) return;
      ctx.db.update('transactions', saved.id, { status: 'pending-approval' });
      await ctx.db.flush();
      toast(`Over ${money(threshold)} — sent for approval.`, { variant: '' });
    },
  });
}

/* ── budgets ─────────────────────────────────────────────────────────────── */

function budgetsTab(ctx, year) {
  const { db } = ctx;
  const budgets = db.where('budgets', (b) => b.year === year).sort((a, b) => a.category.localeCompare(b.category));
  const spend = new Map();
  for (const tx of db.where('transactions', (t) => t.kind === 'expense' && new Date(t.date).getFullYear() === year)) {
    spend.set(tx.category, (spend.get(tx.category) || 0) + Number(tx.amount || 0));
  }
  const totalBudget = budgets.reduce((total, b) => total + Number(b.amount || 0), 0);
  const totalSpent = [...spend.values()].reduce((a, b) => a + b, 0);

  return h('div.stack',
    h('div.row.row--wrap',
      h('div.spacer'),
      yearPicker(ctx, year, 'budgets'),
      newButton(ctx, 'finance', 'New budget line', () => openRecordModal(ctx, { collection: 'budgets', defaults: { year } }))),
    h('div.grid.grid--3',
      statCard({ value: money(totalBudget), label: `Budgeted for ${year}` }),
      statCard({ value: money(totalSpent), label: 'Spent so far' }),
      statCard({ value: money(totalBudget - totalSpent), label: 'Remaining' })),
    budgets.length
      ? card({
        title: 'Budget lines',
        children: [h('div.stack', ...budgets.map((budget) => {
          const spent = spend.get(budget.category) || 0;
          const pct = budget.amount ? Math.round((spent / budget.amount) * 100) : 0;
          return h('div', null,
            h('div.row.row--between',
              h('div', null,
                h('strong.small', budget.category),
                budget.department ? h('span.tiny.subtle', ` · ${budget.department}`) : null),
              h('div.row',
                h('span.small.nums', `${money(spent)} of ${money(budget.amount)}`),
                badge(`${pct}%`, pct >= 100 ? 'danger' : pct >= 90 ? 'warn' : 'ok'),
                ctx.can('finance:write')
                  ? h('button.icon-btn', { 'aria-label': 'Edit', onClick: () => openRecordModal(ctx, { collection: 'budgets', doc: budget }) }, icon('edit', { size: 15 }))
                  : null)),
            progress(spent, budget.amount));
        }))],
      })
      : emptyState({
        title: `No budget set for ${year}`,
        detail: 'A budget line per category turns spending into something the council can see at a glance.',
        iconName: 'wallet',
        action: newButton(ctx, 'finance', 'New budget line', () => openRecordModal(ctx, { collection: 'budgets', defaults: { year } })),
      }));
}

/* ── approvals ───────────────────────────────────────────────────────────── */

function approvalsTab(ctx) {
  const { db } = ctx;
  const threshold = ctx.settings.approvalThreshold || DEFAULT_APPROVAL_THRESHOLD;
  const pending = db.where('transactions', (t) => t.status === 'pending-approval')
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const recent = db.where('transactions', (t) => t.status === 'approved' && t.approvedAt)
    .sort((a, b) => new Date(b.approvedAt) - new Date(a.approvedAt))
    .slice(0, 10);

  return h('div.stack',
    card({
      title: 'Waiting for approval',
      subtitle: `Anything above ${money(threshold)} needs a second pair of eyes.`,
      children: [pending.length
        ? list(pending.map((tx) => {
          const verdict = canApproveTransaction(ctx.user, tx);
          const isOwnEntry = tx.createdBy === ctx.user.id;
          return h('div.list__item',
            h('div.list__body',
              h('div.list__title', tx.description || tx.category),
              h('div.list__meta', [
                formatDate(tx.date), tx.category, tx.department,
                `recorded by ${(db.find('users', tx.createdBy) || {}).name || 'someone'}`,
              ].filter(Boolean).join(' · '))),
            h('strong.nums', money(tx.amount)),
            verdict.ok
              ? h('div.row',
                h('button.btn.btn--sm', { onClick: () => decide(ctx, tx, 'rejected') }, 'Reject'),
                h('button.btn.btn--sm.btn--primary', { onClick: () => decide(ctx, tx, 'approved') }, icon('check', { size: 14 }), 'Approve'))
              : badge(isOwnEntry ? 'You recorded this' : verdict.reason || 'Awaiting an approver', 'warn'));
        }))
        : h('p.small.muted', 'Nothing waiting.')],
    }),
    card({
      title: 'Recently approved',
      children: [recent.length
        ? list(recent.map((tx) => listItem({
          leading: icon('check', { size: 16 }),
          title: tx.description || tx.category,
          meta: `${money(tx.amount)} · approved by ${(db.find('users', tx.approvedBy) || {}).name || 'someone'} · ${relativeTime(tx.approvedAt)}`,
        })))
        : h('p.small.muted', 'Nothing approved yet.')],
    }),
    card({
      title: 'How approval works here',
      children: [h('ul.small.muted', { style: { paddingLeft: '18px', display: 'grid', gap: '6px' } },
        h('li', `Expenses above ${money(threshold)} are recorded as "pending approval".`),
        h('li', 'Nobody can approve an entry they recorded themselves — Shepherd refuses it.'),
        h('li', 'Approval is written to the audit log with who, what and when.'),
        h('li', 'Adjust the threshold in Settings → Church.'))],
    }));
}

async function decide(ctx, tx, status) {
  const verdict = canApproveTransaction(ctx.user, tx);
  if (!verdict.ok) {
    toast(verdict.reason, { variant: 'danger' });
    return;
  }
  const ok = await confirm({
    title: status === 'approved' ? 'Approve this payment?' : 'Reject this payment?',
    message: `${tx.description || tx.category} — ${money(tx.amount)}. This is written to the audit log.`,
    confirmLabel: status === 'approved' ? 'Approve' : 'Reject',
    danger: status !== 'approved',
  });
  if (!ok) return;
  ctx.db.update('transactions', tx.id, {
    status,
    approvedBy: ctx.user.id,
    approvedAt: new Date().toISOString(),
  });
  ctx.db.log('finance.approval', `${sentence(status)} ${money(tx.amount)} — ${tx.description || tx.category}.`);
  await ctx.db.flush();
  toast(status === 'approved' ? 'Approved.' : 'Rejected.', { variant: status === 'approved' ? 'ok' : '' });
  ctx.refresh();
}

/* ── export ──────────────────────────────────────────────────────────────── */

function exportFinance(ctx, year) {
  const { db } = ctx;
  const rows = db.where('transactions', (t) => new Date(t.date).getFullYear() === year)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
  const columns = [
    { label: 'Date', value: (t) => t.date },
    { label: 'Type', value: (t) => t.kind },
    { label: 'Category', key: 'category' },
    { label: 'Department', value: (t) => t.department || '' },
    { label: 'Description', value: (t) => t.description || '' },
    { label: 'Method', value: (t) => t.method || '' },
    { label: 'Giver', value: (t) => (t.kind === 'giving' && !t.anonymous ? memberName(db, t.memberId, '') : '') },
    { label: 'Status', key: 'status' },
    { label: `Amount (${ctx.settings.currency})`, value: (t) => Number(t.amount || 0) },
  ];

  const ref = modal({
    title: `Export ${year}`,
    body: h('div.stack',
      h('p.small.muted', `${rows.length} entries. Financial records — treat the file the way you would the ledger.`),
      h('div.quick-actions',
        h('button.quick-action', {
          onClick: () => {
            downloadExcel(`${ctx.tenant.id}-finance-${year}.xls`, [{ name: `Finance ${year}`, columns, rows }]);
            ctx.db.log('export', `Exported ${rows.length} financial entries for ${year} to Excel.`);
            ref.close();
          },
        }, icon('download', { size: 16 }), 'Excel'),
        h('button.quick-action', {
          onClick: () => {
            downloadCSV(`${ctx.tenant.id}-finance-${year}.csv`, rows, columns);
            ctx.db.log('export', `Exported ${rows.length} financial entries for ${year} to CSV.`);
            ref.close();
          },
        }, icon('download', { size: 16 }), 'CSV'),
        h('button.quick-action', {
          onClick: () => {
            printFinance(ctx, year, rows);
            ref.close();
          },
        }, icon('file', { size: 16 }), 'PDF / print'))),
  });
}

function printFinance(ctx, year, rows) {
  const snapshot = financeSnapshot(ctx.db, { from: new Date(year, 0, 1), to: new Date(year, 11, 31, 23, 59, 59) });
  const stats = h('div', { class: 'stat-grid' },
    h('div.stat', h('b', money(snapshot.giving)), 'Total giving'),
    h('div.stat', h('b', money(snapshot.expenses)), 'Total expenses'),
    h('div.stat', h('b', money(snapshot.net)), 'Net'));

  const tableNode = h('table',
    h('thead', h('tr', ...['Date', 'Type', 'Category', 'Description', 'Status', 'Amount'].map((label) => h('th', label)))),
    h('tbody', ...rows.map((t) => h('tr',
      h('td', formatDate(t.date)),
      h('td', t.kind),
      h('td', t.category),
      h('td', t.description || ''),
      h('td', t.status),
      h('td', money(t.amount))))));

  printReport({
    title: `${ctx.tenant.name} — financial report ${year}`,
    subtitle: `Prepared ${formatDate(new Date())} by ${ctx.user.name}. Currency: ${ctx.settings.currency}.`,
    nodes: [stats, tableNode],
  });
  ctx.db.log('export', `Printed the ${year} financial report.`);
}
