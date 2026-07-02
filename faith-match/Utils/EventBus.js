/**
 * Minimal dependency-free pub/sub bus shared across scenes and
 * plain-JS game objects (Board, LevelController, SaveManager, ...).
 * Kept independent of Phaser.Events so core logic stays engine-agnostic
 * and unit-testable.
 */
(function (global) {
  'use strict';

  class EventBus {
    constructor() {
      this._listeners = new Map();
    }

    on(event, handler, context) {
      if (!this._listeners.has(event)) this._listeners.set(event, []);
      this._listeners.get(event).push({ handler, context });
      return this;
    }

    once(event, handler, context) {
      const wrapper = (...args) => {
        this.off(event, wrapper);
        handler.apply(context, args);
      };
      wrapper._original = handler;
      return this.on(event, wrapper, context);
    }

    off(event, handler) {
      if (!this._listeners.has(event)) return this;
      if (!handler) {
        this._listeners.delete(event);
        return this;
      }
      const filtered = this._listeners.get(event).filter(
        (l) => l.handler !== handler && l.handler._original !== handler
      );
      this._listeners.set(event, filtered);
      return this;
    }

    emit(event, payload) {
      if (!this._listeners.has(event)) return this;
      // Copy to allow handlers to unsubscribe during emit.
      const listeners = this._listeners.get(event).slice();
      for (const { handler, context } of listeners) {
        handler.call(context, payload);
      }
      return this;
    }

    removeAllListeners() {
      this._listeners.clear();
      return this;
    }
  }

  // App-wide singleton bus used for cross-scene communication
  // (HUD updates, save events, settings changes, etc).
  global.FM_BUS = global.FM_BUS || new EventBus();
  global.EventBus = EventBus;
})(window);
