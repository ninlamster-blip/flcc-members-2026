// Agent Tools — the fixed toolset Act draws from, per the spec's "Agent
// Tools" section. Each tool is `{ label, run(params) -> { ok, detail } }`
// (run may be async — act.js always awaits it).
//
// Memory and Communication were wired up for real in V0.1; Knowledge joins
// them in V0.2 (see knowledge.js — live news plus an optional AI-backed
// search/summarize, kept structurally separate from Personal Memory).
// Calendar and Home are still declared — so the registry shape doesn't
// change later — but return a clear "not connected yet" result until V0.4
// (Home) / a future Calendar source.
import { rememberFact } from './memory.js';
import { getCachedNews, askGlobalKnowledge, markBriefingShown } from './knowledge.js';

function notImplemented(toolName, version) {
  return { ok: false, detail: `${toolName} isn't connected yet — arrives in ${version}.` };
}

function newsBriefingText() {
  const { items } = getCachedNews();
  if (!items.length) return 'No cached headlines yet — use "Refresh news" in the Knowledge panel first.';
  return items.slice(0, 3).map((it) => `${it.sourceIcon || ''} ${it.headline}`.trim()).join(' | ');
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
      return notImplemented('Calendar Tool', 'V0.4 (Home) / a future Calendar source');
    },
  },

  home: {
    label: 'Home Tool',
    run() {
      return notImplemented('Home Tool', 'V0.4');
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
};
