/**
 * Communications — announcements, and messages ready to send.
 *
 * Shepherd does not send anything itself. A church in Kuwait reaches people
 * on WhatsApp, and no platform should pretend otherwise or ask for a
 * broadcast API it cannot honestly provide. What this module does is prepare
 * the message properly — right audience, right language, right length — and
 * hand it over: copy to clipboard, open WhatsApp, open a mail client, or
 * print for the bulletin.
 *
 * Anything drafted by AI carries its label until a human edits and approves
 * it, and the approval is recorded.
 */

import { h, icon } from '../core/dom.js';
import {
  page, card, list, listItem, emptyState, badge, segmented, statCard, searchField,
  toast, modal, aiOutput, formModal, field, input, textarea, select, avatar,
} from '../core/ui.js';
import { formatDate, formatDateTime, relativeTime, isoDate, daysUntilAnnual } from '../core/format.js';
import { blank } from '../core/schema.js';
import { LANGUAGES } from '../core/ai.js';
import { upcomingCelebrations } from '../core/ai.js';
import { openRecordModal, newButton, statusBadge, memberName, matches, sentence, deleteRecord } from './_shared.js';

const CHANNELS = [
  { value: 'whatsapp', label: 'WhatsApp' },
  { value: 'email', label: 'Email' },
  { value: 'sms', label: 'SMS' },
  { value: 'app', label: 'In-app' },
  { value: 'bulletin', label: 'Bulletin' },
];

export async function render(ctx, route) {
  const tab = route.query.tab || 'announcements';

  if (route.query.greet) {
    const member = ctx.db.find('members', route.query.greet);
    if (member) setTimeout(() => greetingComposer(ctx, member, route.query.kind || 'birthday'), 0);
  }

  const body = h('div');
  body.appendChild(tab === 'compose' ? composeTab(ctx) : tab === 'reminders' ? remindersTab(ctx) : announcementsTab(ctx));

  const announcements = ctx.db.all('announcements');

  return page({
    title: 'Communications',
    subtitle: 'Prepared here, sent from your own phone or mailbox.',
    actions: [newButton(ctx, 'communications', 'New announcement', () => openRecordModal(ctx, { collection: 'announcements' }))].filter(Boolean),
    children: [
      h('div.grid.grid--4', { style: { marginBottom: '18px' } },
        statCard({ value: announcements.filter((a) => a.status === 'draft').length, label: 'Drafts' }),
        statCard({ value: announcements.filter((a) => a.status === 'sent').length, label: 'Sent' }),
        statCard({ value: upcomingCelebrations(ctx.db, { days: 7 }).length, label: 'Greetings due this week' }),
        statCard({ value: ctx.db.where('events', (e) => new Date(e.startsAt) > new Date()).length, label: 'Events to announce' })),
      h('div', { style: { marginBottom: '18px' } },
        segmented({
          options: [
            { value: 'announcements', label: 'Announcements' },
            { value: 'compose', label: 'Compose' },
            { value: 'reminders', label: 'Reminders & greetings' },
          ],
          value: tab,
          onChange: (value) => ctx.navigate(`/communications?tab=${value}`),
        })),
      body,
    ],
  });
}

/* ── announcements ───────────────────────────────────────────────────────── */

function announcementsTab(ctx) {
  const { db } = ctx;
  let query = '';
  const results = h('div');

  const draw = () => {
    const announcements = db.all('announcements')
      .filter((a) => matches(a, query, ['title', 'body', 'channel', 'audience']))
      .sort((a, b) => new Date(b.updatedAt) - new Date(a.updatedAt));

    results.textContent = '';
    results.appendChild(announcements.length
      ? h('div.stack.stack--sm', ...announcements.map((announcement) => card({
        tight: true,
        children: [
          h('div.row.row--between',
            h('div', null,
              h('strong', announcement.title),
              h('div.tiny.subtle', [
                sentence(announcement.channel),
                sentence(announcement.audience),
                announcement.language,
                announcement.sentAt ? `sent ${relativeTime(announcement.sentAt)}` : `updated ${relativeTime(announcement.updatedAt)}`,
              ].filter(Boolean).join(' · '))),
            h('div.row',
              announcement.aiGenerated ? badge('AI drafted', 'ai') : null,
              statusBadge(announcement.status))),
          h('p.small.prose', { style: { marginTop: '10px' } }, announcement.body),
          h('div.row', { style: { marginTop: '12px' } },
            h('button.btn.btn--sm', { onClick: () => sendSheet(ctx, announcement) }, icon('megaphone', { size: 14 }), 'Send'),
            ctx.can('communications:write')
              ? h('button.btn.btn--sm', { onClick: () => openRecordModal(ctx, { collection: 'announcements', doc: announcement }) }, 'Edit')
              : null,
            ctx.can('communications:write') && announcement.status === 'draft'
              ? h('button.btn.btn--sm', {
                onClick: async () => {
                  ctx.db.update('announcements', announcement.id, { status: 'approved' });
                  await ctx.db.flush();
                  toast('Approved for sending.', { variant: 'ok' });
                  ctx.refresh();
                },
              }, icon('check', { size: 14 }), 'Approve')
              : null,
            h('div.spacer'),
            ctx.can('communications:delete')
              ? h('button.icon-btn', { 'aria-label': 'Delete', onClick: () => deleteRecord(ctx, 'announcements', announcement.id, announcement.title) }, icon('trash', { size: 15 }))
              : null),
        ],
      })))
      : emptyState({
        title: 'No announcements',
        detail: 'Write once, then send it as WhatsApp, email, SMS or a bulletin item.',
        iconName: 'megaphone',
        action: newButton(ctx, 'communications', 'New announcement', () => openRecordModal(ctx, { collection: 'announcements' })),
      }));
  };

  const wrap = h('div.stack',
    searchField({ placeholder: 'Search announcements…', onInput: (value) => { query = value; draw(); } }),
    results);
  draw();
  return wrap;
}

/** The hand-off: copy, WhatsApp, email, print. Marks it sent, with a record. */
function sendSheet(ctx, announcement) {
  const text = `${announcement.title}\n\n${announcement.body}\n\n— ${ctx.tenant.name}`;
  const area = h('textarea.textarea', { style: { minHeight: '200px' }, value: text }, text);

  const markSent = async () => {
    if (!ctx.can('communications:write')) return;
    ctx.db.update('announcements', announcement.id, { status: 'sent', sentAt: new Date().toISOString() });
    await ctx.db.flush();
    ctx.refresh();
  };

  const ref = modal({
    title: 'Send',
    body: h('div.stack',
      announcement.aiGenerated && announcement.status === 'draft'
        ? h('div.insight.insight--attention',
          h('span.insight__mark'),
          h('div', null,
            h('div.insight__title', 'This was drafted by AI and has not been approved'),
            h('div.insight__detail', 'Read it through and edit it before it goes to the congregation.')))
        : null,
      area,
      h('div.quick-actions',
        h('button.quick-action', {
          onClick: async () => {
            try { await navigator.clipboard.writeText(area.value); toast('Copied.', { variant: 'ok' }); }
            catch { toast('Select the text and copy it.'); }
            markSent();
          },
        }, icon('file', { size: 16 }), 'Copy text'),
        h('a.quick-action', {
          href: `https://wa.me/?text=${encodeURIComponent(area.value)}`,
          target: '_blank', rel: 'noopener',
          onClick: () => markSent(),
        }, icon('megaphone', { size: 16 }), 'Open WhatsApp'),
        h('a.quick-action', {
          href: `mailto:?subject=${encodeURIComponent(announcement.title)}&body=${encodeURIComponent(area.value)}`,
          onClick: () => markSent(),
        }, icon('mail', { size: 16 }), 'Open email'),
        h('button.quick-action', { onClick: () => { window.print(); markSent(); } }, icon('file', { size: 16 }), 'Print'))),
    actions: [h('button.btn', { onClick: () => ref.close() }, 'Done')],
  });
}

/* ── compose ─────────────────────────────────────────────────────────────── */

function composeTab(ctx) {
  const subject = input({ placeholder: 'What is this about?' });
  const details = textarea({ placeholder: 'The details: what, when, where, who it is for.' });
  const channel = select({ options: CHANNELS, value: 'whatsapp' });
  const audience = select({
    options: [
      { value: 'everyone', label: 'Everyone' }, { value: 'members', label: 'Members' },
      { value: 'leaders', label: 'Leaders' }, { value: 'volunteers', label: 'Volunteers' },
    ],
    value: 'everyone',
  });
  const language = select({ options: LANGUAGES, value: 'English' });
  const output = h('div');

  const draft = async () => {
    if (!subject.value.trim()) {
      toast('Give it a subject first.');
      return;
    }
    output.textContent = '';
    output.appendChild(h('p.small.muted', 'Drafting…'));
    const task = channel.value === 'whatsapp' ? 'message.whatsapp'
      : channel.value === 'email' ? 'message.email'
      : 'announcement.draft';
    const result = await ctx.assistant.run(task, {
      subject: subject.value,
      details: details.value,
      audience: audience.value,
      churchName: ctx.tenant.name,
    });

    const editable = h('textarea.textarea', { style: { minHeight: '200px' }, value: result.text }, result.text);
    output.textContent = '';
    output.appendChild(h('div.stack',
      aiOutput({ result, actions: [] }),
      h('div.field',
        h('label.field__label', 'Edit before you use it'),
        editable),
      h('div.row',
        ctx.can('communications:write') ? h('button.btn.btn--primary', {
          onClick: async () => {
            ctx.db.insert('announcements', blank('announcements', {
              title: subject.value,
              body: editable.value,
              channel: channel.value,
              audience: audience.value,
              language: language.value,
              status: 'draft',
              aiGenerated: editable.value.trim() === result.text.trim(),
            }));
            await ctx.db.flush();
            toast('Saved as a draft announcement.', { variant: 'ok' });
            ctx.navigate('/communications?tab=announcements');
          },
        }, 'Save as draft') : null,
        language.value !== 'English' ? h('button.btn', {
          onClick: async () => {
            const translated = await ctx.assistant.run('translate', { text: editable.value, language: language.value });
            editable.value = translated.text;
            toast(`Translated into ${language.value}. Have a native speaker read it before sending.`, {});
          },
        }, `Translate to ${language.value}`) : null)));
  };

  return h('div.stack',
    card({
      title: 'Compose a message',
      subtitle: 'Say what you want to communicate; Shepherd shapes it for the channel.',
      children: [
        h('div.form-grid',
          field({ label: 'Subject', control: subject, full: true }),
          field({ label: 'Details', control: details, full: true }),
          field({ label: 'Channel', control: channel }),
          field({ label: 'Audience', control: audience }),
          field({ label: 'Language', control: language, help: 'Translation needs an AI service.' })),
        h('div.row', { style: { marginTop: '12px' } },
          h('button.btn.btn--primary', { onClick: draft }, icon('sparkles', { size: 15 }), 'Draft it')),
      ],
    }),
    output);
}

/* ── reminders & greetings ───────────────────────────────────────────────── */

function remindersTab(ctx) {
  const { db } = ctx;
  const now = new Date();
  const celebrations = upcomingCelebrations(db, { now, days: 14 });
  const events = db.where('events', (e) => new Date(e.startsAt) > now && e.status !== 'cancelled')
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt))
    .slice(0, 6);
  const rotas = db.all('eventTasks').filter((task) => {
    if (!task.ownerId || task.done) return false;
    const event = db.find('events', task.eventId);
    return !!event && new Date(event.startsAt) > now;
  });

  return h('div.stack',
    card({
      title: 'Birthdays & anniversaries',
      subtitle: 'Next fortnight',
      children: [celebrations.length
        ? list(celebrations.map((celebration) => listItem({
          leading: avatar(celebration.name, { size: 'sm' }),
          title: celebration.name,
          meta: `${sentence(celebration.label)} · ${celebration.inDays === 0 ? 'today' : formatDate(celebration.date)}`,
          trailing: h('button.btn.btn--sm', {
            onClick: (e) => {
              e.stopPropagation();
              const member = db.find('members', celebration.memberId);
              if (member) greetingComposer(ctx, member, celebration.label);
            },
          }, 'Write greeting'),
        })))
        : h('p.small.muted', 'None this fortnight.')],
    }),
    card({
      title: 'Events to announce',
      children: [events.length
        ? list(events.map((event) => listItem({
          leading: icon('calendar', { size: 16 }),
          title: event.title,
          meta: `${formatDateTime(event.startsAt)}${event.venue ? ` · ${event.venue}` : ''}`,
          trailing: ctx.can('communications:write') ? h('button.btn.btn--sm', {
            onClick: (e) => {
              e.stopPropagation();
              openRecordModal(ctx, {
                collection: 'announcements',
                defaults: {
                  title: event.title,
                  body: `${event.title}\n${formatDateTime(event.startsAt)}${event.venue ? `\n${event.venue}` : ''}\n\n${event.description || ''}`.trim(),
                  channel: 'whatsapp',
                },
              });
            },
          }, 'Announce') : null,
        })))
        : h('p.small.muted', 'Nothing coming up.')],
    }),
    card({
      title: 'Volunteer reminders',
      subtitle: 'People with an upcoming job on an event',
      children: [rotas.length
        ? list(rotas.slice(0, 12).map((task) => {
          const event = db.find('events', task.eventId);
          return listItem({
            leading: avatar(memberName(db, task.ownerId), { size: 'sm' }),
            title: memberName(db, task.ownerId),
            meta: `${task.title} · ${event.title} · ${formatDate(event.startsAt)}`,
            trailing: h('button.btn.btn--sm', {
              onClick: async () => {
                const member = db.find('members', task.ownerId);
                const text = `Hi ${member ? member.fullName.split(' ')[0] : 'there'} — a reminder that you are on ${task.title} for ${event.title}, ${formatDateTime(event.startsAt)}${event.venue ? ` at ${event.venue}` : ''}. Thank you for serving.\n\n— ${ctx.tenant.name}`;
                try { await navigator.clipboard.writeText(text); toast('Reminder copied.', { variant: 'ok' }); }
                catch { toast(text); }
              },
            }, 'Copy reminder'),
          });
        }))
        : h('p.small.muted', 'No upcoming assignments.')],
    }));
}

function greetingComposer(ctx, member, kind) {
  const first = String(member.fullName).split(' ')[0];
  const text = kind === 'anniversary'
    ? `Happy anniversary, ${first}! We thank God for your marriage and for both of you in our church family. May this year be full of grace.\n\n— ${ctx.tenant.name}`
    : `Happy birthday, ${first}! We thank God for you today and pray this year is full of his kindness towards you.\n\n— ${ctx.tenant.name}`;
  const area = h('textarea.textarea', { style: { minHeight: '160px' }, value: text }, text);
  const phone = String(member.whatsapp || member.phone || '').replace(/[^0-9]/g, '');

  const ref = modal({
    title: `Greeting for ${member.fullName}`,
    body: h('div.stack',
      area,
      h('div.quick-actions',
        h('button.quick-action', {
          onClick: async () => {
            try { await navigator.clipboard.writeText(area.value); toast('Copied.', { variant: 'ok' }); }
            catch { toast('Select the text and copy it.'); }
          },
        }, icon('file', { size: 16 }), 'Copy'),
        phone ? h('a.quick-action', {
          href: `https://wa.me/${phone}?text=${encodeURIComponent(area.value)}`,
          target: '_blank', rel: 'noopener',
        }, icon('megaphone', { size: 16 }), 'WhatsApp') : null,
        member.email ? h('a.quick-action', {
          href: `mailto:${member.email}?subject=${encodeURIComponent(kind === 'anniversary' ? 'Happy anniversary' : 'Happy birthday')}&body=${encodeURIComponent(area.value)}`,
        }, icon('mail', { size: 16 }), 'Email') : null)),
    actions: [h('button.btn', { onClick: () => ref.close() }, 'Done')],
  });
}
