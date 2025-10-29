const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 400;
canvas.height = 600;

const colors = ["#e74c3c","#f1c40f","#2ecc71","#3498db","#9b59b6"];
const ballRadius = 20;
const rowHeight = ballRadius * Math.sqrt(3);
let balls = [];
let currentBall = null;
let gameOver = false;

// Initial grid
function createGrid() {
    balls = [];
    const rows = 5;
    for(let r = 0; r < rows; r++) {
        for(let c = 0; c < 10; c++) {
            balls.push({
                x: c*ballRadius*2 + ballRadius,
                y: r*rowHeight + ballRadius,
                color: colors[Math.floor(Math.random()*colors.length)]
            });
        }
    }
}

// Shoot ball
canvas.addEventListener("click", e => {
    if(!currentBall && !gameOver) {
        const rect = canvas.getBoundingClientRect();
        const angle = Math.atan2(e.clientY - rect.top - (canvas.height-30), e.clientX - rect.left - canvas.width/2);
        currentBall = {
            x: canvas.width/2,
            y: canvas.height-30,
            color: colors[Math.floor(Math.random()*colors.length)],
            dx: Math.cos(angle)*5,
            dy: Math.sin(angle)*5
        };
    }
});

function distance(a,b) {
    return Math.sqrt((a.x-b.x)**2 + (a.y-b.y)**2);
}

// Match 3
function checkMatches() {
    let popped = [];
    for(let i=0;i<balls.length;i++){
        let same = balls.filter(b=>distance(b,balls[i]) < ballRadius*1.1 && b.color === balls[i].color);
        if(same.length>=3){
            popped.push(...same);
        }
    }
    balls = balls.filter(b=>!popped.includes(b));
}

// Game Over check
function checkGameOver() {
    if(balls.some(b=>b.y + ballRadius >= canvas.height)){
        gameOver = true;
        document.getElementById("gameOver").classList.remove("hidden");
    }
}

// Restart
function restartGame() {
    createGrid();
    currentBall = null;
    gameOver = false;
    document.getElementById("gameOver").classList.add("hidden");
}

function update() {
    if(currentBall){
        currentBall.x += currentBall.dx;
        currentBall.y += currentBall.dy;

        // Bounce walls
        if(currentBall.x - ballRadius <= 0 || currentBall.x + ballRadius >= canvas.width){
            currentBall.dx *= -1;
        }

        // Collision
        let hit = balls.find(b => distance(b, currentBall) < ballRadius*2);
        if(currentBall.y - ballRadius <= 0 || hit){
            balls.push({x: currentBall.x, y: currentBall.y, color: currentBall.color});
            currentBall = null;
            checkMatches();
        }
    }
    checkGameOver();
}

function draw() {
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // Draw balls
    balls.forEach(b=>{
        ctx.beginPath();
        ctx.arc(b.x,b.y,ballRadius,0,Math.PI*2);
        ctx.fillStyle = b.color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.stroke();
    });

    // Draw current ball
    if(currentBall){
        ctx.beginPath();
        ctx.arc(currentBall.x,currentBall.y,ballRadius,0,Math.PI*2);
        ctx.fillStyle = currentBall.color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.stroke();
    }
}

function loop() {
    update();
    draw();
    requestAnimationFrame(loop);
}

createGrid();
loop();
