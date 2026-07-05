/**
 * DateUtils — local-date (not UTC) day-key helpers shared across the app.
 * Everything keys off YYYY-MM-DD in the user's local timezone so streaks
 * and "today" line up with when the member actually opens the app.
 */
(function (global) {
  'use strict';

  function pad(n) { return String(n).padStart(2, '0'); }

  function dateKey(d) {
    d = d || new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }

  function parseKey(key) {
    const [y, m, d] = key.split('-').map(Number);
    return new Date(y, m - 1, d);
  }

  function daysBetween(keyA, keyB) {
    const a = parseKey(keyA);
    const b = parseKey(keyB);
    return Math.round((b - a) / 86400000);
  }

  function isToday(key) { return key === dateKey(); }

  function isYesterday(key) {
    const y = new Date();
    y.setDate(y.getDate() - 1);
    return key === dateKey(y);
  }

  function greetingWord(d) {
    const hour = (d || new Date()).getHours();
    if (hour < 12) return 'Good Morning';
    if (hour < 18) return 'Good Afternoon';
    return 'Good Evening';
  }

  function isFriday(d) { return (d || new Date()).getDay() === 5; }

  function friendlyDate(key) {
    const d = parseKey(key);
    return d.toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
  }

  function monthName(d) { return (d || new Date()).toLocaleDateString(undefined, { month: 'long' }); }

  global.DateUtils = { dateKey, parseKey, daysBetween, isToday, isYesterday, greetingWord, isFriday, friendlyDate, monthName, pad };
})(window);
