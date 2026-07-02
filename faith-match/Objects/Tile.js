/**
 * Tile — plain data model for a single board cell. Deliberately free of
 * any Phaser/rendering concerns so Board logic stays unit-testable;
 * GameScene (Phase 2) owns a parallel sprite per tile keyed by `id`.
 */
(function (global) {
  'use strict';

  let _nextId = 1;

  class Tile {
    /**
     * @param {string|null} type base piece type (e.g. 'bible') or null for empty
     * @param {number} row
     * @param {number} col
     */
    constructor(type, row, col) {
      this.id = _nextId++;
      this.type = type; // base piece type, null if empty cell
      this.row = row;
      this.col = col;
      this.specialType = null; // one of FM_CONST.SPECIAL_TYPES values, or null
      this.blocker = null; // { type: 'stone', hp: 2 } | { type: 'fog' } | null
    }

    get isEmpty() {
      return this.type === null;
    }

    get isSpecial() {
      return this.specialType !== null;
    }

    get isBlockedStone() {
      return !!this.blocker && this.blocker.type === 'stone';
    }

    get isMatchable() {
      return !this.isEmpty && !this.isBlockedStone;
    }

    clone() {
      const t = new Tile(this.type, this.row, this.col);
      t.id = this.id;
      t.specialType = this.specialType;
      t.blocker = this.blocker ? { ...this.blocker } : null;
      return t;
    }

    static resetIdCounter() {
      _nextId = 1;
    }
  }

  global.Tile = Tile;
})(window);
