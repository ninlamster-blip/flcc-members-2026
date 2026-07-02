/**
 * MenuScene — title screen: animated title, profile strip (coins +
 * Faith Level), Play / Daily Challenge / Achievements / Settings /
 * Credits, and an automatic daily-login-reward modal the first time
 * the player opens the menu each day.
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

      global.FMProfileStrip.build(this, 30);

      const title = this.add.text(width / 2, height * 0.28, 'FAITH MATCH', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '38px',
        fontStyle: '800',
        color: C.TEXT,
        letterSpacing: 2
      }).setOrigin(0.5);

      this.tweens.add({
        targets: title,
        y: title.y - 8,
        duration: 1600,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut'
      });

      this.add.text(width / 2, height * 0.28 + 40, 'A Scripture Match-3 Journey', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5);

      new global.FMButton(this, {
        x: width / 2,
        y: height * 0.48,
        width: Math.min(260, width - 60),
        height: 56,
        label: 'Play',
        variant: 'primary',
        onClick: () => this.scene.start('WorldMap')
      });

      const gridWidth = Math.min(260, width - 60);
      const btnW = (gridWidth - 12) / 2;
      const row1Y = height * 0.48 + 66;
      const row2Y = row1Y + 56;

      new global.FMButton(this, {
        x: width / 2 - btnW / 2 - 6,
        y: row1Y,
        width: btnW,
        height: 48,
        label: 'Daily Challenge',
        variant: 'secondary',
        fontSize: 13,
        onClick: () => this.scene.start('Challenges')
      });
      new global.FMButton(this, {
        x: width / 2 + btnW / 2 + 6,
        y: row1Y,
        width: btnW,
        height: 48,
        label: 'Achievements',
        variant: 'secondary',
        fontSize: 13,
        onClick: () => this.scene.start('Achievements')
      });
      new global.FMButton(this, {
        x: width / 2 - btnW / 2 - 6,
        y: row2Y,
        width: btnW,
        height: 48,
        label: 'Settings',
        variant: 'secondary',
        fontSize: 13,
        onClick: () => this.scene.start('Settings')
      });
      new global.FMButton(this, {
        x: width / 2 + btnW / 2 + 6,
        y: row2Y,
        width: btnW,
        height: 48,
        label: 'Credits',
        variant: 'secondary',
        fontSize: 13,
        onClick: () => this.scene.start('Credits')
      });

      this.add.text(width / 2, height - 20, `${global.FM_CONST.TOTAL_LEVEL_COUNT} levels across 14 worlds`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5);

      const status = global.DailyRewards.getStatus(global.FM_SAVE.data);
      if (!status.alreadyClaimedToday) {
        this.time.delayedCall(350, () => this._showDailyRewardModal(status));
      }
    }

    _showDailyRewardModal(status) {
      const C = global.FM_CONST.COLORS;
      const { width, height } = this.scale;
      const modal = this.add.container(width / 2, height / 2);
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
