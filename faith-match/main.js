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
    scene: [
      BootScene,
      PreloadScene,
      MenuScene,
      WorldMapScene,
      LevelSelectScene,
      ChallengesScene,
      AchievementsScene,
      SettingsScene,
      CreditsScene,
      LeaderboardScene,
      GameScene
    ]
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

  // Browsers require a user gesture before audio can start; unlock on
  // the very first tap/click anywhere and never again after that.
  const unlockAudioOnce = () => {
    AudioManager.ensureUnlocked();
    AudioManager.startAmbientMusic();
    window.removeEventListener('pointerdown', unlockAudioOnce);
  };
  window.addEventListener('pointerdown', unlockAudioOnce);

  window.FM_GAME = game;

  // --- Temporary diagnostic instrumentation (see index.html #fm-debug-log) ---
  if (typeof window.__fmLog === 'function') {
    const fmLog = window.__fmLog;
    game.events.once('ready', () => {
      const canvas = game.canvas;
      if (!canvas) {
        fmLog('[canvas] NOT FOUND after ready');
        return;
      }
      fmLog('[canvas] found, size ' + canvas.width + 'x' + canvas.height);
      canvas.addEventListener('touchstart', () => fmLog('[canvas] touchstart'), { passive: true });
      canvas.addEventListener('touchend', () => fmLog('[canvas] touchend'), { passive: true });
    });
  }
})();
