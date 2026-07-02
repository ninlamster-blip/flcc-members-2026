/**
 * LevelManager — thin caching layer over LevelGenerator plus unlock/
 * progress queries against SaveManager. Levels unlock strictly in
 * sequence (level N requires level N-1 completed), so a world is
 * "unlocked" exactly when its first level is reachable.
 */
(function (global) {
  'use strict';

  const _cache = new Map();

  function getLevel(levelId) {
    if (!_cache.has(levelId)) {
      _cache.set(levelId, global.LevelGenerator.generateLevelConfig(levelId));
    }
    return _cache.get(levelId);
  }

  function isLevelCompleted(levelId) {
    return !!global.FM_SAVE.data.completedLevels[levelId];
  }

  function isLevelUnlocked(levelId) {
    if (levelId <= 1) return true;
    if (levelId > global.FM_CONST.TOTAL_LEVEL_COUNT) return false;
    return isLevelCompleted(levelId - 1);
  }

  function isWorldUnlocked(worldId) {
    const world = global.FM_CONST.WORLDS.find((w) => w.id === worldId);
    if (!world) return false;
    return isLevelUnlocked(world.startLevelId);
  }

  function getWorldProgress(worldId) {
    const world = global.FM_CONST.WORLDS.find((w) => w.id === worldId);
    if (!world) return { completed: 0, total: 0, stars: 0 };
    let completed = 0;
    let stars = 0;
    for (let id = world.startLevelId; id <= world.endLevelId; id++) {
      const entry = global.FM_SAVE.data.completedLevels[id];
      if (entry) {
        completed++;
        stars += entry.stars || 0;
      }
    }
    return { completed, total: world.levels, stars, maxStars: world.levels * 3 };
  }

  function getHighestUnlockedLevel() {
    for (let id = 1; id <= global.FM_CONST.TOTAL_LEVEL_COUNT; id++) {
      if (!isLevelCompleted(id)) return id;
    }
    return global.FM_CONST.TOTAL_LEVEL_COUNT;
  }

  /**
   * Computes a 0-3 star rating from the final score against the level's
   * starThresholds, used both by GameScene's win screen and by
   * SaveManager writes.
   */
  function starsForScore(level, score) {
    let stars = 0;
    level.starThresholds.forEach((threshold) => {
      if (score >= threshold) stars++;
    });
    return stars;
  }

  global.LevelManager = {
    getLevel,
    isLevelCompleted,
    isLevelUnlocked,
    isWorldUnlocked,
    getWorldProgress,
    getHighestUnlockedLevel,
    starsForScore
  };
})(window);
