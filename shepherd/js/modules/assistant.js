/**
 * The assistant — one screen for everything Shepherd can draft or notice.
 *
 * Two halves, matching how the intelligence actually works:
 *   • "Noticed" is computed here, from this church's records, with no model
 *     and no network. It is the half that works on a phone in a lift.
 *   • "Draft" runs a task through the configured model, or falls back to a
 *     structured local draft. Everything it produces is labelled and has to be
 *     read before it is used.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, segmented, emptyState, badge, toast, aiOutput, field, input, textarea, select,
} from '../core/ui.js';
import { computeInsights, AI_TASKS, LANGUAGES } from '../core/ai.js';
import { relativeTime } from '../core/format.js';
import { sentence } from './_shared.js';

const TASK_GROUPS = [
  {
    label: 'Preaching',
    tasks: ['sermon.outline', 'sermon.applications', 'sermon.children', 'sermon.youth', 'sermon.smallgroup', 'sermon.social', 'bible.study'],
  },
  {
    label: 'Leadership',
    tasks: ['meeting.agenda', 'meeting.summary', 'report.summary'],
  },
  {
    label: 'Communication',
    tasks: ['announcement.draft', 'message.whatsapp', 'message.email', 'translate'],
  },
  {
    label: 'Ministry',
    tasks: ['prayer.points', 'event.checklist'],
  },
];

export async function render(ctx, route) {
  const tab = route.query.tab || 'noticed';
  const body = h('div');
  body.appendChild(tab === 'draft' ? draftTab(ctx, route) : noticedTab(ctx));

  return page({
    title: 'Assistant',
    subtitle: ctx.assistant.remoteAvailable
      ? `Insights on this device · drafting with ${ctx.assistant.config.model}`
      : 'Insights and drafts, computed on this device',
    children: [
      h('div', { style: { marginBottom: '18px' } },
        segmented({
          options: [{ value: 'noticed', label: 'What Shepherd noticed' }, { value: 'draft', label: 'Draft something' }],
          value: tab,
          onChange: (value) => ctx.navigate(`/assistant?tab=${value}`),
        })),
      body,
    ],
  });
}

/* ── noticed ─────────────────────────────────────────────────────────────── */

function noticedTab(ctx) {
  const insights = computeInsights(ctx.db, ctx.user, { settings: ctx.settings });
  if (!insights.length) {
    return emptyState({
      title: 'Nothing needs your attention',
      detail: 'No overdue follow-ups, no absences, no expiring documents, no budget lines running hot.',
      iconName: 'check',
    });
  }

  const groups = new Map();
  for (const insight of insights) {
    if (!groups.has(insight.kind)) groups.set(insight.kind, []);
    groups.get(insight.kind).push(insight);
  }

  return h('div.stack',
    card({
      children: [h('p.small.muted',
        'Everything below is computed from this church\'s own records, on this device. '
        + 'No model is involved and nothing is sent anywhere.')],
    }),
    ...[...groups].map(([kind, items]) => card({
      title: sentence(kind),
      children: [h('div.stack.stack--sm', ...items.map((insight) => h('div', { class: `insight insight--${insight.severity}` },
        h('span.insight__mark'),
        h('div', { style: { flex: '1', minWidth: 0 } },
          h('div.insight__title', insight.title),
          h('div.insight__detail', insight.detail)),
        insight.action
          ? h('button.btn.btn--sm', { onClick: () => ctx.navigate(insight.action.replace('#', '')) }, insight.actionLabel || 'Open')
          : null)))],
    })));
}

/* ── draft ───────────────────────────────────────────────────────────────── */

function draftTab(ctx, route) {
  let task = route.query.task || 'sermon.outline';
  const output = h('div');
  const inputs = h('div');

  const build = () => {
    inputs.textContent = '';
    const fields = FIELDS_FOR(task);
    const controls = fields.map((spec) => {
      const control = spec.type === 'textarea' ? textarea({ placeholder: spec.placeholder || '' })
        : spec.type === 'select' ? select({ options: spec.options, value: spec.options[0] })
        : input({ placeholder: spec.placeholder || '' });
      return { key: spec.key, control, node: field({ label: spec.label, control, full: spec.type === 'textarea' }) };
    });
    inputs.appendChild(h('div.form-grid', ...controls.map((c) => c.node)));
    inputs.appendChild(h('div.row', { style: { marginTop: '14px' } },
      h('button.btn.btn--primary', {
        onClick: async () => {
          const payload = { churchName: ctx.tenant.name };
          for (const { key, control } of controls) payload[key] = control.value;
          output.textContent = '';
          output.appendChild(card({ children: [h('p.small.muted', 'Working…')] }));
          const result = await ctx.assistant.run(task, payload);
          output.textContent = '';
          output.appendChild(card({
            title: AI_TASKS[task],
            children: [aiOutput({
              result,
              actions: [h('button.btn.btn--sm', {
                onClick: async () => {
                  try { await navigator.clipboard.writeText(result.text); toast('Copied.', { variant: 'ok' }); }
                  catch { toast('Select the text and copy it.'); }
                },
              }, 'Copy')],
            })],
          }));
        },
      }, icon('sparkles', { size: 15 }), 'Draft it')));
  };

  const picker = h('div.stack.stack--sm', ...TASK_GROUPS.map((group) => h('div', null,
    h('p.eyebrow', group.label),
    h('div.chip-list', ...group.tasks.map((id) => h('button.chip', {
      'aria-pressed': String(id === task),
      onClick: () => {
        task = id;
        for (const chip of picker.querySelectorAll('.chip')) chip.setAttribute('aria-pressed', 'false');
        picker.querySelectorAll('.chip').forEach((chip) => {
          if (chip.textContent === AI_TASKS[id]) chip.setAttribute('aria-pressed', 'true');
        });
        build();
      },
    }, AI_TASKS[id]))))));

  build();

  return h('div.stack',
    card({ title: 'What do you need?', children: [picker] }),
    card({ title: AI_TASKS[task] || 'Details', children: [inputs] }),
    output,
    card({
      children: [h('p.small.muted',
        'Every draft is labelled as AI-generated wherever it is stored or shown. '
        + 'Read it, change it, and take responsibility for it before anyone else sees it — '
        + 'this assists your preparation, it does not replace it.')],
    }));
}

function FIELDS_FOR(task) {
  switch (task) {
    case 'sermon.outline':
    case 'sermon.applications':
    case 'sermon.children':
    case 'sermon.youth':
    case 'sermon.smallgroup':
    case 'sermon.social':
      return [
        { key: 'title', label: 'Sermon title', placeholder: 'The God Who Sees' },
        { key: 'passage', label: 'Passage', placeholder: 'Genesis 16' },
        { key: 'bigIdea', label: 'Big idea', type: 'textarea', placeholder: 'One sentence you could say from memory.' },
      ];
    case 'bible.study':
      return [
        { key: 'topic', label: 'Topic or passage', placeholder: 'The Sermon on the Mount' },
      ];
    case 'meeting.agenda':
      return [
        { key: 'title', label: 'Meeting', placeholder: 'Church Council' },
        { key: 'date', label: 'Date', placeholder: 'First Tuesday' },
      ];
    case 'meeting.summary':
      return [
        { key: 'minutes', label: 'Minutes', type: 'textarea', placeholder: 'Paste the minutes here.' },
      ];
    case 'report.summary':
      return [
        { key: 'data', label: 'Figures', type: 'textarea', placeholder: 'Paste the numbers you want summarised.' },
      ];
    case 'announcement.draft':
    case 'message.whatsapp':
    case 'message.email':
      return [
        { key: 'subject', label: 'Subject', placeholder: 'Retreat registration' },
        { key: 'details', label: 'Details', type: 'textarea', placeholder: 'What, when, where, who it is for.' },
      ];
    case 'translate':
      return [
        { key: 'text', label: 'Text', type: 'textarea', placeholder: 'Paste what needs translating.' },
        { key: 'language', label: 'Into', type: 'select', options: LANGUAGES.filter((l) => l !== 'English') },
      ];
    case 'event.checklist':
      return [
        { key: 'title', label: 'Event', placeholder: 'Church retreat' },
        {
          key: 'type',
          label: 'Kind',
          type: 'select',
          options: ['retreat', 'baptism', 'conference', 'training', 'communion', 'other'],
        },
      ];
    case 'prayer.points':
      return [];
    default:
      return [{ key: 'prompt', label: 'What do you need?', type: 'textarea' }];
  }
}
