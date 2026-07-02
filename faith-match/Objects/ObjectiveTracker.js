/**
 * ObjectiveTracker — pure state tracker for a level's win condition(s).
 * GameScene feeds it the results of each resolution cycle (cleared
 * cells, damaged/destroyed blockers, running score) and asks it whether
 * the level has been won. Kept separate from GameScene so objective
 * rules can be unit-tested without touching Phaser.
 */
(function (global) {
  'use strict';

  class ObjectiveTracker {
    constructor(objectives) {
      this.objectives = objectives.map((o) => Object.assign({}, o, { progress: 0 }));
    }

    applyClearedCells(clearedCells) {
      clearedCells.forEach((cell) => {
        this.objectives.forEach((obj) => {
          if (obj.type === global.FM_CONST.OBJECTIVE_TYPES.COLLECT && obj.pieceType === cell.type) {
            obj.progress = Math.min(obj.target, obj.progress + 1);
          }
        });
      });
    }

    applyBlockerDamage(blockersDamaged) {
      blockersDamaged.forEach((b) => {
        this.objectives.forEach((obj) => {
          if (obj.type === global.FM_CONST.OBJECTIVE_TYPES.BREAK_STONE && b.blocker === 'stone' && b.destroyed) {
            obj.progress = Math.min(obj.target, obj.progress + 1);
          }
          if (obj.type === global.FM_CONST.OBJECTIVE_TYPES.CLEAR_FOG && b.blocker === 'fog' && b.cleared) {
            obj.progress = Math.min(obj.target, obj.progress + 1);
          }
        });
      });
    }

    applyScore(totalScore) {
      this.objectives.forEach((obj) => {
        if (obj.type === global.FM_CONST.OBJECTIVE_TYPES.SCORE) {
          obj.progress = Math.min(obj.target, totalScore);
        }
      });
    }

    isComplete() {
      return this.objectives.every((o) => o.progress >= o.target);
    }

    getSummary() {
      return this.objectives.map((o) => Object.assign({}, o));
    }
  }

  global.ObjectiveTracker = ObjectiveTracker;
})(window);
