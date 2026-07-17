// Understand Engine — UNDERSTAND step of the agentic loop.
//
// For every situation it recognizes in the context, answers the four
// questions the spec asks of this stage: what is happening, does it need
// attention, what's the user's likely intention, and would acting actually
// help. Pure function (context in, understandings out) so Plan can stay
// pure too and the whole loop is easy to unit test.
//
// Detectors are additive, same spirit as companion-brain.js's RULES: add a
// new function, spread it into buildUnderstanding()'s list, and nothing
// else needs to change.

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

function scheduledEventUnderstanding(c) {
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

function workingUnderstanding(c) {
  const working = Object.values(c.presence).some((status) => status === 'working');
  return {
    id: 'do-not-disturb',
    situation: working ? 'Allen is working.' : 'Allen is not currently working.',
    needsAttention: false, // this one only ever informs Plan's timing choice
    intent: working ? 'Avoid interrupting focused work.' : 'Normal availability.',
    goal: 'Respect focus time.',
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

function goalsReviewUnderstanding(c) {
  if (c.openGoals.length === 0) return null;
  return {
    id: 'goals-review',
    situation: `${c.openGoals.length} open personal goal${c.openGoals.length === 1 ? '' : 's'} on file.`,
    needsAttention: false, // Plan gates this to a weekly cadence, not every tick
    intent: 'Worth surfacing periodically so goals don\'t quietly go stale.',
    goal: 'Keep personal growth visible without nagging.',
  };
}

const DETECTORS = [
  screenTimeUnderstanding,
  scheduledEventUnderstanding,
  workingUnderstanding,
  eveningWindDownUnderstanding,
  morningDevotionUnderstanding,
  goalsReviewUnderstanding,
];

export function buildUnderstanding(context) {
  return DETECTORS.map((fn) => fn(context)).filter(Boolean);
}
