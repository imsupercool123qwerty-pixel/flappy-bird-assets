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
const PIPE_SPEED = 2;
const PIPE_SPAWN_RATE = 1500; // ms
const BIRD_X = 50;

// Game state
let gameState = 'START'; // START, GAME, GAMEOVER
let score = 0;
let frameCount = 0;
let baseScroll = 0;
let canRestart = false;

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
const PIPE_SPAWN_INTERVAL = 90; // frames

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
        baseScroll = (baseScroll + PIPE_SPEED) % 24;
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
    if (frameCount % PIPE_SPAWN_INTERVAL === 0) {
        spawnPipe();
    }

    for (let i = pipes.length - 1; i >= 0; i--) {
        const p = pipes[i];
        p.x -= PIPE_SPEED;

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
            bird.y + bird.height > p.top + PIPE_GAP) {
            gameOver();
            return;
        }
    }
}

function gameOver() {
    gameState = 'GAMEOVER';
    canRestart = false;
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

    const gameOver = assets.sprites['gameover'];
    ctx.drawImage(gameOver, canvas.width / 2 - gameOver.width / 2, canvas.height / 2 - gameOver.height / 2);

    drawScore();
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
}

init();
