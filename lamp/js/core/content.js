// Authored content: JSON under lamp/content/, loaded once and cached in memory.
// Content is data — it is never executed, and never handed to the model as
// instructions (SPEC.md §11, §14).

const cache = new Map();

export async function load(path) {
  if (cache.has(path)) return cache.get(path);
  const promise = fetch(new URL(`../../content/${path}`, import.meta.url))
    .then((response) => {
      if (!response.ok) throw new Error(`Content missing: ${path} (HTTP ${response.status})`);
      return response.json();
    })
    .catch((error) => {
      cache.delete(path);
      throw error;
    });
  cache.set(path, promise);
  return promise;
}

export const stories = () => load('stories/index.json');
export const story = (slug) => load(`stories/${slug}.json`);
export const daily = () => load('daily.json');
export const memoryVerses = () => load('memory-verses.json');
export const challenges = () => load('challenges.json');
export const moods = () => load('prayer-moods.json');
export const journalPrompts = () => load('journal-prompts.json');
export const safety = (region) => load(`safety/${region}.json`);
