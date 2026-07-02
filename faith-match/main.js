/**
 * Faith Match — entry point. Boots the Phaser game against #game-container
 * using a responsive RESIZE scale mode so the board re-centers on any
 * device (phone, tablet, desktop) and orientation.
 */
(function () {
  'use strict';

  const config = {
    type: Phaser.AUTO,
    parent: 'game-container',
    backgroundColor: FM_CONST.COLORS.BACKGROUND,
    scale: {
      mode: Phaser.Scale.RESIZE,
      autoCenter: Phaser.Scale.CENTER_BOTH
    },
    fps: {
      target: 60,
      forceSetTimeOut: false
    },
    render: {
      antialias: true,
      roundPixels: true
    },
    scene: [BootScene, PreloadScene, MenuScene, GameScene]
  };

  const game = new Phaser.Game(config);

  function handleOrientation() {
    const lock = document.getElementById('orientation-lock');
    if (!lock) return;
    const isLandscapePhone = window.innerWidth > window.innerHeight && window.innerWidth < 900;
    lock.classList.toggle('fm-hidden', !isLandscapePhone);
  }

  window.addEventListener('resize', handleOrientation);
  window.addEventListener('orientationchange', handleOrientation);
  handleOrientation();

  window.FM_GAME = game;
})();
