/**
 * Content — loads every JSON content pool and hands out non-repeating
 * random picks per category. Each category shuffles through its full pool
 * before any item can repeat, tracked in SaveManager.data.content.used.
 */
(function (global) {
  'use strict';

  const FILES = {
    scriptures: 'data/scriptures.json',
    prayers: 'data/prayers.json',
    encouragements: 'data/encouragements.json',
    reflections: 'data/reflections.json',
    challenges: 'data/challenges.json',
    devotionals: 'data/devotionals.json',
    pastorMessages: 'data/pastorMessages.json',
    announcements: 'data/announcements.json',
    worshipSongs: 'data/worshipSongs.json',
    historicalFacts: 'data/historicalFacts.json',
    characterData: 'data/characters.json'
  };

  class Content {
    constructor() {
      this.pools = {};
      this.characters = [];
      this.characterCollection = null;
      this.ready = false;
    }

    async load() {
      const entries = Object.entries(FILES);
      const results = await Promise.all(entries.map(([, path]) =>
        fetch(path).then((r) => {
          if (!r.ok) throw new Error(`Failed to load ${path}`);
          return r.json();
        })
      ));
      entries.forEach(([key], i) => { this.pools[key] = results[i]; });
      this.characters = this.pools.characterData.characters;
      this.characterCollection = this.pools.characterData.collection;
      this.ready = true;
    }

    /** Picks a random item from `category`, cycling the whole pool before any repeat. */
    pick(category) {
      const pool = this.pools[category];
      if (!pool || !pool.length) return null;
      const used = global.DB_SAVE.data.content.used;
      let usedIdx = used[category] || [];

      if (usedIdx.length >= pool.length) usedIdx = [];

      const available = pool.map((_, i) => i).filter((i) => !usedIdx.includes(i));
      const choice = available[Math.floor(Math.random() * available.length)];

      used[category] = [...usedIdx, choice];
      global.DB_SAVE.save();

      return { item: pool[choice], index: choice, category };
    }

    /** Picks a scripture, optionally restricted to ones flagged memory:true. */
    pickScripture(memoryOnly) {
      if (!memoryOnly) return this.pick('scriptures');
      const pool = this.pools.scriptures;
      const memoryPool = pool.filter((s) => s.memory);
      const used = global.DB_SAVE.data.content.used;
      let usedIdx = used.memoryScriptures || [];
      if (usedIdx.length >= memoryPool.length) usedIdx = [];
      const available = memoryPool.map((_, i) => i).filter((i) => !usedIdx.includes(i));
      const choice = available[Math.floor(Math.random() * available.length)];
      used.memoryScriptures = [...usedIdx, choice];
      global.DB_SAVE.save();
      return { item: memoryPool[choice], category: 'memoryScriptures' };
    }

    /** Picks the next uncollected character where possible, falling back to random once full. */
    pickCharacter() {
      const owned = global.DB_SAVE.data.collection.owned;
      const uncollected = this.characters.filter((c) => !owned[c.id]);
      const pool = uncollected.length ? uncollected : this.characters;
      return pool[Math.floor(Math.random() * pool.length)];
    }
  }

  global.DB_CONTENT = new Content();
})(window);
