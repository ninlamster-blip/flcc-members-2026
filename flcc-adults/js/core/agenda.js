// What is next.
//
// This module is the reason the app is called NEXT. Every root screen answers
// one question before it answers any other — "what is my next meaningful
// step?" — and for anything that happens in a room with other people, the
// answer comes from here.
//
// It exists because the church's own calendar is written for people, not for
// machines. "Every Friday · 10:00 AM – 12:00 PM" is exactly right on a notice
// board and useless to a countdown, so every event carries BOTH: the sentence
// a member reads (`when`) and the machine-readable shape underneath it
// (`weekday` + `start`, or `date` + `start`). The sentence is what is shown.
// The shape is what is counted.
//
// Everything here is a pure function of an event and a moment. No storage, no
// fetch, no Date.now() hidden inside a branch — which is why a Friday service
// two weeks out can be tested without waiting a fortnight.

/** "10:00" → { hours: 10, minutes: 0 }. Anything unparseable is midnight. */
export function parseTime(text) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(text || '').trim());
  if (!match) return { hours: 0, minutes: 0 };
  return { hours: Math.min(23, Number(match[1])), minutes: Math.min(59, Number(match[2])) };
}

const at = (date, time) => {
  const { hours, minutes } = parseTime(time);
  const out = new Date(date);
  out.setHours(hours, minutes, 0, 0);
  return out;
};

/** Midnight at the start of a day, so two moments can be compared as dates. */
const midnight = (date) => {
  const out = new Date(date);
  out.setHours(0, 0, 0, 0);
  return out;
};

/** Whole days from one moment to another, counted as calendar days. */
export function daysBetween(from, to) {
  return Math.round((midnight(to) - midnight(from)) / 86400000);
}

/**
 * When this event next happens, or null if it never happens again.
 *
 * Three shapes, in the order they are checked:
 *
 *   `dates: []`  a short series — the four Fridays of a membership class.
 *   `date`       one occasion.
 *   `weekday`    every week. 0 is Sunday, 5 is Friday.
 *
 * An event that is *currently running* returns its own start time rather than
 * next week's, so "Friday main service" at 11am reads "Happening now" instead
 * of counting down to the following Friday. That is the whole reason `minutes`
 * exists on an event.
 */
export function nextOccurrence(event, now = new Date()) {
  if (!event) return null;
  const runs = Number(event.minutes) || 0;
  const stillOn = (start) => new Date(start.getTime() + runs * 60000) > now;

  if (Array.isArray(event.dates) && event.dates.length) {
    return event.dates
      .map((day) => at(new Date(`${day}T00:00:00`), event.start))
      .filter((start) => !Number.isNaN(start.getTime()) && stillOn(start))
      .sort((a, b) => a - b)[0] || null;
  }

  if (event.date) {
    const start = at(new Date(`${event.date}T00:00:00`), event.start);
    if (Number.isNaN(start.getTime())) return null;
    return stillOn(start) ? start : null;
  }

  if (event.weekday === undefined || event.weekday === null) return null;
  const start = at(now, event.start);
  let ahead = (Number(event.weekday) - start.getDay() + 7) % 7;
  if (ahead === 0 && !stillOn(start)) ahead = 7;
  start.setDate(start.getDate() + ahead);
  return start;
}

/** Whether the event is running at this moment. */
export function isNow(event, now = new Date()) {
  const start = nextOccurrence(event, now);
  if (!start) return false;
  const runs = Number(event.minutes) || 0;
  return start <= now && new Date(start.getTime() + runs * 60000) > now;
}

/**
 * How far away it is, said the way a person would say it.
 *
 * Deliberately vague past a week. "In 23 days" is a number nobody acts on;
 * "Friday 3 October" is a thing you can write down.
 */
export function countdown(start, now = new Date()) {
  if (!start) return '';
  const days = daysBetween(now, start);
  if (days < 0) return '';
  if (days === 0) return start > now ? 'Later today' : 'Happening now';
  if (days === 1) return 'Tomorrow';
  if (days <= 6) return `In ${days} days`;
  if (days <= 13) return 'Next week';
  // Past a fortnight it stops counting and names the day. Kept short: this is
  // rendered as a tag beside a heading, and "Thursday, 12 November" wraps to
  // three lines on a phone and swamps the thing it is labelling.
  return start.toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

/** The date and time, written out. Used under a countdown, never instead of it. */
export function stamp(start) {
  if (!start) return '';
  return start.toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })
    + ' · ' + start.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
}

/**
 * Everything that has not happened yet, soonest first.
 *
 * An event with no machine-readable shape at all is kept rather than dropped —
 * it simply sorts to the end and shows its own sentence. A church notice that
 * somebody forgot to date should still appear on the Community screen.
 */
export function upcoming(events, { now = new Date(), limit = 0 } = {}) {
  const list = (Array.isArray(events) ? events : []).map((event) => {
    const start = nextOccurrence(event, now);
    return {
      event,
      at: start,
      days: start ? daysBetween(now, start) : Number.POSITIVE_INFINITY,
      now: isNow(event, now),
      countdown: countdown(start, now),
    };
  }).sort((a, b) => (a.at ? a.at.getTime() : Infinity) - (b.at ? b.at.getTime() : Infinity));
  return limit > 0 ? list.slice(0, limit) : list;
}

/** The next thing on the church's calendar. */
export function nextUp(events, now = new Date()) {
  return upcoming(events, { now }).find((one) => one.at) || null;
}

/**
 * The framing for the Today screen.
 *
 * The home screen changes through the week rather than saying the same thing
 * every morning, and this is the only place that decision is made — a screen
 * that worked it out for itself would drift out of step with the others.
 *
 * Five states, in the order they win:
 *
 *   gathered   the service is happening right now
 *   after      it finished within the last six hours — the moment worth
 *              catching before it goes
 *   eve        it is tomorrow or later today
 *   soon       it is inside the week
 *   ordinary   everything else, which is most days and is fine
 */
export function pulse(events, now = new Date()) {
  const running = (Array.isArray(events) ? events : []).find((one) => one.gathering && isNow(one, now));
  if (running) {
    return { state: 'gathered', event: running, line: 'The church is gathered right now.' };
  }

  const gatherings = (Array.isArray(events) ? events : []).filter((one) => one.gathering);
  for (const event of gatherings) {
    const next = nextOccurrence(event, now);
    if (!next) continue;
    const runs = Number(event.minutes) || 0;
    // The previous occurrence of a weekly gathering: whatever the next one is,
    // minus a week. For a one-off there is no previous one to look back at.
    const last = event.weekday === undefined || event.weekday === null
      ? null : new Date(next.getTime() - 7 * 86400000 + runs * 60000);
    if (last && now - last >= 0 && now - last < 6 * 3600000) {
      return { state: 'after', event, line: 'Do not lose the moment.' };
    }
  }

  const next = gatherings
    .map((event) => ({ event, at: nextOccurrence(event, now) }))
    .filter((one) => one.at)
    .sort((a, b) => a.at - b.at)[0];

  if (next) {
    const days = daysBetween(now, next.at);
    if (days <= 1) return { state: 'eve', event: next.event, line: 'Worship is coming.' };
    if (days <= 6) return { state: 'soon', event: next.event, line: 'Your faith journey continues today.' };
  }
  return { state: 'ordinary', event: next ? next.event : null, line: 'Your faith journey continues today.' };
}
