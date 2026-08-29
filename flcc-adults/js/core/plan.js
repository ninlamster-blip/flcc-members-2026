// Reading plans.
//
// A plan is a list of days, each day a reference. The plan itself is authored
// content; where the reader is in it is the only thing kept on the device.
//
// The rule that makes a plan survivable: **a plan is a sequence, not a
// calendar.** Day 12 is the twelfth reading this person has done, not the
// twelfth day since they started. Miss a fortnight and the plan is exactly
// where it was — there is nothing to "catch up" on, and no red number telling
// an adult they have failed at reading the Bible. That is the single most
// common reason people abandon a reading plan, and it is a design choice, not
// a fact of life.

import * as store from './storage.js';
import * as progress from './progress.js';

export function state() {
  return { id: null, started: null, ...(store.read(store.KEYS.plan, null) || {}) };
}

export function start(planId) {
  const next = { id: planId, started: new Date().toISOString() };
  store.write(store.KEYS.plan, next);
  return next;
}

export function stop() { store.write(store.KEYS.plan, { id: null, started: null }); }

/** The completion key for one day of one plan. */
export const dayKey = (planId, day) => `${planId}:${day}`;

/**
 * Where this reader is in a plan.
 *
 * `day` is one-based and is the next unread day; `at` is the reading itself.
 * A finished plan reports `done: true` and keeps its last day, so the screen
 * can say so rather than falling off the end of the array.
 */
export function positionIn(plan) {
  const days = Array.isArray(plan && plan.days) ? plan.days : [];
  const keys = days.map((_, i) => dayKey(plan.id, i + 1));
  const { finished, percent } = progress.through('reading', keys);
  const done = finished >= days.length && days.length > 0;
  const day = done ? days.length : finished + 1;
  return { day, total: days.length, finished, percent, done, at: days[day - 1] || null };
}

export function markRead(plan, day) {
  return progress.complete('reading', dayKey(plan.id, day));
}

export function isRead(plan, day) {
  return progress.isDone('reading', dayKey(plan.id, day));
}
