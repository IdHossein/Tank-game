'use strict';

/* =============================================================
   game.js — Tank Defense  |  HTML5 Canvas 2D
   ============================================================= */

// ─── CONSTANTS ────────────────────────────────────────────────
const CANVAS_W = 800;
const CANVAS_H = 600;
const DEFENSE_Y = CANVAS_H - 112;   // dashed defense line y
const PLAYER_Y  = CANVAS_H - 58;    // player tank centre y
const P_SPEED   = 5;
const P_BULLET_SPD = 11;
const MAX_PARTICLES = 220;

// Score needed to REACH each level (index = level-1)
const LEVEL_THRESHOLDS = [0, 300, 800, 1600, 2700, 4200, 6500, 9500, 13500, 18500];

// ─── STATE ────────────────────────────────────────────────────
let canvas, ctx;
let running    = false;
let gameOverFlag = false;
let rafId      = null;
let score      = 0;
let level      = 1;
let highScore  = parseInt(localStorage.getItem('tankDefenseHS') || '0', 10);
let frameCount = 0;
let spawnTimer = 0;
let lvlUpTimer = 0;   // frames remaining to show level-up msg
let bossSpawned = false;

// DOM refs
let domScore, domLevel, domHigh;
let domStart, domGameOver, domLvlMsg, domLvlText;
let domFinalScore, domFinalHigh;

// ─── ENTITIES ─────────────────────────────────────────────────
let player;
let enemies       = [];
let playerBullets = [];
let enemyBullets  = [];
let particles     = [];
let stars         = [];

// ─── INPUT ────────────────────────────────────────────────────
const keys = {};

// ─── UTILITY ──────────────────────────────────────────────────
function rand(a, b) { return a + Math.random() * (b - a); }

function aabb(ax, ay, aw, ah, bx, by, bw, bh) {
  return ax < bx + bw && ax + aw > bx && ay < by + bh && ay + ah > by;
}

/** Draw a rounded rectangle path (polyfill-safe). */
function rrPath(x, y, w, h, r) {
  r = Math.min(Math.abs(r), Math.abs(w) / 2, Math.abs(h) / 2);
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, r);
  } else {
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y,     x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x,     y + h, r);
    ctx.arcTo(x,     y + h, x,     y,     r);
    ctx.arcTo(x,     y,     x + w, y,     r);
    ctx.closePath();
  }
}

function getLevelFromScore(s) {
  let lv = 1;
  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (s >= LEVEL_THRESHOLDS[i]) { lv = i + 1; break; }
  }
  const last = LEVEL_THRESHOLDS[LEVEL_THRESHOLDS.length - 1];
  if (s >= last) {
    lv = LEVEL_THRESHOLDS.length + Math.floor((s - last) / 6000);
  }
  return lv;
}

function getLevelConfig(lv) {
  const sf = Math.min(3.2, 1 + (lv - 1) * 0.2);
  return {
    enemySpeed:      0.65 * sf,
    spawnInterval:   Math.max(38, 155 - lv * 10),
    enemyHealth:     Math.floor(18 + lv * 13),
    enemyShoot:      lv >= 3,
    shootCooldownMs: Math.max(700, 2800 - lv * 220),
    hasHeli:         lv >= 2,
    hasBoss:         lv >= 5 && lv % 5 === 0,
    maxEnemies:      Math.min(11, 3 + Math.floor(lv / 2)),
    bulletSpd:       Math.min(6.5, 2.4 + lv * 0.22),
    killScore:       90 + (lv - 1) * 22,
  };
}

// ─── ENTITY FACTORIES ─────────────────────────────────────────
function makePlayer() {
  return {
    x: CANVAS_W / 2, y: PLAYER_Y,
    w: 64, h: 44,
    health: 100, maxHealth: 100,
    upgrade: 0,
    lastShot: 0, shotCD: 420,
    alive: true,
  };
}

function makeEnemyTank(lv) {
  const cfg = getLevelConfig(lv);
  return {
    type: 'tank',
    x: rand(62, CANVAS_W - 62), y: -52,
    w: 60, h: 52,
    health: cfg.enemyHealth, maxHealth: cfg.enemyHealth,
    speed: cfg.enemySpeed,
    lastShot: 0, shootCD: cfg.shootCooldownMs,
    alive: true, score: cfg.killScore,
  };
}

function makeHelicopter(lv) {
  const cfg = getLevelConfig(lv);
  return {
    type: 'heli',
    x: rand(62, CANVAS_W - 62), y: -62,
    w: 82, h: 52,
    health: Math.floor(cfg.enemyHealth * 0.75),
    maxHealth: Math.floor(cfg.enemyHealth * 0.75),
    speed: cfg.enemySpeed * 1.15,
    lastShot: 0, shootCD: Math.floor(cfg.shootCooldownMs * 0.78),
    alive: true, score: Math.floor(cfg.killScore * 1.6),
    phase: rand(0, Math.PI * 2),
  };
}

function makeBoss(lv) {
  const cfg = getLevelConfig(lv);
  return {
    type: 'boss',
    x: CANVAS_W / 2, y: -85,
    w: 104, h: 82,
    health: cfg.enemyHealth * 6, maxHealth: cfg.enemyHealth * 6,
    speed: cfg.enemySpeed * 0.48,
    lastShot: 0, shootCD: Math.floor(cfg.shootCooldownMs * 0.38),
    alive: true, score: cfg.killScore * 9,
  };
}

function makePlayerBullet(x, y, upgrade) {
  return { x, y, w: upgrade >= 3 ? 6 : 5, h: upgrade >= 2 ? 20 : 16,
           vy: -(upgrade >= 2 ? 13 : P_BULLET_SPD), isPlayer: true, alive: true };
}

function makeEnemyBullet(x, y, spd, isBoss) {
  return { x, y, w: isBoss ? 11 : 7, h: isBoss ? 20 : 13,
           vy: spd, isPlayer: false, isBoss: !!isBoss, alive: true };
}

function makeParticle(x, y, color, minSpd, maxSpd, minSz, maxSz) {
  const a = rand(0, Math.PI * 2), spd = rand(minSpd, maxSpd);
  return { x, y,
    vx: Math.cos(a) * spd, vy: Math.sin(a) * spd - rand(0, 1.5),
    sz: rand(minSz, maxSz), color,
    alpha: 1, decay: rand(0.022, 0.048), grav: 0.09, alive: true };
}

// ─── EXPLOSIONS ───────────────────────────────────────────────
function explode(x, y, size) {
  const fireColors  = ['#ff4400','#ff8800','#ffcc00','#ff2200','#ffe866','#ffaa00'];
  const smokeBase   = () => `rgba(${110+Math.floor(rand(0,70))},${110+Math.floor(rand(0,70))},${100+Math.floor(rand(0,60))},0.55)`;
  const n = Math.floor(14 * size + rand(6, 14) * size);
  for (let i = 0; i < n && particles.length < MAX_PARTICLES; i++) {
    particles.push(makeParticle(x, y,
      fireColors[Math.floor(Math.random() * fireColors.length)],
      0.8, 4.5 * size, 2 * size, 7 * size));
  }
  const ns = Math.floor(5 * size);
  for (let i = 0; i < ns && particles.length < MAX_PARTICLES; i++) {
    const p = makeParticle(x, y, smokeBase(), 0.3, 1.8 * size, 4 * size, 11 * size);
    p.decay = rand(0.008, 0.022);
    particles.push(p);
  }
}

function hitSpark(x, y) {
  const c = ['#ff8800','#ffcc44','#ffffff'];
  for (let i = 0; i < 5 && particles.length < MAX_PARTICLES; i++) {
    particles.push(makeParticle(x, y, c[Math.floor(Math.random() * c.length)], 2, 7, 1.5, 3.5));
  }
}

// ─── DRAW HELPERS ─────────────────────────────────────────────
function drawHealthBar(cx, topY, barW, hp, maxHp) {
  const bx = cx - barW / 2, bh = 5;
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  rrPath(bx - 1, topY - 1, barW + 2, bh + 2, 2); ctx.fill();
  const ratio = hp / maxHp;
  ctx.fillStyle = ratio > 0.5 ? '#22dd44' : ratio > 0.25 ? '#ffaa00' : '#ff2222';
  if (ratio > 0) { rrPath(bx, topY, barW * ratio, bh, 1); ctx.fill(); }
  ctx.strokeStyle = 'rgba(255,255,255,0.22)';
  ctx.lineWidth = 0.5;
  rrPath(bx, topY, barW, bh, 1); ctx.stroke();
}

// ─── DRAW: BACKGROUND ─────────────────────────────────────────
function drawBackground() {
  const g = ctx.createLinearGradient(0, 0, 0, CANVAS_H);
  g.addColorStop(0,    '#020210');
  g.addColorStop(0.62, '#080d1e');
  g.addColorStop(1,    '#0c1408');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);
}

function drawStars() {
  stars.forEach(s => {
    const tw = 0.35 + 0.65 * Math.sin(frameCount * 0.048 + s.ph);
    ctx.globalAlpha = tw * s.br;
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(s.x, s.y, s.sz, s.sz);
  });
  ctx.globalAlpha = 1;
}

function drawGround() {
  const g = ctx.createLinearGradient(0, CANVAS_H - 88, 0, CANVAS_H);
  g.addColorStop(0, '#142010');
  g.addColorStop(1, '#091208');
  ctx.fillStyle = g;
  ctx.fillRect(0, CANVAS_H - 88, CANVAS_W, 88);
  ctx.strokeStyle = 'rgba(35,75,18,0.38)';
  ctx.lineWidth = 1;
  for (let i = 0; i < CANVAS_W; i += 28) {
    ctx.beginPath();
    ctx.moveTo(i + rand(0, 4), CANVAS_H - 78);
    ctx.lineTo(i + 18 + rand(0, 8), CANVAS_H - 58);
    ctx.stroke();
  }
}

function drawDefenseLine() {
  ctx.save();
  ctx.strokeStyle = '#ff3333';
  ctx.lineWidth = 2;
  ctx.setLineDash([16, 9]);
  ctx.lineDashOffset = -(frameCount * 0.55) % 25;
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur = 9;
  ctx.beginPath();
  ctx.moveTo(0, DEFENSE_Y);
  ctx.lineTo(CANVAS_W, DEFENSE_Y);
  ctx.stroke();
  ctx.restore();
  ctx.fillStyle = 'rgba(255,75,75,0.72)';
  ctx.font = 'bold 10px "Courier New"';
  ctx.textAlign = 'center';
  ctx.fillText('⚠ DEFENSE LINE ⚠', CANVAS_W / 2, DEFENSE_Y - 6);
  ctx.textAlign = 'left';
}

// ─── DRAW: PLAYER TANK ────────────────────────────────────────
const P_SCHEMES = [
  // 0 – Military Green
  { body:'#4a7c52', turret:'#38623f', track:'#232323', barrel:'#2c4830', accent:'#7ac87e', wheel:'#484848' },
  // 1 – Desert Tan
  { body:'#8c7240', turret:'#70582e', track:'#3a2e18', barrel:'#583e1c', accent:'#c49c4e', wheel:'#5a5040' },
  // 2 – Steel Blue
  { body:'#284a72', turret:'#1c3860', track:'#181826', barrel:'#162c48', accent:'#4a88cc', wheel:'#2c304e' },
  // 3 – Elite Black/Gold
  { body:'#242424', turret:'#181818', track:'#0e0e0e', barrel:'#0a0a0a', accent:'#ddaa00', wheel:'#303022' },
];

function drawPlayerTank(p) {
  const s = P_SCHEMES[Math.min(p.upgrade, P_SCHEMES.length - 1)];
  ctx.save();
  ctx.translate(p.x, p.y);

  if (p.upgrade >= 2) {
    ctx.shadowColor = s.accent;
    ctx.shadowBlur  = 14 + 5 * Math.sin(frameCount * 0.09);
  }

  // ── Tracks ──
  [[-38, -14], [26, -14]].forEach(([tx]) => {
    const side = tx < 0 ? -32 : 32;
    ctx.fillStyle = s.track;
    rrPath(tx, -14, 12, 28, 3); ctx.fill();
    ctx.strokeStyle = 'rgba(80,80,80,0.5)'; ctx.lineWidth = 1;
    for (let ty = -10; ty <= 10; ty += 5) {
      ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(tx + 12, ty); ctx.stroke();
    }
    ctx.fillStyle = s.wheel;
    for (let ty = -10; ty <= 10; ty += 5) {
      ctx.beginPath(); ctx.arc(side, ty, 3.2, 0, Math.PI * 2); ctx.fill();
    }
  });

  ctx.shadowBlur = 0;

  // ── Hull ──
  ctx.fillStyle = s.body;
  rrPath(-28, -15, 56, 30, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.055)';
  rrPath(-26, -14, 52, 10, 3); ctx.fill();
  ctx.fillStyle = s.accent;
  ctx.fillRect(-22, -2, 44, 3);

  // Bolts
  ctx.fillStyle = 'rgba(210,210,210,0.65)';
  [-20, 20].forEach(bx => {
    ctx.beginPath(); ctx.arc(bx, -9, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx,  9, 2, 0, Math.PI * 2); ctx.fill();
  });

  // ── Turret ──
  if (p.upgrade >= 2) { ctx.shadowColor = s.accent; ctx.shadowBlur = 8; }
  ctx.fillStyle = s.turret;
  rrPath(-18, -33, 36, 22, 5); ctx.fill();
  ctx.shadowBlur = 0;
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  rrPath(-16, -32, 32, 8, 3); ctx.fill();
  ctx.fillStyle = s.accent;
  ctx.fillRect(-14, -27, 28, 2);

  // Side armour (upgrade 1+)
  if (p.upgrade >= 1) {
    ctx.fillStyle = s.turret;
    rrPath(-28, -31, 10, 18, 2); ctx.fill();
    rrPath( 18, -31, 10, 18, 2); ctx.fill();
  }

  // Shield emitters (upgrade 2+)
  if (p.upgrade >= 2) {
    ctx.shadowColor = s.accent; ctx.shadowBlur = 7;
    ctx.fillStyle = s.accent;
    ctx.beginPath(); ctx.arc(-24, -34, 4, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 24, -34, 4, 0, Math.PI * 2); ctx.fill();
    ctx.shadowBlur = 0;
  }

  // ── Barrel(s) ──
  if (p.upgrade >= 3) {
    // Twin barrel
    ctx.fillStyle = s.barrel;
    rrPath(-11, -63, 7, 32, 2); ctx.fill();
    rrPath(  4, -63, 7, 32, 2); ctx.fill();
    ctx.fillStyle = s.accent;
    rrPath(-13, -67, 11, 6, 2); ctx.fill();
    rrPath(  2, -67, 11, 6, 2); ctx.fill();
  } else {
    ctx.fillStyle = s.barrel;
    rrPath(-4, -63, 8, 32, 2); ctx.fill();
    ctx.fillStyle = s.accent;
    rrPath(-7, -67, 14, 7, 2); ctx.fill();
  }

  ctx.restore();
}

// ─── DRAW: ENEMY TANK ─────────────────────────────────────────
function drawEnemyTank(e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  // Barrel pointing DOWN
  ctx.fillStyle = '#300808';
  rrPath(-4, 18, 8, 30, 2); ctx.fill();
  rrPath(-6, 45, 12, 7,  2); ctx.fill();

  // Turret
  ctx.fillStyle = '#480c0c';
  rrPath(-16, 6, 32, 22, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  rrPath(-14, 7, 28, 8, 3); ctx.fill();

  // Hull
  ctx.fillStyle = '#681414';
  rrPath(-28, -15, 56, 30, 5); ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.04)';
  rrPath(-26, -14, 52, 10, 3); ctx.fill();
  ctx.fillStyle = '#cc2020';
  ctx.fillRect(-22, -2, 44, 3);

  // Bolts
  ctx.fillStyle = 'rgba(200,150,150,0.55)';
  [-20, 20].forEach(bx => {
    ctx.beginPath(); ctx.arc(bx, -9, 2, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc(bx,  9, 2, 0, Math.PI * 2); ctx.fill();
  });

  // Tracks
  ctx.fillStyle = '#281818';
  rrPath(-38, -14, 12, 28, 3); ctx.fill();
  rrPath( 26, -14, 12, 28, 3); ctx.fill();
  ctx.strokeStyle = 'rgba(70,40,40,0.6)'; ctx.lineWidth = 1;
  [-10, -5, 0, 5, 10].forEach(ty => {
    ctx.beginPath(); ctx.moveTo(-38, ty); ctx.lineTo(-26, ty); ctx.stroke();
    ctx.beginPath(); ctx.moveTo( 26, ty); ctx.lineTo( 38, ty); ctx.stroke();
  });
  ctx.fillStyle = '#3a2828';
  [-10, -5, 0, 5, 10].forEach(ty => {
    ctx.beginPath(); ctx.arc(-32, ty, 3, 0, Math.PI * 2); ctx.fill();
    ctx.beginPath(); ctx.arc( 32, ty, 3, 0, Math.PI * 2); ctx.fill();
  });

  ctx.restore();
}

// ─── DRAW: BOSS ───────────────────────────────────────────────
function drawBoss(e) {
  ctx.save();
  ctx.translate(e.x, e.y);

  const pulse = 0.5 + 0.5 * Math.sin(frameCount * 0.09);
  ctx.shadowColor = '#ff0000';
  ctx.shadowBlur  = 18 + 12 * pulse;

  // Triple barrels
  ctx.fillStyle = '#1e0000';
  [-14, 0, 14].forEach(bx => {
    rrPath(bx - 4, 26, 8, 38, 2); ctx.fill();
    rrPath(bx - 6, 61, 12, 7, 2); ctx.fill();
  });

  // Turret
  ctx.fillStyle = '#380000';
  rrPath(-30, 8, 60, 28, 6); ctx.fill();
  ctx.fillStyle = '#580000';
  rrPath(-27, 9, 54, 12, 4); ctx.fill();

  // Hull
  ctx.fillStyle = '#480000';
  rrPath(-52, -22, 104, 44, 8); ctx.fill();
  ctx.fillStyle = '#680000';
  rrPath(-48, -20,  96, 18, 5); ctx.fill();
  ctx.fillStyle = '#ff1010';
  ctx.fillRect(-44, -3, 88, 5);

  // Side weapons
  ctx.fillStyle = '#280000';
  rrPath(-70, -10, 18, 8, 2); ctx.fill();
  rrPath( 52, -10, 18, 8, 2); ctx.fill();

  // Wide tracks
  ctx.fillStyle = '#181010';
  rrPath(-66, -20, 18, 40, 3); ctx.fill();
  rrPath( 48, -20, 18, 40, 3); ctx.fill();

  // HP pip indicators
  const ratio = e.health / e.maxHealth;
  ['#ff0000','#ff4400','#ff8800'].forEach((c, i) => {
    ctx.shadowBlur = 0;
    ctx.fillStyle = (i / 3) < ratio ? c : '#333';
    ctx.beginPath(); ctx.arc(-20 + i * 20, -30, 5.5, 0, Math.PI * 2); ctx.fill();
  });

  ctx.shadowBlur = 0;
  ctx.restore();
}

// ─── DRAW: HELICOPTER ─────────────────────────────────────────
function drawHelicopter(e) {
  ctx.save();
  ctx.translate(e.x, e.y);
  ctx.translate(0, Math.sin(frameCount * 0.1 + e.phase) * 3);

  // Gun
  ctx.fillStyle = '#0a1822';
  rrPath(-4, 14, 8, 18, 1); ctx.fill();
  ctx.fillStyle = '#0e2030';
  rrPath(-2, 30, 4, 5, 1);  ctx.fill();

  // Skids
  ctx.strokeStyle = '#182838'; ctx.lineWidth = 2;
  ctx.beginPath(); ctx.moveTo(-20, 12); ctx.lineTo(16, 12); ctx.stroke();
  [-14, 10].forEach(sx => {
    ctx.beginPath(); ctx.moveTo(sx, 8); ctx.lineTo(sx, 13); ctx.stroke();
  });

  // Fuselage
  ctx.fillStyle = '#193858';
  ctx.beginPath(); ctx.ellipse(0, 0, 34, 14, 0, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = '#285880';
  ctx.beginPath(); ctx.ellipse(0, -2, 28, 10, 0, 0, Math.PI * 2); ctx.fill();

  // Cockpit glass
  ctx.save();
  ctx.fillStyle = 'rgba(100,190,255,0.22)';
  ctx.strokeStyle = 'rgba(110,210,255,0.65)';
  ctx.lineWidth = 1.5;
  ctx.beginPath(); ctx.ellipse(-12, -3, 13, 9, -0.2, 0, Math.PI * 2);
  ctx.fill(); ctx.stroke();
  ctx.restore();

  // Tail boom
  ctx.fillStyle = '#142840';
  ctx.beginPath();
  ctx.moveTo(26, -3); ctx.lineTo(48, -6); ctx.lineTo(48, 5); ctx.lineTo(26, 6);
  ctx.closePath(); ctx.fill();

  // Tail rotor
  ctx.strokeStyle = '#3a6a8a'; ctx.lineWidth = 1.5;
  const tr = frameCount * 0.36;
  for (let i = 0; i < 3; i++) {
    const a = tr + i * (Math.PI * 2 / 3);
    ctx.beginPath(); ctx.moveTo(48, -1);
    ctx.lineTo(48 + Math.cos(a) * 10, -1 + Math.sin(a) * 10); ctx.stroke();
  }

  // Main rotor
  ctx.save();
  ctx.rotate(frameCount * 0.19);
  ctx.strokeStyle = '#4aaa4a'; ctx.lineWidth = 3; ctx.lineCap = 'round';
  ctx.beginPath(); ctx.moveTo(-44, 0); ctx.lineTo(44, 0); ctx.stroke();
  ctx.beginPath(); ctx.moveTo(0, -44); ctx.lineTo(0, 44); ctx.stroke();
  ctx.restore();

  // Hub
  ctx.fillStyle = '#282828';
  ctx.beginPath(); ctx.arc(0, 0, 5, 0, Math.PI * 2); ctx.fill();

  ctx.restore();
}

// ─── DRAW: BULLETS ────────────────────────────────────────────
function drawPlayerBullet(b) {
  ctx.save();
  ctx.shadowColor = '#00ff88'; ctx.shadowBlur = 14;
  const g = ctx.createLinearGradient(b.x, b.y - b.h / 2, b.x, b.y + b.h / 2);
  g.addColorStop(0, '#88ffaa'); g.addColorStop(0.5, '#00ff66'); g.addColorStop(1, '#00aa33');
  ctx.fillStyle = g;
  rrPath(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, b.w / 2); ctx.fill();
  ctx.fillStyle = 'rgba(220,255,220,0.88)';
  rrPath(b.x - 1.5, b.y - b.h / 2, 3, b.h * 0.55, 1); ctx.fill();
  ctx.restore();
}

function drawEnemyBullet(b) {
  ctx.save();
  ctx.shadowColor = b.isBoss ? '#ff2200' : '#ff7700'; ctx.shadowBlur = 11;
  const g = ctx.createLinearGradient(b.x, b.y - b.h / 2, b.x, b.y + b.h / 2);
  g.addColorStop(0, b.isBoss ? '#ff5544' : '#ff9900');
  g.addColorStop(1, b.isBoss ? '#aa1100' : '#cc4400');
  ctx.fillStyle = g;
  rrPath(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h, b.w / 2); ctx.fill();
  ctx.restore();
}

// ─── DRAW: PARTICLES ──────────────────────────────────────────
function drawParticles() {
  particles.forEach(p => {
    if (!p.alive) return;
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.fillStyle   = p.color;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 5;
    ctx.beginPath(); ctx.arc(p.x, p.y, Math.max(0.1, p.sz), 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ─── FULL RENDER ──────────────────────────────────────────────
function render() {
  ctx.clearRect(0, 0, CANVAS_W, CANVAS_H);
  drawBackground();
  drawStars();
  drawGround();
  drawDefenseLine();

  // Enemy bullets
  enemyBullets.forEach(b => { if (b.alive) drawEnemyBullet(b); });

  // Enemies (+ health bars)
  enemies.forEach(e => {
    if (!e.alive) return;
    if      (e.type === 'tank') drawEnemyTank(e);
    else if (e.type === 'heli') drawHelicopter(e);
    else if (e.type === 'boss') drawBoss(e);
    const barW = e.type === 'boss' ? 80 : 50;
    drawHealthBar(e.x, e.y - e.h / 2 - 10, barW, e.health, e.maxHealth);
  });

  // Player bullets
  playerBullets.forEach(b => { if (b.alive) drawPlayerBullet(b); });

  // Player
  if (player && player.alive) {
    drawPlayerTank(player);
    drawHealthBar(player.x, player.y - 38, 60, player.health, player.maxHealth);
  }

  // Particles
  drawParticles();
}

// ─── UPDATE ───────────────────────────────────────────────────
function updatePlayer() {
  if (!player.alive) return;
  const now = performance.now();

  if (keys['ArrowLeft']  || keys['a']) player.x -= P_SPEED;
  if (keys['ArrowRight'] || keys['d']) player.x += P_SPEED;
  player.x = Math.max(player.w / 2, Math.min(CANVAS_W - player.w / 2, player.x));

  if (keys[' '] && now - player.lastShot >= player.shotCD) {
    player.lastShot = now;
    const gy = player.y - 65;
    if (player.upgrade >= 3) {
      playerBullets.push(makePlayerBullet(player.x - 10, gy, player.upgrade));
      playerBullets.push(makePlayerBullet(player.x,      gy, player.upgrade));
      playerBullets.push(makePlayerBullet(player.x + 10, gy, player.upgrade));
    } else if (player.upgrade >= 2) {
      playerBullets.push(makePlayerBullet(player.x - 6, gy, player.upgrade));
      playerBullets.push(makePlayerBullet(player.x + 6, gy, player.upgrade));
    } else {
      playerBullets.push(makePlayerBullet(player.x, gy, player.upgrade));
    }
  }
}

function updateEnemies() {
  const now = performance.now();
  const cfg = getLevelConfig(level);

  for (const e of enemies) {
    if (!e.alive) continue;
    e.y += e.speed;

    if (e.type === 'heli') {
      e.x += Math.sin(frameCount * 0.042 + e.phase) * 1.6;
      e.x = Math.max(52, Math.min(CANVAS_W - 52, e.x));
    }
    if (e.type === 'boss') {
      e.x += Math.sin(frameCount * 0.026) * 2;
      e.x = Math.max(62, Math.min(CANVAS_W - 62, e.x));
    }

    // Enemy shooting
    if (cfg.enemyShoot && now - e.lastShot >= e.shootCD) {
      e.lastShot = now;
      const spd = cfg.bulletSpd;
      if (e.type === 'boss') {
        [-14, 0, 14].forEach(dx =>
          enemyBullets.push(makeEnemyBullet(e.x + dx, e.y + 64, spd, true)));
      } else if (e.type === 'tank') {
        enemyBullets.push(makeEnemyBullet(e.x + rand(-8, 8), e.y + 52, spd, false));
      } else {
        enemyBullets.push(makeEnemyBullet(e.x + rand(-5, 5), e.y + 34, spd * 0.88, false));
      }
    }

    // Crossed defense line → game over
    if (e.y + e.h / 2 > DEFENSE_Y) {
      doGameOver();
      return;
    }
  }
}

function updateBullets() {
  playerBullets.forEach(b => { if (b.alive) { b.y += b.vy; if (b.y < -30) b.alive = false; } });
  enemyBullets.forEach( b => { if (b.alive) { b.y += b.vy; if (b.y > CANVAS_H + 30) b.alive = false; } });
}

function updateParticles() {
  particles.forEach(p => {
    if (!p.alive) return;
    p.x  += p.vx; p.y  += p.vy; p.vy += p.grav;
    p.sz *= 0.973; p.alpha -= p.decay;
    if (p.alpha <= 0 || p.sz < 0.25) p.alive = false;
  });
}

function checkCollisions() {
  if (!player || !player.alive) return;

  // Player bullets vs enemies
  for (const b of playerBullets) {
    if (!b.alive) continue;
    for (const e of enemies) {
      if (!e.alive) continue;
      if (aabb(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h,
               e.x - e.w / 2, e.y - e.h / 2, e.w, e.h)) {
        b.alive = false;
        e.health -= e.type === 'boss' ? 18 : 25;
        hitSpark(b.x, e.y - e.h / 2);
        if (e.health <= 0) {
          e.alive = false;
          score += e.score;
          explode(e.x, e.y, e.type === 'boss' ? 3.2 : 1.6);
          checkLevelUp();
          domScore.textContent = score;
          if (score > highScore) {
            highScore = score;
            localStorage.setItem('tankDefenseHS', highScore);
            domHigh.textContent = highScore;
          }
        }
        break;
      }
    }
  }

  // Enemy bullets vs player
  for (const b of enemyBullets) {
    if (!b.alive) continue;
    const pw = player.w * 0.75, ph = player.h;
    if (aabb(b.x - b.w / 2, b.y - b.h / 2, b.w, b.h,
             player.x - pw / 2, player.y - ph / 2, pw, ph)) {
      b.alive = false;
      const dmg = b.isBoss ? 18 : 10;
      player.health = Math.max(0, player.health - dmg);
      hitSpark(b.x, player.y);
      if (player.health <= 0) { doGameOver(); return; }
    }
  }
}

function updateSpawn() {
  const cfg = getLevelConfig(level);
  spawnTimer++;
  if (spawnTimer >= cfg.spawnInterval) {
    spawnTimer = 0;
    const alive = enemies.filter(e => e.alive).length;
    if (alive < cfg.maxEnemies) spawnEnemy();
  }
}

function spawnEnemy() {
  const cfg = getLevelConfig(level);
  if (cfg.hasBoss && !bossSpawned) {
    enemies.push(makeBoss(level));
    bossSpawned = true;
    return;
  }
  if (cfg.hasHeli && Math.random() < 0.42) {
    enemies.push(makeHelicopter(level));
  } else {
    enemies.push(makeEnemyTank(level));
  }
}

function checkLevelUp() {
  const newLevel = getLevelFromScore(score);
  if (newLevel > level) {
    level = newLevel;
    bossSpawned = false;
    lvlUpTimer = 160;

    // Player upgrade thresholds
    if      (level >= 7) player.upgrade = 3;
    else if (level >= 5) player.upgrade = 2;
    else if (level >= 3) player.upgrade = 1;
    else                 player.upgrade = 0;

    // Small heal bonus
    player.health = Math.min(player.maxHealth, player.health + 18);

    domLevel.textContent = level;
    domLvlText.textContent = `Level ${level}!`;
    domLvlMsg.classList.remove('hidden');
  }
}

// ─── MAIN LOOP ────────────────────────────────────────────────
function loop(ts) {
  if (!running) return;
  frameCount++;

  updatePlayer();
  updateEnemies();
  if (!gameOverFlag) {
    updateBullets();
    updateParticles();
    checkCollisions();
    updateSpawn();

    // Cleanup dead objects periodically
    if (frameCount % 180 === 0) {
      enemies       = enemies.filter(e => e.alive);
      playerBullets = playerBullets.filter(b => b.alive);
      enemyBullets  = enemyBullets.filter(b => b.alive);
      particles     = particles.filter(p => p.alive);
    }

    // Level-up message timer
    if (lvlUpTimer > 0) {
      lvlUpTimer--;
      if (lvlUpTimer === 0) domLvlMsg.classList.add('hidden');
    }
  }

  render();
  rafId = requestAnimationFrame(loop);
}

// ─── GAME CONTROL ─────────────────────────────────────────────
function startGame() {
  score      = 0;
  level      = 1;
  frameCount = 0;
  spawnTimer = 0;
  lvlUpTimer = 0;
  bossSpawned = false;
  gameOverFlag = false;

  enemies       = [];
  playerBullets = [];
  enemyBullets  = [];
  particles     = [];

  player = makePlayer();

  domScore.textContent     = 0;
  domLevel.textContent     = 1;
  domHigh.textContent      = highScore;
  domStart.classList.add('hidden');
  domGameOver.classList.add('hidden');
  domLvlMsg.classList.add('hidden');

  running = true;
  rafId   = requestAnimationFrame(loop);
}

function doGameOver() {
  if (gameOverFlag) return;
  gameOverFlag = true;
  running      = false;

  if (score > highScore) {
    highScore = score;
    localStorage.setItem('tankDefenseHS', highScore);
  }

  domFinalScore.textContent    = score;
  domFinalHigh.textContent     = highScore;
  domHigh.textContent          = highScore;
  domGameOver.classList.remove('hidden');
  cancelAnimationFrame(rafId);
}

// ─── INIT ─────────────────────────────────────────────────────
function init() {
  canvas = document.getElementById('gameCanvas');
  ctx    = canvas.getContext('2d');

  domScore      = document.getElementById('scoreDisplay');
  domLevel      = document.getElementById('levelDisplay');
  domHigh       = document.getElementById('highScoreDisplay');
  domStart      = document.getElementById('startScreen');
  domGameOver   = document.getElementById('gameOverScreen');
  domLvlMsg     = document.getElementById('levelUpMsg');
  domLvlText    = document.getElementById('levelUpText');
  domFinalScore = document.getElementById('finalScore');
  domFinalHigh  = document.getElementById('finalHighScore');

  domHigh.textContent = highScore;

  // Buttons
  document.getElementById('startBtn').addEventListener('click', startGame);
  document.getElementById('restartBtn').addEventListener('click', startGame);

  // Keyboard
  window.addEventListener('keydown', e => {
    keys[e.key] = true;
    if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' '].includes(e.key)) {
      e.preventDefault();
    }
  });
  window.addEventListener('keyup', e => { keys[e.key] = false; });

  // Generate stars
  for (let i = 0; i < 90; i++) {
    stars.push({
      x:  rand(0, CANVAS_W),
      y:  rand(0, CANVAS_H * 0.7),
      sz: rand(0.8, 2.2),
      br: rand(0.3, 1),
      ph: rand(0, Math.PI * 2),
    });
  }

  // Draw initial frame (show background behind start overlay)
  drawBackground();
  drawStars();
  drawGround();
  drawDefenseLine();
}

document.addEventListener('DOMContentLoaded', init);
