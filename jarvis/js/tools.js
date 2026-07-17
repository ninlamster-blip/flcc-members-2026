// Agent Tools — the fixed toolset Act draws from, per the spec's "Agent
// Tools" section. Each tool is `{ label, run(params) -> { ok, detail } }`.
//
// V0.1 wires up Memory and Communication for real (the pieces the Agentic
// Core needs to close its own loop); Calendar, Home, and Knowledge are
// declared now — so the registry shape doesn't change later — but return a
// clear "not connected yet" result until their versions land (V0.2
// Knowledge, V0.4 Home; Calendar awaits a real Calendar source).
import { rememberFact } from './memory.js';

function notImplemented(toolName, version) {
  return { ok: false, detail: `${toolName} isn't connected yet — arrives in ${version}.` };
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
    run() {
      return notImplemented('Knowledge Tool', 'V0.2');
    },
  },
};
