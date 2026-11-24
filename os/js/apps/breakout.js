/* YohannOS — Casse-briques (niveaux, bonus, particules) */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const W = 640, H = 480;
  const LEVELS = [
    ['..........', 'AAAAAAAAAA', 'BBBBBBBBBB', 'CCCCCCCCCC', 'DDDDDDDDDD', '..........'],
    ['A........A', 'AB......BA', 'ABC....CBA', 'ABCD..DCBA', 'ABCDEEDCBA', 'SSSSSSSSSS'],
    ['.EEEEEEEE.', 'E.D.D.D.DE', 'EDCDCDCDCE', 'E.D.D.D.DE', '.EEEEEEEE.', 'S.S.S.S.S.'],
    ['AAAA..AAAA', 'BSSB..BSSB', 'CCCC..CCCC', '....EE....', 'DDDDDDDDDD', 'XSXSXSXSXS'],
    ['XXXXXXXXXX', 'X.A.B.C.DX', 'XEEEEEEEEX', 'X.D.C.B.AX', 'XSSSSSSSSX', '..........']
  ];
  const BRICK = { A: ['#ff6b6b', 1], B: ['#ffa94d', 1], C: ['#ffd43b', 1], D: ['#69db7c', 1], E: ['#4dabf7', 2], S: ['#b197fc', 3], X: ['#868e96', Infinity] };
  const POWERS = [['wide', '↔', '#4dabf7'], ['multi', '✦', '#ffd43b'], ['slow', '🐢', '#69db7c'], ['life', '♥', '#ff6b6b'], ['laser', '⚡', '#da77f2']];

  function launch() {
    const cv = el('canvas.bk-canvas', { width: W, height: H });
    const ctx = cv.getContext('2d');
    const scoreEl = el('b', '0'), livesEl = el('b', '3'), levelEl = el('b', '1');
    const bestEl = el('b', String(U.store.get('breakout-best', 0)));
    const overlay = el('div.game-overlay');
    const content = el('div.game', el('div.game-bar', el('span', 'Score : ', scoreEl), el('span', 'Vies : ', livesEl), el('span', 'Niveau : ', levelEl), el('span', 'Record : ', bestEl), el('span.grow'), el('span.dim', 'Souris / ← → · Espace = lancer / pause')), el('div.game-stage', cv, overlay));
    const win = Y.apps.window('breakout', { content, width: 700, height: 600, minWidth: 380, minHeight: 360 });

    let paddle, balls, bricks, drops, particles, lasers, score, lives, level, state = 'ready', raf = 0, last = 0, keys = {}, effects = {}, shake = 0;

    function resetGame() { score = 0; lives = 3; level = 0; loadLevel(); }
    function loadLevel() {
      const L = LEVELS[level % LEVELS.length];
      bricks = [];
      const bw = 58, bh = 20, gap = 4, ox = (W - (10 * bw + 9 * gap)) / 2, oy = 60;
      L.forEach((row, r) => row.split('').forEach((ch, c) => {
        if (BRICK[ch]) bricks.push({ x: ox + c * (bw + gap), y: oy + r * (bh + gap), w: bw, h: bh, type: ch, hp: BRICK[ch][1], max: BRICK[ch][1] });
      }));
      paddle = { x: W / 2 - 50, y: H - 30, w: 100, h: 12 };
      drops = []; particles = []; lasers = []; effects = {};
      resetBall();
      update();
    }
    function resetBall() {
      const sp = 300 + level * 25;
      balls = [{ x: paddle.x + paddle.w / 2, y: paddle.y - 8, r: 7, vx: 0, vy: 0, stuck: true, speed: sp }];
    }
    function launchBall() { balls.forEach(b => { if (b.stuck) { b.stuck = false; const a = U.rand(-0.5, 0.5) - Math.PI / 2; b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed; } }); }
    function update() { scoreEl.textContent = score; livesEl.textContent = lives; levelEl.textContent = level + 1; }
    function showOverlay(title, sub, btn, fn) {
      overlay.innerHTML = '';
      overlay.append(...[el('h2', title), sub ? el('p', sub) : null, btn ? el('button.btn.primary', { onclick: fn }, btn) : null].filter(Boolean));
      overlay.classList.remove('hidden');
    }
    function play() { overlay.classList.add('hidden'); state = 'play'; last = performance.now(); win.el.focus(); }
    function pause() { if (state === 'play') { state = 'pause'; showOverlay('Pause', null, 'Reprendre', play); } else if (state === 'pause') play(); }

    function burst(x, y, color, n = 12) { for (let i = 0; i < n; i++) particles.push({ x, y, vx: U.rand(-160, 160), vy: U.rand(-160, 160), life: 1, color, s: U.rand(2, 4) }); }
    function hitBrick(b, ball) {
      if (b.hp === Infinity) { Y.sound.play('click'); return; }
      b.hp--;
      if (b.hp > 0) { score += 5; Y.sound.play('click'); return; }
      score += 10 * b.max * (level + 1);
      burst(b.x + b.w / 2, b.y + b.h / 2, BRICK[b.type][0], 16);
      bricks.splice(bricks.indexOf(b), 1);
      Y.sound.play('pop');
      shake = 4;
      if (Math.random() < 0.16) { const p = U.pick(POWERS); drops.push({ x: b.x + b.w / 2, y: b.y + b.h / 2, kind: p[0], label: p[1], color: p[2] }); }
      update();
      if (!bricks.some(x => x.hp !== Infinity)) {
        level++;
        state = 'between';
        Y.sound.play('success');
        showOverlay(`Niveau ${level} terminé !`, `Score : ${score}`, 'Niveau suivant', () => { loadLevel(); play(); });
      }
      void ball;
    }
    function power(kind) {
      Y.sound.play('success');
      if (kind === 'wide') { effects.wide = 12; paddle.w = 160; }
      else if (kind === 'slow') { effects.slow = 10; }
      else if (kind === 'life') { lives = Math.min(9, lives + 1); update(); }
      else if (kind === 'laser') { effects.laser = 10; }
      else if (kind === 'multi') {
        const extra = [];
        balls.forEach(b => { if (b.stuck) return; [-0.4, 0.4].forEach(da => { const a = Math.atan2(b.vy, b.vx) + da; extra.push({ x: b.x, y: b.y, r: b.r, speed: b.speed, vx: Math.cos(a) * b.speed, vy: Math.sin(a) * b.speed }); }); });
        balls.push(...extra.slice(0, 6));
      }
    }

    function step(dt) {
      // effets
      for (const k of Object.keys(effects)) { effects[k] -= dt; if (effects[k] <= 0) { delete effects[k]; if (k === 'wide') paddle.w = 100; } }
      const slow = effects.slow ? 0.6 : 1;
      if (keys.ArrowLeft || keys.KeyA) paddle.x -= 520 * dt;
      if (keys.ArrowRight || keys.KeyD) paddle.x += 520 * dt;
      paddle.x = U.clamp(paddle.x, 0, W - paddle.w);
      if (effects.laser) { effects.laserCd = (effects.laserCd || 0) - dt; if (effects.laserCd <= 0 && keys.Space) { lasers.push({ x: paddle.x + 6, y: paddle.y }, { x: paddle.x + paddle.w - 6, y: paddle.y }); effects.laserCd = 0.3; } }
      lasers.forEach(l => { l.y -= 600 * dt; const b = bricks.find(b => l.x > b.x && l.x < b.x + b.w && l.y > b.y && l.y < b.y + b.h); if (b) { l.dead = true; hitBrick(b); } });
      lasers = lasers.filter(l => !l.dead && l.y > 0);
      balls.forEach(b => {
        if (b.stuck) { b.x = paddle.x + paddle.w / 2; b.y = paddle.y - b.r - 1; return; }
        const steps = 4;
        for (let s = 0; s < steps; s++) {
          b.x += b.vx * dt * slow / steps; b.y += b.vy * dt * slow / steps;
          if (b.x < b.r) { b.x = b.r; b.vx = Math.abs(b.vx); }
          if (b.x > W - b.r) { b.x = W - b.r; b.vx = -Math.abs(b.vx); }
          if (b.y < b.r) { b.y = b.r; b.vy = Math.abs(b.vy); }
          // raquette
          if (b.vy > 0 && b.y + b.r >= paddle.y && b.y + b.r <= paddle.y + paddle.h + 8 && b.x >= paddle.x - b.r && b.x <= paddle.x + paddle.w + b.r) {
            const rel = (b.x - (paddle.x + paddle.w / 2)) / (paddle.w / 2);
            const a = -Math.PI / 2 + U.clamp(rel, -1, 1) * 1.1;
            b.speed = Math.min(b.speed * 1.015, 720);
            b.vx = Math.cos(a) * b.speed; b.vy = Math.sin(a) * b.speed;
            b.y = paddle.y - b.r;
            Y.sound.play('click');
          }
          // briques
          for (const br of bricks) {
            const cx = U.clamp(b.x, br.x, br.x + br.w), cy = U.clamp(b.y, br.y, br.y + br.h);
            const dx = b.x - cx, dy = b.y - cy;
            if (dx * dx + dy * dy <= b.r * b.r) {
              const overlapX = Math.min(Math.abs(b.x + b.r - br.x), Math.abs(br.x + br.w - (b.x - b.r)));
              const overlapY = Math.min(Math.abs(b.y + b.r - br.y), Math.abs(br.y + br.h - (b.y - b.r)));
              if (overlapX < overlapY) { b.vx = -b.vx; b.x += b.vx > 0 ? overlapX : -overlapX; }
              else { b.vy = -b.vy; b.y += b.vy > 0 ? overlapY : -overlapY; }
              hitBrick(br, b);
              break;
            }
          }
          if (state !== 'play') return;
        }
        if (b.y > H + 20) b.dead = true;
      });
      balls = balls.filter(b => !b.dead);
      if (!balls.length && state === 'play') {
        lives--; update();
        Y.sound.play('error');
        shake = 10;
        if (lives <= 0) {
          state = 'over';
          const best = U.store.get('breakout-best', 0);
          if (score > best) { U.store.set('breakout-best', score); bestEl.textContent = score; }
          showOverlay('Partie terminée', `Score : ${score}${score > best ? ' — nouveau record ! 🏆' : ''}`, 'Rejouer', () => { resetGame(); play(); });
        } else { paddle.w = 100; effects = {}; resetBall(); }
      }
      drops.forEach(d => {
        d.y += 150 * dt;
        if (d.y > paddle.y && d.y < paddle.y + paddle.h + 10 && d.x > paddle.x && d.x < paddle.x + paddle.w) { d.dead = true; power(d.kind); }
      });
      drops = drops.filter(d => !d.dead && d.y < H + 20);
    }

    function draw() {
      ctx.save();
      if (shake > 0) { ctx.translate(U.rand(-shake, shake), U.rand(-shake, shake)); shake *= 0.85; if (shake < 0.3) shake = 0; }
      const g = ctx.createLinearGradient(0, 0, 0, H); g.addColorStop(0, '#141832'); g.addColorStop(1, '#0a0c18');
      ctx.fillStyle = g; ctx.fillRect(-20, -20, W + 40, H + 40);
      bricks.forEach(b => {
        const [col] = BRICK[b.type];
        ctx.globalAlpha = b.hp === Infinity ? 1 : 0.55 + 0.45 * (b.hp / b.max);
        ctx.fillStyle = col;
        rr(b.x, b.y, b.w, b.h, 4); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(b.x + 3, b.y + 2, b.w - 6, 3);
        if (b.hp > 1 && b.hp !== Infinity) { ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.font = 'bold 11px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(b.hp, b.x + b.w / 2, b.y + b.h / 2 + 1); }
      });
      ctx.globalAlpha = 1;
      const accent = getComputedStyle(document.documentElement).getPropertyValue('--accent').trim();
      ctx.fillStyle = effects.laser ? '#da77f2' : accent;
      ctx.shadowColor = ctx.fillStyle; ctx.shadowBlur = 14;
      rr(paddle.x, paddle.y, paddle.w, paddle.h, 6); ctx.fill();
      ctx.shadowBlur = 0;
      lasers.forEach(l => { ctx.fillStyle = '#f3d9fa'; ctx.fillRect(l.x - 1.5, l.y - 10, 3, 10); });
      balls.forEach(b => { ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10; ctx.beginPath(); ctx.arc(b.x, b.y, b.r, 0, Math.PI * 2); ctx.fill(); ctx.shadowBlur = 0; });
      drops.forEach(d => { ctx.fillStyle = d.color; rr(d.x - 14, d.y - 9, 28, 18, 9); ctx.fill(); ctx.fillStyle = '#111'; ctx.font = 'bold 12px sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(d.label, d.x, d.y + 1); });
      particles.forEach(p => { ctx.globalAlpha = Math.max(0, p.life); ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, p.s, p.s); });
      ctx.globalAlpha = 1;
      // effets actifs
      let ex = 10;
      Object.entries(effects).forEach(([k, v]) => { if (k === 'laserCd') return; const p = POWERS.find(x => x[0] === k); if (!p) return; ctx.fillStyle = p[2]; ctx.font = '12px sans-serif'; ctx.textAlign = 'left'; ctx.fillText(`${p[1]} ${Math.ceil(v)}s`, ex, 24); ex += 60; });
      if (balls.some(b => b.stuck) && state === 'play') { ctx.fillStyle = 'rgba(255,255,255,.7)'; ctx.font = '14px sans-serif'; ctx.textAlign = 'center'; ctx.fillText('Clic ou Espace pour lancer la balle', W / 2, H - 60); }
      ctx.restore();
    }
    function rr(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.closePath(); }

    function loop(t) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.033, (t - last) / 1000); last = t;
      if (state === 'play' && !win.minimized) step(dt);
      particles.forEach(p => { p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 300 * dt; p.life -= dt * 1.5; });
      particles = particles.filter(p => p.life > 0);
      draw();
    }
    cv.addEventListener('pointermove', e => { const r = cv.getBoundingClientRect(); paddle.x = U.clamp((e.clientX - r.left) / r.width * W - paddle.w / 2, 0, W - paddle.w); });
    cv.addEventListener('pointerdown', () => { if (state === 'play') { launchBall(); if (effects.laser) keys.Space = true; } });
    cv.addEventListener('pointerup', () => { keys.Space = false; });
    win.el.addEventListener('keydown', e => {
      keys[e.code] = true;
      if (e.code === 'Space') { e.preventDefault(); if (state === 'play') { if (balls.some(b => b.stuck)) launchBall(); } else if (state === 'ready') play(); }
      if (e.code === 'KeyP' || e.code === 'Escape') pause();
      if (e.code.startsWith('Arrow')) e.preventDefault();
    });
    win.el.addEventListener('keyup', e => { keys[e.code] = false; });
    win.on('blur', () => { keys = {}; if (state === 'play') pause(); });
    win.on('close', () => cancelAnimationFrame(raf));
    resetGame();
    showOverlay('🧱 Casse-briques', 'Détruis toutes les briques ! Attrape les bonus : ↔ raquette large, ✦ multi-balles, 🐢 ralenti, ♥ vie, ⚡ laser (Espace).', 'Jouer', play);
    raf = requestAnimationFrame(loop);
    return win;
  }

  Y.apps.register({
    id: 'breakout', name: 'Casse-briques', icon: 'bricks', color: ['#ff9966', '#ff5e62'], category: 'Jeux',
    description: 'Détruis toutes les briques', keywords: 'jeu briques balle raquette game',
    launch
  });
})(window.YOS);
