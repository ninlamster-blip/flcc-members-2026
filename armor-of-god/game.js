// ============================================================
//  ARMOR OF GOD: SPIRITUAL BATTLE
//  game.js — canvas game engine  |  Phase 2: Graphics polish
// ============================================================

'use strict';

// ---- Bible Verses ----
const VERSES = {
  FEAR: { text: "God has not given us a spirit of fear, but of power and of love and of a sound mind.", ref: "2 Timothy 1:7" },
  TEMPTATION: { text: "God will provide a way out so that you can endure it.", ref: "1 Corinthians 10:13" },
  DOUBT: { text: "If any of you lacks wisdom, let him ask God, who gives generously.", ref: "James 1:5" },
  ANGER: { text: "Be slow to anger, for the anger of man does not produce the righteousness of God.", ref: "James 1:19-20" },
  PRIDE: { text: "God opposes the proud but gives grace to the humble.", ref: "James 4:6" },
  DISCOURAGEMENT: { text: "I can do all things through Christ who strengthens me.", ref: "Philippians 4:13" },
  MATERIALISM: { text: "Seek first the kingdom of God and his righteousness, and all these things will be added to you.", ref: "Matthew 6:33" },
  DISTRACTION: { text: "Fix your eyes on Jesus, the author and perfecter of our faith.", ref: "Hebrews 12:2" },
  PRESSURE: { text: "Do not conform to the pattern of this world, but be transformed by the renewing of your mind.", ref: "Romans 12:2" },
  BOSS: { text: "Our struggle is not against flesh and blood, but against the spiritual forces of evil in the heavenly realms.", ref: "Ephesians 6:12" }
};

const LEVEL_VERSES = [
  { text: "Finally, be strong in the Lord and in his mighty power.", ref: "Ephesians 6:10" },
  { text: "Create in me a pure heart, O God, and renew a steadfast spirit within me.", ref: "Psalm 51:10" },
  { text: "Do not be overcome by evil, but overcome evil with good.", ref: "Romans 12:21" }
];

// ---- Weapon Types ----
const WEAPONS = [
  { name: "FAITH BLAST",      color: "#60A5FA", glow: "rgba(96,165,250,0.8)",  w: 4, h: 18, spd: 9,  dmg: 1, trail: "#93C5FD" },
  { name: "TRUTH BEAM",       color: "#34D399", glow: "rgba(52,211,153,0.8)",  w: 6, h: 22, spd: 11, dmg: 1, trail: "#6EE7B7" },
  { name: "PRAYER POWER",     color: "#A78BFA", glow: "rgba(167,139,250,0.8)", w: 5, h: 20, spd: 10, dmg: 1, trail: "#C4B5FD" },
  { name: "SCRIPTURE STRIKE", color: "#FCD34D", glow: "rgba(252,211,77,0.8)",  w: 9, h: 26, spd: 7,  dmg: 2, trail: "#FDE68A" }
];

// ---- Enemy Definitions ----
const ENEMY_DEF = {
  FEAR:          { name:"Fear",          label:"FEAR",          hp:1, speed:1.1, w:44, h:36, color:"#7C3AED", glow:"rgba(124,58,237,0.6)",  pts:100, drop:0.10, shape:"hexagon" },
  TEMPTATION:    { name:"Temptation",    label:"TEMPTATION",    hp:1, speed:2.0, w:38, h:32, color:"#DC2626", glow:"rgba(220,38,38,0.6)",    pts:150, drop:0.12, shape:"arrow"   },
  DOUBT:         { name:"Doubt",         label:"DOUBT",         hp:1, speed:0.9, w:42, h:36, color:"#1D4ED8", glow:"rgba(29,78,216,0.5)",    pts:120, drop:0.15, shape:"ghost"   },
  ANGER:         { name:"Anger",         label:"ANGER",         hp:2, speed:1.7, w:48, h:40, color:"#EA580C", glow:"rgba(234,88,12,0.7)",    pts:200, drop:0.12, shape:"fire"    },
  PRIDE:         { name:"Pride",         label:"PRIDE",         hp:3, speed:1.0, w:56, h:48, color:"#9333EA", glow:"rgba(147,51,234,0.7)",   pts:300, drop:0.20, shape:"armored" },
  DISCOURAGEMENT:{ name:"Discouragement",label:"DISCOURAGEMENT",hp:2, speed:0.6, w:52, h:44, color:"#374151", glow:"rgba(55,65,81,0.6)",     pts:180, drop:0.18, shape:"heavy"   },
  MATERIALISM:   { name:"Materialism",   label:"MATERIALISM",   hp:2, speed:1.3, w:46, h:40, color:"#D97706", glow:"rgba(217,119,6,0.6)",    pts:220, drop:0.15, shape:"crystal" },
  DISTRACTION:   { name:"Distraction",   label:"DISTRACTION",   hp:1, speed:2.6, w:36, h:32, color:"#0891B2", glow:"rgba(8,145,178,0.6)",    pts:160, drop:0.10, shape:"erratic" },
  PRESSURE:      { name:"Pressure",      label:"PRESSURE",      hp:3, speed:1.0, w:54, h:46, color:"#6B7280", glow:"rgba(107,114,128,0.6)",  pts:250, drop:0.20, shape:"heavy"   }
};

// ---- Level Config ----
const LEVELS = [
  { name:"Personal Battles",     enemies:["FEAR","DOUBT","TEMPTATION"],            rows:3, cols:7, dropSpd:0.28, shootInterval:2200, waveGap:1400 },
  { name:"Battles of the Heart", enemies:["ANGER","PRIDE","DISCOURAGEMENT"],       rows:3, cols:6, dropSpd:0.38, shootInterval:1800, waveGap:1600 },
  { name:"Battles of the World", enemies:["MATERIALISM","DISTRACTION","PRESSURE"], rows:3, cols:6, dropSpd:0.48, shootInterval:1500, waveGap:1800 }
];

// ---- Powerup Types ----
const POWERUP_TYPES = [
  { id:"bible",  label:"BIBLE",  color:"#FCD34D", dur:8000 },
  { id:"shield", label:"SHIELD", color:"#60A5FA", dur:6000 },
  { id:"cross",  label:"CROSS",  color:"#34D399", dur:0    },
  { id:"light",  label:"LIGHT",  color:"#F9FAFB", dur:5000 }
];

// ============================================================
//  AUDIO ENGINE
// ============================================================
const Audio = (() => {
  let ctx = null;
  let muted = false;

  function init() {
    try { ctx = new (window.AudioContext || window.webkitAudioContext)(); } catch(e) { ctx = null; }
  }
  function resume() { if (ctx && ctx.state === 'suspended') ctx.resume(); }

  function beep(freq, dur, vol = 0.18, type = 'square', decay = 0.15) {
    if (muted || !ctx) return;
    try {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.connect(gain); gain.connect(ctx.destination);
      osc.type = type;
      osc.frequency.setValueAtTime(freq, ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, ctx.currentTime + dur);
      gain.gain.setValueAtTime(vol, ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur + decay);
      osc.start(ctx.currentTime);
      osc.stop(ctx.currentTime + dur + decay + 0.05);
    } catch(e) {}
  }

  function shoot()     { beep(880, 0.08, 0.12, 'square',   0.05); }
  function hit()       { beep(440, 0.10, 0.15, 'sawtooth', 0.08); }
  function kill()      { beep(660, 0.20, 0.20, 'sine', 0.3); setTimeout(() => beep(880, 0.15, 0.15, 'sine', 0.2), 100); }
  function playerHit() { beep(220, 0.30, 0.30, 'sawtooth', 0.25); }
  function powerup()   { [440,550,660].forEach((f,i) => setTimeout(() => beep(f, 0.15, 0.2, 'sine'), i*100)); }
  function levelUp()   { [440,550,660,880].forEach((f,i) => setTimeout(() => beep(f, 0.25, 0.2, 'sine'), i*120)); }
  function gameOver()  { [440,330,220,180].forEach((f,i) => setTimeout(() => beep(f, 0.35, 0.25, 'sawtooth'), i*180)); }
  function bossHit()   { beep(200, 0.2, 0.3, 'sawtooth'); }
  function bossIntro() { [110,150,200,90].forEach((f,i) => setTimeout(() => beep(f, 0.5, 0.3, 'sawtooth', 0.4), i*250)); }

  return { init, resume, shoot, hit, kill, playerHit, powerup, levelUp, gameOver, bossHit, bossIntro };
})();

// ============================================================
//  INPUT HANDLER
// ============================================================
class Input {
  constructor() {
    this.left  = false;
    this.right = false;
    this.fire  = false;
    this._bindKeys();
    this._bindTouch();
  }
  _bindKeys() {
    document.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') this.left  = true;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.right = true;
      if (e.key === ' ')                                              this.fire  = true;
      if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') game && game.togglePause();
      if (e.key === ' ') e.preventDefault();
    });
    document.addEventListener('keyup', e => {
      if (e.key === 'ArrowLeft'  || e.key === 'a' || e.key === 'A') this.left  = false;
      if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') this.right = false;
      if (e.key === ' ')                                              this.fire  = false;
    });
  }
  _bindTouch() {
    const safe = (id, prop, val) => {
      const el = document.getElementById(id);
      if (!el) return;
      const set   = () => { this[prop] = val; };
      const unset = () => { if (val) this[prop] = false; };
      el.addEventListener('touchstart', e => { e.preventDefault(); set(); Audio.resume(); }, { passive: false });
      el.addEventListener('touchend',   e => { e.preventDefault(); unset(); },              { passive: false });
      el.addEventListener('mousedown',  set);
      el.addEventListener('mouseup',    unset);
    };
    safe('touch-left',  'left',  true);
    safe('touch-right', 'right', true);
    safe('touch-fire',  'fire',  true);
  }
}

// ============================================================
//  ENTITY CLASSES
// ============================================================

class Player {
  constructor(x, y) {
    this.x = x; this.y = y;
    this.w = 38; this.h = 40;
    this.speed = 4.5;
    this.maxHp = 100; this.hp = 100;
    this.invincible = false; this.invTimer = 0;
    this.weaponIdx = 0;
    this.shielded = false;
    this.rapidFire = false;
    this.weaponPowered = false;
    this.thrustTime = 0;
    this.lives = 3;
  }
  get weapon() { return WEAPONS[this.weaponIdx]; }

  takeDamage(dmg) {
    if (this.invincible || this.shielded) return false;
    this.hp = Math.max(0, this.hp - dmg);
    this.invincible = true;
    this.invTimer = 90;
    Audio.playerHit();
    return true;
  }

  update(input, canvasW) {
    if (input.left)  this.x = Math.max(this.w / 2,           this.x - this.speed);
    if (input.right) this.x = Math.min(canvasW - this.w / 2, this.x + this.speed);
    if (this.invTimer > 0) { this.invTimer--; if (this.invTimer <= 0) this.invincible = false; }
    this.thrustTime++;
  }

  draw(ctx) {
    if (this.dead) return;
    const { x, y, w, h, thrustTime: t } = this;
    const flash = this.invincible && Math.floor(this.invTimer / 5) % 2 === 0;
    if (flash) return;

    ctx.save();

    // Shield aura
    if (this.shielded) {
      const pulse = 0.7 + 0.3 * Math.sin(t * 0.08);
      ctx.strokeStyle = `rgba(96,165,250,${pulse})`;
      ctx.lineWidth = 2.5;
      ctx.shadowColor = '#60A5FA';
      ctx.shadowBlur = 24 * pulse;
      ctx.beginPath();
      ctx.ellipse(x, y, w * 0.88, h * 0.88, 0, 0, Math.PI * 2);
      ctx.stroke();
    }

    // Exhaust glow
    drawGlow(ctx, x - w * 0.18, y + h * 0.38 + 2, 4 + Math.sin(t * 0.3) * 2,   'rgba(96,165,250,0.7)', 14);
    drawGlow(ctx, x + w * 0.18, y + h * 0.38 + 2, 4 + Math.sin(t * 0.3 + 1) * 2, 'rgba(96,165,250,0.7)', 14);

    // Hull
    ctx.shadowColor = '#A78BFA';
    ctx.shadowBlur  = 20;
    ctx.beginPath();
    ctx.moveTo(x,           y - h * 0.48);
    ctx.lineTo(x + w * 0.5, y + h * 0.2);
    ctx.lineTo(x + w * 0.3, y + h * 0.38);
    ctx.lineTo(x,           y + h * 0.18);
    ctx.lineTo(x - w * 0.3, y + h * 0.38);
    ctx.lineTo(x - w * 0.5, y + h * 0.2);
    ctx.closePath();
    const hull = ctx.createLinearGradient(x, y - h * 0.48, x, y + h * 0.38);
    hull.addColorStop(0, '#E2E8F0');
    hull.addColorStop(0.5, '#A78BFA');
    hull.addColorStop(1, '#6D28D9');
    ctx.fillStyle = hull;
    ctx.fill();

    // Cross emblem
    ctx.fillStyle   = this.weaponPowered ? '#FCD34D' : '#FFFFFF';
    ctx.shadowColor = this.weaponPowered ? '#FCD34D' : '#A78BFA';
    ctx.shadowBlur  = 12;
    const cx = x, cy = y - h * 0.05;
    ctx.fillRect(cx - 1.5, cy - 9, 3, 18);
    ctx.fillRect(cx - 7,   cy - 3, 14, 3);

    ctx.restore();
  }
}

class Bullet {
  constructor(x, y, weapon, fromEnemy = false) {
    this.x = x; this.y = y;
    this.w = weapon.w; this.h = weapon.h;
    this.spd   = fromEnemy ? 3.2 : -weapon.spd;
    this.color = fromEnemy ? '#F87171' : weapon.color;
    this.glow  = fromEnemy ? 'rgba(248,113,113,0.8)' : weapon.glow;
    this.trail = fromEnemy ? '#FCA5A5' : weapon.trail;
    this.dmg   = weapon.dmg;
    this.fromEnemy = fromEnemy;
    this.dead  = false;
    this.age   = 0;
    // Phase 2: trail positions
    this._trail = [];
    this._maxTrail = fromEnemy ? 4 : 7;
  }

  update() {
    // Store trail before moving
    this._trail.unshift({ x: this.x, y: this.y });
    if (this._trail.length > this._maxTrail) this._trail.pop();
    this.y += this.spd;
    this.age++;
  }

  draw(ctx) {
    ctx.save();

    // Fading trail
    for (let i = 0; i < this._trail.length; i++) {
      const a = (1 - i / this._trail.length) * 0.45;
      const sz = this.w * (1 - i / this._trail.length) * 0.65;
      ctx.globalAlpha = a;
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = 8;
      ctx.fillStyle   = this.trail;
      ctx.fillRect(this._trail[i].x - sz / 2, this._trail[i].y - sz / 2, sz, sz);
    }
    ctx.globalAlpha = 1;

    // Core beam
    const trailH = this.h * 1.4;
    const tGrad  = ctx.createLinearGradient(this.x, this.y, this.x, this.y + (this.fromEnemy ? -trailH : trailH));
    tGrad.addColorStop(0, this.glow);
    tGrad.addColorStop(1, 'transparent');
    ctx.fillStyle = tGrad;
    ctx.fillRect(this.x - this.w / 2, this.fromEnemy ? this.y - this.h / 2 : this.y - this.h / 2, this.w, trailH);

    ctx.shadowColor = this.color;
    ctx.shadowBlur  = 14;
    ctx.fillStyle   = '#FFFFFF';
    ctx.fillRect(this.x - this.w / 2, this.y - this.h / 2, this.w, this.h);
    ctx.restore();
  }
}

class Enemy {
  constructor(type, x, y, spawnDelay = 0) {
    const def  = ENEMY_DEF[type];
    this.type  = type;
    this.name  = def.name;
    this.label = def.label;
    this.maxHp = def.hp; this.hp = def.hp;
    this.speed = def.speed;
    this.w = def.w; this.h = def.h;
    this.color = def.color; this.glow = def.glow;
    this.pts   = def.pts; this.drop = def.drop;
    this.shape = def.shape;
    this.x = x; this.y = y;
    this.dead  = false;
    this.hitFlash = 0;
    this.age   = 0;
    this.phase = Math.random() * Math.PI * 2;
    // Phase 2: spawn animation
    this.spawnDelay  = spawnDelay;
    this.spawnAge    = 0;
    this.spawnYOff   = -36; // slides down from above
    this.fullySpawned = spawnDelay === 0 ? false : false;
  }

  get spawned() { return this.spawnDelay <= 0 && this.spawnAge >= 20; }

  takeDamage(dmg) {
    if (this.spawnAge < 5) return false; // immune while materialising
    this.hp -= dmg;
    this.hitFlash = 8;
    if (this.hp <= 0) { this.dead = true; return true; }
    Audio.hit();
    return false;
  }

  update(dx) {
    if (this.spawnDelay > 0) { this.spawnDelay--; return; }
    if (this.spawnAge < 20) {
      this.spawnAge++;
      this.spawnYOff = -36 * (1 - this.spawnAge / 20);
    } else {
      this.spawnYOff = 0;
    }
    this.x += dx;
    this.age++;
    if (this.hitFlash > 0) this.hitFlash--;
  }

  draw(ctx) {
    if (this.spawnDelay > 0) return;
    ctx.save();

    const spawnAlpha = this.spawnAge < 20 ? this.spawnAge / 20 : 1;
    const ry = this.y + this.spawnYOff; // render y

    const flash = this.hitFlash > 0 && Math.floor(this.hitFlash / 2) % 2 === 0;

    // Ghost fade
    let alpha = spawnAlpha;
    if (this.shape === 'ghost') alpha *= 0.4 + 0.4 * Math.abs(Math.sin(this.age * 0.04 + this.phase));
    ctx.globalAlpha = alpha;

    ctx.shadowColor = flash ? '#FFFFFF' : this.color;
    ctx.shadowBlur  = flash ? 28 : 18;
    ctx.fillStyle   = flash ? '#FFFFFF' : this.color;
    ctx.strokeStyle = flash ? '#FFFFFF' : lightenColor(this.color, 40);
    ctx.lineWidth   = 1.5;

    this._drawShape(ctx, this.x, ry, this.w, this.h, this.age, this.phase);

    // HP bar (multi-hit enemies)
    if (this.maxHp > 1) {
      const bw = this.w * 0.7, bh = 3;
      const bx = this.x - bw / 2, by = ry + this.h / 2 + 5;
      ctx.globalAlpha = spawnAlpha;
      ctx.shadowBlur = 0;
      ctx.fillStyle  = 'rgba(0,0,0,0.5)';
      ctx.fillRect(bx, by, bw, bh);
      ctx.fillStyle  = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur  = 6;
      ctx.fillRect(bx, by, bw * (this.hp / this.maxHp), bh);
    }

    // Name label
    ctx.globalAlpha = spawnAlpha * 0.85;
    ctx.shadowBlur  = 0;
    ctx.fillStyle   = '#CBD5E1';
    const fs = Math.min(8, 70 / this.label.length);
    ctx.font = `500 ${fs}px "SF Mono","Fira Code",monospace`;
    ctx.textAlign    = 'center';
    ctx.textBaseline = 'top';
    ctx.fillText(this.label, this.x, ry + this.h / 2 + (this.maxHp > 1 ? 11 : 4));

    ctx.restore();
  }

  _drawShape(ctx, x, y, w, h, age, phase) {
    const hw = w / 2, hh = h / 2;
    switch (this.shape) {
      case 'hexagon': {
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const r = hw * (0.95 + 0.05 * Math.sin(age * 0.05 + phase + i));
          ctx.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r * (hh / hw));
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.globalAlpha *= 0.5;
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(x + Math.cos(a) * hw * 0.5, y + Math.sin(a) * hh * 0.5);
        }
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'arrow': {
        const bob = Math.sin(age * 0.12 + phase) * 3;
        ctx.beginPath();
        ctx.moveTo(x, y + hh + bob);
        ctx.lineTo(x - hw,       y - hh * 0.4 + bob);
        ctx.lineTo(x - hw * 0.3, y - hh * 0.4 + bob);
        ctx.lineTo(x - hw * 0.3, y - hh + bob);
        ctx.lineTo(x + hw * 0.3, y - hh + bob);
        ctx.lineTo(x + hw * 0.3, y - hh * 0.4 + bob);
        ctx.lineTo(x + hw,       y - hh * 0.4 + bob);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      case 'ghost': {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 2;
          const r = hw * (0.8 + 0.2 * Math.sin(age * 0.06 + phase + i * 2.1));
          const px = x + Math.cos(a) * r, py = y + Math.sin(a) * r * (hh / hw);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(0,0,0,0.6)';
        ctx.beginPath(); ctx.ellipse(x - hw * 0.25, y - hh * 0.15, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
        ctx.beginPath(); ctx.ellipse(x + hw * 0.25, y - hh * 0.15, 5, 6, 0, 0, Math.PI * 2); ctx.fill();
        break;
      }
      case 'fire': {
        ctx.beginPath();
        ctx.moveTo(x, y - hh);
        ctx.lineTo(x + hw * 0.4, y - hh * 0.1 + Math.sin(age * 0.18 + phase) * 4);
        ctx.lineTo(x + hw, y + hh);
        ctx.lineTo(x - hw, y + hh);
        ctx.lineTo(x - hw * 0.4, y - hh * 0.1 + Math.sin(age * 0.18 + phase + 1) * 4);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.fillStyle = lightenColor(this.color, 60);
        ctx.globalAlpha *= 0.55;
        ctx.beginPath();
        ctx.moveTo(x, y - hh * 0.3);
        ctx.lineTo(x + hw * 0.25, y + hh * 0.4);
        ctx.lineTo(x - hw * 0.25, y + hh * 0.4);
        ctx.closePath(); ctx.fill();
        break;
      }
      case 'armored': {
        ctx.beginPath();
        for (let i = 0; i < 5; i++) {
          const a = (i / 5) * Math.PI * 2 - Math.PI / 2;
          ctx.lineTo(x + Math.cos(a) * hw, y + Math.sin(a) * hh);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = lightenColor(this.color, 50);
        ctx.lineWidth = 2.5;
        for (let i = 0; i < 5; i++) {
          const a  = (i / 5) * Math.PI * 2 - Math.PI / 2;
          const a2 = ((i + 1) / 5) * Math.PI * 2 - Math.PI / 2;
          const mx = x + Math.cos((a + a2) / 2) * hw * 0.55;
          const my = y + Math.sin((a + a2) / 2) * hh * 0.55;
          ctx.beginPath();
          ctx.moveTo(x + Math.cos(a) * hw * 0.85, y + Math.sin(a) * hh * 0.85);
          ctx.lineTo(mx, my); ctx.stroke();
        }
        break;
      }
      case 'heavy': {
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
          ctx.lineTo(x + Math.cos(a) * hw, y + Math.sin(a) * hh * 0.85);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = lightenColor(this.color, 30);
        ctx.lineWidth = 1;
        ctx.beginPath();
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2 - Math.PI / 8;
          ctx.lineTo(x + Math.cos(a) * hw * 0.55, y + Math.sin(a) * hh * 0.55 * 0.85);
        }
        ctx.closePath(); ctx.stroke();
        break;
      }
      case 'crystal': {
        ctx.beginPath();
        ctx.moveTo(x, y - hh); ctx.lineTo(x + hw, y); ctx.lineTo(x, y + hh); ctx.lineTo(x - hw, y);
        ctx.closePath(); ctx.fill(); ctx.stroke();
        ctx.globalAlpha *= 0.4;
        ctx.fillStyle = lightenColor(this.color, 70);
        ctx.beginPath(); ctx.moveTo(x, y - hh); ctx.lineTo(x + hw, y); ctx.lineTo(x, y - hh * 0.1); ctx.closePath(); ctx.fill();
        ctx.beginPath(); ctx.moveTo(x - hw, y); ctx.lineTo(x, y + hh); ctx.lineTo(x, y + hh * 0.1); ctx.closePath(); ctx.fill();
        break;
      }
      case 'erratic': {
        const spikes = 6, inner = hw * 0.45, bob2 = Math.sin(age * 0.15 + phase) * 4;
        ctx.beginPath();
        for (let i = 0; i < spikes * 2; i++) {
          const a = (i / (spikes * 2)) * Math.PI * 2 - Math.PI / 2;
          const r = i % 2 === 0 ? hw : inner;
          const px = x + Math.cos(a) * r, py = y + bob2 + Math.sin(a) * r * (hh / hw);
          i === 0 ? ctx.moveTo(px, py) : ctx.lineTo(px, py);
        }
        ctx.closePath(); ctx.fill(); ctx.stroke();
        break;
      }
      default:
        ctx.fillRect(x - hw, y - hh, w, h);
    }
  }
}

class Boss {
  constructor(canvasW) {
    this.x      = canvasW / 2;
    this.y      = -120;       // starts off-screen (intro slides it down)
    this.targetY = 110;
    this.w      = 110; this.h = 80;
    this.maxHp  = 60;  this.hp = 60;
    this.color  = '#1E1B4B';
    this.speed  = 1.2; this.dir = 1;
    this.dead   = false;
    this.hitFlash = 0;
    this.age    = 0;
    this.phase2 = false;
    this.shootTimer = 0;
  }

  takeDamage(dmg) {
    this.hp -= dmg; this.hitFlash = 10;
    if (this.hp <= 0) { this.dead = true; return true; }
    if (this.hp < this.maxHp * 0.5) this.phase2 = true;
    Audio.bossHit();
    return false;
  }

  update(canvasW) {
    this.x += this.speed * this.dir * (this.phase2 ? 1.6 : 1);
    if (this.x > canvasW - this.w / 2 - 10 || this.x < this.w / 2 + 10) this.dir *= -1;
    if (this.hitFlash > 0) this.hitFlash--;
    this.age++;
    this.shootTimer++;
  }

  canShoot(interval) {
    if (this.shootTimer >= interval) { this.shootTimer = 0; return true; }
    return false;
  }

  draw(ctx) {
    ctx.save();
    const { x, y, w, h, age, phase2, hitFlash } = this;
    const hw = w / 2, hh = h / 2;
    const flash = hitFlash > 0 && Math.floor(hitFlash / 3) % 2 === 0;
    const t = age * 0.05;

    // Outer energy field
    ctx.globalAlpha = 0.35 + 0.15 * Math.sin(t);
    ctx.shadowColor = phase2 ? '#DC2626' : '#6D28D9';
    ctx.shadowBlur  = 55;
    ctx.fillStyle   = phase2 ? 'rgba(220,38,38,0.18)' : 'rgba(109,40,217,0.18)';
    ctx.beginPath(); ctx.ellipse(x, y, hw * 1.55, hh * 1.55, 0, 0, Math.PI * 2); ctx.fill();
    ctx.globalAlpha = 1;

    // Body
    ctx.shadowColor = flash ? '#FFFFFF' : (phase2 ? '#DC2626' : '#7C3AED');
    ctx.shadowBlur  = flash ? 45 : 28;
    const bg = ctx.createLinearGradient(x - hw, y - hh, x + hw, y + hh);
    if (flash)        { bg.addColorStop(0, '#FFFFFF'); bg.addColorStop(1, '#E0E7FF'); }
    else if (phase2)  { bg.addColorStop(0, '#450A0A'); bg.addColorStop(0.5, '#7F1D1D'); bg.addColorStop(1, '#1C0606'); }
    else              { bg.addColorStop(0, '#1E1B4B'); bg.addColorStop(0.5, '#312E81'); bg.addColorStop(1, '#0F0A2C'); }
    ctx.fillStyle = bg;

    // Fortress silhouette
    ctx.beginPath();
    ctx.moveTo(x, y - hh - 15);
    ctx.lineTo(x + hw * 0.3,  y - hh - 5);
    ctx.lineTo(x + hw * 0.3,  y - hh + 10);
    ctx.lineTo(x + hw * 0.6,  y - hh + 10);
    ctx.lineTo(x + hw * 0.6,  y - hh - 5);
    ctx.lineTo(x + hw,         y - hh + 10);
    ctx.lineTo(x + hw,         y + hh);
    ctx.lineTo(x - hw,         y + hh);
    ctx.lineTo(x - hw,         y - hh + 10);
    ctx.lineTo(x - hw * 0.6,  y - hh - 5);
    ctx.lineTo(x - hw * 0.6,  y - hh + 10);
    ctx.lineTo(x - hw * 0.3,  y - hh + 10);
    ctx.lineTo(x - hw * 0.3,  y - hh - 5);
    ctx.closePath(); ctx.fill();
    ctx.strokeStyle = phase2 ? '#F87171' : '#A78BFA';
    ctx.lineWidth = 2; ctx.stroke();

    // Eye
    const eyeC = phase2 ? '#F87171' : '#A78BFA';
    ctx.shadowColor = eyeC; ctx.shadowBlur = 22 + 10 * Math.sin(t * 3);
    ctx.fillStyle = eyeC;
    ctx.beginPath(); ctx.ellipse(x, y - 5, 16 + 4 * Math.sin(t * 2), 12 + 3 * Math.sin(t * 2.3), 0, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = '#000000'; ctx.shadowBlur = 0;
    ctx.beginPath(); ctx.ellipse(x + 3 * Math.sin(t), y - 5, 8, 8, 0, 0, Math.PI * 2); ctx.fill();

    // HP bar
    const bw = w * 0.9, bx2 = x - bw / 2, by2 = y + hh + 10;
    ctx.shadowBlur = 0; ctx.globalAlpha = 0.9;
    ctx.fillStyle = '#0F172A'; ctx.fillRect(bx2 - 1, by2 - 1, bw + 2, 10);
    const hpP = this.hp / this.maxHp;
    const hpC = hpP > 0.5 ? '#7C3AED' : hpP > 0.25 ? '#D97706' : '#DC2626';
    ctx.fillStyle = hpC; ctx.shadowColor = hpC; ctx.shadowBlur = 10;
    ctx.fillRect(bx2, by2, bw * hpP, 8);
    ctx.globalAlpha = 1; ctx.shadowBlur = 0;
    ctx.fillStyle = '#E2E8F0';
    ctx.font = 'bold 11px "SF Mono","Fira Code",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'top';
    ctx.fillText('THE ENEMY', x, by2 + 12);

    ctx.restore();
  }
}

class Particle {
  // type: 'circle' | 'spark'
  constructor(x, y, color, vx, vy, life, size, type = 'circle') {
    this.x = x; this.y = y;
    this.color = color;
    this.vx = vx; this.vy = vy;
    this.life = life; this.maxLife = life;
    this.size = size;
    this.type = type;
    this.dead = false;
  }
  update() {
    this.x += this.vx;
    this.y += this.vy;
    this.vx *= 0.98;
    this.vy += 0.05; // gravity
    this.life--;
    if (this.life <= 0) this.dead = true;
  }
  draw(ctx) {
    const a = Math.max(0, this.life / this.maxLife);
    ctx.save();
    ctx.globalAlpha = a;
    ctx.shadowColor = this.color;
    ctx.shadowBlur  = 8;
    if (this.type === 'spark') {
      ctx.strokeStyle = this.color;
      ctx.lineWidth   = this.size * 0.6;
      ctx.beginPath();
      ctx.moveTo(this.x, this.y);
      ctx.lineTo(this.x - this.vx * 3.5, this.y - this.vy * 3.5);
      ctx.stroke();
    } else {
      ctx.fillStyle = this.color;
      ctx.beginPath();
      ctx.arc(this.x, this.y, Math.max(0.5, this.size * a), 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
  }
}

class Powerup {
  constructor(x, y, type) {
    this.x = x; this.y = y;
    this.type = type;
    this.w = 22; this.h = 22;
    this.speed = 1.0;
    this.dead = false;
    this.age  = 0;
  }
  update() { this.y += this.speed; this.age++; }
  draw(ctx) {
    ctx.save();
    const { x, y, type, age } = this;
    const bob = Math.sin(age * 0.07) * 3;
    ctx.shadowColor = type.color;
    ctx.shadowBlur  = 18;
    ctx.strokeStyle = type.color;
    ctx.lineWidth   = 2;
    ctx.beginPath(); ctx.arc(x, y + bob, 13, 0, Math.PI * 2); ctx.stroke();
    ctx.fillStyle  = type.color;
    ctx.font = 'bold 7px "SF Mono","Fira Code",monospace';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(type.label, x, y + bob);
    ctx.restore();
  }
}

// ============================================================
//  HELPERS
// ============================================================

function lightenColor(hex, pct) {
  const n = parseInt(hex.slice(1), 16);
  const r = Math.min(255, ((n >> 16) & 0xFF) + pct);
  const g = Math.min(255, ((n >> 8)  & 0xFF) + pct);
  const b = Math.min(255, ((n)       & 0xFF) + pct);
  return `rgb(${r},${g},${b})`;
}

function drawGlow(ctx, x, y, r, color, blur) {
  ctx.save();
  ctx.shadowColor = color; ctx.shadowBlur = blur;
  ctx.fillStyle = color;
  ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
  ctx.restore();
}

function rectsOverlap(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax - aw / 2 < bx + bw / 2 &&
         ax + aw / 2 > bx - bw / 2 &&
         ay - ah / 2 < by + bh / 2 &&
         ay + ah / 2 > by - bh / 2;
}

// ============================================================
//  BACKGROUND (Phase 2: nebulae layer)
// ============================================================
class Background {
  constructor(w, h) {
    this.w = w; this.h = h;
    this.stars = [];
    this.nebulae = [];
    this.grid = [];

    for (let i = 0; i < 90; i++) {
      this.stars.push({
        x: Math.random() * w, y: Math.random() * h,
        r: Math.random() * 1.6 + 0.3,
        spd: Math.random() * 0.35 + 0.08,
        a: Math.random() * 0.8 + 0.2,
        twinkle: Math.random() * Math.PI * 2
      });
    }

    // Drifting nebula clouds — muted deep colors
    const nebulaColors = [
      'rgba(124,58,237,',   // purple
      'rgba(29,78,216,',    // blue
      'rgba(109,40,217,',   // indigo
      'rgba(15,23,42,',     // near-black blue
    ];
    for (let i = 0; i < 5; i++) {
      this.nebulae.push({
        x: Math.random() * w,
        y: Math.random() * h,
        r: 90 + Math.random() * 130,
        color: nebulaColors[i % nebulaColors.length],
        vx: (Math.random() - 0.5) * 0.12,
        vy: (Math.random() - 0.5) * 0.07,
        a: Math.random() * 0.07 + 0.025,
        phase: Math.random() * Math.PI * 2
      });
    }

    const cols = 10, rows = 14;
    for (let r = 0; r <= rows; r++) this.grid.push({ type:'h', y: r * (h / rows) });
    for (let c = 0; c <= cols; c++) this.grid.push({ type:'v', x: c * (w / cols) });
    this._t = 0;
  }

  update() {
    this._t++;
    for (const s of this.stars) {
      s.y += s.spd;
      s.twinkle += 0.03;
      if (s.y > this.h) s.y = 0;
    }
    for (const n of this.nebulae) {
      n.x += n.vx; n.y += n.vy;
      if (n.x < -n.r) n.x = this.w + n.r;
      if (n.x > this.w + n.r) n.x = -n.r;
      if (n.y < -n.r) n.y = this.h + n.r;
      if (n.y > this.h + n.r) n.y = -n.r;
    }
  }

  draw(ctx) {
    // Base gradient
    const bg = ctx.createRadialGradient(this.w / 2, this.h * 0.4, 0, this.w / 2, this.h * 0.4, this.h * 0.85);
    bg.addColorStop(0, '#0A1628');
    bg.addColorStop(1, '#050A14');
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, this.w, this.h);

    // Nebulae
    for (const n of this.nebulae) {
      const pulse = n.a * (0.85 + 0.15 * Math.sin(this._t * 0.015 + n.phase));
      const grad = ctx.createRadialGradient(n.x, n.y, 0, n.x, n.y, n.r);
      grad.addColorStop(0, n.color + pulse + ')');
      grad.addColorStop(0.5, n.color + (pulse * 0.4) + ')');
      grad.addColorStop(1, 'transparent');
      ctx.fillStyle = grad;
      ctx.fillRect(n.x - n.r, n.y - n.r, n.r * 2, n.r * 2);
    }

    // Grid
    ctx.save();
    ctx.strokeStyle = 'rgba(96,165,250,0.04)';
    ctx.lineWidth = 0.5;
    for (const g of this.grid) {
      ctx.beginPath();
      if (g.type === 'h') { ctx.moveTo(0, g.y); ctx.lineTo(this.w, g.y); }
      else                { ctx.moveTo(g.x, 0); ctx.lineTo(g.x, this.h); }
      ctx.stroke();
    }
    ctx.restore();

    // Stars (twinkle via alpha modulation)
    for (const s of this.stars) {
      const ta = s.a * (0.6 + 0.4 * Math.sin(s.twinkle));
      ctx.save();
      ctx.globalAlpha = ta;
      ctx.fillStyle = '#FFFFFF';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
  }
}

// ============================================================
//  UI MANAGER
// ============================================================
const ui = {
  _hide(id) { const el = document.getElementById(id); if (el) el.classList.add('hidden'); },
  _show(id) { const el = document.getElementById(id); if (el) el.classList.remove('hidden'); },

  showMenu() {
    ['screen-armor','screen-scores','screen-pause','screen-level','screen-gameover','screen-victory','screen-menu'].forEach(s => this._hide(s));
    ['hud','touch-controls','verse-popup'].forEach(s => this._hide(s));
    this._show('screen-menu');
  },
  showArmor() { this._hide('screen-menu'); this._show('screen-armor'); },
  showScores() {
    this._hide('screen-menu');
    const scores = Leaderboard.get();
    const list   = document.getElementById('scores-list');
    list.innerHTML = scores.length
      ? scores.slice(0, 10).map((s, i) => `
          <div class="score-row">
            <span class="score-rank">${i + 1}</span>
            <span class="score-name">${s.name}</span>
            <span class="score-val">${s.score.toLocaleString()}</span>
          </div>`).join('')
      : '<p class="score-empty">No battles recorded yet.</p>';
    this._show('screen-scores');
  },
  showGame() {
    ['screen-menu','screen-armor','screen-scores','screen-gameover','screen-victory','screen-pause','screen-level'].forEach(s => this._hide(s));
    this._show('hud');
    if (isMobile()) this._show('touch-controls');
  },
  showPause()  { this._show('screen-pause'); },
  hidePause()  { this._hide('screen-pause'); },

  showLevelComplete(levelIdx, score) {
    this._hide('screen-pause');
    this._show('screen-level');
    const v = LEVEL_VERSES[levelIdx] || LEVEL_VERSES[0];
    document.getElementById('level-complete-title').textContent = `Level ${levelIdx + 1} Complete`;
    document.getElementById('level-complete-sub').textContent   = LEVELS[levelIdx]?.name || '';
    document.getElementById('level-complete-verse').innerHTML   = `<p>"${v.text}"</p><span class="verse-ref">${v.ref}</span>`;
    document.getElementById('level-score-display').textContent  = `Score: ${score.toLocaleString()}`;
  },

  showGameOver(score) {
    ['hud','touch-controls','verse-popup'].forEach(s => this._hide(s));
    this._show('screen-gameover');
    document.getElementById('final-score-display').textContent = `Score: ${score.toLocaleString()}`;
    const isHigh = Leaderboard.isHighScore(score);
    document.getElementById('new-high-score').classList.toggle('hidden', !isHigh);
    if (isHigh) Leaderboard.add('Champion', score);
    Audio.gameOver();
  },

  showVictory(score) {
    ['hud','touch-controls','verse-popup'].forEach(s => this._hide(s));
    this._show('screen-victory');
    document.getElementById('victory-score-display').textContent = `Final Score: ${score.toLocaleString()}`;
    Leaderboard.add('Champion', score);
  },

  updateHUD(player, score, levelIdx, combo, weaponName) {
    const pct = Math.max(0, player.hp / player.maxHp);
    const bar = document.getElementById('faith-bar');
    bar.style.width = (pct * 100) + '%';
    bar.style.background = pct > 0.5
      ? 'linear-gradient(90deg, #22C55E, #4ADE80)'
      : pct > 0.25
        ? 'linear-gradient(90deg, #EAB308, #FCD34D)'
        : 'linear-gradient(90deg, #EF4444, #F87171)';

    document.getElementById('score-display').textContent = score.toLocaleString();
    const lvl = LEVELS[levelIdx];
    document.getElementById('level-display').textContent  = `LVL ${levelIdx + 1} — ${lvl ? lvl.name.toUpperCase() : 'BOSS BATTLE'}`;
    document.getElementById('weapon-display').textContent = weaponName;
    document.getElementById('lives-display').textContent  = '✦'.repeat(Math.max(0, player.lives)) || '—';

    const comboEl = document.getElementById('combo-display');
    if (combo >= 3) {
      comboEl.textContent = `VICTORY STREAK ×${combo}`;
      comboEl.classList.remove('hidden');
      void comboEl.offsetWidth;
    } else {
      comboEl.classList.add('hidden');
    }
  },

  showVerse(type) {
    const v = VERSES[type];
    if (!v) return;
    const popup = document.getElementById('verse-popup');
    document.getElementById('verse-enemy-name').textContent  = ENEMY_DEF[type]?.name || type;
    document.getElementById('verse-text').textContent        = `"${v.text}"`;
    document.getElementById('verse-ref-display').textContent = v.ref;
    popup.classList.remove('hidden');
    clearTimeout(this._verseTimer);
    this._verseTimer = setTimeout(() => popup.classList.add('hidden'), 2800);
  },

  showBossVerse() {
    const v = VERSES['BOSS'];
    const popup = document.getElementById('verse-popup');
    document.getElementById('verse-enemy-name').textContent  = 'The Enemy';
    document.getElementById('verse-text').textContent        = `"${v.text}"`;
    document.getElementById('verse-ref-display').textContent = v.ref;
    popup.classList.remove('hidden');
  }
};

// ============================================================
//  LEADERBOARD
// ============================================================
const Leaderboard = {
  KEY: 'aog_scores',
  get() { try { return JSON.parse(localStorage.getItem(this.KEY)) || []; } catch { return []; } },
  add(name, score) {
    const scores = this.get();
    scores.push({ name, score, date: new Date().toLocaleDateString() });
    scores.sort((a, b) => b.score - a.score);
    localStorage.setItem(this.KEY, JSON.stringify(scores.slice(0, 20)));
  },
  isHighScore(score) { const s = this.get(); return s.length === 0 || score > s[0].score; }
};

// ============================================================
//  GAME CONTROLLER
// ============================================================
class Game {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx    = canvas.getContext('2d');
    this.input  = new Input();
    this._resize();
    window.addEventListener('resize', () => this._resize());
    this.bg    = new Background(this.W, this.H);
    this.state = 'idle';
    this._raf  = null;
    // Phase 2: screen shake state
    this._shakeX = 0; this._shakeY = 0;
    this._shakeDur = 0; this._shakeMag = 0;
    // Phase 2: overlay flash state
    this._comboFlash = 0;
    this._hitFlash   = 0;
    // Phase 2: boss intro
    this._bossIntroTimer = 0;
    this._bossIntroActive = false;
  }

  _resize() {
    const dpr  = window.devicePixelRatio || 1;
    this.W = this.canvas.clientWidth;
    this.H = this.canvas.clientHeight;
    this.canvas.width  = this.W * dpr;
    this.canvas.height = this.H * dpr;
    this.ctx.scale(dpr, dpr);
    if (this.bg) { this.bg.w = this.W; this.bg.h = this.H; }
  }

  // Phase 2: trigger screen shake
  _shake(mag, dur) { this._shakeMag = mag; this._shakeDur = dur; }

  start() {
    this.state    = 'playing';
    this.score    = 0;
    this.combo    = 0;
    this.comboTimer = 0;
    this.levelIdx = 0;
    this.isBoss   = false;

    this.player = new Player(this.W / 2, this.H - 80);
    this.player.lives = 3;
    this.player.dead  = false;
    this._playerDeathTimer = 0;

    this.bullets   = [];
    this.eBullets  = [];
    this.particles = [];
    this.powerups  = [];
    this.enemies   = [];
    this.boss      = null;

    this.fireTimer     = 0;
    this.fireCooldown  = 18;
    this.enemyDir      = 1;
    this.shootTimer    = 0;
    this.shootInterval = 0;
    this.shouldDrop    = false;
    this.powerupTimers = {};
    this._comboFlash   = 0;
    this._hitFlash     = 0;
    this._bossIntroActive = false;
    this._bossIntroTimer  = 0;

    this._buildLevel(0);
    ui.showGame();
    this._loop();
  }

  _buildLevel(idx) {
    if (idx >= LEVELS.length) { this._startBoss(); return; }
    const lvl  = LEVELS[idx];
    const cols = lvl.cols, rows = lvl.rows;
    this.enemies = [];

    const xGap   = Math.min(60, (this.W - 60) / Math.max(1, cols - 1));
    const startX = (this.W - (cols - 1) * xGap) / 2;
    const startY = 80;

    for (let r = 0; r < rows; r++) {
      const eType = lvl.enemies[r % lvl.enemies.length];
      for (let c = 0; c < cols; c++) {
        // Phase 2: stagger spawn delays by column + row
        const delay = c * 5 + r * 12;
        this.enemies.push(new Enemy(eType, startX + c * xGap, startY + r * 56, delay));
      }
    }

    this.isBoss        = false;
    this.boss          = null;
    this.dropSpd       = lvl.dropSpd;
    this.shootInterval = lvl.shootInterval;
    this.dropStep      = 20;
    this.shouldDrop    = false;
    this.shootTimer    = 0;
    this.enemyDir      = 1;
  }

  _startBoss() {
    this.isBoss = true;
    this.enemies = [];
    this.boss = new Boss(this.W);
    this.shootInterval = 900;
    this.shootTimer    = 0;
    // Phase 2: boss intro
    this._bossIntroActive = true;
    this._bossIntroTimer  = 150;
    this.boss.y = -this.boss.h - 30;
    Audio.bossIntro();
    ui.showBossVerse();
  }

  togglePause() {
    if (this.state === 'playing') {
      this.state = 'paused';
      cancelAnimationFrame(this._raf);
      ui.showPause();
    } else if (this.state === 'paused') {
      this.state = 'playing';
      ui.hidePause();
      this._loop();
    }
  }

  _loop() {
    this._raf = requestAnimationFrame(() => {
      if (this.state !== 'playing') return;
      this._update();
      this._draw();
      this._loop();
    });
  }

  _update() {
    const { player, input } = this;
    this.bg.update();

    // Phase 2: update screen shake
    if (this._shakeDur > 0) {
      this._shakeDur--;
      const m = this._shakeMag * (this._shakeDur / 14);
      this._shakeX = (Math.random() - 0.5) * m * 2;
      this._shakeY = (Math.random() - 0.5) * m * 2;
    } else { this._shakeX = 0; this._shakeY = 0; }

    // Phase 2: player death animation
    if (this._playerDeathTimer > 0) {
      this._playerDeathTimer--;
      for (const p of this.particles) p.update();
      this.particles = this.particles.filter(p => !p.dead);
      if (this._playerDeathTimer === 0) {
        this.state = 'over';
        cancelAnimationFrame(this._raf);
        setTimeout(() => ui.showGameOver(Math.round(this.score)), 100);
      }
      return;
    }

    // Powerup timers
    this.comboTimer = Math.max(0, this.comboTimer - 1);
    if (this.comboTimer === 0 && this.combo > 0) this.combo = 0;

    for (const [key, t] of Object.entries(this.powerupTimers)) {
      this.powerupTimers[key] = Math.max(0, t - 16.67);
      if (this.powerupTimers[key] <= 0) {
        if (key === 'shield') { player.shielded = false; delete this.powerupTimers.shield; }
        if (key === 'rapid')  { player.rapidFire = false; this.fireCooldown = 18; delete this.powerupTimers.rapid; }
        if (key === 'bible')  { player.weaponPowered = false; player.weaponIdx = 0; delete this.powerupTimers.bible; }
      }
    }

    // Player
    player.update(input, this.W);

    // Fire
    this.fireTimer = Math.max(0, this.fireTimer - 1);
    if (input.fire && this.fireTimer === 0) {
      this._playerShoot();
      this.fireTimer = player.rapidFire ? 7 : this.fireCooldown;
    }

    // Enemies / Boss
    if (this.isBoss) { this._updateBoss(); }
    else             { this._updateEnemies(); }

    // Bullets
    for (const b of this.bullets)  { b.update(); if (b.y < -b.h)      b.dead = true; }
    for (const b of this.eBullets) { b.update(); if (b.y > this.H + b.h) b.dead = true; }

    // Collision: player bullets vs enemies/boss
    for (const b of this.bullets) {
      if (b.dead) continue;
      if (this.isBoss && this.boss && !this.boss.dead && !this._bossIntroActive) {
        if (rectsOverlap(b.x, b.y, b.w, b.h, this.boss.x, this.boss.y, this.boss.w, this.boss.h)) {
          b.dead = true;
          this._spawnHitParticles(b.x, b.y, '#A78BFA', 5);
          this._shake(4, 6);
          if (this.boss.takeDamage(b.dmg)) {
            this._spawnExplosion(this.boss.x, this.boss.y, '#7C3AED', 35);
            this._spawnBossDeathBurst();
            this._onBossKilled();
          }
        }
      } else {
        for (const e of this.enemies) {
          if (e.dead || b.dead || !e.spawned) continue;
          if (rectsOverlap(b.x, b.y, b.w, b.h, e.x, e.y, e.w, e.h)) {
            b.dead = true;
            this._spawnHitParticles(e.x, e.y, e.color, 4);
            if (e.takeDamage(b.dmg)) {
              this._spawnTypedExplosion(e);
              this._onEnemyKilled(e);
            }
          }
        }
      }
    }

    // Collision: enemy bullets vs player
    for (const b of this.eBullets) {
      if (b.dead) continue;
      if (rectsOverlap(b.x, b.y, b.w, b.h, player.x, player.y, player.w, player.h)) {
        b.dead = true;
        this._spawnHitParticles(player.x, player.y, '#F87171', 7);
        if (player.takeDamage(22)) {
          this._shake(9, 14);
          this._hitFlash = 8;
          this._checkPlayerDeath();
        }
      }
    }

    // Enemies reaching player row
    if (!this.isBoss) {
      for (const e of this.enemies) {
        if (e.dead || !e.spawned) continue;
        if (e.y + e.h / 2 >= this.H - 100) {
          if (!player.invincible && !player.shielded) {
            player.takeDamage(35);
            this._shake(8, 12);
            this._hitFlash = 8;
            this._checkPlayerDeath();
          }
          e.dead = true;
          this._spawnExplosion(e.x, e.y, e.color, 10);
        }
      }
    }

    // Powerup collection
    for (const p of this.powerups) {
      if (p.dead) continue;
      p.update();
      if (p.y > this.H + 20) { p.dead = true; continue; }
      if (rectsOverlap(p.x, p.y, p.w + 12, p.h + 12, player.x, player.y, player.w, player.h)) {
        p.dead = true;
        this._applyPowerup(p.type);
      }
    }

    // Particles
    for (const p of this.particles) p.update();

    // Clean dead
    this.bullets   = this.bullets.filter(b => !b.dead);
    this.eBullets  = this.eBullets.filter(b => !b.dead);
    this.particles = this.particles.filter(p => !p.dead);
    this.powerups  = this.powerups.filter(p => !p.dead);
    this.enemies   = this.enemies.filter(e => !e.dead);

    // Level clear
    if (!this.isBoss && this.enemies.length === 0 && !this._bossIntroActive) {
      this._onLevelClear();
    }

    ui.updateHUD(player, Math.round(this.score), this.levelIdx, this.combo, player.weapon.name);
  }

  _updateEnemies() {
    let hitWall = false;
    for (const e of this.enemies) {
      if (e.dead) continue;
      e.update(this.dropSpd * this.enemyDir);
      if (e.spawned && (e.x + e.w / 2 >= this.W - 8 || e.x - e.w / 2 <= 8)) hitWall = true;
    }
    if (hitWall && !this.shouldDrop) { this.enemyDir *= -1; this.shouldDrop = true; }
    if (this.shouldDrop) {
      for (const e of this.enemies) if (e.spawned) e.y += this.dropStep;
      this.shouldDrop = false;
    }

    this.shootTimer += 16.67;
    if (this.shootTimer >= this.shootInterval) {
      this.shootTimer = 0;
      const alive = this.enemies.filter(e => !e.dead && e.spawned);
      if (alive.length) {
        const shooter = alive[Math.floor(Math.random() * alive.length)];
        this.eBullets.push(new Bullet(shooter.x, shooter.y + shooter.h / 2,
          { w: 4, h: 14, spd: 0, dmg: 1, color: '#F87171', glow: 'rgba(248,113,113,0.8)', trail: '#FCA5A5' }, true));
      }
    }
  }

  _updateBoss() {
    if (!this.boss || this.boss.dead) return;

    // Phase 2: boss intro slide-in
    if (this._bossIntroActive) {
      this._bossIntroTimer--;
      // Slide from off-screen to targetY over first 80 frames
      const elapsed = 150 - this._bossIntroTimer;
      if (elapsed <= 80) {
        const t = elapsed / 80;
        const ease = t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2;
        this.boss.y = -this.boss.h - 30 + (this.boss.targetY + this.boss.h + 30) * ease;
      } else {
        this.boss.y = this.boss.targetY;
      }
      if (this._bossIntroTimer <= 0) {
        this._bossIntroActive = false;
        this.boss.y = this.boss.targetY;
        ui._hide('verse-popup');
      }
      this.boss.age++;
      return;
    }

    this.boss.update(this.W);
    if (this.boss.canShoot(this.shootInterval)) {
      const spread = this.boss.phase2 ? 3 : 1;
      for (let i = 0; i < spread; i++) {
        const ox = (i - Math.floor(spread / 2)) * 28;
        this.eBullets.push(new Bullet(
          this.boss.x + ox, this.boss.y + this.boss.h / 2,
          { w: 5, h: 18, spd: 0, dmg: 1, color: '#F87171', glow: 'rgba(248,113,113,0.8)', trail: '#FCA5A5' }, true));
      }
    }
  }

  _playerShoot() {
    const w = this.player.weapon;
    const b = new Bullet(this.player.x, this.player.y - this.player.h / 2, w, false);
    if (this.player.weaponPowered) b.dmg = Math.ceil(w.dmg * 1.5);
    this.bullets.push(b);
    Audio.shoot();
  }

  _onEnemyKilled(e) {
    Audio.kill();
    this.score += e.pts * (1 + this.combo * 0.1);
    this.combo++;
    this.comboTimer = 180;
    // Phase 2: combo flash on streak
    if (this.combo >= 5) this._comboFlash = 22;
    if (Math.random() < e.drop) this._spawnPowerup(e.x, e.y);
    ui.showVerse(e.type);
    this._checkWeaponRotate();
  }

  _onBossKilled() {
    Audio.levelUp();
    this.score += 2000;
    this._shake(18, 40);
    setTimeout(() => {
      this.state = 'paused';
      cancelAnimationFrame(this._raf);
      ui.showVictory(Math.round(this.score));
    }, 2200);
  }

  _onLevelClear() {
    this.state = 'paused';
    cancelAnimationFrame(this._raf);
    Audio.levelUp();
    setTimeout(() => ui.showLevelComplete(this.levelIdx, Math.round(this.score)), 500);
  }

  nextLevel() {
    this.levelIdx++;
    ui.hidePause();
    ui._hide('screen-level');
    ui.showGame();
    this.state = 'playing';
    if (this.levelIdx >= LEVELS.length) this._startBoss();
    else this._buildLevel(this.levelIdx);
    this._loop();
  }

  _checkWeaponRotate() {
    const wIdx = Math.floor(this.score / 800) % WEAPONS.length;
    if (!this.player.weaponPowered) this.player.weaponIdx = wIdx;
  }

  _checkPlayerDeath() {
    const { player } = this;
    if (player.hp <= 0) {
      player.lives--;
      if (player.lives > 0) {
        player.hp = player.maxHp;
        player.invincible = true;
        player.invTimer   = 140;
      } else {
        // Phase 2: death animation before game over
        player.dead = true;
        this._playerDeathTimer = 85;
        this._spawnExplosion(player.x, player.y, '#A78BFA', 50);
        this._spawnExplosion(player.x, player.y, '#FFFFFF', 20);
        this._shake(16, 35);
      }
    }
  }

  _spawnPowerup(x, y) {
    const type = POWERUP_TYPES[Math.floor(Math.random() * POWERUP_TYPES.length)];
    this.powerups.push(new Powerup(x, y, type));
  }

  _applyPowerup(type) {
    Audio.powerup();
    const { player } = this;
    // Phase 2: burst
    this._spawnPowerupBurst(player.x, player.y, type.color);
    switch (type.id) {
      case 'bible':
        player.weaponPowered = true;
        player.weaponIdx = 3;
        this.powerupTimers.bible = type.dur;
        break;
      case 'shield':
        player.shielded = true;
        this.powerupTimers.shield = type.dur;
        break;
      case 'cross':
        player.hp = Math.min(player.maxHp, player.hp + 38);
        break;
      case 'light':
        player.rapidFire = true;
        this.fireCooldown = 5;
        this.powerupTimers.rapid = type.dur;
        break;
    }
  }

  // Phase 2: shape-specific typed explosion
  _spawnTypedExplosion(e) {
    const { x, y, color, shape, w } = e;
    this._spawnExplosion(x, y, color, 14);

    switch (shape) {
      case 'fire':
        // Upward flame sparks
        for (let i = 0; i < 10; i++) {
          const vx = (Math.random() - 0.5) * 3.5;
          const vy = -(Math.random() * 5 + 2);
          this.particles.push(new Particle(x + (Math.random()-0.5)*w*0.5, y, '#FCD34D', vx, vy, 42, 3, 'spark'));
          this.particles.push(new Particle(x + (Math.random()-0.5)*w*0.5, y, '#F97316', vx*0.6, vy*0.6, 30, 2, 'circle'));
        }
        break;
      case 'crystal':
        // 8-directional shards
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const v = 4 + Math.random() * 2.5;
          this.particles.push(new Particle(x, y, '#FCD34D', Math.cos(a)*v, Math.sin(a)*v, 50, 4.5, 'spark'));
          this.particles.push(new Particle(x, y, '#FDE68A', Math.cos(a)*v*0.5, Math.sin(a)*v*0.5, 35, 2.5, 'circle'));
        }
        break;
      case 'ghost':
        // Dissolving mist particles
        for (let i = 0; i < 14; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = Math.random() * 2.5 + 0.5;
          this.particles.push(new Particle(x, y, '#60A5FA', Math.cos(a)*v, Math.sin(a)*v, 65, 5, 'circle'));
        }
        break;
      case 'armored':
        // Armor plate chunks (large slow)
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2;
          this.particles.push(new Particle(x, y, '#A78BFA', Math.cos(a)*3, Math.sin(a)*3, 55, 7, 'circle'));
          this.particles.push(new Particle(x, y, '#C4B5FD', Math.cos(a)*1.5, Math.sin(a)*1.5, 40, 3.5, 'spark'));
        }
        break;
      case 'hexagon':
        // Hexagonal shards in 6 directions
        for (let i = 0; i < 6; i++) {
          const a = (i / 6) * Math.PI * 2 - Math.PI / 2;
          const v = 3 + Math.random() * 2;
          this.particles.push(new Particle(x, y, '#7C3AED', Math.cos(a)*v, Math.sin(a)*v, 48, 4.5, 'spark'));
          this.particles.push(new Particle(x, y, '#A78BFA', Math.cos(a)*v*0.4, Math.sin(a)*v*0.4, 38, 3, 'circle'));
        }
        break;
      case 'erratic':
        // Many tiny sparks in random directions
        for (let i = 0; i < 16; i++) {
          const a = Math.random() * Math.PI * 2;
          const v = Math.random() * 5.5 + 1;
          this.particles.push(new Particle(x, y, '#0891B2', Math.cos(a)*v, Math.sin(a)*v, 28, 2, 'spark'));
        }
        break;
      case 'heavy':
        // Slow heavy chunks outward
        for (let i = 0; i < 8; i++) {
          const a = (i / 8) * Math.PI * 2;
          const v = 1.5 + Math.random() * 2;
          this.particles.push(new Particle(x, y, '#6B7280', Math.cos(a)*v, Math.sin(a)*v, 60, 7, 'circle'));
          this.particles.push(new Particle(x, y, '#9CA3AF', Math.cos(a)*v*2, Math.sin(a)*v*2, 30, 3, 'spark'));
        }
        break;
      case 'arrow':
        // Fan of sparks downward
        for (let i = 0; i < 8; i++) {
          const a = Math.PI * 0.2 + (i / 7) * Math.PI * 0.6;
          const v = 3 + Math.random() * 3;
          this.particles.push(new Particle(x, y, '#DC2626', Math.cos(a)*v, Math.sin(a)*v, 35, 3, 'spark'));
        }
        break;
    }
  }

  _spawnBossDeathBurst() {
    const bx = this.boss.x, by = this.boss.y;
    for (let wave = 0; wave < 4; wave++) {
      setTimeout(() => {
        const ox = (Math.random()-0.5)*60, oy = (Math.random()-0.5)*40;
        this._spawnExplosion(bx + ox, by + oy, '#7C3AED', 20);
        this._spawnExplosion(bx + ox*0.5, by + oy*0.5, '#F87171', 12);
        this._shake(10, 18);
      }, wave * 350);
    }
  }

  // Phase 2: powerup collection burst
  _spawnPowerupBurst(x, y, color) {
    for (let i = 0; i < 22; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * 6 + 2;
      this.particles.push(new Particle(x, y, color, Math.cos(a)*v, Math.sin(a)*v, 38, 3 + Math.random()*3, 'circle'));
    }
    this.particles.push(new Particle(x, y, '#FFFFFF', 0, -0.5, 18, 14, 'circle'));
  }

  _spawnHitParticles(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * 3 + 0.5;
      this.particles.push(new Particle(x, y, color, Math.cos(a)*v, Math.sin(a)*v, 22 + Math.random()*14, 2 + Math.random()*2, 'circle'));
    }
  }

  _spawnExplosion(x, y, color, count) {
    for (let i = 0; i < count; i++) {
      const a = Math.random() * Math.PI * 2;
      const v = Math.random() * 4.5 + 1;
      this.particles.push(new Particle(x, y, color, Math.cos(a)*v, Math.sin(a)*v, 38 + Math.random()*28, 3 + Math.random()*3.5, 'circle'));
    }
    this.particles.push(new Particle(x, y, '#FFFFFF', 0, 0, 14, 12, 'circle'));
  }

  _draw() {
    const { ctx, W, H } = this;
    ctx.clearRect(0, 0, W, H);

    // Phase 2: apply screen shake as transform
    ctx.save();
    if (this._shakeDur > 0) ctx.translate(this._shakeX, this._shakeY);

    this.bg.draw(ctx);
    for (const p of this.powerups) p.draw(ctx);
    for (const e of this.enemies)  e.draw(ctx);
    if (this.boss && !this.boss.dead) this.boss.draw(ctx);
    this.player.draw(ctx);
    for (const p of this.particles) p.draw(ctx);
    for (const b of this.bullets)  b.draw(ctx);
    for (const b of this.eBullets) b.draw(ctx);

    ctx.restore(); // end shake transform

    // Screen overlays (no shake — drawn on top)
    this._drawScreenEffects();
  }

  // Phase 2: overlay effects drawn after shake restore
  _drawScreenEffects() {
    const { ctx, W, H } = this;

    // Red vignette flash when player is hit
    if (this._hitFlash > 0) {
      ctx.save();
      ctx.globalAlpha = (this._hitFlash / 8) * 0.22;
      const vig = ctx.createRadialGradient(W/2, H/2, H*0.2, W/2, H/2, H*0.7);
      vig.addColorStop(0, 'transparent');
      vig.addColorStop(1, '#DC2626');
      ctx.fillStyle = vig;
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      this._hitFlash--;
    }

    // Gold screen flash on victory streak
    if (this._comboFlash > 0) {
      ctx.save();
      ctx.globalAlpha = (this._comboFlash / 22) * 0.16;
      ctx.fillStyle = '#FCD34D';
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
      this._comboFlash--;
    }

    // Boss intro cinematic overlay
    if (this._bossIntroActive && this._bossIntroTimer > 0) {
      this._drawBossIntroOverlay();
    }
  }

  // Phase 2: boss intro canvas overlay
  _drawBossIntroOverlay() {
    const { ctx, W, H } = this;
    const t = this._bossIntroTimer; // 150 → 0

    // Overlay alpha: ramp up (150→110), hold (110→30), ramp out (30→0)
    let oa = 0;
    if (t > 110)     oa = (150 - t) / 40;      // 0 → 1
    else if (t > 30) oa = 1;                    // hold
    else             oa = t / 30;               // 1 → 0

    ctx.save();
    ctx.globalAlpha = oa * 0.72;
    ctx.fillStyle = '#000000';
    ctx.fillRect(0, 0, W, H);

    // Text fades in after dark overlay is up
    if (t < 115) {
      const textAlpha = Math.min(1, (115 - t) / 25) * oa;
      ctx.globalAlpha = textAlpha;

      // Subtitle
      ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      ctx.shadowColor = '#7C3AED'; ctx.shadowBlur = 25;
      ctx.fillStyle = '#A78BFA';
      ctx.font = '600 10px "SF Mono","Fira Code",monospace';
      ctx.fillText('E P H E S I A N S   6 : 1 2', W / 2, H / 2 - 32);

      // Main title
      ctx.shadowColor = '#FFFFFF'; ctx.shadowBlur = 30;
      ctx.fillStyle = '#FFFFFF';
      ctx.font = 'bold 28px "SF Mono","Fira Code",monospace';
      ctx.fillText('THE ENEMY', W / 2, H / 2 + 4);

      // Tag
      ctx.shadowColor = '#DC2626'; ctx.shadowBlur = 15;
      ctx.fillStyle = '#F87171';
      ctx.font = '500 9px "SF Mono","Fira Code",monospace';
      ctx.fillText('F I N A L   B A T T L E', W / 2, H / 2 + 32);
    }
    ctx.restore();
  }
}

// ============================================================
//  UTILITY
// ============================================================
function isMobile() {
  return window.innerWidth < 600 || 'ontouchstart' in window;
}

// ============================================================
//  INIT
// ============================================================
let game;

window.addEventListener('DOMContentLoaded', () => {
  Audio.init();

  const canvas = document.getElementById('gameCanvas');
  game = new Game(canvas);

  document.getElementById('btn-start').addEventListener('click', () => { Audio.resume(); game.start(); });
  document.getElementById('btn-armor').addEventListener('click', () => ui.showArmor());
  document.getElementById('btn-scores').addEventListener('click', () => ui.showScores());

  document.getElementById('btn-resume').addEventListener('click', () => game.togglePause());
  document.getElementById('btn-quit').addEventListener('click', () => {
    game.state = 'idle';
    cancelAnimationFrame(game._raf);
    ui._hide('screen-pause');
    ui._hide('hud');
    ui._hide('touch-controls');
    ui.showMenu();
  });

  document.getElementById('pause-btn').addEventListener('click', () => { Audio.resume(); game.togglePause(); });
  document.getElementById('btn-next-level').addEventListener('click', () => game.nextLevel());

  document.getElementById('btn-restart').addEventListener('click', () => { ui._hide('screen-gameover'); game.start(); });
  document.getElementById('btn-menu').addEventListener('click', () => { ui._hide('screen-gameover'); ui.showMenu(); });
  document.getElementById('btn-play-again').addEventListener('click', () => { ui._hide('screen-victory'); game.start(); });
  document.getElementById('btn-menu-v').addEventListener('click', () => { ui._hide('screen-victory'); ui.showMenu(); });

  // Idle background loop
  (function idleDraw() {
    if (game.state === 'idle') { game.bg.update(); game.bg.draw(game.ctx); }
    requestAnimationFrame(idleDraw);
  })();

  ui.showMenu();
});
