/**
 * FMButton — reusable rounded, shadowed button matching the minimalist
 * Claude/Notion-inspired UI style. Emits a pointerup callback and plays
 * a small press/scale animation for tactile "juice".
 *
 * Click/tap handling deliberately does NOT rely on Phaser's own
 * per-object hit-test (setInteractive + hitArea). That path was
 * confirmed broken at devicePixelRatio 3 (real iPhones): a tap
 * unambiguously inside a button's rectangle still made
 * `scene.input.manager.hitTest()` return zero matches, while the
 * scene-wide pointerdown/pointerup coordinates were correct the whole
 * time. So instead, every scene gets a single shared pointerdown/up
 * listener (installed lazily below) that manually checks tap position
 * against each live button's own bounds — bypassing Phaser's hit-test
 * entirely for the part that actually has to work reliably.
 * setInteractive() is kept only for the cosmetic desktop hover cursor.
 */
(function (global) {
  'use strict';

  function ensureSceneButtonDispatch(scene) {
    if (scene.__fmButtonDispatchInstalled) return;
    scene.__fmButtonDispatchInstalled = true;
    scene.__fmButtons = [];
    scene.__fmActiveButton = null;

    scene.input.on('pointerdown', (pointer) => {
      const list = scene.__fmButtons;
      for (let i = list.length - 1; i >= 0; i--) {
        const btn = list[i];
        if (!btn || !btn.active || btn.disabled) continue;
        if (btn._containsPoint(pointer.x, pointer.y)) {
          scene.__fmActiveButton = btn;
          btn._onManualPress();
          return;
        }
      }
    });

    scene.input.on('pointerup', () => {
      const btn = scene.__fmActiveButton;
      scene.__fmActiveButton = null;
      if (btn && btn.active && !btn.disabled) btn._onManualRelease();
    });

    scene.events.once('shutdown', () => {
      scene.__fmButtons = [];
      scene.__fmActiveButton = null;
      scene.__fmButtonDispatchInstalled = false;
    });
  }

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
      // Cosmetic only (desktop hover cursor) — click handling below does
      // not depend on this hit-test succeeding. See class comment.
      this.setInteractive({ useHandCursor: true, hitArea: new Phaser.Geom.Rectangle(-this.width / 2, -this.height / 2, this.width, this.height), hitAreaCallback: Phaser.Geom.Rectangle.Contains });

      this.on('pointerover', () => {
        if (this.disabled) return;
        scene.tweens.add({ targets: this, scale: 1.02, duration: 90, ease: 'Sine.easeOut' });
      });
      this.on('pointerout', () => {
        if (this.disabled) return;
        scene.tweens.add({ targets: this, scale: 1, duration: 90, ease: 'Sine.easeOut' });
      });

      this._label = opts.label || '';
      ensureSceneButtonDispatch(scene);
      scene.__fmButtons.push(this);
      this.once('destroy', () => {
        const idx = scene.__fmButtons.indexOf(this);
        if (idx !== -1) scene.__fmButtons.splice(idx, 1);
        if (scene.__fmActiveButton === this) scene.__fmActiveButton = null;
      });

      scene.add.existing(this);
    }

    /**
     * px/py are world/scene coordinates (from Phaser's Pointer), but
     * this.x/this.y are LOCAL coordinates relative to this button's own
     * parent (e.g. a modal container) — comparing them directly is only
     * correct for buttons with no parent offset. Use the button's own
     * world transform matrix instead so nested buttons (every modal's
     * Continue/Next Level/Cancel/etc.) are hit-tested correctly too.
     */
    _containsPoint(px, py) {
      const m = this.getWorldTransformMatrix();
      const out = FMButton._tmpPoint;
      m.applyInverse(px, py, out);
      const halfW = this.width / 2;
      const halfH = this.height / 2;
      return out.x >= -halfW && out.x <= halfW && out.y >= -halfH && out.y <= halfH;
    }

    _onManualPress() {
      if (global.__fmLog) global.__fmLog('[button] "' + this._label + '" pressed');
      this.scene.tweens.add({ targets: this, scale: 0.96, duration: 70, ease: 'Sine.easeOut' });
    }

    _onManualRelease() {
      if (global.__fmLog) global.__fmLog('[button] "' + this._label + '" released');
      this.scene.tweens.add({ targets: this, scale: 1, duration: 110, ease: 'Back.easeOut' });
      if (global.AudioManager) global.AudioManager.playTap();
      if (this.onClickCallback) this.onClickCallback();
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

  FMButton._tmpPoint = { x: 0, y: 0 };

  global.FMButton = FMButton;
})(window);
