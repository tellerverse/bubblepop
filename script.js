const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
const card = document.querySelector(".card");

let DPR = window.devicePixelRatio || 1;
function resizeCanvas() {
  canvas.width = card.clientWidth * DPR;
  canvas.height = card.clientHeight * DPR;
  ctx.scale(DPR, DPR);
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const W = canvas.clientWidth;
const H = canvas.clientHeight;

const segLen = 10;
const BASE_SPEED = 2.2;
const START_LEN = 20;

let foods = [];
let bots = [];
let alive = true;

// Spieler
let head = { x: W/2, y: H/2, ang: 0 };
let parts = [];
for (let i=0; i<START_LEN; i++) parts.push({ x: head.x - i*segLen, y: head.y });

let target = { x: W/2, y: H/2 };

// Food erzeugen
for(let i=0;i<50;i++){
  foods.push({ x: Math.random()*W, y: Math.random()*H, size: 6 });
}

// Bots
class Bot{
  constructor(color){
    this.head={x:Math.random()*W,y:Math.random()*H,ang:Math.random()*Math.PI*2};
    this.parts=Array.from({length:START_LEN},(_,i)=>({x:this.head.x-i*segLen,y:this.head.y}));
    this.target={x:this.head.x,y:this.head.y};
    this.color=color;
    this.timer=0;
  }
  update(delta){
    this.timer-=delta;
    if(this.timer<=0){
      this.timer=60+Math.random()*120;
      this.target.x=Math.random()*W;
      this.target.y=Math.random()*H;
    }
    moveSnake(this.head,this.parts,this.target,delta,BASE_SPEED*0.9,false);
    this.checkFood();
  }
  checkFood(){
    for(const f of foods){
      const dx = f.x - this.head.x;
      const dy = f.y - this.head.y;
      if(Math.hypot(dx,dy) < segLen*2){
        foods.splice(foods.indexOf(f),1);
        foods.push({ x: Math.random()*W, y: Math.random()*H, size: 6 });
        this.parts.push({ ...this.parts[this.parts.length-1] });
      }
    }
  }
}

for(let i=0;i<4;i++) bots.push(new Bot(`hsl(${Math.random()*360},80%,60%)`));

function moveSnake(head,parts,target,delta,speed,playerControlled=true){
  let dx=target.x-head.x;
  let dy=target.y-head.y;
  const dist=Math.hypot(dx,dy);
  if(playerControlled && dist<5) { dx=Math.cos(head.ang); dy=Math.sin(head.ang); }
  const desired=Math.atan2(dy,dx);
  let diff=desired-head.ang;
  diff=Math.atan2(Math.sin(diff),Math.cos(diff));
  head.ang+=diff*0.15;
  head.x+=Math.cos(head.ang)*speed*delta;
  head.y+=Math.sin(head.ang)*speed*delta;
  clampPosition(head);
  for(let i=0;i<parts.length;i++){
    const p=parts[i];
    const prev=i===0?head:parts[i-1];
    const a=Math.atan2(prev.y-p.y,prev.x-p.x);
    p.x=prev.x-Math.cos(a)*segLen;
    p.y=prev.y-Math.sin(a)*segLen;
    clampPosition(p);
  }
  if(playerControlled) checkFood();
}

function clampPosition(p){
  if(p.x<0)p.x=0;
  if(p.x>W)p.x=W;
  if(p.y<0)p.y=0;
  if(p.y>H)p.y=H;
}

function checkFood(){
  for(const f of foods){
    const dx=f.x-head.x;
    const dy=f.y-head.y;
    if(Math.hypot(dx,dy)<segLen*2){
      foods.splice(foods.indexOf(f),1);
      foods.push({ x: Math.random()*W, y: Math.random()*H, size: 6 });
      parts.push({ ...parts[parts.length-1] });
    }
  }
}

let lastTime = performance.now();
function step(now=0){
  const delta=(now-lastTime)/16;
  lastTime=now;

  if(alive){
    moveSnake(head,parts,target,delta,BASE_SPEED,true);
    for(const b of bots) b.update(delta);
  }

  render();
  requestAnimationFrame(step);
}

function drawSnake(head,parts,color){
  for(let i=parts.length-1;i>=0;i--){
    const p=parts[i];
    const t=i/parts.length;
    const r=segLen*(0.9-0.5*t);
    ctx.beginPath();
    ctx.fillStyle=`hsl(${t*80},80%,60%)`;
    ctx.arc(p.x,p.y,r,0,Math.PI*2);
    ctx.fill();
  }
  ctx.save();
  ctx.translate(head.x,head.y);
  ctx.rotate(head.ang);
  ctx.beginPath();
  ctx.fillStyle=color;
  ctx.arc(0,0,segLen*0.9,0,Math.PI*2);
  ctx.fill();
  ctx.restore();
}

function render(){
  ctx.clearRect(0,0,W,H);
  for(const f of foods){
    ctx.beginPath();
    ctx.arc(f.x,f.y,f.size,0,Math.PI*2);
    ctx.fillStyle="orange";
    ctx.fill();
  }
  for(const b of bots) drawSnake(b.head,b.parts,b.color);
  drawSnake(head,parts,"#2de42e");
}

requestAnimationFrame(step);

// Steuerung
canvas.addEventListener("mousemove",e=>{
  const rect=canvas.getBoundingClientRect();
  target.x=e.clientX-rect.left;
  target.y=e.clientY-rect.top;
});
canvas.addEventListener("touchmove",e=>{
  const t=e.touches[0];
  const rect=canvas.getBoundingClientRect();
  target.x=t.clientX-rect.left;
  target.y=t.clientY-rect.top;
},{passive:true});

// Restart hidden
const restartBtn=document.getElementById("restart");
restartBtn.addEventListener("click",()=>{
  head={x:W/2,y:H/2,ang:0};
  parts=[];
  for(let i=0;i<START_LEN;i++) parts.push({x:head.x-i*segLen,y:head.y});
  alive=true;
  restartBtn.classList.add("hidden");
});
