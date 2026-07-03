/**
 * MenuScene — title screen: animated title, profile strip (coins +
 * Faith Level), a big Continue/Play CTA that resumes exactly where the
 * player left off, Daily Challenge / Achievements / Settings / Credits,
 * and an automatic daily-login-reward modal the first time the player
 * opens the menu each day.
 */
(function (global) {
  'use strict';

  class MenuScene extends Phaser.Scene {
    constructor() {
      super('Menu');
    }

    create() {
      const { width, height } = this.scale;
      const C = global.FM_CONST.COLORS;
      this.cameras.main.setBackgroundColor(C.BACKGROUND);

      this._createFloatingBlobs();

      global.FMProfileStrip.build(this, 30);

      const titleGlow = this.add.circle(width / 2, height * 0.28, 110, Phaser.Display.Color.HexStringToColor(C.ACCENT).color, 0.12);
      this.tweens.add({
        targets: titleGlow,
        scale: { from: 0.9, to: 1.15 },
        alpha: { from: 0.16, to: 0.05 },
        duration: 1900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      const title = this.add.text(width / 2, height * 0.28, 'FAITH MATCH', {
        fontFamily: '"Luckiest Guy", cursive',
        fontSize: '40px',
        color: C.ACCENT,
        stroke: '#FFFFFF',
        strokeThickness: 6
      }).setOrigin(0.5).setShadow(0, 3, 'rgba(17,24,39,0.25)', 6, false, true);

      this.tweens.add({
        targets: title,
        y: title.y - 8,
        angle: { from: -2, to: 2 },
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      this.add.text(width / 2, height * 0.28 + 44, 'A Scripture Match-3 Journey', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px',
        fontStyle: '600',
        color: C.TEXT_MUTED
      }).setOrigin(0.5);

      // "Continue" resumes at the first not-yet-completed level (the same
      // definition WorldMap/LevelSelect use for what's unlocked) instead
      // of always dropping the player back at the world map to hunt for
      // where they left off. Brand-new players with no progress yet get
      // a plain "Play" that opens the world map for a first pick.
      const hasProgress = Object.keys(global.FM_SAVE.data.completedLevels).length > 0;
      const nextLevelId = global.LevelManager.getHighestUnlockedLevel();
      const ctaY = height * 0.48;
      const ctaWidth = Math.min(260, width - 60);

      // Soft pulsing glow ring behind the primary CTA draws the eye to
      // it, the same "this is the thing to tap" cue Candy Crush's glowing
      // Play button gives.
      const ctaGlow = this.add.ellipse(width / 2, ctaY, ctaWidth + 20, 76, Phaser.Display.Color.HexStringToColor(C.ACCENT).color, 0.28);
      this.tweens.add({
        targets: ctaGlow,
        scaleX: { from: 1, to: 1.12 },
        scaleY: { from: 1, to: 1.12 },
        alpha: { from: 0.3, to: 0.05 },
        duration: 900,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      const ctaButton = new global.FMButton(this, {
        x: width / 2,
        y: ctaY,
        width: ctaWidth,
        height: 58,
        label: hasProgress ? 'Continue' : 'Play',
        variant: 'primary',
        fontSize: 20,
        onClick: () => {
          if (hasProgress) this.scene.start('Game', { levelId: nextLevelId });
          else this.scene.start('WorldMap');
        }
      });
      // A slow continuous idle bounce on top of FMButton's own tap
      // animation, so the CTA never sits perfectly still.
      this.tweens.add({
        targets: ctaButton,
        scale: { from: 1, to: 1.035 },
        duration: 620,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      if (hasProgress) {
        const worldOfNext = global.FM_CONST.WORLDS.find((w) => nextLevelId >= w.startLevelId && nextLevelId <= w.endLevelId);
        this.add.text(width / 2, ctaY + 40, `Level ${nextLevelId} · ${worldOfNext ? worldOfNext.name : ''}`, {
          fontFamily: 'Inter, sans-serif',
          fontSize: '12px',
          fontStyle: '600',
          color: C.TEXT_MUTED
        }).setOrigin(0.5);

        const chooseLevelLink = this.add.text(width / 2, ctaY + 62, 'or choose a level →', {
          fontFamily: 'Inter, sans-serif',
          fontSize: '12px',
          fontStyle: '700',
          color: C.ACCENT
        }).setOrigin(0.5).setInteractive({ useHandCursor: true });
        // Cosmetic hover only (see UI/Button.js) — click handled manually
        // via the scene-wide pointer trace below, same reasoning as
        // every other interactive element added since the dpr-3 fix.
        chooseLevelLink.on('pointerover', () => chooseLevelLink.setAlpha(0.7));
        chooseLevelLink.on('pointerout', () => chooseLevelLink.setAlpha(1));
        this._chooseLevelLink = chooseLevelLink;
      }

      const gridTop = hasProgress ? ctaY + 92 : ctaY + 66;
      const gridWidth = Math.min(260, width - 60);
      const btnW = (gridWidth - 12) / 2;
      const row1Y = gridTop;
      const row2Y = row1Y + 56;

      const gridButtons = [
        { label: 'Daily Challenge', icon: '🎯', scene: 'Challenges', x: width / 2 - btnW / 2 - 6, y: row1Y },
        { label: 'Achievements', icon: '🏆', scene: 'Achievements', x: width / 2 + btnW / 2 + 6, y: row1Y },
        { label: 'Settings', icon: '⚙️', scene: 'Settings', x: width / 2 - btnW / 2 - 6, y: row2Y },
        { label: 'Credits', icon: '✦', scene: 'Credits', x: width / 2 + btnW / 2 + 6, y: row2Y }
      ];
      gridButtons.forEach((g) => {
        new global.FMButton(this, {
          x: g.x,
          y: g.y,
          width: btnW,
          height: 48,
          label: `${g.icon}  ${g.label}`,
          variant: 'secondary',
          fontSize: 13,
          onClick: () => this.scene.start(g.scene)
        });
      });

      this.add.text(width / 2, height - 20, `${global.FM_CONST.TOTAL_LEVEL_COUNT} levels across 14 worlds`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5);

      // The "choose a level" link is manually hit-tested here (rather
      // than relying on Phaser's own per-object hit-test, confirmed
      // broken at devicePixelRatio 3 — see UI/Button.js) since it isn't
      // an FMButton.
      this.input.on('pointerup', (pointer) => {
        if (!this._chooseLevelLink) return;
        const b = this._chooseLevelLink.getBounds();
        if (pointer.x >= b.x && pointer.x <= b.x + b.width && pointer.y >= b.y && pointer.y <= b.y + b.height) {
          this.scene.start('WorldMap');
        }
      });

      const status = global.DailyRewards.getStatus(global.FM_SAVE.data);
      if (!status.alreadyClaimedToday) {
        this.time.delayedCall(350, () => this._showDailyRewardModal(status));
      }
    }

    /**
     * A handful of large, very-low-opacity colored circles drifting
     * slowly across the background — cheap, subtle "the screen is alive"
     * motion behind the UI without competing with it for attention.
     */
    _createFloatingBlobs() {
      const { width, height } = this.scale;
      const accents = Object.values(global.FM_CONST.WORLD_ACCENTS);
      const blobs = [
        { x: width * 0.15, y: height * 0.12, r: 90 },
        { x: width * 0.88, y: height * 0.2, r: 70 },
        { x: width * 0.1, y: height * 0.85, r: 110 },
        { x: width * 0.85, y: height * 0.78, r: 80 }
      ];
      blobs.forEach((b, i) => {
        const color = Phaser.Display.Color.HexStringToColor(accents[i % accents.length]).color;
        const blob = this.add.circle(b.x, b.y, b.r, color, 0.07);
        this.tweens.add({
          targets: blob,
          x: b.x + (i % 2 === 0 ? 24 : -24),
          y: b.y + (i % 2 === 0 ? -18 : 18),
          duration: 5200 + i * 700,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut'
        });
      });
    }

    _showDailyRewardModal(status) {
      const C = global.FM_CONST.COLORS;
      const { width, height } = this.scale;
      // Fractional container positions break Phaser's hit-testing for
      // nested interactive children (see faith-match/README.md), so the
      // modal root snaps to whole pixels even though width/height may be odd.
      const modal = this.add.container(Math.round(width / 2), Math.round(height / 2));
      modal.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.4).setOrigin(0.5));

      const panelWidth = Math.min(340, width - 48);
      const panelHeight = 300;
      const panel = this.add.graphics();
      panel.fillStyle(Phaser.Display.Color.HexStringToColor(C.SURFACE).color, 1);
      panel.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, panelHeight, 22);
      modal.add(panel);

      const stripe = this.add.graphics();
      stripe.fillStyle(Phaser.Display.Color.HexStringToColor(C.ACCENT).color, 1);
      stripe.fillRoundedRect(-panelWidth / 2, -panelHeight / 2, panelWidth, 8, { tl: 22, tr: 22, bl: 0, br: 0 });
      modal.add(stripe);

      modal.add(this.add.text(0, -panelHeight / 2 + 32, 'Daily Reward', {
        fontFamily: 'Inter, sans-serif', fontSize: '20px', fontStyle: '800', color: C.TEXT
      }).setOrigin(0.5));

      modal.add(this.add.text(0, -panelHeight / 2 + 56, `Day ${status.cycleDay} of your streak`, {
        fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.TEXT_MUTED
      }).setOrigin(0.5));

      const slotSize = 38;
      const gap = 6;
      const totalW = slotSize * 7 + gap * 6;
      const startX = -totalW / 2 + slotSize / 2;
      global.DailyRewards.REWARD_TABLE.forEach((entry, i) => {
        const x = startX + i * (slotSize + gap);
        const y = -20;
        const isToday = entry.day === status.cycleDay;
        const g = this.add.graphics();
        const fillColor = isToday
          ? Phaser.Display.Color.HexStringToColor(C.ACCENT).color
          : Phaser.Display.Color.HexStringToColor(C.BACKGROUND).color;
        g.fillStyle(fillColor, 1);
        g.fillRoundedRect(x - slotSize / 2, y - slotSize / 2, slotSize, slotSize, 10);
        if (!isToday) {
          g.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(C.BORDER).color, 1);
          g.strokeRoundedRect(x - slotSize / 2, y - slotSize / 2, slotSize, slotSize, 10);
        }
        modal.add(g);
        modal.add(this.add.text(x, y - 6, String(entry.coins), {
          fontFamily: 'Inter, sans-serif', fontSize: '11px', fontStyle: '700', color: isToday ? '#FFFFFF' : C.TEXT
        }).setOrigin(0.5));
        modal.add(this.add.text(x, y + 10, entry.powerup ? '★' : '', {
          fontFamily: 'Inter, sans-serif', fontSize: '10px', color: isToday ? '#FFFFFF' : C.WARNING
        }).setOrigin(0.5));
      });

      const reward = status.reward;
      const rewardLine = reward.powerup
        ? `+${reward.coins} coins + ${reward.powerup.qty} ${reward.powerup.type.replace('_', ' ')}`
        : `+${reward.coins} coins`;
      modal.add(this.add.text(0, 34, rewardLine, {
        fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: '600', color: C.TEXT
      }).setOrigin(0.5));

      modal.add(new global.FMButton(this, {
        x: 0,
        y: panelHeight / 2 - 46,
        width: panelWidth - 60,
        height: 46,
        label: 'Claim',
        variant: 'primary',
        onClick: () => {
          global.DailyRewards.claim();
          modal.destroy();
          this.scene.start('Menu');
        }
      }));
    }
  }

  global.MenuScene = MenuScene;
})(window);
