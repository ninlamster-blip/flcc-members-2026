/**
 * Knowledge centre — ask the church's own records a question.
 *
 * "What did we decide at last year's leadership retreat about youth
 * ministry?" is a question whose answer exists — in minutes, in a decision
 * log, in a policy in the vault — and which nobody can find. This module
 * retrieves from those records (filtered by what the asker may read) and
 * either shows the matches or, when an AI service is configured, has it write
 * the answer from them and nothing else.
 *
 * Answers worth keeping can be saved as knowledge entries, which then become
 * searchable themselves.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, list, listItem, emptyState, badge, segmented, searchField, statCard,
  toast, aiOutput, formModal, field, input, textarea, tagInput,
} from '../core/ui.js';
import { relativeTime, formatDate } from '../core/format.js';
import { COLLECTIONS } from '../core/schema.js';
import { blank } from '../core/schema.js';
import { openRecordModal, newButton, matches, sentence, deleteRecord } from './_shared.js';
import { routeForHit } from '../app.js';
import { KNOWLEDGE_EXCLUDED } from '../core/policies.js';

const SUGGESTIONS = [
  'What did the council decide about the retreat?',
  'Who approves benevolence requests?',
  'What is our child protection policy?',
  'When does the lease expire?',
  'What did we say about youth ministry?',
];

export async function render(ctx, route) {
  const tab = route.query.tab || 'ask';
  const body = h('div');
  body.appendChild(tab === 'entries' ? entriesTab(ctx) : tab === 'sources' ? sourcesTab(ctx) : askTab(ctx, route));

  return page({
    title: 'Knowledge centre',
    subtitle: 'Answers from this church\'s own records — nothing else.',
    actions: [newButton(ctx, 'knowledge', 'Add entry', () => openRecordModal(ctx, { collection: 'knowledge' }))].filter(Boolean),
    children: [
      h('div', { style: { marginBottom: '18px' } },
        segmented({
          options: [
            { value: 'ask', label: 'Ask' },
            { value: 'entries', label: `Saved answers (${ctx.db.all('knowledge').length})` },
            { value: 'sources', label: 'What it can read' },
          ],
          value: tab,
          onChange: (value) => ctx.navigate(`/knowledge?tab=${value}`),
        })),
      body,
    ],
  });
}

/* ── ask ─────────────────────────────────────────────────────────────────── */

function askTab(ctx, route) {
  const answerHost = h('div');
  const box = h('input.input', {
    placeholder: 'Ask a question about this church…',
    'aria-label': 'Your question',
    value: route.query.q || '',
    onKeydown: (e) => { if (e.key === 'Enter') ask(box.value); },
  });

  const ask = async (question) => {
    if (!question.trim()) return;
    answerHost.textContent = '';
    answerHost.appendChild(card({ children: [h('p.small.muted', 'Looking through the records…')] }));

    const result = await ctx.assistant.answer(question, ctx.user);
    answerHost.textContent = '';
    answerHost.appendChild(card({
      title: question,
      children: [
        aiOutput({
          result,
          actions: [ctx.can('knowledge:write') ? h('button.btn.btn--sm', {
            onClick: () => saveAnswer(ctx, question, result),
          }, 'Save as an answer') : null].filter(Boolean),
        }),
        result.sources.length ? h('div', { style: { marginTop: '16px' } },
          h('p.eyebrow', `Records used (${result.sources.length})`),
          list(result.sources.map((hit) => listItem({
            leading: icon('file', { size: 16 }),
            title: hit.title || '(untitled)',
            meta: `${COLLECTIONS[hit.collection].label} · ${hit.snippet}`,
            onClick: () => ctx.navigate(routeForHit(hit)),
          })))) : null,
      ],
    }));
  };

  if (route.query.q) setTimeout(() => ask(route.query.q), 0);

  return h('div.stack',
    card({
      children: [
        h('div.row', { style: { gap: '8px' } },
          h('div', { style: { flex: '1' } }, box),
          h('button.btn.btn--primary', { onClick: () => ask(box.value) }, icon('search', { size: 15 }), 'Ask')),
        h('div.chip-list', { style: { marginTop: '12px' } },
          ...SUGGESTIONS.map((suggestion) => h('button.chip', {
            onClick: () => { box.value = suggestion; ask(suggestion); },
          }, suggestion))),
        h('p.tiny.subtle', { style: { marginTop: '12px' } },
          ctx.assistant.remoteAvailable
            ? `Answers are written by ${ctx.assistant.config.model} using only the records you are allowed to read, and are labelled as AI.`
            : 'No AI service configured, so Shepherd shows the matching records instead of writing an answer. Connect one in Settings → AI.'),
      ],
    }),
    answerHost);
}

function saveAnswer(ctx, question, result) {
  const questionInput = input({ value: question });
  const answerInput = textarea({ value: result.text });
  let tags = [];
  const tagsControl = tagInput({ value: tags, onChange: (next) => { tags = next; } });

  formModal({
    title: 'Save this answer',
    submitLabel: 'Save',
    fields: [
      h('p.small.muted', 'Edit it before saving — an AI draft becomes a church record the moment someone relies on it.'),
      field({ label: 'Question', control: questionInput, full: true }),
      field({ label: 'Answer', control: answerInput, full: true }),
      field({ label: 'Tags', control: tagsControl, full: true }),
    ],
    onSubmit: async () => {
      ctx.db.insert('knowledge', blank('knowledge', {
        question: questionInput.value,
        answer: answerInput.value,
        tags,
        aiGenerated: result.source === 'model',
        sourceType: 'assistant',
        reviewedBy: ctx.user.id,
      }));
      await ctx.db.flush();
      toast('Saved. It is searchable now, and future answers can draw on it.', { variant: 'ok' });
      ctx.refresh();
    },
  });
}

/* ── saved answers ───────────────────────────────────────────────────────── */

function entriesTab(ctx) {
  const { db } = ctx;
  let query = '';
  const results = h('div');

  const draw = () => {
    const entries = db.all('knowledge')
      .filter((entry) => matches(entry, query, ['question', 'answer'])
        || (query && (entry.tags || []).some((t) => t.toLowerCase().includes(query.toLowerCase()))))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    results.textContent = '';
    results.appendChild(entries.length
      ? h('div.stack.stack--sm', ...entries.map((entry) => card({
        tight: true,
        children: [
          h('div.row.row--between',
            h('strong', entry.question),
            h('div.row',
              entry.aiGenerated ? badge('AI drafted', 'ai') : null,
              ctx.can('knowledge:write')
                ? h('button.icon-btn', { 'aria-label': 'Edit', onClick: () => openRecordModal(ctx, { collection: 'knowledge', doc: entry }) }, icon('edit', { size: 15 }))
                : null,
              ctx.can('knowledge:delete')
                ? h('button.icon-btn', { 'aria-label': 'Delete', onClick: () => deleteRecord(ctx, 'knowledge', entry.id, entry.question) }, icon('trash', { size: 15 }))
                : null)),
          h('div.prose.small', { style: { marginTop: '8px' } }, entry.answer),
          h('div.row', { style: { marginTop: '10px' } },
            h('div.chip-list', ...(entry.tags || []).map((tag) => h('span.chip', tag))),
            h('div.spacer'),
            h('span.tiny.subtle', `Updated ${relativeTime(entry.updatedAt)}`)),
        ],
      })))
      : emptyState({
        title: 'No saved answers yet',
        detail: 'The questions a church answers over and over — who to call, what the policy says, what was decided — belong here.',
        iconName: 'brain',
        action: newButton(ctx, 'knowledge', 'Add entry', () => openRecordModal(ctx, { collection: 'knowledge' })),
      }));
  };

  const wrap = h('div.stack',
    searchField({ placeholder: 'Search saved answers…', onInput: (value) => { query = value; draw(); } }),
    results);
  draw();
  return wrap;
}

/* ── sources ─────────────────────────────────────────────────────────────── */

function sourcesTab(ctx) {
  const { db } = ctx;
  const indexed = [
    ['meetings', 'Minutes and agendas'],
    ['decisions', 'The decision log'],
    ['documents', 'The document vault'],
    ['sermons', 'Sermon outlines and notes'],
    ['knowledge', 'Saved answers'],
    ['members', 'People (names, ministries, notes)'],
    ['events', 'Events'],
    ['prayers', 'Prayer requests'],
    ['songs', 'The song library'],
    ['illustrations', 'Illustrations and quotes'],
  ];

  return h('div.stack',
    card({
      title: 'What the knowledge centre can read',
      subtitle: 'And, just as importantly, what it cannot.',
      children: [
        h('div.grid.grid--2',
          ...indexed.map(([collection, label]) => {
            const def = COLLECTIONS[collection];
            const allowed = ctx.can(`${def.resource}:read`);
            return h('div.panel',
              h('div.row.row--between',
                h('strong.small', label),
                allowed ? badge(`${db.all(collection).length} records`, 'ok') : badge('Not visible to you', 'warn')),
              h('p.tiny.subtle', { style: { marginTop: '4px' } },
                allowed ? 'Included in answers you receive.' : 'Excluded — your role cannot read these.'));
          })),
        h('div.panel', { style: { marginTop: '16px' } },
          h('strong.small', 'Never included'),
          h('p.small.muted', { style: { marginTop: '4px' } },
            `Excluded for everyone, regardless of role: ${KNOWLEDGE_EXCLUDED.map((c) => (COLLECTIONS[c] || { label: c }).label).join(', ')}. `
            + 'They are read in their own modules, by people who hold those permissions, '
            + 'and are never summarised into an answer.')),
      ],
    }),
    card({
      title: 'How an answer is put together',
      children: [h('ol.small.muted', { style: { paddingLeft: '18px', display: 'grid', gap: '6px' } },
        h('li', 'Your question is tokenised and matched against the search index.'),
        h('li', 'Matches you are not permitted to read are dropped — before anything is sent anywhere.'),
        h('li', 'Without an AI service, the matching passages are shown as they are.'),
        h('li', 'With one, those passages and your question are sent to it, with an instruction to answer only from them and to say so when they do not contain the answer.'),
        h('li', 'The answer is labelled as AI-generated, with its sources listed underneath.'))],
    }));
}
