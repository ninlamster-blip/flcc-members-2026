/**
 * SaveManager — single localStorage-backed save file for Daily Blessing.
 * Mirrors the pattern used by faith-match/Utils/SaveManager.js so the two
 * mini-apps feel consistent, but keeps its own storage key/namespace.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'db_save_v1';
  const SCHEMA_VERSION = 1;

  function defaultData() {
    return {
      version: SCHEMA_VERSION,
      profile: {
        name: '',
        level: 1,
        coins: 0,
        xp: 0,
        badges: [],           // milestone badge ids earned
        bibleReadingDays: 0,
        prayerDays: 0
      },
      streak: {
        current: 0,
        longest: 0,
        lastOpenDate: null,   // YYYY-MM-DD of last successful open
        milestonesSeen: []    // milestone day numbers already celebrated
      },
      history: {
        openDates: [],        // all YYYY-MM-DD dates the blessing was opened (for heatmap)
        timeline: []           // [{date, ts, label}] most recent first, capped
      },
      today: {
        date: null,           // YYYY-MM-DD this cached reward belongs to
        reward: null,          // the generated reward bundle for today
        opened: false          // whether the user has run the opening animation today
      },
      content: {
        used: {}               // { categoryKey: [usedIndices...] }
      },
      collection: {
        owned: {}               // { characterId: countCollected }
      },
      settings: {
        soundOn: true,
        reducedMotion: null    // null = follow system preference
      }
    };
  }

  function migrate(data) {
    const fresh = defaultData();
    return Object.assign({}, fresh, data, {
      profile: Object.assign({}, fresh.profile, data.profile),
      streak: Object.assign({}, fresh.streak, data.streak),
      history: Object.assign({}, fresh.history, data.history),
      today: Object.assign({}, fresh.today, data.today),
      content: Object.assign({}, fresh.content, data.content),
      collection: Object.assign({}, fresh.collection, data.collection),
      settings: Object.assign({}, fresh.settings, data.settings)
    });
  }

  class SaveManager {
    constructor() {
      this.data = this._load();
    }

    _load() {
      try {
        const raw = global.localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultData();
        return migrate(JSON.parse(raw));
      } catch (e) {
        return defaultData();
      }
    }

    save() {
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (e) { /* storage unavailable (private mode, quota) — fail silently */ }
    }

    reset() {
      this.data = defaultData();
      this.save();
    }

    addTimelineEntry(label) {
      const key = global.DateUtils.dateKey();
      this.data.history.timeline.unshift({ date: key, ts: Date.now(), label });
      this.data.history.timeline = this.data.history.timeline.slice(0, 200);
    }
  }

  global.DB_SAVE = new SaveManager();
})(window);
