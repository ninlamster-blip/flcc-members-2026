/**
 * Rewards — rolls a rarity tier and assembles today's reward bundle
 * (primary devotional content + Grace Coins + Faith XP + occasional
 * Bible Character Card / badge). Rarity is never shown as a probability
 * to the member — it only steers presentation (glow/particles/sound).
 */
(function (global) {
  'use strict';

  const RARITY_TABLE = [
    { id: 'common', weight: 50, coinMult: 1, xpMult: 1, cardChance: 0.06 },
    { id: 'rare', weight: 27, coinMult: 1.4, xpMult: 1.3, cardChance: 0.16 },
    { id: 'epic', weight: 15, coinMult: 1.9, xpMult: 1.6, cardChance: 0.32 },
    { id: 'legendary', weight: 6, coinMult: 2.6, xpMult: 2.1, cardChance: 0.55 },
    { id: 'miracle', weight: 2, coinMult: 4, xpMult: 3, cardChance: 1 }
  ];

  const STANDARD_CATEGORIES = [
    { key: 'scripture', weight: 20 },
    { key: 'prayer', weight: 16 },
    { key: 'encouragement', weight: 16 },
    { key: 'devotional', weight: 12 },
    { key: 'reflection', weight: 10 },
    { key: 'challenge', weight: 10 },
    { key: 'memoryVerse', weight: 8 },
    { key: 'historicalFact', weight: 5 },
    { key: 'worshipSong', weight: 5 }
  ];

  const FRIDAY_CATEGORIES = [
    { key: 'pastorMessage', weight: 26 },
    { key: 'announcement', weight: 20 },
    { key: 'worshipSong', weight: 18 },
    { key: 'prayer', weight: 18 },
    { key: 'memoryVerse', weight: 18 }
  ];

  function weightedPick(list) {
    const total = list.reduce((s, x) => s + x.weight, 0);
    let roll = Math.random() * total;
    for (const item of list) {
      if (roll < item.weight) return item;
      roll -= item.weight;
    }
    return list[list.length - 1];
  }

  function rollRarity() { return weightedPick(RARITY_TABLE); }

  function buildPrimary(categoryKey) {
    const C = global.DB_CONTENT;
    switch (categoryKey) {
      case 'scripture': return { type: 'scripture', label: "Today's Scripture", data: C.pick('scriptures').item };
      case 'memoryVerse': return { type: 'scripture', label: 'Memory Verse', data: C.pickScripture(true).item };
      case 'prayer': return { type: 'prayer', label: "Today's Prayer", data: C.pick('prayers').item };
      case 'encouragement': return { type: 'encouragement', label: "Today's Encouragement", data: C.pick('encouragements').item };
      case 'devotional': return { type: 'devotional', label: 'Mini Devotional', data: C.pick('devotionals').item };
      case 'reflection': return { type: 'reflection', label: 'Reflection Question', data: C.pick('reflections').item };
      case 'challenge': return { type: 'challenge', label: 'Today’s Challenge', data: C.pick('challenges').item };
      case 'historicalFact': return { type: 'historicalFact', label: 'Historical Fact', data: C.pick('historicalFacts').item };
      case 'worshipSong': return { type: 'worshipSong', label: "Today's Worship", data: C.pick('worshipSongs').item };
      case 'pastorMessage': return { type: 'pastorMessage', label: "Pastor's Welcome", data: C.pick('pastorMessages').item };
      case 'announcement': return { type: 'announcement', label: 'Church Announcement', data: C.pick('announcements').item };
      default: return { type: 'encouragement', label: "Today's Encouragement", data: C.pick('encouragements').item };
    }
  }

  function generateDailyReward(context) {
    const isFriday = !!(context && context.isFriday);
    const rarity = rollRarity();
    const categoryPool = isFriday ? FRIDAY_CATEGORIES : STANDARD_CATEGORIES;
    const category = weightedPick(categoryPool);
    const primary = buildPrimary(category.key);

    const baseCoins = 20 + Math.floor(Math.random() * 16); // 20-35
    const baseXp = 10 + Math.floor(Math.random() * 11);    // 10-20
    const coins = Math.round(baseCoins * rarity.coinMult);
    const xp = Math.round(baseXp * rarity.xpMult);

    let characterCard = null;
    if (Math.random() < rarity.cardChance) {
      characterCard = global.DB_CONTENT.pickCharacter();
    }

    return {
      rarity: rarity.id,
      isFriday,
      primary,
      coins,
      xp,
      characterCard
    };
  }

  global.DB_REWARDS = { generateDailyReward, RARITY_TABLE };
})(window);
