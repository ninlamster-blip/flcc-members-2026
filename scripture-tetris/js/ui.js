// Canvas rendering: board, ghost piece, hold/next previews, and a small
// particle system for line-clear celebration. No game-logic here.
import { COLS, ROWS, HIDDEN_ROWS, PIECES } from './tetromino.js';

const LETTER = { I: 'I', O: 'O', T: 'T', S: 'S', Z: 'Z', J: 'J', L: 'L' };

export class BoardRenderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.particles = [];
    this.colorBlind = false;
    this.highContrast = false;
    this._resize();
  }

  _resize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = this.canvas.getBoundingClientRect();
    const cell = Math.floor(Math.min(rect.width / COLS, rect.height / ROWS));
    this.cell = Math.max(cell, 8);
    this.canvas.width = this.cell * COLS * dpr;
    this.canvas.height = this.cell * ROWS * dpr;
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    this.offsetX = (rect.width - this.cell * COLS) / 2;
  }

  _blockColor(key) {
    return PIECES[key].color;
  }

  _drawCell(ctx, x, y, size, color, alpha = 1, ghost = false, label = null) {
    ctx.save();
    ctx.globalAlpha = alpha;
    const r = size * 0.18;
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + size, y, x + size, y + size, r);
    ctx.arcTo(x + size, y + size, x, y + size, r);
    ctx.arcTo(x, y + size, x, y, r);
    ctx.arcTo(x, y, x + size, y, r);
    ctx.closePath();
    if (ghost) {
      ctx.strokeStyle = color;
      ctx.lineWidth = Math.max(1.5, size * 0.08);
      ctx.stroke();
    } else {
      const grad = ctx.createLinearGradient(x, y, x + size, y + size);
      grad.addColorStop(0, color);
      grad.addColorStop(1, this._shade(color, -22));
      ctx.fillStyle = grad;
      ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,0.25)';
      ctx.lineWidth = Math.max(1, size * 0.04);
      ctx.stroke();
    }
    ctx.restore();
    if (label) {
      ctx.save();
      ctx.globalAlpha = ghost ? 0.9 : 0.85;
      ctx.fillStyle = ghost ? color : 'rgba(0,0,0,0.55)';
      ctx.font = `700 ${Math.floor(size * 0.42)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(label, x + size / 2, y + size / 2 + 1);
      ctx.restore();
    }
  }

  _shade(hex, percent) {
    const n = parseInt(hex.slice(1), 16);
    const r = Math.min(255, Math.max(0, ((n >> 16) & 255) + percent));
    const g = Math.min(255, Math.max(0, ((n >> 8) & 255) + percent));
    const b = Math.min(255, Math.max(0, (n & 255) + percent));
    return `rgb(${r},${g},${b})`;
  }

  render(game) {
    this._resize();
    const { ctx, cell } = this;
    const w = cell * COLS;
    const h = cell * ROWS;
    ctx.clearRect(0, 0, w + this.offsetX * 2, h);
    ctx.save();
    ctx.translate(this.offsetX, 0);

    // grid
    ctx.strokeStyle = this.highContrast ? 'rgba(255,255,255,0.22)' : 'rgba(255,255,255,0.09)';
    ctx.lineWidth = 1;
    for (let c = 0; c <= COLS; c++) {
      ctx.beginPath(); ctx.moveTo(c * cell, 0); ctx.lineTo(c * cell, h); ctx.stroke();
    }
    for (let r = 0; r <= ROWS; r++) {
      ctx.beginPath(); ctx.moveTo(0, r * cell); ctx.lineTo(w, r * cell); ctx.stroke();
    }

    // a brighter outline around the whole play field so its edge reads
    // clearly against the dark background, not just the faint cell grid
    ctx.strokeStyle = this.highContrast ? 'rgba(255,255,255,0.9)' : 'rgba(148, 128, 255, 0.6)';
    ctx.lineWidth = 2;
    ctx.strokeRect(1, 1, w - 2, h - 2);

    // locked cells
    for (let r = HIDDEN_ROWS; r < ROWS + HIDDEN_ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const key = game.board[r][c];
        if (key) {
          this._drawCell(ctx, c * cell, (r - HIDDEN_ROWS) * cell, cell, this._blockColor(key), 1, false, this.colorBlind ? LETTER[key] : null);
        }
      }
    }

    if (!game.gameOver) {
      // ghost
      const ghostRow = game.ghostRow();
      const cells = PIECES[game.piece.key].states[game.piece.state];
      for (const [dr, dc] of cells) {
        const r = ghostRow + dr - HIDDEN_ROWS;
        const c = game.piece.col + dc;
        if (r >= 0) this._drawCell(ctx, c * cell, r * cell, cell, this._blockColor(game.piece.key), 0.5, true);
      }
      // active piece
      for (const [dr, dc] of cells) {
        const r = game.piece.row + dr - HIDDEN_ROWS;
        const c = game.piece.col + dc;
        if (r >= 0) this._drawCell(ctx, c * cell, r * cell, cell, this._blockColor(game.piece.key), 1, false, this.colorBlind ? LETTER[game.piece.key] : null);
      }
    }

    this._renderParticles(ctx);
    ctx.restore();
  }

  spawnLineClearParticles(rows) {
    for (const r of rows) {
      const y = (r - HIDDEN_ROWS) * this.cell + this.cell / 2;
      for (let i = 0; i < 18; i++) {
        this.particles.push({
          x: Math.random() * this.cell * COLS,
          y,
          vx: (Math.random() - 0.5) * 220,
          vy: -140 - Math.random() * 140,
          life: 0,
          maxLife: 0.6 + Math.random() * 0.4,
          color: ['#FFD84D', '#5FE3FF', '#C77DFF', '#6BFFA0'][i % 4],
          size: 3 + Math.random() * 3,
        });
      }
    }
  }

  _renderParticles(ctx) {
    const dt = 1 / 60;
    this.particles = this.particles.filter((p) => p.life < p.maxLife);
    for (const p of this.particles) {
      p.life += dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vy += 420 * dt;
      const alpha = Math.max(0, 1 - p.life / p.maxLife);
      ctx.save();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = p.color;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }
}

export function renderMini(canvas, pieceKey, { colorBlind = false } = {}) {
  const ctx = canvas.getContext('2d');
  const dpr = window.devicePixelRatio || 1;
  const cssSize = canvas.width / dpr || canvas.clientWidth || 72;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssSize, cssSize);
  if (!pieceKey) return;
  const def = PIECES[pieceKey];
  const cells = def.states[0];
  const minR = Math.min(...cells.map((c) => c[0]));
  const maxR = Math.max(...cells.map((c) => c[0]));
  const minC = Math.min(...cells.map((c) => c[1]));
  const maxC = Math.max(...cells.map((c) => c[1]));
  const spanR = maxR - minR + 1;
  const spanC = maxC - minC + 1;
  const cell = Math.floor((cssSize - 12) / Math.max(spanR, spanC));
  const offX = (cssSize - spanC * cell) / 2;
  const offY = (cssSize - spanR * cell) / 2;
  for (const [r, c] of cells) {
    const x = offX + (c - minC) * cell;
    const y = offY + (r - minR) * cell;
    drawStaticCell(ctx, x, y, cell, def.color, colorBlind ? LETTER[pieceKey] : null);
  }
}

function drawStaticCell(ctx, x, y, size, color, label) {
  ctx.save();
  const rad = size * 0.18;
  ctx.beginPath();
  ctx.moveTo(x + rad, y);
  ctx.arcTo(x + size, y, x + size, y + size, rad);
  ctx.arcTo(x + size, y + size, x, y + size, rad);
  ctx.arcTo(x, y + size, x, y, rad);
  ctx.arcTo(x, y, x + size, y, rad);
  ctx.closePath();
  const grad = ctx.createLinearGradient(x, y, x + size, y + size);
  grad.addColorStop(0, color);
  grad.addColorStop(1, color);
  ctx.fillStyle = grad;
  ctx.fill();
  ctx.strokeStyle = 'rgba(255,255,255,0.25)';
  ctx.stroke();
  ctx.restore();
  if (label) {
    ctx.save();
    ctx.fillStyle = 'rgba(0,0,0,0.55)';
    ctx.font = `700 ${Math.floor(size * 0.42)}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(label, x + size / 2, y + size / 2 + 1);
    ctx.restore();
  }
}
