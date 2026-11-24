/* =========================================================
   YohannOS — démarrage, verrouillage, arrêt,
   économiseur d'écran
   ========================================================= */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  let bootEl, lockEl, ssCanvas;
  let locked = false, booting = true, firstLogin = true, onReadyCb = null;
  let lastActivity = Date.now(), ssRunning = false, ssRaf = 0, ssStarted = 0;
  let lockClockT = 0;
  let lockKeyHandler = null;

  /* ---------- Démarrage ---------- */
  function start(onReady) {
    onReadyCb = onReady;
    bootEl = document.getElementById('boot');
    lockEl = document.getElementById('lock');
    const quick = Y.settings.get('fastBoot') || sessionStorage.getItem('yos-booted');
    bootEl.classList.remove('hidden');
    bootEl.innerHTML = '';
    const bios = el('div.bios');
    const stage = el('div.logo-stage', el('div.boot-logo', { html: Y.icons.LOGO }), el('div.boot-title', { html: 'Yohann<b>OS</b>' }), el('div.boot-bar', el('i')));
    const hint = el('div.boot-hint', 'Appuyez sur une touche ou cliquez pour passer');
    bootEl.append(bios, stage, hint);
    let skipped = false;
    const skip = () => { skipped = true; };
    bootEl.addEventListener('pointerdown', skip);
    window.addEventListener('keydown', skip, { once: true });

    const lines = [
      ['<span class="hl">YohannOS BIOS v2.0</span>  —  (c) 2024-2026 Yohann Marant', 0],
      ['', 0],
      [`Processeur ........ ${navigator.hardwareConcurrency || '?'} cœurs logiques`, 1],
      [`Mémoire ........... ${navigator.deviceMemory ? navigator.deviceMemory + ' Go' : 'inconnue'}  <span class="ok">[OK]</span>`, 1],
      [`Affichage ......... ${screen.width}×${screen.height} @${window.devicePixelRatio || 1}x`, 1],
      [`Langue ............ ${navigator.language || 'fr-FR'}`, 1],
      [`Réseau ............ ${navigator.onLine ? '<span class="ok">connecté</span>' : '<span class="warn">hors ligne</span>'}`, 1],
      ['', 0],
      ['Montage de /home/yohann ............. <span class="ok">[OK]</span>', 1],
      [`Chargement de ${Y.apps.all().length} applications ........ <span class="ok">[OK]</span>`, 1],
      ['Démarrage du gestionnaire de fenêtres  <span class="ok">[OK]</span>', 1],
      ['Démarrage de l\'interface graphique ...', 1]
    ];

    const finish = () => {
      sessionStorage.setItem('yos-booted', '1');
      bootEl.classList.add('hidden');
      bootEl.innerHTML = '';
      booting = false;
      showLock(true);
      Y.sound.play('startup');
    };

    (async () => {
      if (!quick) {
        for (const [l, d] of lines) {
          if (skipped) break;
          bios.innerHTML += l + '\n';
          await U.sleep(d ? U.rand(70, 160) : 30);
        }
        if (!skipped) await U.sleep(250);
      }
      bios.style.display = 'none';
      stage.classList.add('show');
      const bar = stage.querySelector('.boot-bar i');
      const total = quick ? 5 : 12;
      for (let i = 1; i <= total; i++) {
        if (skipped && i < total) { bar.style.width = '100%'; break; }
        bar.style.width = (i / total * 100) + '%';
        await U.sleep(quick ? 70 : U.rand(60, 160));
      }
      await U.sleep(250);
      finish();
    })();
  }

  /* ---------- Verrouillage / connexion ---------- */
  function showLock(fromBoot) {
    locked = true;
    Y.taskbar && Y.taskbar.closePanels();
    Y.menu && Y.menu.hide();
    if (document.activeElement && document.activeElement.blur) document.activeElement.blur();
    lockEl.classList.remove('hidden', 'leaving', 'auth', 'shake');
    const user = Y.settings.get('username');
    const hasPwd = !!Y.settings.get('password');
    const bg = el('div.lock-bg', { style: { background: Y.wallpaper.css(Y.settings.get('wallpaper')) } });
    const time = el('div.lock-time');
    const date = el('div.lock-date');
    const pwd = el('input', { type: 'password', placeholder: hasPwd ? 'Mot de passe' : 'Appuyez sur Entrée', 'aria-label': 'Mot de passe', autocomplete: 'off' });
    if (!hasPwd) pwd.readOnly = true;
    const go = el('button', { title: 'Se connecter', html: Y.icons.svg('arrowRight', 18) });
    const error = el('div.lock-error');
    const powerBtns = el('div.lock-power',
      el('button', { title: 'Redémarrer', html: Y.icons.svg('restart', 18), onclick: e => { e.stopPropagation(); restart(); } }),
      el('button', { title: 'Éteindre', html: Y.icons.svg('power', 18), onclick: e => { e.stopPropagation(); shutdown(); } }));
    lockEl.innerHTML = '';
    lockEl.append(bg,
      el('div.lock-clock', time, date),
      el('div.lock-hint', 'Cliquez ou appuyez sur une touche pour déverrouiller'),
      el('div.lock-login',
        el('div.avatar', user.charAt(0).toUpperCase()),
        el('div.lock-name', user),
        el('div.lock-form', pwd, go),
        error,
        el('div.lock-sub', hasPwd ? 'Indice : défini dans Paramètres › Système' : 'Aucun mot de passe — appuyez sur Entrée')),
      powerBtns);
    const tick = () => {
      const d = new Date();
      time.textContent = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      date.textContent = U.capitalize(d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' }));
    };
    tick();
    clearInterval(lockClockT);
    lockClockT = setInterval(tick, 1000);

    const toAuth = () => {
      if (lockEl.classList.contains('auth')) return;
      lockEl.classList.add('auth');
      setTimeout(() => pwd.focus(), 300);
    };
    const tryLogin = () => {
      const expected = Y.settings.get('password');
      if (expected && pwd.value !== expected) {
        error.textContent = 'Mot de passe incorrect';
        lockEl.classList.remove('shake'); void lockEl.offsetWidth; lockEl.classList.add('shake');
        Y.sound.play('error');
        pwd.select();
        return;
      }
      unlock();
    };
    lockEl.onpointerdown = e => { if (!e.target.closest('.lock-power')) toAuth(); };
    lockEl.onkeydown = null;
    if (lockKeyHandler) document.removeEventListener('keydown', lockKeyHandler, true);
    const keyHandler = lockKeyHandler = e => {
      if (!locked) { document.removeEventListener('keydown', keyHandler, true); return; }
      if (!lockEl.contains(e.target)) e.stopPropagation();
      if (!lockEl.classList.contains('auth')) { e.preventDefault(); toAuth(); return; }
      if (e.key === 'Enter') { e.preventDefault(); tryLogin(); }
      else if (e.key === 'Escape') { lockEl.classList.remove('auth'); }
    };
    document.addEventListener('keydown', keyHandler, true);
    go.addEventListener('click', e => { e.stopPropagation(); tryLogin(); });
    void fromBoot;
  }

  function unlock() {
    locked = false;
    clearInterval(lockClockT);
    lockEl.classList.add('leaving');
    Y.sound.play('login');
    lastActivity = Date.now();
    setTimeout(() => { lockEl.classList.add('hidden'); lockEl.innerHTML = ''; }, 460);
    if (firstLogin) {
      firstLogin = false;
      setTimeout(() => onReadyCb && onReadyCb(), 350);
    }
  }

  /* ---------- Arrêt / redémarrage ---------- */
  async function closeEverything() {
    for (const w of Y.wm.list().filter(w => !w.parent)) {
      const ok = await w.close();
      if (!ok && !w.closed) return false;
    }
    return true;
  }

  async function shutdown() {
    if (!(await closeEverything())) return;
    Y.taskbar.closePanels();
    Y.sound.play('shutdown');
    const scr = el('div.shutdown-screen', el('div.spinner'), el('div', 'Arrêt de YohannOS…'));
    document.body.appendChild(scr);
    sessionStorage.removeItem('yos-booted');
    await U.sleep(1800);
    scr.innerHTML = '';
    scr.append(
      el('div', { html: Y.icons.svg('power', 40) }),
      el('div', 'Vous pouvez fermer cet onglet en toute sécurité.'),
      el('div.row', el('button.btn', { onclick: () => location.reload() }, 'Redémarrer YohannOS'), el('a.btn', { href: '../index.html' }, 'Voir le CV classique'))
    );
  }

  async function restart() {
    if (!(await closeEverything())) return;
    Y.taskbar.closePanels();
    Y.sound.play('shutdown');
    document.body.appendChild(el('div.shutdown-screen', el('div.spinner'), el('div', 'Redémarrage…')));
    sessionStorage.removeItem('yos-booted');
    await U.sleep(1500);
    location.reload();
  }

  function crash() {
    const pct = el('span', '0');
    const scr = el('div.crash-screen',
      el('div.face', ':('),
      el('p', 'Votre PC a rencontré un problème (enfin… pas vraiment, c\'est une blague) et doit redémarrer. Nous collectons simplement quelques informations relatives à l\'erreur.'),
      el('p', pct, ' % effectués'),
      el('p', el('small', 'Code d\'arrêt : YOHANN_A_TAPE_UNE_COMMANDE_INTERDITE')));
    document.body.appendChild(scr);
    let p = 0;
    const t = setInterval(() => {
      p = Math.min(100, p + U.randInt(3, 17));
      pct.textContent = p;
      if (p >= 100) { clearInterval(t); setTimeout(() => { sessionStorage.removeItem('yos-booted'); location.reload(); }, 900); }
    }, 350);
  }

  /* ---------- Économiseur d'écran ---------- */
  function activity() {
    lastActivity = Date.now();
    if (ssRunning && Date.now() - ssStarted > 600) stopScreensaver();
  }
  function checkIdle() {
    const kind = Y.settings.get('screensaver');
    if (ssRunning || locked || booting || kind === 'none') return;
    if (Date.now() - lastActivity > Y.settings.get('screensaverDelay') * 60000) screensaver();
  }

  function screensaver(force) {
    const kind = Y.settings.get('screensaver') === 'none' && force ? 'matrix' : Y.settings.get('screensaver');
    if (ssRunning) return;
    ssCanvas = document.getElementById('screensaver');
    ssCanvas.classList.remove('hidden');
    ssRunning = true;
    ssStarted = Date.now();
    const ctx = ssCanvas.getContext('2d');
    const W = ssCanvas.width = innerWidth, H = ssCanvas.height = innerHeight;
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, W, H);
    if (kind === 'stars') {
      const stars = Array.from({ length: 500 }, () => ({ x: U.rand(-W, W), y: U.rand(-H, H), z: U.rand(1, W) }));
      const loop = () => {
        if (!ssRunning) return;
        ssRaf = requestAnimationFrame(loop);
        ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(0, 0, W, H);
        for (const s of stars) {
          s.z -= 6;
          if (s.z <= 1) { s.x = U.rand(-W, W); s.y = U.rand(-H, H); s.z = W; }
          const k = 260 / s.z, x = s.x * k + W / 2, y = s.y * k + H / 2;
          if (x < 0 || x > W || y < 0 || y > H) continue;
          const r = Math.max(0.3, (1 - s.z / W) * 2.6);
          ctx.fillStyle = `rgba(200,220,255,${1 - s.z / W})`;
          ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
        }
      };
      loop();
    } else {
      const size = 16, cols = Math.ceil(W / size);
      const drops = Array.from({ length: cols }, () => U.randInt(-40, 0));
      const chars = 'アイウエオカキクケコサシスセソタチツテトナニヌネノ0123456789YOHANNOS<>/{}=+*';
      let last = 0;
      const loop = t => {
        if (!ssRunning) return;
        ssRaf = requestAnimationFrame(loop);
        if (t - last < 45) return;
        last = t;
        ctx.fillStyle = 'rgba(0,0,0,.08)'; ctx.fillRect(0, 0, W, H);
        ctx.font = `${size}px monospace`;
        for (let i = 0; i < cols; i++) {
          const ch = chars[Math.floor(Math.random() * chars.length)];
          const y = drops[i] * size;
          ctx.fillStyle = Math.random() > 0.96 ? '#e8ffe8' : '#2bff88';
          ctx.fillText(ch, i * size, y);
          if (y > H && Math.random() > 0.975) drops[i] = 0;
          drops[i]++;
        }
      };
      requestAnimationFrame(loop);
    }
  }
  function stopScreensaver() {
    ssRunning = false;
    cancelAnimationFrame(ssRaf);
    ssCanvas && ssCanvas.classList.add('hidden');
    if (Y.settings.get('password')) showLock();
  }

  ['pointermove', 'pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => window.addEventListener(ev, activity, { passive: true, capture: true }));
  setInterval(checkIdle, 5000);

  Y.boot = {
    start,
    lock: () => showLock(false),
    restart,
    shutdown,
    crash,
    screensaver,
    isLocked: () => locked || booting
  };
})(window.YOS);
