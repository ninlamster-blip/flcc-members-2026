/**
 * CreditsScene — simple attribution screen.
 */
(function (global) {
  'use strict';

  class CreditsScene extends Phaser.Scene {
    constructor() {
      super('Credits');
    }

    create() {
      const C = global.FM_CONST.COLORS;
      const { width, height } = this.scale;
      this.cameras.main.setBackgroundColor(C.BACKGROUND);

      this.add.text(width / 2, 34, 'Credits', {
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

      const lines = [
        ['FAITH MATCH', '800', 20],
        ['A Scripture Match-3 Journey', '400', 13],
        ['', '400', 20],
        ['Built with Phaser 3', '600', 14],
        ['Game design & development', '400', 12],
        ['', '400', 16],
        ['300 levels across 14 worlds', '400', 12],
        ['tracing the story of Scripture', '400', 12],
        ['from Creation to Revelation.', '400', 12],
        ['', '400', 20],
        ['"Let the word of Christ dwell', '400', 12],
        ['in you richly." — Colossians 3:16', '400', 12]
      ];

      let y = height * 0.32;
      lines.forEach(([text, weight, size]) => {
        if (text) {
          this.add.text(width / 2, y, text, {
            fontFamily: 'Inter, sans-serif',
            fontSize: `${size}px`,
            fontStyle: weight,
            color: weight === '800' ? C.TEXT : C.TEXT_MUTED,
            align: 'center'
          }).setOrigin(0.5);
        }
        y += size + 8;
      });
    }
  }

  global.CreditsScene = CreditsScene;
})(window);
