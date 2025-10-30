// game.js - Slither-like singleplayer
(() => {
  const canvas = document.getElementById('game-canvas');
  const ctx = canvas.getContext('2d', { alpha: false });
  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const restartBtn = document.getElementById('restart');
  const backBtn = document.getElementById('back');

  // --- settings (quick tweakables) ---
  const BASE_SPEED = 2.0;         // base forward speed
  const BOOST_MULT = 2.2;         // boost multiplier
  const SEGMENT_GAP = 6;          // pixels between segment centers
  const START_SEGMENTS = 40;      // initial segments
  const FOOD_COUNT = 30;          // simultaneous foods
  const FOOD_RADIUS = 4;         // base radius for small food
  const FOOD_VALUE = 6;          // how many segments to grow per food
  const LOSS_RATE_BOOST = 0.08;   // length loss per frame when boosting
  const TURN_RATE = 0.12;         // how fast head turns towards target (radians per frame)
  const MIN_CANVAS = 300;

  let width = 800, height = 450;
  let devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);

  function resizeCanvas() {
    const rect = canvas.getBoundingClientRect();
    devicePixelRatio = Math.max(1, window.devicePixelRatio || 1);
    width = Math.max(MIN_CANVAS, Math.floor(rect.width * devicePixelRatio));
    height = Math.max(200, Math.floor(rect.height * devicePixelRatio));
    canvas.width = width;
    canvas.height = height;
    ctx.setTransform(1,0,0,1,0,0);
    ctx.imageSmoothingEnabled = true;
  }
  new ResizeObserver(resizeCanvas).observe(canvas);
  resizeCanvas();

  // --- game state ---
  let parts = []; // array of points {x,y}
  let segmentLength = SEGMENT_GAP * devicePixelRatio;
  let head = { x: width/2, y: height/2, angle: 0, speed: BASE_SPEED * devicePixelRatio };
  let target = { x: head.x, y: head.y };
  let targetAngle = 0;
  let boosting = false;
  let pendingGrow = 0; // segments to add
  let foods = [];
  let alive = true;
  let frameCount = 0;
  let score = 0;

  const BEST_KEY = 'slither_single_best_v1';
  let best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  bestEl.textContent = `Best: ${best}`;

  // initialize snake segments (line behind head)
  function initSnake() {
    parts = [];
    const n = START_SEGMENTS;
    for (let i = 0; i < n; i++) {
      parts.push({ x: head.x - i * segmentLength, y: head.y });
    }
    pendingGrow = 0;
    score = n;
    updateHUD();
  }

  // spawn foods
  function spawnFoods(n) {
    for (let i = 0; i < n; i++) {
      foods.push(randomFood());
    }
  }
  function randomFood() {
    // avoid spawning too close to edges or head
    const margin = 20 * devicePixelRatio;
    return {
      x: margin + Math.random() * (width - 2*margin),
      y: margin + Math.random() * (height - 2*margin),
      r: FOOD_RADIUS * devicePixelRatio * (0.8 + Math.random() * 1.6)
    };
  }

  // input handlers
  let mouseDown = false;
  canvas.addEventListener('mousemove', e => {
    const r = canvas.getBoundingClientRect();
    const mx = (e.clientX - r.left) * devicePixelRatio;
    const my = (e.clientY - r.top) * devicePixelRatio;
    target.x = mx; target.y = my;
  });
  canvas.addEventListener('mousedown', e => { mouseDown = true; boosting = true; });
  canvas.addEventListener('mouseup', e => { mouseDown = false; boosting = false; });
  canvas.addEventListener('mouseleave', e => { /* optional */ });

  // touch
  canvas.addEventListener('touchstart', e => {
    e.preventDefault();
    boosting = true;
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    target.x = (t.clientX - r.left) * devicePixelRatio;
    target.y = (t.clientY - r.top) * devicePixelRatio;
  }, { passive: false });
  canvas.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0];
    const r = canvas.getBoundingClientRect();
    target.x = (t.clientX - r.left) * devicePixelRatio;
    target.y = (t.clientY - r.top) * devicePixelRatio;
  }, { passive: false });
  canvas.addEventListener('touchend', e => {
    boosting = false;
  });

  // keyboard (optional)
  const keyDir = { up: false, down:false, left:false, right:false };
  window.addEventListener('keydown', e => {
    if (e.key === 'w' || e.key === 'ArrowUp') keyDir.up = true;
    if (e.key === 's' || e.key === 'ArrowDown') keyDir.down = true;
    if (e.key === 'a' || e.key === 'ArrowLeft') keyDir.left = true;
    if (e.key === 'd' || e.key === 'ArrowRight') keyDir.right = true;
    if (e.key === ' ') boosting = true;
  });
  window.addEventListener('keyup', e => {
    if (e.key === 'w' || e.key === 'ArrowUp') keyDir.up = false;
    if (e.key === 's' || e.key === 'ArrowDown') keyDir.down = false;
    if (e.key === 'a' || e.key === 'ArrowLeft') keyDir.left = false;
    if (e.key === 'd' || e.key === 'ArrowRight') keyDir.right = false;
    if (e.key === ' ' ) boosting = false;
  });

  // manage target for keyboard
  function keyboardTargetAdjust() {
    const speed = 8 * devicePixelRatio;
    if (keyDir.up) target.y -= speed;
    if (keyDir.down) target.y += speed;
    if (keyDir.left) target.x -= speed;
    if (keyDir.right) target.x += speed;
  }

  // update HUD
  function updateHUD() {
    scoreEl.textContent = `Score: ${Math.max(0, Math.floor(score))}`;
    bestEl.textContent = `Best: ${best}`;
  }

  // collision helpers
  function dist2(a,b) { const dx=a.x-b.x, dy=a.y-b.y; return dx*dx+dy*dy; }
  function dist(a,b) { return Math.sqrt(dist2(a,b)); }

  // game loop variables
  let lastTime = 0;
  function frame(t) {
    if (!lastTime) lastTime = t;
    const dt = Math.min(40, t - lastTime);
    lastTime = t;
    if (alive) {
      update(dt/16.67); // normalized ~60fps
    }
    render();
    frameCount++;
    requestAnimationFrame(frame);
  }

  // update game state
  function update(delta) {
    keyboardTargetAdjust();

    // angle to target
    const dx = target.x - head.x;
    const dy = target.y - head.y;
    const desired = Math.atan2(dy, dx);
    // normalize angle diff
    let diff = desired - head.angle;
    while (diff > Math.PI) diff -= Math.PI*2;
    while (diff < -Math.PI) diff += Math.PI*2;
    // clamp turning
    head.angle += Math.max(-TURN_RATE, Math.min(TURN_RATE, diff));

    // speed
    const baseSpeed = BASE_SPEED * devicePixelRatio;
    const speed = boosting ? baseSpeed * BOOST_MULT : baseSpeed;
    head.speed = speed;

    // move head forward
    head.x += Math.cos(head.angle) * head.speed * delta;
    head.y += Math.sin(head.angle) * head.speed * delta;

    // wrap-around screen edges (like slither)
    if (head.x < 0) head.x += width;
    if (head.x > width) head.x -= width;
    if (head.y < 0) head.y += height;
    if (head.y > height) head.y -= height;

    // move segments: each segment follows previous maintaining SEGMENT_GAP
    let prev = { x: head.x, y: head.y };
    for (let i = 0; i < parts.length; i++) {
      const p = parts[i];
      const dx = prev.x - p.x;
      const dy = prev.y - p.y;
      const d = Math.sqrt(dx*dx + dy*dy) || 0.0001;
      const need = (segmentLength);
      if (d > 0.0001) {
        const ratio = (d - need) / d;
        p.x = prev.x - dx * (need / d);
        p.y = prev.y - dy * (need / d);
      }
      prev = p;
    }

    // grow if pending
    if (pendingGrow > 0) {
      // push duplicates of last part to grow smoothly
      for (let k = 0; k < Math.min(4, pendingGrow); k++) {
        const last = parts[parts.length - 1];
        parts.push({ x: last.x, y: last.y });
        pendingGrow--;
        score++;
      }
    }

    // boost cost: lose segments slowly
    if (boosting && parts.length > 6) {
      if (frameCount % 2 === 0) { // rate control
        const loss = LOSS_RATE_BOOST * devicePixelRatio * delta;
        // remove approximate number of segments proportional to loss
        if (loss > 0.5) {
          const drop = Math.floor(loss);
          parts.splice(-drop, drop);
          score = Math.max(0, score - drop);
        } else if (Math.random() < loss) {
          parts.pop(); score = Math.max(0, score - 1);
        }
      }
    }

    // foods: collision with head (use head radius dependent on size)
    const headRadius = Math.max(6, segmentLength * 0.9);
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      const d2 = (head.x - f.x)*(head.x-f.x) + (head.y - f.y)*(head.y-f.y);
      if (d2 < (headRadius + f.r) * (headRadius + f.r)) {
        // eat
        foods.splice(i,1);
        pendingGrow += FOOD_VALUE;
        score += FOOD_VALUE;
        // spawn replacement food
        foods.push(randomFood());
      }
    }

    // occasionally add food if too few
    if (foods.length < FOOD_COUNT) foods.push(randomFood());

    // self-collision: check head vs body segments skipping first N segments
    // better: check head vs parts from index 10..end
    for (let i = 10; i < parts.length; i += 1) {
      const p = parts[i];
      const dxh = head.x - p.x;
      const dyh = head.y - p.y;
      const d2 = dxh*dxh + dyh*dyh;
      const hitRadius = Math.max(6, segmentLength*0.8);
      if (d2 < (hitRadius * hitRadius)) {
        alive = false;
        onGameOver();
        break;
      }
    }

    updateHUD();
  }

  // render everything
  function render() {
    // clear (use solid background for perf)
    ctx.fillStyle = '#081218';
    ctx.fillRect(0,0,width,height);

    // draw foods
    for (let i = 0; i < foods.length; i++) {
      const f = foods[i];
      ctx.beginPath();
      ctx.fillStyle = '#ffeb3b';
      ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
      ctx.fill();
      // subtle glow
      ctx.globalAlpha = 0.15;
      ctx.beginPath();
      ctx.fillStyle = '#ffd54d';
      ctx.arc(f.x, f.y, f.r * 2.6, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // draw snake body (from tail to head for nicer layering)
    const grad = ctx.createLinearGradient(0,0,width,0);
    grad.addColorStop(0, '#2de42e');
    grad.addColorStop(1, '#ff66cc');

    // body segments
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      const t = i / parts.length;
      const radius = Math.max(2, segmentLength * (0.9 - t*0.6));
      ctx.beginPath();
      ctx.fillStyle = `rgba(${Math.floor(255*(1-t))}, ${Math.floor(255*t)}, 120, 1)`;
      // using gradient-like color per segment gives depth; simpler solid is ok
      ctx.arc(p.x, p.y, radius, 0, Math.PI*2);
      ctx.fill();
    }

    // head
    const headRadius = Math.max(6, segmentLength * 0.9);
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(head.angle);
    // head body
    ctx.beginPath();
    ctx.fillStyle = '#ffffff';
    ctx.arc(0, 0, headRadius, 0, Math.PI*2);
    ctx.fill();

    // eyes (simple)
    const eyeOffset = headRadius * 0.45;
    ctx.fillStyle = '#222';
    ctx.beginPath(); ctx.arc(eyeOffset, -headRadius*0.35, Math.max(1.5, headRadius*0.25), 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(eyeOffset, headRadius*0.35, Math.max(1.5, headRadius*0.25), 0, Math.PI*2); ctx.fill();

    ctx.restore();

    // if dead, overlay
    if (!alive) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0,0,width,height);
      ctx.fillStyle = '#fff';
      ctx.font = `${Math.floor(36 * devicePixelRatio)}px sans-serif`;
      ctx.textAlign = 'center';
      ctx.fillText('Game Over', width/2, height/2 - 10 * devicePixelRatio);
      ctx.font = `${Math.floor(18 * devicePixelRatio)}px sans-serif`;
      ctx.fillText(`Score: ${Math.floor(score)}`, width/2, height/2 + 26 * devicePixelRatio);
    }
  }

  function onGameOver() {
    // update best
    if (Math.floor(score) > best) {
      best = Math.floor(score);
      localStorage.setItem(BEST_KEY, ''+best);
    }
    updateHUD();
  }

  // restart
  restartBtn.addEventListener('click', () => {
    alive = true;
    head.x = width/2; head.y = height/2;
    target.x = head.x; target.y = head.y;
    initSnake();
    foods = [];
    spawnFoods(FOOD_COUNT);
  });

  backBtn.addEventListener('click', () => {
    // go back to previous page
    window.history.back();
  });

  // init
  function start() {
    head.x = width/2; head.y = height/2;
    target.x = head.x; target.y = head.y;
    initSnake();
    spawnFoods(FOOD_COUNT);
    requestAnimationFrame(frame);
  }
  start();

  // expose small debug on global for quick tweaking in console
  window.__slitherDebug = {
    parts, foods, head, setBoost: b => boosting = b
  };
})();
