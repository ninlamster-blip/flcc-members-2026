/**
 * AI Memory — one question box over every conversation on this device.
 *
 * This screen is deliberately not a chat. There is no thread, no typing
 * indicator, no assistant persona: a question, an answer, and the excerpts
 * the answer stands on, which is what makes it usable as a record rather
 * than a conversation you have to re-read.
 */

import { h } from '../core/dom.js';
import { clock, shortDate, dayLabel } from '../core/format.js';
import { section, rows, button, empty, notice, spinner, toast, confirm } from '../core/ui.js';
import { ask, meetingsBehind, NOT_FOUND } from '../core/memory.js';

export async function render(app, route) {
  const db = app.db;
  const index = app.index;
  const output = h('div');
  const history = h('div');

  const input = h('textarea', {
    rows: 2,
    placeholder: 'Ask anything about your recorded conversations…',
    'aria-label': 'Ask your meetings',
    onInput: (event) => { event.target.style.height = 'auto'; event.target.style.height = `${event.target.scrollHeight}px`; },
    onKeydown: (event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); run(input.value); } },
  });
  const send = button('Ask', { variant: 'primary', onClick: () => run(input.value) });

  const meetings = db.all('meetings').filter((m) => !m.archived);
  const transcribed = meetings.filter((m) => db.where('segments', { meetingId: m.id }).length);

  async function run(question) {
    const asked = String(question || '').trim();
    if (!asked) { input.focus(); return; }
    input.value = asked;
    output.replaceChildren(h('div.row.meta', spinner(), `Searching ${index.size} passages from ${transcribed.length} meetings…`));
    send.disabled = true;
    try {
      const result = await ask({ db, index, question: asked, client: app.client });
      output.replaceChildren(answerPanel(app, result));
      paintHistory();
    } catch (err) {
      output.replaceChildren(err.name === 'ModelUnavailable'
        ? notice({
          tone: 'attention',
          title: 'No intelligence endpoint is configured',
          body: 'AI Memory needs an endpoint that can reach a language model. Your recordings and transcripts are unaffected, and Search still works without one.',
          actions: [h('a.btn.btn--sm', { href: '#/settings' }, 'Open settings'), h('a.btn.btn--sm', { href: '#/search' }, 'Search instead')],
        })
        : notice({ tone: 'error', title: 'That question could not be answered', body: err.message }));
    } finally {
      send.disabled = false;
    }
  }

  function paintHistory() {
    const asked = db.all('memory')
      .filter((entry) => entry.scope === 'all')
      .sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)))
      .slice(0, 12);
    history.replaceChildren(asked.length
      ? section({ title: 'Earlier questions' }, rows(...asked.map((entry) => historyRow(app, entry, run, paintHistory))))
      : h('span'));
  }

  const view = h('div.view.view--reading.stack-6',
    h('div',
      h('h1.page-title', 'AI Memory'),
      h('p.lede', { style: { marginTop: '6px' } },
        transcribed.length
          ? `Ask across ${transcribed.length} transcribed ${transcribed.length === 1 ? 'meeting' : 'meetings'}. Every answer shows the passages it came from.`
          : 'Once a meeting has been transcribed, you can ask questions about it here.')),
    h('div.ask', input, send),
    suggestions(db, transcribed, run),
    output,
    history);

  paintHistory();

  if (!transcribed.length) {
    output.replaceChildren(empty({
      title: 'Nothing to remember yet.',
      body: 'AI Memory answers only from your own recordings. Record and transcribe a meeting and it becomes searchable here.',
      action: h('a.btn.btn--primary', { href: '#/record' }, 'Start recording'),
    }));
  } else if (route.query.q) {
    run(route.query.q);
  }

  return view;
}

/** Suggestions built from the user's own topics and people — never generic. */
function suggestions(db, meetings, run) {
  const topics = db.all('topics').map((t) => t.name);
  const people = db.all('people').map((p) => p.name);
  const options = [];
  if (topics.length) options.push(`What was said about ${mostCommon(topics).toLowerCase()}?`);
  if (people.length) options.push(`What did ${people[0].split(/\s+/)[0]} commit to?`);
  options.push('What did I agree to this month?');
  if (meetings.length > 1) options.push('What is still unresolved across these meetings?');

  return h('div.suggestions', ...options.slice(0, 4).map((text) =>
    h('button.suggestion', { type: 'button', onClick: () => run(text) }, text)));
}

function mostCommon(values) {
  const counts = new Map();
  for (const value of values) counts.set(value, (counts.get(value) || 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0][0];
}

function answerPanel(app, result) {
  if (!result.answered) {
    return h('div.stack',
      h('p.answer__text', NOT_FOUND),
      h('p.meta', 'Nothing in your transcripts covers this. Try naming a person, a project or a month you know was recorded.'));
  }

  const behind = meetingsBehind(result.sources);
  const panel = h('div.answer',
    behind.length > 1
      ? h('p.meta', `Drawn from ${behind.length} meetings — ${behind.map((m) => m.title).join(', ')}.`)
      : null,
    h('p.answer__text', result.answer));

  if (result.unsupported) {
    panel.appendChild(h('p.meta-sm', 'No passage could be matched to this answer — treat it with care.'));
  }

  if (result.sources.length) {
    panel.appendChild(h('div.sources',
      h('span.subhead', 'Sources'),
      ...result.sources.map((source) => h('button.source', {
        type: 'button',
        onClick: () => app.go('meeting', [source.meetingId], { t: Math.floor(source.start), seg: source.segmentIds[0] }),
      },
      h('span.source__ref.num', clock(source.start)),
      h('span',
        h('span.source__quote', `“${source.quote}”`),
        h('span.source__where', ` — ${source.meetingTitle}, ${shortDate(source.meetingDate)}`))))));
  }
  return panel;
}

function historyRow(app, entry, run, paintHistory) {
  const remove = button('', { iconName: 'trash', variant: 'quiet', size: 'sm', title: 'Delete this question' });
  remove.addEventListener('click', async (event) => {
    event.stopPropagation();
    if (await confirm({ title: 'Delete this question?', body: 'The question and its answer are removed. Your meetings are unaffected.', confirmLabel: 'Delete', danger: true })) {
      app.db.remove('memory', entry.id);
      toast('Deleted.');
      paintHistory();
    }
  });
  return h('button.row-item', { type: 'button', onClick: () => run(entry.question) },
    h('div.row-item__main',
      h('span.row-item__title', entry.question),
      h('span.meta.clamp-2', entry.answer)),
    h('div.row-item__side',
      h('span.meta-sm', dayLabel(entry.createdAt)),
      entry.sources && entry.sources.length ? h('span.meta-sm', `${entry.sources.length} sources`) : null,
      remove));
}
