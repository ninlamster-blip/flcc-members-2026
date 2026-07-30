/**
 * The intelligence layer.
 *
 * Two halves, and the split matters:
 *
 *   1. INSIGHTS — computed, on-device, always available. "Twelve people have
 *      not been seen in three weeks", "the lease expires in 40 days", "the
 *      youth rota is two volunteers short on Friday". No model, no network,
 *      no data leaving the building. This is most of what a pastor actually
 *      needs, and it works on a phone with no signal.
 *
 *   2. GENERATION — drafting: sermon outlines, meeting summaries,
 *      announcements, translations. Uses a language model when the church has
 *      configured an endpoint; falls back to structured local drafts built
 *      from the church's own records when it has not. Either way the result
 *      is labelled.
 *
 * EVERY generated artefact carries `aiGenerated: true` plus the model and the
 * time. The UI renders that as a visible badge and requires acknowledgement
 * before anything is marked as sent — a church should never quote a machine
 * to its congregation without knowing it did.
 */

import { daysUntilAnnual, daysBetween, isoDate, formatMoney, formatDate } from './format.js';
import { can } from './rbac.js';
import { isCommunionScheduled, canEnrollInCourse } from './policies.js';

/* ── configuration ───────────────────────────────────────────────────────── */

/**
 * @typedef {object} AIConfig
 * @property {string} endpoint  HTTPS endpoint that proxies a model. Empty = local only.
 * @property {string} secret    Sent as `x-proxy-secret`.
 * @property {string} model
 * @property {boolean} enabled
 */

/** @type {AIConfig} */
export const DEFAULT_AI_CONFIG = { endpoint: '', secret: '', model: 'claude-sonnet-4-5', enabled: true };

export const AI_TASKS = {
  'sermon.outline':      'Sermon outline',
  'sermon.applications': 'Applications & discussion questions',
  'sermon.children':     "Children's version",
  'sermon.youth':        'Youth version',
  'sermon.smallgroup':   'Small-group guide',
  'sermon.social':       'Social media summary',
  'meeting.agenda':      'Meeting agenda',
  'meeting.summary':     'Meeting summary & action items',
  'announcement.draft':  'Announcement',
  'message.whatsapp':    'WhatsApp message',
  'message.email':       'Email',
  'prayer.points':       'Prayer points',
  'event.checklist':     'Event checklist',
  'report.summary':      'Report summary',
  'translate':           'Translation',
  'knowledge.answer':    'Answer from church documents',
  'bible.study':         'Bible study',
  'assistant.ask':       'Ask Shepherd',
  'equip.explain':       'Explain a passage',
  'equip.summary':       'Lesson summary',
  'equip.quiz':          'Study questions & memory verse',
  'equip.coach':         'Learning encouragement & next step',
};

export const LANGUAGES = ['English', 'Arabic', 'Tagalog'];

/* ── the assistant ───────────────────────────────────────────────────────── */

export class Assistant {
  /**
   * @param {{db: import('./db.js').Database, search?: import('./search.js').SearchIndex,
   *          config?: Partial<AIConfig>, fetchImpl?: typeof fetch}} options
   */
  constructor({ db, search = null, config = {}, fetchImpl } = {}) {
    this.db = db;
    this.search = search;
    this.config = { ...DEFAULT_AI_CONFIG, ...config };
    this.fetch = fetchImpl || (typeof fetch === 'function' ? fetch.bind(globalThis) : null);
  }

  setConfig(partial) {
    this.config = { ...this.config, ...partial };
  }

  get remoteAvailable() {
    return !!(this.config.enabled && this.config.endpoint && this.fetch);
  }

  /**
   * Run a task.
   * @param {keyof typeof AI_TASKS} task
   * @param {object} input
   * @returns {Promise<{task: string, text: string, aiGenerated: true, model: string,
   *                    createdAt: string, source: 'model'|'local', sources?: object[]}>}
   */
  async run(task, input = {}) {
    const started = Date.now();
    const local = buildLocalDraft(task, input, this.db);
    let text = local.text;
    let source = /** @type {'model'|'local'} */ ('local');
    let model = 'shepherd-local';

    if (this.remoteAvailable) {
      try {
        const response = await this._callModel(local.prompt, local.system);
        if (response) {
          text = response;
          source = 'model';
          model = this.config.model;
        }
      } catch (err) {
        // A failed model call must never lose the user's work: the local draft
        // is already in hand, so hand that over and say why.
        text = `${local.text}\n\n— Drafted on this device: the AI service could not be reached (${err.message}).`;
      }
    }

    const result = {
      task,
      text,
      aiGenerated: true,
      model,
      source,
      createdAt: new Date().toISOString(),
      tookMs: Date.now() - started,
      sources: local.sources || [],
    };
    if (this.db && this.db.actor) {
      this.db.log('ai.generate', `${AI_TASKS[task] || task} generated with ${model}.`);
    }
    return result;
  }

  async _callModel(prompt, system) {
    const body = {
      model: this.config.model,
      max_tokens: 1600,
      system,
      messages: [{ role: 'user', content: prompt }],
    };
    const res = await this.fetch(this.config.endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(this.config.secret ? { 'x-proxy-secret': this.config.secret } : {}),
      },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    // Anthropic Messages shape, or a plain { text }.
    if (Array.isArray(data.content)) {
      return data.content.filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
    }
    return String(data.text || data.completion || '').trim() || null;
  }

  /**
   * Answer a natural-language question using ONLY records this user may read.
   * Powers the Knowledge Centre's "ask your documents" box — deliberately
   * confined, because that screen's whole point is "what does the church's
   * own paperwork say".
   * @param {string} question
   * @param {object} user
   */
  async answer(question, user) {
    const hits = this.search ? this.search.search(question, { user, limit: 6 }) : [];
    const context = hits.map((hit, i) => `[${i + 1}] ${hit.title} — ${hit.snippet}`).join('\n');
    const result = await this.run('knowledge.answer', { question, context, hits });
    return { ...result, sources: hits };
  }

  /**
   * A general-purpose question — the Assistant screen's "Ask Shepherd" box.
   * Unlike `answer()`, this is not confined to the church's own paperwork:
   * scripture, theology, ministry practice, and the world outside the app
   * are all fair game. Relevant records this user may read are still pulled
   * in as optional context, permission-filtered the same way, so "when's
   * the next elders' meeting" gets a real answer alongside "what does
   * Ephesians 4 mean".
   * @param {string} question
   * @param {object} user
   */
  async ask(question, user) {
    const hits = this.search ? this.search.search(question, { user, limit: 6 }) : [];
    const context = hits.map((hit, i) => `[${i + 1}] ${hit.title} — ${hit.snippet}`).join('\n');
    const result = await this.run('assistant.ask', { question, context, hits });
    return { ...result, sources: hits };
  }
}

/* ── local drafting ──────────────────────────────────────────────────────── */

const SYSTEM = `You are Shepherd, an assistant for church leaders in Kuwait and the wider Gulf.
Write plainly and warmly. Assume a multicultural congregation (Filipino, Indian, Arab, Western).
Draw freely on your general knowledge — scripture, theology, church history, ministry practice,
world events, and everyday facts — wherever it helps; do not limit yourself to what is in the app.
The one thing you must never do is invent specific facts about THIS church (its people, numbers,
history, or decisions) that were not given to you — say plainly when you don't know one of those.
You assist a pastor's preparation; you never replace it.`;

/**
 * Build the local draft AND the prompt that would be sent to a model. The
 * local draft is a real, usable artefact — it is assembled from the church's
 * own records, not filler.
 *
 * @returns {{text: string, prompt: string, system: string, sources?: object[]}}
 */
export function buildLocalDraft(task, input, db) {
  const church = (input && input.churchName) || 'the church';
  switch (task) {
    case 'sermon.outline': {
      const { title = 'Untitled', passage = '', bigIdea = '' } = input;
      return {
        system: SYSTEM,
        prompt: `Draft a preaching outline.\nTitle: ${title}\nPassage: ${passage}\nBig idea: ${bigIdea}\n`
          + 'Give: one-sentence big idea, three movements each with the verses it rests on, '
          + 'an introduction that earns attention, and a closing call. Keep it a skeleton the preacher fills.',
        text: [
          `# ${title}`,
          passage ? `**Passage** ${passage}` : '',
          bigIdea ? `**Big idea** ${bigIdea}` : '**Big idea** _one sentence you could say from memory_',
          '',
          '## Introduction',
          '- Open with something the congregation already feels this week.',
          `- Name the tension the passage answers${passage ? ` in ${passage}` : ''}.`,
          '',
          '## Movement 1 — What the text says',
          '- Read the passage; explain its setting in one or two sentences.',
          '- The one thing the original hearers would not have missed.',
          '',
          '## Movement 2 — What it means',
          '- The doctrine underneath, stated simply.',
          '- Where the congregation would misread it, and why.',
          '',
          '## Movement 3 — What it asks of us',
          '- One concrete change for this week, not five vague ones.',
          '',
          '## Close',
          '- Return to the introduction and answer it.',
          '- A sentence a tired person could carry home.',
        ].filter(Boolean).join('\n'),
      };
    }

    case 'sermon.applications': {
      const { title = '', passage = '' } = input;
      return {
        system: SYSTEM,
        prompt: `For a sermon titled "${title}" on ${passage}, give six discussion questions (two observation, two interpretation, two application) and three concrete applications for working adults, families, and single migrant workers.`,
        text: [
          '## Discussion questions',
          '1. What does the passage actually say — in your own words?',
          '2. Which detail did you not notice before?',
          '3. What does this tell us about God?',
          '4. What does it assume about people?',
          '5. Where does this press on your week?',
          '6. What would obedience look like by Friday?',
          '',
          '## Applications',
          '- **For workers on long shifts:** one habit that survives a 12-hour day.',
          '- **For families:** one conversation to have at the table this week.',
          '- **For those far from home:** one way to receive care, not only give it.',
        ].join('\n'),
      };
    }

    case 'sermon.children':
      return {
        system: SYSTEM,
        prompt: `Rewrite this sermon for children aged 6–11: "${input.title}" (${input.passage}). One big idea, a story, an activity, a memory verse. Simple words, no abstraction.`,
        text: [
          `## ${input.title || 'This Sunday'} — for children`,
          '**Big idea (say it three times):** _one short sentence_',
          '**Story:** tell the passage as a story, with one character to follow.',
          '**Ask:** two questions they can answer out loud.',
          '**Do:** a two-minute activity that acts out the big idea.',
          '**Memory verse:** the shortest verse that carries the idea.',
        ].join('\n'),
      };

    case 'sermon.youth':
      return {
        system: SYSTEM,
        prompt: `Rewrite this sermon for teenagers: "${input.title}" (${input.passage}). Honest, not preachy; one real-life tension; three talking points; one challenge for the week.`,
        text: [
          `## ${input.title || 'This Sunday'} — for youth`,
          '**The tension:** name something they actually face (school, family expectations, phones, belonging).',
          '**Three talking points:** short, honest, no clichés.',
          '**The challenge:** one thing to try this week, small enough to succeed at.',
        ].join('\n'),
      };

    case 'sermon.smallgroup':
      return {
        system: SYSTEM,
        prompt: `Write a 45-minute small-group guide from the sermon "${input.title}" on ${input.passage}: opener, read, five questions, prayer focus.`,
        text: [
          `## Small-group guide — ${input.title || 'this week'}`,
          '**Opener (5 min):** a light question that gets everyone talking.',
          `**Read (5 min):** ${input.passage || 'the passage'}, aloud, twice.`,
          '**Discuss (25 min):** observation → meaning → application, five questions.',
          '**Pray (10 min):** in pairs, for the one application each person names.',
        ].join('\n'),
      };

    case 'sermon.social':
      return {
        system: SYSTEM,
        prompt: `Write three short social posts (under 220 characters) from the sermon "${input.title}" on ${input.passage}. No hype, no emoji spam.`,
        text: [
          `1. ${input.bigIdea || input.title || 'The big idea'} — ${input.passage || ''}`.trim(),
          '2. A single quotable line from the sermon.',
          '3. An invitation: when you meet, and who is welcome (everyone).',
        ].join('\n'),
      };

    case 'meeting.agenda': {
      const open = db ? db.where('actionItems', (a) => a.status !== 'done' && a.status !== 'dropped') : [];
      return {
        system: SYSTEM,
        prompt: `Draft an agenda for a ${input.title || 'leadership'} meeting on ${input.date || 'the next meeting'}. Carry over these open items: ${open.map((a) => a.title).join('; ') || 'none'}.`,
        text: [
          `# ${input.title || 'Leadership meeting'} — ${input.date ? formatDate(input.date) : 'agenda'}`,
          '',
          '1. Opening prayer (5 min)',
          '2. Minutes of the last meeting (5 min)',
          ...(open.length ? ['3. Carried-over actions:', ...open.slice(0, 8).map((a) => `   - ${a.title}${a.ownerId ? '' : ' (no owner yet)'}`)] : ['3. Carried-over actions: none outstanding']),
          `${open.length ? 4 : 4}. Main business (30 min)`,
          '5. Finance report (10 min)',
          '6. Pastoral care round-up (10 min)',
          '7. Decisions to record',
          '8. Date of next meeting, closing prayer',
        ].join('\n'),
      };
    }

    case 'meeting.summary': {
      const minutes = String(input.minutes || '');
      const lines = minutes.split(/\n+/).map((l) => l.trim()).filter(Boolean);
      const actions = lines.filter((l) => /\b(will|to do|action|follow up|by \w+day|assign)/i.test(l));
      const decisions = lines.filter((l) => /\b(decided|agreed|approved|resolved)\b/i.test(l));
      return {
        system: SYSTEM,
        prompt: `Summarise these minutes in five bullets, then list decisions and action items with owners and dates if stated.\n\n${minutes}`,
        text: [
          '## Summary',
          ...(lines.slice(0, 5).map((l) => `- ${l.slice(0, 160)}`)),
          '',
          '## Decisions',
          ...(decisions.length ? decisions.map((l) => `- ${l}`) : ['- None recorded.']),
          '',
          '## Action items',
          ...(actions.length ? actions.map((l) => `- ${l}`) : ['- None identified.']),
        ].join('\n'),
      };
    }

    case 'announcement.draft':
      return {
        system: SYSTEM,
        prompt: `Write a church announcement for ${church}. Subject: ${input.subject || ''}. Details: ${input.details || ''}. Audience: ${input.audience || 'the whole congregation'}. Warm, under 120 words, one clear action.`,
        text: [
          `**${input.subject || 'Announcement'}**`,
          '',
          input.details || 'Add the details here — what, when, where, and who it is for.',
          '',
          `Please ${input.action || 'let us know if you are coming'}.`,
          '',
          `— ${church}`,
        ].join('\n'),
      };

    case 'message.whatsapp':
      return {
        system: SYSTEM,
        prompt: `Write a WhatsApp message (under 90 words, warm, no formatting beyond line breaks) about: ${input.subject || ''}. ${input.details || ''}`,
        text: [
          `Peace to you 🙏`,
          '',
          input.details || input.subject || 'Add the message here.',
          '',
          `— ${church}`,
        ].join('\n'),
      };

    case 'message.email':
      return {
        system: SYSTEM,
        prompt: `Write a short church email. Subject: ${input.subject}. Details: ${input.details}. Sign off from ${church}.`,
        text: [
          `Subject: ${input.subject || '(subject)'}`,
          '',
          'Dear friends,',
          '',
          input.details || 'Add the body here.',
          '',
          'Grace and peace,',
          church,
        ].join('\n'),
      };

    case 'prayer.points': {
      const requests = db ? db.where('prayers', (p) => p.status === 'open' || p.status === 'praying') : [];
      const urgent = requests.filter((p) => p.urgent);
      return {
        system: SYSTEM,
        prompt: `Turn these prayer requests into eight short prayer points for a prayer meeting. Group them and keep names only where the request is public.\n${requests.map((p) => `- ${p.title} (${p.category})`).join('\n')}`,
        text: [
          '## Prayer points',
          ...(urgent.length ? ['**Urgent**', ...urgent.slice(0, 5).map((p) => `- ${p.title}`), ''] : []),
          '**Our people**',
          ...requests.filter((p) => !p.urgent).slice(0, 8).map((p) => `- ${p.title}`),
          '',
          '**Our church**',
          '- For the leaders as they plan and decide.',
          '- For those who serve week after week without being seen.',
          '',
          '**Beyond us**',
          '- For workers far from family, and for those waiting on papers.',
          '- For peace in this land and the region.',
        ].join('\n'),
      };
    }

    case 'event.checklist': {
      const type = input.type || 'event';
      const base = {
        retreat: ['Book the venue and confirm in writing', 'Transport and pick-up points', 'Rooming list', 'Meals and dietary needs', 'Programme and speakers', 'Registration and payments', 'First-aid kit and emergency contacts', 'Consent forms for minors', 'Sound and worship gear', 'Photography consent'],
        baptism: ['Confirm candidates and interviews', 'Baptism class dates', 'Water, towels and changing space', 'Robes / clothing', 'Certificates printed', 'Testimony order', 'Photographer', 'Family invitations', 'Records updated after the service'],
        conference: ['Speakers confirmed and travel booked', 'Venue and capacity', 'Registration desk and badges', 'Programme printed', 'Translation needs', 'Sound, screens, recording', 'Refreshments', 'Volunteer rota', 'Budget sign-off', 'Feedback form'],
        training: ['Curriculum and handouts', 'Trainer confirmed', 'Room and seating', 'Attendance sheet', 'Certificates', 'Follow-up plan'],
        communion: ['Elements prepared', 'Servers briefed', 'Table and linens', 'Words of institution chosen', 'Provision for those who cannot come forward'],
      }[type] || ['Purpose and date agreed', 'Venue booked', 'Budget approved', 'Volunteers assigned', 'Communication sent', 'Set-up and clean-up rota', 'Attendance recorded', 'Debrief scheduled'];
      return {
        system: SYSTEM,
        prompt: `List the tasks for a church ${type} called "${input.title || ''}" on ${input.date || ''}, with owners and how far ahead each is due.`,
        text: [`## ${input.title || type} — checklist`, ...base.map((t) => `- [ ] ${t}`)].join('\n'),
      };
    }

    case 'report.summary':
      return {
        system: SYSTEM,
        prompt: `Summarise this church report in four sentences for a leadership meeting, then name one thing to celebrate and one thing to watch.\n\n${input.data || ''}`,
        text: [
          '## Summary',
          input.data ? String(input.data).split('\n').slice(0, 6).join('\n') : 'Add the figures to summarise.',
          '',
          '**Celebrate:** the clearest positive movement above.',
          '**Watch:** the number heading the wrong way, and who owns it.',
        ].join('\n'),
      };

    case 'translate':
      return {
        system: SYSTEM,
        prompt: `Translate the following into ${input.language || 'Arabic'}. Keep it natural for a church audience, not literal. Preserve line breaks.\n\n${input.text || ''}`,
        text: `[Translation into ${input.language || 'Arabic'} needs the AI service. Configure it in Settings → AI, or ask a bilingual member to review this text:]\n\n${input.text || ''}`,
      };

    case 'bible.study':
      return {
        system: SYSTEM,
        prompt: `Write a four-session Bible study on ${input.topic || input.passage || 'the passage'}, each session with a passage, three questions and a practice.`,
        text: [
          `# Bible study — ${input.topic || input.passage || 'series'}`,
          '',
          ...[1, 2, 3, 4].flatMap((n) => [
            `## Session ${n}`,
            '- **Read:** passage',
            '- **Ask:** what it says / what it means / what it asks',
            '- **Practise:** one thing to do before the next session',
            '',
          ]),
        ].join('\n'),
      };

    case 'knowledge.answer': {
      const { question = '', context = '', hits = [] } = input;
      return {
        system: `${SYSTEM}\nAnswer ONLY from the supplied church records. If they do not contain the answer, say so plainly and name what document would need to exist.`,
        prompt: `Question: ${question}\n\nChurch records:\n${context || '(none found)'}\n\nAnswer in under 150 words and cite the numbered records you used.`,
        sources: hits,
        text: hits.length
          ? [
            `**From this church's own records** (${hits.length} match${hits.length === 1 ? '' : 'es'}):`,
            '',
            ...hits.map((hit, i) => `${i + 1}. **${hit.title}** — ${hit.snippet}`),
            '',
            '_Shown as found. Connect an AI service in Settings → AI for a written answer that draws these together._',
          ].join('\n')
          : `Nothing in this church's records answers "${question}". If it should, add the document or minute it — Shepherd only answers from what the church has recorded.`,
      };
    }

    case 'assistant.ask': {
      const { question = '', context = '', hits = [] } = input;
      return {
        system: `${SYSTEM}\nThe records below, if any, are what this user may read of this church's own data — use them for anything specific to this church. Everything else is yours to answer from what you already know.`,
        prompt: `Question: ${question}\n\nThis church's own records that might be relevant (may be empty or irrelevant):\n${context || '(none found)'}\n\n`
          + 'Answer in under 200 words. If the church\'s records answered it, say so and cite the numbered ones; '
          + 'otherwise just answer from what you know.',
        sources: hits,
        text: hits.length
          ? [
            `**Found in this church's own records** (${hits.length} match${hits.length === 1 ? '' : 'es'}):`,
            '',
            ...hits.map((hit, i) => `${i + 1}. **${hit.title}** — ${hit.snippet}`),
            '',
            '_This device can match your question against your church\'s records, but has no general knowledge of its own — '
            + 'connect an AI service in Settings → AI for a written answer that reasons about scripture, theology, '
            + 'ministry practice, or anything beyond the app._',
          ].join('\n')
          : 'This device found nothing in your church\'s own records for that, and has no general knowledge of its own to '
            + `answer "${question}" without help. Connect an AI service in Settings → AI to have Shepherd actually answer `
            + 'questions like this one — scripture, theology, ministry advice, or anything else.',
      };
    }

    case 'equip.explain': {
      const { passage = '', question = '' } = input;
      const subject = passage || question || 'this passage';
      return {
        system: SYSTEM,
        prompt: `Explain ${subject} for someone studying it in an Equip course: historical context, plain meaning, one honest application today. Sound biblical teaching, not speculation.`,
        text: [
          `## ${subject}`,
          '**Context:** who wrote it, to whom, and why.',
          '**Plain meaning:** what the text is actually saying, in a sentence or two.',
          '**Today:** one honest way this shapes how we live.',
        ].join('\n'),
      };
    }

    case 'equip.summary': {
      const { title = '', content = '' } = input;
      const lines = String(content || '').split(/\n+/).map((l) => l.trim()).filter(Boolean);
      return {
        system: SYSTEM,
        prompt: `Summarise this lesson ("${title}") in five bullet points a learner could review before a quiz.\n\n${content}`,
        text: [
          `## ${title || 'Lesson summary'}`,
          ...(lines.length ? lines.slice(0, 5).map((l) => `- ${l.slice(0, 160)}`) : ['- Add the lesson content to summarise.']),
        ].join('\n'),
      };
    }

    case 'equip.quiz': {
      const { title = '', passage = '' } = input;
      return {
        system: SYSTEM,
        prompt: `Write five study questions and one memory-verse challenge for a lesson titled "${title}"${passage ? ` on ${passage}` : ''}.`,
        text: [
          `## Study questions — ${title || 'this lesson'}`,
          '1. What is the one thing you want to remember from this lesson?',
          '2. Where did this challenge something you assumed?',
          '3. Who could you share this with this week?',
          '4. What would change if you took this seriously?',
          '5. What question are you left with?',
          '',
          '## Memory verse challenge',
          passage
            ? `Memorise ${passage} and recite it to someone else in your group before the next session.`
            : 'Choose the shortest verse from this lesson and recite it from memory next session.',
        ].join('\n'),
      };
    }

    case 'equip.coach': {
      const { name = '', nextCourse = '', hours = 0, completedCount = 0 } = input;
      return {
        system: SYSTEM,
        prompt: `Write two encouraging sentences to ${name || 'a learner'} who has completed ${completedCount} course(s) and ${hours} learning hour(s), recommending "${nextCourse}" next.`,
        text: completedCount
          ? `You've put in ${hours} hour${hours === 1 ? '' : 's'} across ${completedCount} course${completedCount === 1 ? '' : 's'} — that's real, steady growth.${nextCourse ? ` "${nextCourse}" is a good next step.` : ' Keep going.'}`
          : `Every course starts with a first lesson.${nextCourse ? ` "${nextCourse}" is a good place to begin.` : ' Take a look at the library and pick one that speaks to where you are.'}`,
      };
    }

    default:
      return {
        system: SYSTEM,
        prompt: String(input.prompt || input.text || ''),
        text: 'This assistant task is not available on this device. Configure an AI service in Settings → AI.',
      };
  }
}

/* ── insights ────────────────────────────────────────────────────────────── */

/**
 * @typedef {object} Insight
 * @property {string} id
 * @property {'care'|'celebration'|'operations'|'finance'|'growth'|'risk'} kind
 * @property {'urgent'|'attention'|'info'} severity
 * @property {string} title
 * @property {string} detail
 * @property {string} [action] route to act on it
 * @property {string} [actionLabel]
 */

/**
 * Everything Shepherd noticed, computed from this church's own records.
 * Permission-filtered: a volunteer never sees a finance insight.
 *
 * @param {import('./db.js').Database} db
 * @param {object} user
 * @param {{now?: Date, settings?: object}} [opts]
 * @returns {Insight[]}
 */
export function computeInsights(db, user, opts = {}) {
  const now = opts.now || new Date();
  const settings = opts.settings || {};
  /** @type {Insight[]} */
  const out = [];
  const push = (insight) => out.push(insight);

  /* People who have quietly stopped coming. */
  if (can(user, 'care:read') || can(user, 'members:read')) {
    const absent = absentMembers(db, { now, weeks: settings.followUpAfterWeeks || 3 });
    if (absent.length) {
      push({
        id: 'absent',
        kind: 'care',
        severity: absent.length > 8 ? 'urgent' : 'attention',
        title: `${absent.length} ${absent.length === 1 ? 'person has' : 'people have'} not been seen for ${settings.followUpAfterWeeks || 3}+ weeks`,
        detail: absent.slice(0, 4).map((m) => m.fullName).join(', ') + (absent.length > 4 ? `, and ${absent.length - 4} more` : ''),
        action: '#/care',
        actionLabel: 'Open follow-ups',
      });
    }

    const newBelievers = db.where('members', (m) => m.newBeliever && !m.archived
      && daysBetween(m.joinedOn || m.createdAt, now) <= 90);
    if (newBelievers.length) {
      push({
        id: 'new-believers',
        kind: 'growth',
        severity: 'attention',
        title: `${newBelievers.length} new believer${newBelievers.length === 1 ? '' : 's'} in the last 90 days`,
        detail: 'Each one needs a person, not a programme. Assign someone this week.',
        action: '#/members?filter=new-believer',
        actionLabel: 'See who',
      });
    }

    const overdue = db.where('care', (c) => !c.completedAt && c.dueDate && new Date(c.dueDate) < now);
    if (overdue.length) {
      push({
        id: 'overdue-care',
        kind: 'care',
        severity: overdue.some((c) => c.priority === 'urgent') ? 'urgent' : 'attention',
        title: `${overdue.length} follow-up${overdue.length === 1 ? '' : 's'} past due`,
        detail: overdue.slice(0, 3).map((c) => c.summary).join(' · '),
        action: '#/care',
        actionLabel: 'Work through them',
      });
    }

    const celebrations = upcomingCelebrations(db, { now, days: 7 });
    if (celebrations.length) {
      push({
        id: 'celebrations',
        kind: 'celebration',
        severity: 'info',
        title: `${celebrations.length} birthday${celebrations.length === 1 ? '' : 's'} and anniversar${celebrations.length === 1 ? 'y' : 'ies'} this week`,
        detail: celebrations.slice(0, 4).map((c) => `${c.name} (${c.label})`).join(', '),
        action: '#/members?filter=celebrations',
        actionLabel: 'Send greetings',
      });
    }
  }

  /* Volunteer shortages on the rota. */
  if (can(user, 'events:read')) {
    const shortages = volunteerShortages(db, { now });
    if (shortages.length) {
      push({
        id: 'volunteers',
        kind: 'operations',
        severity: 'attention',
        title: `${shortages.length} event${shortages.length === 1 ? '' : 's'} short of volunteers`,
        detail: shortages.slice(0, 3).map((s) => `${s.title}: ${s.unassigned} unassigned`).join(' · '),
        action: '#/events',
        actionLabel: 'Fill the rota',
      });
    }
  }

  /* Worship services not yet fully staffed. */
  if (can(user, 'worship:read')) {
    const short = worshipShortages(db, { now });
    if (short.length) {
      push({
        id: 'worship-shortages',
        kind: 'operations',
        severity: daysBetween(now, short[0].date) <= 3 ? 'urgent' : 'attention',
        title: `${short.length} upcoming service${short.length === 1 ? '' : 's'} not yet fully staffed`,
        detail: short.slice(0, 3).map((s) => `${s.service} (${formatDate(s.date)}): ${s.filled}/${s.total} roles filled`).join(' · '),
        action: '#/leadership?tab=schedule',
        actionLabel: 'Open the schedule',
      });
    }
  }

  /* Documents about to expire — leases, insurance, licences. */
  if (can(user, 'documents:read')) {
    const expiring = db.where('documents', (d) => d.expiresOn && daysBetween(now, d.expiresOn) <= 60 && daysBetween(now, d.expiresOn) >= -30);
    if (expiring.length) {
      push({
        id: 'expiring-docs',
        kind: 'risk',
        severity: expiring.some((d) => daysBetween(now, d.expiresOn) < 14) ? 'urgent' : 'attention',
        title: `${expiring.length} document${expiring.length === 1 ? '' : 's'} expiring soon`,
        detail: expiring.slice(0, 3).map((d) => `${d.title} (${formatDate(d.expiresOn)})`).join(' · '),
        action: '#/documents',
        actionLabel: 'Review the vault',
      });
    }
  }

  /* Budget lines running hot. */
  if (can(user, 'finance:read')) {
    const year = now.getFullYear();
    const budgets = db.where('budgets', (b) => b.year === year);
    const spend = new Map();
    for (const tx of db.where('transactions', (t) => t.kind === 'expense' && new Date(t.date).getFullYear() === year)) {
      spend.set(tx.category, (spend.get(tx.category) || 0) + Number(tx.amount || 0));
    }
    const overruns = budgets
      .map((b) => ({ ...b, spent: spend.get(b.category) || 0 }))
      .filter((b) => b.amount > 0 && b.spent / b.amount >= 0.9);
    if (overruns.length) {
      push({
        id: 'budget',
        kind: 'finance',
        severity: overruns.some((b) => b.spent > b.amount) ? 'urgent' : 'attention',
        title: `${overruns.length} budget line${overruns.length === 1 ? '' : 's'} at or over 90%`,
        detail: overruns.slice(0, 3).map((b) => `${b.category}: ${formatMoney(b.spent)} of ${formatMoney(b.amount)}`).join(' · '),
        action: '#/finance',
        actionLabel: 'Open finance',
      });
    }

    const pending = db.where('transactions', (t) => t.status === 'pending-approval');
    if (pending.length && can(user, 'finance:approve')) {
      push({
        id: 'approvals',
        kind: 'finance',
        severity: 'attention',
        title: `${pending.length} payment${pending.length === 1 ? '' : 's'} waiting for approval`,
        detail: pending.slice(0, 3).map((t) => `${t.description || t.category} — ${formatMoney(t.amount)}`).join(' · '),
        action: '#/finance?tab=approvals',
        actionLabel: 'Review',
      });
    }
  }

  /* Attendance trend. */
  if (can(user, 'members:read')) {
    const trend = attendanceTrend(db, { now, weeks: 8 });
    if (trend.direction === 'down' && Math.abs(trend.changePct) >= 12) {
      push({
        id: 'attendance-down',
        kind: 'growth',
        severity: 'attention',
        title: `Attendance is down ${Math.abs(Math.round(trend.changePct))}% over eight weeks`,
        detail: `Averaging ${Math.round(trend.recentAverage)} against ${Math.round(trend.priorAverage)} before. Worth naming at the next leaders' meeting.`,
        action: '#/reports',
        actionLabel: 'See the numbers',
      });
    } else if (trend.direction === 'up' && trend.changePct >= 12) {
      push({
        id: 'attendance-up',
        kind: 'growth',
        severity: 'info',
        title: `Attendance is up ${Math.round(trend.changePct)}% over eight weeks`,
        detail: `Averaging ${Math.round(trend.recentAverage)}. Make sure the newcomers are being met by name.`,
        action: '#/reports',
        actionLabel: 'See the numbers',
      });
    }
  }

  /* Prayer that has gone quiet. */
  if (can(user, 'prayer:read')) {
    const stale = db.where('prayers', (p) => (p.status === 'open' || p.status === 'praying')
      && daysBetween(p.updatedAt || p.createdAt, now) > 30);
    if (stale.length >= 3) {
      push({
        id: 'stale-prayer',
        kind: 'care',
        severity: 'info',
        title: `${stale.length} prayer requests have had no update in a month`,
        detail: 'Ask how they are. Answered prayer that nobody records is a testimony the church never hears.',
        action: '#/prayer',
        actionLabel: 'Open prayer centre',
      });
    }
  }

  const order = { urgent: 0, attention: 1, info: 2 };
  return out.sort((a, b) => order[a.severity] - order[b.severity]);
}

/* ── the computations behind the insights (also used directly by modules) ── */

/** People with no attendance mark in the last `weeks` weeks. */
export function absentMembers(db, { now = new Date(), weeks = 3 } = {}) {
  const cutoff = new Date(now.getTime() - weeks * 7 * 864e5);
  const seen = new Map();
  for (const session of db.all('attendance')) {
    const date = new Date(session.date);
    for (const id of session.memberIds || []) {
      if (!seen.has(id) || date > seen.get(id)) seen.set(id, date);
    }
  }
  return db
    .where('members', (m) => !m.archived && (m.status === 'member' || m.status === 'regular'))
    .map((m) => ({ ...m, lastSeen: seen.get(m.id) || null }))
    .filter((m) => !m.lastSeen || m.lastSeen < cutoff)
    .sort((a, b) => (a.lastSeen ? a.lastSeen.getTime() : 0) - (b.lastSeen ? b.lastSeen.getTime() : 0));
}

/** Birthdays and anniversaries inside the next `days` days. */
export function upcomingCelebrations(db, { now = new Date(), days = 30 } = {}) {
  const out = [];
  for (const member of db.where('members', (m) => !m.archived)) {
    if (member.birthDate) {
      const inDays = daysUntilAnnual(member.birthDate, now);
      if (inDays <= days) out.push({ memberId: member.id, name: member.fullName, label: 'birthday', date: member.birthDate, inDays });
    }
    if (member.anniversary) {
      const inDays = daysUntilAnnual(member.anniversary, now);
      if (inDays <= days) out.push({ memberId: member.id, name: member.fullName, label: 'anniversary', date: member.anniversary, inDays });
    }
  }
  return out.sort((a, b) => a.inDays - b.inDays);
}

/** Upcoming events whose task list still has unassigned roles. */
export function volunteerShortages(db, { now = new Date(), days = 21 } = {}) {
  return db
    .where('events', (e) => e.status !== 'cancelled' && new Date(e.startsAt) >= now
      && daysBetween(now, e.startsAt) <= days)
    .map((event) => {
      const tasks = db.where('eventTasks', (t) => t.eventId === event.id);
      const unassigned = tasks.filter((t) => !t.ownerId && !t.done).length;
      return { id: event.id, title: event.title, startsAt: event.startsAt, unassigned, total: tasks.length };
    })
    .filter((e) => e.unassigned > 0)
    .sort((a, b) => new Date(a.startsAt) - new Date(b.startsAt));
}

/**
 * Attendance over the last `weeks` weeks against the `weeks` before that.
 * @returns {{recentAverage: number, priorAverage: number, changePct: number, direction: 'up'|'down'|'flat', points: {date: string, total: number}[]}}
 */
export function attendanceTrend(db, { now = new Date(), weeks = 8 } = {}) {
  const sessions = db.all('attendance')
    .map((s) => ({ date: s.date, total: Number(s.total || (s.memberIds || []).length + Number(s.visitors || 0)) }))
    .sort((a, b) => new Date(a.date) - new Date(b.date));

  const windowMs = weeks * 7 * 864e5;
  const recentFrom = now.getTime() - windowMs;
  const priorFrom = recentFrom - windowMs;
  const recent = sessions.filter((s) => new Date(s.date).getTime() >= recentFrom);
  const prior = sessions.filter((s) => {
    const t = new Date(s.date).getTime();
    return t >= priorFrom && t < recentFrom;
  });

  const avg = (list) => (list.length ? list.reduce((sum, s) => sum + s.total, 0) / list.length : 0);
  const recentAverage = avg(recent);
  const priorAverage = avg(prior);
  const changePct = priorAverage ? ((recentAverage - priorAverage) / priorAverage) * 100 : 0;
  return {
    recentAverage,
    priorAverage,
    changePct,
    direction: changePct > 2 ? 'up' : changePct < -2 ? 'down' : 'flat',
    points: sessions.slice(-Math.max(weeks * 2, 12)),
  };
}

/** Suggested rota: who has served least recently gets asked first. */
export function suggestVolunteers(db, { role, count = 2, exclude = [] } = {}) {
  const lastServed = new Map();
  for (const task of db.all('eventTasks')) {
    if (!task.ownerId) continue;
    const at = new Date(task.updatedAt || task.createdAt).getTime();
    if (!lastServed.has(task.ownerId) || at > lastServed.get(task.ownerId)) lastServed.set(task.ownerId, at);
  }
  return db
    .where('members', (m) => !m.archived && m.status !== 'visitor' && !exclude.includes(m.id)
      && (!role || (m.ministries || []).some((x) => String(x).toLowerCase().includes(String(role).toLowerCase()))))
    .map((m) => ({ member: m, lastServed: lastServed.get(m.id) || 0 }))
    .sort((a, b) => a.lastServed - b.lastServed)
    .slice(0, count);
}

/** Giving and expenses for a period, by category — the finance snapshot. */
export function financeSnapshot(db, { from, to } = {}) {
  const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
  const end = to ? new Date(to) : new Date();
  const inRange = db.where('transactions', (t) => {
    const date = new Date(t.date);
    return date >= start && date <= end && t.status !== 'rejected';
  });
  const giving = inRange.filter((t) => t.kind === 'giving');
  const expenses = inRange.filter((t) => t.kind === 'expense');
  const sum = (list) => list.reduce((total, t) => total + Number(t.amount || 0), 0);
  const byCategory = (list) => {
    const map = new Map();
    for (const t of list) map.set(t.category, (map.get(t.category) || 0) + Number(t.amount || 0));
    return [...map].map(([category, amount]) => ({ category, amount })).sort((a, b) => b.amount - a.amount);
  };
  return {
    from: isoDate(start),
    to: isoDate(end),
    giving: sum(giving),
    expenses: sum(expenses),
    net: sum(giving) - sum(expenses),
    givingByCategory: byCategory(giving),
    expensesByCategory: byCategory(expenses),
    count: inRange.length,
  };
}

/* ── smart assignment (the annual worship schedule) ─────────────────────── */

/**
 * Suggest who should fill one role on one service date: whoever matches the
 * ministry for that role, has not already been asked for another role on the
 * same service, is not marked away, and has served least recently. This is
 * deliberately the same "least recently served" heuristic as
 * {@link suggestVolunteers} — consistency between the events rota and the
 * worship schedule matters more than either being clever.
 *
 * @param {import('./db.js').Database} db
 * @param {{roleKey: string, date: string|Date, alreadyAssigned?: string[]}} opts
 */
export function suggestForRole(db, { roleKey, date, alreadyAssigned = [] } = {}) {
  const ministryMatch = {
    worshipSongLeaderId: 'worship', mediaId: 'media', soundId: 'media', usherId: 'ushering',
    childrenYouthLeaderId: 'children', childrenYouthAssistantId: 'children',
    prayerTeamId: 'prayer', hospitalityId: 'hospitality', securityId: 'security',
  }[roleKey] || null;

  const serviceDate = new Date(date);
  const lastServed = new Map();
  for (const record of db.all('serviceSchedule')) {
    const at = new Date(record.date).getTime();
    const value = record[roleKey];
    const ids = Array.isArray(value) ? value : [value].filter(Boolean);
    for (const id of ids) {
      if (!lastServed.has(id) || at > lastServed.get(id)) lastServed.set(id, at);
    }
  }

  return db
    .where('members', (m) => !m.archived && m.status !== 'visitor'
      && !alreadyAssigned.includes(m.id)
      && (!m.awayUntil || new Date(m.awayUntil) < serviceDate)
      && (!ministryMatch || (m.ministries || []).some((x) => String(x).toLowerCase().includes(ministryMatch))))
    .map((m) => ({ member: m, lastServed: lastServed.get(m.id) || 0 }))
    .sort((a, b) => a.lastServed - b.lastServed)
    .slice(0, 5);
}

/**
 * Every role-field on a service record that takes one member. Opening prayer
 * and the tithes & offering exhortation are not listed here — they are the
 * Emcee's job, not separate roles to staff (see `EMCEE_RESPONSIBILITIES`).
 * Parking and photography are last because they are the two the spec marks
 * optional; `CORE_SERVICE_ROLES` below excludes them from readiness scoring.
 */
export const SERVICE_ROLE_FIELDS = [
  ['preacherId', 'Preacher'], ['presidingLeaderId', 'Presiding leader'],
  ['worshipSongLeaderId', 'Worship & Song Leader'], ['emceeId', 'Emcee'],
  ['pastoralPrayerId', 'Pastoral prayer'],
  ['communionMinisterId', 'Communion minister'],
  ['childrenYouthLeaderId', 'Children & Youth leader'], ['childrenYouthAssistantId', 'Children & Youth assistant'],
  ['mediaId', 'Media'], ['soundId', 'Sound'], ['usherId', 'Usher'],
  ['securityId', 'Security'], ['hospitalityId', 'Hospitality'], ['prayerTeamId', 'Prayer team'],
  ['parkingId', 'Parking'], ['photographyId', 'Photography'],
];

/** What the Emcee is responsible for on every service — shown under their name, never asked as a separate role. */
export const EMCEE_RESPONSIBILITIES = ['Opening Prayer', 'Tithes & Offering Exhortation'];

/** The two recurring templates a new service starts from. */
export const SERVICE_TEMPLATES = {
  friday: {
    service: 'Friday Worship',
    orderOfService: 'Praise & Worship\nOpening Prayer\nAnnouncements\nTithes & Offering\nMessage\nResponse & Ministry Time\nClosing Prayer',
    communionChecklist: ['Bread prepared', 'Cups filled', 'Table and linens set'],
  },
  sunday: {
    service: 'Sunday Worship',
    orderOfService: 'Praise & Worship\nOpening Prayer\nAnnouncements\nTithes & Offering\nMessage\nResponse & Ministry Time\nClosing Prayer\nBenediction',
    communionChecklist: ['Bread prepared', 'Cups filled', 'Table and linens set'],
  },
  other: { service: '', orderOfService: '', communionChecklist: [] },
};

/** Every member already holding a role on one service record — used to avoid double-booking. */
export function serviceAssignees(record) {
  return SERVICE_ROLE_FIELDS.map(([key]) => record[key]).filter(Boolean);
}

/**
 * Roles that count toward "is this service ready" — the two the spec marks
 * optional (parking, photography) are excluded, and the communion minister
 * only counts on a day communion is actually scheduled.
 */
export const CORE_SERVICE_ROLES = SERVICE_ROLE_FIELDS.filter(([key]) => key !== 'parkingId' && key !== 'photographyId');

/** How staffed one service is — the "preparation status" a leader actually wants to see at a glance. */
export function serviceReadiness(record) {
  const roles = CORE_SERVICE_ROLES.filter(([key]) => key !== 'communionMinisterId' || isCommunionScheduled(record));
  const filled = roles.filter(([key]) => record[key]).length;
  return { filled, total: roles.length, pct: roles.length ? Math.round((filled / roles.length) * 100) : 100 };
}

/** Upcoming Friday/Sunday services that are not yet fully staffed — the worship-specific volunteer shortage. */
export function worshipShortages(db, { now = new Date(), days = 21 } = {}) {
  return db
    .where('serviceSchedule', (s) => new Date(s.date) >= new Date(now.toDateString()) && daysBetween(now, s.date) <= days)
    .map((record) => ({ id: record.id, date: record.date, service: record.service, ...serviceReadiness(record) }))
    .filter((s) => s.filled < s.total)
    .sort((a, b) => new Date(a.date) - new Date(b.date));
}

/* ── ministry health ─────────────────────────────────────────────────────── */

/**
 * A heuristic 0–100 score per ministry, so a pastor can see at a glance which
 * ministries are running well and which need attention. It is deliberately
 * transparent rather than a black box: the breakdown is returned alongside
 * the score, and the UI shows it.
 *
 * Composition: task completion (35%), overdue-free-ness (20%), volunteer
 * coverage against the ministry's stated need (25%), and recent activity —
 * any task touched in the last 30 days (20%). A ministry with no tasks at
 * all scores on coverage and activity only, so a quiet-but-fully-staffed
 * ministry is not penalised for having nothing overdue.
 *
 * @param {import('./db.js').Database} db
 * @param {object} ministry
 * @param {{now?: Date}} [opts]
 */
export function ministryHealthScore(db, ministry, { now = new Date() } = {}) {
  const serving = db.where('members', (m) => !m.archived && (m.ministries || []).includes(ministry.name));
  const tasks = db.all('eventTasks').filter((t) => serving.some((m) => m.id === t.ownerId))
    .concat(db.where('actionItems', (a) => a.ministryId === ministry.id));

  const done = tasks.filter((t) => t.done || t.status === 'done').length;
  const overdue = tasks.filter((t) => !t.done && t.status !== 'done' && t.dueDate && new Date(t.dueDate) < now).length;
  const open = tasks.length - done;

  const completionScore = tasks.length ? (done / tasks.length) * 100 : 70; // no history yet — neutral, not penalised
  const overdueScore = open ? Math.max(0, 100 - (overdue / open) * 100) : 100;
  const coverageScore = ministry.minVolunteers
    ? Math.min(100, (serving.length / ministry.minVolunteers) * 100)
    : (serving.length ? 100 : 40);
  const recentCutoff = new Date(now.getTime() - 30 * 864e5);
  const recentlyActive = tasks.some((t) => new Date(t.updatedAt || t.createdAt || 0) >= recentCutoff);
  const activityScore = tasks.length ? (recentlyActive ? 100 : 30) : 60;

  const score = Math.round(
    completionScore * 0.35 + overdueScore * 0.2 + coverageScore * 0.25 + activityScore * 0.2,
  );
  const rating = score >= 90 ? 'Excellent' : score >= 75 ? 'Healthy' : score >= 60 ? 'Needs improvement' : 'Attention needed';

  return {
    score, rating,
    serving: serving.length,
    needed: ministry.minVolunteers || 0,
    tasksOpen: open,
    tasksOverdue: overdue,
    breakdown: [
      { label: 'Task completion', value: Math.round(completionScore) },
      { label: 'No overdue work', value: Math.round(overdueScore) },
      { label: 'Volunteer coverage', value: Math.round(coverageScore) },
      { label: 'Recent activity', value: Math.round(activityScore) },
    ],
  };
}

/* ── AI executive briefing ───────────────────────────────────────────────── */

/**
 * "Good morning, Allen." A personalised, role-tailored morning summary built
 * entirely from computation — like the rest of the insights layer, this is
 * facts the church already knows, formatted for a two-second read, not a
 * model's opinion. No `aiGenerated` label is needed for the same reason
 * {@link computeInsights} does not carry one.
 *
 * @param {import('./db.js').Database} db
 * @param {object} user
 * @param {{now?: Date, settings?: object}} [opts]
 * @returns {string[]} short lines, most relevant first
 */
export function buildBriefing(db, user, { now = new Date(), settings = {} } = {}) {
  const lines = [];
  const weekAhead = new Date(now.getTime() + 7 * 864e5);

  if (can(user, 'worship:read')) {
    const services = db.where('serviceSchedule', (s) => new Date(s.date) >= now && new Date(s.date) <= weekAhead).length
      || db.where('events', (e) => e.type === 'service' && new Date(e.startsAt) >= now && new Date(e.startsAt) <= weekAhead).length;
    if (services) lines.push(`${services} upcoming worship service${services === 1 ? '' : 's'} this week.`);
    const shortages = volunteerShortages(db, { now, days: 7 });
    if (shortages.length) lines.push(`${shortages.map((s) => s.title).slice(0, 2).join(', ')} ${shortages.length === 1 ? 'is' : 'are'} short of volunteers.`);
  }

  if (can(user, 'members:read')) {
    const celebrations = upcomingCelebrations(db, { now, days: 7 });
    const birthdays = celebrations.filter((c) => c.label === 'birthday').length;
    const anniversaries = celebrations.filter((c) => c.label === 'anniversary').length;
    if (birthdays) lines.push(`${birthdays} member${birthdays === 1 ? '' : 's'} celebrating a birthday.`);
    if (anniversaries) lines.push(`${anniversaries} wedding anniversar${anniversaries === 1 ? 'y' : 'ies'}.`);

    const trend = attendanceTrend(db, { now, weeks: 4 });
    if (Math.abs(trend.changePct) >= 12) {
      lines.push(`Attendance is ${trend.direction === 'up' ? 'up' : 'down'} ${Math.abs(Math.round(trend.changePct))}% over four weeks.`);
    }
  }

  if (can(user, 'members:read')) {
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const visitors = db.where('members', (m) => m.status === 'visitor' && new Date(m.joinedOn || m.createdAt) >= monthStart).length;
    if (visitors) lines.push(`${visitors} first-time visitor${visitors === 1 ? '' : 's'} awaiting follow-up.`);
  }

  if (can(user, 'finance:read')) {
    const pending = db.where('transactions', (t) => t.status === 'pending-approval').length;
    if (pending) lines.push(`${pending} finance ${pending === 1 ? 'entry is' : 'entries are'} awaiting approval.`);
  }

  if (can(user, 'leadership:read')) {
    const overdue = db.where('actionItems', (a) => a.status !== 'done' && a.status !== 'dropped'
      && a.dueDate && new Date(a.dueDate) < now).length;
    if (overdue) lines.push(`${overdue} leadership action${overdue === 1 ? '' : 's'} overdue.`);
  }

  if (!lines.length) lines.push('Nothing urgent — a clear week is a good week to check in on someone anyway.');
  return lines;
}

/* ── equip: learning & training ──────────────────────────────────────────── */

/** "3h 30m", "90 min", "2 hours" — whatever a course's free-text duration says, as a number of hours. */
function parseDurationHours(duration) {
  const str = String(duration || '');
  const hourMatch = str.match(/(\d+(?:\.\d+)?)\s*h/i);
  const minMatch = str.match(/(\d+(?:\.\d+)?)\s*m/i);
  return (hourMatch ? Number(hourMatch[1]) : 0) + (minMatch ? Number(minMatch[1]) / 60 : 0);
}

/**
 * One member's learning profile: what they have completed and are partway
 * through, the certificates they hold, and an hours estimate from each
 * completed course's stated duration. Pure computation over enrollment and
 * course records — this is what the Equip dashboard and a member's profile
 * card both read, so they never show two different ideas of "done".
 */
export function learningProgress(db, user) {
  const memberId = user && user.memberId;
  const enrollments = memberId ? db.where('enrollments', (e) => e.memberId === memberId) : [];
  const completed = enrollments.filter((e) => e.status === 'completed');
  const inProgress = enrollments.filter((e) => e.status === 'in-progress');
  const certificates = memberId
    ? db.where('certificates', (c) => c.memberId === memberId).sort((a, b) => new Date(b.issuedAt) - new Date(a.issuedAt))
    : [];
  const hours = completed.reduce((total, e) => total + parseDurationHours((db.find('courses', e.courseId) || {}).duration), 0);
  return { enrollments, completed, inProgress, certificates, hours: Math.round(hours * 10) / 10 };
}

/**
 * The next course worth suggesting: not already completed, not gated behind
 * a role the user lacks, prerequisites already satisfied where the course
 * has any, and — where there is a choice — one that matches a ministry the
 * member actually serves in. No model; this is the same "obvious next step"
 * a discipleship pastor would name by hand.
 */
export function recommendNextCourse(db, user) {
  const memberId = user && user.memberId;
  const enrollments = memberId ? db.where('enrollments', (e) => e.memberId === memberId) : [];
  const completedIds = new Set(enrollments.filter((e) => e.status === 'completed').map((e) => e.courseId));
  const member = memberId ? db.find('members', memberId) : null;
  const candidates = db.where('courses', (c) => !c.archived && !completedIds.has(c.id) && canEnrollInCourse(user, c));
  if (!candidates.length) return null;
  const ready = candidates.filter((c) => (c.prerequisites || []).every((p) => completedIds.has(p)));
  const pool = ready.length ? ready : candidates;
  const ministries = (member && member.ministries) || [];
  const matched = pool.find((c) => ministries.some((m) => String(c.category).toLowerCase().includes(String(m).toLowerCase())));
  return matched || pool[0];
}

/**
 * How ready this member is for greater leadership responsibility, by the one
 * fact Shepherd can actually measure: how many of the leader-restricted
 * courses they have completed. Transparent on purpose — a number alone
 * invites the question "readiness for what, exactly", so the breakdown is
 * returned alongside it, the same as `ministryHealthScore`.
 */
export function leadershipReadiness(db, user) {
  const memberId = user && user.memberId;
  const leaderCourses = db.where('courses', (c) => c.leaderOnly && !c.archived);
  if (!leaderCourses.length) return { score: 0, completed: 0, total: 0 };
  const completedIds = new Set(
    (memberId ? db.where('enrollments', (e) => e.memberId === memberId && e.status === 'completed') : []).map((e) => e.courseId),
  );
  const completed = leaderCourses.filter((c) => completedIds.has(c.id)).length;
  return { score: Math.round((completed / leaderCourses.length) * 100), completed, total: leaderCourses.length };
}
