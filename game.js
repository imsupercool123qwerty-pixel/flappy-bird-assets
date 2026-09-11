/*
 * Flappy Bird — browser bootstrap.
 * Wires core simulation + renderer to the DOM: assets, input, audio, rAF loop.
 */
(function () {
  'use strict';

  var canvas = document.getElementById('gameCanvas');
  var ctx = canvas.getContext('2d');
  var CFG = FlappyCore.CONFIG;

  var SPRITE_NAMES = [
    '0', '1', '2', '3', '4', '5', '6', '7', '8', '9',
    'background-day', 'background-night', 'base',
    'bluebird-downflap', 'bluebird-midflap', 'bluebird-upflap',
    'gameover', 'message', 'pipe-green', 'pipe-red',
    'redbird-downflap', 'redbird-midflap', 'redbird-upflap',
    'yellowbird-downflap', 'yellowbird-midflap', 'yellowbird-upflap'
  ];
  var AUDIO_NAMES = ['die', 'hit', 'point', 'swoosh', 'wing'];

  /* ---------- persistence (best score, mute) ---------- */
  var store = {
    get: function (k, d) {
      try { var v = localStorage.getItem(k); return v === null ? d : v; }
      catch (e) { return d; }
    },
    set: function (k, v) { try { localStorage.setItem(k, v); } catch (e) {} }
  };

  var muted = store.get('flappy.muted', '0') === '1';

  /* ---------- audio pools (ogg with wav fallback) ---------- */
  var sounds = {};
  function makeSound(name) {
    var els = [];
    function make() {
      var a = new Audio();
      ['ogg', 'wav'].forEach(function (ext) {
        var s = document.createElement('source');
        s.src = 'audio/' + name + '.' + ext;
        s.type = 'audio/' + ext;
        a.appendChild(s);
      });
      a.preload = 'auto';
      return a;
    }
    els.push(make());
    return {
      play: function () {
        if (muted) return;
        var a = null;
        for (var i = 0; i < els.length; i++) if (els[i].paused) { a = els[i]; break; }
        if (!a) {
          if (els.length < 4) { a = make(); els.push(a); }
          else a = els[0];
        }
        try { a.currentTime = 0; } catch (e) {}
        var p = a.play();
        if (p && p.catch) p.catch(function () {});
      }
    };
  }
  AUDIO_NAMES.forEach(function (n) { sounds[n] = makeSound(n); });

  /* ---------- game ---------- */
  var game = new FlappyCore.FlappyGame({
    emit: function (name) { if (sounds[name]) sounds[name].play(); },
    best: parseInt(store.get('flappy.best', '0'), 10) || 0,
    onBest: function (b) { store.set('flappy.best', String(b)); }
  });

  /* ---------- assets ---------- */
  var assets = { sprites: {} };
  function loadAssets(done) {
    var remaining = SPRITE_NAMES.length;
    if (remaining === 0) return done();
    SPRITE_NAMES.forEach(function (name) {
      var img = new Image();
      img.onload = img.onerror = function () {
        assets.sprites[name] = img;
        if (--remaining === 0) done();
      };
      img.src = 'sprites/' + name + '.png';
    });
  }

  /* ---------- scaling ---------- */
  function fit() {
    var scale = Math.min(window.innerWidth / CFG.WIDTH, window.innerHeight / CFG.HEIGHT) * 0.95;
    scale = Math.max(1, Math.floor(scale * 100) / 100);
    canvas.style.width = Math.floor(CFG.WIDTH * scale) + 'px';
    canvas.style.height = Math.floor(CFG.HEIGHT * scale) + 'px';
  }
  window.addEventListener('resize', fit);

  /* ---------- input ---------- */
  var lastInputAt = 0;
  function press() {
    var now = performance.now();
    if (now - lastInputAt < 60) return; // swallow touch->mouse double events
    lastInputAt = now;
    game.press();
  }

  window.addEventListener('keydown', function (e) {
    if (e.code === 'Space' || e.code === 'ArrowUp' || e.code === 'KeyW') {
      e.preventDefault();
      press();
    } else if (e.code === 'KeyM') {
      muted = !muted;
      store.set('flappy.muted', muted ? '1' : '0');
    }
  });
  canvas.addEventListener('mousedown', function (e) { e.preventDefault(); press(); });
  canvas.addEventListener('touchstart', function (e) { e.preventDefault(); press(); }, { passive: false });

  /* ---------- pause when hidden ---------- */
  var paused = false;
  document.addEventListener('visibilitychange', function () {
    paused = document.hidden;
  });

  /* ---------- fixed-timestep loop ---------- */
  var STEP = 1000 / 60;
  var last = 0;
  var acc = 0;
  function frame(now) {
    requestAnimationFrame(frame);
    if (!last) { last = now; return; }
    if (paused) { last = now; return; }
    acc += Math.min(now - last, 250);
    last = now;
    while (acc >= STEP) {
      game.update();
      acc -= STEP;
    }
    FlappyRender.draw(ctx, assets, game.snapshot(), CFG);
  }

  loadAssets(function () {
    fit();
    requestAnimationFrame(frame);
  });
})();
