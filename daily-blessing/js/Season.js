/**
 * Season — detects Fridays and the church calendar's recurring seasons so
 * the gift box + content mix can shift automatically without touching
 * navigation or layout. Dates for movable/administrative seasons (Prayer
 * Week, Missions Month, Men's Fellowship, Church Anniversary) live in
 * SEASON_CONFIG below — edit the month/day ranges to match your church
 * calendar each year.
 */
(function (global) {
  'use strict';

  // Anonymous Gregorian algorithm — good enough for Holy Week/Easter theming.
  function computeEaster(year) {
    const a = year % 19;
    const b = Math.floor(year / 100);
    const c = year % 100;
    const d = Math.floor(b / 4);
    const e = b % 4;
    const f = Math.floor((b + 8) / 25);
    const g = Math.floor((b - f + 1) / 3);
    const h = (19 * a + b - d - g + 15) % 30;
    const i = Math.floor(c / 4);
    const k = c % 4;
    const l = (32 + 2 * e + 2 * i - h - k) % 7;
    const m = Math.floor((a + 11 * h + 22 * l) / 451);
    const month = Math.floor((h + l - 7 * m + 114) / 31);
    const day = ((h + l - 7 * m + 114) % 31) + 1;
    return new Date(year, month - 1, day);
  }

  // Fixed-date ranges an admin can adjust to match the actual church calendar.
  const SEASON_CONFIG = [
    { id: 'missions-month', label: 'Missions Month', month: 10, startDay: 1, endDay: 31 },
    { id: 'prayer-week', label: 'Prayer Week', month: 1, startDay: 1, endDay: 7 },
    { id: 'mens-fellowship', label: "Men's Fellowship", month: 6, startDay: 1, endDay: 7 }
  ];

  function inRange(d, month, startDay, endDay) {
    return d.getMonth() + 1 === month && d.getDate() >= startDay && d.getDate() <= endDay;
  }

  function get(d) {
    d = d || new Date();
    const year = d.getFullYear();
    const easter = computeEaster(year);
    const holyWeekStart = new Date(easter);
    holyWeekStart.setDate(easter.getDate() - 6);

    const isFriday = global.DateUtils.isFriday(d);
    const isChristmas = (d.getMonth() === 11 && d.getDate() >= 18) || (d.getMonth() === 0 && d.getDate() === 1);
    const isResurrectionSunday = d.toDateString() === easter.toDateString();
    const isHolyWeek = d >= holyWeekStart && d <= easter;

    let season = null;
    if (isResurrectionSunday) season = { id: 'resurrection', label: 'Resurrection Sunday', themeClass: 'season-resurrection' };
    else if (isHolyWeek) season = { id: 'holy-week', label: 'Holy Week', themeClass: 'season-holyweek' };
    else if (isChristmas) season = { id: 'christmas', label: 'Christmas', themeClass: 'season-christmas' };
    else {
      const cfg = SEASON_CONFIG.find((s) => inRange(d, s.month, s.startDay, s.endDay));
      if (cfg) season = { id: cfg.id, label: cfg.label, themeClass: `season-${cfg.id}` };
    }

    return { isFriday, season };
  }

  global.DB_SEASON = { get, computeEaster };
})(window);
