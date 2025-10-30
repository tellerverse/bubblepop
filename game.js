// game.js — canvas ist genau in der Card, DPI-aware, touch + mouse + keys
(() => {
  const canvas = document.getElementById('game-canvas');
  const wrap = document.getElementById('canvas-wrap');
  const ctx = canvas.getContext('2d', { alpha: false });

  const scoreEl = document.getElementById('score');
  const bestEl = document.getElementById('best');
  const restartBtn = document.getElementById('restart');
  const backBtn = document.getElementById('back');

  // settings
  const BASE_SPEED = 2.2;
  const BOOST_MULT = 2.2;
  const SEG_GAP = 6;
  const START_LEN = 36;
  const FOOD_COUNT = 28;
  const FOOD_RAD = 4;
  const FOOD_VALUE = 6;
  const BOOST_COST = 0.09;
  const TURN_SPEED = 0.14;

  let DPR = Math.max(1, window.devicePixelRatio || 1);
  let W = 800 * DPR, H = 450 * DPR;

  function resizeCanvasToWrap() {
    const rect = wrap.getBoundingClientRect();
    DPR = Math.max(1, window.devicePixelRatio || 1);
    W = Math.max(320, Math.floor(rect.width * DPR));
    H = Math.max(160, Math.floor(rect.height * DPR));
    canvas.width = W;
    canvas.height = H;
    canvas.style.width = rect.width + 'px';
    canvas.style.height = rect.height + 'px';
    ctx.setTransform(1,0,0,1,0,0);
    ctx.imageSmoothingEnabled = true;
  }

  // observe wrapper size changes (card resizing, responsive)
  new ResizeObserver(resizeCanvasToWrap).observe(wrap);
  // also on load
  resizeCanvasToWrap();

  // game state
  let head = { x: W/2, y: H/2, ang: 0 };
  let target = { x: head.x, y: head.y };
  let parts = [];
  let segLen = SEG_GAP * DPR;
  let boosting = false;
  let pendingGrow = 0;
  let foods = [];
  let alive = true;
  let score = 0;
  const BEST_KEY = 'mg_slither_best_v1';
  let best = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);

  function initSnake() {
    parts = [];
    for (let i=0;i<START_LEN;i++){
      parts.push({ x: head.x - i*segLen, y: head.y });
    }
    pendingGrow = 0;
    score = parts.length;
    alive = true;
    updateHUD();
  }

  function spawnFood(n = FOOD_COUNT) {
    while (foods.length < n) foods.push(randFood());
  }
  function randFood(){
    const margin = 24 * DPR;
    return {
      x: margin + Math.random() * (W - margin*2),
      y: margin + Math.random() * (H - margin*2),
      r: FOOD_RAD * DPR * (0.8 + Math.random()*1.6)
    };
  }

  // input handling (mouse/touch/keyboard)
  const keys = { left:false, right:false, up:false, down:false };
  window.addEventListener('keydown', e=>{
    if (['a','ArrowLeft'].includes(e.key)) keys.left=true;
    if (['d','ArrowRight'].includes(e.key)) keys.right=true;
    if (['w','ArrowUp'].includes(e.key)) keys.up=true;
    if (['s','ArrowDown'].includes(e.key)) keys.down=true;
    if (e.key === ' ') boosting = true;
  });
  window.addEventListener('keyup', e=>{
    if (['a','ArrowLeft'].includes(e.key)) keys.left=false;
    if (['d','ArrowRight'].includes(e.key)) keys.right=false;
    if (['w','ArrowUp'].includes(e.key)) keys.up=false;
    if (['s','ArrowDown'].includes(e.key)) keys.down=false;
    if (e.key === ' ') boosting = false;
  });

  // pointer inside wrapper coordinates
  function setTargetFromEvent(clientX, clientY) {
    const r = wrap.getBoundingClientRect();
    const x = (clientX - r.left) * DPR;
    const y = (clientY - r.top) * DPR;
    target.x = Math.max(0, Math.min(W, x));
    target.y = Math.max(0, Math.min(H, y));
  }

  wrap.addEventListener('mousemove', e => {
    setTargetFromEvent(e.clientX, e.clientY);
  });
  wrap.addEventListener('mousedown', e => { boosting = true; setTargetFromEvent(e.clientX, e.clientY); });
  window.addEventListener('mouseup', () => boosting = false);

  wrap.addEventListener('touchstart', e => {
    e.preventDefault();
    boosting = true;
    const t = e.touches[0];
    setTargetFromEvent(t.clientX, t.clientY);
  }, { passive: false });
  wrap.addEventListener('touchmove', e => {
    e.preventDefault();
    const t = e.touches[0];
    setTargetFromEvent(t.clientX, t.clientY);
  }, { passive: false });
  wrap.addEventListener('touchend', e => { boosting = false; }, { passive: false });

  // HUD updater
  function updateHUD() {
    scoreEl.textContent = `Score: ${Math.max(0, Math.floor(score))}`;
    bestEl.textContent = `Best: ${best}`;
  }

  // game loop
  let last = 0;
  function step(ts) {
    if (!last) last = ts;
    const dt = Math.min(40, ts - last);
    last = ts;
    const delta = dt / 16.67;

    keyboardTarget(delta);

    if (alive) updateGame(delta);
    render();
    requestAnimationFrame(step);
  }

  function keyboardTarget(delta) {
    const v = 8 * DPR;
    if (keys.left) target.x -= v * delta;
    if (keys.right) target.x += v * delta;
    if (keys.up) target.y -= v * delta;
    if (keys.down) target.y += v * delta;
  }

  function updateGame(delta) {
    // rotate head toward target
    let dx = target.x - head.x;
    let dy = target.y - head.y;
    const desired = Math.atan2(dy, dx);
    let diff = desired - head.ang;
    while (diff > Math.PI) diff -= Math.PI*2;
    while (diff < -Math.PI) diff += Math.PI*2;
    head.ang += Math.max(-TURN_SPEED, Math.min(TURN_SPEED, diff));

    // move head
    const base = BASE_SPEED * DPR;
    const speed = boosting ? base * BOOST_MULT : base;
    head.x += Math.cos(head.ang) * speed * delta;
    head.y += Math.sin(head.ang) * speed * delta;

    // wrap
    if (head.x < 0) head.x += W;
    if (head.x > W) head.x -= W;
    if (head.y < 0) head.y += H;
    if (head.y > H) head.y -= H;

    // move parts
    let prev = { x: head.x, y: head.y };
    for (let i=0;i<parts.length;i++){
      const p = parts[i];
      const vx = prev.x - p.x;
      const vy = prev.y - p.y;
      const d = Math.hypot(vx, vy) || 0.0001;
      const nx = prev.x - (vx / d) * segLen;
      const ny = prev.y - (vy / d) * segLen;
      p.x = nx; p.y = ny;
      prev = p;
    }

    // grow
    if (pendingGrow > 0) {
      const add = Math.min(3, pendingGrow);
      for (let i=0;i<add;i++){
        const last = parts[parts.length-1];
        parts.push({ x: last.x, y: last.y });
        pendingGrow--;
        score++;
      }
    }

    // boost cost
    if (boosting && parts.length > 8) {
      const loss = BOOST_COST * delta;
      if (Math.random() < loss) { parts.pop(); score = Math.max(0, score - 1); }
    }

    // foods collision
    const headR = Math.max(6*DPR, segLen*0.9);
    for (let i = foods.length - 1; i >= 0; i--) {
      const f = foods[i];
      const d2 = (head.x - f.x)*(head.x - f.x) + (head.y - f.y)*(head.y - f.y);
      if (d2 < (headR + f.r)*(headR + f.r)) {
        foods.splice(i,1);
        pendingGrow += FOOD_VALUE;
        score += FOOD_VALUE;
      }
    }
    if (foods.length < FOOD_COUNT) spawnFood(FOOD_COUNT);

    // self collision (skip first few segments)
    const hitR2 = (Math.max(6*DPR, segLen*0.8))**2;
    for (let i=10;i<parts.length;i++){
      const p = parts[i];
      const d2 = (head.x-p.x)*(head.x-p.x) + (head.y-p.y)*(head.y-p.y);
      if (d2 < hitR2) { alive = false; onGameOver(); break; }
    }

    updateHUD();
  }

  function spawnFood(n){
    while (foods.length < n) foods.push(randFood());
  }
  function randFood(){
    const margin = 28 * DPR;
    return {
      x: margin + Math.random() * (W - margin*2),
      y: margin + Math.random() * (H - margin*2),
      r: FOOD_RAD * DPR * (0.8 + Math.random()*1.6)
    };
  }

  function onGameOver(){
    const s = Math.floor(score);
    if (s > best) { best = s; localStorage.setItem(BEST_KEY, ''+best); }
    updateHUD();
  }

  // render
  function render() {
    // clear
    ctx.fillStyle = '#081218';
    ctx.fillRect(0,0,W,H);

    // foods
    for (const f of foods){
      ctx.beginPath();
      ctx.fillStyle = '#ffd84a';
      ctx.arc(f.x, f.y, f.r, 0, Math.PI*2);
      ctx.fill();
      ctx.globalAlpha = 0.12;
      ctx.beginPath();
      ctx.arc(f.x, f.y, f.r*2.6, 0, Math.PI*2);
      ctx.fillStyle = '#ffd84a';
      ctx.fill();
      ctx.globalAlpha = 1;
    }

    // body
    for (let i = parts.length-1; i >= 0; i--){
      const p = parts[i];
      const t = i / parts.length;
      const r = Math.max(2*DPR, segLen * (0.9 - t*0.55));
      ctx.beginPath();
      ctx.fillStyle = `rgba(${Math.floor(200*(1-t))}, ${Math.floor(80+170*t)}, ${Math.floor(120+80*t)}, 1)`;
      ctx.arc(p.x, p.y, r, 0, Math.PI*2);
      ctx.fill();
    }

    // head
    const headR = Math.max(6*DPR, segLen * 0.9);
    ctx.save();
    ctx.translate(head.x, head.y);
    ctx.rotate(head.ang);
    ctx.beginPath();
    ctx.fillStyle = '#fff';
    ctx.arc(0,0, headR, 0, Math.PI*2);
    ctx.fill();
    ctx.fillStyle = '#111';
    const eyeX = headR * 0.5;
    ctx.beginPath(); ctx.arc(eyeX, -headR*0.34, Math.max(1.6*DPR, headR*0.28), 0, Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(eyeX, headR*0.34, Math.max(1.6*DPR, headR*0.28), 0, Math.PI*2); ctx.fill();
    ctx.restore();

    // dead overlay
    if (!alive) {
      ctx.fillStyle = 'rgba(0,0,0,0.45)';
      ctx.fillRect(0,0,W,H);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.font = `${Math.floor(28*DPR)}px sans-serif`;
      ctx.fillText('Game Over', W/2, H/2 - 10*DPR);
      ctx.font = `${Math.floor(16*DPR)}px sans-serif`;
      ctx.fillText(`Score: ${Math.floor(score)}`, W/2, H/2 + 18*DPR);
    }
  }

  // controls
  restartBtn.addEventListener('click', ()=> {
    alive = true;
    head.x = W/2; head.y = H/2; head.ang = 0;
    target.x = head.x; target.y = head.y;
    initSnake(); foods = []; spawnFood(FOOD_COUNT);
  });
  backBtn.addEventListener('click', ()=> window.history.back());

  // start
  function start() {
    head.x = W/2; head.y = H/2;
    target.x = head.x; target.y = head.y;
    initSnake();
    spawnFood(FOOD_COUNT);
    last = 0;
    requestAnimationFrame(step);
  }
  start();

  // quick inspect in console if needed
  window.__SLITHER = { parts, foods, head, setBoost: b => boosting = b };
})();
