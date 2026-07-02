/**
 * BootScene — first scene to run. Configures renderer-level settings
 * that must be set before any assets load, then hands off to Preload.
 */
(function (global) {
  'use strict';

  class BootScene extends Phaser.Scene {
    constructor() {
      super('Boot');
    }

    preload() {
      // Nothing to load yet — this scene only exists to guarantee
      // global config runs before PreloadScene starts fetching assets.
    }

    create() {
      this.cameras.main.setBackgroundColor(global.FM_CONST.COLORS.BACKGROUND);
      this.scale.on('resize', this._handleResize, this);
      this.scene.start('Preload');
    }

    _handleResize(gameSize) {
      const cam = this.cameras.main;
      if (cam) cam.setSize(gameSize.width, gameSize.height);
    }
  }

  global.BootScene = BootScene;
})(window);
