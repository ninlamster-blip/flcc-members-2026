/**
 * GameScene — Phase 1 vertical slice: renders an 8x8 Board using the
 * SVG icon set, supports tap-to-select and drag-to-swap input (mouse +
 * touch), and drives the full match -> resolve -> gravity -> refill ->
 * cascade loop against Objects/Board.js.
 *
 * Not yet implemented here (arrives in Phase 2): activating an existing
 * special piece by swapping into it, combining two specials, particle
 * effects, combo text, and chain-reaction juice. Board.js already
 * exposes specialEffectCells()/combineSpecials() for that follow-up work.
 */
(function (global) {
  'use strict';

  const DRAG_THRESHOLD = 18;
  const CLEAR_TWEEN_MS = 160;
  const FALL_TWEEN_MS = 220;
  const SWAP_TWEEN_MS = 140;

  class GameScene extends Phaser.Scene {
    constructor() {
      super('Game');
    }

    init(data) {
      this.levelId = (data && data.levelId) || 1;
    }

    create() {
      const C = global.FM_CONST.COLORS;
      const GRID = global.FM_CONST.GRID;
      this.cameras.main.setBackgroundColor(C.BACKGROUND);

      this.rows = GRID.ROWS;
      this.cols = GRID.COLS;
      this.movesLeft = 30;
      this.score = 0;
      this.isResolving = false;
      this.selectedCell = null;
      this.dragStart = null;
      this.spritesById = new Map();

      this._computeLayout();
      this._ensureBadgeTextures();

      this.board = new global.Board({ rows: this.rows, cols: this.cols, rng: new global.RNG(Date.now()) });
      this.board.generate();

      this.boardContainer = this.add.container(0, 0);
      this._renderInitialBoard();
      this._createHud();
      this._createSelectionHighlight();

      this.input.on('pointerdown', this._onPointerDown, this);
      this.input.on('pointerup', this._onPointerUp, this);

      this.scale.on('resize', () => this._computeLayout(true), this);
    }

    // ---------------------------------------------------------------
    // Layout
    // ---------------------------------------------------------------

    _computeLayout(reflow) {
      const { width, height } = this.scale;
      const topMargin = 120;
      const bottomMargin = 40;
      const available = Math.min(width - 32, height - topMargin - bottomMargin);
      this.tileSize = Math.floor(available / this.cols);
      const boardPixelW = this.tileSize * this.cols;
      const boardPixelH = this.tileSize * this.rows;
      this.boardX = Math.round((width - boardPixelW) / 2);
      this.boardY = topMargin;
      if (reflow && this.boardContainer) this._reflowSprites();
    }

    cellToPixel(row, col) {
      return {
        x: this.boardX + col * this.tileSize + this.tileSize / 2,
        y: this.boardY + row * this.tileSize + this.tileSize / 2
      };
    }

    cellFromPixel(x, y) {
      const col = Math.floor((x - this.boardX) / this.tileSize);
      const row = Math.floor((y - this.boardY) / this.tileSize);
      if (row < 0 || row >= this.rows || col < 0 || col >= this.cols) return null;
      return { row, col };
    }

    _reflowSprites() {
      this.board.grid.forEach((row) => {
        row.forEach((tile) => {
          if (!tile) return;
          const container = this.spritesById.get(tile.id);
          if (!container) return;
          const p = this.cellToPixel(tile.row, tile.col);
          container.setPosition(p.x, p.y);
          this._scaleContainerToTile(container);
        });
      });
    }

    _scaleContainerToTile(container) {
      const bg = container.getData('bg');
      const icon = container.getData('icon');
      if (bg) bg.setDisplaySize(this.tileSize * 0.86, this.tileSize * 0.86);
      if (icon) icon.setDisplaySize(this.tileSize * 0.52, this.tileSize * 0.52);
    }

    // ---------------------------------------------------------------
    // Badge (tinted rounded-square) textures, one per piece/special type
    // ---------------------------------------------------------------

    _ensureBadgeTextures() {
      const size = 128;
      const radius = 28;
      const allTypes = Object.assign({}, global.FM_CONST.PIECE_COLORS, global.FM_CONST.SPECIAL_COLORS);
      Object.keys(allTypes).forEach((type) => {
        const key = `badge_${type}`;
        if (this.textures.exists(key)) return;
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        const color = Phaser.Display.Color.HexStringToColor(allTypes[type]).color;
        g.fillStyle(color, 1);
        g.fillRoundedRect(0, 0, size, size, radius);
        g.generateTexture(key, size, size);
        g.destroy();
      });

      if (!this.textures.exists('badge_stone')) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(Phaser.Display.Color.HexStringToColor('#94A3B8').color, 1);
        g.fillRoundedRect(0, 0, size, size, radius);
        g.generateTexture('badge_stone', size, size);
        g.destroy();
      }
    }

    // ---------------------------------------------------------------
    // Board rendering
    // ---------------------------------------------------------------

    _renderInitialBoard() {
      this.board.grid.forEach((row) => {
        row.forEach((tile) => {
          if (!tile) return;
          this._createTileSprite(tile);
        });
      });
    }

    _createTileSprite(tile) {
      const p = this.cellToPixel(tile.row, tile.col);
      const container = this.add.container(p.x, p.y);
      const iconKey = tile.isBlockedStone ? 'stone' : tile.specialType || tile.type;
      const badgeKey = tile.isBlockedStone ? 'badge_stone' : `badge_${tile.specialType || tile.type}`;

      const bg = this.add.image(0, 0, badgeKey).setDisplaySize(this.tileSize * 0.86, this.tileSize * 0.86);
      const icon = this.add.image(0, 0, iconKey).setDisplaySize(this.tileSize * 0.52, this.tileSize * 0.52);
      container.add([bg, icon]);
      container.setData('bg', bg);
      container.setData('icon', icon);
      container.setData('tileId', tile.id);

      this.boardContainer.add(container);
      this.spritesById.set(tile.id, container);
      return container;
    }

    _refreshTileVisual(tile) {
      const container = this.spritesById.get(tile.id);
      if (!container) return;
      const iconKey = tile.isBlockedStone ? 'stone' : tile.specialType || tile.type;
      const badgeKey = tile.isBlockedStone ? 'badge_stone' : `badge_${tile.specialType || tile.type}`;
      container.getData('icon').setTexture(iconKey);
      container.getData('bg').setTexture(badgeKey);
      this.tweens.add({ targets: container, scale: { from: 0.7, to: 1 }, duration: 220, ease: 'Back.easeOut' });
    }

    // ---------------------------------------------------------------
    // HUD
    // ---------------------------------------------------------------

    _createHud() {
      const C = global.FM_CONST.COLORS;
      const { width } = this.scale;

      new global.FMButton(this, {
        x: 50,
        y: 40,
        width: 76,
        height: 40,
        label: '< Menu',
        variant: 'secondary',
        fontSize: 13,
        onClick: () => this.scene.start('Menu')
      });

      this.movesText = this.add.text(width / 2, 34, `Moves: ${this.movesLeft}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        fontStyle: '700',
        color: C.TEXT
      }).setOrigin(0.5);

      this.scoreText = this.add.text(width / 2, 60, `Score: ${this.score}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5);

      this.statusText = this.add.text(width / 2, this.scale.height - 24, '', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        color: C.ACCENT
      }).setOrigin(0.5);
    }

    _updateHud() {
      this.movesText.setText(`Moves: ${this.movesLeft}`);
      this.scoreText.setText(`Score: ${this.score}`);
    }

    _createSelectionHighlight() {
      this.highlight = this.add.graphics();
      this.highlight.setVisible(false);
    }

    _drawHighlightAt(row, col) {
      const p = this.cellToPixel(row, col);
      const s = this.tileSize * 0.9;
      this.highlight.clear();
      this.highlight.lineStyle(3, Phaser.Display.Color.HexStringToColor(global.FM_CONST.COLORS.ACCENT).color, 1);
      this.highlight.strokeRoundedRect(p.x - s / 2, p.y - s / 2, s, s, 18);
      this.highlight.setVisible(true);
    }

    // ---------------------------------------------------------------
    // Input
    // ---------------------------------------------------------------

    _onPointerDown(pointer) {
      if (this.isResolving) return;
      const cell = this.cellFromPixel(pointer.x, pointer.y);
      if (!cell) return;
      this.dragStart = { row: cell.row, col: cell.col, x: pointer.x, y: pointer.y };
    }

    _onPointerUp(pointer) {
      if (this.isResolving || !this.dragStart) {
        this.dragStart = null;
        return;
      }
      const dx = pointer.x - this.dragStart.x;
      const dy = pointer.y - this.dragStart.y;
      const start = { row: this.dragStart.row, col: this.dragStart.col };
      this.dragStart = null;

      if (Math.max(Math.abs(dx), Math.abs(dy)) >= DRAG_THRESHOLD) {
        let target;
        if (Math.abs(dx) > Math.abs(dy)) {
          target = { row: start.row, col: start.col + (dx > 0 ? 1 : -1) };
        } else {
          target = { row: start.row + (dy > 0 ? 1 : -1), col: start.col };
        }
        this._deselect();
        this._attemptSwap(start.row, start.col, target.row, target.col);
      } else {
        this._handleTap(start.row, start.col);
      }
    }

    _handleTap(row, col) {
      if (!this.selectedCell) {
        this._select(row, col);
        return;
      }
      if (this.selectedCell.row === row && this.selectedCell.col === col) {
        this._deselect();
        return;
      }
      if (this.board.isAdjacent(this.selectedCell.row, this.selectedCell.col, row, col)) {
        const from = this.selectedCell;
        this._deselect();
        this._attemptSwap(from.row, from.col, row, col);
      } else {
        this._select(row, col);
      }
    }

    _select(row, col) {
      const tile = this.board.getTile(row, col);
      if (!tile || !tile.isMatchable) return;
      this.selectedCell = { row, col };
      this._drawHighlightAt(row, col);
    }

    _deselect() {
      this.selectedCell = null;
      this.highlight.setVisible(false);
    }

    // ---------------------------------------------------------------
    // Swap + resolution pipeline
    // ---------------------------------------------------------------

    _attemptSwap(r1, c1, r2, c2) {
      if (!this.board.inBounds(r2, c2)) return;
      if (!this.board.canSwap(r1, c1, r2, c2)) {
        this._shakeCell(r1, c1);
        this._shakeCell(r2, c2);
        return;
      }

      this.isResolving = true;
      const tileA = this.board.getTile(r1, c1);
      const tileB = this.board.getTile(r2, c2);
      const containerA = this.spritesById.get(tileA.id);
      const containerB = this.spritesById.get(tileB.id);
      const posA = this.cellToPixel(r1, c1);
      const posB = this.cellToPixel(r2, c2);

      this.board.swap(r1, c1, r2, c2);

      let remaining = 2;
      const onDone = () => {
        remaining--;
        if (remaining > 0) return;
        this.movesLeft = Math.max(0, this.movesLeft - 1);
        this._updateHud();
        this._runResolutionLoop({ row: r2, col: c2 });
      };

      this.tweens.add({ targets: containerA, x: posB.x, y: posB.y, duration: SWAP_TWEEN_MS, ease: 'Sine.easeInOut', onComplete: onDone });
      this.tweens.add({ targets: containerB, x: posA.x, y: posA.y, duration: SWAP_TWEEN_MS, ease: 'Sine.easeInOut', onComplete: onDone });
    }

    _shakeCell(row, col) {
      const tile = this.board.getTile(row, col);
      if (!tile) return;
      const container = this.spritesById.get(tile.id);
      if (!container) return;
      const baseX = container.x;
      this.tweens.add({
        targets: container,
        x: baseX + 6,
        duration: 45,
        yoyo: true,
        repeat: 3,
        onComplete: () => container.setX(baseX)
      });
    }

    /**
     * Runs one full settle cycle: find matches -> resolve -> gravity ->
     * refill -> recurse while matches remain. When the board finally has
     * no matches, checks for a deadlock and reshuffles if needed, then
     * re-enables input.
     */
    _runResolutionLoop(swapAnchor) {
      const groups = this.board.findMatches();

      if (groups.length === 0) {
        this._finishResolutionCycle();
        return;
      }

      const result = this.board.resolveMatches(groups, swapAnchor || null);
      this.score += result.scoreGained;
      this._updateHud();

      const specialAnchorKeys = new Set(result.specialsCreated.map((s) => `${s.row},${s.col}`));
      const clearTargets = [];

      result.clearedCells.forEach((cell) => {
        const k = `${cell.row},${cell.col}`;
        if (specialAnchorKeys.has(k)) return; // handled as a "promote" visual instead of a clear
        // Find the sprite by scanning spritesById is O(n); instead we rely on
        // the fact clearedCells no longer exist in the grid at (row,col),
        // so locate the orphaned container via its last known board position.
        const container = this._findOrphanContainerAt(cell);
        if (container) clearTargets.push(container);
      });

      if (clearTargets.length === 0) {
        this._afterClearAnimation(result);
        return;
      }

      let pending = clearTargets.length;
      clearTargets.forEach((container) => {
        this.tweens.add({
          targets: container,
          scale: 0,
          alpha: 0,
          duration: CLEAR_TWEEN_MS,
          ease: 'Sine.easeIn',
          onComplete: () => {
            const tileId = container.getData('tileId');
            this.spritesById.delete(tileId);
            container.destroy();
            pending--;
            if (pending === 0) this._afterClearAnimation(result);
          }
        });
      });
    }

    _findOrphanContainerAt(cell) {
      // The tile that was cleared is gone from the grid, but its sprite
      // container is still positioned at this cell's pixel coordinates.
      const p = this.cellToPixel(cell.row, cell.col);
      let found = null;
      this.spritesById.forEach((container) => {
        if (found) return;
        if (Math.abs(container.x - p.x) < 1 && Math.abs(container.y - p.y) < 1) found = container;
      });
      return found;
    }

    _afterClearAnimation(result) {
      // Promote surviving special-piece cells to their new visuals.
      result.specialsCreated.forEach((s) => {
        const tile = this.board.getTile(s.row, s.col);
        if (tile) this._refreshTileVisual(tile);
      });

      // Refresh any blocker tiles that changed (stone damaged/destroyed).
      result.blockersDamaged.forEach((b) => {
        const tile = this.board.getTile(b.row, b.col);
        if (tile) this._refreshTileVisual(tile);
      });

      this._applyGravityAndRefill();
    }

    _applyGravityAndRefill() {
      const moves = this.board.applyGravity();
      const spawns = this.board.refill();

      let pending = moves.length + spawns.length;
      if (pending === 0) {
        this._runResolutionLoop();
        return;
      }

      moves.forEach((m) => {
        const container = this.spritesById.get(m.tileId);
        if (!container) {
          pending--;
          return;
        }
        const to = this.cellToPixel(m.to.row, m.to.col);
        this.tweens.add({
          targets: container,
          y: to.y,
          duration: FALL_TWEEN_MS,
          ease: 'Bounce.easeOut',
          onComplete: () => {
            pending--;
            if (pending === 0) this._runResolutionLoop();
          }
        });
      });

      spawns.forEach((s) => {
        const tile = this.board.getTile(s.row, s.col);
        const container = this._createTileSprite(tile);
        const finalPos = this.cellToPixel(s.row, s.col);
        const startPos = this.cellToPixel(s.fromRow, s.col);
        container.setPosition(finalPos.x, startPos.y);
        this.tweens.add({
          targets: container,
          y: finalPos.y,
          duration: FALL_TWEEN_MS,
          ease: 'Bounce.easeOut',
          onComplete: () => {
            pending--;
            if (pending === 0) this._runResolutionLoop();
          }
        });
      });
    }

    _finishResolutionCycle() {
      if (!this.board.hasPossibleMove()) {
        this.statusText.setText('No moves left — reshuffling...');
        this.board.shuffleBoard();
        this.time.delayedCall(400, () => {
          this._redrawEntireBoard();
          this.statusText.setText('');
          this.isResolving = false;
          this._checkEndState();
        });
        return;
      }
      this.isResolving = false;
      this._checkEndState();
    }

    _redrawEntireBoard() {
      this.spritesById.forEach((container) => container.destroy());
      this.spritesById.clear();
      this._renderInitialBoard();
    }

    _checkEndState() {
      if (this.movesLeft <= 0) {
        this.statusText.setText(`Out of moves — Final score: ${this.score}`);
      }
    }
  }

  global.GameScene = GameScene;
})(window);
