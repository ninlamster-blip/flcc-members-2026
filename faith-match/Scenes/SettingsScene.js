/**
 * SettingsScene — Music/SFX toggles, a Language selector stub (actual
 * localization arrives later; this establishes the settings slot and
 * persists the choice), and Reset Progress with a confirmation step.
 */
(function (global) {
  'use strict';

  class SettingsScene extends Phaser.Scene {
    constructor() {
      super('Settings');
    }

    create() {
      const C = global.FM_CONST.COLORS;
      const { width } = this.scale;
      this.cameras.main.setBackgroundColor(C.BACKGROUND);

      this.add.text(width / 2, 34, 'Settings', {
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
        onClick: () => this.scene.start('Menu')
      });

      const rowWidth = Math.min(360, width - 40);
      let y = 110;
      const rowGap = 66;

      this._buildToggleRow(width / 2, y, rowWidth, 'Music', 'musicOn');
      y += rowGap;
      this._buildToggleRow(width / 2, y, rowWidth, 'Sound Effects', 'sfxOn');
      y += rowGap;
      this._buildLanguageRow(width / 2, y, rowWidth);
      y += rowGap;
      this._buildResetRow(width / 2, y, rowWidth);
    }

    _rowShell(x, y, width, height) {
      const C = global.FM_CONST.COLORS;
      // x is passed in as width/2, which is fractional on odd-width
      // screens; that alone can break hit-testing on the nested toggle/
      // reset buttons even though their own local x/y is rounded.
      const container = this.add.container(Math.round(x), Math.round(y));
      const bg = this.add.graphics();
      bg.fillStyle(Phaser.Display.Color.HexStringToColor(C.SURFACE).color, 1);
      bg.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
      bg.lineStyle(1.5, Phaser.Display.Color.HexStringToColor(C.BORDER).color, 1);
      bg.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);
      container.add(bg);
      return container;
    }

    _buildToggleRow(x, y, width, label, settingKey) {
      const C = global.FM_CONST.COLORS;
      const row = this._rowShell(x, y, width, 56);

      row.add(this.add.text(-width / 2 + 20, 0, label, {
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px',
        fontStyle: '600',
        color: C.TEXT
      }).setOrigin(0, 0.5));

      const switchTrack = this.add.graphics();
      const switchW = 50;
      const switchH = 28;
      const switchX = width / 2 - 20 - switchW / 2;
      const isOn = global.FM_SAVE.data.settings[settingKey];

      const draw = (on) => {
        switchTrack.clear();
        switchTrack.fillStyle(Phaser.Display.Color.HexStringToColor(on ? C.ACCENT : C.BORDER).color, 1);
        switchTrack.fillRoundedRect(switchX - switchW / 2, -switchH / 2, switchW, switchH, switchH / 2);
        switchTrack.fillStyle(0xffffff, 1);
        const knobX = on ? switchX + switchW / 2 - switchH / 2 : switchX - switchW / 2 + switchH / 2;
        switchTrack.fillCircle(knobX, 0, switchH / 2 - 3);
      };
      draw(isOn);
      row.add(switchTrack);

      const hitZone = this.add.zone(switchX, 0, switchW + 16, switchH + 16).setInteractive({
        hitArea: new Phaser.Geom.Rectangle(-(switchW + 16) / 2, -(switchH + 16) / 2, switchW + 16, switchH + 16),
        hitAreaCallback: Phaser.Geom.Rectangle.Contains,
        useHandCursor: true
      });
      row.add(hitZone);
      hitZone.on('pointerup', () => {
        const newVal = !global.FM_SAVE.data.settings[settingKey];
        if (settingKey === 'musicOn') global.AudioManager.setMusicEnabled(newVal);
        else if (settingKey === 'sfxOn') global.AudioManager.setSfxEnabled(newVal);
        else global.FM_SAVE.set(`settings.${settingKey}`, newVal);
        if (newVal) global.AudioManager.playTap();
        draw(newVal);
        global.FM_BUS.emit(global.FM_CONST.EVENTS.SETTINGS_CHANGED, global.FM_SAVE.data.settings);
      });
    }

    _buildLanguageRow(x, y, width) {
      const C = global.FM_CONST.COLORS;
      const row = this._rowShell(x, y, width, 56);

      row.add(this.add.text(-width / 2 + 20, -10, 'Language', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px',
        fontStyle: '600',
        color: C.TEXT
      }).setOrigin(0, 0.5));

      row.add(this.add.text(-width / 2 + 20, 12, 'More languages coming soon', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '10px',
        color: C.TEXT_MUTED
      }).setOrigin(0, 0.5));

      const chip = this.add.graphics();
      chip.fillStyle(Phaser.Display.Color.HexStringToColor(C.BACKGROUND).color, 1);
      chip.fillRoundedRect(width / 2 - 90, -14, 70, 28, 14);
      row.add(chip);
      row.add(this.add.text(width / 2 - 55, 0, 'English', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '12px',
        fontStyle: '600',
        color: C.TEXT_MUTED
      }).setOrigin(0.5));
    }

    _buildResetRow(x, y, width) {
      const C = global.FM_CONST.COLORS;
      const row = this._rowShell(x, y, width, 56);

      row.add(this.add.text(-width / 2 + 20, 0, 'Reset Progress', {
        fontFamily: 'Inter, sans-serif',
        fontSize: '15px',
        fontStyle: '600',
        color: C.DANGER
      }).setOrigin(0, 0.5));

      row.add(new global.FMButton(this, {
        x: width / 2 - 60,
        y: 0,
        width: 90,
        height: 36,
        label: 'Reset',
        variant: 'secondary',
        fontSize: 12,
        onClick: () => this._confirmReset()
      }));
    }

    _confirmReset() {
      const C = global.FM_CONST.COLORS;
      const { width, height } = this.scale;
      const modal = this.add.container(Math.round(width / 2), Math.round(height / 2));
      modal.add(this.add.rectangle(0, 0, width, height, 0x000000, 0.45).setOrigin(0.5));

      const panelWidth = Math.min(320, width - 48);
      const panel = this.add.graphics();
      panel.fillStyle(Phaser.Display.Color.HexStringToColor(C.SURFACE).color, 1);
      panel.fillRoundedRect(-panelWidth / 2, -110, panelWidth, 220, 20);
      modal.add(panel);

      modal.add(this.add.text(0, -70, 'Reset all progress?', {
        fontFamily: 'Inter, sans-serif', fontSize: '18px', fontStyle: '800', color: C.TEXT
      }).setOrigin(0.5));

      modal.add(this.add.text(0, -38, 'This permanently erases levels,\ncoins, stars, and achievements.', {
        fontFamily: 'Inter, sans-serif', fontSize: '12px', color: C.TEXT_MUTED, align: 'center'
      }).setOrigin(0.5));

      modal.add(new global.FMButton(this, {
        x: 0, y: 18, width: panelWidth - 60, height: 44,
        label: 'Erase Everything', variant: 'primary', fontSize: 14,
        onClick: () => {
          global.FM_SAVE.resetProgress();
          this.scene.start('Menu');
        }
      }));

      modal.add(new global.FMButton(this, {
        x: 0, y: 70, width: panelWidth - 60, height: 38,
        label: 'Cancel', variant: 'ghost', fontSize: 13,
        onClick: () => modal.destroy()
      }));
    }
  }

  global.SettingsScene = SettingsScene;
})(window);
