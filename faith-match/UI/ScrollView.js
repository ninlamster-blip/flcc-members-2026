/**
 * FMScrollView — minimal drag-to-scroll vertical list container, shared
 * by WorldMapScene and LevelSelectScene. `x` is the horizontal center of
 * the viewport, `y` is its top edge; children are added via addChild()
 * relative to that top-left origin.
 */
(function (global) {
  'use strict';

  class FMScrollView extends Phaser.GameObjects.Container {
    constructor(scene, opts) {
      // See UI/Button.js — fractional container positions can make
      // Phaser's input hit-testing miss entirely, so snap to whole pixels.
      super(scene, Math.round(opts.x), Math.round(opts.y));
      this.scene = scene;
      this.viewWidth = opts.width;
      this.viewHeight = opts.height;

      this.content = scene.add.container(0, 0);
      this.add(this.content);
      scene.add.existing(this);

      this.maskGfx = scene.make.graphics({ x: 0, y: 0, add: false });
      this._redrawMask();
      this.content.setMask(this.maskGfx.createGeometryMask());

      this.minY = 0;
      this.maxY = 0;

      // Added *behind* content (index 0) so card/node click handlers on
      // top of it still receive their own pointer events; only empty
      // space within the viewport falls through to this drag handler.
      const hitZone = scene.add.zone(0, 0, this.viewWidth, this.viewHeight).setOrigin(0.5, 0);
      hitZone.setInteractive();
      this.addAt(hitZone, 0);

      this._dragStartPointerY = null;
      this._dragStartContentY = null;

      hitZone.on('pointerdown', (pointer) => {
        this._dragStartPointerY = pointer.y;
        this._dragStartContentY = this.content.y;
      });
      scene.input.on('pointermove', (pointer) => {
        if (this._dragStartPointerY === null || !pointer.isDown) return;
        const dy = pointer.y - this._dragStartPointerY;
        this.content.y = Phaser.Math.Clamp(this._dragStartContentY + dy, this.minY, this.maxY);
      });
      scene.input.on('pointerup', () => {
        this._dragStartPointerY = null;
      });
    }

    _redrawMask() {
      this.maskGfx.clear();
      this.maskGfx.fillStyle(0xffffff);
      this.maskGfx.fillRect(this.x - this.viewWidth / 2, this.y, this.viewWidth, this.viewHeight);
    }

    /** Call after populating content so drag bounds are correct. */
    setContentHeight(contentHeight) {
      this.maxY = 0;
      this.minY = Math.min(0, this.viewHeight - contentHeight);
    }

    addChild(gameObject) {
      this.content.add(gameObject);
      return gameObject;
    }
  }

  global.FMScrollView = FMScrollView;
})(window);
