/**
 * Achievements — static definitions + evaluation against SaveManager
 * data. Kept as pure functions (no Phaser) so AchievementsScene and
 * GameScene's post-level check share one source of truth.
 */
(function (global) {
  'use strict';

  function levelsCompletedCount(save) {
    return Object.keys(save.completedLevels).length;
  }

  function perfectLevelsCount(save) {
    return Object.values(save.completedLevels).filter((l) => l.stars >= 3).length;
  }

  function unlockedWorldsCount(save) {
    let count = 0;
    global.FM_CONST.WORLDS.forEach((w) => {
      const unlocked = w.startLevelId <= 1 || !!save.completedLevels[w.startLevelId - 1];
      if (unlocked) count++;
    });
    return count;
  }

  const DEFS = [
    { id: 'first_steps', name: 'First Steps', description: 'Complete your first level', icon: 'bible', target: 1, getProgress: levelsCompletedCount },
    { id: 'dedicated', name: 'Dedicated', description: 'Complete 10 levels', icon: 'scroll', target: 10, getProgress: levelsCompletedCount },
    { id: 'halfway_there', name: 'Halfway There', description: 'Complete 150 levels', icon: 'cross', target: 150, getProgress: levelsCompletedCount },
    { id: 'faith_champion', name: 'Faith Champion', description: 'Complete all 300 levels', icon: 'dove', target: 300, getProgress: levelsCompletedCount },
    { id: 'rising_star', name: 'Rising Star', description: 'Earn 10 stars total', icon: 'grapes', target: 10, getProgress: (save) => save.stats.totalStarsEarned },
    { id: 'perfectionist', name: 'Perfectionist', description: 'Earn 3 stars on 10 levels', icon: 'lamp', target: 10, getProgress: perfectLevelsCount },
    { id: 'world_traveler', name: 'World Traveler', description: 'Unlock 3 worlds', icon: 'fish', target: 3, getProgress: unlockedWorldsCount },
    { id: 'coin_collector', name: 'Coin Collector', description: 'Accumulate 500 coins', icon: 'bread', target: 500, getProgress: (save) => save.coins },
    { id: 'growing_in_faith', name: 'Growing in Faith', description: 'Reach Faith Level 5', icon: 'cross', target: 5, getProgress: (save) => save.faithLevel },
    { id: 'steadfast', name: 'Steadfast', description: 'Reach Faith Level 10', icon: 'cross', target: 10, getProgress: (save) => save.faithLevel },
    { id: 'special_delivery', name: 'Special Delivery', description: 'Activate 10 special pieces', icon: 'scroll', target: 10, getProgress: (save) => save.stats.specialsActivated },
    { id: 'combo_master', name: 'Combo Master', description: 'Trigger 5 special combinations', icon: 'dove', target: 5, getProgress: (save) => save.stats.combosTriggered },
    { id: 'streak_keeper', name: 'Streak Keeper', description: 'Reach a 7-day login streak', icon: 'lamp', target: 7, getProgress: (save) => save.dailyLogin.streak }
  ];

  /**
   * Recomputes progress for every achievement against the current save,
   * persisting unlock state. Returns the newly-unlocked defs (for a toast)
   * plus the full list with live progress for AchievementsScene.
   */
  function evaluate(save) {
    const newlyUnlocked = [];
    const all = DEFS.map((def) => {
      const rawProgress = def.getProgress(save) || 0;
      const progress = Math.min(def.target, rawProgress);
      const wasUnlocked = !!(save.achievements[def.id] && save.achievements[def.id].unlocked);
      const isUnlocked = progress >= def.target;

      if (isUnlocked && !wasUnlocked) {
        save.achievements[def.id] = { unlocked: true, unlockedAt: Date.now(), progress };
        newlyUnlocked.push(def);
      } else {
        save.achievements[def.id] = { unlocked: isUnlocked, unlockedAt: (save.achievements[def.id] || {}).unlockedAt || null, progress };
      }

      return Object.assign({}, def, { progress, unlocked: isUnlocked });
    });

    return { all, newlyUnlocked };
  }

  global.FM_ACHIEVEMENTS = { DEFS, evaluate };
})(window);
