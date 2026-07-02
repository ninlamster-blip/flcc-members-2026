/**
 * Board — pure game-state model for an 8x8 (configurable) Match-3 grid.
 *
 * Responsibilities:
 *  - generate a starting layout with no pre-existing matches
 *  - validate & perform swaps
 *  - detect matches (3, 4, 5, L-shape, T-shape) via run detection + union-find
 *  - classify matches into special pieces (Living Water, Sword of the
 *    Spirit, Pentecost Flame, Prayer Bomb, Armor of God)
 *  - resolve matches into cleared cells (including special-piece area
 *    effects and blocker damage)
 *  - apply gravity and refill
 *  - detect "no possible move" deadlocks and reshuffle
 *
 * No Phaser dependency: GameScene (Phase 2) reads the result objects
 * returned by these methods to drive animation.
 */
(function (global) {
  'use strict';

  const { PIECE_TYPES, SPECIAL_TYPES } = global.FM_CONST;

  function key(r, c) {
    return r + ',' + c;
  }

  class Board {
    /**
     * @param {object} opts
     * @param {number} opts.rows
     * @param {number} opts.cols
     * @param {string[]} [opts.pieceTypes] subset of piece types to use for this level
     * @param {RNG} [opts.rng]
     */
    constructor(opts = {}) {
      this.rows = opts.rows || 8;
      this.cols = opts.cols || 8;
      this.pieceTypes = opts.pieceTypes && opts.pieceTypes.length ? opts.pieceTypes : PIECE_TYPES.slice();
      this.rng = opts.rng || new global.RNG(Date.now());
      /** @type {Tile[][]} grid[row][col] */
      this.grid = [];
      this._buildEmptyGrid();
    }

    _buildEmptyGrid() {
      this.grid = [];
      for (let r = 0; r < this.rows; r++) {
        const row = [];
        for (let c = 0; c < this.cols; c++) {
          row.push(null);
        }
        this.grid.push(row);
      }
    }

    inBounds(r, c) {
      return r >= 0 && r < this.rows && c >= 0 && c < this.cols;
    }

    getTile(r, c) {
      if (!this.inBounds(r, c)) return null;
      return this.grid[r][c];
    }

    setTile(r, c, tile) {
      this.grid[r][c] = tile;
      if (tile) {
        tile.row = r;
        tile.col = c;
      }
    }

    /**
     * Fill the board with random pieces such that no matches exist yet
     * and at least one legal move is available. Optionally seed blocker
     * cells (stone/fog) supplied by level data before generation, leaving
     * those cells empty of a swappable piece where relevant.
     * @param {Array<{row:number,col:number,blocker:object}>} [blockerCells]
     */
    generate(blockerCells = []) {
      this._buildEmptyGrid();
      const blockerMap = new Map();
      blockerCells.forEach((b) => blockerMap.set(key(b.row, b.col), b.blocker));

      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const forcedBlocker = blockerMap.get(key(r, c));
          if (forcedBlocker && forcedBlocker.type === 'stone') {
            const tile = new global.Tile(null, r, c);
            tile.blocker = { ...forcedBlocker };
            this.setTile(r, c, tile);
            continue;
          }

          let type = this._randomPieceType();
          // Avoid accidentally creating a horizontal/vertical match while filling.
          let guard = 0;
          while (this._wouldCreateInitialMatch(r, c, type) && guard < 20) {
            type = this._randomPieceType();
            guard++;
          }
          const tile = new global.Tile(type, r, c);
          if (forcedBlocker) tile.blocker = { ...forcedBlocker };
          this.setTile(r, c, tile);
        }
      }

      if (!this.hasPossibleMove()) {
        this.shuffleBoard();
      }
      return this;
    }

    _randomPieceType() {
      return this.rng.pick(this.pieceTypes);
    }

    _wouldCreateInitialMatch(r, c, type) {
      // Check two-to-the-left and two-above for accidental runs of 3.
      const left1 = this.getTile(r, c - 1);
      const left2 = this.getTile(r, c - 2);
      if (left1 && left2 && left1.type === type && left2.type === type) return true;
      const up1 = this.getTile(r - 1, c);
      const up2 = this.getTile(r - 2, c);
      if (up1 && up2 && up1.type === type && up2.type === type) return true;
      return false;
    }

    // ---------------------------------------------------------------
    // Swapping
    // ---------------------------------------------------------------

    isAdjacent(r1, c1, r2, c2) {
      const dr = Math.abs(r1 - r2);
      const dc = Math.abs(c1 - c2);
      return dr + dc === 1;
    }

    /**
     * A swap is legal if the two cells are adjacent, both are present
     * and not stone-blocked, and either the swap creates a match or
     * at least one of the two tiles is a special piece (specials always
     * trigger their effect on swap even without forming a new match).
     */
    canSwap(r1, c1, r2, c2) {
      if (!this.isAdjacent(r1, c1, r2, c2)) return false;
      const a = this.getTile(r1, c1);
      const b = this.getTile(r2, c2);
      if (!a || !b || !a.isMatchable || !b.isMatchable) return false;

      if (a.isSpecial || b.isSpecial) return true;

      this._swapCells(r1, c1, r2, c2);
      const matches = this.findMatches();
      this._swapCells(r1, c1, r2, c2); // revert
      return matches.length > 0;
    }

    _swapCells(r1, c1, r2, c2) {
      const a = this.getTile(r1, c1);
      const b = this.getTile(r2, c2);
      this.setTile(r1, c1, b);
      this.setTile(r2, c2, a);
    }

    /**
     * Performs the swap unconditionally (caller should have checked
     * canSwap first, or is deliberately forcing a special-combo swap).
     */
    swap(r1, c1, r2, c2) {
      this._swapCells(r1, c1, r2, c2);
      return { a: this.getTile(r1, c1), b: this.getTile(r2, c2) };
    }

    // ---------------------------------------------------------------
    // Match detection
    // ---------------------------------------------------------------

    /**
     * Scans the current grid for all matches (runs of 3+) and merges
     * intersecting horizontal/vertical runs into single groups so
     * L-shapes and T-shapes are reported as one group.
     * @returns {Array<MatchGroup>}
     */
    findMatches() {
      const runs = [];

      // Horizontal runs
      for (let r = 0; r < this.rows; r++) {
        let runStart = 0;
        for (let c = 1; c <= this.cols; c++) {
          const prev = this.getTile(r, c - 1);
          const cur = c < this.cols ? this.getTile(r, c) : null;
          const sameType = cur && prev && cur.type === prev.type && prev.isMatchable && cur.isMatchable;
          if (!sameType) {
            const runLen = c - runStart;
            if (runLen >= 3 && prev && prev.isMatchable) {
              const cells = [];
              for (let cc = runStart; cc < c; cc++) cells.push({ row: r, col: cc });
              runs.push({ cells, dir: 'h', type: prev.type });
            }
            runStart = c;
          }
        }
      }

      // Vertical runs
      for (let c = 0; c < this.cols; c++) {
        let runStart = 0;
        for (let r = 1; r <= this.rows; r++) {
          const prev = this.getTile(r - 1, c);
          const cur = r < this.rows ? this.getTile(r, c) : null;
          const sameType = cur && prev && cur.type === prev.type && prev.isMatchable && cur.isMatchable;
          if (!sameType) {
            const runLen = r - runStart;
            if (runLen >= 3 && prev && prev.isMatchable) {
              const cells = [];
              for (let rr = runStart; rr < r; rr++) cells.push({ row: rr, col: c });
              runs.push({ cells, dir: 'v', type: prev.type });
            }
            runStart = r;
          }
        }
      }

      if (runs.length === 0) return [];

      // Union-Find over cell keys to merge intersecting runs into one group.
      const parent = new Map();
      const find = (k) => {
        while (parent.get(k) !== k) {
          parent.set(k, parent.get(parent.get(k)));
          k = parent.get(k);
        }
        return k;
      };
      const union = (a, b) => {
        const ra = find(a);
        const rb = find(b);
        if (ra !== rb) parent.set(ra, rb);
      };

      runs.forEach((run) => {
        run.cells.forEach((cell) => {
          const k = key(cell.row, cell.col);
          if (!parent.has(k)) parent.set(k, k);
        });
        for (let i = 1; i < run.cells.length; i++) {
          union(key(run.cells[0].row, run.cells[0].col), key(run.cells[i].row, run.cells[i].col));
        }
      });

      const groupsByRoot = new Map();
      runs.forEach((run) => {
        run.cells.forEach((cell) => {
          const root = find(key(cell.row, cell.col));
          if (!groupsByRoot.has(root)) {
            groupsByRoot.set(root, { cellSet: new Map(), dirs: new Set(), type: run.type, runs: [] });
          }
          const g = groupsByRoot.get(root);
          g.cellSet.set(key(cell.row, cell.col), cell);
          g.dirs.add(run.dir);
        });
        groupsByRoot.get(find(key(run.cells[0].row, run.cells[0].col))).runs.push(run);
      });

      const groups = [];
      groupsByRoot.forEach((g) => {
        const cells = Array.from(g.cellSet.values());
        groups.push(this._classifyGroup(cells, g.runs, g.type));
      });

      return groups;
    }

    /**
     * Determines the shape/size classification of a merged match group
     * and which special piece (if any) it should spawn.
     */
    _classifyGroup(cells, runs, type) {
      const size = cells.length;
      const isMultiDir = runs.length > 1 && new Set(runs.map((r) => r.dir)).size === 2;
      const longestRun = runs.reduce((max, r) => Math.max(max, r.cells.length), 0);

      let shape = 'line3';
      let specialType = null;

      if (isMultiDir) {
        // Intersecting horizontal + vertical runs => L or T shape.
        shape = size >= 7 ? 'plus' : 'L_T';
        specialType = size >= 7 ? SPECIAL_TYPES.ARMOR_OF_GOD : SPECIAL_TYPES.PRAYER_BOMB;
      } else if (longestRun >= 5) {
        shape = 'line5';
        specialType = SPECIAL_TYPES.PENTECOST_FLAME;
      } else if (longestRun === 4) {
        shape = 'line4';
        const dir = runs[0].dir;
        specialType = dir === 'h' ? SPECIAL_TYPES.LIVING_WATER : SPECIAL_TYPES.SWORD_OF_SPIRIT;
      } else {
        shape = 'line3';
        specialType = null;
      }

      return {
        cells,
        type,
        shape,
        size,
        specialType,
        // Where a newly-created special piece should be placed: the cell
        // closest to the swap origin is decided by the caller (GameScene);
        // default to the middle cell of the group.
        anchor: cells[Math.floor(cells.length / 2)]
      };
    }

    // ---------------------------------------------------------------
    // Resolution: clearing matches, specials, blockers
    // ---------------------------------------------------------------

    /**
     * Given match groups from findMatches(), computes the full set of
     * cells to clear (expanding any pre-existing special pieces caught
     * in the blast, and damaging adjacent stone blockers / clearing fog),
     * removes the tiles, and spawns any new special piece at each group's
     * anchor cell. Does NOT apply gravity/refill — call those next.
     *
     * @param {Array<MatchGroup>} groups
     * @param {{row:number,col:number}} [swapAnchor] preferred cell for the
     *   newly created special (usually where the player's swapped tile landed)
     * @returns {{clearedCells: Array, specialsCreated: Array, blockersDamaged: Array, scoreGained: number}}
     */
    resolveMatches(groups, swapAnchor = null) {
      const clearedKeys = new Map(); // key -> {row,col,type,specialType}
      const specialsCreated = [];
      let scoreGained = 0;

      groups.forEach((group) => {
        group.cells.forEach((cell) => {
          const tile = this.getTile(cell.row, cell.col);
          if (!tile) return;
          clearedKeys.set(key(cell.row, cell.col), { row: cell.row, col: cell.col, type: tile.type });
          // If an existing special piece is part of this match, trigger its
          // area effect too (chain reaction), merging extra cleared cells in.
          if (tile.isSpecial) {
            const extra = this.specialEffectCells(cell.row, cell.col, tile.specialType);
            extra.forEach((ec) => {
              const t = this.getTile(ec.row, ec.col);
              if (t) clearedKeys.set(key(ec.row, ec.col), { row: ec.row, col: ec.col, type: t.type });
            });
          }
        });

        scoreGained += this._scoreForGroup(group);

        if (group.specialType) {
          const anchor =
            swapAnchor && group.cells.some((c) => c.row === swapAnchor.row && c.col === swapAnchor.col)
              ? swapAnchor
              : group.anchor;
          specialsCreated.push({ row: anchor.row, col: anchor.col, specialType: group.specialType, baseType: group.type });
        }
      });

      // Damage stone blockers adjacent to any cleared cell.
      const blockersDamaged = this._damageAdjacentBlockers(Array.from(clearedKeys.values()));

      // Clear fog on any cleared cell itself.
      clearedKeys.forEach((info) => {
        const tile = this.getTile(info.row, info.col);
        if (tile && tile.blocker && tile.blocker.type === 'fog') {
          blockersDamaged.push({ row: info.row, col: info.col, blocker: 'fog', cleared: true });
          tile.blocker = null;
        }
      });

      // Remove tiles from the grid (set empty), except where a special
      // piece will be spawned — that cell keeps a tile object but gets
      // re-typed as the special.
      const specialAnchors = new Map(specialsCreated.map((s) => [key(s.row, s.col), s]));

      clearedKeys.forEach((info, k) => {
        const spawn = specialAnchors.get(k);
        const tile = this.getTile(info.row, info.col);
        if (!tile) return;
        if (spawn) {
          tile.type = spawn.baseType;
          tile.specialType = spawn.specialType;
        } else {
          this.setTile(info.row, info.col, tile.isBlockedStone ? tile : null);
        }
      });

      return {
        clearedCells: Array.from(clearedKeys.values()),
        specialsCreated,
        blockersDamaged,
        scoreGained
      };
    }

    _scoreForGroup(group) {
      const base = { line3: 60, line4: 120, line5: 300, L_T: 200, plus: 500 };
      return base[group.shape] || 60;
    }

    _damageAdjacentBlockers(clearedCellsInfo) {
      const damaged = [];
      const seen = new Set();
      clearedCellsInfo.forEach(({ row, col }) => {
        [[row - 1, col], [row + 1, col], [row, col - 1], [row, col + 1]].forEach(([r, c]) => {
          const k = key(r, c);
          if (seen.has(k)) return;
          const tile = this.getTile(r, c);
          if (tile && tile.blocker && tile.blocker.type === 'stone') {
            tile.blocker.hp -= 1;
            seen.add(k);
            if (tile.blocker.hp <= 0) {
              tile.blocker = null;
              tile.type = this._randomPieceType();
              damaged.push({ row: r, col: c, blocker: 'stone', destroyed: true });
            } else {
              damaged.push({ row: r, col: c, blocker: 'stone', destroyed: false, hp: tile.blocker.hp });
            }
          }
        });
      });
      return damaged;
    }

    /**
     * Computes which cells a special piece would clear if activated at
     * (row, col). Does not mutate the board.
     */
    specialEffectCells(row, col, specialType) {
      const cells = [];
      switch (specialType) {
        case SPECIAL_TYPES.LIVING_WATER:
          for (let c = 0; c < this.cols; c++) cells.push({ row, col: c });
          break;
        case SPECIAL_TYPES.SWORD_OF_SPIRIT:
          for (let r = 0; r < this.rows; r++) cells.push({ row: r, col });
          break;
        case SPECIAL_TYPES.PRAYER_BOMB:
          for (let r = row - 1; r <= row + 1; r++) {
            for (let c = col - 1; c <= col + 1; c++) {
              if (this.inBounds(r, c)) cells.push({ row: r, col: c });
            }
          }
          break;
        case SPECIAL_TYPES.ARMOR_OF_GOD:
          // Explodes surrounding area twice = a larger 5x5 radius blast.
          for (let r = row - 2; r <= row + 2; r++) {
            for (let c = col - 2; c <= col + 2; c++) {
              if (this.inBounds(r, c)) cells.push({ row: r, col: c });
            }
          }
          break;
        case SPECIAL_TYPES.PENTECOST_FLAME: {
          const anchorTile = this.getTile(row, col);
          const targetType = anchorTile ? anchorTile.type : null;
          for (let r = 0; r < this.rows; r++) {
            for (let c = 0; c < this.cols; c++) {
              const t = this.getTile(r, c);
              if (t && t.isMatchable && t.type === targetType) cells.push({ row: r, col: c });
            }
          }
          break;
        }
        default:
          cells.push({ row, col });
      }
      return cells;
    }

    /**
     * Combination table for swapping two special pieces together.
     * Returns the resulting effect cells (and, for some combos, a new
     * specialType to leave behind) rather than mutating state.
     */
    combineSpecials(typeA, typeB, row, col) {
      const S = SPECIAL_TYPES;
      const pair = [typeA, typeB].sort().join('+');
      const all = () => {
        const cells = [];
        for (let r = 0; r < this.rows; r++) for (let c = 0; c < this.cols; c++) cells.push({ row: r, col: c });
        return cells;
      };
      const rowCells = () => {
        const cells = [];
        for (let c = 0; c < this.cols; c++) cells.push({ row, col: c });
        return cells;
      };
      const colCells = () => {
        const cells = [];
        for (let r = 0; r < this.rows; r++) cells.push({ row: r, col });
        return cells;
      };
      const thickCross = () => {
        const cells = new Map();
        for (let dr = -1; dr <= 1; dr++) for (let c = 0; c < this.cols; c++) cells.set(key(row + dr, c), { row: row + dr, col: c });
        for (let dc = -1; dc <= 1; dc++) for (let r = 0; r < this.rows; r++) cells.set(key(r, col + dc), { row: r, col: col + dc });
        return Array.from(cells.values()).filter((cc) => this.inBounds(cc.row, cc.col));
      };

      switch (pair) {
        case [S.LIVING_WATER, S.LIVING_WATER].sort().join('+'):
          return { cells: [...rowCells(), ...rowCells()], resultSpecial: null };
        case [S.SWORD_OF_SPIRIT, S.SWORD_OF_SPIRIT].sort().join('+'):
          return { cells: colCells(), resultSpecial: null };
        case [S.LIVING_WATER, S.SWORD_OF_SPIRIT].sort().join('+'):
          return { cells: thickCross(), resultSpecial: null };
        case [S.PRAYER_BOMB, S.PRAYER_BOMB].sort().join('+'):
          return { cells: this.specialEffectCells(row, col, S.ARMOR_OF_GOD), resultSpecial: null };
        case [S.PRAYER_BOMB, S.LIVING_WATER].sort().join('+'):
        case [S.PRAYER_BOMB, S.SWORD_OF_SPIRIT].sort().join('+'):
          return { cells: thickCross(), resultSpecial: null };
        case [S.PENTECOST_FLAME, S.PENTECOST_FLAME].sort().join('+'):
          return { cells: all(), resultSpecial: null };
        case [S.PENTECOST_FLAME, S.LIVING_WATER].sort().join('+'):
        case [S.PENTECOST_FLAME, S.SWORD_OF_SPIRIT].sort().join('+'):
        case [S.PENTECOST_FLAME, S.PRAYER_BOMB].sort().join('+'):
          return { cells: all(), resultSpecial: null };
        case [S.ARMOR_OF_GOD, S.ARMOR_OF_GOD].sort().join('+'):
        case [S.PENTECOST_FLAME, S.ARMOR_OF_GOD].sort().join('+'):
          return { cells: all(), resultSpecial: null };
        default:
          return { cells: this.specialEffectCells(row, col, typeA), resultSpecial: null };
      }
    }

    // ---------------------------------------------------------------
    // Gravity & refill
    // ---------------------------------------------------------------

    /**
     * Drops tiles down to fill empty cells within each column (stone
     * blockers are immovable and act as a floor/obstacle). Returns a
     * list of moves for animation: { from:{row,col}, to:{row,col}, tileId }.
     */
    applyGravity() {
      const moves = [];
      for (let c = 0; c < this.cols; c++) {
        let writeRow = this.rows - 1;
        for (let r = this.rows - 1; r >= 0; r--) {
          const tile = this.getTile(r, c);
          if (tile && tile.isBlockedStone) {
            writeRow = r - 1;
            continue;
          }
          if (tile) {
            if (writeRow !== r) {
              this.setTile(writeRow, c, tile);
              this.setTile(r, c, null);
              moves.push({ from: { row: r, col: c }, to: { row: writeRow, col: c }, tileId: tile.id });
            }
            writeRow--;
          }
        }
      }
      return moves;
    }

    /**
     * Fills any remaining empty (non-stone) cells with fresh random
     * tiles, "dropping in" from above the board. Returns spawn info
     * for animation: { row, col, type, tileId, fromRow } where fromRow
     * is a negative offset used to animate a fall-in.
     */
    refill() {
      const spawns = [];
      for (let c = 0; c < this.cols; c++) {
        // Empty cells after gravity are always a contiguous block at the
        // top of the column. Count them first so each spawned tile can be
        // placed a consistent number of rows above the board for the
        // fall-in animation (topmost empty cell falls the farthest).
        let emptyCount = 0;
        for (let r = 0; r < this.rows; r++) {
          if (this.getTile(r, c) === null) emptyCount++;
        }
        let filled = 0;
        for (let r = 0; r < this.rows; r++) {
          if (this.getTile(r, c) === null) {
            const type = this._randomPieceType();
            const newTile = new global.Tile(type, r, c);
            this.setTile(r, c, newTile);
            filled++;
            // fromRow is a negative row offset above the board, used by
            // GameScene to animate the tile dropping in from above.
            spawns.push({ row: r, col: c, type, tileId: newTile.id, fromRow: -(emptyCount - filled + 1) });
          }
        }
      }
      return spawns;
    }

    // ---------------------------------------------------------------
    // Deadlock detection & shuffle
    // ---------------------------------------------------------------

    hasPossibleMove() {
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const tile = this.getTile(r, c);
          if (!tile || !tile.isMatchable) continue;
          if (tile.isSpecial) return true; // a special can always be activated
          if (c + 1 < this.cols && this.getTile(r, c + 1) && this.getTile(r, c + 1).isMatchable) {
            this._swapCells(r, c, r, c + 1);
            const found = this.findMatches().length > 0;
            this._swapCells(r, c, r, c + 1);
            if (found) return true;
          }
          if (r + 1 < this.rows && this.getTile(r + 1, c) && this.getTile(r + 1, c).isMatchable) {
            this._swapCells(r, c, r + 1, c);
            const found = this.findMatches().length > 0;
            this._swapCells(r, c, r + 1, c);
            if (found) return true;
          }
        }
      }
      return false;
    }

    /**
     * Reshuffles all non-blocker tile types in place until the board has
     * no pre-existing matches and at least one legal move exists.
     */
    shuffleBoard() {
      const movable = [];
      for (let r = 0; r < this.rows; r++) {
        for (let c = 0; c < this.cols; c++) {
          const tile = this.getTile(r, c);
          if (tile && !tile.isBlockedStone) movable.push(tile);
        }
      }
      const types = movable.map((t) => t.type);
      let attempts = 0;
      do {
        const shuffled = this.rng.shuffle(types);
        movable.forEach((tile, i) => {
          tile.type = shuffled[i];
          tile.specialType = null;
        });
        attempts++;
      } while ((this.findMatches().length > 0 || !this.hasPossibleMove()) && attempts < 200);
      return true;
    }

    // ---------------------------------------------------------------
    // Serialization (useful for tests / debugging)
    // ---------------------------------------------------------------

    toTypeGrid() {
      return this.grid.map((row) => row.map((t) => (t ? t.specialType || t.type : null)));
    }
  }

  global.Board = Board;
})(window);
