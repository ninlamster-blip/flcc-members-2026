// JARVIS Memory System — three layers, per the JARVIS spec's Memory System
// section. All of it lives in localStorage on this device only, same
// privacy model as the rest of this repo's standalone apps (see
// ../ofw-companion/README.md "Privacy"): nothing here is uploaded anywhere,
// and Settings-style export/erase controls are exposed through
// exportMemory()/eraseMemory() for the UI to wire up.
//
//   - Short-term:  the current session only. Cleared on eraseShortTerm() /
//                  a new day; never persisted beyond that.
//   - Long-term:   durable personal facts (profile, family, goals) the user
//                  told JARVIS, or that Act recorded from an executed action.
//   - Learned:     patterns JARVIS itself discovered by watching Reflect
//                  outcomes — timing, tone, per-action-id sentiment history.
//
// Kept intentionally dumb: this module only stores and retrieves. Deciding
// *what* to remember is Act's job; deciding what a memory *implies* is
// Learn's job.

import { uid } from './utils.js';

const STORAGE_KEY = 'flcc-jarvis:v1';

function defaultState() {
  return {
    shortTerm: {
      day: null, // date key this session belongs to — a new day resets it
      observations: [], // recent buildContext() snapshots, most recent last
      conversation: [], // { t, from: 'user'|'jarvis', text }
      // "Have I already told Allen this today" bookkeeping for Proactive
      // Intelligence (see core.js's tick()) — rolls over with the rest of
      // shortTerm on a new day, which is exactly the cadence it needs:
      // notifiedIds stops a `mode: 'notify'` step from firing more than
      // once a day when ticks run automatically rather than on a click;
      // resolvedIds stops an `ask-permission` step from re-queuing itself
      // after the user has already approved or denied it today;
      // pendingApprovals is the durable queue itself — earlier ticks'
      // approval requests that haven't been resolved yet must keep
      // showing up, not get silently recomputed away.
      notifiedIds: {}, // { [stepId]: true }
      resolvedIds: {}, // { [stepId]: 'approved' | 'denied' }
      pendingApprovals: [], // [step, ...]
    },
    longTerm: {
      profile: { name: 'Allen', location: 'Kuwait' },
      family: [], // { name, note }
      goals: [], // { text, addedAt }
      reminders: [], // { id, text, addedAt } — Creator Agent's "create reminders"
      facts: [], // { t, text } — "Allen prefers gentle reminders" etc.
    },
    learned: {
      // Per action-id feedback tally, the raw material Learn turns into
      // preferences: { positive, negative, lastAt }
      feedback: {},
      // Freeform preferences Learn has concluded from that feedback, e.g.
      // { style: 'encouraging-first' }. Plan reads this to adjust behavior.
      preferences: {},
      // Per-message-style outcome tallies Learn uses to derive the
      // `style` preference above: { 'encouraging-first': {positive,negative} }
      styleStats: {},
    },
  };
}

function mergeDefaults(defaults, saved) {
  const merged = { ...defaults, ...saved };
  for (const key of Object.keys(defaults)) {
    const d = defaults[key];
    const s = saved[key];
    if (d && s && typeof d === 'object' && typeof s === 'object' && !Array.isArray(d) && !Array.isArray(s)) {
      merged[key] = { ...d, ...s };
    }
  }
  return merged;
}

function load() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return mergeDefaults(defaultState(), JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

let state = load();

function save() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

export function getMemory() {
  return state;
}

// Short-term memory rolls over on a new calendar day — it's "this session",
// not a durable log. Call at the start of a tick so stale context never
// leaks into today's decisions.
export function rollShortTermIfNewDay(todayKey) {
  if (state.shortTerm.day !== todayKey) {
    state.shortTerm = {
      day: todayKey, observations: [], conversation: [],
      notifiedIds: {}, resolvedIds: {}, pendingApprovals: [],
    };
    save();
  }
}

export function pushObservation(context) {
  state.shortTerm.observations.push(context);
  // Keep only the last 20 — Observe/Understand only ever look back a few
  // ticks for a trend; anything older belongs in longTerm.facts instead.
  if (state.shortTerm.observations.length > 20) state.shortTerm.observations.shift();
  save();
}

export function rememberFact(text) {
  // Skip an exact repeat of the most recent fact — harmless from a single
  // click, but record-tick runs every automatic tick too (see core.js), and
  // nothing changing between two ticks a few minutes apart is the normal
  // case, not something worth another identical line in long-term memory.
  if (state.longTerm.facts[0]?.text === text) return;
  state.longTerm.facts.unshift({ t: Date.now(), text });
  save();
}

export function addGoal(text) {
  state.longTerm.goals.unshift({ text, addedAt: Date.now() });
  save();
}

export function addReminder(text) {
  state.longTerm.reminders.unshift({ id: uid(), text, addedAt: Date.now() });
  save();
}

export function removeReminder(id) {
  state.longTerm.reminders = state.longTerm.reminders.filter((r) => r.id !== id);
  save();
}

export function addFamilyMember(name, note = '') {
  state.longTerm.family.unshift({ name, note });
  save();
}

export function recordFeedback(actionId, sentiment) {
  const f = state.learned.feedback[actionId] || { positive: 0, negative: 0, lastAt: null };
  if (sentiment === 'positive') f.positive += 1;
  else if (sentiment === 'negative') f.negative += 1;
  f.lastAt = Date.now();
  state.learned.feedback[actionId] = f;
  save();
}

export function setPreference(key, value) {
  state.learned.preferences[key] = value;
  save();
}

export function getPreference(key, fallback = null) {
  return Object.prototype.hasOwnProperty.call(state.learned.preferences, key)
    ? state.learned.preferences[key]
    : fallback;
}

// ── Proactive Intelligence bookkeeping (see core.js's tick()) ────────────

export function wasNotifiedToday(stepId) {
  return !!state.shortTerm.notifiedIds[stepId];
}

export function markNotifiedToday(stepId) {
  state.shortTerm.notifiedIds[stepId] = true;
  save();
}

export function wasResolvedToday(stepId) {
  return !!state.shortTerm.resolvedIds[stepId];
}

export function markResolvedToday(stepId, outcome) {
  state.shortTerm.resolvedIds[stepId] = outcome;
  save();
}

export function getPendingApprovals() {
  return state.shortTerm.pendingApprovals;
}

// Idempotent by step id — a step already sitting in the queue from an
// earlier tick isn't added again just because a later tick still finds the
// same situation true.
export function addPendingApproval(step) {
  if (state.shortTerm.pendingApprovals.some((s) => s.id === step.id)) return;
  state.shortTerm.pendingApprovals.push(step);
  save();
}

export function removePendingApproval(stepId) {
  state.shortTerm.pendingApprovals = state.shortTerm.pendingApprovals.filter((s) => s.id !== stepId);
  save();
}

export function exportMemory() {
  return JSON.stringify(state, null, 2);
}

export function eraseMemory() {
  state = defaultState();
  save();
}
