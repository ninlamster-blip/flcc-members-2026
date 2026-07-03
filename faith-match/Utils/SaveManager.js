/**
 * SaveManager — single source of truth for all persisted player data.
 * Wraps localStorage with a versioned schema, safe defaults, and
 * migration hooks so future phases can extend the save shape without
 * breaking existing players. Emits FM_BUS 'save_updated' after every write.
 */
(function (global) {
  'use strict';

  const { STORAGE_KEY, EVENTS } = global.FM_CONST;

  function defaultSave() {
    return {
      version: 1,
      createdAt: Date.now(),
      updatedAt: Date.now(),

      // Progression
      coins: 100,
      xp: 0,
      faithLevel: 1,
      stars: {}, // { [levelId]: 0-3 }
      completedLevels: {}, // { [levelId]: { stars, bestScore, movesUsed, completedAt } }
      unlockedWorlds: [1],
      highestLevelUnlocked: 1,

      // Powerup inventory
      powerups: {
        prayer: 3,
        extra_moves: 3,
        hint: 5,
        shuffle: 3,
        hammer: 2,
        cross_blast: 1
      },

      // Achievements: { [achievementId]: { unlocked, unlockedAt, progress } }
      achievements: {},

      // Daily rewards
      dailyLogin: {
        lastClaimDate: null, // 'YYYY-MM-DD'
        streak: 0,
        totalClaims: 0
      },

      // Weekly challenge
      weeklyChallenge: {
        weekKey: null, // e.g. '2026-W27'
        score: 0,
        completed: false,
        claimedReward: false
      },

      // Daily challenge (a single featured level that rotates by date)
      dailyChallenge: {
        dateKey: null, // 'YYYY-MM-DD'
        bestScore: 0,
        played: false
      },

      // Lightweight lifetime counters, used by the achievement system.
      stats: {
        levelsCompleted: 0,
        totalStarsEarned: 0,
        specialsActivated: 0,
        combosTriggered: 0
      },

      // Local leaderboard entries (per-device, no backend)
      leaderboard: {
        bestScore: 0,
        fastestCompletionMs: null,
        highestFaithLevel: 1,
        history: [] // { levelId, score, moves, timeMs, date }
      },

      // Settings
      settings: {
        musicOn: false,
        sfxOn: true,
        musicVolume: 0.6,
        sfxVolume: 0.8,
        language: 'en'
      },

      // Seen scripture verse ids, to reduce immediate repeats
      seenVerseIds: []
    };
  }

  class SaveManager {
    constructor() {
      this.data = this._load();
    }

    _load() {
      try {
        const raw = global.localStorage.getItem(STORAGE_KEY);
        if (!raw) return defaultSave();
        const parsed = JSON.parse(raw);
        return this._migrate(this._mergeDefaults(defaultSave(), parsed));
      } catch (e) {
        console.warn('[SaveManager] Failed to load save, using defaults.', e);
        return defaultSave();
      }
    }

    // Deep-merge saved data onto a fresh default so newly added fields
    // (from later phases) are always present for existing players.
    //
    // Walks the UNION of keys from both defaults and saved, not just
    // defaults' own keys. Several fields (completedLevels, stars,
    // achievements) start as an empty {} in the default schema since
    // their real keys are dynamic (level ids, achievement ids) rather
    // than fixed — iterating only defaults' keys meant those dynamic
    // dictionaries were silently wiped back to {} on every reload,
    // since none of the player's actual keys ever existed in defaults.
    _mergeDefaults(defaults, saved) {
      const out = Array.isArray(defaults) ? [] : {};
      const keys = new Set(Object.keys(defaults));
      if (saved) Object.keys(saved).forEach((k) => keys.add(k));
      for (const key of keys) {
        const dVal = defaults[key];
        const sVal = saved ? saved[key] : undefined;
        if (sVal === undefined || sVal === null) {
          out[key] = dVal;
        } else if (
          typeof dVal === 'object' &&
          dVal !== null &&
          !Array.isArray(dVal) &&
          typeof sVal === 'object' &&
          !Array.isArray(sVal)
        ) {
          out[key] = this._mergeDefaults(dVal, sVal);
        } else {
          out[key] = sVal;
        }
      }
      return out;
    }

    _migrate(data) {
      // Placeholder for future version bumps.
      data.version = 1;
      return data;
    }

    save() {
      this.data.updatedAt = Date.now();
      try {
        global.localStorage.setItem(STORAGE_KEY, JSON.stringify(this.data));
      } catch (e) {
        console.error('[SaveManager] Failed to persist save.', e);
      }
      global.FM_BUS.emit(EVENTS.SAVE_UPDATED, this.data);
      return this.data;
    }

    get(path, fallback) {
      const parts = path.split('.');
      let cur = this.data;
      for (const p of parts) {
        if (cur == null) return fallback;
        cur = cur[p];
      }
      return cur === undefined ? fallback : cur;
    }

    set(path, value) {
      const parts = path.split('.');
      let cur = this.data;
      for (let i = 0; i < parts.length - 1; i++) {
        if (typeof cur[parts[i]] !== 'object' || cur[parts[i]] === null) {
          cur[parts[i]] = {};
        }
        cur = cur[parts[i]];
      }
      cur[parts[parts.length - 1]] = value;
      return this.save();
    }

    addCoins(amount) {
      this.data.coins = Math.max(0, this.data.coins + amount);
      return this.save();
    }

    addXP(amount) {
      this.data.xp += amount;
      // Simple leveling curve: level N requires N*250 XP cumulative.
      let level = 1;
      let remaining = this.data.xp;
      let threshold = 250;
      while (remaining >= threshold) {
        remaining -= threshold;
        level += 1;
        threshold = level * 250;
      }
      this.data.faithLevel = level;
      if (level > this.data.leaderboard.highestFaithLevel) {
        this.data.leaderboard.highestFaithLevel = level;
      }
      return this.save();
    }

    resetProgress() {
      this.data = defaultSave();
      return this.save();
    }

    exportJSON() {
      return JSON.stringify(this.data, null, 2);
    }
  }

  global.FM_SAVE = global.FM_SAVE || new SaveManager();
  global.SaveManager = SaveManager;
})(window);
