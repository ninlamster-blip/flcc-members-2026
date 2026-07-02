/**
 * FMButton — reusable rounded, shadowed button matching the minimalist
 * Claude/Notion-inspired UI style. Emits a pointerup callback and plays
 * a small press/scale animation for tactile "juice".
 */
(function (global) {
  'use strict';

  class FMButton extends Phaser.GameObjects.Container {
    /**
     * @param {Phaser.Scene} scene
     * @param {object} opts
     * @param {number} opts.x
     * @param {number} opts.y
     * @param {number} [opts.width=220]
     * @param {number} [opts.height=56]
     * @param {string} opts.label
     * @param {'primary'|'secondary'|'ghost'} [opts.variant='primary']
     * @param {function} [opts.onClick]
     * @param {number} [opts.fontSize=18]
     */
    constructor(scene, opts) {
      // Phaser's input hit-testing can miss on sub-pixel container
      // positions (observed with fractional coordinates from width/2,
      // height*factor, etc.), so every interactive element is snapped
      // to whole pixels at construction time.
      super(scene, Math.round(opts.x), Math.round(opts.y));
      this.scene = scene;
      this.width = Math.round(opts.width || 220);
      this.height = Math.round(opts.height || 56);
      this.variant = opts.variant || 'primary';
      this.onClickCallback = opts.onClick || null;
      this.disabled = false;

      const palette = this._palette();

      this.bg = scene.add.graphics();
      this._drawBackground(palette.fill, palette.stroke);
      this.add(this.bg);

      this.label = scene.add
        .text(0, 0, opts.label || '', {
          fontFamily: 'Inter, sans-serif',
          fontSize: (opts.fontSize || 18) + 'px',
          fontStyle: '600',
          color: palette.text
        })
        .setOrigin(0.5);
      this.add(this.label);

      this.setSize(this.width, this.height);
      this.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-this.width / 2, -this.height / 2, this.width, this.height), hitAreaCallback: Phaser.Geom.Rectangle.Contains });

      this.on('pointerover', () => {
        if (this.disabled) return;
        scene.tweens.add({ targets: this, scale: 1.02, duration: 90, ease: 'Sine.easeOut' });
      });
      this.on('pointerout', () => {
        if (this.disabled) return;
        scene.tweens.add({ targets: this, scale: 1, duration: 90, ease: 'Sine.easeOut' });
      });
      this.on('pointerdown', () => {
        if (global.__fmLog) global.__fmLog('[button] "' + (opts.label || '') + '" pointerdown, disabled=' + this.disabled);
        if (this.disabled) return;
        scene.tweens.add({ targets: this, scale: 0.96, duration: 70, ease: 'Sine.easeOut' });
      });
      this.on('pointerup', () => {
        if (global.__fmLog) global.__fmLog('[button] "' + (opts.label || '') + '" pointerup, disabled=' + this.disabled);
        if (this.disabled) return;
        scene.tweens.add({ targets: this, scale: 1, duration: 110, ease: 'Back.easeOut' });
        if (global.AudioManager) global.AudioManager.playTap();
        if (this.onClickCallback) this.onClickCallback();
      });

      scene.add.existing(this);
    }

    _palette() {
      const C = global.FM_CONST.COLORS;
      switch (this.variant) {
        case 'secondary':
          return { fill: 0xffffff, stroke: C.BORDER, text: C.TEXT };
        case 'ghost':
          return { fill: null, stroke: null, text: C.ACCENT };
        default:
          return { fill: 0x2563eb, stroke: null, text: '#FFFFFF' };
      }
    }

    _drawBackground(fillColor, strokeColorHex) {
      const g = this.bg;
      g.clear();
      const r = this.height / 2;
      if (fillColor !== null) {
        g.fillStyle(fillColor, 1);
        g.fillRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, r);
      }
      if (strokeColorHex) {
        g.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(strokeColorHex).color, 1);
        g.strokeRoundedRect(-this.width / 2, -this.height / 2, this.width, this.height, r);
      }
    }

    setDisabled(disabled) {
      this.disabled = disabled;
      this.setAlpha(disabled ? 0.45 : 1);
      return this;
    }

    setLabel(text) {
      this.label.setText(text);
      return this;
    }
  }

  global.FMButton = FMButton;
})(window);
