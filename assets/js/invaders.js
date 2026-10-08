/* MintyOsinty \u2014 BUG BLASTER, a mini arcade shooter for the homepage hero.
   Drop-in: <div id="hero-game"></div> + <script src="/assets/js/invaders.js" defer></script>
   Keys only work while the cabinet is focused (click it), so the page never scrolls by accident. */
(function () {
  'use strict';
  var mount = document.getElementById('hero-game');
  if (!mount) return;
  // Leaderboard API (Cloudflare Worker). Override with <div id="hero-game" data-api="https://...">
  var API = (mount.getAttribute('data-api') || 'https://invaders-scores.mintyosinty.workers.dev').replace(/\/$/, '');

  /* ---------- styles ---------- */
  var css = '' +
    '.hero-game{position:relative;z-index:2;margin-left:auto;flex:0 0 auto;width:min(420px,34vw);}' +
    '@media(max-width:1100px){.hero-game{display:none;}}' +
    '.inv-cab{position:relative;background:var(--panel,#12122a);border:3px solid var(--border,#2a2a6a);' +
      'box-shadow:6px 6px 0 #770066;padding:1rem;outline:none;cursor:pointer;transition:border-color .1s,box-shadow .1s;}' +
    '.inv-cab:focus-visible,.inv-cab.is-live{border-color:var(--magenta,#ff00cc);box-shadow:8px 8px 0 #770066,0 0 24px rgba(255,0,204,.25);}' +
    '.inv-cab::before{content:"ARCADE";position:absolute;top:-.7rem;left:1rem;padding:0 .4rem;background:var(--panel,#12122a);' +
      'font-family:"Press Start 2P",monospace;font-size:.4rem;color:var(--magenta,#ff00cc);}' +
    '.inv-hud{display:flex;justify-content:space-between;gap:.5rem;font-family:"Press Start 2P",monospace;font-size:.42rem;' +
      'color:var(--muted,#5555aa);margin-bottom:.6rem;letter-spacing:.05em;}' +
    '.inv-hud b{font-weight:normal;color:var(--green,#39ff14);}' +
    '.inv-hud .inv-lives{color:var(--red,#ff2244);}' +
    '.inv-cab canvas{display:block;width:100%;height:auto;image-rendering:pixelated;background:#05050f;border:2px solid var(--border,#2a2a6a);}' +
    '.inv-help{margin-top:.6rem;font-family:"Press Start 2P",monospace;font-size:.36rem;color:var(--muted,#5555aa);' +
      'text-align:center;line-height:1.8;letter-spacing:.05em;}';
  var styleEl = document.createElement('style');
  styleEl.textContent = css;
  document.head.appendChild(styleEl);

  /* ---------- markup ---------- */
  mount.classList.add('hero-game');
  mount.innerHTML =
    '<div class="inv-cab" tabindex="0" role="application" aria-label="Bug Blaster mini game. Press Enter to start.">' +
      '<div class="inv-hud"><span>SCORE <b class="inv-score">0000</b></span>' +
      '<span>HI <b class="inv-hi">0000</b></span><span class="inv-lives">\u2665\u2665\u2665</span></div>' +
      '<canvas width="384" height="320"></canvas>' +
      '<div class="inv-help">\u25c0 \u25b6 / A D MOVE &nbsp;\u00b7&nbsp; SPACE FIRE &nbsp;\u00b7&nbsp; P PAUSE</div>' +
    '</div>';
  var cab = mount.querySelector('.inv-cab');
  var canvas = mount.querySelector('canvas');
  var elScore = mount.querySelector('.inv-score');
  var elHi = mount.querySelector('.inv-hi');
  var elLives = mount.querySelector('.inv-lives');

  var W = 384, H = 320;
  var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  canvas.width = W * dpr; canvas.height = H * dpr;
  var ctx = canvas.getContext('2d');
  ctx.scale(dpr, dpr);
  ctx.imageSmoothingEnabled = false;

  var C = { yellow: '#ffe600', cyan: '#00ffff', magenta: '#ff00cc', green: '#39ff14', red: '#ff2244',
            white: '#e8e8ff', muted: '#5555aa', bg: '#05050f' };
  var FONT = '"Press Start 2P", monospace';

  /* ---------- sprites (1 = pixel) ---------- */
  function sp(rows) { return rows.map(function (r) { return r.split('').map(function (c) { return c === '#'; }); }); }
  var SPR = {
    // Original pixel enemies: virus (30 pts), bug (20), trojan box (10), skull 'zero-day' bonus ship
    squid: [sp(['#..##..#', '.######.', '.#.##.#.', '########', '########', '.######.', '#.#..#.#', '...##...']),
            sp(['.#.##.#.', '.######.', '.#.##.#.', '########', '########', '.######.', '.#.##.#.', '#..##..#'])],
    crab:  [sp(['....###....', '.#..###..#.', '..#######..', '#.###.###.#', '.####.####.', '#.###.###.#', '..#######..', '.#...#...#.']),
            sp(['....###....', '#...###...#', '..#######..', '..###.###..', '#####.#####', '..###.###..', '..#######..', '#...#.#...#'])],
    octo:  [sp(['...##..##...', '....####....', '############', '#....##....#', '#.##.##.##.#', '#....##....#', '############', '.#..#..#..#.']),
            sp(['..##....##..', '....####....', '############', '#....##....#', '#.##.##.##.#', '#....##....#', '############', '..#..##..#..'])],
    ship:  sp(['......#......', '.....###.....', '..#..###..#..', '..#########..', '.###########.', '#############', '#.#########.#', '#############']),
    ufo:   sp(['....########....', '..############..', '.###..####..###.', '.###..####..###.', '..#####..#####..', '...##########...', '....#.#..#.#....'])
  };
  var PX = 2; // screen pixels per sprite pixel

  function drawSprite(s, x, y, color, px) {
    px = px || PX;
    ctx.fillStyle = color;
    for (var r = 0; r < s.length; r++)
      for (var c = 0; c < s[r].length; c++)
        if (s[r][c]) ctx.fillRect(Math.round(x + c * px), Math.round(y + r * px), px, px);
  }

  /* ---------- storage (best-effort) ---------- */
  var hi = 0;
  try { hi = parseInt(localStorage.getItem('mo-invaders-hi') || '0', 10) || 0; } catch (e) {}
  function saveHi() { try { localStorage.setItem('mo-invaders-hi', String(hi)); } catch (e) {} }

  /* ---------- online leaderboard (best-effort: the game works without it) ---------- */
  var board = null;      // [{name, score, wave, date}] or null if unreachable
  var gameToken = null;  // issued by the Worker when a game starts
  var entry = null;      // initials being typed { chars: [i,i,i], pos }
  var myRank = 0;        // highlighted row after submitting
  var lbMsg = '';        // status line on the game-over screen
  var CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';

  function api(path, body) {
    var opts = body ? { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) } : {};
    return fetch(API + path, opts).then(function (r) {
      return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'error'); return j; });
    });
  }
  function loadBoard() {
    return api('/scores').then(function (j) { board = j.scores || []; hud(); }).catch(function () {});
  }
  function boardTop() { return board && board.length ? board[0].score : 0; }
  function qualifies(score) {
    return !!(board && gameToken && score > 0 && (board.length < 10 || score > board[board.length - 1].score));
  }
  function submitScore(name) {
    lbMsg = 'SAVING...';
    var payload = { token: gameToken, name: name, score: s.score, wave: s.wave };
    gameToken = null;
    api('/submit', payload).then(function (j) {
      board = j.scores; myRank = j.rank; lbMsg = j.rank ? 'YOU PLACED #' + j.rank + '!' : 'SCORE SAVED';
      hud();
    }).catch(function (e) {
      lbMsg = /slow/.test(e.message) ? 'TRY AGAIN IN A MINUTE' : 'COULD NOT SAVE SCORE';
    });
  }

  /* ---------- game state ---------- */
  var ROWS = [{ k: 'squid', c: C.magenta, pts: 30 }, { k: 'crab', c: C.cyan, pts: 20 }, { k: 'crab', c: C.cyan, pts: 20 },
              { k: 'octo', c: C.yellow, pts: 10 }, { k: 'octo', c: C.yellow, pts: 10 }];
  var COLS = 8, CELL_W = 34, CELL_H = 24, PLAYER_Y = H - 30;
  var state = 'attract'; // attract | play | dying | over | paused
  var keys = {};
  var s; // per-game data

  function newGame() {
    s = { score: 0, lives: 3, wave: 1, player: { x: W / 2 - 13 }, shot: null, bombs: [],
          parts: [], ufo: null, ufoTimer: 12 + Math.random() * 10, dieTimer: 0, banner: 1.4 };
    buildWave();
    buildShields();
    hud();
  }
  function buildWave() {
    s.inv = [];
    for (var r = 0; r < ROWS.length; r++)
      for (var c = 0; c < COLS; c++)
        s.inv.push({ r: r, c: c, alive: true });
    s.ox = 24; s.oy = 40 + Math.min(4, s.wave - 1) * 8;
    s.dir = 1; s.frame = 0; s.stepT = 0; s.fireT = 1.2;
    s.total = s.inv.length;
    s.shot = null; s.bombs = [];
  }
  function buildShields() {
    var shape = ['...##########...', '..############..', '.##############.', '################', '################',
                 '################', '#####......#####', '####........####'];
    s.shields = [];
    for (var i = 0; i < 4; i++) {
      var bx = 34 + i * 92, by = PLAYER_Y - 44;
      for (var r = 0; r < shape.length; r++)
        for (var c = 0; c < shape[r].length; c++)
          if (shape[r][c] === '#') s.shields.push({ x: bx + c * 2, y: by + r * 2, a: true });
    }
  }
  function invPos(v) {
    var w = SPR[ROWS[v.r].k][0][0].length * PX;
    return { x: s.ox + v.c * CELL_W + (CELL_W - w) / 2, y: s.oy + v.r * CELL_H, w: w, h: 16 };
  }
  function pad(n) { n = String(n); while (n.length < 4) n = '0' + n; return n; }
  function hud() {
    elScore.textContent = pad(s ? s.score : 0);
    elHi.textContent = pad(Math.max(hi, boardTop()));
    elLives.textContent = s ? (s.lives > 0 ? '\u2665\u2665\u2665\u2665\u2665'.slice(0, s.lives) : '\u2014') : '\u2665\u2665\u2665';
  }
  function boom(x, y, color, n) {
    for (var i = 0; i < (n || 10); i++)
      s.parts.push({ x: x, y: y, vx: (Math.random() - .5) * 160, vy: (Math.random() - .5) * 160, t: .4 + Math.random() * .3, c: color });
  }
  function hit(a, b) { return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y; }
  function hitShield(b) {
    for (var i = 0; i < s.shields.length; i++) {
      var p = s.shields[i];
      if (p.a && hit(b, { x: p.x, y: p.y, w: 2, h: 2 })) {
        for (var j = 0; j < s.shields.length; j++) {
          var q = s.shields[j];
          if (q.a && Math.abs(q.x - p.x) <= 3 && Math.abs(q.y - p.y) <= 3 && Math.random() < .8) q.a = false;
        }
        p.a = false;
        return true;
      }
    }
    return false;
  }

  /* ---------- update ---------- */
  function update(dt) {
    var i, v, p;
    for (i = s.parts.length - 1; i >= 0; i--) {
      p = s.parts[i]; p.x += p.vx * dt; p.y += p.vy * dt; p.t -= dt;
      if (p.t <= 0) s.parts.splice(i, 1);
    }
    if (s.banner > 0) s.banner -= dt;
    if (state === 'dying') {
      s.dieTimer -= dt;
      if (s.dieTimer <= 0) {
        if (s.lives <= 0) { gameOver(); }
        else { state = 'play'; s.player.x = W / 2 - 13; s.bombs = []; }
      }
      return;
    }

    var alive = s.inv.filter(function (q) { return q.alive; });

    // player (attract mode = simple autopilot)
    var pl = s.player, speed = 170;
    if (state === 'play') {
      if (keys.left) pl.x -= speed * dt;
      if (keys.right) pl.x += speed * dt;
      if (keys.fire && !s.shot) { s.shot = { x: pl.x + 12, y: PLAYER_Y - 6, w: 2, h: 8 }; }
    } else if (state === 'attract' && alive.length) {
      var target = invPos(alive[(Math.floor(performance.now() / 2500)) % alive.length]);
      var tx = target.x + target.w / 2 - 13;
      pl.x += Math.max(-1, Math.min(1, tx - pl.x)) * 90 * dt;
      if (!s.shot && Math.abs(tx - pl.x) < 6) s.shot = { x: pl.x + 12, y: PLAYER_Y - 6, w: 2, h: 8 };
    }
    pl.x = Math.max(4, Math.min(W - 30, pl.x));

    // player shot
    if (s.shot) {
      s.shot.y -= 380 * dt;
      if (s.shot.y < 14) s.shot = null;
      else if (hitShield(s.shot)) s.shot = null;
      else {
        for (i = 0; i < alive.length; i++) {
          v = alive[i]; var r = invPos(v);
          if (hit(s.shot, r)) {
            v.alive = false; s.shot = null;
            if (state === 'play') s.score += ROWS[v.r].pts;
            boom(r.x + r.w / 2, r.y + 8, ROWS[v.r].c, 12);
            break;
          }
        }
        if (s.shot && s.ufo && hit(s.shot, { x: s.ufo.x, y: 16, w: 32, h: 14 })) {
          var bonus = [50, 100, 150, 300][Math.floor(Math.random() * 4)];
          if (state === 'play') s.score += bonus;
          boom(s.ufo.x + 16, 22, C.red, 18);
          s.ufo = null; s.shot = null;
        }
      }
    }

    // UFO
    s.ufoTimer -= dt;
    if (!s.ufo && s.ufoTimer <= 0) {
      var fromLeft = Math.random() < .5;
      s.ufo = { x: fromLeft ? -32 : W, vx: fromLeft ? 70 : -70 };
      s.ufoTimer = 18 + Math.random() * 12;
    }
    if (s.ufo) { s.ufo.x += s.ufo.vx * dt; if (s.ufo.x < -40 || s.ufo.x > W + 8) s.ufo = null; }

    alive = s.inv.filter(function (q) { return q.alive; });
    if (!alive.length) {
      if (state === 'play') { s.wave++; s.banner = 1.4; s.score += 100; }
      buildWave();
      if (state !== 'play') buildShields();
      hud();
      return;
    }

    // march
    var paceBase = state === 'play' ? 620 : 900;
    var step = Math.max(55, paceBase * (alive.length / s.total)) / (1 + (s.wave - 1) * 0.18) / 1000;
    s.stepT += dt;
    if (s.stepT >= step) {
      s.stepT = 0; s.frame ^= 1;
      var minX = Infinity, maxX = -Infinity;
      alive.forEach(function (q) { var r = invPos(q); minX = Math.min(minX, r.x); maxX = Math.max(maxX, r.x + r.w); });
      if ((s.dir > 0 && maxX + 6 > W - 6) || (s.dir < 0 && minX - 6 < 6)) { s.dir *= -1; s.oy += 8; }
      else s.ox += 6 * s.dir;
    }

    // invaders reach the bottom
    var lowest = 0;
    alive.forEach(function (q) { var r = invPos(q); lowest = Math.max(lowest, r.y + r.h); });
    if (lowest >= PLAYER_Y - 2) {
      if (state === 'play') { s.lives = 0; killPlayer(); }
      else { buildWave(); buildShields(); }
      return;
    }
    if (lowest > PLAYER_Y - 48) { // eat shields they touch
      s.shields.forEach(function (p) {
        if (!p.a) return;
        for (var k = 0; k < alive.length; k++) { if (hit({ x: p.x, y: p.y, w: 2, h: 2 }, invPos(alive[k]))) { p.a = false; break; } }
      });
    }

    // invader bombs
    s.fireT -= dt;
    var maxBombs = Math.min(4, 1 + s.wave);
    if (s.fireT <= 0 && s.bombs.length < maxBombs) {
      var cols = {};
      alive.forEach(function (q) { if (!cols[q.c] || q.r > cols[q.c].r) cols[q.c] = q; });
      var shooters = Object.keys(cols).map(function (k) { return cols[k]; });
      var sh = shooters[Math.floor(Math.random() * shooters.length)], rr = invPos(sh);
      s.bombs.push({ x: rr.x + rr.w / 2 - 1, y: rr.y + rr.h, w: 3, h: 7, z: 0 });
      s.fireT = Math.max(.35, 1.1 - s.wave * .1) * (state === 'play' ? 1 : 1.6) * (.6 + Math.random() * .8);
    }
    var bombSpeed = 120 + s.wave * 14;
    var pr = { x: pl.x + 1, y: PLAYER_Y + 2, w: 24, h: 14 };
    for (i = s.bombs.length - 1; i >= 0; i--) {
      var b = s.bombs[i]; b.y += bombSpeed * dt; b.z += dt;
      if (b.y > H) { s.bombs.splice(i, 1); continue; }
      if (hitShield(b)) { s.bombs.splice(i, 1); continue; }
      if (s.shot && hit(b, s.shot)) { s.bombs.splice(i, 1); s.shot = null; boom(b.x, b.y, C.white, 5); continue; }
      if (hit(b, pr)) {
        s.bombs.splice(i, 1);
        if (state === 'play') { s.lives--; killPlayer(); return; }
        boom(pl.x + 13, PLAYER_Y + 8, C.green, 14);
      }
    }
    if (state === 'play') {
      if (s.score > hi) { hi = s.score; saveHi(); }
      hud();
    }
  }
  function gameOver() {
    myRank = 0; lbMsg = '';
    if (qualifies(s.score)) {
      var last3 = 'AAA';
      try { last3 = localStorage.getItem('mo-invaders-name') || 'AAA'; } catch (e) {}
      entry = { chars: last3.split('').map(function (c) { return Math.max(0, CHARSET.indexOf(c)); }), pos: 0 };
      state = 'entry';
    } else {
      state = 'over'; cab.classList.remove('is-live');
      if (!board) lbMsg = '';
      else if (s.score > 0) lbMsg = 'TOP 10 NEEDS ' + pad(board[board.length - 1].score + 10);
    }
  }
  function confirmEntry() {
    var name = entry.chars.map(function (i) { return CHARSET[i]; }).join('');
    try { localStorage.setItem('mo-invaders-name', name); } catch (e) {}
    entry = null; state = 'over'; cab.classList.remove('is-live');
    submitScore(name);
  }
  function killPlayer() {
    boom(s.player.x + 13, PLAYER_Y + 8, C.green, 26);
    state = 'dying'; s.dieTimer = 1.2; s.shot = null; s.bombs = [];
    hud();
  }

  /* ---------- draw ---------- */
  function text(str, x, y, size, color, align) {
    ctx.font = size + 'px ' + FONT; ctx.fillStyle = color; ctx.textAlign = align || 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(str, x, y);
  }
  function draw(now) {
    ctx.fillStyle = C.bg; ctx.fillRect(0, 0, W, H);
    // ground line
    ctx.fillStyle = '#2a2a6a'; ctx.fillRect(0, H - 8, W, 2);

    var i;
    // shields
    ctx.fillStyle = C.green;
    for (i = 0; i < s.shields.length; i++) if (s.shields[i].a) ctx.fillRect(s.shields[i].x, s.shields[i].y, 2, 2);
    // invaders
    s.inv.forEach(function (v) {
      if (!v.alive) return;
      var r = invPos(v), row = ROWS[v.r];
      drawSprite(SPR[row.k][s.frame], r.x, r.y, row.c);
    });
    // ufo
    if (s.ufo) drawSprite(SPR.ufo, s.ufo.x, 16, C.red);
    // player
    if (state !== 'dying') drawSprite(SPR.ship, s.player.x, PLAYER_Y + 2, C.green);
    // shots
    if (s.shot) { ctx.fillStyle = C.white; ctx.fillRect(s.shot.x, s.shot.y, s.shot.w, s.shot.h); }
    ctx.fillStyle = C.yellow;
    s.bombs.forEach(function (b) {
      var zig = Math.floor(b.z * 12) % 2 ? 1 : -1;
      ctx.fillRect(b.x, b.y, 2, 2); ctx.fillRect(b.x + zig, b.y + 2, 2, 2); ctx.fillRect(b.x, b.y + 4, 2, 3);
    });
    // particles
    s.parts.forEach(function (p) { ctx.fillStyle = p.c; ctx.globalAlpha = Math.max(0, p.t * 2); ctx.fillRect(p.x, p.y, 3, 3); });
    ctx.globalAlpha = 1;

    var blinkOn = Math.floor(now / 500) % 2 === 0;
    var showBoard = board && board.length && Math.floor(now / 7000) % 2 === 1;
    if (state === 'attract' && showBoard) {
      drawBoard(now, 0);
      if (blinkOn) text('CLICK OR PRESS ENTER', W / 2, H - 22, 8, C.cyan);
    } else if (state === 'attract') {
      ctx.fillStyle = 'rgba(5,5,15,.55)'; ctx.fillRect(0, H / 2 - 36, W, 72);
      text('BUG BLASTER', W / 2, H / 2 - 16, 12, C.yellow);
      if (blinkOn) text('CLICK OR PRESS ENTER', W / 2, H / 2 + 12, 8, C.cyan);
    } else if (state === 'entry') {
      ctx.fillStyle = 'rgba(5,5,15,.85)'; ctx.fillRect(0, 0, W, H);
      text('NEW HIGH SCORE!', W / 2, 56, 14, blinkOn ? C.yellow : C.magenta);
      text(pad(s.score), W / 2, 86, 12, C.green);
      text('ENTER YOUR INITIALS', W / 2, 124, 8, C.cyan);
      for (var e = 0; e < 3; e++) {
        var ex = W / 2 - 60 + e * 60;
        text(CHARSET[entry.chars[e]], ex, 172, 28, e === entry.pos ? C.yellow : C.white);
        if (e === entry.pos) {
          text('\u25b2', ex, 140, 8, C.muted); text('\u25bc', ex, 204, 8, C.muted);
          if (blinkOn) { ctx.fillStyle = C.yellow; ctx.fillRect(ex - 16, 196, 32, 3); }
        }
      }
      text('\u25b2\u25bc LETTER   \u25c0\u25b6 MOVE', W / 2, 244, 7, C.muted);
      text('TYPE OR PRESS ENTER TO SAVE', W / 2, 264, 7, C.muted);
    } else if (state === 'paused') {
      ctx.fillStyle = 'rgba(5,5,15,.6)'; ctx.fillRect(0, 0, W, H);
      text('PAUSED', W / 2, H / 2 - 8, 14, C.yellow);
      text('CLICK OR PRESS P', W / 2, H / 2 + 16, 8, C.cyan);
    } else if (state === 'over' && board && board.length) {
      drawBoard(now, myRank);
      text('GAME OVER  \u00b7  ' + pad(s.score), W / 2, H - 40, 8, C.red);
      if (lbMsg) text(lbMsg, W / 2, H - 56, 7, C.green);
      if (blinkOn) text('PRESS ENTER TO RETRY', W / 2, H - 22, 8, C.cyan);
    } else if (state === 'over') {
      ctx.fillStyle = 'rgba(5,5,15,.65)'; ctx.fillRect(0, 0, W, H);
      text('GAME OVER', W / 2, H / 2 - 22, 16, C.red);
      text('SCORE ' + pad(s.score) + (s.score >= hi && s.score > 0 ? '  NEW HI!' : ''), W / 2, H / 2 + 4, 8, C.green);
      if (lbMsg) text(lbMsg, W / 2, H / 2 + 22, 7, C.green);
      if (blinkOn) text('PRESS ENTER TO RETRY', W / 2, H / 2 + 42, 8, C.cyan);
    } else if (state === 'play' && s.banner > 0) {
      text('WAVE ' + s.wave, W / 2, H / 2 + 30, 12, C.yellow);
    }
  }
  function drawBoard(now, highlight) {
    ctx.fillStyle = 'rgba(5,5,15,.88)'; ctx.fillRect(0, 0, W, H);
    text('\u2605 TOP 10 \u2605', W / 2, 22, 12, C.yellow);
    var rowColors = [C.yellow, C.cyan, C.magenta];
    for (var i = 0; i < 10; i++) {
      var y = 50 + i * 19, row = board[i];
      var col = row ? rowColors[Math.min(i, 2)] : C.muted;
      if (i >= 3 && row) col = C.white;
      if (highlight === i + 1) col = Math.floor(now / 250) % 2 ? C.green : C.white;
      var rank = (i + 1 < 10 ? ' ' : '') + (i + 1) + '.';
      text(rank, 70, y, 8, col, 'right');
      text(row ? row.name : '---', 96, y, 8, col, 'left');
      text(row ? pad(row.score) : '----', 240, y, 8, col, 'right');
      text(row ? 'W' + row.wave : '', 312, y, 8, row ? C.muted : C.muted, 'right');
    }
  }

  /* ---------- loop (only runs while visible) ---------- */
  var last = 0, raf = 0, onScreen = true;
  function frame(now) {
    raf = 0;
    var dt = Math.min(0.05, (now - last) / 1000 || 0); last = now;
    if (state !== 'paused' && state !== 'over' && state !== 'entry') update(dt);
    else if (s.parts.length) update(0);
    draw(now);
    schedule();
  }
  function schedule() {
    if (!raf && onScreen && !document.hidden) raf = requestAnimationFrame(function (t) { if (!last) last = t; frame(t); });
  }
  if ('IntersectionObserver' in window) {
    new IntersectionObserver(function (ents) {
      onScreen = ents[0].isIntersecting;
      if (!onScreen && state === 'play') pause();
      if (onScreen) { last = 0; schedule(); }
    }).observe(cab);
  }
  document.addEventListener('visibilitychange', function () {
    if (document.hidden && state === 'play') pause();
    last = 0; schedule();
  });

  /* ---------- controls ---------- */
  function start() {
    newGame(); state = 'play'; myRank = 0; lbMsg = '';
    cab.classList.add('is-live'); cab.focus({ preventScroll: true });
    gameToken = null;
    api('/start', {}).then(function (j) { gameToken = j.token; }).catch(function () {});
    if (!board) loadBoard();
  }
  function pause() { state = 'paused'; cab.classList.remove('is-live'); keys = {}; }
  function resume() { state = 'play'; cab.classList.add('is-live'); last = 0; }

  cab.addEventListener('click', function () {
    if (state === 'attract' || state === 'over') start();
    else if (state === 'paused') resume();
  });
  cab.addEventListener('blur', function () { if (state === 'play') pause(); });

  var MAP = { ArrowLeft: 'left', KeyA: 'left', ArrowRight: 'right', KeyD: 'right', Space: 'fire', ArrowUp: 'fire', KeyW: 'fire' };
  cab.addEventListener('keydown', function (e) {
    if (state === 'entry') { entryKey(e); return; }
    var k = MAP[e.code];
    if (k || e.code === 'Enter' || e.code === 'KeyP') e.preventDefault(); // keep the page from scrolling while playing
    if (e.code === 'Enter' || (e.code === 'Space' && (state === 'attract' || state === 'over'))) {
      if (state === 'attract' || state === 'over') { start(); return; }
      if (state === 'paused') { resume(); return; }
    }
    if (e.code === 'KeyP' || e.code === 'Escape') {
      if (state === 'play') pause(); else if (state === 'paused') resume();
      return;
    }
    if (k && state === 'play') keys[k] = true;
  });
  cab.addEventListener('keyup', function (e) { var k = MAP[e.code]; if (k) keys[k] = false; });

  function entryKey(e) {
    var n = CHARSET.length, c = entry.chars, p = entry.pos;
    var typed = e.key && e.key.length === 1 ? CHARSET.indexOf(e.key.toUpperCase()) : -1;
    if (typed >= 0) { c[p] = typed; entry.pos = Math.min(2, p + 1); }
    else if (e.code === 'ArrowUp' || e.code === 'KeyW') c[p] = (c[p] + 1) % n;
    else if (e.code === 'ArrowDown' || e.code === 'KeyS') c[p] = (c[p] - 1 + n) % n;
    else if (e.code === 'ArrowLeft' || e.code === 'Backspace') entry.pos = Math.max(0, p - 1);
    else if (e.code === 'ArrowRight' || e.code === 'Space') entry.pos = Math.min(2, p + 1);
    else if (e.code === 'Enter') confirmEntry();
    else return;
    e.preventDefault();
  }

  /* ---------- boot ---------- */
  newGame();
  state = 'attract';
  s.lives = 3; hud();
  schedule();
  loadBoard();
  // re-draw once the pixel font arrives so canvas text uses it
  if (document.fonts && document.fonts.load) document.fonts.load('10px "Press Start 2P"').then(function () { last = 0; schedule(); });
})();
