/**
 * People — who talks in these meetings, and what follows them around.
 *
 * A person exists here because a speaker was named on a transcript, not
 * because someone filled in a form. Everything on the page is derived.
 */

import { h, icon } from '../core/dom.js';
import { initials, shortDate, duration, dueLabel } from '../core/format.js';
import { section, rows, linkRow, button, tag, empty, promptDialog, confirm, toast } from '../core/ui.js';
import { Router } from '../core/router.js';

export async function render(app, route) {
  const db = app.db;
  const personId = route.params[0];
  return personId ? personPage(app, personId) : directory(app);
}

function directory(app) {
  const db = app.db;
  const people = db.all('people')
    .map((person) => ({ person, ...facts(db, person) }))
    .sort((a, b) => b.meetings.length - a.meetings.length || a.person.name.localeCompare(b.person.name));

  const view = h('div.view.stack',
    h('div.view__head', h('div.grow',
      h('h1.page-title', 'People'),
      h('p.lede', { style: { marginTop: '6px' } },
        'Everyone who has been named as a speaker. Rename a speaker on any transcript and they appear here.'))));

  if (!people.length) {
    view.appendChild(empty({
      title: 'No one named yet.',
      body: 'Transcripts start with “Speaker 1”, “Speaker 2”. Rename a speaker on a meeting page and that person is added here, with everything they said and were assigned.',
      action: h('a.btn', { href: '#/meetings' }, 'Open a meeting'),
    }));
    return view;
  }

  view.appendChild(rows(...people.map(({ person, meetings, actions, topics }) => linkRow({
    href: Router.href('people', [person.id]),
    leading: h('span.tag', { style: { minWidth: '34px', justifyContent: 'center', height: '34px', borderRadius: '8px' } }, initials(person.name)),
    title: person.name,
    lines: [[
      `${meetings.length} ${meetings.length === 1 ? 'meeting' : 'meetings'}`,
      actions.filter((a) => a.status === 'open').length ? `${actions.filter((a) => a.status === 'open').length} open action items` : null,
      topics.length ? topics.slice(0, 3).join(' · ') : null,
    ].filter(Boolean).join(' · ')],
    side: [icon('chevron', { size: 15 })],
  }))));
  return view;
}

function facts(db, person) {
  const speakers = db.all('speakers').filter((speaker) => speaker.personId === person.id);
  const meetingIds = [...new Set(speakers.map((speaker) => speaker.meetingId))];
  const meetings = meetingIds.map((id) => db.get('meetings', id)).filter(Boolean)
    .sort((a, b) => String(b.startedAt).localeCompare(String(a.startedAt)));
  const actions = db.all('actions').filter((action) => action.personId === person.id
    || (action.ownerName && action.ownerName.toLowerCase() === person.name.toLowerCase()));
  const topics = [...new Set(meetingIds.flatMap((id) => db.where('topics', { meetingId: id }).map((t) => t.name)))];
  return { speakers, meetings, actions, topics };
}

function personPage(app, personId) {
  const db = app.db;
  const person = db.get('people', personId);
  if (!person) {
    return h('div.view', empty({ title: 'That person is not on this device.', action: h('a.btn', { href: '#/people' }, 'All people') }));
  }
  const { speakers, meetings, actions, topics } = facts(db, person);

  const view = h('div.view.view--reading.stack-6',
    h('div.stack-2',
      h('div.row.row--between',
        h('h1.page-title', person.name),
        h('div.row.row--tight',
          button('Rename', { size: 'sm', onClick: async () => {
            const name = await promptDialog({ title: 'Rename person', label: 'Name', value: person.name });
            if (!name) return;
            db.update('people', personId, { name });
            for (const speaker of speakers) db.update('speakers', speaker.id, { label: name });
            toast('Renamed.');
            app.refresh();
          } }),
          button('Remove', { size: 'sm', variant: 'danger', onClick: async () => {
            if (await confirm({
              title: `Remove ${person.name}?`,
              body: 'Their transcripts stay exactly as they are — the lines simply go back to being an unnamed speaker.',
              confirmLabel: 'Remove', danger: true,
            })) {
              for (const speaker of speakers) db.update('speakers', speaker.id, { personId: null, label: `Speaker ${speaker.order + 1}` });
              db.remove('people', personId);
              toast('Removed.');
              app.go('people');
            }
          } }))),
      h('p.meta', [
        `${meetings.length} ${meetings.length === 1 ? 'meeting' : 'meetings'}`,
        actions.length ? `${actions.length} action ${actions.length === 1 ? 'item' : 'items'}` : null,
        meetings.length ? `since ${shortDate(meetings[meetings.length - 1].startedAt)}` : null,
      ].filter(Boolean).join(' · '))));

  if (actions.length) {
    view.appendChild(section({ title: 'Action items' },
      rows(...actions.map((action) => {
        const meeting = db.get('meetings', action.meetingId);
        const due = dueLabel(action.dueDate);
        return linkRow({
          href: meeting ? Router.href('meeting', [meeting.id]) : null,
          onClick: meeting ? null : () => {},
          title: action.task,
          lines: [[meeting ? meeting.title : 'meeting deleted', action.context].filter(Boolean).join(' · ')],
          side: [
            due ? tag(due, due === 'Overdue' && action.status !== 'done' ? 'attention' : '') : null,
            action.status === 'done' ? tag('Completed', 'done') : null,
          ].filter(Boolean),
        });
      }))));
  }

  if (topics.length) {
    view.appendChild(section({ title: 'Topics in their meetings' },
      h('div.row.row--tight', ...topics.slice(0, 14).map((name) =>
        h('a.suggestion', { href: Router.href('search', [], { q: name }) }, name)))));
  }

  view.appendChild(section({ title: 'Meetings' },
    meetings.length
      ? rows(...meetings.map((meeting) => linkRow({
        href: Router.href('meeting', [meeting.id]),
        title: meeting.title,
        lines: [[shortDate(meeting.startedAt), duration(meeting.durationSec)].join(' · ')],
        side: [icon('chevron', { size: 15 })],
      })))
      : h('p.meta', 'No meetings.')));

  view.appendChild(section({ title: 'Ask about them' },
    h('div.suggestions',
      ...[`What did ${person.name.split(/\s+/)[0]} commit to?`, `What did ${person.name.split(/\s+/)[0]} say about the budget?`]
        .map((question) => h('a.suggestion', { href: Router.href('memory', [], { q: question }) }, question)))));

  return view;
}
