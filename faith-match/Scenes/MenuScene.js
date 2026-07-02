/**
 * MenuScene — placeholder title screen for Phase 1. Full menu (Daily
 * Challenge / Achievements / Settings / Credits, animated title) lands
 * in Phase 4; for now this proves the boot pipeline and gives a way to
 * jump into a test game to validate Board.js end-to-end.
 */
(function (global) {
  'use strict';

  class MenuScene extends Phaser.Scene {
    constructor() {
      super('Menu');
    }

    create() {
      const { width, height } = this.scale;
      const C = global.FM_CONST.COLORS;
      this.cameras.main.setBackgroundColor(C.BACKGROUND);

      const title = this.add.text(width / 2, height * 0.32, 'FAITH MATCH', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '38px',
        fontStyle: '800',
        color: C.TEXT,
        letterSpacing: 2
      }).setOrigin(0.5);

      this.tweens.add({
        targets: title,
        y: title.y - 8,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      this.add.text(width / 2, height * 0.32 + 40, 'A Scripture Match-3 Journey', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5);

      new global.FMButton(this, {
        x: width / 2,
        y: height * 0.55,
        label: 'Play',
        variant: 'primary',
        onClick: () => this.scene.start('WorldMap')
      });

      this.add.text(width / 2, height - 24, `${global.FM_CONST.TOTAL_LEVEL_COUNT} levels across 14 worlds`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5);
    }
  }

  global.MenuScene = MenuScene;
})(window);
