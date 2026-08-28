// Authored content: JSON under content/, loaded once and laid over with
// whatever this device's ministry leader has edited.
//
// Content is data. It is never executed and never handed to a model as
// instructions.
//
// Two layers, and only one of them is cached:
//
//   the base    the committed file, fetched once per session
//   the pack    this device's own additions and edits (js/core/library.js)
//
// The pack is applied on every read rather than cached with the base, so a
// question added in the dashboard is in the next round of the quiz without
// anything needing to be told to reload. Fetching is the expensive part; laying
// a few dozen edits over a few hundred rows is not.

import * as library from './library.js';

const bases = new Map();

function base(path) {
  if (bases.has(path)) return bases.get(path);
  const promise = fetch(new URL(`../../content/${path}`, import.meta.url))
    .then((response) => {
      if (!response.ok) throw new Error(`Content missing: ${path} (HTTP ${response.status})`);
      return response.json();
    })
    .catch((error) => { bases.delete(path); throw error; });
  bases.set(path, promise);
  return promise;
}

export async function load(path) {
  return library.apply(path, await base(path));
}

/** The committed file, with nothing laid over it. The dashboard shows both. */
export const original = (path) => base(path);

export const daily = () => load('daily.json');
export const journeys = () => load('journeys.json');
export const lessons = (id) => load(`journeys/${id}.json`);
export const realLife = () => load('real-life.json');
export const games = () => load('games.json');
export const quiz = () => load('games/quiz.json');
export const whoAmI = () => load('games/who-am-i.json');
export const verses = () => load('games/verse-builder.json');
export const crosswords = () => load('games/crossword.json');
export const events = () => load('events.json');
export const achievements = () => load('achievements.json');
export const help = () => load('help-lines.json');
export const bibleBooks = () => load('bible-books.json');
export const bibleFind = () => load('bible-find.json');
