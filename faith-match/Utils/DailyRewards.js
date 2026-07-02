/**
 * DailyRewards — 7-day login-streak reward table and claim logic.
 * Pure logic over SaveManager's `dailyLogin` state; MenuScene decides
 * when to show the claim modal based on getStatus().alreadyClaimedToday.
 */
(function (global) {
  'use strict';

  const REWARD_TABLE = [
    { day: 1, coins: 20, powerup: null },
    { day: 2, coins: 25, powerup: null },
    { day: 3, coins: 30, powerup: { type: 'hint', qty: 1 } },
    { day: 4, coins: 35, powerup: null },
    { day: 5, coins: 40, powerup: { type: 'shuffle', qty: 1 } },
    { day: 6, coins: 50, powerup: { type: 'extra_moves', qty: 1 } },
    { day: 7, coins: 100, powerup: { type: 'prayer', qty: 2 } }
  ];

  /**
   * Computes today's claim status without mutating anything: whether
   * today's reward was already claimed, what the streak would become
   * upon claiming (resets to 1 if a day was missed), and which of the
   * 7 reward slots that maps to.
   */
  function getStatus(save) {
    const today = global.DateUtils.dateKey();
    const last = save.dailyLogin.lastClaimDate;
    const alreadyClaimedToday = last === today;

    let projectedStreak = save.dailyLogin.streak;
    if (!alreadyClaimedToday) {
      if (last) {
        const gap = global.DateUtils.daysBetween(last, today);
        projectedStreak = gap === 1 ? save.dailyLogin.streak + 1 : 1;
      } else {
        projectedStreak = 1;
      }
    }

    const cycleDay = ((projectedStreak - 1) % 7) + 1;
    return { alreadyClaimedToday, projectedStreak, cycleDay, reward: REWARD_TABLE[cycleDay - 1] };
  }

  /** Claims today's reward (no-op if already claimed). Returns the claimed reward info, or null. */
  function claim() {
    const save = global.FM_SAVE.data;
    const status = getStatus(save);
    if (status.alreadyClaimedToday) return null;

    save.dailyLogin.streak = status.projectedStreak;
    save.dailyLogin.lastClaimDate = global.DateUtils.dateKey();
    save.dailyLogin.totalClaims += 1;

    const reward = status.reward;
    save.coins += reward.coins;
    if (reward.powerup) {
      save.powerups[reward.powerup.type] = (save.powerups[reward.powerup.type] || 0) + reward.powerup.qty;
    }
    global.FM_SAVE.save();

    return { cycleDay: status.cycleDay, reward, streak: save.dailyLogin.streak };
  }

  global.DailyRewards = { REWARD_TABLE, getStatus, claim };
})(window);
