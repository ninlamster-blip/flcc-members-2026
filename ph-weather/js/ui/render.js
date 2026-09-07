// Every section of the one screen. Each function takes a derived reading and
// returns HTML; nothing here fetches, stores or listens.

import { icon } from './icons.js';
import { art } from './art.js';
import { rainBars, rainLegend, bandIdFor, chart } from './chart.js';
import { toneNote } from './tone.js';
import * as fmt from '../core/format.js';
import { label as codeLabel, icon as codeIcon } from '../core/weathercode.js';
import { upcoming, wettestWindow } from '../core/derive.js';
import { WARNING_COLOUR } from '../core/rain.js';
import { POLLEN_NOTE } from '../core/air.js';
import { byRegion } from '../core/places.js';

const esc = (s) => String(s).replace(/[&<>"']/g, (c) => (
  { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]
));

export function placeOptions(selectedId) {
  return byRegion().map(({ region, places }) => `
    <optgroup label="${esc(region)}">
      ${places.map((p) => `<option value="${p.id}"${p.id === selectedId ? ' selected' : ''}>${esc(p.name)}</option>`).join('')}
    </optgroup>`).join('');
}

export const sheetDate = (now = new Date()) => fmt.longDate(now);

export function sheetNote(d, tone) {
  const n = d.now;
  const penalty = Number.isFinite(n.humidityPenaltyC) ? Math.round(n.humidityPenaltyC) : 0;
  const humid = penalty >= 3 ? ` · humidity adds ${penalty}°` : '';
  return `${esc(toneNote(tone))}${humid}`;
}

export function reading(d, units) {
  const n = d.now;
  const feels = n.heatIndexC ?? n.apparentC;
  return `
    <p class="reading-temp">${Math.round(fmt.toDisplayTemp(n.tempC, units) ?? 0)}<span class="deg">°</span></p>
    <div class="reading-side">
      <div class="reading-art">${art(codeIcon(n.code, n.isDay), { size: 60 })}</div>
      <p class="reading-condition">${esc(codeLabel(n.code))}</p>
      <p class="reading-pair"><b>${fmt.temp(feels, units, { sign: false })}</b><span>Feels like</span></p>
      <p class="reading-pair"><b>${fmt.num(d.rainMm24h, d.rainMm24h >= 10 ? 0 : 1)}<i>mm</i></b><span>Rain in 24 h</span></p>
    </div>`;
}

/** The flood card — the reason this app exists, so it sits above everything. */
export function floodCard(d) {
  const f = d.flood;
  const g = d.ground;
  return `
    <div class="hazard hazard--${f.id}">
      ${art('flood', { size: 52 })}
      <div>
        <p class="hazard-level">${esc(f.label)}</p>
        <p class="hazard-advice">${esc(f.advice)}</p>
      </div>
    </div>
    ${f.drivers.length ? `<ul class="drivers">${f.drivers.map((x) => `<li>${esc(x)}</li>`).join('')}</ul>` : ''}
    <dl class="facts">
      <div><dt>${icon('rain', { size: 16 })} Heaviest hour</dt>
        <dd>${fmt.mm(f.peakMmPerHour, { perHour: true })}</dd>
        <p>${f.peakAt ? `around ${esc(fmt.hourLabel(f.peakAt))}` : 'nothing forecast'}</p></div>
      <div><dt>${icon('drop', { size: 16 })} Next 24 hours</dt>
        <dd>${fmt.mm(f.mm24h)}</dd>
        <p>total rainfall</p></div>
      <div><dt>${icon('hill', { size: 16 })} Ground</dt>
        <dd>${g ? esc(g.label.replace(' ground', '')) : '—'}</dd>
        <p>${g ? esc(g.reason) : 'past week unavailable'}</p></div>
    </dl>
    <p class="fineprint"><strong>This is not a flood forecast.</strong> It is rainfall — PAGASA's own warning
      thresholds, plus how much rain has already fallen this week — and nothing else. It does not know your
      street's drainage, the river level, or what a dam upstream is doing. PAGASA and your local DRRMO are
      who to act on.</p>`;
}

export function landslideCard(d) {
  const l = d.landslide;
  if (!l) {
    return `<p class="empty">The past week of rainfall isn't available for this location, so there is nothing to base this on.</p>`;
  }
  return `
    <div class="hazard hazard--slide-${l.id}">
      ${art('landslide', { size: 52 })}
      <div>
        <p class="hazard-level">${esc(l.label)}</p>
        <p class="hazard-advice">${esc(l.advice)}</p>
      </div>
    </div>
    <p class="hazard-reason">Based on: ${esc(l.reason)}.</p>
    <p class="fineprint">Whether a slope can fail depends on the slope — how steep it is, what it is made of,
      and what has been cut into it. That is in PHIVOLCS and MGB susceptibility maps, not in a weather
      forecast. What is shown here is only the rainfall that triggers a slide on ground already primed for one.</p>`;
}

export function rainChart(d, now = new Date()) {
  const ahead = upcoming(d.hours, 24, now);
  if (ahead.length < 2) return '';
  const bars = ahead.map((h) => ({
    mm: h.precipMm ?? 0,
    id: bandIdFor(h.precipMm ?? 0),
    label: h.at ? fmt.hourLabel(h.at) : '',
  }));
  const window = wettestWindow(d.hours, now);
  return `
    ${rainBars(bars)}
    ${rainLegend(bars.map((b) => b.mm))}
    <p class="chart-note">${window
      ? `Heaviest between ${esc(fmt.hourLabel(window.from))} and ${esc(fmt.hourLabel(window.to))} — about ${fmt.mm(window.mm)}.`
      : 'No significant rain in the next 24 hours.'}</p>`;
}

export function tempChart(d, now = new Date()) {
  const ahead = upcoming(d.hours, 24, now);
  if (ahead.length < 2) return '';
  return `${chart({ actual: ahead.map((h) => h.tempC), feels: ahead.map((h) => h.heatIndexC) })}
    <p class="curve-key"><span><i></i>Air</span><span><i class="dashed"></i>Feels like</span></p>`;
}

export function advisoryList(items) {
  if (!items.length) {
    return `<li class="advisory advisory--calm">${art('sun', { size: 44 })}<div>
      <p class="advisory-title">Nothing to warn you about</p>
      <p class="advisory-detail">No flooding indicated, no heavy rain forecast, and the air is fine.</p></div></li>`;
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

export function humidityCard(d, units) {
  const n = d.now;
  return `
    <div class="hazard hazard--heat-${n.heat ? n.heat.id : 'safe'}">
      ${art('heat', { size: 52 })}
      <div>
        <p class="hazard-level">${n.heat ? esc(n.heat.label) : '—'}</p>
        <p class="hazard-advice">${n.heat ? esc(n.heat.note) : ''}</p>
      </div>
    </div>
    <dl class="facts">
      <div><dt>Heat index</dt><dd>${fmt.temp(n.heatIndexC, units)}</dd><p>PAGASA scale</p></div>
      <div><dt>Dew point</dt><dd>${fmt.temp(n.dew, units)}</dd><p>${n.comfort ? esc(n.comfort.label) : '—'}</p></div>
      <div><dt>Humidity</dt><dd>${fmt.num(n.humidity, 0, '%')}</dd>
        <p>${Number.isFinite(n.humidityPenaltyC) && n.humidityPenaltyC >= 1 ? `adds ${Math.round(n.humidityPenaltyC)}° to how it feels` : 'little effect today'}</p></div>
    </dl>
    ${n.comfort ? `<p class="hazard-reason">${esc(n.comfort.note)}</p>` : ''}`;
}

export function airCard(d) {
  const n = d.now;
  const list = n.irritants || [];
  return `
    <div class="hazard hazard--air-${n.aqi ? n.aqi.id : 'good'}">
      ${art('air', { size: 52 })}
      <div>
        <p class="hazard-level">${n.aqi ? esc(n.aqi.label) : 'Air quality unavailable'}</p>
        <p class="hazard-advice">${n.aqi ? esc(n.aqi.advice) : 'The air-quality model has no reading for this location right now.'}</p>
      </div>
    </div>
    <dl class="facts">
      <div><dt>US AQI</dt><dd>${fmt.num(n.usAqi, 0)}</dd><p>${n.aqi ? esc(n.aqi.label) : '—'}</p></div>
      <div><dt>PM2.5</dt><dd>${fmt.num(n.pm25, 0)}</dd><p>µg/m³ · WHO guide 15</p></div>
      <div><dt>Damp indoors</dt><dd>${n.damp ? esc(n.damp.label) : '—'}</dd><p>mould and dust mites</p></div>
    </dl>
    ${list.length ? `<p class="hazard-reason"><strong>Today's triggers:</strong> ${
      list.map((i) => `${esc(i.label.toLowerCase())} (${Math.round(i.value)} ${esc(i.unit)})`).join(', ')}.</p>` : ''}
    ${n.damp ? `<p class="hazard-reason">${esc(n.damp.note)}</p>` : ''}
    <p class="fineprint">${esc(POLLEN_NOTE)}</p>`;
}

export function hourStrip(d, units, now = new Date()) {
  return upcoming(d.hours, 24, now).map((h) => {
    const colour = WARNING_COLOUR[h.rain?.id];
    return `
    <li class="hour${colour ? ` hour--${colour}` : ''}">
      <p class="hour-time">${h.at ? esc(fmt.hourLabel(h.at)) : '—'}</p>
      ${art(codeIcon(h.code, h.isDay), { size: 30 })}
      <p class="hour-temp">${fmt.temp(h.tempC, units, { sign: false })}</p>
      <p class="hour-rain">${(h.precipMm ?? 0) > 0 ? `${(h.precipMm).toFixed(1)}<span>mm</span>` : '<span>—</span>'}</p>
      <p class="hour-prob">${fmt.num(h.precipProb, 0, '%')}</p>
    </li>`;
  }).join('');
}

export function dayList(d, units) {
  return d.days.map((day, i) => `
    <li class="day${i === 0 ? ' is-today' : ''}${day.warned ? ' is-warned' : ''}">
      <p class="day-name">${i === 0 ? 'Today' : esc(fmt.weekday(day.at))}</p>
      ${art(codeIcon(day.code, true), { size: 30 })}
      <p class="day-temps"><b>${fmt.temp(day.maxC, units, { sign: false })}</b></p>
      <p class="day-temps day-low">${fmt.temp(day.minC, units, { sign: false })}</p>
      <p class="day-rain">${Number.isFinite(day.precipMm) && day.precipMm > 0 ? `${Math.round(day.precipMm)}<span>mm</span>` : '<span>—</span>'}</p>
    </li>`).join('');
}

export function detailGrid(d, units) {
  const n = d.now;
  return `
    <div><dt>${icon('wind', { size: 16 })} Wind</dt><dd>${fmt.num(n.windKmh, 0, ' km/h')} ${n.compass ? esc(n.compass) : ''}</dd>
      <p>${n.beaufort ? esc(n.beaufort.label) : ''}${Number.isFinite(n.gustKmh) ? ` · gusts ${Math.round(n.gustKmh)}` : ''}</p></div>
    <div><dt>${icon('drop', { size: 16 })} Humidity</dt><dd>${fmt.num(n.humidity, 0, '%')}</dd>
      <p>${n.comfort ? esc(n.comfort.label) : '—'}</p></div>
    <div><dt>${icon('sun', { size: 16 })} UV index</dt><dd>${fmt.num(n.uvIndex, 1)}</dd>
      <p>${Number.isFinite(n.uvIndex) && n.uvIndex >= 8 ? 'Cover up' : 'Manageable'}</p></div>
    <div><dt>${icon('gauge', { size: 16 })} Pressure</dt><dd>${fmt.num(n.pressureHpa, 0, ' hPa')}</dd>
      <p>Sea level</p></div>
    <div><dt>${icon('eye', { size: 16 })} Visibility</dt><dd>${fmt.visibility(n.visibilityM)}</dd>
      <p>${Number.isFinite(n.visibilityM) && n.visibilityM < 4000 ? 'Poor — rain or haze' : 'Clear enough'}</p></div>
    <div><dt>${icon('clock', { size: 16 })} Sun</dt><dd>${d.days[0]?.sunrise ? esc(fmt.clock(fmt.parseLocal(d.days[0].sunrise))) : '—'} · ${d.days[0]?.sunset ? esc(fmt.clock(fmt.parseLocal(d.days[0].sunset))) : '—'}</dd>
      <p>Rise and set</p></div>`;
}

export { esc };
