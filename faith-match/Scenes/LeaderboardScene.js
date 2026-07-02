/**
 * LeaderboardScene — local (per-device) leaderboard: best score, fastest
 * level completion, highest Faith Level reached, plus a scrollable
 * history of recent level completions. No backend — everything reads
 * straight from SaveManager's `leaderboard` block.
 */
(function (global) {
  'use strict';

  class LeaderboardScene extends Phaser.Scene {
    constructor() {
      super('Leaderboard');
    }

    create() {
      const C = global.FM_CONST.COLORS;
      const { width, height } = this.scale;
      this.cameras.main.setBackgroundColor(C.BACKGROUND);

      this.add.text(width / 2, 34, 'Leaderboard', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '22px',
        fontStyle: '800',
        color: C.TEXT
      }).setOrigin(0.5);

      new global.FMButton(this, {
        x: 50,
        y: 40,
        width: 76,
        height: 40,
        label: '< Menu',
        variant: 'secondary',
        fontSize: 13,
        onClick: () => this.scene.start(this._cameFrom || 'WorldMap')
      });

      const lb = global.FM_SAVE.data.leaderboard;
      const statsY = 92;
      const statW = Math.min(360, width - 32);
      this._buildStatRow(width / 2, statsY, statW);

      const viewTop = statsY + 78;
      const viewHeight = height - viewTop - 16;
      const rowWidth = Math.min(370, width - 32);
      const rowHeight = 56;
      const gap = 10;

      if (lb.history.length === 0) {
        this.add.text(width / 2, viewTop + 30, 'No completed levels yet — play a level to appear here!', {
          fontFamily: 'Inter, sans-serif',
          fontSize: '13px',
          color: C.TEXT_MUTED,
          align: 'center',
          wordWrap: { width: rowWidth }
        }).setOrigin(0.5, 0);
        return;
      }

      const scroll = new global.FMScrollView(this, { x: width / 2, y: viewTop, width: rowWidth + 20, height: viewHeight });
      lb.history.forEach((entry, i) => {
        const row = this._buildHistoryRow(entry, rowWidth, rowHeight);
        row.setPosition(0, i * (rowHeight + gap));
        scroll.addChild(row);
      });
      scroll.setContentHeight(lb.history.length * (rowHeight + gap));
    }

    _buildStatRow(x, y, totalWidth) {
      const C = global.FM_CONST.COLORS;
      const lb = global.FM_SAVE.data.leaderboard;
      const chipW = (totalWidth - 16) / 3;
      const stats = [
        { label: 'Best Score', value: String(lb.bestScore) },
        { label: 'Fastest Win', value: lb.fastestCompletionMs ? this._formatMs(lb.fastestCompletionMs) : '—' },
        { label: 'Faith Level', value: String(lb.highestFaithLevel) }
      ];

      stats.forEach((stat, i) => {
        const cx = x - totalWidth / 2 + chipW / 2 + i * (chipW + 8);
        const bg = this.add.graphics();
        bg.fillStyle(Phaser.Display.Color.HexStringToColor(C.SURFACE).color, 1);
        bg.fillRoundedRect(cx - chipW / 2, y, chipW, 62, 14);
        bg.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(C.BORDER).color, 1);
        bg.strokeRoundedRect(cx - chipW / 2, y, chipW, 62, 14);

        this.add.text(cx, y + 22, stat.value, {
          fontFamily: 'Inter, sans-serif', fontSize: '17px', fontStyle: '800', color: C.ACCENT
        }).setOrigin(0.5);
        this.add.text(cx, y + 46, stat.label, {
          fontFamily: 'Inter, sans-serif', fontSize: '10px', color: C.TEXT_MUTED
        }).setOrigin(0.5);
      });
    }

    _buildHistoryRow(entry, width, height) {
      const C = global.FM_CONST.COLORS;
      const container = this.add.container(0, 0);

      const bg = this.add.graphics();
      bg.fillStyle(Phaser.Display.Color.HexStringToColor(C.SURFACE).color, 1);
      bg.fillRoundedRect(-width / 2, 0, width, height, 14);
      bg.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(C.BORDER).color, 1);
      bg.strokeRoundedRect(-width / 2, 0, width, height, 14);
      container.add(bg);

      container.add(this.add.text(-width / 2 + 16, height / 2 - 14, `${entry.worldName} — Level ${entry.levelId}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '13px', fontStyle: '700', color: C.TEXT
      }).setOrigin(0, 0.5));

      const dateStr = new Date(entry.date).toLocaleDateString();
      container.add(this.add.text(-width / 2 + 16, height / 2 + 10, `Score ${entry.score} · ${this._formatMs(entry.timeMs)} · ${dateStr}`, {
        fontFamily: 'Inter, sans-serif', fontSize: '11px', color: C.TEXT_MUTED
      }).setOrigin(0, 0.5));

      return container;
    }

    _formatMs(ms) {
      const totalSeconds = Math.round(ms / 1000);
      const m = Math.floor(totalSeconds / 60);
      const s = totalSeconds % 60;
      return `${m}:${s < 10 ? '0' : ''}${s}`;
    }
  }

  global.LeaderboardScene = LeaderboardScene;
})(window);
