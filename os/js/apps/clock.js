/* YohannOS — Horloge (horloge mondiale, chronomètre, minuteur, alarmes) */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const CITIES = [['Lille', 'Europe/Paris'], ['Londres', 'Europe/London'], ['New York', 'America/New_York'], ['Montréal', 'America/Toronto'], ['Tokyo', 'Asia/Tokyo'], ['Sydney', 'Australia/Sydney'], ['Dubaï', 'Asia/Dubai'], ['Los Angeles', 'America/Los_Angeles']];

  /* État global : continue même fenêtre fermée */
  const S = {
    sw: { running: false, start: 0, acc: 0, laps: [] },
    timer: { running: false, end: 0, remaining: 5 * 60000, total: 5 * 60000 },
    alarms: U.store.get('alarms', [])
  };
  setInterval(() => {
    if (S.timer.running && Date.now() >= S.timer.end) {
      S.timer.running = false; S.timer.remaining = 0;
      Y.sound.play('alarm');
      Y.notify({ title: 'Minuteur terminé ⏰', body: 'Le temps est écoulé !', app: 'clock', force: true, timeout: 0, actions: [{ label: 'OK', primary: true, action: () => {} }] });
      Y.bus.emit('clock:tick');
    }
    const now = new Date();
    const hm = U.pad(now.getHours()) + ':' + U.pad(now.getMinutes());
    S.alarms.forEach(a => {
      if (a.on && a.time === hm && a.last !== now.toDateString() + hm) {
        a.last = now.toDateString() + hm;
        U.store.set('alarms', S.alarms);
        Y.sound.play('alarm');
        Y.notify({ title: `Alarme ${a.time} ⏰`, body: a.label || 'Réveil !', app: 'clock', force: true, timeout: 0, actions: [{ label: 'Arrêter', primary: true, action: () => {} }] });
      }
    });
  }, 500);

  const fmtMs = (ms, cs = true) => {
    const t = Math.max(0, ms), h = Math.floor(t / 3600000), m = Math.floor(t / 60000) % 60, s = Math.floor(t / 1000) % 60, c = Math.floor(t / 10) % 100;
    return (h ? h + ':' : '') + U.pad(m) + ':' + U.pad(s) + (cs ? ',' + U.pad(c) : '');
  };

  function launch(args) {
    const tabs = [['world', 'Horloge', 'clock'], ['sw', 'Chronomètre', 'timer'], ['timer', 'Minuteur', 'bell'], ['alarm', 'Alarmes', 'sun']];
    const tabBar = el('div.tabs');
    const body = el('div.ck-body');
    const win = Y.apps.window('clock', { content: el('div.ck', tabBar, body), width: 560, height: 520, minWidth: 360, minHeight: 420 });
    let cur = null, raf = 0;
    tabs.forEach(([id, label, icon]) => tabBar.appendChild(el('button.tab', { dataset: { id }, html: Y.icons.svg(icon, 14) + ' ' + label, onclick: () => show(id) })));

    function show(id) {
      cur = id;
      cancelAnimationFrame(raf);
      tabBar.querySelectorAll('.tab').forEach(t => t.classList.toggle('active', t.dataset.id === id));
      body.innerHTML = '';
      ({ world, sw, timer, alarm })[id]();
    }
    const loop = fn => { const f = () => { if (win.closed) return; fn(); raf = requestAnimationFrame(f); }; f(); };

    /* Horloge mondiale */
    function world() {
      const face = el('div.ck-face', { html: clockSvg() });
      const digital = el('div.ck-digital');
      const date = el('div.ck-date');
      const list = el('div.ck-world');
      CITIES.slice(1).forEach(([name, tz]) => list.appendChild(el('div.ck-city', { dataset: { tz } }, el('div', el('b', name), el('div.dim.ck-off')), el('div.ck-ctime'))));
      body.append(el('div.ck-main', face, el('div', digital, date)), list);
      const hands = { h: face.querySelector('.h'), m: face.querySelector('.m'), s: face.querySelector('.s') };
      loop(() => {
        const d = new Date();
        const ms = d.getMilliseconds(), s = d.getSeconds() + ms / 1000, m = d.getMinutes() + s / 60, h = (d.getHours() % 12) + m / 60;
        hands.s.setAttribute('transform', `rotate(${s * 6} 100 100)`);
        hands.m.setAttribute('transform', `rotate(${m * 6} 100 100)`);
        hands.h.setAttribute('transform', `rotate(${h * 30} 100 100)`);
        digital.textContent = d.toLocaleTimeString('fr-FR');
        date.textContent = U.capitalize(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }));
        list.querySelectorAll('.ck-city').forEach(c => {
          const tz = c.dataset.tz;
          c.querySelector('.ck-ctime').textContent = d.toLocaleTimeString('fr-FR', { timeZone: tz, hour: '2-digit', minute: '2-digit' });
          const local = new Date(d.toLocaleString('en-US', { timeZone: tz })), here = new Date(d.toLocaleString('en-US', { timeZone: 'Europe/Paris' }));
          const diff = Math.round((local - here) / 3600000);
          c.querySelector('.ck-off').textContent = (diff === 0 ? 'Même heure' : (diff > 0 ? '+' : '') + diff + ' h') + ' · ' + d.toLocaleDateString('fr-FR', { timeZone: tz, weekday: 'short' });
        });
      });
    }
    function clockSvg() {
      let ticks = '';
      for (let i = 0; i < 60; i++) {
        const big = i % 5 === 0;
        ticks += `<line x1="100" y1="${big ? 14 : 16}" x2="100" y2="${big ? 26 : 21}" stroke="currentColor" stroke-width="${big ? 3 : 1}" opacity="${big ? .9 : .4}" transform="rotate(${i * 6} 100 100)" stroke-linecap="round"/>`;
      }
      let nums = '';
      for (let i = 1; i <= 12; i++) { const a = (i * 30 - 90) * Math.PI / 180; nums += `<text x="${100 + Math.cos(a) * 64}" y="${100 + Math.sin(a) * 64 + 5}" text-anchor="middle" font-size="14" fill="currentColor" opacity=".8">${i}</text>`; }
      return `<svg viewBox="0 0 200 200"><circle cx="100" cy="100" r="95" fill="var(--bg-hover)" stroke="var(--border-strong)" stroke-width="2"/>${ticks}${nums}
        <line class="h" x1="100" y1="100" x2="100" y2="52" stroke="currentColor" stroke-width="6" stroke-linecap="round"/>
        <line class="m" x1="100" y1="100" x2="100" y2="30" stroke="currentColor" stroke-width="4" stroke-linecap="round"/>
        <line class="s" x1="100" y1="115" x2="100" y2="24" stroke="var(--accent)" stroke-width="2" stroke-linecap="round"/>
        <circle cx="100" cy="100" r="5" fill="var(--accent)"/></svg>`;
    }

    /* Chronomètre */
    function sw() {
      const disp = el('div.ck-big');
      const startBtn = el('button.btn.primary.ck-btn');
      const lapBtn = el('button.btn.ck-btn');
      const laps = el('div.ck-laps');
      body.append(disp, el('div.ck-ctrls', lapBtn, startBtn), laps);
      const elapsed = () => S.sw.acc + (S.sw.running ? Date.now() - S.sw.start : 0);
      const upd = () => {
        startBtn.textContent = S.sw.running ? 'Pause' : (S.sw.acc ? 'Reprendre' : 'Démarrer');
        lapBtn.textContent = S.sw.running ? 'Tour' : 'Réinitialiser';
        lapBtn.disabled = !S.sw.running && !S.sw.acc;
        laps.innerHTML = '';
        const best = S.sw.laps.length > 1 ? Math.min(...S.sw.laps) : null, worst = S.sw.laps.length > 1 ? Math.max(...S.sw.laps) : null;
        S.sw.laps.slice().reverse().forEach((l, i) => laps.appendChild(el('div.ck-lap', { class: l === best ? 'best' : l === worst ? 'worst' : null }, el('span', `Tour ${S.sw.laps.length - i}`), el('span.mono', fmtMs(l)))));
      };
      startBtn.onclick = () => { if (S.sw.running) { S.sw.acc += Date.now() - S.sw.start; S.sw.running = false; } else { S.sw.start = Date.now(); S.sw.running = true; } upd(); };
      lapBtn.onclick = () => {
        if (S.sw.running) { const total = elapsed(); const prev = S.sw.laps.reduce((a, b) => a + b, 0); S.sw.laps.push(total - prev); }
        else { S.sw.acc = 0; S.sw.laps = []; }
        upd();
      };
      upd();
      loop(() => { disp.textContent = fmtMs(elapsed()); });
    }

    /* Minuteur */
    function timer() {
      const ring = el('div.ck-ring', { html: `<svg viewBox="0 0 120 120"><circle cx="60" cy="60" r="52" fill="none" stroke="var(--bg-active)" stroke-width="8"/><circle class="arc" cx="60" cy="60" r="52" fill="none" stroke="var(--accent)" stroke-width="8" stroke-linecap="round" stroke-dasharray="326.7" transform="rotate(-90 60 60)"/></svg>` });
      const disp = el('div.ck-ring-txt');
      ring.appendChild(disp);
      const presets = el('div.ck-presets');
      [['1 min', 1], ['3 min', 3], ['5 min', 5], ['10 min', 10], ['15 min', 15], ['25 min', 25]].forEach(([l, m]) => presets.appendChild(el('button.btn.sm', { onclick: () => { S.timer.running = false; S.timer.remaining = S.timer.total = m * 60000; upd(); } }, l)));
      const custom = el('input.input', { type: 'number', min: 1, max: 999, placeholder: 'min', style: { width: '80px' } });
      custom.addEventListener('change', () => { const m = parseFloat(custom.value); if (m > 0) { S.timer.running = false; S.timer.remaining = S.timer.total = m * 60000; upd(); } });
      presets.appendChild(custom);
      const startBtn = el('button.btn.primary.ck-btn');
      const resetBtn = el('button.btn.ck-btn', 'Réinitialiser');
      body.append(ring, presets, el('div.ck-ctrls', resetBtn, startBtn));
      const arc = ring.querySelector('.arc');
      const remaining = () => S.timer.running ? S.timer.end - Date.now() : S.timer.remaining;
      const upd = () => { startBtn.textContent = S.timer.running ? 'Pause' : 'Démarrer'; startBtn.disabled = remaining() <= 0 && !S.timer.running; };
      startBtn.onclick = () => {
        if (S.timer.running) { S.timer.remaining = S.timer.end - Date.now(); S.timer.running = false; }
        else if (S.timer.remaining > 0) { S.timer.end = Date.now() + S.timer.remaining; S.timer.running = true; }
        upd();
      };
      resetBtn.onclick = () => { S.timer.running = false; S.timer.remaining = S.timer.total; upd(); };
      upd();
      win.listen('clock:tick', upd);
      loop(() => {
        const r = remaining();
        disp.textContent = fmtMs(r, false);
        arc.setAttribute('stroke-dashoffset', 326.7 * (1 - Math.max(0, r) / S.timer.total));
      });
    }

    /* Alarmes */
    function alarm() {
      const list = el('div.ck-alarms');
      const time = el('input.input', { type: 'time', value: '07:30' });
      const label = el('input.input', { placeholder: 'Libellé (facultatif)' });
      const add = el('button.btn.primary', { html: Y.icons.svg('plus', 14) + ' Ajouter' });
      add.onclick = () => { if (!time.value) return; S.alarms.push({ id: U.uid(), time: time.value, label: label.value, on: true }); save(); label.value = ''; };
      body.append(el('div.ck-add', time, label, add), list, el('p.dim.ck-note', 'Les alarmes sonnent tant que YohannOS est ouvert dans un onglet.'));
      function save() { U.store.set('alarms', S.alarms); draw(); }
      function draw() {
        list.innerHTML = '';
        if (!S.alarms.length) list.appendChild(el('div.empty-state', { style: { height: 'auto' } }, 'Aucune alarme'));
        S.alarms.slice().sort((a, b) => a.time.localeCompare(b.time)).forEach(a => {
          const sw = el('label.switch', el('input', { type: 'checkbox' }), el('span'));
          sw.firstChild.checked = a.on;
          sw.firstChild.onchange = () => { a.on = sw.firstChild.checked; save(); };
          list.appendChild(el('div.ck-alarm', { class: a.on ? null : 'off' }, el('div', el('div.ck-alarm-time', a.time), el('div.dim', a.label || 'Alarme')), el('span.grow'), sw,
            el('button.btn.ghost.sm.icon', { title: 'Supprimer', html: Y.icons.svg('trash', 15), onclick: () => { S.alarms = S.alarms.filter(x => x !== a); save(); } })));
        });
      }
      draw();
    }

    win.on('close', () => cancelAnimationFrame(raf));
    show(args.tab || 'world');
    return win;
  }

  Y.apps.register({
    id: 'clock', name: 'Horloge', icon: 'clock', color: ['#614385', '#516395'], category: 'Productivité',
    description: 'Horloge mondiale, chronomètre, minuteur et alarmes', keywords: 'heure timer chrono alarme reveil',
    single: true, launch
  });
})(window.YOS);
