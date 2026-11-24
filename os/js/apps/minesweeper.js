/* YohannOS — Démineur */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const LEVELS = { easy: ['Débutant', 9, 9, 10], medium: ['Intermédiaire', 16, 16, 40], hard: ['Expert', 30, 16, 99] };
  const CELL = 28;

  function launch() {
    let level = U.store.get('mines-level', 'easy');
    let W, H, N, cells, revealed, flags, started, over, t0, timerT, firstClick;
    const counter = el('div.ms-lcd');
    const timer = el('div.ms-lcd');
    const face = el('button.ms-face', { title: 'Nouvelle partie (F2)' });
    const board = el('div.ms-board');
    const lvlBtn = el('button.btn.sm');
    const best = el('span.dim', { style: { fontSize: '12px' } });
    lvlBtn.addEventListener('click', () => Y.menu.showFor(lvlBtn, Object.entries(LEVELS).map(([k, l]) => ({ label: `${l[0]} (${l[1]}×${l[2]}, ${l[3]} mines)`, checked: k === level, action: () => { level = k; U.store.set('mines-level', k); newGame(true); } }))));
    const content = el('div.ms', el('div.toolbar', lvlBtn, el('span.grow'), best), el('div.ms-wrap', el('div.ms-panel', el('div.ms-head', counter, face, timer), board)));
    const win = Y.apps.window('minesweeper', { content, width: 360, height: 460, resizable: false, maximizable: false });

    face.addEventListener('click', () => newGame());

    function newGame(resize) {
      [, W, H, N] = LEVELS[level];
      cells = new Array(W * H).fill(0);   // -1 = mine, sinon nombre de voisins
      revealed = new Uint8Array(W * H);
      flags = new Uint8Array(W * H);
      started = false; over = false; firstClick = true;
      clearInterval(timerT);
      timer.textContent = '000';
      face.textContent = '🙂';
      lvlBtn.innerHTML = Y.icons.svg('sliders', 14) + ' ' + LEVELS[level][0];
      const b = U.store.get('mines-best', {})[level];
      best.textContent = b ? `Record : ${b} s` : 'Pas encore de record';
      board.style.gridTemplateColumns = `repeat(${W}, ${CELL}px)`;
      board.innerHTML = '';
      for (let i = 0; i < W * H; i++) board.appendChild(el('div.ms-cell', { dataset: { i } }));
      updateCounter();
      if (resize) {
        const w = W * (CELL + 2) + 54, h = H * (CELL + 2) + 186;
        win.setSize(w, h);
      }
    }
    const nb = i => {
      const x = i % W, y = Math.floor(i / W), out = [];
      for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
        if (!dx && !dy) continue;
        const nx = x + dx, ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < W && ny < H) out.push(ny * W + nx);
      }
      return out;
    };
    function place(safe) {
      const forbidden = new Set([safe, ...nb(safe)]);
      let n = 0;
      while (n < N) {
        const i = Math.floor(Math.random() * W * H);
        if (cells[i] === -1 || forbidden.has(i)) continue;
        cells[i] = -1; n++;
      }
      for (let i = 0; i < W * H; i++) if (cells[i] !== -1) cells[i] = nb(i).filter(j => cells[j] === -1).length;
    }
    function startTimer() {
      started = true; t0 = Date.now();
      timerT = setInterval(() => { timer.textContent = String(Math.min(999, Math.floor((Date.now() - t0) / 1000))).padStart(3, '0'); }, 250);
    }
    function updateCounter() { counter.textContent = String(N - flags.reduce((a, b) => a + b, 0)).padStart(3, '0'); }
    const cellEl = i => board.children[i];
    function draw(i) {
      const c = cellEl(i);
      c.className = 'ms-cell';
      c.textContent = '';
      if (revealed[i]) {
        c.classList.add('open');
        if (cells[i] === -1) { c.classList.add('mine'); c.textContent = '💣'; }
        else if (cells[i] > 0) { c.textContent = cells[i]; c.classList.add('n' + cells[i]); }
      } else if (flags[i]) { c.classList.add('flag'); c.textContent = '🚩'; }
    }
    function reveal(i) {
      if (revealed[i] || flags[i]) return;
      if (firstClick) { place(i); firstClick = false; startTimer(); }
      const stack = [i];
      while (stack.length) {
        const k = stack.pop();
        if (revealed[k] || flags[k]) continue;
        revealed[k] = 1; draw(k);
        if (cells[k] === 0) nb(k).forEach(j => !revealed[j] && stack.push(j));
      }
      if (cells[i] === -1) return lose(i);
      checkWin();
    }
    function chord(i) {
      if (!revealed[i] || cells[i] <= 0) return;
      const n = nb(i);
      if (n.filter(j => flags[j]).length !== cells[i]) return;
      n.forEach(j => { if (!revealed[j] && !flags[j]) reveal(j); });
    }
    function toggleFlag(i) {
      if (revealed[i] || over) return;
      flags[i] = flags[i] ? 0 : 1;
      draw(i); updateCounter();
      Y.sound.play('click');
    }
    function lose(i) {
      over = true; clearInterval(timerT);
      face.textContent = '😵';
      for (let k = 0; k < W * H; k++) {
        if (cells[k] === -1 && !flags[k]) { revealed[k] = 1; draw(k); }
        else if (flags[k] && cells[k] !== -1) { const c = cellEl(k); c.textContent = '❌'; c.classList.add('wrong'); }
      }
      cellEl(i).classList.add('boom');
      Y.sound.play('error');
    }
    function checkWin() {
      if (over) return;
      let hidden = 0;
      for (let k = 0; k < W * H; k++) if (!revealed[k]) hidden++;
      if (hidden !== N) return;
      over = true; clearInterval(timerT);
      face.textContent = '😎';
      for (let k = 0; k < W * H; k++) if (cells[k] === -1) { flags[k] = 1; draw(k); }
      updateCounter();
      const secs = Math.floor((Date.now() - t0) / 1000);
      const bests = U.store.get('mines-best', {});
      const record = !bests[level] || secs < bests[level];
      if (record) { bests[level] = secs; U.store.set('mines-best', bests); best.textContent = `Record : ${secs} s`; }
      Y.sound.play('success');
      Y.notify({ title: record ? 'Nouveau record ! 🏆' : 'Gagné ! 🎉', body: `${LEVELS[level][0]} terminé en ${secs} s.`, app: 'minesweeper' });
    }

    let pressT = 0, longPressed = false;
    board.addEventListener('pointerdown', e => {
      const c = e.target.closest('.ms-cell');
      if (!c || over) return;
      if (e.button === 0) face.textContent = '😮';
      if (e.pointerType === 'touch') { longPressed = false; pressT = setTimeout(() => { longPressed = true; toggleFlag(+c.dataset.i); }, 420); }
    });
    board.addEventListener('pointerup', e => {
      clearTimeout(pressT);
      if (!over) face.textContent = '🙂';
      const c = e.target.closest('.ms-cell');
      if (!c || over || longPressed) return;
      const i = +c.dataset.i;
      if (e.button === 0) { revealed[i] ? chord(i) : reveal(i); }
      else if (e.button === 1) chord(i);
    });
    board.addEventListener('pointerleave', () => { clearTimeout(pressT); if (!over) face.textContent = '🙂'; });
    board.addEventListener('contextmenu', e => { e.preventDefault(); const c = e.target.closest('.ms-cell'); if (c) toggleFlag(+c.dataset.i); });
    win.el.addEventListener('keydown', e => { if (e.key === 'F2') { e.preventDefault(); newGame(); } });
    win.on('close', () => clearInterval(timerT));
    newGame(true);
    return win;
  }

  Y.apps.register({
    id: 'minesweeper', name: 'Démineur', icon: 'bomb', color: ['#9be15d', '#00a383'], category: 'Jeux',
    description: 'Trouve les mines sans les faire exploser', keywords: 'jeu mines game',
    launch
  });
})(window.YOS);
