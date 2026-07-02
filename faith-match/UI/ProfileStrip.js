/**
 * FMProfileStrip — the coins + Faith Level chip pair shown at the top
 * of Menu/WorldMap/LevelSelect. A plain factory (not a persistent
 * component) since these screens are re-created on every scene.start()
 * and always want the freshest save values.
 */
(function (global) {
  'use strict';

  function buildChip(scene, x, y, iconGlyph, iconColorHex, text) {
    const C = global.FM_CONST.COLORS;
    const chip = scene.add.container(x, y);
    const bg = scene.add.graphics();
    bg.fillStyle(Phaser.Display.Color.HexStringToColor(C.SURFACE).color, 1);
    bg.fillRoundedRect(-56, -16, 112, 32, 16);
    bg.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(C.BORDER).color, 1);
    bg.strokeRoundedRect(-56, -16, 112, 32, 16);
    chip.add(bg);
    chip.add(scene.add.circle(-34, 0, 9, Phaser.Display.Color.HexStringToColor(iconColorHex).color));
    chip.add(scene.add.text(-34, 0, iconGlyph, { fontFamily: 'Inter, sans-serif', fontSize: '11px', fontStyle: '800', color: '#FFFFFF' }).setOrigin(0.5));
    chip.add(scene.add.text(4, 0, text, { fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: '700', color: C.TEXT }).setOrigin(0.5));
    return chip;
  }

  /** Adds coins + Faith Level chips to the top-left/top-right of the given scene at the given y. */
  function build(scene, y) {
    const C = global.FM_CONST.COLORS;
    const save = global.FM_SAVE.data;
    const { width } = scene.scale;
    buildChip(scene, 64, y, '$', '#F59E0B', String(save.coins));
    buildChip(scene, width - 64, y, '✦', C.ACCENT, `Lv.${save.faithLevel}`);
  }

  global.FMProfileStrip = { build };
})(window);
