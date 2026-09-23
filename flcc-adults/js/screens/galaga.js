// GALAGA — the arcade classic, drawn in this app's own system.
//
// The one game here with no end: every wave cleared brings a harder one, and
// the curve flattens at a ceiling rather than running away. Holding left or
// right flies the ship and fires it at once — there is no fire button — so a
// run is played with one thumb while waiting for a lift after the service.
//
// This edition keeps no score, and that holds here too. The engine counts
// points because the kids and teens edition shows them; this screen never
// does. What it shows is how far you got — the wave — and it keeps nothing
// once the screen is closed.
//
// The rules and the drawing live in `js/games/galaga.js`, a deliberate
// duplicate of the kids edition's file on the same terms as the crossword:
// `test/galaga.test.mjs` fails when the two drift.

import { h, poster, label, note, moment } from '../core/ui.js';
import * as galaga from '../games/galaga.js';

/** The palette, read out of the stylesheet so no colour is written down twice. */
function palette() {
  const css = getComputedStyle(document.documentElement);
  const read = (name) => css.getPropertyValue(`--${name}`).trim();
  return {
    paper: read('paper'), ink: read('ink'), faint: read('ink-12'), captain: read('captain'),
    poppy: read('poppy'), rose: read('rose'), sunshine: read('sunshine'), sky: read('sky'),
  };
}

export default async function galagaScreen() {
  let state = galaga.create(Date.now() % 2147483647);
  let furthest = 0;                 // this sitting only; nothing is saved
  const held = { left: false, right: false };
  let raf = 0;
  let last = 0;
  let attached = false;

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

  const over = () => {
    const before = furthest;
    furthest = Math.max(furthest, state.wave);
    paintNumbers();
    moment({
      tone: 'sky',
      eyebrow: 'Galaga',
      big: `WAVE ${state.wave}.`,
      line: before && state.wave > before
        ? 'Further than any run this sitting.'
        : `You reached wave ${state.wave}. Another run whenever you like.`,
      action: 'Fly again',
      onclose: restart,
    });
  };

  const frame = (now) => {
    raf = 0;
    if (!canvas.isConnected) { if (attached) { teardown(); return; } raf = requestAnimationFrame(frame); return; }
    attached = true;
    const dt = last ? (now - last) / 1000 : 0;
    last = now;
    const events = galaga.step(state, held, dt);
    if (events.some((one) => one !== 'fire')) paintNumbers();
    draw();
    if (state.over) { over(); return; }
    raf = requestAnimationFrame(frame);
  };

  function restart() {
    state = galaga.create(Date.now() % 2147483647);
    last = 0;
    paintNumbers();
    if (!raf) raf = requestAnimationFrame(frame);
  }

  const press = (side, on) => {
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
    const side = KEYS[event.key];
    if (!side || document.querySelector('.moment')) return;
    event.preventDefault();
    press(side, event.type === 'keydown');
  };
  const onHide = () => { if (document.hidden) lift(); };
  window.addEventListener('keydown', onKey);
  window.addEventListener('keyup', onKey);
  document.addEventListener('visibilitychange', onHide);
  function teardown() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
    window.removeEventListener('keydown', onKey);
    window.removeEventListener('keyup', onKey);
    document.removeEventListener('visibilitychange', onHide);
  }

  const parts = [
    // One poster, numbers on top: a separate poster for them pushed the pads
    // under the tab bar on a phone, and the pads are the whole game.
    poster({ tone: 'sky' },
      h('div', { class: 'arcade-hud' },
        h('div', {}, waveEl, h('p', { class: 'label dim', text: 'wave' })),
        h('div', { style: 'text-align:right' }, h('p', { class: 'label', text: 'No end' }), livesEl)),
      h('div', { class: 'arcade' }, canvas),
      h('div', { class: 'arcade-pad' }, pads.left, pads.right)),

    poster({ tone: 'paper' },
      label('How it works'),
      h('p', { class: 'body', text: 'Hold ◀ or ▶ to fly. While the ship moves it fires by itself; let go and it stops. Every wave is harder than the last — more ships, faster dives, more fire coming back — and there is always another. On a keyboard, the arrow keys.' }),
      note('There is no score here and nothing is kept. When you have had enough, close it.')),
  ];

  const el = h('div', { style: 'display:contents' }, ...parts);
  paintNumbers();
  raf = requestAnimationFrame(frame);
  return { title: 'Galaga', el };
}
