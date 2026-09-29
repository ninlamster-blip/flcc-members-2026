// TAP — a soft tick when a button is pressed, and a tiny buzz where the phone allows.
//
// The tick is made here with Web Audio: a triangle wave falling from 1.4 kHz
// to 600 Hz over a few hundredths of a second, very quiet. There is no audio
// file to fetch, so it works offline. The buzz is navigator.vibrate(8) — Android
// honours it; iPhone Safari has no vibration for web pages at all, so iPhones
// get the tick alone. On an iPhone the ringer switch also silences Web Audio,
// so a phone on silent stays silent.
//
// It listens once, on the document, for `click` — a real tap is the only thing
// that lets a phone start audio — and only for the things a person presses:
// buttons, links, pills, choices, tabs. It is off during an arcade game, which
// has its own sounds, and anyone can switch it off (Tap sounds, in settings).

import { getSettings, saveSettings } from './profile.js';

const PRESSABLE = 'button, a[href], [role="button"], .pill, .go, .choice, .tab, summary, input[type="checkbox"], input[type="radio"]';

export const enabled = (settings = getSettings()) => settings.taps !== 'off';
export const setEnabled = (on) => saveSettings({ taps: on ? 'on' : 'off' });

let audio = null;

function tick() {
  const Audio = globalThis.AudioContext || globalThis.webkitAudioContext;
  if (!Audio) return;
  try {
    audio = audio || new Audio();
    if (audio.state === 'suspended') audio.resume();
    const now = audio.currentTime;
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = 'triangle';
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(600, now + 0.03);
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.exponentialRampToValueAtTime(0.06, now + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.045);
    osc.connect(gain).connect(audio.destination);
    osc.start(now);
    osc.stop(now + 0.05);
  } catch { /* no sound is better than a broken button */ }
}

/** The tick and the buzz, if tap sounds are on. */
export function feel() {
  if (!enabled()) return;
  tick();
  try { if (navigator.vibrate) navigator.vibrate(8); } catch { /* not every phone can */ }
}

/** Should pressing this element make a tap? */
export function pressable(target, body = document.body) {
  if (!target || !target.closest || body.hasAttribute('data-arcade')) return false;
  const el = target.closest(PRESSABLE);
  return Boolean(el && !el.disabled && el.getAttribute('aria-disabled') !== 'true');
}

let installed = false;
export function install(root = document) {
  if (installed) return;
  installed = true;
  root.addEventListener('click', (event) => { if (pressable(event.target)) feel(); }, { capture: true, passive: true });
}
