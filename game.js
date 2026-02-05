const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const assets = {
    sprites: {},
    audio: {}
};

const spriteNames = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'background-day', 'background-night', 'base',
    'bluebird-downflap', 'bluebird-midflap', 'bluebird-upflap',
    'gameover', 'message', 'pipe-green', 'pipe-red',
    'redbird-downflap', 'redbird-midflap', 'redbird-upflap',
    'yellowbird-downflap', 'yellowbird-midflap', 'yellowbird-upflap'
];

const audioNames = [
    'die', 'hit', 'point', 'swoosh', 'wing'
];

let assetsLoaded = 0;
const totalAssets = spriteNames.length + audioNames.length;

function loadAssets(callback) {
    spriteNames.forEach(name => {
        const img = new Image();
        img.src = `sprites/${name}.png`;
        img.onload = () => {
            assets.sprites[name] = img;
            checkAssetsLoaded(callback);
        };
    });

    audioNames.forEach(name => {
        const audio = new Audio();
        audio.src = `audio/${name}.wav`;
        // Audio loading can be tricky without user interaction in some browsers,
        // but for a simple game we'll just assume they're available or load eventually.
        assets.audio[name] = audio;
        checkAssetsLoaded(callback);
    });
}

function checkAssetsLoaded(callback) {
    assetsLoaded++;
    if (assetsLoaded >= totalAssets) {
        callback();
    }
}

// Game constants
const FPS = 60;
const GRAVITY = 0.25;
const JUMP = -4.5;
const INITIAL_PIPE_SPEED = 2;
const BIRD_X = 50;

// Game state
let gameState = 'START'; // START, GAME, GAMEOVER
let score = 0;
let frameCount = 0;
let baseScroll = 0;
let canRestart = false;
let flashTimer = 0;
let shakeTimer = 0;
let bestScore = parseInt(localStorage.getItem('bestScore')) || 0;

let currentPipeSpeed = INITIAL_PIPE_SPEED;
let currentPipeSpawnInterval = 90;
let pipeSpawnTimer = 0;

const bird = {
    x: BIRD_X,
    y: 200,
    velocity: 0,
    width: 34,
    height: 24,
    rotation: 0,
    frame: 0
};

const pipes = [];
const PIPE_GAP = 100;
const PIPE_MIN_HEIGHT = 50;

function init() {
    loadAssets(() => {
        requestAnimationFrame(gameLoop);
    });
}

function gameLoop() {
    update();
    draw();
    requestAnimationFrame(gameLoop);
}

function update() {
    frameCount++;

    if (gameState !== 'GAMEOVER') {
        baseScroll = (baseScroll + currentPipeSpeed) % 24;
    }

    if (gameState === 'START') {
        bird.y = 200 + Math.sin(frameCount / 10) * 10;
        bird.rotation = 0;
        if (frameCount % 10 === 0) {
            bird.frame = (bird.frame + 1) % 3;
        }
    } else if (gameState === 'GAME') {
        updateBird();
        updatePipes();
    }
}

function updateBird() {
    bird.velocity += GRAVITY;
    bird.y += bird.velocity;

    checkCollisions();

    // Rotation
    if (bird.velocity <= 0) {
        bird.rotation = -20 * Math.PI / 180;
    } else {
        bird.rotation = Math.min(Math.PI / 2, bird.rotation + 0.1);
    }

    // Animation
    if (frameCount % 5 === 0) {
        bird.frame = (bird.frame + 1) % 3;
    }
}

function updatePipes() {
    // Increase difficulty
    currentPipeSpeed = INITIAL_PIPE_SPEED + (score * 0.05);
    currentPipeSpawnInterval = Math.max(50, 90 - (score * 1));

    pipeSpawnTimer++;
    if (pipeSpawnTimer >= currentPipeSpawnInterval) {
        spawnPipe();
        pipeSpawnTimer = 0;
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= currentPipeSpeed;

        if (p.x + p.width < 0) {
            pipes.splice(i, 1);
        }

        if (!p.passed && p.x + p.width < bird.x) {
            p.passed = true;
            score++;
            const point = assets.audio['point'];
            point.currentTime = 0;
            point.play();
        }
    }
}

function spawnPipe() {
    const minHeight = PIPE_MIN_HEIGHT;
    const maxHeight = canvas.height - assets.sprites['base'].height - PIPE_GAP - PIPE_MIN_HEIGHT;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

    pipes.push({
        x: canvas.width,
        top: topHeight,
        width: 52,
        passed: false
    });
}

function draw() {
    ctx.save();
    if (shakeTimer > 0) {
        const shakeAmount = 10;
        const dx = (Math.random() - 0.5) * shakeAmount;
        const dy = (Math.random() - 0.5) * shakeAmount;
        ctx.translate(dx, dy);
        shakeTimer--;
    }

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Placeholder background
    ctx.fillStyle = '#70c5ce';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    if (gameState === 'START') {
        drawStartScreen();
    } else if (gameState === 'GAME') {
        drawGame();
    } else if (gameState === 'GAMEOVER') {
        drawGameOverScreen();
    }

    ctx.restore();

    if (flashTimer > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashTimer / 10})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        flashTimer--;
    }
}

function drawStartScreen() {
    drawBackground();

    // Draw message
    const msg = assets.sprites['message'];
    ctx.drawImage(msg, canvas.width / 2 - msg.width / 2, canvas.height / 2 - msg.height / 2 - 50);

    drawBase();
    drawBird();
}

function drawBackground() {
    ctx.drawImage(assets.sprites['background-day'], 0, 0);
}

function drawBase() {
    const base = assets.sprites['base'];
    ctx.drawImage(base, -baseScroll, canvas.height - base.height);
    ctx.drawImage(base, base.width - baseScroll, canvas.height - base.height);
}

function drawGame() {
    drawBackground();
    drawPipes();
    drawBase();
    drawBird();
    drawScore();
}

function drawPipes() {
    const pipeSprite = assets.sprites['pipe-green'];
    const baseHeight = assets.sprites['base'].height;

    pipes.forEach(p => {
        // Top pipe
        ctx.save();
        ctx.translate(p.x + p.width / 2, p.top);
        ctx.scale(1, -1);
        ctx.drawImage(pipeSprite, -p.width / 2, 0);
        ctx.restore();

        // Bottom pipe
        ctx.drawImage(pipeSprite, p.x, p.top + PIPE_GAP);
    });
}

function drawBird() {
    const birdSprites = [
        assets.sprites['yellowbird-downflap'],
        assets.sprites['yellowbird-midflap'],
        assets.sprites['yellowbird-upflap']
    ];
    const sprite = birdSprites[bird.frame];

    ctx.save();
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
    ctx.rotate(bird.rotation);
    ctx.drawImage(sprite, -bird.width / 2, -bird.height / 2);
    ctx.restore();
}

function drawScore() {
    drawNumbers(score, canvas.width / 2, 50, 'center');
}

function drawNumbers(num, x, y, alignment = 'center', scale = 1) {
    const numStr = num.toString();
    const digitWidth = 24 * scale;
    const totalWidth = digitWidth * numStr.length;

    let startX = x;
    if (alignment === 'center') {
        startX = x - totalWidth / 2;
    } else if (alignment === 'right') {
        startX = x - totalWidth;
    }

    for (let char of numStr) {
        const sprite = assets.sprites[char];
        if (sprite) {
            ctx.drawImage(sprite, startX, y, digitWidth, sprite.height * scale);
        }
        startX += digitWidth;
    }
}

function checkCollisions() {
    const baseHeight = assets.sprites['base'].height;

    // Ground collision
    if (bird.y + bird.height >= canvas.height - baseHeight) {
        gameOver();
        return;
    }

    // Ceiling collision
    if (bird.y <= 0) {
        gameOver();
        return;
    }

    // Pipe collision
    for (let p of pipes) {
        // Top pipe
        if (bird.x + bird.width > p.x && bird.x < p.x + p.width &&
            bird.y < p.top) {
            gameOver();
            return;
        }

        // Bottom pipe
        if (bird.x + bird.width > p.x && bird.x < p.x + p.width &&
            bird.y + bird.height > p.top + PIPE_GAP) {
            gameOver();
            return;
        }
    }
}

function gameOver() {
    if (gameState === 'GAMEOVER') return;
    gameState = 'GAMEOVER';
    canRestart = false;
    flashTimer = 10;
    shakeTimer = 20;

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('bestScore', bestScore);
    }

    assets.audio['hit'].play();
    setTimeout(() => {
        assets.audio['die'].play();
    }, 500);
    setTimeout(() => {
        canRestart = true;
    }, 1000);
}

function drawGameOverScreen() {
    drawBackground();
    drawPipes();
    drawBase();
    drawBird();

    const gameOverSprite = assets.sprites['gameover'];
    ctx.drawImage(gameOverSprite, canvas.width / 2 - gameOverSprite.width / 2, canvas.height / 2 - 150);

    // Draw Scoreboard
    const sbWidth = 226;
    const sbHeight = 114;
    const sbX = canvas.width / 2 - sbWidth / 2;
    const sbY = canvas.height / 2 - sbHeight / 2;

    // Simple scoreboard box with rounded corners (simulated)
    ctx.fillStyle = '#ded895';
    ctx.strokeStyle = '#543847';
    ctx.lineWidth = 2;

    // Draw box
    ctx.beginPath();
    ctx.roundRect(sbX, sbY, sbWidth, sbHeight, 5);
    ctx.fill();
    ctx.stroke();

    // Draw Score and Best labels
    ctx.fillStyle = '#f07028';
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('SCORE', sbX + sbWidth - 20, sbY + 30);
    drawNumbers(score, sbX + sbWidth - 20, sbY + 35, 'right', 0.6);

    ctx.fillText('BEST', sbX + sbWidth - 20, sbY + 75);
    drawNumbers(bestScore, sbX + sbWidth - 20, sbY + 80, 'right', 0.6);
}

// Input handling
function handleInput() {
    if (gameState === 'START') {
        gameState = 'GAME';
        assets.audio['swoosh'].play();
        birdJump();
    } else if (gameState === 'GAME') {
        birdJump();
    } else if (gameState === 'GAMEOVER' && canRestart) {
        resetGame();
        gameState = 'GAME';
        assets.audio['swoosh'].play();
        birdJump();
    }
}

function birdJump() {
    bird.velocity = JUMP;
    const wing = assets.audio['wing'];
    wing.currentTime = 0;
    wing.play();
}

window.addEventListener('keydown', (e) => {
    if (e.code === 'Space' || e.code === 'ArrowUp') {
        e.preventDefault();
        handleInput();
    }
});

canvas.addEventListener('mousedown', () => {
    handleInput();
});

function resetGame() {
    score = 0;
    frameCount = 0;
    bird.y = 200;
    bird.velocity = 0;
    bird.rotation = 0;
    pipes.length = 0;
    currentPipeSpeed = INITIAL_PIPE_SPEED;
    currentPipeSpawnInterval = 90;
    pipeSpawnTimer = 0;
}

init();
