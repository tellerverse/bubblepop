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
let currentBall = null;
let gameOver = false;

// Initialize grid
function createGrid() {
    grid = [];
    for(let r=0; r<rows; r++){
        let row = [];
        for(let c=0; c<cols; c++){
            if(r < 5){ // Start with 5 filled rows
                row.push({ color: colors[Math.floor(Math.random()*colors.length)] });
            } else {
                row.push(null);
            }
        }
        grid.push(row);
    }
}

// Convert grid to coordinates
function getBallPosition(row, col){
    let x = col * ballRadius * 2 + ballRadius;
    if(row % 2 == 1) x += ballRadius;
    let y = row * rowHeight + ballRadius;
    return {x, y};
}

// Shoot ball
canvas.addEventListener("click", e => {
    if(!currentBall && !gameOver){
        const rect = canvas.getBoundingClientRect();
        const mx = e.clientX - rect.left;
        const my = e.clientY - rect.top;
        const angle = Math.atan2(my - (canvas.height - 30), mx - canvas.width/2);
        currentBall = {
            x: canvas.width/2,
            y: canvas.height - 30,
            color: colors[Math.floor(Math.random()*colors.length)],
            dx: Math.cos(angle)*6,
            dy: Math.sin(angle)*6
        };
    }
});

// Collision detection with grid
function detectCollision(ball){
    for(let r=0; r<rows; r++){
        for(let c=0; c<cols; c++){
            if(grid[r][c]){
                let pos = getBallPosition(r,c);
                let dist = Math.hypot(ball.x - pos.x, ball.y - pos.y);
                if(dist <= ballRadius*2 - 2){
                    return {row:r, col:c};
                }
            }
        }
    }
    // Ceiling
    if(ball.y - ballRadius <= 0) return {row:0, col: Math.floor(ball.x/(2*ballRadius))};
    return null;
}

// Attach ball to grid
function attachBall(ball){
    const collision = detectCollision(ball);
    if(collision){
        let row = collision.row;
        let col = collision.col;
        // Adjust position
        if(ball.y < getBallPosition(row,col).y){
            row = row -1;
        }
        if(row < 0) row = 0;
        grid[row][col] = {color: ball.color};
        checkMatches(row, col, ball.color);
        currentBall = null;
    }
}

// Flood fill for match 3+
function checkMatches(row, col, color){
    let visited = new Set();
    let cluster = [];
    function dfs(r,c){
        if(r<0 || r>=rows || c<0 || c>=cols) return;
        let key = r + "," + c;
        if(visited.has(key)) return;
        if(!grid[r][c] || grid[r][c].color != color) return;
        visited.add(key);
        cluster.push({r,c});
        dfs(r-1,c);
        dfs(r+1,c);
        dfs(r,c-1);
        dfs(r,c+1);
        // Diagonal adjustment for hex rows
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

// Check game over
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
    gameOver=false;
    document.getElementById("gameOver").classList.add("hidden");
}

// Update
function update(){
    if(currentBall){
        currentBall.x += currentBall.dx;
        currentBall.y += currentBall.dy;

        // Bounce walls
        if(currentBall.x - ballRadius <=0 || currentBall.x + ballRadius >= canvas.width){
            currentBall.dx *= -1;
        }

        // Collision
        if(detectCollision(currentBall)){
            attachBall(currentBall);
        }

        // Ceiling
        if(currentBall.y - ballRadius <=0){
            attachBall(currentBall);
        }
    }
    checkGameOver();
}

// Draw
function draw(){
    ctx.clearRect(0,0,canvas.width,canvas.height);
    // Draw grid
    for(let r=0;r<rows;r++){
        for(let c=0;c<cols;c++){
            if(grid[r][c]){
                let pos = getBallPosition(r,c);
                ctx.beginPath();
                ctx.arc(pos.x,pos.y,ballRadius,0,Math.PI*2);
                ctx.fillStyle = grid[r][c].color;
                ctx.fill();
                ctx.strokeStyle="#fff";
                ctx.stroke();
            }
        }
    }
    // Draw current ball
    if(currentBall){
        ctx.beginPath();
        ctx.arc(currentBall.x,currentBall.y,ballRadius,0,Math.PI*2);
        ctx.fillStyle = currentBall.color;
        ctx.fill();
        ctx.strokeStyle="#fff";
        ctx.stroke();
    }
}

// Loop
function loop(){
    update();
    draw();
    requestAnimationFrame(loop);
}

createGrid();
loop();
