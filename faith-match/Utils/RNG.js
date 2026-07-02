/**
 * Deterministic seeded RNG (mulberry32). Used for level board generation
 * so a given level seed always produces a fair, solvable starting board,
 * and for anything else that benefits from reproducibility (daily challenge).
 */
(function (global) {
  'use strict';

  class RNG {
    constructor(seed) {
      this.setSeed(seed);
    }

    setSeed(seed) {
      // Accept numeric or string seeds.
      if (typeof seed === 'string') {
        let h = 1779033703 ^ seed.length;
        for (let i = 0; i < seed.length; i++) {
          h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
          h = (h << 13) | (h >>> 19);
        }
        seed = h >>> 0;
      }
      this._state = (seed >>> 0) || 1;
      return this;
    }

    // Returns float in [0, 1)
    next() {
      let t = (this._state += 0x6d2b79f5);
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }

    // Integer in [min, max] inclusive
    intBetween(min, max) {
      return Math.floor(this.next() * (max - min + 1)) + min;
    }

    pick(array) {
      return array[this.intBetween(0, array.length - 1)];
    }

    shuffle(array) {
      const arr = array.slice();
      for (let i = arr.length - 1; i > 0; i--) {
        const j = this.intBetween(0, i);
        [arr[i], arr[j]] = [arr[j], arr[i]];
      }
      return arr;
    }
  }

  global.RNG = RNG;
})(window);
