/**
 * Preaching — the archive, series planning, the illustration library, and the
 * sermon assistant.
 *
 * The assistant is deliberately downstream of the preacher: it will not write
 * a sermon, it drafts the derivative work a pastor does at 11pm on a Saturday
 * — the children's version, the small-group guide, the discussion questions,
 * the social post. Every generated asset is stored against the sermon with an
 * AI label attached, and stays a draft until a human edits it.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, table, list, listItem, emptyState, badge, segmented, searchField,
  statCard, toast, aiOutput, modal, progress,
} from '../core/ui.js';
import { formatDate, relativeTime, isoDate, daysBetween } from '../core/format.js';
import { AI_TASKS } from '../core/ai.js';
import { openRecordModal, newButton, statusBadge, memberName, matches, sentence, deleteRecord } from './_shared.js';

const SERMON_FIELDS = ['title', 'date', 'seriesId', 'preacherId', 'passage', 'bigIdea', 'outline', 'notes', 'tags', 'status'];
const ASSET_TASKS = [
  ['sermon.outline', 'Outline'],
  ['sermon.applications', 'Applications & questions'],
  ['sermon.children', "Children's version"],
  ['sermon.youth', 'Youth version'],
  ['sermon.smallgroup', 'Small-group guide'],
  ['sermon.social', 'Social summary'],
];

export async function render(ctx, route) {
  if (route.params[0]) {
    const sermon = ctx.db.find('sermons', route.params[0]);
    if (sermon) return sermonDetail(ctx, sermon);
  }
  const tab = route.query.tab || 'sermons';
  const { db } = ctx;

  const body = h('div');
  body.appendChild(
    tab === 'series' ? seriesTab(ctx)
      : tab === 'library' ? libraryTab(ctx)
      : sermonsTab(ctx),
  );

  const preached = db.where('sermons', (s) => s.status === 'preached');
  const next = db.where('sermons', (s) => s.date && new Date(s.date) >= new Date())
    .sort((a, b) => new Date(a.date) - new Date(b.date))[0];

  return page({
    title: 'Preaching',
    subtitle: next ? `Next: ${next.title} · ${formatDate(next.date)}` : `${preached.length} sermons in the archive`,
    actions: [
      tab === 'series'
        ? newButton(ctx, 'preaching', 'New series', () => openRecordModal(ctx, { collection: 'series' }))
        : tab === 'library'
          ? newButton(ctx, 'preaching', 'Add illustration', () => openRecordModal(ctx, { collection: 'illustrations' }))
          : newButton(ctx, 'preaching', 'New sermon', () => openRecordModal(ctx, { collection: 'sermons', fields: SERMON_FIELDS })),
    ].filter(Boolean),
    children: [
      h('div', { style: { marginBottom: '18px' } },
        segmented({
          options: [
            { value: 'sermons', label: 'Sermons' },
            { value: 'series', label: 'Series' },
            { value: 'library', label: 'Illustrations & quotes' },
          ],
          value: tab,
          onChange: (value) => ctx.navigate(`/preaching?tab=${value}`),
        })),
      body,
    ],
  });
}

/* ── archive ─────────────────────────────────────────────────────────────── */

function sermonsTab(ctx) {
  const { db } = ctx;
  let query = '';
  let status = 'all';
  const results = h('div');

  const draw = () => {
    let sermons = db.all('sermons');
    if (status !== 'all') sermons = sermons.filter((s) => s.status === status);
    sermons = sermons.filter((s) => matches(s, query, ['title', 'passage', 'bigIdea', 'outline', 'notes'])
      || (query && (s.tags || []).some((t) => t.toLowerCase().includes(query.toLowerCase()))));
    sermons.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));

    results.textContent = '';
    results.appendChild(sermons.length
      ? table({
        columns: [
          {
            label: 'Sermon',
            render: (sermon) => h('div', null,
              h('div', { style: { fontWeight: '500' } }, sermon.title),
              h('div.tiny.subtle', [sermon.passage, sermon.bigIdea].filter(Boolean).join(' — ').slice(0, 90))),
          },
          { label: 'Date', value: (sermon) => (sermon.date ? formatDate(sermon.date) : '—') },
          { label: 'Series', value: (sermon) => (sermon.seriesId ? (db.find('series', sermon.seriesId) || {}).title : '—') },
          { label: 'Preacher', value: (sermon) => (sermon.preacherId ? memberName(db, sermon.preacherId) : '—') },
          { label: 'Status', render: (sermon) => statusBadge(sermon.status) },
          {
            label: 'Assets',
            render: (sermon) => {
              const count = Object.keys(sermon.assets || {}).length;
              return count ? badge(`${count}`, 'ai') : h('span.subtle', '—');
            },
          },
        ],
        rows: sermons,
        onRowClick: (sermon) => ctx.navigate(`/preaching/${sermon.id}`),
      })
      : emptyState({
        title: query ? `Nothing matches “${query}”` : 'No sermons yet',
        detail: 'The archive searches titles, passages, outlines and notes — it is how you find what you said about Job three years ago.',
        iconName: 'book',
        action: newButton(ctx, 'preaching', 'New sermon', () => openRecordModal(ctx, { collection: 'sermons', fields: SERMON_FIELDS })),
      }));
  };

  const wrap = h('div.stack',
    h('div.row.row--wrap',
      h('div', { style: { flex: '1', minWidth: '220px' } },
        searchField({ placeholder: 'Search sermons, passages, notes…', onInput: (value) => { query = value; draw(); } })),
      segmented({
        options: [
          { value: 'all', label: 'All' }, { value: 'idea', label: 'Ideas' },
          { value: 'drafting', label: 'Drafting' }, { value: 'preached', label: 'Preached' },
        ],
        value: status,
        onChange: (value) => { status = value; draw(); },
      })),
    results);
  draw();
  return wrap;
}

/* ── one sermon ──────────────────────────────────────────────────────────── */

function sermonDetail(ctx, sermon) {
  const { db } = ctx;
  const series = sermon.seriesId ? db.find('series', sermon.seriesId) : null;
  const assets = sermon.assets || {};

  const header = card({
    children: [
      h('div.row.row--wrap',
        h('div', { style: { flex: '1', minWidth: '220px' } },
          h('h2', sermon.title),
          h('p.muted', [
            sermon.passage,
            sermon.date ? formatDate(sermon.date) : 'no date set',
            series ? series.title : null,
            sermon.preacherId ? memberName(db, sermon.preacherId) : null,
          ].filter(Boolean).join(' · ')),
          h('div.row', { style: { marginTop: '8px', gap: '6px' } },
            statusBadge(sermon.status),
            ...(sermon.tags || []).map((tag) => badge(tag)))),
        ctx.can('preaching:write')
          ? h('button.btn.btn--primary', { onClick: () => openRecordModal(ctx, { collection: 'sermons', doc: sermon, fields: SERMON_FIELDS }) }, icon('edit', { size: 15 }), 'Edit')
          : null),
      sermon.bigIdea ? h('div.panel', { style: { marginTop: '14px' } },
        h('p.eyebrow', 'Big idea'), h('p.small', sermon.bigIdea)) : null,
    ],
  });

  const outlineCard = card({
    title: 'Outline & notes',
    children: [
      sermon.outline ? h('div.prose', sermon.outline) : h('p.small.muted', 'No outline yet.'),
      sermon.notes ? h('div', { style: { marginTop: '16px' } }, h('p.eyebrow', 'Notes'), h('div.prose.small', sermon.notes)) : null,
    ],
  });

  const assistantCard = ctx.can('assistant:read') ? card({
    title: 'Sermon assistant',
    subtitle: 'Drafts the work around the sermon. It does not write the sermon.',
    actions: [h('span.badge.badge--ai', icon('sparkles', { size: 12 }), 'AI')],
    children: [
      h('p.small.muted', { style: { marginBottom: '12px' } },
        ctx.assistant.remoteAvailable
          ? `Connected to ${ctx.assistant.config.model}.`
          : 'No AI service configured — drafts are built on this device from the sermon\'s own details. Connect one in Settings → AI.'),
      h('div.quick-actions', ...ASSET_TASKS.map(([task, label]) => h('button.quick-action', {
        onClick: () => generateAsset(ctx, sermon, task, label),
      }, icon('sparkles', { size: 16 }), label))),
      Object.keys(assets).length
        ? h('div.stack', { style: { marginTop: '18px' } },
          ...Object.entries(assets).map(([task, asset]) => h('details', { style: { border: '1px solid var(--border)', borderRadius: '12px', padding: '12px 14px' } },
            h('summary', { style: { cursor: 'pointer', fontWeight: '550', fontSize: '.875rem' } },
              `${AI_TASKS[task] || task} · ${relativeTime(asset.createdAt)}`),
            h('div', { style: { marginTop: '12px' } }, aiOutput({
              result: asset,
              actions: [
                h('button.btn.btn--sm', {
                  onClick: async () => {
                    try { await navigator.clipboard.writeText(asset.text); toast('Copied.', { variant: 'ok' }); }
                    catch { toast('Select the text and copy it.'); }
                  },
                }, 'Copy'),
                ctx.can('preaching:write') ? h('button.btn.btn--sm', {
                  onClick: async () => {
                    const next = { ...assets };
                    delete next[task];
                    ctx.db.update('sermons', sermon.id, { assets: next });
                    await ctx.db.flush();
                    ctx.refresh();
                  },
                }, 'Remove') : null,
              ].filter(Boolean),
            })))))
        : null,
    ],
  }) : null;

  const seriesCard = series ? card({
    title: 'Series',
    subtitle: series.title,
    children: [
      series.bigIdea ? h('p.small.muted', series.bigIdea) : null,
      h('div.stack.stack--sm', { style: { marginTop: '10px' } },
        ...db.where('sermons', (s) => s.seriesId === series.id)
          .sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0))
          .map((s) => h('button.list__item', { onClick: () => ctx.navigate(`/preaching/${s.id}`) },
            h('div.list__body',
              h('div.list__title', { style: s.id === sermon.id ? { fontWeight: '650' } : {} }, s.title),
              h('div.list__meta', s.date ? formatDate(s.date) : 'unscheduled')),
            statusBadge(s.status)))),
    ],
  }) : null;

  const relatedCard = card({
    title: 'From the library',
    subtitle: 'Illustrations and quotes that share a tag',
    children: [(() => {
      const tags = (sermon.tags || []).map((t) => t.toLowerCase());
      const related = db.all('illustrations').filter((item) => (item.tags || []).some((t) => tags.includes(String(t).toLowerCase())));
      return related.length
        ? list(related.slice(0, 5).map((item) => listItem({
          title: item.title,
          meta: sentence(item.kind),
          onClick: () => ctx.navigate('/preaching?tab=library'),
        })))
        : h('p.small.muted', 'Nothing tagged to match. Tag sermons and illustrations the same way and they find each other.');
    })()],
  });

  const dangerCard = ctx.can('preaching:delete') ? card({
    children: [h('button.btn.btn--sm.btn--danger', {
      onClick: async () => { if (await deleteRecord(ctx, 'sermons', sermon.id, sermon.title)) ctx.navigate('/preaching'); },
    }, icon('trash', { size: 14 }), 'Delete sermon')],
  }) : null;

  return page({
    eyebrow: 'Preaching',
    title: sermon.title,
    actions: [h('button.btn', { onClick: () => ctx.navigate('/preaching') }, icon('arrowLeft', { size: 15 }), 'Archive')],
    children: [h('div.stack', header,
      h('div.grid.grid--main-side',
        h('div.stack', outlineCard, assistantCard),
        h('div.stack', seriesCard, relatedCard, dangerCard)))],
  });
}

async function generateAsset(ctx, sermon, task, label) {
  const status = toast(`Drafting ${label.toLowerCase()}…`, { timeout: 0 });
  try {
    const result = await ctx.assistant.run(task, {
      title: sermon.title,
      passage: sermon.passage,
      bigIdea: sermon.bigIdea,
      churchName: ctx.tenant.name,
    });
    if (ctx.can('preaching:write')) {
      ctx.db.update('sermons', sermon.id, { assets: { ...(sermon.assets || {}), [task]: result } });
      await ctx.db.flush();
    }
    status.remove();
    toast(`${label} drafted. Read it before you use it.`, { variant: 'ok' });
    ctx.refresh();
  } catch (err) {
    status.remove();
    toast(err.message, { variant: 'danger' });
  }
}

/* ── series ──────────────────────────────────────────────────────────────── */

function seriesTab(ctx) {
  const { db } = ctx;
  const allSeries = db.all('series').sort((a, b) => new Date(b.startDate || 0) - new Date(a.startDate || 0));
  if (!allSeries.length) {
    return emptyState({
      title: 'No series planned',
      detail: 'A series groups sermons and gives the church a sense of where it is going.',
      iconName: 'book',
      action: newButton(ctx, 'preaching', 'New series', () => openRecordModal(ctx, { collection: 'series' })),
    });
  }
  const now = new Date();
  return h('div.grid.grid--2', ...allSeries.map((series) => {
    const sermons = db.where('sermons', (s) => s.seriesId === series.id);
    const preached = sermons.filter((s) => s.status === 'preached').length;
    const running = series.startDate && series.endDate
      && new Date(series.startDate) <= now && new Date(series.endDate) >= now;
    return card({
      title: series.title,
      subtitle: [series.book, series.startDate ? `${formatDate(series.startDate)} – ${series.endDate ? formatDate(series.endDate) : 'ongoing'}` : null].filter(Boolean).join(' · '),
      actions: [running ? badge('Running', 'accent') : null].filter(Boolean),
      children: [
        series.bigIdea ? h('p.small.muted', series.bigIdea) : null,
        sermons.length ? h('div', { style: { marginTop: '12px' } },
          h('div.row.row--between.small', h('span.muted', 'Progress'), h('span', `${preached} of ${sermons.length}`)),
          progress(preached, sermons.length)) : null,
        h('div.stack.stack--sm', { style: { marginTop: '12px' } },
          ...sermons.sort((a, b) => new Date(a.date || 0) - new Date(b.date || 0)).map((sermon) =>
            h('button.list__item', { onClick: () => ctx.navigate(`/preaching/${sermon.id}`) },
              h('div.list__body',
                h('div.list__title', sermon.title),
                h('div.list__meta', [sermon.passage, sermon.date ? formatDate(sermon.date) : null].filter(Boolean).join(' · '))),
              statusBadge(sermon.status)))),
        ctx.can('preaching:write')
          ? h('div.row', { style: { marginTop: '12px' } },
            h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'series', doc: series }) }, 'Edit'),
            h('button.btn.btn--sm', {
              onClick: () => openRecordModal(ctx, { collection: 'sermons', fields: SERMON_FIELDS, defaults: { seriesId: series.id } }),
            }, icon('plus', { size: 14 }), 'Add sermon'))
          : null,
      ],
    });
  }));
}

/* ── illustrations ───────────────────────────────────────────────────────── */

function libraryTab(ctx) {
  const { db } = ctx;
  let query = '';
  let kind = 'all';
  const results = h('div');

  const draw = () => {
    let items = db.all('illustrations');
    if (kind !== 'all') items = items.filter((i) => i.kind === kind);
    items = items.filter((i) => matches(i, query, ['title', 'body', 'source'])
      || (query && (i.tags || []).some((t) => t.toLowerCase().includes(query.toLowerCase()))));

    results.textContent = '';
    results.appendChild(items.length
      ? h('div.grid.grid--2', ...items.map((item) => card({
        tight: true,
        children: [
          h('div.row.row--between',
            h('strong', item.title),
            badge(sentence(item.kind))),
          h('p.small.prose', { style: { marginTop: '8px' } }, item.body),
          item.source ? h('p.tiny.subtle', { style: { marginTop: '8px' } }, `— ${item.source}`) : null,
          h('div.row', { style: { marginTop: '10px' } },
            h('div.chip-list', ...(item.tags || []).map((tag) => h('span.chip', tag))),
            h('div.spacer'),
            item.usedOn ? h('span.tiny.subtle', `used ${relativeTime(item.usedOn)}`) : null,
            ctx.can('preaching:write')
              ? h('button.icon-btn', { 'aria-label': 'Edit', onClick: () => openRecordModal(ctx, { collection: 'illustrations', doc: item }) }, icon('edit', { size: 15 }))
              : null,
            ctx.can('preaching:delete')
              ? h('button.icon-btn', { 'aria-label': 'Delete', onClick: () => deleteRecord(ctx, 'illustrations', item.id, item.title) }, icon('trash', { size: 15 }))
              : null),
        ],
      })))
      : emptyState({
        title: 'Nothing in the library',
        detail: 'Stories, quotes and statistics you have used or plan to. Check statistics against a current source before quoting them.',
        iconName: 'book',
        action: newButton(ctx, 'preaching', 'Add illustration', () => openRecordModal(ctx, { collection: 'illustrations' })),
      }));
  };

  const wrap = h('div.stack',
    h('div.row.row--wrap',
      h('div', { style: { flex: '1', minWidth: '220px' } },
        searchField({ placeholder: 'Search the library…', onInput: (value) => { query = value; draw(); } })),
      segmented({
        options: [
          { value: 'all', label: 'All' }, { value: 'illustration', label: 'Illustrations' },
          { value: 'quote', label: 'Quotes' }, { value: 'statistic', label: 'Statistics' },
        ],
        value: kind,
        onChange: (value) => { kind = value; draw(); },
      })),
    results);
  draw();
  return wrap;
}
