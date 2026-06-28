// Lightweight SM-2 spaced repetition scheduler, persisted in State.srs.
import { State, save, today } from './core.js';

// grade: 0 again, 1 hard, 2 good, 3 easy
const Q = { 0: 2, 1: 3, 2: 4, 3: 5 };

function nowDay() { return Math.floor(Date.now() / 86400000); }

export function getCard(id) {
  return State.srs[id] || { ease: 2.5, interval: 0, reps: 0, due: 0 };
}

export function review(id, grade) {
  const c = getCard(id);
  const q = Q[grade];
  if (grade === 0) {
    c.reps = 0;
    c.interval = 0; // see again this session / next day
  } else {
    c.reps += 1;
    if (c.reps === 1) c.interval = 1;
    else if (c.reps === 2) c.interval = grade === 1 ? 2 : 4;
    else c.interval = Math.round(c.interval * c.ease * (grade === 1 ? 0.7 : 1));
    if (grade === 3) c.interval = Math.round(c.interval * 1.3);
  }
  // ease factor update
  c.ease = Math.max(1.3, c.ease + (0.1 - (5 - q) * (0.08 + (5 - q) * 0.02)));
  c.due = nowDay() + c.interval;
  c.last = today();
  State.srs[id] = c;
  save();
  return c;
}

// Which of the supplied ids are due now (or never seen).
export function dueCards(ids) {
  const d = nowDay();
  return ids.filter(id => {
    const c = State.srs[id];
    return !c || c.due <= d;
  });
}

export function srsStats(ids) {
  const d = nowDay();
  let learning = 0, due = 0, mature = 0, fresh = 0;
  for (const id of ids) {
    const c = State.srs[id];
    if (!c) { fresh++; continue; }
    if (c.due <= d) due++;
    if (c.interval >= 21) mature++;
    else learning++;
  }
  return { learning, due, mature, fresh, total: ids.length };
}
