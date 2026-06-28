// Writing Practice — trace kana/kanji on a canvas over a faint guide.
import { HIRAGANA_BASE, KATAKANA_BASE } from '../../data/kana.js';
import { KANJI } from '../../data/kanji.js';
import { State, save, speak, addXp, touchActivity, el } from '../core.js';

let set = 'hiragana';
let glyph = 'あ';
let showGuide = true;

function chars() {
  if (set === 'hiragana') return HIRAGANA_BASE.filter(Boolean).map(x => x.k);
  if (set === 'katakana') return KATAKANA_BASE.filter(Boolean).map(x => x.k);
  return KANJI.map(k => k.c);
}

export function render(root) {
  if (!chars().includes(glyph)) glyph = chars()[0];
  root.innerHTML = `
    <div class="fade-in">
      <div class="eyebrow">Writing Practice</div>
      <h1 style="font-size:28px;font-weight:800;letter-spacing:-.6px;">Writing Practice</h1>
      <p class="muted" style="margin-bottom:18px;">Trace the character with your mouse or finger. Toggle the guide once you're confident.</p>

      <div class="spread wrap" style="gap:12px;margin-bottom:16px;">
        <div class="seg" id="setSeg">
          <button data-s="hiragana" class="${set === 'hiragana' ? 'on' : ''}">Hiragana</button>
          <button data-s="katakana" class="${set === 'katakana' ? 'on' : ''}">Katakana</button>
          <button data-s="kanji" class="${set === 'kanji' ? 'on' : ''}">Kanji</button>
        </div>
        <button class="btn ghost sm" id="guideBtn">${showGuide ? '👁 Guide on' : '🚫 Guide off'}</button>
      </div>

      <div class="row wrap" id="charRow" style="gap:6px;margin-bottom:20px;max-height:120px;overflow:auto;"></div>

      <div class="card card-pad" style="display:flex;flex-direction:column;align-items:center;gap:16px;">
        <div style="position:relative;width:300px;height:300px;">
          <div id="guideGlyph" class="jp" style="position:absolute;inset:0;display:grid;place-items:center;
            font-size:230px;color:#f0f0f2;user-select:none;pointer-events:none;
            ${showGuide ? '' : 'opacity:0;'}">${glyph}</div>
          <canvas id="pad" width="300" height="300"
            style="position:relative;border:1px solid var(--border);border-radius:var(--r-md);
            touch-action:none;cursor:crosshair;background:transparent;"></canvas>
          <div style="position:absolute;left:50%;top:0;bottom:0;width:1px;background:repeating-linear-gradient(#eee,#eee 6px,transparent 6px,transparent 12px);pointer-events:none;"></div>
          <div style="position:absolute;top:50%;left:0;right:0;height:1px;background:repeating-linear-gradient(to right,#eee,#eee 6px,transparent 6px,transparent 12px);pointer-events:none;"></div>
        </div>
        <div class="row" style="gap:10px;">
          <button class="btn ghost" id="hear">🔊 Hear</button>
          <button class="btn ghost" id="clear">Clear</button>
          <button class="btn accent" id="done">Done ✓</button>
        </div>
      </div>
    </div>`;

  root.querySelector('#setSeg').onclick = (e) => {
    const b = e.target.closest('button'); if (!b) return;
    set = b.dataset.s; glyph = chars()[0]; render(root);
  };
  root.querySelector('#guideBtn').onclick = () => { showGuide = !showGuide; render(root); };

  const charRow = root.querySelector('#charRow');
  chars().forEach(c => {
    const chip = el(`<button class="chip jp ${c === glyph ? 'accent' : ''}" style="font-size:18px;">${c}</button>`);
    chip.onclick = () => { glyph = c; render(root); };
    charRow.appendChild(chip);
  });

  setupCanvas(root);
}

function setupCanvas(root) {
  const canvas = root.querySelector('#pad');
  const ctx = canvas.getContext('2d');
  ctx.lineWidth = 12; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
  ctx.strokeStyle = '#1a1a1a';
  let drawing = false;

  const pos = (e) => {
    const r = canvas.getBoundingClientRect();
    const p = e.touches ? e.touches[0] : e;
    return { x: (p.clientX - r.left) * (canvas.width / r.width),
             y: (p.clientY - r.top) * (canvas.height / r.height) };
  };
  const startD = (e) => { e.preventDefault(); drawing = true; const { x, y } = pos(e); ctx.beginPath(); ctx.moveTo(x, y); };
  const moveD = (e) => { if (!drawing) return; e.preventDefault(); const { x, y } = pos(e); ctx.lineTo(x, y); ctx.stroke(); };
  const endD = () => { drawing = false; };

  canvas.addEventListener('mousedown', startD);
  canvas.addEventListener('mousemove', moveD);
  window.addEventListener('mouseup', endD);
  canvas.addEventListener('touchstart', startD, { passive: false });
  canvas.addEventListener('touchmove', moveD, { passive: false });
  canvas.addEventListener('touchend', endD);

  root.querySelector('#clear').onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
  root.querySelector('#hear').onclick = () => speak(glyph);
  root.querySelector('#done').onclick = () => {
    addXp(4); save(); touchActivity();
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const next = chars()[(chars().indexOf(glyph) + 1) % chars().length];
    glyph = next; render(root);
  };
}
