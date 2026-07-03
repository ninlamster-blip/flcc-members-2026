/**
 * WorldMapScene — scrollable list of the 14 story worlds. Each card shows
 * completion progress and star total; locked worlds (whose first level
 * hasn't been reached yet) are dimmed and shake instead of opening.
 */
(function (global) {
  'use strict';

  class WorldMapScene extends Phaser.Scene {
    constructor() {
      super('WorldMap');
    }

    create() {
      const C = global.FM_CONST.COLORS;
      const { width, height } = this.scale;
      this.cameras.main.setBackgroundColor(C.BACKGROUND);

      this.add.text(width / 2, 44, 'Choose Your Journey', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '22px',
        fontStyle: '800',
        color: C.TEXT
      }).setOrigin(0.5);

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

      new global.FMButton(this, {
        x: width - 46,
        y: 34,
        width: 60,
        height: 34,
        label: '🏆',
        variant: 'secondary',
        fontSize: 15,
        onClick: () => this.scene.start('Leaderboard')
      });

      global.FMProfileStrip.build(this, 76);

      const viewTop = 104;
      const viewHeight = height - viewTop - 16;
      const cardWidth = Math.min(360, width - 40);
      const cardHeight = 84;
      const gap = 14;

      const scroll = new global.FMScrollView(this, { x: width / 2, y: viewTop, width: cardWidth + 20, height: viewHeight });

      // Cards use manual hit-testing (see _hitWorldCard) instead of
      // Phaser's own per-object hit-test, which was confirmed broken at
      // devicePixelRatio 3 for Container-type GameObjects — a tap
      // unambiguously inside a card's rectangle still made
      // scene.input.manager.hitTest() return zero matches.
      this._worldCards = [];
      this._activeWorldCard = null;
      this.input.on('pointerdown', (pointer) => {
        this._activeWorldCard = this._hitWorldCard(pointer.x, pointer.y, cardWidth, cardHeight);
      });
      this.input.on('pointerup', () => {
        const hit = this._activeWorldCard;
        this._activeWorldCard = null;
        if (hit) this._onWorldCardTap(hit);
      });

      global.FM_CONST.WORLDS.forEach((world, i) => {
        const card = this._buildWorldCard(world, cardWidth, cardHeight);
        const finalY = i * (cardHeight + gap);
        card.setPosition(0, finalY);
        scroll.addChild(card);
        this._worldCards.push(card);

        // Cards pop in one after another instead of all appearing at
        // once — a small, cheap bit of "this screen is alive" motion.
        card.setScale(0.85);
        card.setAlpha(0);
        this.tweens.add({
          targets: card,
          scale: 1,
          alpha: 1,
          delay: Math.min(i, 8) * 45,
          duration: 260,
          ease: 'Back.easeOut'
        });
      });

      scroll.setContentHeight(global.FM_CONST.WORLDS.length * (cardHeight + gap));
    }

    /** Topmost (last-built) card wins, matching normal Z-order click semantics. */
    _hitWorldCard(px, py, cardWidth, cardHeight) {
      const out = WorldMapScene._tmpPoint;
      for (let i = this._worldCards.length - 1; i >= 0; i--) {
        const card = this._worldCards[i];
        card.getWorldTransformMatrix().applyInverse(px, py, out);
        if (out.x >= -cardWidth / 2 && out.x <= cardWidth / 2 && out.y >= 0 && out.y <= cardHeight) return card;
      }
      return null;
    }

    _onWorldCardTap(container) {
      const world = container.getData('world');
      const unlocked = container.getData('unlocked');
      if (unlocked) {
        this.scene.start('LevelSelect', { worldId: world.id });
      } else {
        this.tweens.add({ targets: container, x: { from: -6, to: 6 }, duration: 40, yoyo: true, repeat: 3, onComplete: () => container.setX(0) });
      }
    }

    _buildWorldCard(world, cardWidth, cardHeight) {
      const C = global.FM_CONST.COLORS;
      const accent = Phaser.Display.Color.HexStringToColor(global.FM_CONST.WORLD_ACCENTS[world.id]).color;
      const unlocked = global.LevelManager.isWorldUnlocked(world.id);
      const progress = global.LevelManager.getWorldProgress(world.id);

      const container = this.add.container(0, 0);

      // Unlocked worlds get a soft tint of their own accent color instead
      // of a flat white card, so the map reads as a colorful trail of
      // distinct chapters rather than a plain list.
      const bg = this.add.graphics();
      if (unlocked) {
        bg.fillGradientStyle(0xffffff, 0xffffff, accent, accent, 0.16);
      } else {
        bg.fillStyle(Phaser.Display.Color.HexStringToColor(C.SURFACE).color, 1);
      }
      bg.fillRoundedRect(-cardWidth / 2, 0, cardWidth, cardHeight, 16);
      bg.lineStyle(1.5, unlocked ? accent : Phaser.Display.Color.HexStringToColor(C.BORDER).color, unlocked ? 0.4 : 1);
      bg.strokeRoundedRect(-cardWidth / 2, 0, cardWidth, cardHeight, 16);
      container.add(bg);

      const stripe = this.add.graphics();
      stripe.fillStyle(accent, 1);
      stripe.fillRoundedRect(-cardWidth / 2, 0, 8, cardHeight, { tl: 16, bl: 16, tr: 0, br: 0 });
      container.add(stripe);

      const badge = this.add.graphics();
      badge.fillStyle(accent, unlocked ? 0.15 : 0.08);
      badge.fillRoundedRect(-cardWidth / 2 + 22, cardHeight / 2 - 22, 44, 44, 12);
      container.add(badge);

      const worldNum = this.add.text(-cardWidth / 2 + 44, cardHeight / 2, String(world.id), {
        fontFamily: 'Inter, sans-serif',
        fontSize: '18px',
        fontStyle: '800',
        color: unlocked ? global.FM_CONST.WORLD_ACCENTS[world.id] : C.TEXT_MUTED
      }).setOrigin(0.5);
      container.add(worldNum);

      const title = this.add.text(-cardWidth / 2 + 80, cardHeight / 2 - 16, world.name, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '17px',
        fontStyle: '700',
        color: unlocked ? C.TEXT : C.TEXT_MUTED
      }).setOrigin(0, 0.5);
      container.add(title);

      const subLabel = unlocked
        ? `${progress.completed}/${progress.total} levels  •  ${'★'} ${progress.stars}/${progress.maxStars}`
        : 'Locked — finish the previous world';
      const sub = this.add.text(-cardWidth / 2 + 80, cardHeight / 2 + 12, subLabel, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        color: C.TEXT_MUTED
      }).setOrigin(0, 0.5);
      container.add(sub);

      if (!unlocked) {
        const lock = this.add.text(cardWidth / 2 - 26, cardHeight / 2, '\u{1F512}', {
          fontFamily: 'Inter, sans-serif',
          fontSize: '18px'
        }).setOrigin(0.5);
        container.add(lock);
        container.setAlpha(0.72);
      } else {
        const arrow = this.add.text(cardWidth / 2 - 22, cardHeight / 2, '›', {
          fontFamily: 'Inter, sans-serif',
          fontSize: '22px',
          fontStyle: '700',
          color: C.TEXT_MUTED
        }).setOrigin(0.5);
        container.add(arrow);
      }

      container.setSize(cardWidth, cardHeight);
      // Cosmetic only (desktop hover cursor) — tap handling goes through
      // _hitWorldCard/_onWorldCardTap instead, driven by the scene-wide
      // dispatch installed in create(). See the comment there.
      container.setInteractive({
        useHandCursor: unlocked,
        hitArea: new Phaser.Geom.Rectangle(-cardWidth / 2, 0, cardWidth, cardHeight),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains
      });
      container.setData('world', world);
      container.setData('unlocked', unlocked);

      return container;
    }
  }

  WorldMapScene._tmpPoint = { x: 0, y: 0 };

  global.WorldMapScene = WorldMapScene;
})(window);
