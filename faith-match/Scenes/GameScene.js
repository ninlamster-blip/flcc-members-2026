/**
 * GameScene — renders an 8x8 Board using the SVG icon set, supports
 * tap-to-select and drag-to-swap input (mouse + touch), and drives the
 * full match -> resolve -> gravity -> refill -> cascade loop against
 * Objects/Board.js. Also handles swap-triggered special-piece
 * activation and combination, plus juice: particle bursts, combo text,
 * special-effect flashes (beam/ring/board-flash), and cascade-scaled
 * screen shake.
 */
(function (global) {
  'use strict';

  const DRAG_THRESHOLD = 18;
  const CLEAR_TWEEN_MS = 160;
  const FALL_TWEEN_MS = 220;
  const SWAP_TWEEN_MS = 140;

  const COMBO_LABELS = {
    line4: 'Great!',
    line5: 'Amazing!',
    L_T: 'Prayer Power!',
    plus: 'Miraculous!'
  };

  const CASCADE_LABELS = ['', '', 'Blessed!', 'Anointed!', 'Overflowing!', 'Miraculous!'];

  class GameScene extends Phaser.Scene {
    constructor() {
      super('Game');
    }

    init(data) {
      this.levelId = (data && data.levelId) || 1;
    }

    create() {
      const C = global.FM_CONST.COLORS;
      this.cameras.main.setBackgroundColor(C.BACKGROUND);

      this.level = global.LevelManager.getLevel(this.levelId);
      this.rows = this.level.rows;
      this.cols = this.level.cols;
      this.movesLeft = this.level.resourceType === 'moves' ? this.level.moveLimit : null;
      this.timeLeft = this.level.resourceType === 'time' ? this.level.timeLimit : null;
      this.score = 0;
      this.isResolving = false;
      this.levelEnded = false;
      this.selectedCell = null;
      this.dragStart = null;
      this.cascadeDepth = 0;
      this.spritesById = new Map();
      this.objectiveTracker = new global.ObjectiveTracker(this.level.objectives);

      this._computeLayout();
      this._ensureBadgeTextures();
      this._ensureFxTextures();

      this.board = new global.Board({
        rows: this.rows,
        cols: this.cols,
        pieceTypes: this.level.pieceTypes,
        rng: new global.RNG(this.level.seed)
      });
      this.board.generate(this.level.blockers);

      this.boardContainer = this.add.container(0, 0);
      this.fxContainer = this.add.container(0, 0);
      this._renderInitialBoard();
      this._createHud();
      this._createSelectionHighlight();

      if (this.level.resourceType === 'time') {
        this.timerEvent = this.time.addEvent({ delay: 1000, loop: true, callback: this._tickTimer, callbackScope: this });
      }

      this.input.on('pointerdown', this._onPointerDown, this);
      this.input.on('pointerup', this._onPointerUp, this);

      this.scale.on('resize', () => this._computeLayout(true), this);
    }

    // ---------------------------------------------------------------
    // Layout
    // ---------------------------------------------------------------

    _computeLayout(reflow) {
      const { width, height } = this.scale;
      const topMargin = 156;
      const bottomMargin = 40;
      const available = Math.min(width - 32, height - topMargin - bottomMargin);
      this.tileSize = Math.floor(available / this.cols);
      const boardPixelW = this.tileSize * this.cols;
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
    // Textures: badges (tinted rounded squares) + particle/fx primitives
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

    _ensureFxTextures() {
      if (!this.textures.exists('fx_dot')) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.fillStyle(0xffffff, 1);
        g.fillCircle(8, 8, 8);
        g.generateTexture('fx_dot', 16, 16);
        g.destroy();
      }
      if (!this.textures.exists('fx_ring')) {
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        g.lineStyle(6, 0xffffff, 1);
        g.strokeCircle(32, 32, 26);
        g.generateTexture('fx_ring', 64, 64);
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

    _pieceColorHex(tile) {
      const map = tile.isSpecial ? global.FM_CONST.SPECIAL_COLORS : global.FM_CONST.PIECE_COLORS;
      const type = tile.isSpecial ? tile.specialType : tile.type;
      return Phaser.Display.Color.HexStringToColor(map[type] || '#2563EB').color;
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
        label: '< Levels',
        variant: 'secondary',
        fontSize: 13,
        onClick: () => this.scene.start('LevelSelect', { worldId: this.level.worldId })
      });

      const resourceLabel = this.level.resourceType === 'time' ? this._formatTime(this.timeLeft) : `Moves: ${this.movesLeft}`;
      this.movesText = this.add.text(width / 2, 30, resourceLabel, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        fontStyle: '700',
        color: C.TEXT
      }).setOrigin(0.5);

      this.scoreText = this.add.text(width / 2, 54, `Score: ${this.score}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5);

      this._createObjectiveHud();

      this.statusText = this.add.text(width / 2, this.scale.height - 24, '', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        color: C.ACCENT
      }).setOrigin(0.5);
    }

    _createObjectiveHud() {
      const C = global.FM_CONST.COLORS;
      const { width } = this.scale;
      const objectives = this.objectiveTracker.getSummary();
      const rowY = 92;
      const chipWidth = Math.min(150, (width - 32) / objectives.length);
      const totalWidth = chipWidth * objectives.length;
      const startX = width / 2 - totalWidth / 2 + chipWidth / 2;

      this.objectiveChips = objectives.map((obj, i) => {
        const x = startX + i * chipWidth;
        const container = this.add.container(x, rowY);

        const iconKey = obj.type === global.FM_CONST.OBJECTIVE_TYPES.COLLECT
          ? obj.pieceType
          : obj.type === global.FM_CONST.OBJECTIVE_TYPES.BREAK_STONE
            ? 'stone'
            : obj.type === global.FM_CONST.OBJECTIVE_TYPES.CLEAR_FOG
              ? 'fog'
              : null;

        let iconOffset = 0;
        if (iconKey && this.textures.exists(iconKey)) {
          const badgeColor = Phaser.Display.Color.HexStringToColor(global.FM_CONST.PIECE_COLORS[iconKey] || '#94A3B8').color;
          container.add(this.add.circle(-chipWidth / 2 + 16, 0, 14, badgeColor));
          container.add(this.add.image(-chipWidth / 2 + 16, 0, iconKey).setDisplaySize(18, 18));
          iconOffset = 20;
        }

        const text = this.add.text(-chipWidth / 2 + 6 + iconOffset, 0, this._objectiveProgressText(obj), {
          fontFamily: 'Inter, sans-serif',
          fontSize: '12px',
          fontStyle: '700',
          color: C.TEXT
        }).setOrigin(0, 0.5);
        container.add(text);
        container.setData('text', text);

        return container;
      });
    }

    _objectiveProgressText(obj) {
      if (obj.type === global.FM_CONST.OBJECTIVE_TYPES.SCORE) return `${obj.progress}/${obj.target}`;
      return `${obj.progress}/${obj.target}`;
    }

    _formatTime(seconds) {
      const s = Math.max(0, seconds);
      const m = Math.floor(s / 60);
      const r = s % 60;
      return `${m}:${r < 10 ? '0' : ''}${r}`;
    }

    _updateHud() {
      const resourceLabel = this.level.resourceType === 'time' ? this._formatTime(this.timeLeft) : `Moves: ${this.movesLeft}`;
      this.movesText.setText(resourceLabel);
      this.scoreText.setText(`Score: ${this.score}`);
      this._updateObjectiveHud();
    }

    _updateObjectiveHud() {
      if (!this.objectiveChips) return;
      const summary = this.objectiveTracker.getSummary();
      summary.forEach((obj, i) => {
        const chip = this.objectiveChips[i];
        if (!chip) return;
        chip.getData('text').setText(this._objectiveProgressText(obj));
      });
    }

    _tickTimer() {
      if (this.levelEnded) return;
      this.timeLeft = Math.max(0, this.timeLeft - 1);
      this._updateHud();
      if (this.timeLeft <= 0) {
        this.timerEvent.remove();
        if (!this.isResolving) this._checkEndState();
      }
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
    // Juice: particles, combo text, special-effect flashes, screen shake
    // ---------------------------------------------------------------

    _spawnClearParticles(cells) {
      cells.forEach((cell) => {
        const p = this.cellToPixel(cell.row, cell.col);
        const colorHex = Phaser.Display.Color.HexStringToColor(
          global.FM_CONST.PIECE_COLORS[cell.type] || global.FM_CONST.COLORS.ACCENT
        ).color;
        const emitter = this.add.particles(p.x, p.y, 'fx_dot', {
          lifespan: 380,
          speed: { min: 60, max: 140 },
          scale: { start: this.tileSize / 64, end: 0 },
          alpha: { start: 0.9, end: 0 },
          tint: colorHex,
          quantity: 6,
          emitting: false
        });
        this.fxContainer.add(emitter);
        emitter.explode(6);
        this.time.delayedCall(420, () => emitter.destroy());
      });
    }

    _showComboText(text, x, y, colorHex) {
      const label = this.add.text(x, y, text, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '22px',
        fontStyle: '800',
        color: colorHex || global.FM_CONST.COLORS.ACCENT
      }).setOrigin(0.5).setScale(0.6).setAlpha(0);
      this.fxContainer.add(label);

      this.tweens.add({
        targets: label,
        scale: 1,
        alpha: 1,
        y: y - 18,
        duration: 220,
        ease: 'Back.easeOut',
        onComplete: () => {
          this.tweens.add({
            targets: label,
            alpha: 0,
            y: y - 42,
            delay: 260,
            duration: 260,
            ease: 'Sine.easeIn',
            onComplete: () => label.destroy()
          });
        }
      });
    }

    _shakeCamera(depth) {
      const intensity = Math.min(0.012, 0.004 + depth * 0.0018);
      this.cameras.main.shake(120 + depth * 20, intensity);
    }

    /**
     * One-shot visual flourish for a special piece's activation, matched
     * to its area of effect: a horizontal/vertical beam sweep for the row
     * / column clearers, an expanding ring for the radius bombs, and a
     * full-board flash for the color-bomb-style Pentecost Flame.
     */
    _playSpecialFx(specialType, row, col) {
      const S = global.FM_CONST.SPECIAL_TYPES;
      const colorHex = Phaser.Display.Color.HexStringToColor(global.FM_CONST.SPECIAL_COLORS[specialType]).color;
      const p = this.cellToPixel(row, col);

      if (specialType === S.LIVING_WATER) {
        const beam = this.add.rectangle(this.boardX + (this.tileSize * this.cols) / 2, p.y, this.tileSize * this.cols, this.tileSize * 0.7, colorHex, 0.35);
        this.fxContainer.add(beam);
        this.tweens.add({ targets: beam, alpha: 0, duration: 380, onComplete: () => beam.destroy() });
      } else if (specialType === S.SWORD_OF_SPIRIT) {
        const beam = this.add.rectangle(p.x, this.boardY + (this.tileSize * this.rows) / 2, this.tileSize * 0.7, this.tileSize * this.rows, colorHex, 0.35);
        this.fxContainer.add(beam);
        this.tweens.add({ targets: beam, alpha: 0, duration: 380, onComplete: () => beam.destroy() });
      } else if (specialType === S.PENTECOST_FLAME) {
        const { width, height } = this.scale;
        const flash = this.add.rectangle(width / 2, height / 2, width, height, colorHex, 0.25);
        this.fxContainer.add(flash);
        this.tweens.add({ targets: flash, alpha: 0, duration: 420, onComplete: () => flash.destroy() });
      } else {
        const radius = specialType === S.ARMOR_OF_GOD ? this.tileSize * 5 : this.tileSize * 3;
        const ring = this.add.image(p.x, p.y, 'fx_ring').setDisplaySize(20, 20).setTint(colorHex).setAlpha(0.8);
        this.fxContainer.add(ring);
        this.tweens.add({
          targets: ring,
          displayWidth: radius,
          displayHeight: radius,
          alpha: 0,
          duration: 420,
          ease: 'Sine.easeOut',
          onComplete: () => ring.destroy()
        });
      }
    }

    // ---------------------------------------------------------------
    // Input
    // ---------------------------------------------------------------

    _onPointerDown(pointer) {
      if (this.isResolving || this.levelEnded) return;
      const cell = this.cellFromPixel(pointer.x, pointer.y);
      if (!cell) return;
      this.dragStart = { row: cell.row, col: cell.col, x: pointer.x, y: pointer.y };
    }

    _onPointerUp(pointer) {
      if (this.isResolving || this.levelEnded || !this.dragStart) {
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
      this.cascadeDepth = 0;
      const tileA = this.board.getTile(r1, c1);
      const tileB = this.board.getTile(r2, c2);
      const wasSpecialA = tileA.isSpecial;
      const wasSpecialB = tileB.isSpecial;
      const specialTypeA = tileA.specialType;
      const specialTypeB = tileB.specialType;
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

        if (wasSpecialA && wasSpecialB) {
          this._handleSpecialCombo(tileA, specialTypeA, tileB, specialTypeB);
        } else if (wasSpecialA) {
          this._handleSpecialActivation(tileA);
        } else if (wasSpecialB) {
          this._handleSpecialActivation(tileB);
        } else {
          this._runResolutionLoop({ row: r2, col: c2 });
        }
      };

      this.tweens.add({ targets: containerA, x: posB.x, y: posB.y, duration: SWAP_TWEEN_MS, ease: 'Sine.easeInOut', onComplete: onDone });
      this.tweens.add({ targets: containerB, x: posA.x, y: posA.y, duration: SWAP_TWEEN_MS, ease: 'Sine.easeInOut', onComplete: onDone });
    }

    _handleSpecialActivation(specialTile) {
      this._playSpecialFx(specialTile.specialType, specialTile.row, specialTile.col);
      const p = this.cellToPixel(specialTile.row, specialTile.col);
      this._showComboText('Activated!', p.x, p.y, global.FM_CONST.SPECIAL_COLORS[specialTile.specialType]);
      this._shakeCamera(2);

      const result = this.board.activateSpecials([{ row: specialTile.row, col: specialTile.col }]);
      this.score += result.scoreGained;
      this._applyResultToObjectives(result);
      this._updateHud();
      this._playClearSequence(result, () => this._afterClearAnimation(result));
    }

    _handleSpecialCombo(tileA, specialTypeA, tileB, specialTypeB) {
      // Both tiles now sit at their post-swap positions; use tileB's cell
      // (the swap's destination) as the combo epicenter.
      const combo = this.board.combineSpecials(specialTypeA, specialTypeB, tileB.row, tileB.col);
      this._playSpecialFx(specialTypeA, tileA.row, tileA.col);
      this._playSpecialFx(specialTypeB, tileB.row, tileB.col);
      const p = this.cellToPixel(tileB.row, tileB.col);
      this._showComboText('Combined Power!', p.x, p.y, global.FM_CONST.COLORS.ACCENT);
      this._shakeCamera(4);

      // The two combo-source tiles themselves should also clear, in case
      // their own effect() calc didn't already include their own cell.
      const originCells = combo.cells.concat([{ row: tileA.row, col: tileA.col }, { row: tileB.row, col: tileB.col }]);
      const result = this.board.activateSpecials(originCells, 300);
      this.score += result.scoreGained;
      this._applyResultToObjectives(result);
      this._updateHud();
      this._playClearSequence(result, () => this._afterClearAnimation(result));
    }

    _applyResultToObjectives(result) {
      this.objectiveTracker.applyClearedCells(result.clearedCells);
      this.objectiveTracker.applyBlockerDamage(result.blockersDamaged);
      this.objectiveTracker.applyScore(this.score);
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

      this.cascadeDepth++;
      const result = this.board.resolveMatches(groups, swapAnchor || null);
      this.score += result.scoreGained;
      this._applyResultToObjectives(result);
      this._updateHud();

      // Combo/cascade text: prefer the biggest single-group shape label,
      // falling back to a cascade-depth label on chained matches.
      const biggestGroup = groups.reduce((a, b) => (b.size > a.size ? b : a), groups[0]);
      const shapeLabel = COMBO_LABELS[biggestGroup.shape];
      const cascadeLabel = this.cascadeDepth >= 2 ? CASCADE_LABELS[Math.min(this.cascadeDepth, CASCADE_LABELS.length - 1)] : null;
      const label = shapeLabel || cascadeLabel;
      if (label) {
        const anchorCell = swapAnchor || biggestGroup.anchor;
        const p = this.cellToPixel(anchorCell.row, anchorCell.col);
        this._showComboText(label, p.x, p.y, global.FM_CONST.COLORS.ACCENT);
      }
      if (this.cascadeDepth >= 2) this._shakeCamera(this.cascadeDepth);

      result.specialsCreated.forEach((s) => {
        this._playSpecialFx(s.specialType, s.row, s.col);
      });

      this._playClearSequence(result, () => this._afterClearAnimation(result));
    }

    /**
     * Shared clear-animation step used by both regular match resolution
     * and swap-triggered special activation/combination: bursts particles
     * on every cleared cell, tweens the orphaned sprites out, then invokes
     * onComplete once all clear animations finish.
     */
    _playClearSequence(result, onComplete) {
      const specialAnchorKeys = new Set(result.specialsCreated.map((s) => `${s.row},${s.col}`));
      const clearTargets = [];

      result.clearedCells.forEach((cell) => {
        const k = `${cell.row},${cell.col}`;
        if (specialAnchorKeys.has(k)) return; // handled as a "promote" visual instead of a clear
        const container = this._findOrphanContainerAt(cell);
        if (container) clearTargets.push(container);
      });

      this._spawnClearParticles(result.clearedCells.filter((c) => !specialAnchorKeys.has(`${c.row},${c.col}`)));

      if (clearTargets.length === 0) {
        onComplete();
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
            if (pending === 0) onComplete();
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
      this.cascadeDepth = 0;
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
      if (this.levelEnded) return;

      if (this.objectiveTracker.isComplete()) {
        this._endLevel(true);
        return;
      }

      const outOfMoves = this.level.resourceType === 'moves' && this.movesLeft <= 0;
      const outOfTime = this.level.resourceType === 'time' && this.timeLeft <= 0;
      if (outOfMoves || outOfTime) {
        this._endLevel(false);
      }
    }

    _endLevel(won) {
      this.levelEnded = true;
      this._deselect();
      if (this.timerEvent) this.timerEvent.remove();

      if (won) {
        const stars = global.LevelManager.starsForScore(this.level, this.score);
        const existing = global.FM_SAVE.data.completedLevels[this.levelId];
        const bestScore = Math.max(this.score, existing ? existing.bestScore : 0);
        const bestStars = Math.max(stars, existing ? existing.stars : 0);
        global.FM_SAVE.data.completedLevels[this.levelId] = {
          stars: bestStars,
          bestScore,
          movesUsed: this.level.moveLimit ? this.level.moveLimit - (this.movesLeft || 0) : null,
          completedAt: Date.now()
        };
        if (this.score > global.FM_SAVE.data.leaderboard.bestScore) {
          global.FM_SAVE.data.leaderboard.bestScore = this.score;
        }
        global.FM_SAVE.addCoins(10 * bestStars);
        global.FM_SAVE.addXP(50 * bestStars);
        this._showWinModal(stars);
      } else {
        this._showLoseModal();
      }
    }

    _buildModalShell(title, accentHex) {
      const { width, height } = this.scale;
      const C = global.FM_CONST.COLORS;
      const modal = this.add.container(width / 2, height / 2);

      const overlay = this.add.rectangle(0, 0, width, height, 0x000000, 0.35).setOrigin(0.5);
      overlay.setPosition(0, 0);
      modal.add(overlay);

      const panelWidth = Math.min(320, width - 48);
      const panel = this.add.graphics();
      panel.fillStyle(Phaser.Display.Color.HexStringToColor(C.SURFACE).color, 1);
      panel.fillRoundedRect(-panelWidth / 2, -140, panelWidth, 280, 22);
      modal.add(panel);

      const stripe = this.add.graphics();
      stripe.fillStyle(Phaser.Display.Color.HexStringToColor(accentHex).color, 1);
      stripe.fillRoundedRect(-panelWidth / 2, -140, panelWidth, 8, { tl: 22, tr: 22, bl: 0, br: 0 });
      modal.add(stripe);

      modal.add(this.add.text(0, -100, title, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '22px',
        fontStyle: '800',
        color: C.TEXT
      }).setOrigin(0.5));

      modal.setData('panelWidth', panelWidth);
      return modal;
    }

    _showWinModal(stars) {
      const C = global.FM_CONST.COLORS;
      const modal = this._buildModalShell('Level Complete!', global.FM_CONST.WORLD_ACCENTS[this.level.worldId]);

      const starLabel = '★'.repeat(stars) + '☆'.repeat(3 - stars);
      modal.add(this.add.text(0, -54, starLabel, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '32px',
        color: global.FM_CONST.WORLD_ACCENTS[this.level.worldId]
      }).setOrigin(0.5));

      modal.add(this.add.text(0, -8, `Score: ${this.score}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        fontStyle: '600',
        color: C.TEXT
      }).setOrigin(0.5));

      modal.add(this.add.text(0, 18, `+${10 * stars} coins   +${50 * stars} XP`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5));

      const nextLevelId = this.levelId + 1;
      const hasNext = nextLevelId <= global.FM_CONST.TOTAL_LEVEL_COUNT;
      modal.add(new global.FMButton(this, {
        x: 0,
        y: 78,
        width: modal.getData('panelWidth') - 60,
        height: 48,
        label: hasNext ? 'Next Level' : 'Choose World',
        variant: 'primary',
        onClick: () => {
          if (hasNext) this.scene.start('Game', { levelId: nextLevelId });
          else this.scene.start('WorldMap');
        }
      }));

      modal.add(new global.FMButton(this, {
        x: 0,
        y: 132,
        width: modal.getData('panelWidth') - 60,
        height: 40,
        label: 'Level Select',
        variant: 'ghost',
        fontSize: 14,
        onClick: () => this.scene.start('LevelSelect', { worldId: this.level.worldId })
      }));
    }

    _showLoseModal() {
      const C = global.FM_CONST.COLORS;
      const reason = this.level.resourceType === 'time' ? "Time's Up!" : 'Out of Moves';
      const modal = this._buildModalShell(reason, C.DANGER);

      modal.add(this.add.text(0, -50, `Score: ${this.score}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        fontStyle: '600',
        color: C.TEXT
      }).setOrigin(0.5));

      modal.add(this.add.text(0, -22, 'So close — try again!', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5));

      modal.add(new global.FMButton(this, {
        x: 0,
        y: 40,
        width: modal.getData('panelWidth') - 60,
        height: 48,
        label: 'Retry',
        variant: 'primary',
        onClick: () => this.scene.restart({ levelId: this.levelId })
      }));

      modal.add(new global.FMButton(this, {
        x: 0,
        y: 96,
        width: modal.getData('panelWidth') - 60,
        height: 40,
        label: 'Level Select',
        variant: 'ghost',
        fontSize: 14,
        onClick: () => this.scene.start('LevelSelect', { worldId: this.level.worldId })
      }));
    }
  }

  global.GameScene = GameScene;
})(window);
