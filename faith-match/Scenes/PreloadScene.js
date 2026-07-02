/**
 * PreloadScene — loads all SVG piece icons (rasterized at a fixed size)
 * and shows a minimalist progress bar consistent with the Claude/Notion
 * inspired visual style. Hands off to MenuScene when done.
 */
(function (global) {
  'use strict';

  const ICON_KEYS = [
    'bible', 'cross', 'fish', 'lamp', 'scroll', 'bread', 'grapes', 'dove',
    'prayer_bomb', 'living_water', 'sword_of_spirit', 'pentecost_flame', 'armor_of_god',
    'stone', 'fog'
  ];

  class PreloadScene extends Phaser.Scene {
    constructor() {
      super('Preload');
    }

    preload() {
      const { width, height } = this.scale;
      const C = global.FM_CONST.COLORS;

      this.add.text(width / 2, height / 2 - 70, 'Faith Match', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '30px',
        fontStyle: '700',
        color: C.TEXT
      }).setOrigin(0.5);

      const barWidth = Math.min(280, width * 0.6);
      const barHeight = 8;
      const barX = width / 2 - barWidth / 2;
      const barY = height / 2;

      const track = this.add.graphics();
      track.fillStyle(Phaser.Display.Color.HexStringToColor(C.BORDER).color, 1);
      track.fillRoundedRect(barX, barY, barWidth, barHeight, barHeight / 2);

      const fill = this.add.graphics();

      this.load.on('progress', (value) => {
        fill.clear();
        fill.fillStyle(Phaser.Display.Color.HexStringToColor(C.ACCENT).color, 1);
        fill.fillRoundedRect(barX, barY, Math.max(barHeight, barWidth * value), barHeight, barHeight / 2);
      });

      ICON_KEYS.forEach((key) => {
        this.load.svg(key, `Assets/icons/${key}.svg`, { width: 128, height: 128 });
      });
    }

    create() {
      this.scene.start('Menu');
    }
  }

  global.PreloadScene = PreloadScene;
})(window);
