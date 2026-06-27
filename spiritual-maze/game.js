'use strict';
// ============================================================
// WALK IN THE LIGHT — Spiritual Maze
// "The light shines in the darkness..." John 1:5
// ============================================================

const ROWS = 21, COLS = 21;

// 1=wall, 0=dot, 2=armor pellet, 3=open(no dot), 4=ghost door
const MAP_BASE = [
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  [1,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1],
  [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,1],
  [1,0,1,0,1,1,0,1,0,1,1,1,0,1,0,1,1,0,1,0,1],
  [1,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,1],
  [1,1,1,0,1,0,1,1,0,1,1,1,0,1,1,0,1,0,1,1,1],
  [1,0,0,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,0,0,1],
  [1,1,1,0,1,0,1,1,1,1,4,1,1,1,1,0,1,0,1,1,1],
  [1,0,0,0,0,0,1,0,1,3,3,3,1,0,1,0,0,0,0,0,1],
  [1,0,1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,3,0,0,0,0,0,0,0,1,0,1],
  [1,0,1,0,1,0,1,0,1,1,1,1,1,0,1,0,1,0,1,0,1],
  [1,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,1],
  [1,1,1,0,1,0,1,1,0,1,1,1,0,1,1,0,1,0,1,1,1],
  [1,0,0,0,1,0,0,1,0,0,0,0,0,1,0,0,1,0,0,0,1],
  [1,0,1,0,1,1,0,1,0,1,1,1,0,1,0,1,1,0,1,0,1],
  [1,0,1,0,0,0,0,0,0,0,1,0,0,0,0,0,0,0,1,0,1],
  [1,0,1,1,1,0,1,1,1,0,1,0,1,1,1,0,1,1,1,0,1],
  [1,2,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,0,2,1],
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

const ARMOR_PIECES = [
  { name: 'Belt of Truth',               ref: 'Ephesians 6:14a' },
  { name: 'Breastplate of Righteousness',ref: 'Ephesians 6:14b' },
  { name: 'Gospel of Peace',             ref: 'Ephesians 6:15'  },
  { name: 'Shield of Faith',             ref: 'Ephesians 6:16'  },
];

const VERSES = [
  { text: 'Submit to God. Resist the devil, and he will flee from you.', ref: 'James 4:7' },
  { text: 'Greater is he who is in you than he who is in the world.', ref: '1 John 4:4' },
  { text: 'The Lord is my light and my salvation — whom shall I fear?', ref: 'Psalm 27:1' },
  { text: 'No weapon forged against you will prevail.', ref: 'Isaiah 54:17' },
  { text: 'We are more than conquerors through him who loved us.', ref: 'Romans 8:37' },
  { text: 'The Lord will fight for you; you need only to be still.', ref: 'Exodus 14:14' },
  { text: 'The light shines in the darkness, and the darkness has not overcome it.', ref: 'John 1:5' },
  { text: 'Do not be overcome by evil, but overcome evil with good.', ref: 'Romans 12:21' },
  { text: 'I can do all this through him who gives me strength.', ref: 'Philippians 4:13' },
  { text: 'Thanks be to God! He gives us the victory through our Lord Jesus Christ.', ref: '1 Corinthians 15:57' },
];

// Ghost configs: name, color, scatter corner
const GHOSTS_CFG = [
  { name: 'FEAR',       color: '#EF4444', sr: 1,  sc: 1  },
  { name: 'DOUBT',      color: '#8B5CF6', sr: 1,  sc: 19 },
  { name: 'TEMPTATION', color: '#06B6D4', sr: 19, sc: 19 },
  { name: 'PRIDE',      color: '#F59E0B', sr: 19, sc: 1  },
];

// Ghost start positions and release timers
const GHOST_START = [[7,9],[7,11],[9,10],[9,9]];
const GHOST_RELEASE = [0, 0, 150, 300];

// Per-level config: player speed, ghost speed, power frames, ghost release timers, scatter/chase durations
const LEVEL_CONFIG = [
  { ps: 0.070, gs: 0.055, pf: 600, rel: [0, 80, 9999, 9999], sct: 300, chs: 420 }, // L1 — very easy, 2 ghosts
  { ps: 0.082, gs: 0.068, pf: 500, rel: [0, 50, 220, 9999],  sct: 240, chs: 480 }, // L2 — 3 ghosts
  { ps: 0.094, gs: 0.082, pf: 420, rel: [0, 30, 160, 380],   sct: 200, chs: 540 }, // L3 — all 4 ghosts
  { ps: 0.106, gs: 0.096, pf: 330, rel: [0, 20, 130, 300],   sct: 160, chs: 600 }, // L4 — faster
  { ps: 0.118, gs: 0.110, pf: 240, rel: [0, 0,  100, 220],   sct: 120, chs: 660 }, // L5 — hardest
];

const P_START_ROW = 11, P_START_COL = 10;
const POWER_FRAMES = 420;
const DIRS = [{dr:-1,dc:0},{dr:0,dc:1},{dr:1,dc:0},{dr:0,dc:-1}];

// ========================
// AUDIO
// ========================
const Snd = (() => {
  let ctx;
  function init() {
    if (ctx) return;
    ctx = new (window.AudioContext || window.webkitAudioContext)();
  }
  function resume() { init(); if (ctx.state === 'suspended') ctx.resume(); }
  function tone(freq, vol, dur, type = 'sine', t0 = 0) {
    if (!ctx) return;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.connect(g); g.connect(ctx.destination);
    o.type = type; o.frequency.value = freq;
    const start = ctx.currentTime + t0;
    g.gain.setValueAtTime(vol, start);
    g.gain.exponentialRampToValueAtTime(0.001, start + dur);
    o.start(start); o.stop(start + dur + 0.05);
  }
  return {
    resume,
    chomp()   { tone(400,0.05,0.04,'square'); tone(300,0.05,0.04,'square',0.05); },
    pellet()  { [500,650,800,1000].forEach((f,i) => tone(f,0.14,0.09,'sine',i*0.08)); },
    eat()     { tone(180,0.18,0.25,'sawtooth'); tone(120,0.12,0.3,'sine',0.04); },
    die()     { [440,330,220,165].forEach((f,i) => tone(f,0.18,0.14,'sawtooth',i*0.13)); },
    clear()   { [523,659,784,1047].forEach((f,i) => tone(f,0.14,0.22,'sine',i*0.16)); },
  };
})();

// ========================
// INPUT
// ========================
const Input = (() => {
  const MAP = {
    ArrowUp:{dr:-1,dc:0}, ArrowDown:{dr:1,dc:0}, ArrowLeft:{dr:0,dc:-1}, ArrowRight:{dr:0,dc:1},
    w:{dr:-1,dc:0}, s:{dr:1,dc:0}, a:{dr:0,dc:-1}, d:{dr:0,dc:1},
  };
  let pending = null;

  document.addEventListener('keydown', e => {
    if (MAP[e.key]) { pending = MAP[e.key]; e.preventDefault(); }
    if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') window.mazeGame?._togglePause();
  });

  // Swipe-to-move: register direction on touchend based on drag vector
  let swipeStart = null;
  const MIN_SWIPE = 22;
  document.addEventListener('touchstart', e => {
    if (e.target.closest('button, a')) { swipeStart = null; return; }
    e.preventDefault();
    Snd.resume();
    swipeStart = { x: e.touches[0].clientX, y: e.touches[0].clientY };
  }, { passive: false });
  document.addEventListener('touchend', e => {
    if (!swipeStart) return;
    e.preventDefault();
    const dx = e.changedTouches[0].clientX - swipeStart.x;
    const dy = e.changedTouches[0].clientY - swipeStart.y;
    swipeStart = null;
    if (Math.abs(dx) < MIN_SWIPE && Math.abs(dy) < MIN_SWIPE) return;
    pending = Math.abs(dx) > Math.abs(dy)
      ? (dx > 0 ? {dr:0,dc:1} : {dr:0,dc:-1})
      : (dy > 0 ? {dr:1,dc:0} : {dr:-1,dc:0});
  }, { passive: false });

  return {
    consume() { const d = pending; pending = null; return d; },
    peek()    { return pending; },
  };
})();

// ========================
// PLAYER
// ========================
class Player {
  constructor(speed) {
    this.speed = speed;
    this.reset();
  }

  reset() {
    this.row  = P_START_ROW;
    this.col  = P_START_COL;
    this.prog = 0;
    this.dir  = {dr:0, dc:0};
    this.next = null;
    this.mouthAngle = 0;
    this.mouthDir   = 1;
  }

  canEnter(map, r, c) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    const v = map[r][c];
    return v !== 1 && v !== 4;
  }

  update(map) {
    const nd = Input.consume();
    if (nd) this.next = nd;

    // If stopped, try to start
    if (this.dir.dr === 0 && this.dir.dc === 0) {
      if (this.next && this.canEnter(map, this.row + this.next.dr, this.col + this.next.dc)) {
        this.dir = this.next; this.next = null;
      }
      return;
    }

    this.prog += this.speed;

    if (this.prog >= 1) {
      this.row += this.dir.dr;
      this.col += this.dir.dc;
      this.prog -= 1;

      // Try buffered turn
      if (this.next && this.canEnter(map, this.row + this.next.dr, this.col + this.next.dc)) {
        this.dir = this.next; this.next = null;
      } else if (!this.canEnter(map, this.row + this.dir.dr, this.col + this.dir.dc)) {
        this.dir = {dr:0, dc:0}; this.prog = 0;
      }
    }

    // Mouth animation
    this.mouthAngle += 0.14 * this.mouthDir;
    if (this.mouthAngle > 0.38 || this.mouthAngle < 0) this.mouthDir *= -1;
  }

  get px() { return (this.col + this.dir.dc * this.prog + 0.5); }
  get py() { return (this.row + this.dir.dr * this.prog + 0.5); }

  draw(ctx, cs) {
    const x = this.px * cs, y = this.py * cs, r = cs * 0.4;
    ctx.save();
    ctx.shadowColor = '#FDE68A';
    ctx.shadowBlur  = 14;

    // Body
    ctx.fillStyle = '#FCD34D';
    ctx.beginPath();
    const angle = this.dir.dc < 0 ? Math.PI : this.dir.dc > 0 ? 0 : this.dir.dr < 0 ? -Math.PI/2 : Math.PI/2;
    const mouth = this.mouthAngle * Math.PI;
    if (this.dir.dr !== 0 || this.dir.dc !== 0) {
      ctx.moveTo(x, y);
      ctx.arc(x, y, r, angle + mouth, angle + Math.PI * 2 - mouth);
    } else {
      ctx.arc(x, y, r, 0, Math.PI * 2);
    }
    ctx.closePath();
    ctx.fill();

    // Cross overlay (spiritual theme)
    ctx.shadowBlur = 0;
    ctx.strokeStyle = 'rgba(120,53,15,0.55)';
    ctx.lineWidth = cs * 0.07;
    ctx.lineCap = 'round';
    const clen = r * 0.5;
    ctx.beginPath(); ctx.moveTo(x, y - clen); ctx.lineTo(x, y + clen); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x - clen, y); ctx.lineTo(x + clen, y); ctx.stroke();

    ctx.restore();
  }
}

// ========================
// GHOST
// ========================
class Ghost {
  constructor(idx) {
    this.idx = idx;
    this.cfg = GHOSTS_CFG[idx];
    this._origStart = GHOST_START[idx];
    this._origRelease = GHOST_RELEASE[idx];
    this.reset(true);
  }

  reset(initial = false) {
    [this.row, this.col] = this._origStart;
    this.prog     = 0;
    this.dir      = {dr: 0, dc: 1};
    this.scared   = false;
    this.scaredT  = 0;
    this.eyeOnly  = false;
    this.inHouse  = (this.row === 9);
    this.releaseT = initial ? this._origRelease : 150;
    this.atDoor   = false;
  }

  _passable(map, r, c, allowDoor) {
    if (r < 0 || r >= ROWS || c < 0 || c >= COLS) return false;
    const v = map[r][c];
    if (v === 1) return false;
    if (v === 4 && !allowDoor) return false;
    return true;
  }

  _bestDir(map, tr, tc, allowDoor) {
    const rev = {dr:-this.dir.dr, dc:-this.dir.dc};
    let best = null, bestD = Infinity;
    for (const d of DIRS) {
      if (d.dr === rev.dr && d.dc === rev.dc) continue;
      const nr = this.row + d.dr, nc = this.col + d.dc;
      if (!this._passable(map, nr, nc, allowDoor)) continue;
      const dist = Math.abs(nr - tr) + Math.abs(nc - tc);
      if (dist < bestD) { bestD = dist; best = d; }
    }
    return best || rev;
  }

  _randDir(map) {
    const rev = {dr:-this.dir.dr, dc:-this.dir.dc};
    const opts = DIRS.filter(d => {
      if (d.dr === rev.dr && d.dc === rev.dc) return false;
      return this._passable(map, this.row + d.dr, this.col + d.dc, false);
    });
    return opts.length ? opts[Math.floor(Math.random() * opts.length)] : rev;
  }

  _chaseTarget(player) {
    const pr = player.row + player.dir.dr * player.prog;
    const pc = player.col + player.dir.dc * player.prog;
    switch (this.idx) {
      case 0: return {r: Math.round(pr), c: Math.round(pc)};
      case 1: return {r: Math.round(pr + player.dir.dr * 4), c: Math.round(pc + player.dir.dc * 4)};
      case 2: {
        const d = Math.abs(this.row - pr) + Math.abs(this.col - pc);
        return d > 8 ? {r: Math.round(pr), c: Math.round(pc)} : {r: this.cfg.sr, c: this.cfg.sc};
      }
      case 3: return {r: (Math.random() * ROWS)|0, c: (Math.random() * COLS)|0};
    }
  }

  update(map, game) {
    if (this.scared) { this.scaredT--; if (this.scaredT <= 0) this.scared = false; }

    const spd = this.eyeOnly ? 0.22 : this.scared ? Math.max(0.05, game.ghostSpeed * 0.6) : this.inHouse ? 0.06 : game.ghostSpeed;
    this.prog += spd;

    if (this.prog < 1) return;

    this.row += this.dir.dr;
    this.col += this.dir.dc;
    this.prog -= 1;

    // Returned to house after being eaten
    if (this.eyeOnly && this.row === 9 && this.col === 10) {
      this.eyeOnly = false;
      this.inHouse = true;
      this.releaseT = 120;
      this.scared   = false;
      this.dir = {dr:0, dc:1};
      return;
    }

    if (this.eyeOnly) {
      this.dir = this._bestDir(map, 9, 10, true);
      return;
    }

    if (this.inHouse) {
      this.releaseT--;
      if (this.releaseT > 0) {
        // Bounce left/right
        if (!this._passable(map, this.row, this.col + this.dir.dc, true)) {
          this.dir = {dr:0, dc:-this.dir.dc};
        }
        return;
      }
      // Exit house: move toward door (8,10)
      if (this.row === 8 && this.col === 10) {
        this.inHouse = false;
        this.dir = {dr:-1, dc:0};
      } else {
        this.dir = this._bestDir(map, 8, 10, true);
      }
      return;
    }

    if (this.scared) {
      this.dir = this._randDir(map);
      return;
    }

    const scatter = game.scatterMode;
    const target  = scatter
      ? {r: this.cfg.sr, c: this.cfg.sc}
      : this._chaseTarget(game.player);
    this.dir = this._bestDir(map, target.r, target.c, false);
  }

  get px() { return this.col + this.dir.dc * this.prog + 0.5; }
  get py() { return this.row + this.dir.dr * this.prog + 0.5; }

  draw(ctx, cs) {
    if (this.eyeOnly) {
      this._drawEyes(ctx, this.px * cs, this.py * cs, cs * 0.35);
      return;
    }
    const flash = this.scared && this.scaredT < 100 && Math.floor(this.scaredT / 12) % 2;
    const col   = this.scared ? (flash ? '#fff' : '#3B82F6') : this.cfg.color;
    const x = this.px * cs, y = this.py * cs, r = cs * 0.4;

    ctx.save();
    ctx.shadowColor = col;
    ctx.shadowBlur  = 10;
    ctx.fillStyle   = col;

    // Body
    ctx.beginPath();
    ctx.arc(x, y - r * 0.08, r, Math.PI, 0, false);
    ctx.lineTo(x + r, y + r * 0.65);
    const segs = 3, sw = (r * 2) / segs;
    for (let i = 0; i < segs; i++) {
      const bx = x + r - sw * i;
      ctx.quadraticCurveTo(bx - sw * 0.25, y + r * 1.05, bx - sw * 0.5, y + r * 0.65);
      ctx.quadraticCurveTo(bx - sw * 0.75, y + r * 0.28, bx - sw, y + r * 0.65);
    }
    ctx.closePath();
    ctx.fill();

    this._drawEyes(ctx, x, y, r);
    ctx.restore();
  }

  _drawEyes(ctx, x, y, r) {
    ctx.shadowBlur = 0;
    const eo = r * 0.28;
    for (const ex of [x - eo, x + eo]) {
      ctx.fillStyle = '#fff';
      ctx.beginPath();
      ctx.ellipse(ex, y - r * 0.1, r * 0.2, r * 0.24, 0, 0, Math.PI * 2);
      ctx.fill();
      if (!this.scared) {
        ctx.fillStyle = '#1D4ED8';
        ctx.beginPath();
        ctx.arc(ex + r * 0.06, y - r * 0.06, r * 0.11, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }
}

// ========================
// GAME
// ========================
class Game {
  constructor() {
    this.canvas = document.getElementById('gameCanvas');
    this.ctx    = this.canvas.getContext('2d');
    this.state  = 'menu';
    this.level  = 1;
    this.score  = 0;
    this.lives  = 3;
    this.hs     = parseInt(localStorage.getItem('witl_hs') || '0');
    this.verseI = 0;
    this.ghostEatCombo = 0;
    this._frame = 0;

    this._resize();
    window.addEventListener('resize', () => this._resize());

    this._bindUI();
    window.mazeGame = this;
    requestAnimationFrame(this._loop.bind(this));
  }

  _resize() {
    const safeH = window.innerHeight - 72; // leave room for HUD only
    const sz    = Math.min(window.innerWidth - 16, safeH);
    this.cs     = Math.max(14, Math.floor(sz / COLS));
    this.W      = this.cs * COLS;
    this.H      = this.cs * ROWS;
    this.canvas.width  = this.W;
    this.canvas.height = this.H;
    this.canvas.style.width  = this.W + 'px';
    this.canvas.style.height = this.H + 'px';
  }

  _show(id)  { document.getElementById(id)?.classList.remove('hidden'); }
  _hide(id)  { document.getElementById(id)?.classList.add('hidden'); }

  _bindUI() {
    document.getElementById('btn-start').addEventListener('click', () => { Snd.resume(); this._startGame(); });
    document.getElementById('btn-restart').addEventListener('click', () => { Snd.resume(); this._startGame(); });
    document.getElementById('btn-menu').addEventListener('click', () => this._goMenu());
    document.getElementById('btn-next').addEventListener('click', () => { Snd.resume(); this._nextLevel(); });
    document.getElementById('btn-pause').addEventListener('click', () => this._togglePause());
    document.getElementById('btn-resume').addEventListener('click', () => this._togglePause());
  }

  _goMenu() {
    this.state = 'menu';
    this._show('screen-menu');
    ['screen-go','screen-level','screen-pause','hud','dpad'].forEach(id => this._hide(id));
  }

  _startGame() {
    this.level = 1; this.score = 0; this.lives = 3;
    this.armorGot = 0; this.verseI = 0;
    this._initLevel();
  }

  _initLevel() {
    this.map = MAP_BASE.map(r => [...r]);

    this.dotTotal = 0;
    for (const row of this.map) for (const v of row) if (v === 0 || v === 2) this.dotTotal++;
    this.dotsLeft = this.dotTotal;

    const cfg = LEVEL_CONFIG[Math.min(this.level - 1, LEVEL_CONFIG.length - 1)];
    this.player = new Player(cfg.ps);
    this.ghostSpeed = cfg.gs;
    this.ghosts = [0,1,2,3].map(i => {
      const g = new Ghost(i);
      g._origRelease = cfg.rel[i];
      g.releaseT = cfg.rel[i];
      return g;
    });

    this.powerT    = 0;
    this.scatterT  = cfg.sct;
    this.chaseT    = cfg.chs;
    this.scatterMode = true;
    this.modeTimer = this.scatterT;
    this.deathT    = 0;
    this.clearT    = 0;
    this.versePopT = 0;
    this.versePopData = null;
    this.ghostEatCombo = 0;
    this._frame    = 0;

    this.state = 'playing';
    this._hide('screen-menu'); this._hide('screen-go'); this._hide('screen-level'); this._hide('screen-pause');
    this._show('hud');
    this._hud();
  }

  _nextLevel() {
    this.level++;
    this._hide('screen-level');
    if (this.level > 5) { this._victory(); return; }
    this._initLevel();
  }

  _togglePause() {
    if (this.state === 'playing')  { this.state = 'paused'; this._show('screen-pause'); }
    else if (this.state === 'paused') { this.state = 'playing'; this._hide('screen-pause'); }
  }

  _hud() {
    document.getElementById('score-disp').textContent = this.score;
    document.getElementById('hs-disp').textContent    = 'Best ' + this.hs;
    document.getElementById('level-disp').textContent = 'Level ' + this.level;
    document.getElementById('lives-disp').textContent = '✝'.repeat(this.lives) + '○'.repeat(Math.max(0, 3 - this.lives));
    const armor = '🛡'.repeat(this.armorGot) + '◌'.repeat(4 - this.armorGot);
    document.getElementById('armor-disp').textContent = armor;
  }

  _showVerse(data) {
    this.versePopData = data;
    this.versePopT    = 220;
    document.getElementById('vpop-text').textContent = `"${data.text}"`;
    document.getElementById('vpop-ref').textContent  = `— ${data.ref}`;
    if (data.bonus) document.getElementById('vpop-bonus').textContent = '+' + data.bonus;
    else document.getElementById('vpop-bonus').textContent = '';
    this._show('verse-pop');
  }

  _update() {
    if (this.state !== 'playing') return;
    this._frame++;

    // Verse popup countdown
    if (this.versePopT > 0) { this.versePopT--; if (!this.versePopT) this._hide('verse-pop'); }

    // Death animation
    if (this.deathT > 0) {
      this.deathT--;
      if (this.deathT === 0) {
        if (this.lives <= 0) this._gameOver();
        else this._respawn();
      }
      return;
    }

    // Level clear
    if (this.clearT > 0) {
      this.clearT--;
      if (this.clearT === 0) this._levelDone();
      return;
    }

    // Scatter/chase timer
    if (--this.modeTimer <= 0) {
      this.scatterMode = !this.scatterMode;
      this.modeTimer   = this.scatterMode ? this.scatterT : this.chaseT;
      if (!this.scatterMode) this.ghosts.forEach(g => { if (!g.eyeOnly) { g.dir = {dr:-g.dir.dr, dc:-g.dir.dc}; } });
    }

    // Power timer
    if (this.powerT > 0 && --this.powerT === 0) {
      this.ghosts.forEach(g => { if (!g.eyeOnly) g.scared = false; });
      this.ghostEatCombo = 0;
    }

    // Player
    this.player.update(this.map);

    // Collect
    const pr = this.player.row, pc = this.player.col;
    const cell = this.map[pr]?.[pc];
    if (cell === 0) {
      this.map[pr][pc] = 3;
      this.score += 10;
      this.dotsLeft--;
      Snd.chomp();
    } else if (cell === 2) {
      this.map[pr][pc] = 3;
      this.score += 50;
      this.dotsLeft--;
      const ap = ARMOR_PIECES[Math.min(this.armorGot, 3)];
      if (this.armorGot < 4) this.armorGot++;
      this.powerT = POWER_FRAMES;
      this.ghostEatCombo = 0;
      this.ghosts.forEach(g => { if (!g.eyeOnly && !g.inHouse) { g.scared = true; g.scaredT = POWER_FRAMES; } });
      Snd.pellet();
      this._showVerse({ text: `You have taken up the ${ap.name}! Stand firm against the evil one.`, ref: ap.ref });
    }

    // Ghosts
    this.ghosts.forEach(g => g.update(this.map, this));

    // Collisions
    for (const g of this.ghosts) {
      if (g.eyeOnly || g.inHouse) continue;
      const dx = Math.abs((g.px - 0.5 + 0.5) - (this.player.px - 0.5 + 0.5));
      const dy = Math.abs((g.py - 0.5 + 0.5) - (this.player.py - 0.5 + 0.5));
      // pixel-space collision
      const gx = g.px * this.cs, gy = g.py * this.cs;
      const plx = this.player.px * this.cs, ply = this.player.py * this.cs;
      if (Math.abs(gx - plx) < this.cs * 0.7 && Math.abs(gy - ply) < this.cs * 0.7) {
        if (g.scared) {
          g.scared   = false;
          g.eyeOnly  = true;
          g.dir      = {dr:-1, dc:0};
          this.ghostEatCombo++;
          const pts = [200,400,800,1600][Math.min(this.ghostEatCombo-1,3)];
          this.score += pts;
          Snd.eat();
          const v = VERSES[this.verseI++ % VERSES.length];
          this._showVerse({...v, bonus: pts});
        } else {
          this._die();
          break;
        }
      }
    }

    // Win check
    if (this.dotsLeft <= 0) { this.clearT = 90; Snd.clear(); }

    this._hud();
  }

  _die() {
    this.lives--;
    this.deathT = 80;
    Snd.die();
    this.ghosts.forEach(g => { g.scared = false; g.scaredT = 0; });
  }

  _respawn() {
    this.player.reset();
    this.ghosts.forEach(g => g.reset());
    this.powerT = 0;
    this.ghostEatCombo = 0;
  }

  _gameOver() {
    this.state = 'gameover';
    if (this.score > this.hs) { this.hs = this.score; localStorage.setItem('witl_hs', this.hs); }
    document.getElementById('go-score').textContent  = 'Score: ' + this.score;
    document.getElementById('go-best').textContent   = 'Best: ' + this.hs;
    document.getElementById('go-verse').textContent  = '"Stand firm in the faith; be courageous; be strong." — 1 Corinthians 16:13';
    this._show('screen-go');
    this._hide('hud'); this._hide('dpad'); this._hide('verse-pop');
  }

  _levelDone() {
    this.state = 'levelcomplete';
    const v = VERSES[this.verseI++ % VERSES.length];
    document.getElementById('lc-title').textContent = `Level ${this.level} — Complete!`;
    document.getElementById('lc-verse').textContent = `"${v.text}" — ${v.ref}`;
    document.getElementById('lc-score').textContent = 'Score: ' + this.score;
    document.getElementById('btn-next').textContent = this.level >= 5 ? 'Claim Victory' : 'Next Level';
    this._show('screen-level');
    this._hide('verse-pop');
  }

  _victory() {
    this.state = 'victory';
    if (this.score > this.hs) { this.hs = this.score; localStorage.setItem('witl_hs', this.hs); }
    document.getElementById('go-score').textContent = 'Final Score: ' + this.score;
    document.getElementById('go-best').textContent  = 'Best: ' + this.hs;
    document.getElementById('go-verse').textContent = '"Thanks be to God! He gives us the victory through our Lord Jesus Christ." — 1 Corinthians 15:57';
    this._show('screen-go');
    this._hide('hud'); this._hide('dpad'); this._hide('verse-pop');
  }

  _draw() {
    const { ctx, cs } = this;
    ctx.fillStyle = '#000B1E';
    ctx.fillRect(0, 0, this.W, this.H);

    if (!this.map) return;

    // Maze
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v  = this.map[r][c];
        const x  = c * cs, y = r * cs;

        if (v === 1) {
          ctx.fillStyle = '#0F2A4A';
          ctx.fillRect(x, y, cs, cs);
          ctx.strokeStyle = '#1E4D8C';
          ctx.lineWidth   = 1.5;
          ctx.strokeRect(x + 1, y + 1, cs - 2, cs - 2);
        } else if (v === 0) {
          ctx.fillStyle  = '#FDE68A';
          ctx.shadowColor = '#FDE68A';
          ctx.shadowBlur  = 5;
          ctx.beginPath();
          ctx.arc(x + cs/2, y + cs/2, cs * 0.09, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (v === 2) {
          const pulse = 0.5 + 0.5 * Math.sin(this._frame / 12);
          ctx.fillStyle  = '#FBBF24';
          ctx.shadowColor = '#F59E0B';
          ctx.shadowBlur  = 10 + 8 * pulse;
          ctx.beginPath();
          ctx.arc(x + cs/2, y + cs/2, cs * (0.21 + 0.04 * pulse), 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        } else if (v === 4) {
          ctx.fillStyle = '#7C3AED';
          ctx.fillRect(x, y + cs * 0.38, cs, cs * 0.24);
        } else if (v === 3 && r >= 8 && r <= 10 && c >= 8 && c <= 12) {
          ctx.fillStyle = 'rgba(109,40,217,0.12)';
          ctx.fillRect(x, y, cs, cs);
        }
      }
    }

    // Ghost house outline
    ctx.strokeStyle = 'rgba(109,40,217,0.5)';
    ctx.lineWidth   = 1;
    ctx.strokeRect(8 * cs, 8 * cs, 5 * cs, 3 * cs);

    // Ghosts
    if (this.ghosts) this.ghosts.forEach(g => g.draw(ctx, cs));

    // Player (flash on death)
    if (this.deathT === 0 || Math.floor(this.deathT / 7) % 2 === 0) {
      this.player?.draw(ctx, cs);
    }
  }

  _loop() {
    this._update();
    this._draw();
    requestAnimationFrame(this._loop.bind(this));
  }
}

window.addEventListener('DOMContentLoaded', () => { new Game(); });
