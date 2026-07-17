// Family Agent — relationships, connection, screen-time balance. Owns the
// spec's own worked example end to end: Jared's screen time, the deferred
// "do not interrupt Allen" nudge, and the always-approval-gated message to
// Jared himself.
import { getMemory } from '../memory.js';
import { isConnected, callAI } from '../ai-client.js';
import { currentStyle, styleLine } from '../style.js';

export const id = 'family';
export const name = 'Family Agent';
export const description = 'Relationships, connection, screen-time balance.';

const GAMING_LIMIT_HOURS = 2.5;

function screenTimeUnderstanding(c) {
  const hours = c.jaredGamingHours;
  if (typeof hours !== 'number') return null;
  const heavy = hours >= GAMING_LIMIT_HOURS;
  return {
    id: 'screen-time',
    situation: `Jared has been gaming for ${hours} hour${hours === 1 ? '' : 's'}.`,
    needsAttention: heavy,
    intent: heavy
      ? 'Gaming is enjoyable but excessive screen time may affect sleep and family time.'
      : 'Within a normal range — no concern yet.',
    goal: 'Maintain a healthy balance without damaging the father-son relationship.',
  };
}

function eveningWindDownUnderstanding(c) {
  if (c.partOfDay !== 'evening') return null;
  return {
    id: 'evening-checkin',
    situation: `It's evening (${c.time}).`,
    needsAttention: true,
    intent: 'Evenings are a natural moment to reconnect with family before the day ends.',
    goal: 'Support family connection.',
  };
}

// Reads `context.playingDevices` — Environment Context that home.js (V0.4)
// populates via Observe, the same fuse-but-separate pattern `screenTime`
// above uses for personal signals and the Knowledge briefing uses for
// news. Family Agent doesn't import home.js directly; it only reads the
// unified context, same as every other detector here.
function deviceDuringDevotionUnderstanding(c) {
  if (c.playingDevices.length === 0) return null;
  const devotionToday = c.events.some((e) => /devotion/i.test(e.label));
  if (!devotionToday) return null;
  return {
    id: 'device-during-devotion',
    situation: `${c.playingDevices.join(', ')} still playing, and family devotion is scheduled today.`,
    needsAttention: true,
    intent: 'A playing device may compete for attention during family devotion.',
    goal: 'Protect family/faith time without deciding for anyone.',
  };
}

export function understand(context) {
  return [
    screenTimeUnderstanding(context),
    eveningWindDownUnderstanding(context),
    deviceDuringDevotionUnderstanding(context),
  ].filter(Boolean);
}

export function plan(context, { understandings, working }) {
  const steps = [];
  const screenTime = understandings.find((u) => u.id === 'screen-time');
  const evening = understandings.find((u) => u.id === 'evening-checkin');

  if (screenTime?.needsAttention) {
    steps.push({
      id: 'notify-jared-gaming',
      agent: id,
      mode: working ? 'wait' : 'notify',
      requiresApproval: false,
      target: 'allen',
      message: styleLine(
        `Jared's been gaming a while. ${screenTime.situation} Might be a good moment to check in.`,
        `${screenTime.situation} Consider suggesting a break.`,
      ),
      styleUsed: currentStyle(),
      tool: { name: 'notify', params: {} },
    });
    steps.push({
      id: 'suggest-encouragement-to-jared',
      agent: id,
      mode: 'ask-permission',
      requiresApproval: true, // reaches Jared, not Allen — always gated
      target: 'jared',
      message: styleLine(
        "Hey, having fun? Whenever you're ready, would love to hang out for a bit.",
        'Time for a break soon?',
      ),
      styleUsed: currentStyle(),
      tool: { name: 'message', params: { to: 'jared' } },
    });
  }

  // Only add the generic evening nudge if the gaming-specific one above
  // didn't already cover reconnecting with family tonight.
  if (evening?.needsAttention && !screenTime?.needsAttention) {
    steps.push({
      id: 'suggest-evening-connection',
      agent: id,
      mode: working ? 'wait' : 'notify',
      requiresApproval: false,
      target: 'allen',
      message: 'Your evening is winding down — a good moment to connect with family.',
      tool: { name: 'notify', params: {} },
    });
  }

  const deviceDuringDevotion = understandings.find((u) => u.id === 'device-during-devotion');
  if (deviceDuringDevotion?.needsAttention) {
    steps.push({
      id: 'suggest-pause-for-devotion',
      agent: id,
      // Like suggest-encouragement-to-jared above: 'ask-permission' steps
      // sit quietly in the approval queue rather than notifying anyone, so
      // there's nothing to defer even while Allen is working.
      mode: 'ask-permission',
      // Pausing a device is a real, physical-world action on shared home
      // equipment — always gated, same reasoning as messaging Jared
      // directly: JARVIS suggests, Allen decides.
      requiresApproval: true,
      target: 'home',
      message: `${deviceDuringDevotion.situation} Pause for devotion?`,
      tool: { name: 'home', params: {} },
    });
  }

  return steps;
}

// "Suggest ideas" from the spec's Action list, scoped to family connection.
const OFFLINE_IDEAS = [
  'Ask Jared to show you his favorite level or match from today.',
  'Cook his favorite snack together instead of just calling him to dinner.',
  'Sit with him for a few minutes and just watch before saying anything.',
  'Ask about one specific thing he mentioned recently and follow up on it.',
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function suggestConnectionIdea() {
  if (!isConnected()) return { ok: true, detail: pick(OFFLINE_IDEAS) };
  const mem = getMemory();
  const familyNotes = mem.longTerm.family.map((f) => `${f.name}: ${f.note}`).join('; ') || 'Jared (son)';
  const result = await callAI({
    system: `Suggest one short, warm, concrete way for a father in Kuwait to connect with his family today. Family: ${familyNotes}. One or two sentences only, no preamble.`,
    message: 'Suggest one connection idea for today.',
    maxTokens: 150,
  });
  return result.ok ? result : { ok: true, detail: `${pick(OFFLINE_IDEAS)} (offline fallback — ${result.detail})` };
}
