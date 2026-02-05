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
let currentPipeSpeed = 2;
const PIPE_SPAWN_RATE = 1500; // ms
const BIRD_X = 50;

// Game state
let gameState = 'START'; // START, GAME, GAMEOVER
let score = 0;
let bestScore = parseInt(localStorage.getItem('flappyBestScore')) || 0;
let frameCount = 0;
let baseScroll = 0;
let canRestart = false;
let flashOpacity = 0;
let shakeTimer = 0;
let showScoreboard = false;

const bird = {
    x: BIRD_X,
    y: 200,
    velocity: 0,
    width: 34,
    height: 24,
    rotation: 0,
    frame: 0,
    type: 'yellow' // yellow, blue, red
};

const pipes = [];
let pipeType = 'green'; // green, red
let currentPipeGap = 100;
const PIPE_MIN_HEIGHT = 50;
let currentPipeSpawnInterval = 90; // frames

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

    if (flashOpacity > 0) flashOpacity -= 0.1;
    if (shakeTimer > 0) shakeTimer--;

    if (gameState === 'START') {
        bird.y = 200 + Math.sin(frameCount / 10) * 10;
        bird.rotation = 0;
        if (frameCount % 10 === 0) {
            bird.frame = (bird.frame + 1) % 3;
        }
    } else if (gameState === 'GAME') {
        updateBird();
        updatePipes();
        updateDifficulty();
    } else if (gameState === 'GAMEOVER') {
        updateBirdGameOver();
    }
}

function updateBirdGameOver() {
    const baseHeight = assets.sprites['base'].height;
    if (bird.y + bird.height < canvas.height - baseHeight) {
        bird.velocity += GRAVITY;
        bird.y += bird.velocity;
        bird.rotation = Math.min(Math.PI / 2, bird.rotation + 0.1);
    } else {
        bird.y = canvas.height - baseHeight - bird.height;
        if (shakeTimer === 0 && !showScoreboard) {
            showScoreboard = true;
            setTimeout(() => {
                canRestart = true;
            }, 500);
        }
    }
}

function updateDifficulty() {
    // Increase speed and decrease interval as score increases
    currentPipeSpeed = 2 + (score * 0.15);
    currentPipeSpawnInterval = Math.max(45, 90 - (score * 3));
    currentPipeGap = Math.max(75, 100 - (score * 0.5));
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
    // Use currentPipeSpawnInterval for spawning
    if (gameState === 'GAME' && frameCount % currentPipeSpawnInterval === 0) {
        spawnPipe();
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
    const maxHeight = canvas.height - assets.sprites['base'].height - currentPipeGap - PIPE_MIN_HEIGHT;
    const topHeight = Math.floor(Math.random() * (maxHeight - minHeight + 1)) + minHeight;

    pipes.push({
        x: canvas.width,
        top: topHeight,
        gap: currentPipeGap,
        width: 52,
        passed: false
    });
}

function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    if (shakeTimer > 0) {
        const shakeX = (Math.random() - 0.5) * 10;
        const shakeY = (Math.random() - 0.5) * 10;
        ctx.translate(shakeX, shakeY);
    }

    if (gameState === 'START') {
        drawStartScreen();
    } else if (gameState === 'GAME') {
        drawGame();
    } else if (gameState === 'GAMEOVER') {
        drawGameOverScreen();
    }
    ctx.restore();

    if (flashOpacity > 0) {
        ctx.fillStyle = `rgba(255, 255, 255, ${flashOpacity})`;
        ctx.fillRect(0, 0, canvas.width, canvas.height);
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
    const bg = score >= 10 ? 'background-night' : 'background-day';
    ctx.drawImage(assets.sprites[bg], 0, 0);
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
    const pipeSprite = assets.sprites[`pipe-${pipeType}`];
    const baseHeight = assets.sprites['base'].height;

    pipes.forEach(p => {
        // Top pipe
        ctx.save();
        ctx.translate(p.x + p.width / 2, p.top);
        ctx.scale(1, -1);
        ctx.drawImage(pipeSprite, -p.width / 2, 0);
        ctx.restore();

        // Bottom pipe
        ctx.drawImage(pipeSprite, p.x, p.top + p.gap);
    });
}

function drawBird() {
    const birdSprites = [
        assets.sprites[`${bird.type}bird-downflap`],
        assets.sprites[`${bird.type}bird-midflap`],
        assets.sprites[`${bird.type}bird-upflap`]
    ];
    const sprite = birdSprites[bird.frame];

    ctx.save();
    ctx.translate(bird.x + bird.width / 2, bird.y + bird.height / 2);
    ctx.rotate(bird.rotation);
    ctx.drawImage(sprite, -bird.width / 2, -bird.height / 2);
    ctx.restore();
}

function drawScore() {
    const scoreStr = score.toString();
    const digitWidth = 24; // Standard width for the numeric sprites
    const totalWidth = digitWidth * scoreStr.length;
    let x = canvas.width / 2 - totalWidth / 2;
    const y = 50;

    for (let char of scoreStr) {
        const sprite = assets.sprites[char];
        ctx.drawImage(sprite, x, y);
        x += digitWidth;
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
            bird.y + bird.height > p.top + p.gap) {
            gameOver();
            return;
        }
    }
}

function gameOver() {
    if (gameState === 'GAMEOVER') return;

    gameState = 'GAMEOVER';
    canRestart = false;
    showScoreboard = false;
    flashOpacity = 1;
    shakeTimer = 20;

    if (score > bestScore) {
        bestScore = score;
        localStorage.setItem('flappyBestScore', bestScore);
    }

    assets.audio['hit'].play();
    setTimeout(() => {
        assets.audio['die'].play();
    }, 500);
}

function drawGameOverScreen() {
    drawBackground();
    drawPipes();
    drawBase();
    drawBird();

    if (showScoreboard) {
        const gameOver = assets.sprites['gameover'];
        ctx.drawImage(gameOver, canvas.width / 2 - gameOver.width / 2, canvas.height / 2 - gameOver.height / 2 - 100);
        drawScoreboard();
    }
}

function drawScoreboard() {
    const boardWidth = 226;
    const boardHeight = 114;
    const x = canvas.width / 2 - boardWidth / 2;
    const y = canvas.height / 2 - boardHeight / 2;

    // Draw board box (simulating the flappy bird scoreboard)
    ctx.fillStyle = '#ded895'; // Light brownish
    ctx.strokeStyle = '#543847'; // Dark border
    ctx.lineWidth = 2;
    ctx.fillRect(x, y, boardWidth, boardHeight);
    ctx.strokeRect(x, y, boardWidth, boardHeight);

    // Labels
    ctx.fillStyle = '#f07028'; // Orange-ish
    ctx.font = 'bold 16px Arial';
    ctx.textAlign = 'right';
    ctx.fillText('SCORE', x + boardWidth - 20, y + 30);
    ctx.fillText('BEST', x + boardWidth - 20, y + 75);

    // Scores using numeric sprites (scaled down for the board)
    drawSmallScore(score, x + boardWidth - 20, y + 40);
    drawSmallScore(bestScore, x + boardWidth - 20, y + 85);
}

function drawSmallScore(val, rightX, topY) {
    const scoreStr = val.toString();
    const digitWidth = 14; // Scaled down
    const digitHeight = 20;
    let currentX = rightX - digitWidth;

    for (let i = scoreStr.length - 1; i >= 0; i--) {
        const char = scoreStr[i];
        const sprite = assets.sprites[char];
        ctx.drawImage(sprite, currentX, topY, digitWidth, digitHeight);
        currentX -= digitWidth;
    }
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
    currentPipeSpeed = 2;
    currentPipeSpawnInterval = 90;
    currentPipeGap = 100;
    showScoreboard = false;

    // Randomize bird and pipe
    const birdTypes = ['yellow', 'blue', 'red'];
    bird.type = birdTypes[Math.floor(Math.random() * birdTypes.length)];
    pipeType = Math.random() < 0.5 ? 'green' : 'red';
}

init();
