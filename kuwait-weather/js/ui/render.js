// Every section of the one screen. Each function takes a derived reading and
// returns HTML; nothing here fetches, stores or listens.

import { icon } from './icons.js';
import { art } from './art.js';
import { chart } from './chart.js';
import { toneNote } from './tone.js';
import * as fmt from '../core/format.js';
import { label as codeLabel, icon as codeIcon } from '../core/weathercode.js';
import { banStatus, BAN } from '../core/workban.js';
import { upcoming, bestOutdoorWindow } from '../core/derive.js';
import { WORK_PROFILES, heatIndexReliable } from '../core/heat.js';
import { byGovernorate } from '../core/places.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export function placeOptions(selectedId) {
  return byGovernorate().map(({ gov, places }) => `
    <optgroup label="${esc(gov)}">
      ${places.map((p) => `<option value="${p.id}"${p.id === selectedId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
    </optgroup>`).join('');
}

/**
 * The number, and the three things that stand beside it: what the sky is
 * doing, today's range, and what is in the air. The reference puts exactly
 * these three there, and for Kuwait they happen to be the right three.
 */
export function reading(d, units) {
  const n = d.now;
  const feels = n.heatIndexC ?? n.apparentC;

  return `
    <p class="reading-temp">${Math.round(fmt.toDisplayTemp(n.tempC, units) ?? 0)}<span class="deg">°</span></p>
    <div class="reading-side">
      <div class="reading-art">${art(codeIcon(n.code, n.isDay), { size: 60 })}</div>
      <p class="reading-condition">${esc(codeLabel(n.code))}</p>
      <p class="reading-pair"><b>${fmt.temp(feels, units, { sign: false })}</b><span>Feels like</span></p>
      <p class="reading-pair"><b>${fmt.num(n.pm10, 0)}<i>µg/m³</i></b><span>PM10</span></p>
    </div>`;
}

/**
 * The card's heading. The city is already in the bar above it, so this is the
 * date instead — which the app otherwise never says anywhere at all.
 */
export function sheetDate(now = new Date()) {
  return fmt.longDate(now);
}

export function sheetNote(d, tone) {
  const n = d.now;
  const feels = n.heatIndexC ?? n.apparentC;
  const gap = Number.isFinite(feels) && Number.isFinite(n.tempC) ? Math.round(feels - n.tempC) : 0;
  const humid = gap >= 3 ? ` · humidity adds ${gap}°` : '';
  return `${esc(toneNote(tone))}${humid}`;
}

/** The day's shape: what it will read, and what it will feel like, over 24 h. */
export function curve(d, now = new Date()) {
  const ahead = upcoming(d.hours, 24, now);
  if (ahead.length < 2) return '';
  const svg = chart({
    actual: ahead.map((h) => h.tempC),
    feels: ahead.map((h) => h.heatIndexC),
  });
  if (!svg) return '';
  return `${svg}
    <p class="curve-key">
      <span><i></i>Air</span>
      <span><i class="dashed"></i>Feels like</span>
    </p>`;
}

export function advisoryList(items) {
  if (!items.length) {
    return `<li class="advisory advisory--calm">${art('sun', { size: 44 })}<div>
      <p class="advisory-title">Nothing to warn you about</p>
      <p class="advisory-detail">No dust, no dangerous heat and no wind worth planning around right now.</p></div></li>`;
  }
  return items.map((a) => `
    <li class="advisory advisory--${a.severity}">
      ${art(a.icon, { size: 44 })}
      <div>
        <p class="advisory-title">${esc(a.title)}</p>
        <p class="advisory-detail">${esc(a.detail)}</p>
      </div>
    </li>`).join('');
}

export function workCard(d, { profile, now = new Date() } = {}) {
  const n = d.now;
  const ban = banStatus(now);
  const window = bestOutdoorWindow(d.hours, { now });
  const work = n.work;

  const banRow = ban.inSeason
    ? `<div class="ban ban--${ban.active ? 'active' : 'idle'}">
         ${art('ban', { size: 44 })}
         <div>
           <p class="ban-title">${ban.active ? `Midday work ban in force until ${BAN.toHour}:00` : `Midday work ban: ${BAN.fromHour}:00 – ${BAN.toHour}:00`}</p>
           <p class="ban-detail">${esc(ban.summary)} Kuwait bars work in direct sun in open areas from 1 June to 31 August. Confirm the current year's decree with the ${esc(BAN.authority)}.</p>
         </div>
       </div>`
    : '';

  return `
    ${banRow}
    <div class="work-grid">
      <div class="work-figure">
        <p class="work-band">${work ? esc(work.label) : '—'}</p>
        <p class="work-sub">Estimated WBGT ${fmt.num(n.wbgt, 1, '°C')}</p>
      </div>
      <dl class="work-facts">
        <div><dt>Heat index</dt><dd>${fmt.temp(n.heatIndexC, d.units || 'C')} · ${n.heat ? esc(n.heat.label) : '—'}</dd></div>
        <div><dt>Water per hour</dt><dd>${n.waterMl ? `${String(+(n.waterMl / 1000).toFixed(2))} L` : '—'}</dd></div>
        <div><dt>Best stretch ahead</dt><dd>${window ? `${fmt.hourLabel(window.from)} – ${fmt.hourLabel(window.to)}` : 'None in the next 24 h'}</dd></div>
      </dl>
    </div>
    <div class="profile" role="group" aria-label="Kind of outdoor work">
      ${WORK_PROFILES.map((p) => `
        <button type="button" class="profile-btn${p.id === profile ? ' is-on' : ''}" data-profile="${p.id}"
          title="${esc(p.example)}">${esc(p.label)}</button>`).join('')}
    </div>
    <p class="fineprint">WBGT is estimated from temperature, humidity, cloud, wind and time of day — not measured. Work/rest splits are published guidance for planning a day, not a legal standard.${
      Number.isFinite(n.tempC) && !heatIndexReliable(n.tempC)
        ? ' Above 44 °C the heat index is past the range its formula was fitted for and reads high; the guidance above follows WBGT, which is not.'
        : ''}</p>`;
}

export function dustCard(d) {
  const n = d.now;
  if (!n.dust) {
    return `<p class="empty">Air-quality data isn't available for this location right now — dust and PM10 will reappear when it is.</p>`;
  }
  return `
    <div class="dust-head dust--${n.dust.id}">
      ${art('dust', { size: 44 })}
      <div>
        <span class="dust-badge">${esc(n.dust.label)}</span>
        <p class="dust-advice">${esc(n.dust.advice)}</p>
      </div>
    </div>
    <dl class="facts">
      <div><dt>${icon('eye', { size: 16 })} Visibility</dt><dd>${fmt.visibility(n.visibilityM)}</dd></div>
      <div><dt>${icon('dust', { size: 16 })} PM10</dt><dd>${fmt.num(n.pm10, 0, ' µg/m³')}</dd></div>
      <div><dt>${icon('dust', { size: 16 })} Mineral dust</dt><dd>${fmt.num(n.dustUgm3, 0, ' µg/m³')}</dd></div>
      <div><dt>${icon('drop', { size: 16 })} PM2.5</dt><dd>${fmt.num(n.pm25, 0, ' µg/m³')}</dd></div>
    </dl>`;
}

export function hourStrip(d, units, now = new Date()) {
  return upcoming(d.hours, 24, now).map((h) => `
    <li class="hour${h.banned ? ' hour--banned' : ''}">
      <p class="hour-time">${h.at ? esc(fmt.hourLabel(h.at)) : '—'}</p>
      ${art(codeIcon(h.code, h.isDay), { size: 30 })}
      <p class="hour-temp">${fmt.temp(h.tempC, units, { sign: false })}</p>
      <p class="hour-feels">${fmt.temp(h.heatIndexC, units, { sign: false })}</p>
      ${h.dust ? `<span class="hour-dust dust--${h.dust.id}" title="${esc(h.dust.label)}"></span>` : '<span class="hour-dust"></span>'}
      <p class="hour-wind">${fmt.num(h.windKmh, 0)}<span>${h.compass ? esc(h.compass) : ''}</span></p>
    </li>`).join('');
}

export function dayList(d, units) {
  return d.days.map((day, i) => `
    <li class="day${i === 0 ? ' is-today' : ''}">
      <p class="day-name">${i === 0 ? 'Today' : esc(fmt.weekday(day.at))}</p>
      ${art(codeIcon(day.code, true), { size: 30 })}
      <p class="day-temps"><b>${fmt.temp(day.maxC, units, { sign: false })}</b></p>
      <p class="day-temps day-low">${fmt.temp(day.minC, units, { sign: false })}</p>
      <span class="day-dust${day.dust && day.dust.rank >= 2 ? ` dust--${day.dust.id}` : ''}"></span>
    </li>`).join('');
}

export function detailGrid(d, units) {
  const n = d.now;
  return `
    <div><dt>${icon('wind', { size: 16 })} Wind</dt><dd>${fmt.num(n.windKmh, 0, ' km/h')} ${n.compass ? esc(n.compass) : ''}</dd>
      <p>${n.beaufort ? esc(n.beaufort.label) : ''}${Number.isFinite(n.gustKmh) ? ` · gusts ${Math.round(n.gustKmh)}` : ''}</p></div>
    <div><dt>${icon('drop', { size: 16 })} Humidity</dt><dd>${fmt.num(n.humidity, 0, '%')}</dd>
      <p>${n.humidity >= 60 ? 'Sweat evaporates poorly at this level' : 'Dry enough for sweat to work'}</p></div>
    <div><dt>${icon('sun', { size: 16 })} UV index</dt><dd>${fmt.num(n.uvIndex, 1)}</dd>
      <p>${Number.isFinite(n.uvIndex) && n.uvIndex >= 8 ? 'Cover up' : 'Manageable'}</p></div>
    <div><dt>${icon('gauge', { size: 16 })} Pressure</dt><dd>${fmt.num(n.pressureHpa, 0, ' hPa')}</dd>
      <p>Sea level</p></div>
    <div><dt>${icon('eye', { size: 16 })} Visibility</dt><dd>${fmt.visibility(n.visibilityM)}</dd>
      <p>${n.dust ? esc(n.dust.label) : '—'}</p></div>
    <div><dt>${icon('clock', { size: 16 })} Sun</dt><dd>${d.days[0]?.sunrise ? esc(fmt.clock(fmt.parseLocal(d.days[0].sunrise))) : '—'} · ${d.days[0]?.sunset ? esc(fmt.clock(fmt.parseLocal(d.days[0].sunset))) : '—'}</dd>
      <p>Rise and set</p></div>`;
}

export { esc };
