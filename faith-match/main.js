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

  // iOS Safari's address/tab bar collapses on the first touch of a
  // session, which changes the on-screen canvas position via the
  // visualViewport, not always via a plain `window resize` event.
  // Phaser's InputManager caches the canvas's bounding rect for hit
  // testing and only recomputes it on scale-manager resize — so if the
  // toolbar collapse doesn't trigger that path, the very first tap is
  // hit-tested against a stale rect and misses; a second tap (after
  // *something* else finally triggers a recompute) works. Explicitly
  // refresh on every visualViewport change so the cached rect can never
  // go stale for more than one frame.
  if (window.visualViewport) {
    const refreshScale = () => { if (game.scale) game.scale.refresh(); };
    window.visualViewport.addEventListener('resize', refreshScale);
    window.visualViewport.addEventListener('scroll', refreshScale);
  }

  window.FM_GAME = game;
})();
