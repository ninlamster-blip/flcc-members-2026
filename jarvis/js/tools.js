// Agent Tools — the fixed toolset Act draws from, per the spec's "Agent
// Tools" section. Each tool is `{ label, run(params) -> { ok, detail } }`
// (run may be async — act.js always awaits it).
//
// Memory and Communication were wired up for real in V0.1, Knowledge in
// V0.2, Home in V0.4, Calendar just after V1.0's first slice (see
// knowledge.js / home.js / calendar.js — each its own engine, kept
// structurally separate from Personal Memory).
import { rememberFact, setPreference } from './memory.js';
import { getCachedNews, askGlobalKnowledge, markBriefingShown } from './knowledge.js';
import { pauseAllPlaying } from './home.js';
import { eventsToday } from './calendar.js';

function newsBriefingText() {
  const { items } = getCachedNews();
  if (!items.length) return 'No cached headlines yet — use "Refresh news" in the Knowledge panel first.';
  return items.slice(0, 3).map((it) => `${it.sourceIcon || ''} ${it.headline}`.trim()).join(' | ');
}

function calendarSummaryText() {
  const events = eventsToday();
  if (!events.length) return 'Nothing on the calendar for today.';
  return events.map((e) => e.title).join(' | ');
}

export const TOOLS = {
  notify: {
    label: 'Communication Tool — notify',
    run({ message }) {
      if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
        new Notification('JARVIS', { body: message });
      }
      return { ok: true, detail: message };
    },
  },

  message: {
    label: 'Communication Tool — message',
    // No real messaging backend yet, so "sending" is simulated: it's
    // recorded as if delivered, which is enough to demonstrate the
    // approval gate and feed Reflect/Learn honestly.
    run({ message, to }) {
      return { ok: true, detail: `(demo) Sent to ${to}: "${message}"` };
    },
  },

  remember: {
    label: 'Memory Tool — remember',
    run({ message }) {
      rememberFact(message);
      return { ok: true, detail: `Remembered: ${message}` };
    },
  },

  calendar: {
    label: 'Calendar Tool',
    run() {
      return { ok: true, detail: calendarSummaryText() };
    },
  },

  home: {
    label: 'Home Tool',
    // Plan only ever asks this tool to pause everything (see
    // agents/family.js's device-during-devotion step) — per-device
    // play/pause/volume controls are user-driven from the Home panel and
    // call home.js's controlDevice() directly, not through Plan.
    async run() {
      return pauseAllPlaying();
    },
  },

  knowledge: {
    label: 'Knowledge Tool',
    // Two modes: a free-text `query` (search/summarize, needs an AI
    // connection) or the daily briefing (just today's cached headlines —
    // works with only a Worker URL, no Anthropic key needed).
    async run({ query }) {
      if (query) return askGlobalKnowledge(query);
      markBriefingShown();
      return { ok: true, detail: newsBriefingText() };
    },
  },

  goalsReminder: {
    label: 'Creator Tool — goals reminder',
    // Marks the weekly gate only once actually delivered — same rule the
    // Knowledge Tool's daily briefing follows above.
    run({ message }) {
      setPreference('lastGoalsReviewDate', Date.now());
      return { ok: true, detail: message };
    },
  },
};
