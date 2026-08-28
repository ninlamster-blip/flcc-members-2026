// Authored content: JSON under content/, loaded once and cached.
// Content is data. It is never executed and never handed to a model as
// instructions.

const cache = new Map();

export async function load(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(new URL(`../../content/${path}`, import.meta.url))
    .then((response) => {
      if (!response.ok) throw new Error(`Content missing: ${path} (HTTP ${response.status})`);
      return response.json();
    })
    .catch((error) => { cache.delete(path); throw error; });
  cache.set(path, promise);
  return promise;
}

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
