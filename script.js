const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

canvas.width = 400;
canvas.height = 600;

const colors = ["#e74c3c","#f1c40f","#2ecc71","#3498db","#9b59b6"];
const ballRadius = 20;
const rowHeight = Math.sqrt(3) * ballRadius;
const cols = 10;
const rows = 12;

let grid = [];
let currentBall = null; // Schießball
let nextBall = null;    // Immer sichtbar unten
let aimAngle = 0;
let gameOver = false;

// Ball-Klasse
class Ball {
    constructor(x, y, color, dx=0, dy=0){
        this.x = x;
        this.y = y;
        this.color = color;
        this.dx = dx;
        this.dy = dy;
        this.moving = dx!==0 || dy!==0;
    }
    move(){
        if(!this.moving) return;
        this.x += this.dx;
        this.y += this.dy;

        // Wände abprallen
        if(this.x - ballRadius <= 0 || this.x + ballRadius >= canvas.width){
            this.dx *= -1;
        }
    }
    draw(){
        ctx.beginPath();
        ctx.arc(this.x, this.y, ballRadius, 0, Math.PI*2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = "#fff";
        ctx.stroke();
    }
}

// Grid-Koordinaten
function getBallPos(row, col){
    let x = col*ballRadius*2 + ballRadius;
    if(row % 2 ===1) x += ballRadius;
    let y = row*rowHeight + ballRadius;
    return {x,y};
}

// Init Grid
function createGrid(){
    grid = [];
    for(let r=0;r<rows;r++){
        let row = [];
        for(let c=0;c<cols;c++){
            if(r<5){ // Startreihe gefüllt
                row.push(new Ball(...Object.values(getBallPos(r,c)), colors[Math.floor(Math.random()*colors.length)]));
            } else {
                row.push(null);
            }
        }
        grid.push(row);
    }
}

// Generiere neuen Schussball
function generateBall(){
    return new Ball(canvas.width/2, canvas.height - 30, colors[Math.floor(Math.random()*colors.length)]);
}

// Maus zum Zielen
canvas.addEventListener("mousemove", e=>{
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    aimAngle = Math.atan2(my - (canvas.height - 30), mx - canvas.width/2);
});

// Klick = Schießen
canvas.addEventListener("click", e=>{
    if(currentBall || gameOver) return;
    currentBall = new Ball(nextBall.x, nextBall.y, nextBall.color, Math.cos(aimAngle)*6, Math.sin(aimAngle)*6);
    nextBall = generateBall();
});

// Kollision mit Grid
function detectCollision(ball){
    for(let r=0;r<rows;r++){
        for(let c=0;c<cols;c++){
            if(grid[r][c]){
                let pos = getBallPos(r,c);
                let dist = Math.hypot(ball.x - pos.x, ball.y - pos.y);
                if(dist <= ballRadius*2 - 1){
                    return {row:r, col:c};
                }
            }
        }
    }
    // Decke
    if(ball.y - ballRadius <=0) return {row:0, col: Math.floor(ball.x/(2*ballRadius))};
    return null;
}

// Ball an Grid anhängen
function attachBall(ball){
    const collision = detectCollision(ball);
    if(collision){
        let row = collision.row;
        let col = collision.col;
        if(ball.y < getBallPos(row,col).y){
            row = row -1;
        }
        if(row<0) row=0;
        grid[row][col] = new Ball(...Object.values(getBallPos(row,col)), ball.color);
        currentBall = null;
        checkMatches(row,col,ball.color);
    }
}

// Flood fill für Match 3+
function checkMatches(row, col, color){
    let visited = new Set();
    let cluster = [];
    function dfs(r,c){
        if(r<0 || r>=rows || c<0 || c>=cols) return;
        if(!grid[r][c] || grid[r][c].color !== color) return;
        let key = r+","+c;
        if(visited.has(key)) return;
        visited.add(key);
        cluster.push({r,c});
        dfs(r-1,c);
        dfs(r+1,c);
        dfs(r,c-1);
        dfs(r,c+1);
        // Diagonal für Hex Grid
        if(r%2==0){
            dfs(r-1,c-1);
            dfs(r+1,c-1);
        } else {
            dfs(r-1,c+1);
            dfs(r+1,c+1);
        }
    }
    dfs(row,col);
    if(cluster.length>=3){
        cluster.forEach(b=>grid[b.r][b.c]=null);
    }
}

// Check Game Over
function checkGameOver(){
    for(let c=0;c<cols;c++){
        if(grid[rows-1][c]){
            gameOver=true;
            document.getElementById("gameOver").classList.remove("hidden");
        }
    }
}

// Restart
function restartGame(){
    createGrid();
    currentBall=null;
    nextBall=generateBall();
    gameOver=false;
    document.getElementById("gameOver").classList.add("hidden");
}

// Update Loop
function update(){
    if(currentBall){
        currentBall.move();
        if(detectCollision(currentBall)) attachBall(currentBall);
        if(currentBall && currentBall.y - ballRadius <=0) attachBall(currentBall);
    }
    checkGameOver();
}

// Draw Loop
function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // Grid zeichnen
    for(let r=0;r<rows;r++){
        for(let c=0;c<cols;c++){
            if(grid[r][c]) grid[r][c].draw();
        }
    }
    // Schießball zeichnen
    if(currentBall) currentBall.draw();
    // Nächster Ball unten anzeigen
    if(!currentBall && nextBall) nextBall.draw();

    // Ziel-Linie
    ctx.beginPath();
    ctx.moveTo(canvas.width/2, canvas.height - 30);
    ctx.lineTo(canvas.width/2 + Math.cos(aimAngle)*50, canvas.height -30 + Math.sin(aimAngle)*50);
    ctx.strokeStyle = "#fff";
    ctx.stroke();
}

// Loop
function loop(){
    update();
    draw();
    requestAnimationFrame(loop);
}

// Init
createGrid();
nextBall = generateBall();
loop();
