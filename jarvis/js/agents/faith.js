// Faith Agent — devotions, prayer, scripture rhythms. Understand/Plan logic
// used to live inline in understand.js/plan.js; moved here in V0.3 so this
// domain is a real module core.js routes to, not just a display label (see
// ../../README.md's "New specialist agent" note).
import { getMemory } from '../memory.js';
import { isConnected, callAI } from '../ai-client.js';

export const id = 'faith';
export const name = 'Faith Agent';
export const description = 'Devotions, prayer, scripture rhythms.';

function scheduledDevotionUnderstanding(c) {
  const devotion = c.events.find((e) => /devotion/i.test(e.label));
  if (!devotion) return null;
  return {
    id: 'family-devotion',
    situation: `${devotion.label} is scheduled today${devotion.note ? ` (${devotion.note})` : ''}.`,
    needsAttention: true,
    intent: 'A scheduled family/faith moment is coming up — worth a gentle reminder, not a demand.',
    goal: 'Support family and faith rhythms without being pushy.',
  };
}

function morningDevotionUnderstanding(c) {
  if (c.partOfDay !== 'morning') return null;
  return {
    id: 'morning-devotion',
    situation: `It's morning (${c.time}).`,
    needsAttention: true,
    intent: 'A short devotion before work sets a grounded tone for the day.',
    goal: 'Support Allen\'s faith rhythm.',
  };
}

export function understand(context) {
  return [scheduledDevotionUnderstanding(context), morningDevotionUnderstanding(context)].filter(Boolean);
}

export function plan(context, { understandings, working }) {
  const steps = [];
  const devotion = understandings.find((u) => u.id === 'family-devotion');
  const morning = understandings.find((u) => u.id === 'morning-devotion');

  if (devotion?.needsAttention) {
    steps.push({
      id: 'notify-devotion',
      agent: id,
      mode: working ? 'wait' : 'notify',
      requiresApproval: false,
      target: 'allen',
      message: `${devotion.situation} A gentle reminder, not a demand.`,
      tool: { name: 'notify', params: {} },
    });
  }

  // Only one faith-rhythm nudge per tick — an evening devotion reminder
  // already covers "make time for faith today," a morning one would be
  // redundant on top of it.
  if (morning?.needsAttention && !devotion) {
    steps.push({
      id: 'suggest-morning-devotion',
      agent: id,
      mode: working ? 'wait' : 'notify',
      requiresApproval: false,
      target: 'allen',
      message: 'Allen, today you have time for a short devotion before work.',
      tool: { name: 'notify', params: {} },
    });
  }

  return steps;
}

// "Creation: Generate prayers" from the spec's Action list. Personalizes
// from Personal Memory (facts JARVIS has been told) — distinct from the
// Knowledge Engine's neutral prompts, since this is the Faith Agent's own
// territory, not Global Knowledge.
const OFFLINE_PRAYERS = [
  "Lord, thank You for this day and for my family. Give me wisdom to lead them well and patience for the moments that test me. Amen.",
  "Father, watch over my family — keep them close to each other and close to You. Amen.",
  "God, thank You for Your faithfulness. Help me make time for You today, even in the busyness of work and home. Amen.",
  "Lord, give me eyes to see what my family needs today, and the gentleness to offer it well. Amen.",
];

function pick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

export async function generatePrayer(topic = '') {
  if (!isConnected()) return { ok: true, detail: pick(OFFLINE_PRAYERS) };
  const mem = getMemory();
  const notes = mem.longTerm.facts.slice(0, 3).map((f) => f.text).join(' ') || 'no specific personal notes on file';
  const result = await callAI({
    system: `You are writing a short, warm, non-denominational Christian prayer (4-6 sentences) for Allen, a father in Kuwait. You may gently draw on this personal context without quoting it verbatim, and never invent facts beyond it: ${notes}`,
    message: topic || 'Write a short prayer for today.',
    maxTokens: 300,
  });
  return result.ok ? result : { ok: true, detail: `${pick(OFFLINE_PRAYERS)} (offline fallback — ${result.detail})` };
}
