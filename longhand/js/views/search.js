/**
 * Search — everything, without a model.
 *
 * The distinction from AI Memory matters and the screen states it: this
 * finds the words that were said; AI Memory answers a question about them.
 * Search works offline, with no endpoint configured, and always will.
 */

import { h, icon } from '../core/dom.js';
import { clock, shortDate } from '../core/format.js';
import { section, rows, linkRow, empty, tag, searchField } from '../core/ui.js';
import { Router } from '../core/router.js';

export async function render(app, route) {
  const results = h('div.stack-6');
  let query = route.query.q || '';

  const input = searchField({
    value: query,
    placeholder: 'Search transcripts, meetings, tasks and decisions',
    onInput: (value) => { query = value; paint(); },
  });
  input.style.maxWidth = '560px';

  const paint = () => {
    const found = search(app, query);
    if (!query.trim()) {
      results.replaceChildren(empty({
        title: 'Search everything you have recorded.',
        body: 'Words from a transcript, a meeting title, a person, a task, a decision. Results open at the moment they were said.',
      }));
      return;
    }
    if (!found.total) {
      results.replaceChildren(empty({
        title: `Nothing matches “${query.trim()}”.`,
        body: 'Only recordings that have been transcribed can be searched. Try a different word, or ask AI Memory a question instead.',
        action: h('a.btn', { href: Router.href('memory', [], { q: query }) }, 'Ask AI Memory'),
      }));
      return;
    }
    results.replaceChildren(
      found.transcript.length ? section({ title: 'In transcripts', aside: `${found.transcript.length} passages` },
        rows(...found.transcript.map((hit) => transcriptHit(app, hit)))) : h('span'),
      found.meetings.length ? section({ title: 'Meetings' },
        rows(...found.meetings.map((meeting) => linkRow({
          href: Router.href('meeting', [meeting.id]),
          title: meeting.title,
          lines: [shortDate(meeting.startedAt)],
          side: [icon('chevron', { size: 15 })],
        })))) : h('span'),
      found.actions.length ? section({ title: 'Action items' },
        rows(...found.actions.map(({ action, meeting }) => linkRow({
          href: meeting ? Router.href('meeting', [meeting.id]) : null,
          title: action.task,
          lines: [[action.ownerName, meeting ? meeting.title : null].filter(Boolean).join(' · ')],
          side: [action.status === 'done' ? tag('Completed', 'done') : tag('Open')],
        })))) : h('span'),
      found.decisions.length ? section({ title: 'Decisions' },
        rows(...found.decisions.map(({ decision, meeting }) => linkRow({
          href: meeting ? Router.href('meeting', [meeting.id]) : null,
          title: decision.text,
          lines: [meeting ? meeting.title : ''],
          side: [icon('chevron', { size: 15 })],
        })))) : h('span'),
      found.people.length ? section({ title: 'People' },
        rows(...found.people.map((person) => linkRow({
          href: Router.href('people', [person.id]),
          title: person.name,
          side: [icon('chevron', { size: 15 })],
        })))) : h('span'));
  };

  paint();

  return h('div.view.stack-6',
    h('div.view__head', h('div.grow',
      h('h1.page-title', 'Search'),
      h('p.lede', { style: { marginTop: '6px' } }, 'Finds words that were actually said. For a question rather than a word, use AI Memory.'))),
    input,
    results);
}

/** Exported so the suite can check what a query does and does not match. */
export function search(app, query) {
  const words = String(query || '').trim().toLowerCase();
  const empty = { transcript: [], meetings: [], actions: [], decisions: [], people: [], total: 0 };
  if (words.length < 2) return empty;
  const db = app.db;

  const transcript = app.index.search(words, { limit: 12, minScore: 0.08 });
  const meetings = db.all('meetings').filter((m) => m.title.toLowerCase().includes(words)
    || String(m.summary || '').toLowerCase().includes(words)).slice(0, 8);
  const actions = db.all('actions')
    .filter((a) => `${a.task} ${a.ownerName} ${a.context}`.toLowerCase().includes(words))
    .slice(0, 8)
    .map((action) => ({ action, meeting: db.get('meetings', action.meetingId) }));
  const decisions = db.all('decisions')
    .filter((d) => d.text.toLowerCase().includes(words))
    .slice(0, 8)
    .map((decision) => ({ decision, meeting: db.get('meetings', decision.meetingId) }));
  const people = db.all('people').filter((p) => p.name.toLowerCase().includes(words)).slice(0, 6);

  return {
    transcript, meetings, actions, decisions, people,
    total: transcript.length + meetings.length + actions.length + decisions.length + people.length,
  };
}

function transcriptHit(app, hit) {
  const { chunk } = hit;
  return h('button.row-item', {
    type: 'button',
    onClick: () => app.go('meeting', [chunk.meetingId], { t: Math.floor(chunk.start), seg: chunk.segmentIds[0] }),
  },
  h('div.row-item__main',
    h('span.row-item__title', chunk.meetingTitle),
    h('span.body', { style: { color: 'var(--ink-2)' } }, `“${hit.snippet}”`),
    h('span.meta-sm', `${shortDate(chunk.meetingDate)} · ${clock(chunk.start)} · ${chunk.speakers.join(', ')}`)),
  h('div.row-item__side', icon('chevron', { size: 15 })));
}
