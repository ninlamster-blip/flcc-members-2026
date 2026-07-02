/**
 * DateUtils — local-date-key helpers shared by daily login streaks and
 * the daily/weekly challenge rotation. Uses local time (not UTC) so a
 * player's "day" matches their own clock.
 */
(function (global) {
  'use strict';

  function pad(n) {
    return n < 10 ? '0' + n : String(n);
  }

  function dateKey(date) {
    const d = date || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function daysBetween(dateKeyA, dateKeyB) {
    const a = new Date(dateKeyA + 'T00:00:00');
    const b = new Date(dateKeyB + 'T00:00:00');
    return Math.round((b - a) / 86400000);
  }

  // ISO 8601 week number, formatted like '2026-W27'.
  function weekKey(date) {
    const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
    const dayNum = d.getUTCDay() || 7;
    d.setUTCDate(d.getUTCDate() + 4 - dayNum);
    const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
    const weekNum = Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
    return `${d.getUTCFullYear()}-W${pad(weekNum)}`;
  }

  function dayOfYear(date) {
    const start = new Date(date.getFullYear(), 0, 0);
    return Math.floor((date - start) / 86400000);
  }

  global.DateUtils = { dateKey, daysBetween, weekKey, dayOfYear, pad };
})(window);
