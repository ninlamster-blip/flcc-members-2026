// GALAGA — the arcade classic, drawn in this app's own system.
//
// The one game here with no end: every wave cleared brings a harder one, and
// the curve flattens at a ceiling rather than running away. Holding left or
// right flies the ship and fires it at once — there is no fire button — so a
// run is played with one thumb while waiting for a lift after the service.
//
// This edition keeps no score, and that holds here too. The engine counts
// points because the kids and teens edition shows them; this screen never
// does. What it shows is how far you got — the wave.
//
// Losing the last ship does not send you back to wave one. The wave reached is
// kept on this device (under `play`, beside the crossword — and nowhere else),
// and both the game-over card and the next visit offer to continue from it, at
// that wave's difficulty, or to start again.
//
// It plays retro sounds (`js/games/chiptune.js`, made in the browser — no
// audio files) for firing, hits and the moments between waves, with a mute
// button in the top bar that this device remembers.
//
// It takes the whole screen while it is open — the header and the tab bar sit
// under it — and ✕, Escape or the back button all put the app back as it was.
//
// The rules and the drawing live in `js/games/galaga.js`, a deliberate
// duplicate of the kids edition's file on the same terms as the crossword:
// `test/galaga.test.mjs` fails when the two drift.

import { h, moment, pill } from '../core/ui.js';
import * as galaga from '../games/galaga.js';
import * as chiptune from '../games/chiptune.js';
import * as store from '../core/storage.js';

/** The palette, read out of the stylesheet so no colour is written down twice. */
function palette() {
  const css = getComputedStyle(document.documentElement);
  const read = (name) => css.getPropertyValue(`--${name}`).trim();
  return {
    paper: read('paper'), ink: read('ink'), faint: read('ink-12'), captain: read('captain'),
    poppy: read('poppy'), rose: read('rose'), sunshine: read('sunshine'), sky: read('sky'),
  };
}

/** The mute button's two faces, drawn in currentColor so they follow the ink. */
const SPEAKER = {
  on: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M15.5 9a4.5 4.5 0 010 6M18.5 6.5a8 8 0 010 11"/></svg>',
  off: '<svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 9.5h3.5L12 5.5v13l-4.5-4H4z"/><path d="M16 9.5l5 5M21 9.5l-5 5"/></svg>',
};

export default async function galagaScreen(ctx) {
  const play = () => store.read(store.KEYS.play, {}) || {};
  // The wave a continued run picks up from. Only the wave: this edition keeps no score.
  const savedWave = () => Math.max(1, Math.trunc((play().galaga || {}).wave) || 1);
  const keepWave = (wave) => store.write(store.KEYS.play, { ...play(), galaga: { wave } });
  const seed = () => Date.now() % 2147483647;
  let state = galaga.create(seed(), { wave: savedWave() });
  // Sound is on unless this device has been told otherwise.
  const sound = chiptune.player({ muted: Boolean(play().galagaMuted) });
  const held = { left: false, right: false };
  let raf = 0;
  let last = 0;
  let attached = false;
  let shown = null;                 // the game-over moment, if one is open
  let gone = false;
  const home = location.hash;       // this screen's route, to notice leaving it

  const canvas = h('canvas', { 'aria-label': 'Galaga. Hold left or right to fly and fire.', role: 'img' });
  const g = canvas.getContext('2d');
  const colors = palette();

  const waveEl = h('p', { class: 'headline', text: '1' });
  const livesEl = h('p', { class: 'label dim', text: '' });

  const paintNumbers = () => {
    waveEl.textContent = String(state.wave);
    livesEl.textContent = `${state.lives} ${state.lives === 1 ? 'ship' : 'ships'} left`;
  };

  const size = () => {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.round(canvas.clientWidth * ratio);
    if (width && canvas.width !== width) {
      canvas.width = width;
      canvas.height = Math.round(width * galaga.HEIGHT / galaga.WIDTH);
    }
    return ratio;
  };

  const draw = () => {
    const ratio = size();
    if (canvas.width) galaga.paint(g, state, { colors, scale: canvas.width / galaga.WIDTH, edge: 3 * ratio });
  };

  /**
   * A card with two ways out: carry on from the saved wave, or start again
   * from one. The kit's moment has one action, so the second is a quiet pill
   * beside it that picks "fresh" and then presses the first — which keeps
   * every close path (the button, Escape, leaving the screen) in one place.
   */
  const choose = ({ eyebrow, big, line }) => {
    let fresh = false;
    shown = moment({
      tone: 'sky', eyebrow, big, line,
      action: `Continue from wave ${savedWave()}`,
      onclose: () => begin(fresh),
    });
    const main = shown.querySelector('.pill');
    main.parentElement.classList.add('pill-row');
    main.parentElement.appendChild(pill('Start from wave 1', () => { fresh = true; main.click(); }, { quiet: true }));
  };

  const over = () => {
    keepWave(state.wave);
    paintNumbers();
    if (state.wave === 1) {
      shown = moment({
        tone: 'sky', eyebrow: 'Galaga', big: 'WAVE 1.',
        line: 'Another run whenever you like.', action: 'Fly again',
        onclose: () => begin(true),
      });
      return;
    }
    choose({
      eyebrow: 'Galaga',
      big: `WAVE ${state.wave}.`,
      line: `Carry on from wave ${state.wave} with three new ships, or start again from the beginning.`,
    });
  };

  const frame = (now) => {
    raf = 0;
    if (!canvas.isConnected) { if (attached) { teardown(); return; } raf = requestAnimationFrame(frame); return; }
    if (!attached) document.body.toggleAttribute('data-arcade', true);
    attached = true;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    const events = galaga.step(state, held, dt);
    sound.play(events);
    if (events.some((one) => one !== 'fire')) paintNumbers();
    // Every new wave is a place to come back to, even if the game is simply closed.
    if (events.includes('wave')) keepWave(state.wave);
    draw();
    if (state.over) { over(); return; }
    raf = requestAnimationFrame(frame);
  };

  function begin(fresh) {
    if (fresh) keepWave(1);
    state = galaga.create(seed(), { wave: savedWave() });
    last = 0;
    paintNumbers();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const press = (side, on) => {
    if (on) sound.wake();
    held[side] = on;
    pads[side].toggleAttribute('data-held', on);
  };

  const hold = (side, symbolText, name) => h('button', {
    type: 'button', 'aria-label': name, text: symbolText,
    onpointerdown: (event) => { event.preventDefault(); press(side, true); },
    onpointerup: () => press(side, false),
    onpointerleave: () => press(side, false),
    onpointercancel: () => press(side, false),
    oncontextmenu: (event) => event.preventDefault(),
  });
  const pads = { left: hold('left', '◀', 'Fly left and fire'), right: hold('right', '▶', 'Fly right and fire') };

  // The field itself is a pad too: the left half flies left, the right half right.
  const fieldSide = (event) => (event.offsetX < canvas.clientWidth / 2 ? 'left' : 'right');
  canvas.addEventListener('pointerdown', (event) => {
    event.preventDefault();
    canvas.setPointerCapture?.(event.pointerId);
    press(fieldSide(event), true);
  });
  const lift = () => { press('left', false); press('right', false); };
  canvas.addEventListener('pointerup', lift);
  canvas.addEventListener('pointercancel', lift);

  const KEYS = { ArrowLeft: 'left', a: 'left', A: 'left', ArrowRight: 'right', d: 'right', D: 'right' };
  const onKey = (event) => {
    if (!canvas.isConnected) { teardown(); return; }
    if (event.key === 'Escape' && event.type === 'keydown' && !document.querySelector('.moment')) { leave(); return; }
    const side = KEYS[event.key];
    if (!side || document.querySelector('.moment')) return;
    event.preventDefault();
    press(side, event.type === 'keydown');
  };
  const onHide = () => { if (document.hidden) lift(); };
  // The back button leaves without a click anywhere in here, and after a game
  // over the loop is not running to notice — so watch the route as well.
  const onRoute = () => { if (location.hash !== home) teardown(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('hashchange', onRoute);
  function teardown() {
    if (gone) return;
    gone = true;
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('hashchange', onRoute);
    document.body.removeAttribute('data-arcade');
    sound.close();
    if (shown && shown.isConnected) shown.remove();
  }
  const leave = () => { teardown(); ctx.go('play'); };

  // The mute button. Tapping it is a press too, so it can wake the sound.
  const mute = h('button', { class: 'arcade-close', type: 'button' });
  const paintMute = () => {
    mute.innerHTML = sound.muted ? SPEAKER.off : SPEAKER.on;
    mute.setAttribute('aria-label', sound.muted ? 'Turn sound on' : 'Turn sound off');
    mute.setAttribute('aria-pressed', String(sound.muted));
  };
  mute.addEventListener('click', () => {
    sound.muted = !sound.muted;
    store.write(store.KEYS.play, { ...play(), galagaMuted: sound.muted });
    if (!sound.muted) sound.wake();
    paintMute();
  });
  paintMute();

  const parts = [
    // The whole screen, while the game is open: the wave in a thin bar, the
    // field as large as the window allows, the pads under the thumbs.
    h('div', { class: 'arcade-stage', role: 'application', 'aria-label': 'Galaga' },
      h('div', { class: 'arcade-bar' },
        h('button', { class: 'arcade-close', type: 'button', 'aria-label': 'Close Galaga', text: '✕', onclick: leave }),
        h('div', {}, waveEl, h('p', { class: 'label dim', text: 'wave' })),
        h('span', { class: 'grow' }),
        h('div', { class: 'stat' }, h('p', { class: 'label', text: 'No end' }), livesEl),
        mute),
      h('div', { class: 'arcade-well' }, h('div', { class: 'arcade' }, canvas)),
      h('div', { class: 'arcade-pad' }, pads.left, pads.right)),
  ];

  const el = h('div', { style: 'display:contents' }, ...parts);
  paintNumbers();
  raf = requestAnimationFrame(frame);
  if (savedWave() > 1) {
    choose({
      eyebrow: 'Galaga',
      big: `WAVE ${savedWave()}.`,
      line: 'Pick up where you left off, or start again from wave 1.',
    });
  }
  return { title: 'Galaga', el };
}
