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
// It takes the whole screen while it is open — the header and the tab bar sit
// under it — and ✕, Escape or the back button all put the app back as it was.
//
// The rules and the drawing live in `js/games/galaga.js`, a deliberate
// duplicate of the kids edition's file on the same terms as the crossword:
// `test/galaga.test.mjs` fails when the two drift.

import { h, moment } from '../core/ui.js';
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

export default async function galagaScreen(ctx) {
  let state = galaga.create(Date.now() % 2147483647);
  let furthest = 0;                 // this sitting only; nothing is saved
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

  const over = () => {
    const before = furthest;
    furthest = Math.max(furthest, state.wave);
    paintNumbers();
    shown = moment({
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
    if (!attached) document.body.toggleAttribute('data-arcade', true);
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
    if (shown && shown.isConnected) shown.remove();
  }
  const leave = () => { teardown(); ctx.go('play'); };

  const parts = [
    // The whole screen, while the game is open: the wave in a thin bar, the
    // field as large as the window allows, the pads under the thumbs.
    h('div', { class: 'arcade-stage', role: 'application', 'aria-label': 'Galaga' },
      h('div', { class: 'arcade-bar' },
        h('button', { class: 'arcade-close', type: 'button', 'aria-label': 'Close Galaga', text: '✕', onclick: leave }),
        h('div', {}, waveEl, h('p', { class: 'label dim', text: 'wave' })),
        h('span', { class: 'grow' }),
        h('div', { class: 'stat' }, h('p', { class: 'label', text: 'No end' }), livesEl)),
      h('div', { class: 'arcade-well' }, h('div', { class: 'arcade' }, canvas)),
      h('div', { class: 'arcade-pad' }, pads.left, pads.right)),
  ];

  const el = h('div', { style: 'display:contents' }, ...parts);
  paintNumbers();
  raf = requestAnimationFrame(frame);
  return { title: 'Galaga', el };
}
