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
      this.challengeKind = data && data.challengeKind ? data.challengeKind : null;
      this.levelId = (data && data.levelId) || 1;
    }

    create() {
      const C = global.FM_CONST.COLORS;
      this.cameras.main.setBackgroundColor(C.BACKGROUND);

      this.level = this.challengeKind
        ? global.LevelManager.getChallengeLevel(this.challengeKind)
        : global.LevelManager.getLevel(this.levelId);
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
      this.levelStartTime = Date.now();
      this.pendingPowerup = null;

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
      this._createPowerupToolbar();

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
      const topMargin = 92;
      const bottomMargin = 76; // leaves room for the powerup toolbar
      const available = Math.min(width - 10, height - topMargin - bottomMargin);
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
      if (bg) bg.setDisplaySize(this.tileSize * 0.98, this.tileSize * 0.98);
      if (icon) icon.setDisplaySize(this.tileSize * 0.5, this.tileSize * 0.5);
    }

    // ---------------------------------------------------------------
    // Textures: badges (tinted rounded squares) + particle/fx primitives
    // ---------------------------------------------------------------

    /**
     * Generates a frosted-glass tile badge per piece/special type: a
     * baked soft drop shadow (layered translucent rounded rects, since
     * canvas Graphics has no true blur), a translucent color fill, a
     * diagonal gradient sheen, a bright specular highlight sliver, and a
     * light glass-edge border. Baked once into a texture (not a runtime
     * shader/FX) so 64+ on-screen tiles stay cheap and hit 60fps.
     */
    _ensureBadgeTextures() {
      const size = 160;
      const allTypes = Object.assign(
        {},
        global.FM_CONST.PIECE_COLORS,
        global.FM_CONST.SPECIAL_COLORS,
        { stone: '#94A3B8' }
      );
      Object.keys(allTypes).forEach((type) => {
        const key = `badge_${type}`;
        if (this.textures.exists(key)) return;
        const g = this.make.graphics({ x: 0, y: 0, add: false });
        this._drawGlassTile(g, size, Phaser.Display.Color.HexStringToColor(allTypes[type]).color);
        g.generateTexture(key, size, size);
        g.destroy();
      });
    }

    _drawGlassTile(g, size, colorInt) {
      const pad = size * 0.1;
      const panel = size - pad * 2;
      const radius = panel * 0.26;

      // Baked soft shadow: stacked translucent rounded rects, growing
      // outward and fading, standing in for a real gaussian blur.
      for (let i = 7; i >= 1; i--) {
        const grow = i * 1.6;
        g.fillStyle(0x0f172a, 0.018 * i);
        g.fillRoundedRect(
          pad - grow * 0.4,
          pad - grow * 0.4 + size * 0.03,
          panel + grow * 0.8,
          panel + grow * 0.8,
          radius + grow * 0.3
        );
      }

      // Frosted translucent color base.
      g.fillStyle(colorInt, 0.58);
      g.fillRoundedRect(pad, pad, panel, panel, radius);

      // Diagonal glass sheen: brighter top, fading toward the bottom.
      g.fillGradientStyle(0xffffff, 0xffffff, colorInt, colorInt, 0.4, 0.14, 0.04, 0);
      g.fillRoundedRect(pad, pad, panel, panel, radius);

      // Bright specular highlight sliver near the top-left.
      g.fillStyle(0xffffff, 0.5);
      g.fillRoundedRect(pad + panel * 0.1, pad + panel * 0.08, panel * 0.5, panel * 0.13, panel * 0.065);

      // Light glass-edge border, plus a faint colored outer rim so the
      // tile still pops against a flat background.
      g.lineStyle(Math.max(1.5, size * 0.012), 0xffffff, 0.55);
      g.strokeRoundedRect(pad, pad, panel, panel, radius);
      g.lineStyle(Math.max(1, size * 0.008), colorInt, 0.4);
      g.strokeRoundedRect(pad - 1.5, pad - 1.5, panel + 3, panel + 3, radius + 1.5);
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

      const bg = this.add.image(0, 0, badgeKey).setDisplaySize(this.tileSize * 0.98, this.tileSize * 0.98);
      const icon = this.add.image(0, 0, iconKey).setDisplaySize(this.tileSize * 0.5, this.tileSize * 0.5);
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

      const back = this._backTarget();
      new global.FMButton(this, {
        x: 42,
        y: 24,
        width: 62,
        height: 32,
        label: this.challengeKind ? '< Back' : '< Levels',
        variant: 'secondary',
        fontSize: 11,
        onClick: () => this.scene.start(back.scene, back.data)
      });

      const resourceLabel = this.level.resourceType === 'time' ? this._formatTime(this.timeLeft) : `Moves: ${this.movesLeft}`;
      this.movesText = this.add.text(width / 2, 20, resourceLabel, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        fontStyle: '700',
        color: C.TEXT
      }).setOrigin(0.5);

      this.scoreText = this.add.text(width / 2, 40, `Score: ${this.score}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5);

      this._createObjectiveHud();

      this.statusText = this.add.text(width / 2, this.scale.height - 68, '', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: C.ACCENT
      }).setOrigin(0.5);
    }

    _createObjectiveHud() {
      const C = global.FM_CONST.COLORS;
      const { width } = this.scale;
      const objectives = this.objectiveTracker.getSummary();
      const rowY = 66;
      const chipWidth = Math.min(150, (width - 16) / objectives.length);
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
          container.add(this.add.circle(-chipWidth / 2 + 13, 0, 11, badgeColor));
          container.add(this.add.image(-chipWidth / 2 + 13, 0, iconKey).setDisplaySize(14, 14));
          iconOffset = 16;
        }

        const text = this.add.text(-chipWidth / 2 + 4 + iconOffset, 0, this._objectiveProgressText(obj), {
          fontFamily: 'Inter, sans-serif',
          fontSize: '11px',
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
      this.highlightTween = null;
    }

    /**
     * Selecting a tile (the first tap of a tap-then-tap-adjacent-tile
     * swap) previously drew only a thin 3px ring, easy to miss entirely
     * under quick/frustrated tapping — which reads as "nothing happened"
     * even though the game is waiting for a second tap. Draw a bolder
     * double ring centered on the Graphics object's own local origin (so
     * scale tweens pulse around the tile's center) and keep it visibly
     * animating the whole time a tile is selected.
     */
    _drawHighlightAt(row, col) {
      const p = this.cellToPixel(row, col);
      const s = this.tileSize * 0.92;
      this.highlight.clear();
      this.highlight.lineStyle(6, 0xffffff, 0.9);
      this.highlight.strokeRoundedRect(-s / 2, -s / 2, s, s, 18);
      this.highlight.lineStyle(3, Phaser.Display.Color.HexStringToColor(global.FM_CONST.COLORS.ACCENT).color, 1);
      this.highlight.strokeRoundedRect(-s / 2, -s / 2, s, s, 18);
      this.highlight.setPosition(p.x, p.y);
      this.highlight.setScale(1);
      this.highlight.setAlpha(1);
      this.highlight.setVisible(true);
      if (this.highlightTween) this.highlightTween.stop();
      this.highlightTween = this.tweens.add({
        targets: this.highlight,
        scale: { from: 1, to: 1.14 },
        alpha: { from: 1, to: 0.5 },
        duration: 420,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });
    }

    // ---------------------------------------------------------------
    // Powerups
    // ---------------------------------------------------------------

    _createPowerupToolbar() {
      const C = global.FM_CONST.COLORS;
      const { width, height } = this.scale;
      const types = ['prayer', 'extra_moves', 'hint', 'shuffle', 'hammer', 'cross_blast'];
      const iconKeys = {
        prayer: 'powerup_prayer',
        extra_moves: 'powerup_extra_moves',
        hint: 'powerup_hint',
        shuffle: 'powerup_shuffle',
        hammer: 'powerup_hammer',
        cross_blast: 'powerup_cross_blast'
      };
      const size = Math.min(46, Math.floor((width - 20) / types.length) - 6);
      const gap = 6;
      const totalW = types.length * size + (types.length - 1) * gap;
      const startX = Math.round(width / 2 - totalW / 2 + size / 2);
      const y = Math.round(height - 38);

      this.powerupButtons = {};
      types.forEach((type, i) => {
        const x = Math.round(startX + i * (size + gap));
        const container = this.add.container(x, y);

        const bg = this.add.circle(0, 0, size / 2, Phaser.Display.Color.HexStringToColor(C.SURFACE).color);
        bg.setStrokeStyle(1.5, Phaser.Display.Color.HexStringToColor(C.BORDER).color);
        container.add(bg);

        const icon = this.add.image(0, 0, iconKeys[type])
          .setDisplaySize(size * 0.5, size * 0.5)
          .setTint(Phaser.Display.Color.HexStringToColor(C.ACCENT).color);
        container.add(icon);

        const badgeBg = this.add.circle(size * 0.32, -size * 0.32, 9, Phaser.Display.Color.HexStringToColor(C.DANGER).color);
        container.add(badgeBg);
        const countText = this.add.text(size * 0.32, -size * 0.32, '0', {
          fontFamily: 'Inter, sans-serif',
          fontSize: '10px',
          fontStyle: '700',
          color: '#FFFFFF'
        }).setOrigin(0.5);
        container.add(countText);

        container.setSize(size, size);
        // Cosmetic only (desktop hover cursor) — actual tap handling goes
        // through _hitPowerupButton in _onPointerDown/_onPointerUp instead,
        // since this hit-test was confirmed broken at devicePixelRatio 3.
        container.setInteractive({
          hitArea: new Phaser.Geom.Rectangle(-size / 2, -size / 2, size, size),
          hitAreaCallback: Phaser.Geom.Rectangle.Contains,
          useHandCursor: true
        });

        this.powerupButtons[type] = { container, countText, bg };
      });

      this._updatePowerupToolbar();
    }

    _updatePowerupToolbar() {
      if (!this.powerupButtons) return;
      const C = global.FM_CONST.COLORS;
      Object.keys(this.powerupButtons).forEach((type) => {
        const { container, countText, bg } = this.powerupButtons[type];
        const count = global.FM_SAVE.data.powerups[type] || 0;
        countText.setText(String(count));
        container.setAlpha(count > 0 ? 1 : 0.4);
        const isPending = this.pendingPowerup === type;
        bg.setStrokeStyle(isPending ? 3 : 1.5, Phaser.Display.Color.HexStringToColor(isPending ? C.ACCENT : C.BORDER).color);
      });
    }

    _usePowerup(type) {
      if (this.isResolving || this.levelEnded) return;
      const count = global.FM_SAVE.data.powerups[type] || 0;
      if (count <= 0) return;

      if (type === 'hammer' || type === 'cross_blast') {
        this.pendingPowerup = this.pendingPowerup === type ? null : type;
        this._updatePowerupToolbar();
        this.statusText.setText(this.pendingPowerup ? 'Tap a tile to target it' : '');
        return;
      }

      this._consumePowerup(type);
      if (type === 'prayer') this._applyPrayerBoost();
      else if (type === 'extra_moves') this._applyExtraMoves();
      else if (type === 'hint') this._showHint();
      else if (type === 'shuffle') this._applyManualShuffle();
    }

    _consumePowerup(type) {
      global.FM_SAVE.data.powerups[type] = Math.max(0, (global.FM_SAVE.data.powerups[type] || 0) - 1);
      global.FM_SAVE.save();
      global.AudioManager.playPowerupUse();
      this._updatePowerupToolbar();
    }

    _applyPrayerBoost() {
      const candidates = [];
      for (let r = 0; r < this.board.rows; r++) {
        for (let c = 0; c < this.board.cols; c++) {
          const tile = this.board.getTile(r, c);
          if (tile && tile.isMatchable && !tile.isSpecial) candidates.push(tile);
        }
      }
      if (candidates.length === 0) return;
      const tile = candidates[Math.floor(Math.random() * candidates.length)];
      tile.specialType = global.FM_CONST.SPECIAL_TYPES.PRAYER_BOMB;
      this._refreshTileVisual(tile);
      this._playSpecialFx(global.FM_CONST.SPECIAL_TYPES.PRAYER_BOMB, tile.row, tile.col);
    }

    _applyExtraMoves() {
      if (this.level.resourceType === 'time') this.timeLeft += 15;
      else this.movesLeft += 5;
      this._updateHud();
    }

    _findHintMove() {
      const board = this.board;
      for (let r = 0; r < board.rows; r++) {
        for (let c = 0; c < board.cols; c++) {
          const tile = board.getTile(r, c);
          if (!tile || !tile.isMatchable) continue;
          if (c + 1 < board.cols && board.canSwap(r, c, r, c + 1)) return [{ row: r, col: c }, { row: r, col: c + 1 }];
          if (r + 1 < board.rows && board.canSwap(r, c, r + 1, c)) return [{ row: r, col: c }, { row: r + 1, col: c }];
        }
      }
      return null;
    }

    _showHint() {
      const move = this._findHintMove();
      if (!move) return;
      move.forEach((cell) => {
        const tile = this.board.getTile(cell.row, cell.col);
        const container = tile && this.spritesById.get(tile.id);
        if (!container) return;
        this.tweens.add({ targets: container, scale: 1.16, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
      });
    }

    _applyManualShuffle() {
      this.isResolving = true;
      this.board.shuffleBoard();
      this.statusText.setText('Board shuffled!');
      this.time.delayedCall(300, () => {
        this._redrawEntireBoard();
        this.statusText.setText('');
        this.isResolving = false;
      });
    }

    /** Hammer (single-tile smash) and Cross Blast (row+column clear) both target a tapped cell while `pendingPowerup` is armed. */
    _applyTargetedPowerup(type, row, col) {
      const tile = this.board.getTile(row, col);
      this.pendingPowerup = null;
      this._updatePowerupToolbar();
      this.statusText.setText('');
      if (!tile) return;

      this._consumePowerup(type);
      this.isResolving = true;
      this.cascadeDepth = 0;

      if (type === 'hammer' && tile.isBlockedStone) {
        tile.blocker = null;
        tile.type = this.level.pieceTypes[Math.floor(Math.random() * this.level.pieceTypes.length)];
        this._refreshTileVisual(tile);
        this._applyResultToObjectives({ clearedCells: [], blockersDamaged: [{ row, col, blocker: 'stone', destroyed: true }] });
        this._playSpecialFx(global.FM_CONST.SPECIAL_TYPES.PRAYER_BOMB, row, col);
        this.isResolving = false;
        this._checkEndState();
        return;
      }

      const originCells =
        type === 'hammer'
          ? [{ row, col }]
          : this.board.specialEffectCells(row, col, global.FM_CONST.SPECIAL_TYPES.LIVING_WATER).concat(
              this.board.specialEffectCells(row, col, global.FM_CONST.SPECIAL_TYPES.SWORD_OF_SPIRIT)
            );

      this._playSpecialFx(type === 'hammer' ? global.FM_CONST.SPECIAL_TYPES.PRAYER_BOMB : global.FM_CONST.SPECIAL_TYPES.LIVING_WATER, row, col);
      if (type === 'cross_blast') this._playSpecialFx(global.FM_CONST.SPECIAL_TYPES.SWORD_OF_SPIRIT, row, col);

      const result = this.board.activateSpecials(originCells, type === 'cross_blast' ? 100 : 0);
      this.score += result.scoreGained;
      this._applyResultToObjectives(result);
      this._updateHud();
      this._playClearSequence(result, () => this._afterClearAnimation(result));
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

    /**
     * Big, screen-filling combo banner for the moments worth celebrating
     * (shape matches, cascades, special activations) — pops in with an
     * overshoot, shakes side to side, then grows and fades out. Only one
     * shows at a time: a fast chain of matches would otherwise stack
     * several huge banners on top of each other.
     */
    _showComboText(text, x, y, colorHex) {
      if (this._activeComboText) {
        this._activeComboText.destroy();
        this._activeComboText = null;
      }
      const generation = (this._comboTextGeneration = (this._comboTextGeneration || 0) + 1);

      const { width, height } = this.scale;
      const centerX = width / 2;
      const centerY = height * 0.4;
      const fontSize = Math.round(Math.min(width * 0.17, height * 0.09, 68));

      const label = this.add.text(centerX, centerY, text.toUpperCase(), {
        fontFamily: '"Luckiest Guy", cursive',
        fontSize: fontSize + 'px',
        color: colorHex || global.FM_CONST.COLORS.ACCENT,
        stroke: '#FFFFFF',
        strokeThickness: Math.max(5, Math.round(fontSize * 0.09)),
        align: 'center',
        wordWrap: { width: width - 32 }
      })
        .setOrigin(0.5)
        .setShadow(0, 3, 'rgba(17,24,39,0.35)', 8, false, true)
        .setScale(0.2)
        .setAlpha(0)
        .setDepth(1000);
      this.fxContainer.add(label);
      this._activeComboText = label;

      this.tweens.add({
        targets: label,
        scale: 1,
        alpha: 1,
        duration: 260,
        ease: 'Back.easeOut',
        onComplete: () => {
          if (this._comboTextGeneration !== generation) return;
          this.tweens.add({
            targets: label,
            angle: { from: -4, to: 4 },
            duration: 65,
            yoyo: true,
            repeat: 3,
            ease: 'Sine.easeInOut',
            onComplete: () => {
              if (this._comboTextGeneration !== generation) return;
              label.setAngle(0);
              this.tweens.add({
                targets: label,
                alpha: 0,
                scale: 1.2,
                delay: 220,
                duration: 320,
                ease: 'Sine.easeIn',
                onComplete: () => {
                  label.destroy();
                  if (this._activeComboText === label) this._activeComboText = null;
                }
              });
            }
          });
        }
      });
    }

    _shakeCamera(depth) {
      const intensity = Math.min(0.012, 0.004 + depth * 0.0018);
      this.cameras.main.shake(120 + depth * 20, intensity);
    }

    /** A shower of colorful confetti across the top of the screen for the win modal. */
    _celebrateWin() {
      const { width } = this.scale;
      const colors = [0xFCD34D, 0xF87171, 0x60A5FA, 0x4ADE80, 0xC084FC, 0xF472B6];
      const emitter = this.add.particles(0, -20, 'fx_dot', {
        x: { min: 0, max: width },
        lifespan: 1700,
        speedY: { min: 90, max: 210 },
        speedX: { min: -50, max: 50 },
        scale: { start: 1, end: 0.5 },
        rotate: { start: 0, end: 360 },
        gravityY: 260,
        tint: colors,
        quantity: 3,
        frequency: 35,
        emitting: true
      });
      emitter.setDepth(2000);
      this.time.delayedCall(1300, () => emitter.stop());
      this.time.delayedCall(2200, () => emitter.destroy());
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

    /**
     * The powerup toolbar circles use Phaser's own setInteractive()
     * hit-test for pointerup, which was confirmed broken at
     * devicePixelRatio 3 (see UI/Button.js) — a tap inside the circle's
     * rectangle can still make scene.input.manager.hitTest() return no
     * match. Hook the toolbar into GameScene's existing scene-wide
     * pointer handling instead, same manual-bounds approach as FMButton.
     */
    _hitPowerupButton(x, y) {
      if (!this.powerupButtons) return null;
      for (const type of Object.keys(this.powerupButtons)) {
        const c = this.powerupButtons[type].container;
        const s = c.scale || 1;
        const halfW = (c.width * s) / 2;
        const halfH = (c.height * s) / 2;
        if (x >= c.x - halfW && x <= c.x + halfW && y >= c.y - halfH && y <= c.y + halfH) return type;
      }
      return null;
    }

    _onPointerDown(pointer) {
      if (this.isResolving || this.levelEnded) return;
      const powerupHit = this._hitPowerupButton(pointer.x, pointer.y);
      if (powerupHit) {
        this._pendingPowerupPress = powerupHit;
        this.dragStart = null;
        return;
      }
      this._pendingPowerupPress = null;
      const cell = this.cellFromPixel(pointer.x, pointer.y);
      if (!cell) return;
      this.dragStart = { row: cell.row, col: cell.col, x: pointer.x, y: pointer.y };
    }

    _onPointerUp(pointer) {
      if (this._pendingPowerupPress) {
        const type = this._pendingPowerupPress;
        this._pendingPowerupPress = null;
        if (!this.isResolving && !this.levelEnded) this._usePowerup(type);
        this.dragStart = null;
        return;
      }
      if (this.isResolving || this.levelEnded || !this.dragStart) {
        this.dragStart = null;
        return;
      }
      const dx = pointer.x - this.dragStart.x;
      const dy = pointer.y - this.dragStart.y;
      const start = { row: this.dragStart.row, col: this.dragStart.col };
      this.dragStart = null;

      if (this.pendingPowerup) {
        this._applyTargetedPowerup(this.pendingPowerup, start.row, start.col);
        return;
      }

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
      if (this.highlightTween) {
        this.highlightTween.stop();
        this.highlightTween = null;
      }
    }

    // ---------------------------------------------------------------
    // Swap + resolution pipeline
    // ---------------------------------------------------------------

    _attemptSwap(r1, c1, r2, c2) {
      if (!this.board.inBounds(r2, c2)) return;
      if (!this.board.canSwap(r1, c1, r2, c2)) {
        this._shakeCell(r1, c1);
        this._shakeCell(r2, c2);
        global.AudioManager.playSwapInvalid();
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
      global.AudioManager.playSpecialActivate();
      global.FM_SAVE.data.stats.specialsActivated++;
      global.FM_SAVE.save();

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
      global.AudioManager.playCombo();
      global.FM_SAVE.data.stats.combosTriggered++;
      global.FM_SAVE.data.stats.specialsActivated += 2;
      global.FM_SAVE.save();

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
      global.AudioManager.playMatch(this.cascadeDepth);

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
        // Daily/Weekly Challenges are best-score attempts, not pass/fail —
        // running out of moves still records the score instead of failing.
        this._endLevel(!!this.challengeKind);
      }
    }

    _backTarget() {
      if (this.challengeKind) return { scene: 'Challenges', data: {} };
      return { scene: 'LevelSelect', data: { worldId: this.level.worldId } };
    }

    _endLevel(won) {
      this.levelEnded = true;
      this._deselect();
      if (this.timerEvent) this.timerEvent.remove();

      if (!won) {
        global.AudioManager.playLose();
        this._showLoseModal();
        return;
      }

      const stars = global.LevelManager.starsForScore(this.level, this.score);
      const elapsedMs = Date.now() - this.levelStartTime;
      let coinsAwarded = 0;
      let xpAwarded = 0;

      if (this.challengeKind === 'daily') {
        coinsAwarded = this._recordDailyChallenge(stars);
      } else if (this.challengeKind === 'weekly') {
        const reward = this._recordWeeklyChallenge();
        coinsAwarded = reward.coins;
        xpAwarded = reward.xp;
      } else {
        const existing = global.FM_SAVE.data.completedLevels[this.levelId];
        const bestScore = Math.max(this.score, existing ? existing.bestScore : 0);
        const bestStars = Math.max(stars, existing ? existing.stars : 0);
        if (!existing) global.FM_SAVE.data.stats.levelsCompleted++;
        global.FM_SAVE.data.stats.totalStarsEarned += Math.max(0, bestStars - (existing ? existing.stars : 0));
        global.FM_SAVE.data.completedLevels[this.levelId] = {
          stars: bestStars,
          bestScore,
          movesUsed: this.level.moveLimit ? this.level.moveLimit - (this.movesLeft || 0) : null,
          completedAt: Date.now()
        };
        this._recordLeaderboardEntry(elapsedMs);
        coinsAwarded = 10 * bestStars;
        xpAwarded = 50 * bestStars;
      }

      if (coinsAwarded) global.FM_SAVE.addCoins(coinsAwarded);
      if (xpAwarded) global.FM_SAVE.addXP(xpAwarded);

      const { newlyUnlocked } = global.FM_ACHIEVEMENTS.evaluate(global.FM_SAVE.data);
      global.FM_SAVE.save();

      global.AudioManager.playWinFanfare();
      if (newlyUnlocked.length) this.time.delayedCall(500, () => global.AudioManager.playAchievement());

      this._showScriptureModal(() => this._showWinModal(stars, coinsAwarded, xpAwarded, newlyUnlocked));
    }

    _recordLeaderboardEntry(elapsedMs) {
      const lb = global.FM_SAVE.data.leaderboard;
      if (this.score > lb.bestScore) lb.bestScore = this.score;
      if (lb.fastestCompletionMs === null || elapsedMs < lb.fastestCompletionMs) lb.fastestCompletionMs = elapsedMs;
      lb.history.unshift({ levelId: this.levelId, worldName: this.level.worldName, score: this.score, moves: this.level.moveLimit ? this.level.moveLimit - (this.movesLeft || 0) : null, timeMs: elapsedMs, date: Date.now() });
      if (lb.history.length > 20) lb.history.length = 20;
    }

    _showScriptureModal(onContinue) {
      const C = global.FM_CONST.COLORS;
      const { width, height } = this.scale;
      const { index, verse } = global.Scripture.pickRandomVerse(global.FM_SAVE.data.seenVerseIds);
      global.FM_SAVE.data.seenVerseIds.push(index);
      if (global.FM_SAVE.data.seenVerseIds.length > 60) global.FM_SAVE.data.seenVerseIds.shift();
      global.FM_SAVE.save();

      // Fractional container positions (odd width/height → width/2 !=
      // integer) make Phaser's hit-testing miss on nested interactive
      // children even though the child's own local x/y is rounded, so
      // every modal root container snaps to whole pixels — see README.
      const modal = this.add.container(Math.round(width / 2), Math.round(height / 2));
      modal.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.4).setOrigin(0.5));

      const panelWidth = Math.min(340, width - 40);
      const panelHeight = Math.min(360, height - 80);
      const panel = this.add.graphics();
      panel.fillStyle(Phaser.Display.Color.HexStringToColor(C.SURFACE).color, 1);
      panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 22);
      modal.add(panel);

      const stripe = this.add.graphics();
      stripe.fillStyle(Phaser.Display.Color.HexStringToColor(global.FM_CONST.WORLD_ACCENTS[this.level.worldId] || C.ACCENT).color, 1);
      stripe.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, 8, { tl: 22, tr: 22, bl: 0, br: 0 });
      modal.add(stripe);

      modal.add(this.add.text(0, -panelHeight / 2 + 30, 'Word for Today', {
        fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: '700', color: C.TEXT_MUTED
      }).setOrigin(0.5));

      modal.add(this.add.text(0, -panelHeight / 2 + 66, `"${verse.text}"`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px',
        fontStyle: '500',
        color: C.TEXT,
        align: 'center',
        wordWrap: { width: panelWidth - 56 }
      }).setOrigin(0.5, 0));

      const refY = -panelHeight / 2 + 66 + this._estimateTextHeight(verse.text, panelWidth - 56, 15) + 16;
      modal.add(this.add.text(0, refY, verse.ref, {
        fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: '700', color: global.FM_CONST.WORLD_ACCENTS[this.level.worldId] || C.ACCENT
      }).setOrigin(0.5));

      modal.add(this.add.text(0, refY + 30, verse.note, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        color: C.TEXT_MUTED,
        align: 'center',
        wordWrap: { width: panelWidth - 56 }
      }).setOrigin(0.5, 0));

      modal.add(new global.FMButton(this, {
        x: 0,
        y: panelHeight / 2 - 42,
        width: panelWidth - 60,
        height: 46,
        label: 'Continue',
        variant: 'primary',
        onClick: () => {
          modal.destroy();
          onContinue();
        }
      }));
    }

    /** Rough single-line-height * line-count estimate for wrapped text, used to stack modal content without a full text-measurement pass. */
    _estimateTextHeight(text, wrapWidth, fontSize) {
      const avgCharWidth = fontSize * 0.52;
      const charsPerLine = Math.max(10, Math.floor(wrapWidth / avgCharWidth));
      const lines = Math.ceil(text.length / charsPerLine);
      return lines * (fontSize * 1.35);
    }

    /** Returns coins awarded: a bigger one-time bonus the first time today's challenge is won, a small bonus for beating a personal best afterward. */
    _recordDailyChallenge(stars) {
      const d = global.FM_SAVE.data.dailyChallenge;
      if (d.dateKey !== this.level.challengeKey) {
        d.dateKey = this.level.challengeKey;
        d.bestScore = 0;
        d.played = false;
      }
      const improved = this.score > d.bestScore;
      if (improved) d.bestScore = this.score;
      if (!d.played) {
        d.played = true;
        return 30 + stars * 15;
      }
      return improved ? 10 : 0;
    }

    /** Returns { coins, xp } awarded once per week, the first time the weekly score threshold is met. */
    _recordWeeklyChallenge() {
      const w = global.FM_SAVE.data.weeklyChallenge;
      if (w.weekKey !== this.level.challengeKey) {
        w.weekKey = this.level.challengeKey;
        w.score = 0;
        w.completed = false;
        w.claimedReward = false;
      }
      if (this.score > w.score) w.score = this.score;
      if (!w.completed && w.score >= this.level.starThresholds[0]) {
        w.completed = true;
        w.claimedReward = true;
        return { coins: 150, xp: 300 };
      }
      return { coins: 0, xp: 0 };
    }

    _buildModalShell(title, accentHex) {
      const { width, height } = this.scale;
      const C = global.FM_CONST.COLORS;
      // See _showScriptureModal above: snap to whole pixels so nested
      // buttons remain tappable.
      const modal = this.add.container(Math.round(width / 2), Math.round(height / 2));

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

    _showWinModal(stars, coinsAwarded, xpAwarded, newlyUnlocked) {
      const C = global.FM_CONST.COLORS;
      const accent = this.challengeKind ? C.ACCENT : global.FM_CONST.WORLD_ACCENTS[this.level.worldId];
      const challengeTitle = this.objectiveTracker.isComplete() ? 'Challenge Complete!' : 'Score Recorded!';
      const modal = this._buildModalShell(this.challengeKind ? challengeTitle : 'Level Complete!', accent);

      if (stars > 0) this._celebrateWin();

      // Stars pop in one at a time with a bounce instead of appearing as
      // a single static line, echoing Candy Crush's level-complete beat.
      for (let i = 0; i < 3; i++) {
        const filled = i < stars;
        const star = this.add.text(-40 + i * 40, -54, filled ? '★' : '☆', {
          fontFamily: 'Inter, sans-serif',
          fontSize: '34px',
          color: accent
        }).setOrigin(0.5).setScale(0);
        modal.add(star);
        if (filled) {
          this.tweens.add({
            targets: star,
            scale: 1,
            delay: 280 + i * 170,
            duration: 320,
            ease: 'Back.easeOut'
          });
        } else {
          star.setScale(1);
        }
      }

      modal.add(this.add.text(0, -8, `Score: ${this.score}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '16px',
        fontStyle: '600',
        color: C.TEXT
      }).setOrigin(0.5));

      const rewardLabel = coinsAwarded || xpAwarded
        ? `+${coinsAwarded} coins   +${xpAwarded} XP`
        : 'Personal best not beaten this time';
      modal.add(this.add.text(0, 18, rewardLabel, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5));

      if (newlyUnlocked && newlyUnlocked.length) {
        modal.add(this.add.text(0, 40, `🏆 ${newlyUnlocked[0].name} unlocked!`, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '12px',
          fontStyle: '700',
          color: C.WARNING
        }).setOrigin(0.5));
      }

      const back = this._backTarget();
      const nextLevelId = this.levelId + 1;
      const hasNext = !this.challengeKind && nextLevelId <= global.FM_CONST.TOTAL_LEVEL_COUNT;
      modal.add(new global.FMButton(this, {
        x: 0,
        y: 78,
        width: modal.getData('panelWidth') - 60,
        height: 48,
        label: hasNext ? 'Next Level' : this.challengeKind ? 'Back to Challenges' : 'Choose World',
        variant: 'primary',
        onClick: () => {
          if (hasNext) this.scene.start('Game', { levelId: nextLevelId });
          else this.scene.start(back.scene, back.data);
        }
      }));

      modal.add(new global.FMButton(this, {
        x: 0,
        y: 132,
        width: modal.getData('panelWidth') - 60,
        height: 40,
        label: this.challengeKind ? 'Menu' : 'Level Select',
        variant: 'ghost',
        fontSize: 14,
        onClick: () => this.scene.start(this.challengeKind ? 'Menu' : back.scene, this.challengeKind ? undefined : back.data)
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

      const back = this._backTarget();
      const restartData = this.challengeKind ? { challengeKind: this.challengeKind } : { levelId: this.levelId };
      modal.add(new global.FMButton(this, {
        x: 0,
        y: 40,
        width: modal.getData('panelWidth') - 60,
        height: 48,
        label: 'Retry',
        variant: 'primary',
        onClick: () => this.scene.start('Game', restartData)
      }));

      modal.add(new global.FMButton(this, {
        x: 0,
        y: 96,
        width: modal.getData('panelWidth') - 60,
        height: 40,
        label: this.challengeKind ? 'Back' : 'Level Select',
        variant: 'ghost',
        fontSize: 14,
        onClick: () => this.scene.start(back.scene, back.data)
      }));
    }
  }

  global.GameScene = GameScene;
})(window);
