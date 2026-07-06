// Loads JSON content pools and hands out items via a "shuffle bag" so no item
// repeats until the whole pool has been cycled through.
import { getState, updateState } from './state.js';
import { shuffle } from './utils.js';

const cache = new Map();

async function loadJson(name) {
  if (cache.has(name)) return cache.get(name);
  const res = await fetch(new URL(`../data/${name}.json`, import.meta.url));
  const json = await res.json();
  cache.set(name, json);
  return json;
}

export async function loadPools(names) {
  const entries = await Promise.all(names.map(async (n) => [n, await loadJson(n)]));
  return Object.fromEntries(entries);
}

// Draws one item from `poolName` (array of {id,...}) without repeating until
// every item has been drawn once, then reshuffles for the next cycle.
export function drawFromPool(poolName, items) {
  const state = getState();
  let bagState = state.pools[poolName];
  if (!bagState || !bagState.bag || bagState.bag.length === 0) {
    const ids = items.map((it) => it.id);
    bagState = { bag: shuffle(ids) };
  }
  const nextId = bagState.bag.pop();
  updateState((s) => {
    s.pools[poolName] = bagState;
  });
  return items.find((it) => it.id === nextId) || items[0];
}
