/**
 * App — the engine tying SaveManager, Content, Rewards, Season together.
 * Pages call into this rather than touching SaveManager directly, so the
 * "only apply rewards once per day" and streak/collection rules live in
 * one place.
 */
(function (global) {
  'use strict';

  const TOTAL_CHURCH_MEMBERS = 52;
  const XP_PER_LEVEL = 100;

  function hashSeed(str) {
    let h = 2166136261;
    for (let i = 0; i < str.length; i++) { h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); }
    return h >>> 0;
  }

  function mulberry32(seed) {
    return function () {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  class App {
    get save() { return global.DB_SAVE; }
    get content() { return global.DB_CONTENT; }

    async init() {
      await this.content.load();
      this.context = global.DB_SEASON.get();
      this._ensureTodayReward();
    }

    todayKey() { return global.DateUtils.dateKey(); }

    _ensureTodayReward() {
      const key = this.todayKey();
      const today = this.save.data.today;
      if (today.date !== key) {
        this.save.data.today = {
          date: key,
          reward: global.DB_REWARDS.generateDailyReward({ isFriday: this.context.isFriday }),
          opened: false
        };
        this.save.save();
      }
    }

    todayState() { return this.save.data.today; }

    hasOpenedToday() { return this.save.data.today.opened; }

    /** Applies today's reward to the profile/streak/collection. Idempotent-guarded by `opened` flag. */
    claimToday() {
      if (this.hasOpenedToday()) return this.streakInfo();
      const save = this.save;
      const key = this.todayKey();
      const reward = save.data.today.reward;

      const streak = save.data.streak;
      if (!streak.lastOpenDate) streak.current = 1;
      else {
        const gap = global.DateUtils.daysBetween(streak.lastOpenDate, key);
        streak.current = gap === 1 ? streak.current + 1 : 1;
      }
      streak.longest = Math.max(streak.longest, streak.current);
      streak.lastOpenDate = key;

      const profile = save.data.profile;
      profile.coins += reward.coins;
      profile.xp += reward.xp;
      profile.level = Math.floor(profile.xp / XP_PER_LEVEL) + 1;
      if (reward.primary.type === 'scripture' || reward.primary.type === 'devotional') profile.bibleReadingDays += 1;
      if (reward.primary.type === 'prayer') profile.prayerDays += 1;

      profile.rareBlessingCounts = profile.rareBlessingCounts || { epic: 0, legendary: 0, miracle: 0 };
      if (profile.rareBlessingCounts[reward.rarity] !== undefined) profile.rareBlessingCounts[reward.rarity] += 1;

      if (!save.data.history.openDates.includes(key)) save.data.history.openDates.push(key);
      save.addTimelineEntry(`Earned ${reward.coins} Grace Coins, +${reward.xp} Faith XP`);
      save.addTimelineEntry(`Opened Daily Blessing — ${reward.primary.label}`);

      if (reward.characterCard) {
        const id = reward.characterCard.id;
        save.data.collection.owned[id] = (save.data.collection.owned[id] || 0) + 1;
        save.addTimelineEntry(`Collected the ${reward.characterCard.name} card`);
      }

      save.data.today.opened = true;
      save.save();

      return this.streakInfo();
    }

    streakInfo() { return this.save.data.streak; }

    /** Deterministic-per-day pseudo-random "church family" progress, since there is no backend yet. */
    communityProgress() {
      const key = this.todayKey();
      const rng = mulberry32(hashSeed(key));
      const roll = rng();
      let base = roll < 0.12 ? TOTAL_CHURCH_MEMBERS - 1 : 22 + Math.floor(rng() * 20);
      if (this.hasOpenedToday()) base = Math.min(TOTAL_CHURCH_MEMBERS, base + 1);
      return { opened: base, total: TOTAL_CHURCH_MEMBERS, complete: base >= TOTAL_CHURCH_MEMBERS };
    }

    heatmapDays(count) {
      const opened = new Set(this.save.data.history.openDates);
      const days = [];
      const today = new Date();
      for (let i = count - 1; i >= 0; i--) {
        const d = new Date(today);
        d.setDate(today.getDate() - i);
        const key = global.DateUtils.dateKey(d);
        days.push({ key, opened: opened.has(key) });
      }
      return days;
    }
  }

  global.DB_APP = new App();
})(window);
