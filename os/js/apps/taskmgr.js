/* YohannOS — Gestionnaire des tâches (processus, performances, applis) */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const SERIES = { cpu: { light: '#2a78d6', dark: '#3987e5' }, mem: { light: '#eb6834', dark: '#d95926' } };
  const HEAVY = { breakout: 18, snake: 10, synth: 14, codestudio: 8, browser: 9, paint: 6, minesweeper: 3 };

  /* Mesures (fréquence d'images → charge estimée du thread principal) */
  const M = { fps: 60, cpu: [], mem: [], frames: 0, last: performance.now(), running: false };
  function sampler() {
    if (M.running) return;
    M.running = true;
    M.frames = 0; M.last = performance.now();
    const frame = () => { if (!M.running) return; M.frames++; requestAnimationFrame(frame); };
    requestAnimationFrame(frame);
    M.timer = setInterval(() => {
      const now = performance.now();
      const fps = M.frames * 1000 / (now - M.last);
      M.frames = 0; M.last = now;
      M.fps = document.hidden ? M.fps : Math.min(60, fps);
      const wins = Y.wm.list();
      const base = wins.reduce((s, w) => s + (w.isVisible() ? (HEAVY[w.app] || 1.5) * (w.isFocused() ? 1 : 0.4) : 0.2), 2);
      const cpu = U.clamp((1 - M.fps / 60) * 100 + base + Math.random() * 4, 1, 100);
      M.cpu.push(cpu); if (M.cpu.length > 60) M.cpu.shift();
      M.mem.push(memory()); if (M.mem.length > 60) M.mem.shift();
      Y.bus.emit('taskmgr:tick');
    }, 1000);
  }
  function stopSampler() { M.running = false; clearInterval(M.timer); M.cpu = []; M.mem = []; }
  function memory() {
    if (performance.memory) return performance.memory.usedJSHeapSize / 1048576;
    return (document.getElementsByTagName('*').length * 600 + U.store.size()) / 1048576 + 8;
  }
  const memLabel = () => performance.memory ? 'Mémoire JS (tas)' : 'Mémoire (estimée)';

  /* Graphique linéaire simple, une seule série, avec survol */
  function lineChart(canvas, getData, opts) {
    const tip = el('div.tm-tip.hidden');
    canvas.parentNode.appendChild(tip);
    let hover = null;
    canvas.addEventListener('pointermove', e => { const r = canvas.getBoundingClientRect(); hover = { x: e.clientX - r.left, y: e.clientY - r.top }; draw(); });
    canvas.addEventListener('pointerleave', () => { hover = null; tip.classList.add('hidden'); draw(); });
    function draw() {
      const data = getData();
      const dpr = window.devicePixelRatio || 1;
      const w = canvas.clientWidth, h = canvas.clientHeight;
      if (!w || !h) return;
      if (canvas.width !== Math.round(w * dpr)) { canvas.width = Math.round(w * dpr); canvas.height = Math.round(h * dpr); }
      const c = canvas.getContext('2d');
      c.setTransform(dpr, 0, 0, dpr, 0, 0);
      c.clearRect(0, 0, w, h);
      const css = getComputedStyle(document.documentElement);
      const muted = css.getPropertyValue('--fg-faint').trim(), grid = css.getPropertyValue('--border').trim();
      const color = SERIES[opts.series][Y.settings.effectiveTheme() === 'dark' ? 'dark' : 'light'];
      const padL = 36, padB = 18, padT = 6, pw = w - padL - 4, ph = h - padB - padT;
      const max = opts.max ? opts.max() : 100;
      c.font = '11px ' + css.getPropertyValue('--font');
      c.fillStyle = muted; c.strokeStyle = grid; c.lineWidth = 1;
      for (let i = 0; i <= 2; i++) {
        const y = padT + ph * (i / 2);
        c.beginPath(); c.moveTo(padL, Math.round(y) + 0.5); c.lineTo(w - 4, Math.round(y) + 0.5); c.stroke();
        c.textAlign = 'right'; c.textBaseline = 'middle';
        c.fillText(opts.fmtAxis(max * (1 - i / 2)), padL - 6, y);
      }
      c.textAlign = 'left'; c.textBaseline = 'top'; c.fillText('60 s', padL, h - padB + 4);
      c.textAlign = 'right'; c.fillText('maintenant', w - 4, h - padB + 4);
      if (data.length < 2) return;
      const X = i => padL + pw * ((60 - data.length + i) / 59);
      const Yv = v => padT + ph * (1 - Math.min(v, max) / max);
      c.beginPath();
      data.forEach((v, i) => i ? c.lineTo(X(i), Yv(v)) : c.moveTo(X(i), Yv(v)));
      c.lineTo(X(data.length - 1), padT + ph); c.lineTo(X(0), padT + ph); c.closePath();
      c.globalAlpha = 0.16; c.fillStyle = color; c.fill(); c.globalAlpha = 1;
      c.beginPath();
      data.forEach((v, i) => i ? c.lineTo(X(i), Yv(v)) : c.moveTo(X(i), Yv(v)));
      c.strokeStyle = color; c.lineWidth = 2; c.lineJoin = 'round'; c.stroke();
      // survol : réticule + info-bulle
      if (hover && hover.x >= padL) {
        let idx = Math.round((hover.x - padL) / pw * 59) - (60 - data.length);
        idx = U.clamp(idx, 0, data.length - 1);
        const x = X(idx), y = Yv(data[idx]);
        c.strokeStyle = muted; c.lineWidth = 1; c.setLineDash([3, 3]);
        c.beginPath(); c.moveTo(Math.round(x) + 0.5, padT); c.lineTo(Math.round(x) + 0.5, padT + ph); c.stroke(); c.setLineDash([]);
        c.beginPath(); c.arc(x, y, 4.5, 0, Math.PI * 2); c.fillStyle = color; c.fill();
        c.lineWidth = 2; c.strokeStyle = css.getPropertyValue('--bg-win-solid').trim(); c.stroke();
        const ago = data.length - 1 - idx;
        tip.innerHTML = `<b>${opts.fmtTip(data[idx])}</b><span>${ago ? `il y a ${ago} s` : 'maintenant'}</span>`;
        tip.classList.remove('hidden');
        tip.style.left = U.clamp(x + 10, 0, w - tip.offsetWidth) + 'px';
        tip.style.top = Math.max(0, y - 40) + 'px';
      }
    }
    return draw;
  }

  let pidCounter = 4000;
  const pids = new WeakMap();
  const pidOf = w => { if (!pids.has(w)) pids.set(w, ++pidCounter); return pids.get(w); };

  function launch() {
    sampler();
    const tabBar = el('div.tabs');
    const body = el('div.tm-body');
    const win = Y.apps.window('taskmgr', { content: el('div.tm', tabBar, body), width: 760, height: 540, minWidth: 420, minHeight: 360 });
    let cur = 'proc', selected = null, redraw = null;
    [['proc', 'Processus', 'listView'], ['perf', 'Performances', 'activity'], ['apps', 'Applications', 'apps']].forEach(([id, l, ic]) =>
      tabBar.appendChild(el('button.tab', { dataset: { id }, html: Y.icons.svg(ic, 14) + ' ' + l, onclick: () => show(id) })));

    function show(id) {
      cur = id; redraw = null;
      tabBar.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.id === id));
      body.innerHTML = '';
      ({ proc, perf, apps })[id]();
    }

    /* Processus */
    function proc() {
      const table = el('div.tm-table');
      const endBtn = el('button.btn.sm.danger', { disabled: true, onclick: () => { const w = Y.wm.get(selected); if (w) w.close(true); selected = null; } }, 'Fin de tâche');
      const sum = el('span.dim');
      body.append(el('div.toolbar', sum, el('span.grow'), endBtn), table);
      const sys = [['Noyau YohannOS', 'kernel', 0.4, 2.1], ['Gestionnaire de fenêtres', 'wm', 0.6, 3.4], ['Bureau', 'desktop', 0.2, 1.8], ['Barre des tâches', 'taskbar', 0.3, 1.2], ['Service audio', 'audio', 0.1, 0.6], ['Système de fichiers', 'fs', 0.1, Math.max(0.1, U.store.size() / 1048576)]];
      function render() {
        const wins = Y.wm.list();
        const totalCpu = M.cpu[M.cpu.length - 1] || 0;
        const weights = wins.map(w => w.isVisible() ? (HEAVY[w.app] || 1.5) * (w.isFocused() ? 1 : 0.4) : 0.05);
        const sumW = weights.reduce((a, b) => a + b, 0) + 2;
        table.innerHTML = '';
        table.appendChild(el('div.tm-row.head', el('span.n', 'Nom'), el('span', 'PID'), el('span', 'État'), el('span', 'Processeur'), el('span', 'Mémoire')));
        wins.forEach((w, i) => {
          const app = Y.apps.get(w.app) || { icon: 'monitor', color: null };
          const cpu = totalCpu * weights[i] / sumW;
          const mem = w.el.getElementsByTagName('*').length * 0.012 + 1.5;
          const row = el('div.tm-row', { class: selected === w.id ? 'sel' : null },
            el('span.n', { html: Y.icons.tile(app.icon, app.color, 20) }, el('span', w.title)),
            el('span.mono', String(pidOf(w))), el('span', w.minimized ? 'Réduite' : w.isFocused() ? 'Active' : 'Ouverte'),
            el('span.mono', cpu.toFixed(1) + ' %'), el('span.mono', mem.toFixed(1) + ' Mo'));
          row.style.setProperty('--load', Math.min(1, cpu / 25));
          row.addEventListener('click', () => { selected = w.id; render(); });
          row.addEventListener('dblclick', () => w.focus());
          row.addEventListener('contextmenu', e => { e.preventDefault(); Y.menu.show(e.clientX, e.clientY, [{ label: 'Basculer vers', icon: 'arrowRight', action: () => w.focus() }, { label: 'Réduire', icon: 'minus', action: () => w.minimize() }, '-', { label: 'Fin de tâche', icon: 'x', danger: true, action: () => w.close(true) }]); });
          table.appendChild(row);
        });
        table.appendChild(el('div.tm-group', 'Processus système'));
        sys.forEach(([n, id, c, m]) => table.appendChild(el('div.tm-row.sys', el('span.n', { html: Y.icons.svg('cpu', 16) }, el('span', n)), el('span.mono', String(sys.findIndex(s => s[1] === id) + 1)), el('span', 'Service'), el('span.mono', (c + Math.random() * 0.3).toFixed(1) + ' %'), el('span.mono', m.toFixed(1) + ' Mo'))));
        endBtn.disabled = !selected || !Y.wm.get(selected) || Y.wm.get(selected) === win;
        sum.textContent = `${wins.length} fenêtre(s) · charge ${Math.round(totalCpu)} % · ${M.fps.toFixed(0)} i/s`;
      }
      render();
      redraw = render;
    }

    /* Performances */
    function perf() {
      const card = (title, sub, id) => {
        const cv = el('canvas.tm-chart', { role: 'img', 'aria-label': title });
        const val = el('span.tm-val');
        const box = el('div.tm-chartbox', cv);
        const c = el('div.card.tm-perf', el('div.tm-perf-head', el('div', el('b', title), el('div.dim', sub)), val), box);
        return { c, cv, val, id };
      };
      const cpu = card('Charge processeur', 'Estimée d\'après la fluidité de l\'affichage', 'cpu');
      const mem = card(memLabel(), performance.memory ? 'Tas JavaScript utilisé' : 'D\'après le DOM et le stockage', 'mem');
      const stats = el('div.tm-stats');
      body.append(el('div.tm-perf-grid.scroll', cpu.c, mem.c, stats));
      const drawCpu = lineChart(cpu.cv, () => M.cpu, { series: 'cpu', fmtAxis: v => Math.round(v) + '%', fmtTip: v => v.toFixed(1) + ' %' });
      const memMax = () => Math.max(16, Math.ceil(Math.max(...M.mem, 1) * 1.3 / 8) * 8);
      const drawMem = lineChart(mem.cv, () => M.mem, { series: 'mem', max: memMax, fmtAxis: v => Math.round(v) + ' Mo', fmtTip: v => v.toFixed(1) + ' Mo' });
      const stat = (k, v) => el('div.tm-stat', el('div.dim', k), el('b', v));
      function render() {
        drawCpu(); drawMem();
        cpu.val.textContent = M.cpu.length ? Math.round(M.cpu[M.cpu.length - 1]) + ' %' : '…';
        mem.val.textContent = M.mem.length ? M.mem[M.mem.length - 1].toFixed(1) + ' Mo' : '…';
        stats.innerHTML = '';
        stats.append(
          stat('Images / seconde', M.fps.toFixed(0)), stat('Fenêtres', String(Y.wm.list().length)), stat('Nœuds DOM', String(document.getElementsByTagName('*').length)),
          stat('Actif depuis', U.formatDuration(Date.now() - Y.startTime)), stat('Stockage local', U.formatBytes(U.store.size())), stat('Cœurs logiques', String(navigator.hardwareConcurrency || '?')));
      }
      render();
      redraw = render;
    }

    /* Applications installées */
    function apps() {
      const list = el('div.tm-apps.scroll');
      Y.apps.CATEGORIES.forEach(cat => {
        const items = Y.apps.list().filter(a => a.category === cat);
        if (!items.length) return;
        list.appendChild(el('div.tm-group', cat));
        items.forEach(a => {
          const running = Y.wm.byApp(a.id).length;
          list.appendChild(el('div.tm-app', { html: Y.icons.tile(a.icon, a.color, 32) },
            el('div.grow', el('b', a.name), el('div.dim', a.description || '')),
            running ? el('span.badge', `${running} ouverte${running > 1 ? 's' : ''}`) : null,
            el('button.btn.sm', { onclick: () => Y.apps.launch(a.id) }, 'Ouvrir')));
        });
      });
      body.appendChild(list);
    }

    win.listen('taskmgr:tick', () => redraw && redraw());
    win.on('resize', () => cur === 'perf' && redraw && redraw());
    win.on('close', () => { if (!Y.wm.byApp('taskmgr').some(w => w !== win)) stopSampler(); });
    show('proc');
    return win;
  }

  Y.apps.register({
    id: 'taskmgr', name: 'Gestionnaire des tâches', icon: 'activity', color: ['#11998e', '#38ef7d'], category: 'Système',
    description: 'Processus et performances', keywords: 'processus performance cpu memoire task manager',
    single: true, launch
  });
})(window.YOS);
