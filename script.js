const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

let DPR = window.devicePixelRatio || 1;
canvas.width = window.innerWidth * DPR;
canvas.height = window.innerHeight * DPR;
ctx.scale(DPR, DPR);

window.addEventListener("resize", () => {
  DPR = window.devicePixelRatio || 1;
  canvas.width = window.innerWidth * DPR;
  canvas.height = window.innerHeight * DPR;
  ctx.scale(DPR, DPR);
});

// Spielfeldgröße
const W = 4000, H = 4000;
const segLen = 10;
const BASE_SPEED = 2.2;
const START_LEN = 30;
let foods = [];
let bots = [];

// Spieler
let head = { x: W / 2, y: H / 2, ang: 0 };
let parts = [];
let snakeLen = START_LEN;
let target = { x: W / 2, y: H / 2 };
let alive = true;

// Setup
for (let i = 0; i < 80; i++) {
  foods.push({ x: Math.random() * W, y: Math.random() * H, size: 6 });
}
for (let i = 0; i < START_LEN; i++) {
  parts.push({ x: head.x - i * segLen, y: head.y });
}

function spawnBots() {
  for (let i = 0; i < 4; i++) {
    bots.push(new Bot(`hsl(${Math.random() * 360},80%,60%)`));
  }
}
class Bot {
  constructor(color) {
    this.head = { x: Math.random() * W, y: Math.random() * H, ang: Math.random() * Math.PI * 2 };
    this.parts = Array.from({ length: START_LEN }, (_, i) => ({
      x: this.head.x - i * segLen,
      y: this.head.y
    }));
    this.target = { x: this.head.x, y: this.head.y };
    this.color = color;
    this.timer = 0;
  }
  update(delta) {
    this.timer -= delta;
    if (this.timer <= 0) {
      this.timer = 60 + Math.random() * 120;
      this.target.x = Math.random() * W;
      this.target.y = Math.random() * H;
    }
    moveSnake(this.head, this.parts, this.target, delta, BASE_SPEED * 0.9, false);
  }
}
spawnBots();

function moveSnake(head, parts, target, delta, speed, playerControlled = true) {
  let dx = target.x - head.x;
  let dy = target.y - head.y;
  const dist = Math.hypot(dx, dy);

  if (playerControlled && dist < 5 * DPR) {
    dx = Math.cos(head.ang);
    dy = Math.sin(head.ang);
  }

  const desired = Math.atan2(dy, dx);
  let diff = desired - head.ang;
  diff = Math.atan2(Math.sin(diff), Math.cos(diff));
  head.ang += diff * 0.15;

  head.x += Math.cos(head.ang) * speed * delta;
  head.y += Math.sin(head.ang) * speed * delta;

  wrapPosition(head);
  for (let i = 0; i < parts.length; i++) {
    const p = parts[i];
    const prev = i === 0 ? head : parts[i - 1];
    const a = Math.atan2(prev.y - p.y, prev.x - p.x);
    p.x = prev.x - Math.cos(a) * segLen;
    p.y = prev.y - Math.sin(a) * segLen;
    wrapPosition(p);
  }
}

function wrapPosition(p) {
  if (p.x < 0) p.x += W;
  if (p.x > W) p.x -= W;
  if (p.y < 0) p.y += H;
  if (p.y > H) p.y -= H;
}

let lastTime = performance.now();
function step(now = 0) {
  const delta = (now - lastTime) / 16;
  lastTime = now;

  if (alive) {
    moveSnake(head, parts, target, delta, BASE_SPEED, true);

    // Essen
    for (let f of foods) {
      if (Math.hypot(f.x - head.x, f.y - head.y) < 15) {
        snakeLen += 2;
        foods.splice(foods.indexOf(f), 1);
        foods.push({ x: Math.random() * W, y: Math.random() * H, size: 6 });
      }
    }
  }

  for (const b of bots) b.update(delta);
  render();
  requestAnimationFrame(step);
}

function drawSnake(head, parts, color) {
  for (let i = parts.length - 1; i >= 0; i--) {
    const p = parts[i];
    const t = i / parts.length;
    const r = segLen * (0.9 - t * 0.5);
    ctx.beginPath();
    ctx.fillStyle = `hsl(${(t * 80)}deg,80%,60%)`;
    ctx.arc(p.x - cam.x, p.y - cam.y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.save();
  ctx.translate(head.x - cam.x, head.y - cam.y);
  ctx.rotate(head.ang);
  ctx.beginPath();
  ctx.fillStyle = color;
  ctx.arc(0, 0, segLen * 0.9, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

let cam = { x: 0, y: 0 };
function render() {
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  cam.x += (head.x - cam.x - canvas.width / (2 * DPR)) * 0.05;
  cam.y += (head.y - cam.y - canvas.height / (2 * DPR)) * 0.05;

  // Raster
  ctx.strokeStyle = "rgba(255,255,255,0.05)";
  for (let x = -W; x < W * 2; x += 80) {
    ctx.beginPath();
    ctx.moveTo(x - cam.x % 80, 0);
    ctx.lineTo(x - cam.x % 80, canvas.height);
    ctx.stroke();
  }
  for (let y = -H; y < H * 2; y += 80) {
    ctx.beginPath();
    ctx.moveTo(0, y - cam.y % 80);
    ctx.lineTo(canvas.width, y - cam.y % 80);
    ctx.stroke();
  }

  // Food
  for (let f of foods) {
    ctx.beginPath();
    ctx.arc(f.x - cam.x, f.y - cam.y, f.size, 0, Math.PI * 2);
    ctx.fillStyle = "orange";
    ctx.fill();
  }

  // Bots
  for (const b of bots) drawSnake(b.head, b.parts, b.color);

  // Player
  drawSnake(head, parts, "#2de42e");
}

requestAnimationFrame(step);

// Steuerung
window.addEventListener("mousemove", e => {
  target.x = head.x + (e.clientX - window.innerWidth / 2) * 2;
  target.y = head.y + (e.clientY - window.innerHeight / 2) * 2;
});

window.addEventListener("touchmove", e => {
  const t = e.touches[0];
  target.x = head.x + (t.clientX - window.innerWidth / 2) * 2;
  target.y = head.y + (t.clientY - window.innerHeight / 2) * 2;
}, { passive: true });

// Restart
document.getElementById("restart").addEventListener("click", () => {
  head = { x: W / 2, y: H / 2, ang: 0 };
  parts = [];
  snakeLen = START_LEN;
  for (let i = 0; i < START_LEN; i++)
    parts.push({ x: head.x - i * segLen, y: head.y });
  alive = true;
});
