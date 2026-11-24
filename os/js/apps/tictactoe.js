/* YohannOS — Morpion (2 joueurs ou contre l'IA minimax) */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const LINES = [[0, 1, 2], [3, 4, 5], [6, 7, 8], [0, 3, 6], [1, 4, 7], [2, 5, 8], [0, 4, 8], [2, 4, 6]];

  function winner(b) {
    for (const l of LINES) if (b[l[0]] && b[l[0]] === b[l[1]] && b[l[0]] === b[l[2]]) return { p: b[l[0]], line: l };
    return b.every(Boolean) ? { p: 'draw' } : null;
  }
  function minimax(b, player, depth) {
    const w = winner(b);
    if (w) return { score: w.p === 'O' ? 10 - depth : w.p === 'X' ? depth - 10 : 0 };
    let best = { score: player === 'O' ? -Infinity : Infinity, move: -1 };
    for (let i = 0; i < 9; i++) {
      if (b[i]) continue;
      b[i] = player;
      const r = minimax(b, player === 'O' ? 'X' : 'O', depth + 1);
      b[i] = null;
      if ((player === 'O' && r.score > best.score) || (player === 'X' && r.score < best.score)) best = { score: r.score, move: i };
    }
    return best;
  }

  function launch() {
    let board, turn, mode = U.store.get('ttt-mode', 'medium'), over, scores = U.store.get('ttt-scores', { X: 0, O: 0, draw: 0 });
    const cells = [];
    const grid = el('div.ttt-grid');
    for (let i = 0; i < 9; i++) { const c = el('button.ttt-cell', { dataset: { i } }); c.addEventListener('click', () => play(i)); cells.push(c); grid.appendChild(c); }
    const status = el('div.ttt-status');
    const sX = el('b'), sO = el('b'), sD = el('b');
    const modeSel = el('select.select', el('option', { value: 'easy' }, 'Contre l\'IA — facile'), el('option', { value: 'medium' }, 'Contre l\'IA — moyen'), el('option', { value: 'hard' }, 'Contre l\'IA — imbattable'), el('option', { value: 'pvp' }, '2 joueurs'));
    modeSel.value = mode;
    modeSel.onchange = () => { mode = modeSel.value; U.store.set('ttt-mode', mode); reset(); };
    const content = el('div.ttt',
      el('div.toolbar', modeSel, el('span.grow'), el('button.btn.sm', { onclick: () => reset() }, 'Nouvelle partie'), el('button.btn.sm.ghost', { onclick: () => { scores = { X: 0, O: 0, draw: 0 }; U.store.set('ttt-scores', scores); renderScores(); } }, 'RAZ scores')),
      el('div.ttt-scores', el('div.ttt-score.x', el('span', 'X'), sX), el('div.ttt-score', el('span', 'Nuls'), sD), el('div.ttt-score.o', el('span', 'O'), sO)),
      status, grid);
    const win = Y.apps.window('tictactoe', { content, width: 420, height: 580, minWidth: 320, minHeight: 480 });

    function renderScores() { sX.textContent = scores.X; sO.textContent = scores.O; sD.textContent = scores.draw; }
    function reset() {
      board = Array(9).fill(null); turn = 'X'; over = false;
      cells.forEach(c => { c.textContent = ''; c.className = 'ttt-cell'; c.disabled = false; });
      grid.classList.remove('done');
      setStatus();
    }
    function setStatus(msg) { status.innerHTML = msg || `Au tour de <b class="${turn === 'X' ? 'x' : 'o'}">${turn}</b>${mode !== 'pvp' && turn === 'O' ? ' (l\'IA réfléchit…)' : ''}`; }
    function play(i) {
      if (over || board[i] || (mode !== 'pvp' && turn === 'O')) return;
      move(i);
      if (!over && mode !== 'pvp') setTimeout(aiMove, 380);
    }
    function move(i) {
      board[i] = turn;
      cells[i].textContent = turn === 'X' ? '✕' : '◯';
      cells[i].classList.add(turn === 'X' ? 'x' : 'o', 'placed');
      Y.sound.play('click');
      const w = winner(board);
      if (w) return end(w);
      turn = turn === 'X' ? 'O' : 'X';
      setStatus();
    }
    function aiMove() {
      if (over) return;
      const free = board.map((v, i) => v ? -1 : i).filter(i => i >= 0);
      let i;
      const smart = mode === 'hard' ? 1 : mode === 'medium' ? 0.65 : 0.15;
      if (Math.random() < smart) i = minimax(board.slice(), 'O', 0).move;
      if (i == null || i < 0) i = U.pick(free);
      move(i);
    }
    function end(w) {
      over = true;
      grid.classList.add('done');
      if (w.p === 'draw') { scores.draw++; setStatus('Match nul 🤝'); }
      else {
        scores[w.p]++;
        w.line.forEach(k => cells[k].classList.add('win'));
        setStatus(mode !== 'pvp' ? (w.p === 'X' ? 'Tu as gagné ! 🎉' : 'L\'IA a gagné 🤖') : `<b class="${w.p === 'X' ? 'x' : 'o'}">${w.p}</b> a gagné ! 🎉`);
        Y.sound.play(w.p === 'X' || mode === 'pvp' ? 'success' : 'error');
      }
      U.store.set('ttt-scores', scores);
      renderScores();
      setTimeout(() => { if (over && !win.closed) { status.appendChild(el('button.btn.sm.primary', { style: { marginLeft: '10px' }, onclick: reset }, 'Rejouer')); } }, 300);
    }
    renderScores(); reset();
    return win;
  }

  Y.apps.register({
    id: 'tictactoe', name: 'Morpion', icon: 'hash', color: ['#a18cd1', '#6d4fa3'], category: 'Jeux',
    description: 'Aligne trois symboles', keywords: 'jeu tic tac toe morpion game ia',
    launch
  });
})(window.YOS);
