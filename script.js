const canvas = document.getElementById('bubble-game');
const ctx = canvas.getContext('2d');

let width, height;
function resize() {
  width = canvas.clientWidth;
  height = canvas.clientHeight;
  canvas.width = width;
  canvas.height = height;
}
window.addEventListener('resize', resize);
resize();

/* Bubble-Konfiguration */
const bubbleRadius = 25;
const bubbleColors = ['#ff4d4d','#4dff4d','#4d4dff','#ffdb4d','#ff4dff'];

let bubbles = [];
let movingBubble = null;
let shootVector = null;

/* Grid-Raster */
const cols = 10; // Spalten im Raster
const rows = 8;  // Reihen oben
const xOffset = bubbleRadius;
const yOffset = bubbleRadius;
const xSpacing = bubbleRadius * 2;
const ySpacing = bubbleRadius * Math.sqrt(3);

function createGrid() {
  bubbles = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if ((row + col) % 2 === 0) { // nur schwarze Felder wie Schachbrett
        const x = xOffset + col * xSpacing;
        const y = yOffset + row * ySpacing;
        const color = bubbleColors[Math.floor(Math.random() * bubbleColors.length)];
        bubbles.push({x, y, color, popped:false});
      }
    }
  }
}

/* Bubble schießen */
function shootBubble(targetX, targetY) {
  if (movingBubble) return; // nur eine auf einmal
  const startX = width/2;
  const startY = height - bubbleRadius - 10;
  const dx = targetX - startX;
  const dy = targetY - startY;
  const dist = Math.sqrt(dx*dx + dy*dy);
  const speed = 10;
  shootVector = {x: dx/dist*speed, y: dy/dist*speed};
  const color = bubbleColors[Math.floor(Math.random() * bubbleColors.length)];
  movingBubble = {x:startX, y:startY, color};
}

/* Kollision & Pop Logik */
function update() {
  if (movingBubble) {
    movingBubble.x += shootVector.x;
    movingBubble.y += shootVector.y;

    // Wand-Kollision
    if (movingBubble.x - bubbleRadius < 0 || movingBubble.x + bubbleRadius > width) {
      shootVector.x *= -1;
    }
    if (movingBubble.y - bubbleRadius < 0) {
      placeBubble(movingBubble);
      movingBubble = null;
    }

    // Prüfen gegen Grid
    for (let b of bubbles) {
      if (b.popped) continue;
      const dx = movingBubble.x - b.x;
      const dy = movingBubble.y - b.y;
      const dist = Math.sqrt(dx*dx + dy*dy);
      if (dist < bubbleRadius*2) {
        placeBubble(movingBubble);
        movingBubble = null;
        break;
      }
    }
  }
}

/* Bubble im Raster platzieren */
function placeBubble(bub) {
  // nächster Rasterpunkt
  let closest = null;
  let minDist = Infinity;
  for (let b of bubbles) {
    if (b.popped) continue;
    const dx = bub.x - b.x;
    const dy = bub.y - b.y;
    const d = Math.sqrt(dx*dx + dy*dy);
    if (d < minDist) {
      minDist = d;
      closest = b;
    }
  }
  if (closest) {
    bubbles.push({x:closest.x, y:closest.y, color:bub.color, popped:false});
    checkPop(closest.x, closest.y, bub.color);
  }
}

/* Prüfen auf ≥3 gleiche Bubbles benachbart */
function checkPop(x, y, color) {
  const neighbors = getConnected(x, y, color);
  if (neighbors.length >= 3) {
    for (let n of neighbors) {
      n.popped = true;
    }
  }
}

/* BFS für verbundene Bubbles */
function getConnected(x, y, color) {
  const visited = new Set();
  const queue = [];
  const result = [];

  function key(b) { return `${b.x},${b.y}`; }
  const start = bubbles.find(b => b.x === x && b.y === y);
  if (!start) return [];
  queue.push(start);
  visited.add(key(start));

  while(queue.length) {
    const b = queue.shift();
    result.push(b);
    for (let n of bubbles) {
      if (n.popped) continue;
      if (visited.has(key(n))) continue;
      const dx = b.x - n.x;
      const dy = b.y - n.y;
      if (Math.sqrt(dx*dx+dy*dy) <= bubbleRadius*2+2 && n.color === color) {
        queue.push(n);
        visited.add(key(n));
      }
    }
  }
  return result;
}

/* Zeichnen */
function draw() {
  ctx.clearRect(0,0,width,height);
  for (let b of bubbles) {
    if (b.popped) continue;
    ctx.beginPath();
    ctx.arc(b.x,b.y,bubbleRadius,0,Math.PI*2);
    ctx.fillStyle = b.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
  if (movingBubble) {
    ctx.beginPath();
    ctx.arc(movingBubble.x, movingBubble.y, bubbleRadius,0,Math.PI*2);
    ctx.fillStyle = movingBubble.color;
    ctx.fill();
    ctx.strokeStyle = '#fff';
    ctx.lineWidth = 2;
    ctx.stroke();
  }
}

/* Hauptloop */
function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
createGrid();
loop();

/* Maus & Touch Handling */
canvas.addEventListener('click', e => {
  const rect = canvas.getBoundingClientRect();
  shootBubble(e.clientX - rect.left, e.clientY - rect.top);
});
canvas.addEventListener('touchstart', e => {
  e.preventDefault();
  const rect = canvas.getBoundingClientRect();
  const touch = e.touches[0];
  shootBubble(touch.clientX - rect.left, touch.clientY - rect.top);
});
