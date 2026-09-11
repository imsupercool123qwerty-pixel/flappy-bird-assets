/*
 * Flappy Bird — pure game simulation (no DOM).
 * Runs in the browser (window.FlappyCore) and in Node (module.exports) for headless testing.
 * All units are pixels / 60Hz frames on a 288x512 playfield, tuned to the original's feel.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FlappyCore = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var CONFIG = {
    WIDTH: 288,
    HEIGHT: 512,
    BASE_HEIGHT: 112,          // scrolling ground strip
    GRAVITY: 0.25,
    MAX_FALL_SPEED: 10,
    JUMP_VELOCITY: -4.6,
    BIRD_X: 50,
    BIRD_W: 34,
    BIRD_H: 24,
    HITBOX_W: 30,              // forgiving hitbox, inset inside the sprite
    HITBOX_H: 20,
    PIPE_W: 52,
    PIPE_GAP: 100,
    PIPE_SPEED: 2,
    PIPE_SPACING: 180,         // px between consecutive pipe columns
    PIPE_MIN_TOP: 50,          // min visible top-pipe length
    FLAP_FRAME_DURATION: 6,    // frames per wing frame
    DAY_CYCLE: 20,             // points per day/night swap
    READY_HOVER_Y: 230,
    READY_BOB_AMP: 6,
    READY_BOB_SPEED: 8,
    GAMEOVER_ANIM_FRAMES: 45,  // banner + scoreboard slide-in
    RESTART_LOCK_FRAMES: 30
  };
  CONFIG.GROUND_Y = CONFIG.HEIGHT - CONFIG.BASE_HEIGHT;

  var STATES = { READY: 'ready', PLAYING: 'playing', DYING: 'dying', GAMEOVER: 'gameover' };

  function medalFor(score) {
    if (score >= 40) return 'platinum';
    if (score >= 30) return 'gold';
    if (score >= 20) return 'silver';
    if (score >= 10) return 'bronze';
    return null;
  }

  function FlappyGame(opts) {
    opts = opts || {};
    this.rng = opts.rng || Math.random;
    this.emit = opts.emit || function () {};   // emit(eventName)
    this.best = opts.best || 0;
    this.onBest = opts.onBest || function () {}; // persist best score
    this.reset();
  }

  FlappyGame.prototype.reset = function () {
    this.state = STATES.READY;
    this.frame = 0;
    this.score = 0;
    this.newBest = false;
    this.baseOffset = 0;
    this.pipes = [];
    this.flashTimer = 0;
    this.gameOverTimer = 0;
    this.canRestart = false;
    this.bird = {
      x: CONFIG.BIRD_X,
      y: CONFIG.READY_HOVER_Y,
      velocity: 0,
      rotation: 0,           // radians
      frame: 0
    };
  };

  FlappyGame.prototype.isNight = function () {
    return Math.floor(this.score / CONFIG.DAY_CYCLE) % 2 === 1;
  };

  // Single fixed 60Hz simulation step.
  FlappyGame.prototype.update = function () {
    this.frame++;
    if (this.flashTimer > 0) this.flashTimer--;

    switch (this.state) {
      case STATES.READY:
        this.scrollBase();
        this.bird.velocity = 0;
        this.bird.rotation = 0;
        this.bird.y = CONFIG.READY_HOVER_Y +
          Math.sin(this.frame / CONFIG.READY_BOB_SPEED) * CONFIG.READY_BOB_AMP;
        this.animateWing();
        break;

      case STATES.PLAYING:
        this.scrollBase();
        this.stepBird();
        if (this.state === STATES.PLAYING) this.stepPipes();
        this.animateWing();
        break;

      case STATES.DYING:
        // world frozen; bird tumbles to the ground
        this.bird.velocity = Math.min(this.bird.velocity + CONFIG.GRAVITY, CONFIG.MAX_FALL_SPEED);
        this.bird.y += this.bird.velocity;
        this.rotateDown();
        if (this.bird.y + CONFIG.BIRD_H >= CONFIG.GROUND_Y) {
          this.bird.y = CONFIG.GROUND_Y - CONFIG.BIRD_H;
          this.enterGameOver();
        }
        break;

      case STATES.GAMEOVER:
        if (this.gameOverTimer < CONFIG.GAMEOVER_ANIM_FRAMES + CONFIG.RESTART_LOCK_FRAMES) this.gameOverTimer++;
        else this.canRestart = true;
        break;
    }
  };

  FlappyGame.prototype.scrollBase = function () {
    this.baseOffset = (this.baseOffset + CONFIG.PIPE_SPEED) % 336; // base sprite is 336px wide
  };

  FlappyGame.prototype.animateWing = function () {
    if (this.frame % CONFIG.FLAP_FRAME_DURATION === 0) {
      this.bird.frame = (this.bird.frame + 1) % 3;
    }
  };

  FlappyGame.prototype.press = function () {
    switch (this.state) {
      case STATES.READY:
        this.state = STATES.PLAYING;
        this.jump();
        break;
      case STATES.PLAYING:
        this.jump();
        break;
      case STATES.GAMEOVER:
        if (this.canRestart) {
          this.emit('swoosh');
          this.reset();
        }
        break;
      default:
        break; // dying: input ignored
    }
  };

  FlappyGame.prototype.jump = function () {
    this.bird.velocity = CONFIG.JUMP_VELOCITY;
    this.bird.rotation = -25 * Math.PI / 180;
    this.emit('wing');
  };

  FlappyGame.prototype.stepBird = function () {
    var b = this.bird;
    b.velocity = Math.min(b.velocity + CONFIG.GRAVITY, CONFIG.MAX_FALL_SPEED);
    b.y += b.velocity;

    // Ceiling: bird is clamped, not killed (matches original).
    if (b.y < 0) {
      b.y = 0;
      b.velocity = 0;
    }

    // Rotation: level while rising, nose-dive while falling.
    if (b.velocity < 0) {
      this.bird.rotation = -25 * Math.PI / 180;
    } else {
      this.rotateDown();
    }

    // Ground
    if (b.y + CONFIG.BIRD_H >= CONFIG.GROUND_Y) {
      b.y = CONFIG.GROUND_Y - CONFIG.BIRD_H;
      this.die(true);
      return;
    }

    // Pipes
    var hb = this.hitbox();
    for (var i = 0; i < this.pipes.length; i++) {
      var p = this.pipes[i];
      if (hb.right > p.x && hb.left < p.x + CONFIG.PIPE_W) {
        if (hb.top < p.top || hb.bottom > p.top + CONFIG.PIPE_GAP) {
          this.die(false);
          return;
        }
      }
    }
  };

  FlappyGame.prototype.rotateDown = function () {
    var b = this.bird;
    var target = 90 * Math.PI / 180;
    b.rotation = Math.min(target, b.rotation + 3 * Math.PI / 180);
  };

  FlappyGame.prototype.hitbox = function () {
    var b = this.bird;
    var dx = (CONFIG.BIRD_W - CONFIG.HITBOX_W) / 2;
    var dy = (CONFIG.BIRD_H - CONFIG.HITBOX_H) / 2;
    return {
      left: b.x + dx,
      right: b.x + dx + CONFIG.HITBOX_W,
      top: b.y + dy,
      bottom: b.y + dy + CONFIG.HITBOX_H
    };
  };

  FlappyGame.prototype.stepPipes = function () {
    // Spawn so consecutive columns are PIPE_SPACING px apart.
    var last = this.pipes[this.pipes.length - 1];
    if (!last || last.x <= CONFIG.WIDTH - CONFIG.PIPE_SPACING) {
      this.spawnPipe();
    }

    for (var i = this.pipes.length - 1; i >= 0; i--) {
      var p = this.pipes[i];
      p.x -= CONFIG.PIPE_SPEED;

      if (!p.scored && p.x + CONFIG.PIPE_W < this.bird.x) {
        p.scored = true;
        this.score++;
        this.emit('point');
        if (this.score > this.best) {
          this.best = this.score;
          this.newBest = true;
          this.onBest(this.best);
        }
      }
      if (p.x + CONFIG.PIPE_W < 0) this.pipes.splice(i, 1);
    }
  };

  FlappyGame.prototype.spawnPipe = function () {
    var maxTop = CONFIG.GROUND_Y - CONFIG.PIPE_GAP - CONFIG.PIPE_MIN_TOP;
    var range = maxTop - CONFIG.PIPE_MIN_TOP + 1;
    var top = CONFIG.PIPE_MIN_TOP + Math.floor(this.rng() * range);
    this.pipes.push({ x: CONFIG.WIDTH, top: top, scored: false });
  };

  FlappyGame.prototype.die = function (onGround) {
    this.emit('hit');
    this.flashTimer = 8;
    if (onGround) {
      this.emit('die');
      this.enterGameOver();
    } else {
      this.state = STATES.DYING;
    }
  };

  FlappyGame.prototype.enterGameOver = function () {
    if (this.state === STATES.GAMEOVER) return;
    this.state = STATES.GAMEOVER;
    this.gameOverTimer = 0;
    this.canRestart = false;
    this.emit('swoosh');
  };

  // Snapshot used by the renderer.
  FlappyGame.prototype.snapshot = function () {
    return {
      state: this.state,
      frame: this.frame,
      score: this.score,
      best: this.best,
      newBest: this.newBest,
      night: this.isNight(),
      bird: {
        x: this.bird.x, y: this.bird.y,
        rotation: this.bird.rotation, frame: this.bird.frame
      },
      pipes: this.pipes.map(function (p) { return { x: p.x, top: p.top }; }),
      baseOffset: this.baseOffset,
      flashAlpha: this.flashTimer > 0 ? this.flashTimer / 8 : 0,
      gameOverProgress: Math.min(1, this.gameOverTimer / CONFIG.GAMEOVER_ANIM_FRAMES),
      canRestart: this.canRestart,
      medal: medalFor(this.score)
    };
  };

  return { CONFIG: CONFIG, STATES: STATES, FlappyGame: FlappyGame, medalFor: medalFor };
});
