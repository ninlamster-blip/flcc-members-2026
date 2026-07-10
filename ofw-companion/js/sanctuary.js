// The Daily Sanctuary layer of the home screen: date, weather, time-of-day
// light, family-occasion greetings, the daily ritual pill, the "I'm not okay
// today" path, and the breathing exercise. Everything degrades gracefully —
// no permission, no network, no problem.
import { getState, updateState } from './state.js';
import { escapeHtml } from './utils.js';

// ── Time of day ──────────────────────────────────────────────────────────────

export function currentPeriod(h = new Date().getHours()) {
  if (h < 5) return 'night';
  if (h < 11) return 'morning';
  if (h < 17) return 'day';
  if (h < 20) return 'dusk';
  return 'night';
}

export function applyPeriodTheme() {
  document.body.dataset.period = currentPeriod();
}

// ── Date & family occasions ──────────────────────────────────────────────────

export function dateLine() {
  return new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });
}

// Days when homesickness bites hardest deserve an extra word of care.
export function occasionLine() {
  const now = new Date();
  const m = now.getMonth() + 1;
  const d = now.getDate();
  if (m === 12 && d >= 16 && d <= 24) return 'Kapaskuhan na — kahit malayo, kasama ka ng pamilya mo sa puso at sa panalangin.';
  if (m === 12 && d === 25) return 'Maligayang Pasko! Mahal na mahal ka — dito at sa bahay.';
  if (m === 12 && d >= 26) return 'Papalapit na ang Bagong Taon — ipinagmamalaki ka ng pamilya mo.';
  if (m === 1 && d === 1) return 'Manigong Bagong Taon! Bagong taon, bagong biyaya.';
  if (m === 11 && d === 1) return 'Undas ngayon — okay lang mangulila. Kasama ka namin sa pag-alala.';
  if (m === 2 && d === 14) return 'Araw ng mga Puso — mahal ka, at hindi ka nag-iisa.';
  if (m === 5 && now.getDay() === 0 && d >= 8 && d <= 14) return 'Mother’s Day — sa lahat ng nanay na nagsasakripisyo mula sa malayo: bayani ka.';
  if (m === 6 && now.getDay() === 0 && d >= 15 && d <= 21) return 'Father’s Day — sa mga tatay na nagtitiis para sa pamilya: nakikita ka.';
  return '';
}

// ── Weather (Open-Meteo, free, no key) ───────────────────────────────────────

async function fetchWeather(lat, lon) {
  const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current=temperature_2m,weather_code`;
  const res = await fetch(url);
  if (!res.ok) throw new Error('weather unavailable');
  const data = await res.json();
  return { temp: Math.round(data.current.temperature_2m), code: data.current.weather_code };
}

// Renders into the chip: cached weather instantly, fresh weather quietly, or
// a gentle "add weather" invitation until the member opts in.
export async function initWeather(chipEl) {
  const s = getState();

  const show = (w) => {
    chipEl.textContent = `${w.temp}°C`;
    chipEl.hidden = false;
  };

  const cached = s.weatherCache;
  if (cached && Date.now() - cached.at < 45 * 60 * 1000) { show(cached); return; }
  if (cached) show(cached); // stale is better than blank while we refresh

  if (s.geo) {
    try {
      const w = await fetchWeather(s.geo.lat, s.geo.lon);
      updateState((st) => { st.weatherCache = { at: Date.now(), ...w }; });
      show(w);
    } catch { /* offline — the cached or hidden chip stands */ }
    return;
  }

  if (!('geolocation' in navigator)) return;
  // Not yet set up: offer, don't demand.
  chipEl.textContent = 'Add weather';
  chipEl.hidden = false;
  chipEl.addEventListener('click', () => {
    chipEl.textContent = '…';
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const geo = { lat: +pos.coords.latitude.toFixed(2), lon: +pos.coords.longitude.toFixed(2) };
      updateState((st) => { st.geo = geo; });
      try {
        const w = await fetchWeather(geo.lat, geo.lon);
        updateState((st) => { st.weatherCache = { at: Date.now(), ...w }; });
        show(w);
      } catch { chipEl.hidden = true; }
    }, () => { chipEl.hidden = true; }, { timeout: 10000, maximumAge: 600000 });
  }, { once: true });
}

// ── Isang Minutong Salita (1-minute audio drop) ──────────────────────────────
// Plays the newest entry in data/audiodrops.json that has an audio src.
// Until real recordings are added, it shows a warm placeholder state.

export function initAudioDrop(audiodrops) {
  const card = document.getElementById('oc-audio-drop');
  const playBtn = document.getElementById('oc-audio-play');
  const title = document.getElementById('oc-audio-title');
  const sub = document.getElementById('oc-audio-sub');
  const audio = document.getElementById('oc-audio-el');

  const drop = (audiodrops.drops || []).filter((d) => d.src).pop();
  card.hidden = false;
  title.textContent = audiodrops.title || 'Isang Minutong Salita';

  if (!drop) {
    sub.textContent = audiodrops.placeholderNote || 'Malapit na, kapatid.';
    playBtn.disabled = true;
    return;
  }

  sub.textContent = drop.title;
  audio.src = drop.src;
  playBtn.addEventListener('click', () => {
    navigator.vibrate?.(8);
    if (audio.paused) {
      audio.play().catch(() => { sub.textContent = 'Hindi ma-play ngayon — subukan ulit mamaya.'; });
      playBtn.textContent = '❚❚';
    } else {
      audio.pause();
      playBtn.textContent = '▶';
    }
  });
  audio.addEventListener('ended', () => { playBtn.textContent = '▶'; });
}

// ── Daily ritual pill ────────────────────────────────────────────────────────
// One gentle invitation per time of day — a rhythm, not a notification.

export function ritualFor(period) {
  if (period === 'morning') {
    return { text: 'Simulan ang umaga sa panalangin', action: 'faith' };
  }
  if (period === 'day') {
    return { text: 'Take a slow breathing break', action: 'breathe' };
  }
  if (period === 'dusk') {
    return { text: 'Uminom ka na ba ng tubig? Unat-unat din', action: 'breathe' };
  }
  return { text: 'Isulat ang isang pasasalamat bago matulog', action: 'journal' };
}

// ── Breathing exercise ───────────────────────────────────────────────────────

let breathTimer = null;

export function openBreathing() {
  const overlay = document.getElementById('oc-breathe');
  const label = document.getElementById('oc-breathe-label');
  overlay.hidden = false;
  navigator.vibrate?.(8);
  const phases = [
    { text: 'Huminga… breathe in', ms: 4000 },
    { text: 'Hawakan… hold', ms: 4000 },
    { text: 'Ilabas… breathe out', ms: 6000 },
  ];
  let i = 0;
  const step = () => {
    label.textContent = phases[i % 3].text;
    breathTimer = setTimeout(step, phases[i % 3].ms);
    i += 1;
  };
  step();
}

export function closeBreathing() {
  clearTimeout(breathTimer);
  document.getElementById('oc-breathe').hidden = true;
}

// ── "I'm not okay today" ─────────────────────────────────────────────────────

export function initNotOkay({ verses, onTalk, goTo, toast }) {
  const sheet = document.getElementById('oc-notokay');
  const btn = document.getElementById('oc-notokay-btn');
  btn.addEventListener('click', () => {
    navigator.vibrate?.(8);
    renderNotOkay(sheet, { verses, onTalk, goTo, toast });
    sheet.hidden = false;
  });
  sheet.addEventListener('click', (e) => { if (e.target === sheet) sheet.hidden = true; });
}

function renderNotOkay(sheet, { verses, onTalk, goTo }) {
  const faithOn = getState().settings.faithEnabled;
  const verse = faithOn ? verses.heavy[Math.floor(Math.random() * verses.heavy.length)] : null;
  const body = sheet.querySelector('#oc-notokay-body');
  body.innerHTML = `
    <p class="oc-onboard-text">Salamat sa katapangan mong sabihin 'yan. Hindi mo kailangang ayusin ang lahat ngayon. Piliin lang kung ano ang makakatulong sa'yo sa sandaling ito:</p>
    <button type="button" class="oc-notokay-option" data-nook="breathe"><span>🫁</span><span><strong>Huminga muna tayo</strong><br><span class="oc-muted">A slow one-minute breathing exercise</span></span></button>
    <button type="button" class="oc-notokay-option" data-nook="talk"><span>💬</span><span><strong>Kausapin si Kaibigan</strong><br><span class="oc-muted">Walang husga — ikwento mo lang</span></span></button>
    ${faithOn ? `<button type="button" class="oc-notokay-option" data-nook="pray"><span>🙏</span><span><strong>Ipanalangin ako</strong><br><span class="oc-muted">A prayer written for your heart today</span></span></button>` : ''}
    <button type="button" class="oc-notokay-option" data-nook="help"><span>🧭</span><span><strong>Kailangan ko ng tunay na tulong</strong><br><span class="oc-muted">Hotlines, embassy, at mga taong handang tumulong</span></span></button>
    ${verse ? `<div class="oc-notokay-verse">“${escapeHtml(verse.text)}”<br><span class="oc-verse-ref">${escapeHtml(verse.ref)}</span></div>` : ''}`;

  body.querySelectorAll('[data-nook]').forEach((opt) => {
    opt.addEventListener('click', () => {
      sheet.hidden = true;
      const kind = opt.dataset.nook;
      if (kind === 'breathe') openBreathing();
      else if (kind === 'talk') onTalk();
      else if (kind === 'pray') goTo('faith');
      else if (kind === 'help') goTo('support');
    });
  });
}
