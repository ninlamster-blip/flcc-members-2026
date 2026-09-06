// Every section of the one screen. Each function takes a derived reading and
// returns HTML; nothing here fetches, stores or listens.

import { icon } from './icons.js';
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

export function hero(d, units) {
  const n = d.now;
  const feels = n.heatIndexC ?? n.apparentC;
  const gap = Number.isFinite(feels) && Number.isFinite(n.tempC) ? feels - n.tempC : 0;
  return `
    <div class="hero-mark">${icon(codeIcon(n.code, n.isDay), { size: 64 })}</div>
    <p class="hero-temp">${fmt.temp(n.tempC, units)}</p>
    <p class="hero-condition">${esc(codeLabel(n.code))}</p>
    <p class="hero-feels">
      Feels like <strong>${fmt.temp(feels, units)}</strong>
      ${Math.abs(gap) >= 1 ? `<span class="hero-gap">${gap > 0 ? '+' : ''}${Math.round(gap)}° on the thermometer</span>` : ''}
    </p>`;
}

export function advisoryList(items) {
  if (!items.length) {
    return `<li class="advisory advisory--calm">${icon('sun')}<div><p class="advisory-title">Nothing to warn you about</p>
      <p class="advisory-detail">No dust, no dangerous heat and no wind worth planning around right now.</p></div></li>`;
  }
  return items.map((a) => `
    <li class="advisory advisory--${a.severity}">
      ${icon(a.icon)}
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
         ${icon('ban')}
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
      <span class="dust-badge">${esc(n.dust.label)}</span>
      <p class="dust-advice">${esc(n.dust.advice)}</p>
    </div>
    <dl class="facts">
      <div><dt>${icon('eye', { size: 18 })} Visibility</dt><dd>${fmt.visibility(n.visibilityM)}</dd></div>
      <div><dt>${icon('dust', { size: 18 })} PM10</dt><dd>${fmt.num(n.pm10, 0, ' µg/m³')}</dd></div>
      <div><dt>${icon('dust', { size: 18 })} Mineral dust</dt><dd>${fmt.num(n.dustUgm3, 0, ' µg/m³')}</dd></div>
      <div><dt>${icon('drop', { size: 18 })} PM2.5</dt><dd>${fmt.num(n.pm25, 0, ' µg/m³')}</dd></div>
    </dl>`;
}

export function hourStrip(d, units, now = new Date()) {
  return upcoming(d.hours, 24, now).map((h) => `
    <li class="hour${h.banned ? ' hour--banned' : ''}">
      <p class="hour-time">${h.at ? esc(fmt.hourLabel(h.at)) : '—'}</p>
      ${icon(codeIcon(h.code, h.isDay), { size: 22 })}
      <p class="hour-temp">${fmt.temp(h.tempC, units, { sign: false })}</p>
      <p class="hour-feels">${fmt.temp(h.heatIndexC, units, { sign: false })}</p>
      ${h.dust ? `<span class="hour-dust dust--${h.dust.id}" title="${esc(h.dust.label)}"></span>` : '<span class="hour-dust"></span>'}
      <p class="hour-wind">${fmt.num(h.windKmh, 0)}<span>${h.compass ? esc(h.compass) : ''}</span></p>
    </li>`).join('');
}

export function dayList(d, units) {
  const hottest = Math.max(...d.days.map((x) => x.maxC ?? -Infinity));
  const coldest = Math.min(...d.days.map((x) => x.minC ?? Infinity));
  const span = Math.max(1, hottest - coldest);

  return d.days.map((day, i) => {
    const left = ((day.minC - coldest) / span) * 100;
    const width = Math.max(6, ((day.maxC - day.minC) / span) * 100);
    return `
      <li class="day">
        <p class="day-name">${i === 0 ? 'Today' : esc(fmt.weekday(day.at))}</p>
        <p class="day-date">${esc(fmt.dayAndMonth(day.at))}</p>
        ${icon(codeIcon(day.code, true), { size: 22 })}
        ${day.dust && day.dust.rank >= 2 ? `<span class="day-dust dust--${day.dust.id}">${esc(day.dust.short)}</span>` : '<span class="day-dust"></span>'}
        <p class="day-min">${fmt.temp(day.minC, units, { sign: false })}</p>
        <div class="day-bar"><span style="left:${left}%;width:${width}%"></span></div>
        <p class="day-max">${fmt.temp(day.maxC, units, { sign: false })}</p>
      </li>`;
  }).join('');
}

export function detailGrid(d, units) {
  const n = d.now;
  return `
    <div><dt>${icon('wind', { size: 18 })} Wind</dt><dd>${fmt.num(n.windKmh, 0, ' km/h')} ${n.compass ? esc(n.compass) : ''}</dd>
      <p>${n.beaufort ? esc(n.beaufort.label) : ''}${Number.isFinite(n.gustKmh) ? ` · gusts ${Math.round(n.gustKmh)}` : ''}</p></div>
    <div><dt>${icon('drop', { size: 18 })} Humidity</dt><dd>${fmt.num(n.humidity, 0, '%')}</dd>
      <p>${n.humidity >= 60 ? 'Sweat evaporates poorly at this level' : 'Dry enough for sweat to work'}</p></div>
    <div><dt>${icon('sun', { size: 18 })} UV index</dt><dd>${fmt.num(n.uvIndex, 1)}</dd>
      <p>${Number.isFinite(n.uvIndex) && n.uvIndex >= 8 ? 'Cover up' : 'Manageable'}</p></div>
    <div><dt>${icon('gauge', { size: 18 })} Pressure</dt><dd>${fmt.num(n.pressureHpa, 0, ' hPa')}</dd>
      <p>Sea level</p></div>
    <div><dt>${icon('eye', { size: 18 })} Visibility</dt><dd>${fmt.visibility(n.visibilityM)}</dd>
      <p>${n.dust ? esc(n.dust.label) : '—'}</p></div>
    <div><dt>${icon('clock', { size: 18 })} Sun</dt><dd>${d.days[0]?.sunrise ? esc(fmt.clock(fmt.parseLocal(d.days[0].sunrise))) : '—'} · ${d.days[0]?.sunset ? esc(fmt.clock(fmt.parseLocal(d.days[0].sunset))) : '—'}</dd>
      <p>Rise and set</p></div>`;
}

export { esc };
