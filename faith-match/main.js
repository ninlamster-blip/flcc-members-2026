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
  // Ambient background music does NOT auto-start here — it felt too
  // hypnotic/droning in testing. Sound effects (taps, matches, win
  // fanfare, etc.) are unaffected. A player can still turn ambient
  // music on manually from Settings if they want it.
  const unlockAudioOnce = () => {
    AudioManager.ensureUnlocked();
    window.removeEventListener('pointerdown', unlockAudioOnce);
  };
  window.addEventListener('pointerdown', unlockAudioOnce);

  window.FM_GAME = game;
})();
