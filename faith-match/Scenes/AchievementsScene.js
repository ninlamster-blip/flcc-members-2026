/**
 * AchievementsScene — scrollable list of all achievements with live
 * progress bars, sourced from Utils/Achievements.js evaluated against
 * the current save.
 */
(function (global) {
  'use strict';

  class AchievementsScene extends Phaser.Scene {
    constructor() {
      super('Achievements');
    }

    create() {
      const C = global.FM_CONST.COLORS;
      const { width, height } = this.scale;
      this.cameras.main.setBackgroundColor(C.BACKGROUND);

      this.add.text(width / 2, 34, 'Achievements', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '22px',
        fontStyle: '800',
        color: C.TEXT
      }).setOrigin(0.5);

      const { all } = global.FM_ACHIEVEMENTS.evaluate(global.FM_SAVE.data);
      global.FM_SAVE.save();
      const unlockedCount = all.filter((a) => a.unlocked).length;

      this.add.text(width / 2, 58, `${unlockedCount}/${all.length} unlocked`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '13px',
        color: C.TEXT_MUTED
      }).setOrigin(0.5);

      new global.FMButton(this, {
        x: 50,
        y: 40,
        width: 76,
        height: 40,
        label: '< Menu',
        variant: 'secondary',
        fontSize: 13,
        onClick: () => this.scene.start('Menu')
      });

      const viewTop = 82;
      const viewHeight = height - viewTop - 16;
      const cardWidth = Math.min(370, width - 32);
      const cardHeight = 76;
      const gap = 12;

      const scroll = new global.FMScrollView(this, { x: width / 2, y: viewTop, width: cardWidth + 20, height: viewHeight });

      all.forEach((achievement, i) => {
        const card = this._buildCard(achievement, cardWidth, cardHeight);
        card.setPosition(0, i * (cardHeight + gap));
        scroll.addChild(card);
      });

      scroll.setContentHeight(all.length * (cardHeight + gap));
    }

    _buildCard(achievement, cardWidth, cardHeight) {
      const C = global.FM_CONST.COLORS;
      const container = this.add.container(0, 0);

      const bg = this.add.graphics();
      bg.fillStyle(Phaser.Display.Color.HexStringToColor(C.SURFACE).color, 1);
      bg.fillRoundedRect(-cardWidth / 2, 0, cardWidth, cardHeight, 16);
      bg.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(C.BORDER).color, 1);
      bg.strokeRoundedRect(-cardWidth / 2, 0, cardWidth, cardHeight, 16);
      container.add(bg);

      const badgeColorHex = achievement.unlocked ? global.FM_CONST.COLORS.ACCENT : '#CBD5E1';
      const badge = this.add.circle(-cardWidth / 2 + 32, cardHeight / 2, 22, Phaser.Display.Color.HexStringToColor(badgeColorHex).color);
      container.add(badge);
      if (this.textures.exists(achievement.icon)) {
        container.add(this.add.image(-cardWidth / 2 + 32, cardHeight / 2, achievement.icon).setDisplaySize(24, 24));
      }
      if (!achievement.unlocked) badge.setAlpha(0.5);

      container.add(this.add.text(-cardWidth / 2 + 66, 16, achievement.name, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '14px',
        fontStyle: '700',
        color: achievement.unlocked ? C.TEXT : C.TEXT_MUTED
      }).setOrigin(0, 0.5));

      container.add(this.add.text(-cardWidth / 2 + 66, 34, achievement.description, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '11px',
        color: C.TEXT_MUTED
      }).setOrigin(0, 0.5));

      const barWidth = cardWidth - 66 - 20;
      const barBg = this.add.graphics();
      barBg.fillStyle(Phaser.Display.Color.HexStringToColor(C.BACKGROUND).color, 1);
      barBg.fillRoundedRect(-cardWidth / 2 + 66, 52, barWidth, 8, 4);
      container.add(barBg);

      const pct = Math.max(0, Math.min(1, achievement.progress / achievement.target));
      const barFill = this.add.graphics();
      barFill.fillStyle(Phaser.Display.Color.HexStringToColor(achievement.unlocked ? C.SUCCESS : C.ACCENT).color, 1);
      barFill.fillRoundedRect(-cardWidth / 2 + 66, 52, Math.max(8, barWidth * pct), 8, 4);
      container.add(barFill);

      container.add(this.add.text(cardWidth / 2 - 12, cardHeight / 2, achievement.unlocked ? '✓' : `${achievement.progress}/${achievement.target}`, {
        fontFamily: 'Inter, sans-serif',
        fontSize: achievement.unlocked ? '18px' : '10px',
        fontStyle: '700',
        color: achievement.unlocked ? C.SUCCESS : C.TEXT_MUTED
      }).setOrigin(1, 0.5));

      return container;
    }
  }

  global.AchievementsScene = AchievementsScene;
})(window);
