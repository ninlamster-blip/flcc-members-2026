// Reading progress, the streak, and the journey's milestones.
// Pure enough to test: every function takes (and returns) plain state.

import * as store from './storage.js';

const EMPTY = { chapters: {}, streak: { count: 0, lastDay: null, best: 0 }, lastRead: null, stories: {} };

export function today(now = new Date()) {
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function getProgress() {
  return { ...EMPTY, ...(store.read(store.KEYS.progress, null) || {}) };
}

function save(next) {
  store.write(store.KEYS.progress, next);
  return next;
}

/** Pure: what a streak becomes when a day is touched. */
export function bumpStreak(streak, day, previousDay) {
  const current = { count: 0, lastDay: null, best: 0, ...(streak || {}) };
  if (current.lastDay === day) return current;
  const count = current.lastDay === previousDay ? current.count + 1 : 1;
  return { count, lastDay: day, best: Math.max(count, current.best || 0) };
}

export function yesterday(day) {
  const date = new Date(`${day}T12:00:00`);
  date.setDate(date.getDate() - 1);
  return today(date);
}

/** Record how far into a chapter the reader got. */
export function recordReading(chapterKey, verse, totalVerses, now = new Date()) {
  const state = getProgress();
  const day = today(now);
  const previous = state.chapters[chapterKey] || { verse: 0, total: totalVerses };
  state.chapters[chapterKey] = {
    verse: Math.max(Number(verse) || 0, previous.verse || 0),
    total: totalVerses || previous.total || 0,
    at: now.toISOString(),
  };
  state.lastRead = { chapter: chapterKey, at: now.toISOString() };
  state.streak = bumpStreak(state.streak, day, yesterday(day));
  return save(state);
}

export function chapterPercent(record) {
  if (!record || !record.total) return 0;
  return Math.max(0, Math.min(100, Math.round((record.verse / record.total) * 100)));
}

export function continueReading(state = getProgress()) {
  if (!state.lastRead) return null;
  const record = state.chapters[state.lastRead.chapter];
  if (!record) return null;
  return { chapter: state.lastRead.chapter, percent: chapterPercent(record), ...record };
}

export function markStoryRead(slug, now = new Date()) {
  const state = getProgress();
  state.stories[slug] = { at: now.toISOString() };
  state.streak = bumpStreak(state.streak, today(now), yesterday(today(now)));
  return save(state);
}

export function chaptersRead(state = getProgress()) {
  return Object.values(state.chapters).filter((c) => chapterPercent(c) >= 90).length;
}

export function storiesRead(state = getProgress()) {
  return Object.keys(state.stories || {}).length;
}
