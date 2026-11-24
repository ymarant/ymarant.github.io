/* YohannOS — Snake */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const COLS = 24, ROWS = 18;

  function launch() {
    const cv = el('canvas.sn-canvas');
    const ctx = cv.getContext('2d');
    const scoreEl = el('b', '0');
    const bestEl = el('b', String(U.store.get('snake-best', 0)));
    const overlay = el('div.game-overlay');
    const wallsChk = el('input', { type: 'checkbox' });
    wallsChk.checked = U.store.get('snake-walls', true);
    wallsChk.onchange = () => U.store.set('snake-walls', wallsChk.checked);
    const content = el('div.game',
      el('div.game-bar', el('span', 'Score : ', scoreEl), el('span', 'Record : ', bestEl), el('span.grow'), el('label.row', wallsChk, el('span', 'Murs')), el('span.dim', 'Flèches / ZQSD · Espace = pause')),
      el('div.game-stage', cv, overlay));
    const win = Y.apps.window('snake', { content, width: 620, height: 560, minWidth: 360, minHeight: 340 });

    let overAt = 0, snake, dir, nextDirs, food, score, speed, state = 'ready', acc = 0, last = 0, raf = 0, particles = [], bonus = null, cell = 24;

    function reset() {
      snake = [{ x: 8, y: 9 }, { x: 7, y: 9 }, { x: 6, y: 9 }];
      dir = { x: 1, y: 0 }; nextDirs = [];
      score = 0; speed = 8; particles = []; bonus = null;
      scoreEl.textContent = '0';
      placeFood();
    }
    function placeFood() {
      do { food = { x: U.randInt(0, COLS - 1), y: U.randInt(0, ROWS - 1) }; } while (snake.some(s => s.x === food.x && s.y === food.y));
    }
    function showOverlay(title, sub, btn) {
      overlay.innerHTML = '';
      overlay.append(...[el('h2', title), sub ? el('p', sub) : null, btn ? el('button.btn.primary', { onclick: start }, btn) : null].filter(Boolean));
      overlay.classList.remove('hidden');
    }
    function start() {
      if (state === 'over' || state === 'ready') reset();
      state = 'play'; overlay.classList.add('hidden');
      last = performance.now();
      win.el.focus();
    }
    function pause() { if (state === 'play') { state = 'pause'; showOverlay('Pause', 'Appuie sur Espace pour reprendre', 'Reprendre'); } else if (state === 'pause') start(); }
    function gameOver() {
      state = 'over'; overAt = Date.now();
      const best = U.store.get('snake-best', 0);
      if (score > best) { U.store.set('snake-best', score); bestEl.textContent = score; }
      Y.sound.play('error');
      showOverlay('Perdu !', `Score : ${score}${score > best ? ' — nouveau record ! 🏆' : ''}`, 'Rejouer');
    }

    function step() {
      if (nextDirs.length) dir = nextDirs.shift();
      const head = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };
      if (!wallsChk.checked) { head.x = (head.x + COLS) % COLS; head.y = (head.y + ROWS) % ROWS; }
      else if (head.x < 0 || head.y < 0 || head.x >= COLS || head.y >= ROWS) return gameOver();
      if (snake.some((s, i) => i < snake.length - 1 && s.x === head.x && s.y === head.y)) return gameOver();
      snake.unshift(head);
      if (head.x === food.x && head.y === food.y) {
        score += 10; scoreEl.textContent = score;
        speed = Math.min(20, speed + 0.4);
        burst(food, '#ff5c6c');
        Y.sound.play('pop');
        placeFood();
        if (!bonus && Math.random() < 0.25) { let b; do { b = { x: U.randInt(0, COLS - 1), y: U.randInt(0, ROWS - 1), t: 60 }; } while (snake.some(s => s.x === b.x && s.y === b.y) || (b.x === food.x && b.y === food.y)); bonus = b; }
      } else if (bonus && head.x === bonus.x && head.y === bonus.y) {
        score += 50; scoreEl.textContent = score;
        burst(bonus, '#ffcb6b'); bonus = null;
        Y.sound.play('success');
        snake.pop();
      } else snake.pop();
      if (bonus && --bonus.t <= 0) bonus = null;
    }
    function burst(p, color) {
      for (let i = 0; i < 14; i++) particles.push({ x: (p.x + 0.5) * cell, y: (p.y + 0.5) * cell, vx: U.rand(-3, 3), vy: U.rand(-3, 3), life: 1, color });
    }

    function draw() {
      const w = cv.width, h = cv.height;
      const css = getComputedStyle(document.documentElement);
      const accent = css.getPropertyValue('--accent').trim();
      ctx.fillStyle = '#10131c'; ctx.fillRect(0, 0, w, h);
      ctx.fillStyle = 'rgba(255,255,255,.025)';
      for (let x = 0; x < COLS; x++) for (let y = 0; y < ROWS; y++) if ((x + y) % 2) ctx.fillRect(x * cell, y * cell, cell, cell);
      if (wallsChk.checked) { ctx.strokeStyle = 'rgba(255,255,255,.15)'; ctx.lineWidth = 2; ctx.strokeRect(1, 1, w - 2, h - 2); }
      // nourriture
      const pulse = 1 + Math.sin(performance.now() / 150) * 0.08;
      ctx.fillStyle = '#ff5c6c';
      ctx.beginPath(); ctx.arc((food.x + 0.5) * cell, (food.y + 0.5) * cell, cell * 0.36 * pulse, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#3ddc97'; ctx.fillRect((food.x + 0.5) * cell - 1, food.y * cell + cell * 0.08, 3, cell * 0.2);
      if (bonus) { ctx.font = `${cell * 0.8}px sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.globalAlpha = bonus.t < 15 ? (bonus.t % 2 ? 0.3 : 1) : 1; ctx.fillText('⭐', (bonus.x + 0.5) * cell, (bonus.y + 0.55) * cell); ctx.globalAlpha = 1; }
      // serpent
      snake.forEach((s, i) => {
        const t = i / snake.length;
        ctx.fillStyle = i === 0 ? accent : `hsl(${150 - t * 40}, 70%, ${55 - t * 15}%)`;
        const pad = i === 0 ? 1 : 2;
        roundRect(s.x * cell + pad, s.y * cell + pad, cell - pad * 2, cell - pad * 2, cell * 0.3);
      });
      const hd = snake[0];
      ctx.fillStyle = '#fff';
      const ex = dir.y !== 0 ? [0.3, 0.7] : [0.5, 0.5], ey = dir.x !== 0 ? [0.3, 0.7] : [0.5, 0.5];
      for (let k = 0; k < 2; k++) {
        const cx = (hd.x + (dir.x ? 0.5 + dir.x * 0.18 : ex[k])) * cell, cy = (hd.y + (dir.y ? 0.5 + dir.y * 0.18 : ey[k])) * cell;
        ctx.beginPath(); ctx.arc(cx, cy, cell * 0.11, 0, Math.PI * 2); ctx.fill();
      }
      particles.forEach(p => { ctx.globalAlpha = p.life; ctx.fillStyle = p.color; ctx.fillRect(p.x, p.y, 3, 3); });
      ctx.globalAlpha = 1;
    }
    function roundRect(x, y, w, h, r) { ctx.beginPath(); ctx.moveTo(x + r, y); ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r); ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r); ctx.fill(); }

    function loop(t) {
      raf = requestAnimationFrame(loop);
      const dt = Math.min(0.1, (t - last) / 1000); last = t;
      if (state === 'play' && !win.minimized) {
        acc += dt;
        while (acc > 1 / speed && state === 'play') { acc -= 1 / speed; step(); }
      }
      particles.forEach(p => { p.x += p.vx; p.y += p.vy; p.life -= 0.03; });
      particles = particles.filter(p => p.life > 0);
      draw();
    }
    function fit() {
      const stage = cv.parentNode.getBoundingClientRect();
      cell = Math.max(10, Math.floor(Math.min(stage.width / COLS, stage.height / ROWS)));
      cv.width = COLS * cell; cv.height = ROWS * cell;
    }
    const DIRS = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], KeyW: [0, -1], KeyS: [0, 1], KeyA: [-1, 0], KeyD: [1, 0] };
    function turn(d) {
      const ref = nextDirs.length ? nextDirs[nextDirs.length - 1] : dir;
      if (d[0] === -ref.x && d[1] === -ref.y) return;
      if (d[0] === ref.x && d[1] === ref.y) return;
      if (nextDirs.length < 3) nextDirs.push({ x: d[0], y: d[1] });
    }
    win.el.addEventListener('keydown', e => {
      const d = DIRS[e.code];
      if (d) { e.preventDefault(); if (state === 'over') return; if (state === 'ready') start(); turn(d); }
      else if (e.code === 'Space' || e.code === 'KeyP' || e.code === 'Enter') { e.preventDefault(); if (state === 'over' && Date.now() - overAt < 600) return; if (state === 'ready' || state === 'over') start(); else pause(); }
    });
    let touch = null;
    cv.addEventListener('pointerdown', e => { touch = { x: e.clientX, y: e.clientY }; });
    cv.addEventListener('pointerup', e => {
      if (!touch) return;
      const dx = e.clientX - touch.x, dy = e.clientY - touch.y;
      touch = null;
      if (Math.abs(dx) + Math.abs(dy) < 20) return;
      if (state !== 'play') start();
      turn(Math.abs(dx) > Math.abs(dy) ? [Math.sign(dx), 0] : [0, Math.sign(dy)]);
    });
    win.on('resize', fit);
    win.on('blur', () => { if (state === 'play') pause(); });
    win.on('close', () => cancelAnimationFrame(raf));
    reset(); fit();
    showOverlay('🐍 Snake', 'Mange les pommes, évite ta queue. Les ⭐ valent 50 points !', 'Jouer');
    raf = requestAnimationFrame(loop);
    return win;
  }

  Y.apps.register({
    id: 'snake', name: 'Snake', icon: 'snake', color: ['#56ab2f', '#1f6d22'], category: 'Jeux',
    description: 'Le serpent qui grandit', keywords: 'jeu serpent game',
    launch
  });
})(window.YOS);
