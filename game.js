"use strict";

// ─── Canvas setup ────────────────────────────────────────────────────────────
const canvas = document.getElementById("gameCanvas");
const ctx    = canvas.getContext("2d");

function resizeCanvas() {
  canvas.width  = canvas.offsetWidth;
  canvas.height = canvas.offsetHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

// ─── Constants ───────────────────────────────────────────────────────────────
const GRAVITY      = 0.55;
const GROUND_RATIO = 0.72;
const COLORS = {
  player : "#00e676",
  enemy  : "#ff5252",
  ground : "#2d2d44",
  sky    : "#1a1a2e",
  accent : "#ffd54f",
};

// ─── Game state ──────────────────────────────────────────────────────────────
let state  = "start";
let score  = 0;
let animId = null;

// ─── Fighter class ───────────────────────────────────────────────────────────
class Fighter {
  constructor({ x, y, color, facing, isPlayer }) {
    this.x        = x;
    this.y        = y;
    this.color    = color;
    this.facing   = facing;   // 1 = right, -1 = left
    this.isPlayer = isPlayer;

    this.width  = 36;
    this.height = 56;
    this.vx     = 0;
    this.vy     = 0;
    this.hp     = 100;
    this.maxHp  = 100;

    this.onGround     = false;
    this.attackTimer  = 0;
    this.hurtTimer    = 0;
    this.specialTimer = 0;
    this.aiTimer      = 0;
  }

  get groundY() {
    return canvas.height * GROUND_RATIO - this.height;
  }

  get cx() { return this.x + this.width  / 2; }
  get cy() { return this.y + this.height / 2; }

  jump() {
    if (this.onGround) {
      this.vy = -13;
      this.onGround = false;
    }
  }

  attack(targets) {
    if (this.attackTimer > 0) return;
    this.attackTimer = 25;
    targets.forEach(t => {
      if (this.isHitting(t, 70)) {
        t.takeDamage(10);
      }
    });
  }

  special(targets) {
    if (this.specialTimer > 0) return;
    this.specialTimer = 60;
    this.attackTimer  = 30;
    targets.forEach(t => {
      if (this.isHitting(t, 110)) {
        t.takeDamage(25);
      }
    });
  }

  isHitting(target, range) {
    const dx = (target.cx - this.cx) * this.facing;
    const dy = Math.abs(target.cy - this.cy);
    return dx > 0 && dx < range && dy < this.height * 0.8;
  }

  takeDamage(amount) {
    this.hp = Math.max(0, this.hp - amount);
    this.hurtTimer = 15;
  }

  update(keys, enemies) {
    if (this.attackTimer  > 0) this.attackTimer--;
    if (this.hurtTimer    > 0) this.hurtTimer--;
    if (this.specialTimer > 0) this.specialTimer--;

    if (this.isPlayer) {
      this.vx = 0;
      if (keys["ArrowLeft"]  || keys["a"]) {
        this.vx = -4;
        this.facing = -1;
      } else if (keys["ArrowRight"] || keys["d"]) {
        this.vx =  4;
        this.facing =  1;
      }
      if ((keys["ArrowUp"] || keys["w"] || keys[" "]) && this.onGround) this.jump();
      if (keys["z"] || keys["j"]) this.attack(enemies);
      if (keys["x"] || keys["k"]) this.special(enemies);
    } else {
      this._ai(enemies);
    }

    this.vy += GRAVITY;
    this.x  += this.vx;
    this.y  += this.vy;

    const ground = this.groundY;
    if (this.y >= ground) {
      this.y        = ground;
      this.vy       = 0;
      this.onGround = true;
    } else {
      this.onGround = false;
    }

    const maxX = canvas.width - this.width;
    if (this.x < 0)    this.x = 0;
    if (this.x > maxX) this.x = maxX;
  }

  _ai(targets) {
    this.aiTimer++;
    const target = targets[0];
    if (!target) return;

    const dx   = target.cx - this.cx;
    this.facing = dx > 0 ? 1 : -1;
    const dist  = Math.abs(dx);

    if (dist > 120) {
      this.vx = this.facing * 2.2;
    } else if (dist < 50) {
      this.vx = -this.facing * 1.5;
    } else {
      this.vx = this.facing * 1.0;
    }

    if (this.aiTimer % 40 === 0 && dist < 90)  this.attack(targets);
    if (this.aiTimer % 90 === 0 && dist < 130) this.special(targets);
    if (this.aiTimer % 55 === 0 && Math.random() < 0.4) this.jump();
  }

  draw() {
    const hurt = this.hurtTimer > 0;
    ctx.save();
    ctx.translate(this.x + this.width / 2, this.y + this.height / 2);
    ctx.scale(this.facing, 1);

    const col = hurt ? "#ffffff" : this.color;

    ctx.fillStyle = col;
    ctx.fillRect(-this.width / 2, -this.height / 2, this.width, this.height);

    ctx.fillStyle = hurt ? "#fff" : (this.isPlayer ? "#80cbc4" : "#ef9a9a");
    ctx.beginPath();
    ctx.arc(0, -this.height / 2 - 10, 10, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#111";
    ctx.fillRect(3, -this.height / 2 - 14, 3, 3);

    ctx.fillStyle = this.isPlayer ? COLORS.accent : "#ff7043";
    ctx.fillRect(-10, -this.height / 2 - 13, 20, 4);

    if (this.attackTimer > 15) {
      ctx.fillStyle = "rgba(255,255,255,0.35)";
      ctx.fillRect(this.width / 2, -8, 24, 16);
    }

    if (this.specialTimer > 30) {
      ctx.strokeStyle = this.isPlayer ? COLORS.accent : "#ff5722";
      ctx.lineWidth   = 3;
      ctx.beginPath();
      ctx.arc(0, 0, this.width * 0.9, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

// ─── Input ───────────────────────────────────────────────────────────────────
const keys = {};
window.addEventListener("keydown", e => { keys[e.key] = true;  });
window.addEventListener("keyup",   e => { keys[e.key] = false; });

function bindBtn(id, key) {
  const el = document.getElementById(id);
  if (!el) return;
  const press   = () => { keys[key] = true;  };
  const release = () => { keys[key] = false; };
  el.addEventListener("touchstart",  press,   { passive: true });
  el.addEventListener("touchend",    release, { passive: true });
  el.addEventListener("touchcancel", release, { passive: true });
  el.addEventListener("mousedown",   press);
  el.addEventListener("mouseup",     release);
  el.addEventListener("mouseleave",  release);
}

bindBtn("btn-left",    "ArrowLeft");
bindBtn("btn-right",   "ArrowRight");
bindBtn("btn-jump",    "ArrowUp");
bindBtn("btn-attack",  "z");
bindBtn("btn-special", "x");

// ─── Fighters ────────────────────────────────────────────────────────────────
let player, enemy;

function createFighters() {
  const groundY = canvas.height * GROUND_RATIO;
  player = new Fighter({ x: canvas.width * 0.15, y: groundY - 56, color: COLORS.player, facing:  1, isPlayer: true  });
  enemy  = new Fighter({ x: canvas.width * 0.65, y: groundY - 56, color: COLORS.enemy,  facing: -1, isPlayer: false });
}

// ─── HUD ─────────────────────────────────────────────────────────────────────
function updateHUD() {
  const playerBar = document.getElementById("player-hp");
  const enemyBar  = document.getElementById("enemy-hp");
  if (playerBar) playerBar.style.width = player.hp + "%";
  if (enemyBar)  enemyBar.style.width  = enemy.hp  + "%";
}

// ─── Background ──────────────────────────────────────────────────────────────
function drawBackground() {
  const w      = canvas.width;
  const h      = canvas.height;
  const groundY = h * GROUND_RATIO;

  const sky = ctx.createLinearGradient(0, 0, 0, groundY);
  sky.addColorStop(0, "#0d0d2b");
  sky.addColorStop(1, "#1a1a4e");
  ctx.fillStyle = sky;
  ctx.fillRect(0, 0, w, groundY);

  ctx.fillStyle = "rgba(255,248,200,0.9)";
  ctx.beginPath();
  ctx.arc(w * 0.85, h * 0.12, 24, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = "rgba(255,255,255,0.7)";
  [[0.1, 0.08], [0.25, 0.05], [0.4, 0.12], [0.55, 0.04],
   [0.7, 0.09], [0.15, 0.18], [0.62, 0.15], [0.9, 0.22]].forEach(([rx, ry]) => {
    ctx.beginPath();
    ctx.arc(rx * w, ry * h, 1.5, 0, Math.PI * 2);
    ctx.fill();
  });

  ctx.fillStyle = "#16213e";
  ctx.beginPath();
  ctx.moveTo(0,        groundY);
  ctx.lineTo(w * 0.10, groundY * 0.55);
  ctx.lineTo(w * 0.25, groundY * 0.75);
  ctx.lineTo(w * 0.40, groundY * 0.45);
  ctx.lineTo(w * 0.55, groundY * 0.65);
  ctx.lineTo(w * 0.70, groundY * 0.40);
  ctx.lineTo(w * 0.85, groundY * 0.60);
  ctx.lineTo(w,        groundY * 0.50);
  ctx.lineTo(w,        groundY);
  ctx.closePath();
  ctx.fill();

  const grd = ctx.createLinearGradient(0, groundY, 0, h);
  grd.addColorStop(0, "#2d2d44");
  grd.addColorStop(1, "#1a1a2e");
  ctx.fillStyle = grd;
  ctx.fillRect(0, groundY, w, h - groundY);

  ctx.strokeStyle = "#ffd54f44";
  ctx.lineWidth   = 2;
  ctx.beginPath();
  ctx.moveTo(0, groundY);
  ctx.lineTo(w, groundY);
  ctx.stroke();
}

// ─── Overlay ─────────────────────────────────────────────────────────────────
const overlay      = document.getElementById("overlay");
const overlayBtn   = document.getElementById("overlay-btn");
const overlayTitle = document.getElementById("overlay-title");
const overlayMsg   = document.getElementById("overlay-msg");

function showOverlay(title, msg, btnText) {
  overlayTitle.textContent = title;
  overlayMsg.textContent   = msg;
  overlayBtn.textContent   = btnText;
  overlay.classList.remove("hidden");
}

function hideOverlay() {
  overlay.classList.add("hidden");
}

overlayBtn.addEventListener("click", () => {
  if (state === "start" || state === "win" || state === "lose") {
    startGame();
  }
});

// ─── Game loop ───────────────────────────────────────────────────────────────
function startGame() {
  hideOverlay();
  createFighters();
  score = 0;
  state = "playing";
  if (animId !== null) cancelAnimationFrame(animId);
  loop();
}

function loop() {
  if (state !== "playing") return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  drawBackground();

  player.update(keys, [enemy]);
  enemy.update({}, [player]);

  player.draw();
  enemy.draw();

  updateHUD();

  if (enemy.hp <= 0) {
    score++;
    state = "win";
    showOverlay("VICTOIRE ! 🏆", `Tu as gagné ! Score : ${score}`, "Rejouer");
    return;
  }
  if (player.hp <= 0) {
    state = "lose";
    showOverlay("DÉFAITE 💀", "Tu as été vaincu…", "Réessayer");
    return;
  }

  animId = requestAnimationFrame(loop);
}

// ─── Init ────────────────────────────────────────────────────────────────────
showOverlay("⚔️ SHINOBI FIGHTER ⚔️", "Affronte ton ennemi ninja !", "Commencer");
