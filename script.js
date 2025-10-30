const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const card = document.querySelector(".card");
const scoreEl = document.getElementById("score");
const highscoreEl = document.getElementById("highscore");
const restartBtn = document.getElementById("restart");

let DPR = window.devicePixelRatio || 1;
function resizeCanvas() {
  canvas.width = card.clientWidth * DPR;
  canvas.height = card.clientHeight * DPR;
  ctx.scale(DPR,DPR);
}
resizeCanvas();
window.addEventListener("resize",resizeCanvas);

const FIELD_W = 2000;
const FIELD_H = 2000;
const SEG_LEN = 12;
const START_LEN = 20;
const BASE_SPEED = 2.5;

let player, foods=[], bots=[], camera, alive, score, highscore, target;

function init(){
  // Player
  player = {
    head: {x: FIELD_W/2, y: FIELD_H/2, ang:0},
    parts: [],
    color:"#2de42e"
  };
  for(let i=0;i<START_LEN;i++) player.parts.push({x:player.head.x-i*SEG_LEN,y:player.head.y});
  
  // Camera
  camera = {x:player.head.x, y:player.head.y};
  target={x:player.head.x, y:player.head.y};
  alive=true;
  
  // Score
  score=0;
  if(!highscore) highscore=0;
  
  // Essen
  foods=[];
  for(let i=0;i<100;i++) foods.push({x:Math.random()*FIELD_W, y:Math.random()*FIELD_H, size:6});
  
  // Bots
  bots=[];
  for(let i=0;i<6;i++) bots.push(new Bot());
  
  restartBtn.classList.add("hidden");
  updateScore();
}

// Bot-Klasse
class Bot{
  constructor(){
    this.head={x:Math.random()*FIELD_W, y:Math.random()*FIELD_H, ang:Math.random()*2*Math.PI};
    const botLength = START_LEN + Math.floor(Math.random()*30); // random Länge
    this.parts=Array.from({length:botLength},(_,i)=>({x:this.head.x-i*SEG_LEN, y:this.head.y}));
    this.color=`hsl(${Math.random()*360},80%,60%)`;
    this.timer=0;
    this.target={x:this.head.x, y:this.head.y};
  }
  update(delta){
    // Ziel auf Essen
    let nearestFood = null;
    let minDist = Infinity;
    for(const f of foods){
      const d = Math.hypot(f.x-this.head.x,f.y-this.head.y);
      if(d<minDist){ minDist=d; nearestFood=f; }
    }
    if(nearestFood) this.target = {x: nearestFood.x, y: nearestFood.y};
    
    moveSnake(this.head, this.parts, this.target, delta, BASE_SPEED*0.9, false);
    this.checkFood();
  }
  checkFood(){
    for(const f of foods){
      const dx=f.x-this.head.x;
      const dy=f.y-this.head.y;
      if(Math.hypot(dx,dy)<SEG_LEN*2){
        foods.splice(foods.indexOf(f),1);
        foods.push({x:Math.random()*FIELD_W, y:Math.random()*FIELD_H, size:6});
        this.parts.push({...this.parts[this.parts.length-1]});
      }
    }
  }
}

// Snake-Bewegung
function moveSnake(head, parts, target, delta, speed, playerControlled=true){
  let dx = target.x-head.x;
  let dy = target.y-head.y;
  const dist=Math.hypot(dx,dy);
  if(playerControlled && dist<5){ dx=Math.cos(head.ang); dy=Math.sin(head.ang);}
  const desired = Math.atan2(dy,dx);
  const diff = Math.atan2(Math.sin(desired-head.ang), Math.cos(desired-head.ang));
  head.ang += diff*0.15;
  head.x += Math.cos(head.ang)*speed*delta;
  head.y += Math.sin(head.ang)*speed*delta;
  clamp(head);
  for(let i=0;i<parts.length;i++){
    const p=parts[i];
    const prev=i===0?head:parts[i-1];
    const a=Math.atan2(prev.y-p.y, prev.x-p.x);
    p.x = prev.x - Math.cos(a)*SEG_LEN;
    p.y = prev.y - Math.sin(a)*SEG_LEN;
    clamp(p);
  }
  if(playerControlled){
    checkFood();
    checkCollisions();
  }
}

// Spielfeld-Begrenzung
function clamp(p){
  if(p.x<0)p.x=0;
  if(p.x>FIELD_W)p.x=FIELD_W;
  if(p.y<0)p.y=0;
  if(p.y>FIELD_H)p.y=FIELD_H;
}

// Spieler frisst Essen
function checkFood(){
  for(const f of foods){
    if(Math.hypot(f.x-player.head.x, f.y-player.head.y)<SEG_LEN*1.5){
      foods.splice(foods.indexOf(f),1);
      foods.push({x:Math.random()*FIELD_W, y:Math.random()*FIELD_H, size:6});
      player.parts.push({...player.parts[player.parts.length-1]});
      score++;
      if(score>highscore) highscore=score;
      updateScore();
    }
  }
}

// Kollisionen mit sich selbst oder Bots
function checkCollisions(){
  for(let i=4;i<player.parts.length;i++){
    if(Math.hypot(player.parts[i].x-player.head.x, player.parts[i].y-player.head.y)<SEG_LEN*0.8){
      alive=false;
      restartBtn.classList.remove("hidden");
    }
  }
  for(const b of bots){
    for(const p of b.parts){
      if(Math.hypot(p.x-player.head.x,p.y-player.head.y)<SEG_LEN*0.8){
        alive=false;
        restartBtn.classList.remove("hidden");
      }
    }
  }
}

// Zeichnen
function drawSnake(head, parts, color){
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];
    const t=i/parts.length;
    const r=SEG_LEN*(0.9-0.5*t);
    ctx.beginPath();
    ctx.fillStyle=`hsl(${t*80},80%,60%)`;
    ctx.arc(p.x-camera.x+card.clientWidth/2, p.y-camera.y+card.clientHeight/2, r,0,2*Math.PI);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(head.x-camera.x+card.clientWidth/2, head.y-camera.y+card.clientHeight/2);
  ctx.rotate(head.ang);
  ctx.beginPath();
  ctx.fillStyle=color;
  ctx.arc(0,0,SEG_LEN*0.9,0,2*Math.PI);
  ctx.fill();
  ctx.restore();
}

// Rendern
function render(){
  // Canvas clear
  ctx.clearRect(0,0,card.clientWidth, card.clientHeight);
  ctx.fillStyle = "rgba(0,0,0,0.0)"; // transparent über Video
  ctx.fillRect(0,0,card.clientWidth, card.clientHeight);

  // Essen
  for(const f of foods){
    ctx.beginPath();
    ctx.arc(f.x-camera.x+card.clientWidth/2, f.y-camera.y+card.clientHeight/2, f.size,0,2*Math.PI);
    ctx.fillStyle="orange";
    ctx.fill();
  }

  // Bots
  for(const b of bots) drawSnake(b.head,b.parts,b.color);

  // Player
  drawSnake(player.head,player.parts,player.color);
}

// Score
function updateScore(){
  scoreEl.textContent = "Score: "+score;
  highscoreEl.textContent = "Highscore: "+highscore;
}

// Game Loop
let lastTime=performance.now();
function step(now=0){
  const delta = (now-lastTime)/16;
  lastTime=now;
  if(alive){
    moveSnake(player.head, player.parts, target, delta, BASE_SPEED, true);
    for(const b of bots) b.update(delta);
    camera.x = player.head.x;
    camera.y = player.head.y;
  }
  render();
  requestAnimationFrame(step);
}

// Input
canvas.addEventListener("mousemove", e=>{
  const rect=canvas.getBoundingClientRect();
  target.x=e.clientX-rect.left + camera.x - card.clientWidth/2;
  target.y=e.clientY-rect.top + camera.y - card.clientHeight/2;
});
canvas.addEventListener("touchmove", e=>{
  const t=e.touches[0];
  const rect=canvas.getBoundingClientRect();
  target.x=t.clientX-rect.left + camera.x - card.clientWidth/2;
  target.y=t.clientY-rect.top + camera.y - card.clientHeight/2;
},{passive:true});

// Restart
restartBtn.addEventListener("click",init);

init();
requestAnimationFrame(step);
