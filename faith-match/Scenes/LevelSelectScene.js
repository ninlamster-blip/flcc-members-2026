/**
 * LevelSelectScene — scrollable grid of level nodes for one world. Each
 * node shows its level number (or star rating once completed), a small
 * badge hinting at the level's primary objective, and a lock overlay if
 * not yet reachable.
 */
(function (global) {
  'use strict';

  const COLS = 4;
  const NODE_SIZE = 64;
  const NODE_GAP = 18;

  class LevelSelectScene extends Phaser.Scene {
    constructor() {
      super('LevelSelect');
    }

    init(data) {
      this.worldId = (data && data.worldId) || 1;
    }

    create() {
      const C = global.FM_CONST.COLORS;
      const { width, height } = this.scale;
      this.cameras.main.setBackgroundColor(C.BACKGROUND);
      const world = global.FM_CONST.WORLDS.find((w) => w.id === this.worldId);
      const accentHex = global.FM_CONST.WORLD_ACCENTS[world.id];

      this.add.text(width / 2, 34, world.name, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '22px',
        fontStyle: '800',
        color: C.TEXT
      }).setOrigin(0.5);

      const progress = global.LevelManager.getWorldProgress(world.id);
      this.add.text(width / 2, 60, `${progress.completed}/${progress.total} levels complete`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5);

      new global.FMButton(this, {
        x: 50,
        y: 40,
        width: 76,
        height: 40,
        label: '< Worlds',
        variant: 'secondary',
        fontSize: 13,
        onClick: () => this.scene.start('WorldMap')
      });

      const viewTop = 92;
      const viewHeight = height - viewTop - 16;
      const gridWidth = COLS * NODE_SIZE + (COLS - 1) * NODE_GAP;
      const viewWidth = Math.min(width - 24, gridWidth + 40);

      const scroll = new global.FMScrollView(this, { x: width / 2, y: viewTop, width: viewWidth, height: viewHeight });

      const levelIds = [];
      for (let id = world.startLevelId; id <= world.endLevelId; id++) levelIds.push(id);

      const rows = Math.ceil(levelIds.length / COLS);
      const gridLeft = -(gridWidth / 2) + NODE_SIZE / 2;

      levelIds.forEach((levelId, i) => {
        const row = Math.floor(i / COLS);
        const col = i % COLS;
        const node = this._buildLevelNode(levelId, accentHex);
        node.setPosition(gridLeft + col * (NODE_SIZE + NODE_GAP), row * (NODE_SIZE + NODE_GAP) + NODE_SIZE / 2);
        scroll.addChild(node);
      });

      scroll.setContentHeight(rows * (NODE_SIZE + NODE_GAP));
    }

    _buildLevelNode(levelId, accentHex) {
      const C = global.FM_CONST.COLORS;
      const unlocked = global.LevelManager.isLevelUnlocked(levelId);
      const completedEntry = global.FM_SAVE.data.completedLevels[levelId];
      const level = global.LevelManager.getLevel(levelId);
      const accent = Phaser.Display.Color.HexStringToColor(accentHex).color;

      const container = this.add.container(0, 0);

      const circle = this.add.graphics();
      if (completedEntry) {
        circle.fillStyle(accent, 1);
      } else if (unlocked) {
        circle.fillStyle(Phaser.Display.Color.HexStringToColor(C.SURFACE).color, 1);
        circle.lineStyle(2, accent, 1);
      } else {
        circle.fillStyle(Phaser.Display.Color.HexStringToColor(C.BORDER).color, 1);
      }
      circle.fillCircle(0, 0, NODE_SIZE / 2);
      if (unlocked && !completedEntry) circle.strokeCircle(0, 0, NODE_SIZE / 2);
      container.add(circle);

      if (completedEntry) {
        const stars = '★'.repeat(completedEntry.stars) + '☆'.repeat(3 - completedEntry.stars);
        container.add(this.add.text(0, -6, String(levelId), {
          fontFamily: 'Inter, sans-serif', fontSize: '16px', fontStyle: '800', color: '#FFFFFF'
        }).setOrigin(0.5));
        container.add(this.add.text(0, 14, stars, {
          fontFamily: 'Inter, sans-serif', fontSize: '10px', color: '#FFFFFF'
        }).setOrigin(0.5));
      } else if (unlocked) {
        container.add(this.add.text(0, 0, String(levelId), {
          fontFamily: 'Inter, sans-serif', fontSize: '18px', fontStyle: '800', color: C.TEXT
        }).setOrigin(0.5));

        // Small badge hinting at this level's primary objective.
        const primary = level.objectives[0];
        const badgeIconKey = primary.type === global.FM_CONST.OBJECTIVE_TYPES.COLLECT
          ? primary.pieceType
          : primary.type === global.FM_CONST.OBJECTIVE_TYPES.BREAK_STONE
            ? 'stone'
            : primary.type === global.FM_CONST.OBJECTIVE_TYPES.CLEAR_FOG
              ? 'fog'
              : null;
        if (badgeIconKey && this.textures.exists(badgeIconKey)) {
          const badgeBg = this.add.circle(NODE_SIZE / 2 - 8, -NODE_SIZE / 2 + 8, 11, accent);
          container.add(badgeBg);
          const badgeIcon = this.add.image(NODE_SIZE / 2 - 8, -NODE_SIZE / 2 + 8, badgeIconKey).setDisplaySize(14, 14);
          container.add(badgeIcon);
        }
        if (level.resourceType === 'time') {
          container.add(this.add.text(NODE_SIZE / 2 - 8, NODE_SIZE / 2 - 8, '⏱', {
            fontFamily: 'Inter, sans-serif', fontSize: '13px'
          }).setOrigin(0.5));
        }
      } else {
        container.add(this.add.text(0, 0, '\u{1F512}', {
          fontFamily: 'Inter, sans-serif', fontSize: '16px'
        }).setOrigin(0.5));
      }

      container.setSize(NODE_SIZE, NODE_SIZE);
      container.setInteractive({
        useHandCursor: unlocked,
        hitArea: new Phaser.Geom.Rectangle(-NODE_SIZE / 2, -NODE_SIZE / 2, NODE_SIZE, NODE_SIZE),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains
      });
      container.on('pointerup', () => {
        if (unlocked) {
          this.scene.start('Game', { levelId });
        } else {
          this.tweens.add({ targets: container, scale: { from: 1, to: 0.9 }, duration: 60, yoyo: true });
        }
      });

      return container;
    }
  }

  global.LevelSelectScene = LevelSelectScene;
})(window);
