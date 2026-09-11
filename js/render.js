/*
 * Flappy Bird — renderer. Takes a CanvasRenderingContext2D-like object,
 * an assets bundle ({ sprites: {name: image} }) and a game snapshot from core.js.
 * No DOM access; works in the browser and headless (@napi-rs/canvas).
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) {
    module.exports = factory();
  } else {
    root.FlappyRender = factory();
  }
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var BIRD_FRAMES = ['midflap', 'downflap', 'upflap'];
  var MEDAL_COLORS = {
    bronze: ['#e0a26a', '#8a5a2b', '#fff0dd'],
    silver: ['#d9d9d9', '#8c8c8c', '#ffffff'],
    gold: ['#ffd75e', '#c9930a', '#fff6cc'],
    platinum: ['#e8f4f2', '#9ab8b4', '#ffffff']
  };

  function roundedRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.lineTo(x + w - r, y);
    ctx.quadraticCurveTo(x + w, y, x + w, y + r);
    ctx.lineTo(x + w, y + h - r);
    ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
    ctx.lineTo(x + r, y + h);
    ctx.quadraticCurveTo(x, y + h, x, y + h - r);
    ctx.lineTo(x, y + r);
    ctx.quadraticCurveTo(x, y, x + r, y);
    ctx.closePath();
  }

  // Measure a number with the proportional digit sprites (the "1" is narrow).
  function measureNumber(sprites, num, scale) {
    scale = scale || 1;
    var str = String(num);
    var total = 0;
    for (var i = 0; i < str.length; i++) {
      total += (sprites[str[i]] ? sprites[str[i]].width : 24) * scale;
      if (i < str.length - 1) total += 2 * scale; // letter-spacing
    }
    return total;
  }

  function drawNumber(ctx, sprites, num, centerX, y) {
    var str = String(num);
    var x = centerX - measureNumber(sprites, num) / 2;
    for (var i = 0; i < str.length; i++) {
      var d = sprites[str[i]];
      if (!d) continue;
      // hard drop shadow like the original outline font
      ctx.drawImage(d, Math.floor(x) + 1, y + 1);
      ctx.drawImage(d, Math.floor(x), y);
      x += d.width + 2;
    }
  }

  function drawNumberRight(ctx, sprites, num, rightX, y, scale) {
    scale = scale || 1;
    var str = String(num);
    var x = rightX;
    for (var i = str.length - 1; i >= 0; i--) {
      var d = sprites[str[i]];
      if (!d) continue;
      var w = d.width * scale;
      x -= w;
      ctx.drawImage(d, Math.floor(x), y, w, d.height * scale);
      x -= 2 * scale;
    }
  }

  function drawBackground(ctx, sprites, snap) {
    ctx.drawImage(sprites[snap.night ? 'background-night' : 'background-day'], 0, 0);
  }

  function drawPipes(ctx, sprites, snap, cfg) {
    var pipe = sprites['pipe-green'];
    for (var i = 0; i < snap.pipes.length; i++) {
      var p = snap.pipes[i];
      var x = Math.round(p.x);
      // Top pipe: cap must face the gap -> draw sprite vertically flipped.
      ctx.save();
      ctx.translate(0, p.top);
      ctx.scale(1, -1);
      ctx.drawImage(pipe, 0, 0, pipe.width, pipe.height, x, 0, cfg.PIPE_W, p.top);
      ctx.restore();
      // Bottom pipe: cap on top, body down to the ground.
      var by = p.top + cfg.PIPE_GAP;
      ctx.drawImage(pipe, 0, 0, pipe.width, pipe.height, x, by, cfg.PIPE_W, cfg.GROUND_Y - by);
    }
  }

  function drawBase(ctx, sprites, snap, cfg) {
    var base = sprites['base'];
    var off = Math.floor(snap.baseOffset);
    ctx.drawImage(base, -off, cfg.GROUND_Y);
    ctx.drawImage(base, -off + base.width, cfg.GROUND_Y);
  }

  function drawBird(ctx, sprites, snap) {
    var name = 'yellowbird-' + BIRD_FRAMES[snap.bird.frame % 3];
    var s = sprites[name];
    ctx.save();
    ctx.translate(Math.round(snap.bird.x + s.width / 2), Math.round(snap.bird.y + s.height / 2));
    ctx.rotate(snap.bird.rotation);
    ctx.drawImage(s, -s.width / 2, -s.height / 2);
    ctx.restore();
  }

  function drawReady(ctx, sprites, cfg) {
    var msg = sprites['message'];
    ctx.drawImage(msg, Math.round((cfg.WIDTH - msg.width) / 2), 96);
  }

  function drawMedal(ctx, kind, cx, cy) {
    var c = MEDAL_COLORS[kind];
    ctx.save();
    ctx.fillStyle = c[1];
    ctx.beginPath();
    ctx.arc(cx, cy, 13, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c[0];
    ctx.beginPath();
    ctx.arc(cx, cy, 11, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = c[2];
    ctx.beginPath();
    ctx.arc(cx - 4, cy - 4, 3, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  function easeOut(t) { return 1 - Math.pow(1 - t, 3); }

  function clamp01(v) { return Math.max(0, Math.min(1, v)); }

  function drawGameOver(ctx, sprites, snap, cfg) {
    var t = easeOut(snap.gameOverProgress);

    // "Game Over" banner drops in from above.
    var go = sprites['gameover'];
    var goTargetY = cfg.HEIGHT / 2 - 150;
    var goY = Math.round(-go.height + t * (goTargetY + go.height));
    ctx.drawImage(go, Math.round((cfg.WIDTH - go.width) / 2), goY);

    if (snap.gameOverProgress < 0.35) return;

    // Scoreboard panel slides up from below, starting once the banner lands.
    var t2 = easeOut(clamp01((snap.gameOverProgress - 0.35) / 0.65));
    var sbW = 226, sbH = 112;
    var sbX = Math.round((cfg.WIDTH - sbW) / 2);
    var sbFinalY = 224;
    var sbY = Math.round(cfg.HEIGHT + t2 * (sbFinalY - cfg.HEIGHT));
    var rightX = sbX + sbW - 14;
    var DIG = 0.6; // scoreboard digits are drawn smaller than the HUD score

    ctx.save();
    ctx.fillStyle = '#ded895';
    ctx.strokeStyle = '#543847';
    ctx.lineWidth = 2;
    roundedRect(ctx, sbX, sbY, sbW, sbH, 6);
    ctx.fill();
    ctx.stroke();

    // Medal slot
    if (snap.medal) {
      drawMedal(ctx, snap.medal, sbX + 48, sbY + sbH / 2);
    } else {
      ctx.fillStyle = '#c9c07a';
      ctx.beginPath();
      ctx.arc(sbX + 48, sbY + sbH / 2, 12, 0, Math.PI * 2);
      ctx.fill();
    }

    // Labels + numbers
    ctx.fillStyle = '#e5712f';
    ctx.font = 'bold 13px "Courier New", monospace';
    ctx.textAlign = 'right';
    ctx.fillText('SCORE', rightX, sbY + 30);
    drawNumberRight(ctx, sprites, snap.score, rightX, sbY + 36, DIG);
    ctx.fillText('BEST', rightX, sbY + 74);
    drawNumberRight(ctx, sprites, snap.best, rightX, sbY + 80, DIG);

    // "NEW" badge sits left of the best number when best was beaten this run
    if (snap.newBest) {
      var bestW = measureNumber(sprites, snap.best, DIG);
      var badgeW = 32, badgeH = 12;
      var bx = Math.round(rightX - bestW - 8 - badgeW);
      var by = Math.round(sbY + 84);
      ctx.fillStyle = '#e5432f';
      roundedRect(ctx, bx, by, badgeW, badgeH, 3);
      ctx.fill();
      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 9px "Courier New", monospace';
      ctx.textAlign = 'center';
      ctx.fillText('NEW', bx + badgeW / 2, by + 9);
    }
    ctx.restore();
  }

  function draw(ctx, assets, snap, cfg) {
    var sprites = assets.sprites;
    ctx.clearRect(0, 0, cfg.WIDTH, cfg.HEIGHT);

    drawBackground(ctx, sprites, snap);
    drawPipes(ctx, sprites, snap, cfg);
    drawBase(ctx, sprites, snap, cfg);
    drawBird(ctx, sprites, snap);

    if (snap.state === 'ready') {
      drawReady(ctx, sprites, cfg);
    }
    if (snap.state === 'playing' || snap.state === 'dying') {
      drawNumber(ctx, sprites, snap.score, cfg.WIDTH / 2, 24);
    }
    if (snap.state === 'gameover') {
      drawGameOver(ctx, sprites, snap, cfg);
    }

    if (snap.flashAlpha > 0) {
      ctx.save();
      ctx.fillStyle = 'rgba(255,255,255,' + snap.flashAlpha.toFixed(3) + ')';
      ctx.fillRect(0, 0, cfg.WIDTH, cfg.HEIGHT);
      ctx.restore();
    }
  }

  return { draw: draw, drawNumber: drawNumber, drawNumberRight: drawNumberRight, measureNumber: measureNumber };
});
