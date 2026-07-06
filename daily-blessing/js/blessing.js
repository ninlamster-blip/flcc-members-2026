// Resolves "today's blessing": a deterministic-per-day pick of content type,
// rarity, and rewards. Cached in state so refreshing or reopening the app on
// the same day always yields the same result (and works offline).
import { loadPools, drawFromPool } from './contentPool.js';
import { getState, updateState } from './state.js';
import { todayKey, isFriday, seasonFor, weightedPick, seededRandom } from './utils.js';

const RARITIES = [
  { value: 'common', weight: 50 },
  { value: 'rare', weight: 28 },
  { value: 'epic', weight: 14 },
  { value: 'legendary', weight: 6 },
  { value: 'miracle', weight: 2 },
];

const REWARD_RANGES = {
  common: { coins: [20, 40], xp: [10, 15] },
  rare: { coins: [40, 70], xp: [15, 25] },
  epic: { coins: [70, 120], xp: [25, 40] },
  legendary: { coins: [120, 200], xp: [40, 70] },
  miracle: { coins: [200, 350], xp: [70, 120] },
};

const CARD_CHANCE = {
  common: 0.05,
  rare: 0.15,
  epic: 0.4,
  legendary: 0.8,
  miracle: 1,
};

const CATEGORY_WEIGHTS = [
  { value: 'scripture', weight: 20 },
  { value: 'prayer', weight: 14 },
  { value: 'encouragement', weight: 14 },
  { value: 'reflection', weight: 10 },
  { value: 'devotional', weight: 10 },
  { value: 'memoryVerse', weight: 8 },
  { value: 'historicalFact', weight: 8 },
  { value: 'challenge', weight: 8 },
  { value: 'kindness', weight: 4 },
  { value: 'mission', weight: 4 },
];

const POOL_FILES = {
  scripture: 'scriptures',
  prayer: 'prayers',
  encouragement: 'encouragements',
  reflection: 'reflections',
  devotional: 'devotionals',
  memoryVerse: 'memoryVerses',
  historicalFact: 'historicalFacts',
  challenge: 'challenges',
  friday: 'fridaySpecials',
};

function rollInRange(rng, [min, max]) {
  return Math.round(min + rng() * (max - min));
}

async function pickCategoryContent(category, rng) {
  if (category === 'kindness' || category === 'mission') {
    const all = await loadPools(['kindnessMissions']);
    const items = all.kindnessMissions.filter((it) => it.type === category);
    return drawFromPool('kindnessMissions', items);
  }
  if (category === 'friday') {
    const pools = await loadPools(['fridaySpecials', 'pastorMessages', 'announcements']);
    const combined = [...pools.fridaySpecials, ...pools.pastorMessages, ...pools.announcements];
    return drawFromPool('friday', combined);
  }
  const file = POOL_FILES[category];
  const pools = await loadPools([file]);
  return drawFromPool(file, pools[file]);
}

export async function resolveTodaysBlessing() {
  const state = getState();
  const key = todayKey();
  if (state.todayResolved && state.todayResolved.date === key) {
    return state.todayResolved;
  }

  const now = new Date();
  const friday = isFriday(now);
  const season = seasonFor(now);
  const rng = seededRandom(`flcc-db-${key}`);

  const rarity = weightedPick(rng, RARITIES);
  const range = REWARD_RANGES[rarity];
  const coins = rollInRange(rng, range.coins);
  const xp = rollInRange(rng, range.xp);

  let categories = CATEGORY_WEIGHTS;
  if (friday) {
    categories = [{ value: 'friday', weight: 30 }, ...CATEGORY_WEIGHTS];
  }
  const category = weightedPick(rng, categories);
  const content = await pickCategoryContent(category, rng);

  let characterCard = null;
  if (rng() < CARD_CHANCE[rarity]) {
    const pools = await loadPools(['characters']);
    const owned = new Set(state.collection.ownedCharacterIds);
    const remaining = pools.characters.filter((c) => !owned.has(c.id));
    if (remaining.length > 0) {
      characterCard = drawFromPool('characters', remaining);
    }
  }

  const resolved = {
    date: key,
    opened: false,
    friday,
    season,
    rarity,
    category,
    content,
    coins,
    xp,
    characterCard,
  };

  updateState((s) => {
    s.todayResolved = resolved;
  });

  return resolved;
}

export function markOpened() {
  return updateState((s) => {
    if (s.todayResolved) s.todayResolved.opened = true;
  });
}
