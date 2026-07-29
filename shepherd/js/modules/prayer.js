/**
 * Prayer centre — the wall, the private requests, the chains, and the answers.
 *
 * Visibility is the whole design here. A request is either on the wall, for
 * leaders only, or private to whoever recorded it; the module never shows one
 * category in place of another, and "praying for" counts are the only social
 * signal, deliberately.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, list, listItem, emptyState, badge, avatar, segmented, statCard,
  searchField, toast, aiOutput, modal,
} from '../core/ui.js';
import { formatDate, relativeTime, isoDate } from '../core/format.js';
import { openRecordModal, newButton, statusBadge, memberName, matches, sentence, deleteRecord } from './_shared.js';
import { canSeePrayer } from '../core/policies.js';

const REQUEST_FIELDS = ['title', 'detail', 'memberId', 'requestedBy', 'category', 'visibility', 'urgent', 'status', 'chainId'];

export async function render(ctx, route) {
  if (route.query.new === '1' && ctx.can('prayer:write')) {
    setTimeout(() => openRecordModal(ctx, { collection: 'prayers', fields: REQUEST_FIELDS }), 0);
  }
  const { db } = ctx;
  const tab = route.query.tab || 'wall';

  const visible = db.all('prayers').filter((p) => canSee(ctx, p));
  const open = visible.filter((p) => p.status === 'open' || p.status === 'praying');
  const answered = visible.filter((p) => p.status === 'answered');
  const urgent = open.filter((p) => p.urgent);

  const body = h('div');
  const draw = () => {
    body.textContent = '';
    body.appendChild(
      tab === 'answered' ? answeredTab(ctx, answered)
        : tab === 'chains' ? chainsTab(ctx)
        : tab === 'points' ? pointsTab(ctx)
        : wallTab(ctx, open),
    );
  };
  draw();

  return page({
    title: 'Prayer centre',
    subtitle: 'What the church is carrying this week.',
    actions: [newButton(ctx, 'prayer', 'Add request', () => openRecordModal(ctx, { collection: 'prayers', fields: REQUEST_FIELDS }))].filter(Boolean),
    children: [
      h('div.grid.grid--4', { style: { marginBottom: '18px' } },
        statCard({ value: open.length, label: 'Open requests' }),
        statCard({ value: urgent.length, label: 'Urgent' }),
        statCard({ value: answered.length, label: 'Answered' }),
        statCard({ value: visible.reduce((total, p) => total + (p.prayedCount || 0), 0), label: 'Times prayed' })),
      h('div', { style: { marginBottom: '18px' } },
        segmented({
          options: [
            { value: 'wall', label: 'Prayer wall' },
            { value: 'answered', label: 'Answered' },
            { value: 'chains', label: 'Chains' },
            { value: 'points', label: 'Prayer meeting' },
          ],
          value: tab,
          onChange: (value) => ctx.navigate(`/prayer?tab=${value}`),
        })),
      body,
    ],
  });
}

/* ── wall ────────────────────────────────────────────────────────────────── */

function wallTab(ctx, open) {
  let query = '';
  let category = 'all';
  const results = h('div');

  const draw = () => {
    let requests = open.filter((p) => (category === 'all' || p.category === category)
      && matches(p, query, ['title', 'detail', 'requestedBy']));
    requests = requests.sort((a, b) => (b.urgent === true) - (a.urgent === true)
      || new Date(b.createdAt) - new Date(a.createdAt));

    results.textContent = '';
    results.appendChild(requests.length
      ? h('div.grid.grid--2', ...requests.map((request) => requestCard(ctx, request)))
      : emptyState({
        title: query || category !== 'all' ? 'No requests match' : 'The wall is clear',
        detail: 'Requests appear here as they are recorded.',
        iconName: 'heart',
      }));
  };

  const categories = ['all', 'health', 'family', 'work', 'travel', 'spiritual', 'financial', 'thanksgiving', 'other'];
  const wrap = h('div.stack',
    h('div.row.row--wrap',
      h('div', { style: { flex: '1', minWidth: '220px' } },
        searchField({ placeholder: 'Search requests…', onInput: (value) => { query = value; draw(); } })),
      h('select.select', {
        style: { maxWidth: '190px' },
        'aria-label': 'Category',
        onChange: (e) => { category = e.target.value; draw(); },
      }, ...categories.map((c) => h('option', { value: c }, c === 'all' ? 'All categories' : sentence(c))))),
    results);
  draw();
  return wrap;
}

function requestCard(ctx, request) {
  const { db } = ctx;
  const person = request.memberId ? db.find('members', request.memberId) : null;
  return card({
    tight: true,
    children: [
      h('div.row.row--between',
        h('div.row',
          person ? avatar(person.fullName, { size: 'sm' }) : icon('heart', { size: 18 }),
          h('div', null,
            h('div', { style: { fontWeight: '550' } }, request.title),
            h('div.tiny.subtle', [
              person ? person.fullName : request.requestedBy || 'Anonymous',
              sentence(request.category),
              relativeTime(request.createdAt),
            ].filter(Boolean).join(' · ')))),
        h('div.row',
          request.urgent ? badge('Urgent', 'danger') : null,
          request.visibility === 'leaders' ? badge('Leaders', 'warn') : null,
          request.visibility === 'private' ? badge('Private', 'info') : null)),
      request.detail ? h('p.small.muted', { style: { marginTop: '10px' } }, request.detail) : null,
      h('div.row', { style: { marginTop: '12px' } },
        h('button.btn.btn--sm', {
          onClick: async () => {
            ctx.db.update('prayers', request.id, {
              prayedCount: (request.prayedCount || 0) + 1,
              status: request.status === 'open' ? 'praying' : request.status,
            });
            await ctx.db.flush();
            toast('Recorded. Thank you for praying.');
            ctx.refresh();
          },
        }, icon('heart', { size: 14 }), `Prayed · ${request.prayedCount || 0}`),
        ctx.can('prayer:write')
          ? h('button.btn.btn--sm', { onClick: () => markAnswered(ctx, request) }, icon('check', { size: 14 }), 'Answered')
          : null,
        h('div.spacer'),
        ctx.can('prayer:write')
          ? h('button.icon-btn', { 'aria-label': 'Edit', onClick: () => openRecordModal(ctx, { collection: 'prayers', doc: request, fields: REQUEST_FIELDS }) }, icon('edit', { size: 15 }))
          : null,
        ctx.can('prayer:delete')
          ? h('button.icon-btn', { 'aria-label': 'Delete', onClick: () => deleteRecord(ctx, 'prayers', request.id, 'this request') }, icon('trash', { size: 15 }))
          : null),
    ],
  });
}

function markAnswered(ctx, request) {
  const note = h('textarea.textarea', { placeholder: 'How was it answered? This is what the church will hear on Sunday.' });
  const ref = modal({
    title: 'Answered prayer',
    body: h('div.stack',
      h('p.small.muted', request.title),
      h('div.field', h('label.field__label', 'What happened'), note)),
    actions: [
      h('button.btn', { onClick: () => ref.close() }, 'Cancel'),
      h('button.btn.btn--primary', {
        onClick: async () => {
          ctx.db.update('prayers', request.id, {
            status: 'answered',
            answeredNote: note.value,
            answeredOn: isoDate(new Date()),
          });
          await ctx.db.flush();
          toast('Recorded. Answered prayer nobody hears about is a testimony lost.', { variant: 'ok' });
          ref.close();
          ctx.refresh();
        },
      }, 'Save'),
    ],
  });
}

/* ── answered ────────────────────────────────────────────────────────────── */

function answeredTab(ctx, answered) {
  if (!answered.length) {
    return emptyState({
      title: 'No answers recorded yet',
      detail: 'Mark a request answered and it lands here, ready to be read out.',
      iconName: 'check',
    });
  }
  const sorted = answered.sort((a, b) => new Date(b.answeredOn || b.updatedAt) - new Date(a.answeredOn || a.updatedAt));
  return card({
    title: 'Answered prayer',
    subtitle: `${sorted.length} recorded`,
    children: [h('div.timeline', ...sorted.map((request) => h('div.timeline__item.timeline__item--accent',
      h('div.row.row--between',
        h('strong.small', request.title),
        h('span.tiny.subtle', request.answeredOn ? formatDate(request.answeredOn) : '')),
      request.answeredNote ? h('p.small.muted', { style: { marginTop: '4px' } }, request.answeredNote) : null,
      h('div.tiny.subtle', [request.memberId ? memberName(ctx.db, request.memberId) : null, sentence(request.category)].filter(Boolean).join(' · ')))))],
  });
}

/* ── chains ──────────────────────────────────────────────────────────────── */

function chainsTab(ctx) {
  const { db } = ctx;
  const chains = db.all('prayerChains');
  return h('div.stack',
    h('div.row.row--end', newButton(ctx, 'prayer', 'New chain', () => openRecordModal(ctx, { collection: 'prayerChains' }))),
    chains.length
      ? h('div.grid.grid--2', ...chains.map((chain) => {
        const requests = db.where('prayers', (p) => p.chainId === chain.id && canSee(ctx, p));
        return card({
          title: chain.name,
          subtitle: chain.purpose,
          actions: [chain.active ? badge('Active', 'ok') : badge('Paused')],
          children: [
            h('p.small.muted', `${(chain.memberIds || []).length} people · ${requests.length} requests circulating`),
            h('div.chip-list', { style: { marginTop: '10px' } },
              ...(chain.memberIds || []).slice(0, 12).map((id) => h('span.chip', memberName(db, id)))),
            requests.length ? h('div.stack.stack--sm', { style: { marginTop: '12px' } },
              ...requests.slice(0, 5).map((request) => h('div.small', `· ${request.title}`))) : null,
            ctx.can('prayer:write')
              ? h('div.row', { style: { marginTop: '12px' } },
                h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'prayerChains', doc: chain }) }, 'Edit'),
                h('button.btn.btn--sm', { onClick: () => shareChain(ctx, chain, requests) }, 'Message text'))
              : null,
          ],
        });
      }))
      : emptyState({
        title: 'No prayer chains',
        detail: 'A chain is a named group who receive urgent requests the same day.',
        iconName: 'heart',
      }));
}

function shareChain(ctx, chain, requests) {
  const text = [
    `🙏 ${chain.name} — ${formatDate(new Date())}`,
    '',
    ...requests.slice(0, 10).map((r) => `• ${r.title}${r.urgent ? ' (urgent)' : ''}`),
    '',
    `— ${ctx.tenant.name}`,
  ].join('\n');
  const area = h('textarea.textarea', { style: { minHeight: '220px' }, value: text }, text);
  const ref = modal({
    title: 'Send to the chain',
    body: h('div.stack',
      h('p.small.muted', 'Copy this into WhatsApp or SMS. Names are included only where the request is on the wall.'),
      area),
    actions: [
      h('button.btn', { onClick: () => ref.close() }, 'Close'),
      h('button.btn.btn--primary', {
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(area.value);
            toast('Copied.', { variant: 'ok' });
          } catch {
            toast('Select the text and copy it.', {});
          }
        },
      }, 'Copy'),
    ],
  });
}

/* ── prayer meeting ──────────────────────────────────────────────────────── */

function pointsTab(ctx) {
  const output = h('div');
  const generate = async () => {
    output.textContent = '';
    output.appendChild(h('p.small.muted', 'Working…'));
    const result = await ctx.assistant.run('prayer.points', { churchName: ctx.tenant.name });
    output.textContent = '';
    output.appendChild(aiOutput({
      result,
      actions: [h('button.btn.btn--sm', {
        onClick: async () => {
          try {
            await navigator.clipboard.writeText(result.text);
            toast('Copied.', { variant: 'ok' });
          } catch { toast('Select the text and copy it.'); }
        },
      }, 'Copy')],
    }));
  };

  return h('div.stack',
    card({
      title: 'Prayer meeting sheet',
      subtitle: 'Built from the open requests you are allowed to see.',
      actions: [h('button.btn.btn--sm.btn--primary', { onClick: generate }, icon('sparkles', { size: 14 }), 'Generate')],
      children: [output],
    }),
    card({
      title: 'Departments',
      subtitle: 'Requests grouped by category, for praying in sections.',
      children: [(() => {
        const groups = new Map();
        for (const request of ctx.db.all('prayers')) {
          if (!canSee(ctx, request) || request.status === 'answered' || request.status === 'closed') continue;
          if (!groups.has(request.category)) groups.set(request.category, []);
          groups.get(request.category).push(request);
        }
        if (!groups.size) return h('p.small.muted', 'No open requests.');
        return h('div.grid.grid--3', ...[...groups].map(([category, requests]) => h('div.panel',
          h('p.eyebrow', sentence(category)),
          ...requests.slice(0, 6).map((request) => h('div.small', `· ${request.title}`)))));
      })()],
    }));
}

/* ── visibility ──────────────────────────────────────────────────────────── */

/** The rule itself lives in core/policies.js, where it is tested. */
function canSee(ctx, request) {
  return canSeePrayer(ctx.user, request);
}
