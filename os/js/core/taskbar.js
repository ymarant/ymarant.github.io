/* =========================================================
   YohannOS — barre des tâches, menu Démarrer,
   centre de contrôle, calendrier
   ========================================================= */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  let bar, appsBox, startMenu, cc, cal, clockEl, notifBtn, netBtn, volBtn, battBtn, popup;
  let calMonth = null;

  /* ---------- Barre ---------- */
  function build() {
    bar = document.getElementById('taskbar');
    startMenu = document.getElementById('start-menu');
    cc = document.getElementById('control-center');
    cal = document.getElementById('calendar-panel');

    const startBtn = el('button.tb-btn.tb-start', { title: 'Démarrer', 'aria-label': 'Menu Démarrer', html: `<span class="logo">${Y.icons.LOGO}</span>` });
    startBtn.addEventListener('click', () => togglePanel('start'));
    const searchBtn = el('button.tb-btn.tb-search', { html: `${Y.icons.svg('search', 15)}<span>Rechercher</span>` });
    searchBtn.addEventListener('click', () => Y.palette.open());
    U.tooltip(searchBtn, 'Rechercher (Ctrl+K)');
    appsBox = el('div.tb-apps');

    netBtn = el('button.tb-btn');
    volBtn = el('button.tb-btn');
    battBtn = el('button.tb-btn.hidden');
    notifBtn = el('button.tb-btn', { html: Y.icons.svg('bell', 17) });
    [netBtn, volBtn, battBtn, notifBtn].forEach(b => b.addEventListener('click', () => togglePanel('cc')));
    U.tooltip(netBtn, () => navigator.onLine ? 'Connecté à Internet' : 'Hors ligne');
    U.tooltip(volBtn, () => Y.settings.get('sound') ? `Volume : ${Math.round(Y.settings.get('volume') * 100)} %` : 'Son coupé');
    U.tooltip(notifBtn, 'Notifications');
    clockEl = el('button.tb-btn.tb-clock');
    clockEl.addEventListener('click', () => togglePanel('cal'));
    const showDesk = el('div.tb-show-desktop', { title: 'Afficher le bureau' });
    showDesk.addEventListener('click', () => Y.wm.showDesktop());

    bar.append(startBtn, searchBtn, appsBox, el('div.tb-tray', netBtn, volBtn, battBtn, notifBtn), clockEl, showDesk);
    updateTray();
    updateClock();
    setInterval(updateClock, 1000);
    window.addEventListener('online', updateTray);
    window.addEventListener('offline', updateTray);
    if (navigator.getBattery) {
      navigator.getBattery().then(b => {
        const upd = () => {
          battBtn.classList.remove('hidden');
          const pct = Math.round(b.level * 100);
          battBtn.innerHTML = `<span class="batt"><svg width="22" height="14" viewBox="0 0 26 14" fill="none" stroke="currentColor" stroke-width="1.6"><rect x="1" y="1" width="21" height="12" rx="3"/><rect x="3" y="3" width="${Math.max(1, 17 * b.level)}" height="8" rx="1.5" fill="${pct < 20 && !b.charging ? 'var(--danger)' : 'currentColor'}" stroke="none"/><path d="M24 5v4"/></svg>${b.charging ? '⚡' : ''}</span>`;
          battBtn.title = `Batterie : ${pct} %${b.charging ? ' (en charge)' : ''}`;
        };
        upd();
        b.addEventListener('levelchange', upd);
        b.addEventListener('chargingchange', upd);
      }).catch(() => {});
    }

    renderApps();
    ['wm:open', 'wm:close', 'wm:focus', 'wm:minimize', 'wm:restore', 'wm:title'].forEach(ev => Y.bus.on(ev, renderApps));
    Y.bus.on('settings:change', k => { if (k === 'pinned' || k === '*') renderApps(); if (['sound', 'volume', 'dnd', '*'].includes(k)) updateTray(); if (k === 'clockSeconds') updateClock(); });
    Y.bus.on('notify:change', updateTray);

    document.addEventListener('pointerdown', e => {
      if (e.target.closest('#taskbar') || e.target.closest('.panel') || e.target.closest('.ctx-menu') || e.target.closest('.tb-popup')) return;
      closePanels();
    });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') closePanels(); });
  }

  function updateTray() {
    netBtn.innerHTML = Y.icons.svg(navigator.onLine ? 'wifi' : 'wifiOff', 17);
    const v = Y.settings.get('volume');
    volBtn.innerHTML = Y.icons.svg(!Y.settings.get('sound') || v === 0 ? 'volumeX' : v < 0.5 ? 'volumeLow' : 'volume', 17);
    const n = Y.notifications ? Y.notifications.list().length : 0;
    notifBtn.innerHTML = Y.icons.svg(Y.settings.get('dnd') ? 'bellOff' : 'bell', 17) + (n ? `<span class="tb-badge">${n > 9 ? '9+' : n}</span>` : '');
    if (!cc.classList.contains('hidden')) renderCC();
  }

  function updateClock() {
    const d = new Date();
    const t = d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', second: Y.settings.get('clockSeconds') ? '2-digit' : undefined });
    const ds = d.toLocaleDateString('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' });
    clockEl.innerHTML = `<span class="t">${t}</span><span class="d">${ds}</span>`;
    if (!cal.classList.contains('hidden')) { const now = cal.querySelector('.cal-now'); if (now) now.textContent = d.toLocaleTimeString('fr-FR'); }
  }

  /* Applications épinglées + ouvertes */
  function renderApps() {
    if (!appsBox) return;
    const pinned = Y.settings.get('pinned').filter(id => Y.apps.get(id));
    const running = [];
    Y.wm.list().forEach(w => { if (w.app && !w.parent && !running.includes(w.app)) running.push(w.app); });
    const ids = pinned.concat(running.filter(id => !pinned.includes(id)));
    const focusedApp = Y.wm.focused() && Y.wm.focused().app;
    const existing = new Map(U.$$('.tb-item', appsBox).map(n => [n.dataset.app, n]));
    appsBox.innerHTML = '';
    ids.forEach(id => {
      const app = Y.apps.get(id);
      const wins = Y.wm.byApp(id).filter(w => !w.parent);
      let node = existing.get(id);
      if (!node) {
        node = el('button.tb-btn.tb-item', { dataset: { app: id }, 'aria-label': app.name, html: Y.icons.tile(app.icon, app.color, 30) });
        node.addEventListener('click', () => onItemClick(id, node));
        node.addEventListener('contextmenu', e => { e.preventDefault(); itemMenu(id, node); });
        U.tooltip(node, () => { const ws = Y.wm.byApp(id).filter(w => !w.parent); return ws.length === 1 ? ws[0].title : ws.length ? `${app.name} — ${ws.length} fenêtres` : app.name; });
      }
      node.classList.toggle('focused', focusedApp === id);
      const dots = el('span.dots');
      for (let i = 0; i < Math.min(3, wins.length); i++) dots.appendChild(el('i'));
      const old = node.querySelector('.dots');
      old ? old.replaceWith(dots) : node.appendChild(dots);
      appsBox.appendChild(node);
    });
  }

  function onItemClick(id, node) {
    closePopup();
    const wins = Y.wm.byApp(id).filter(w => !w.parent);
    if (!wins.length) {
      node.classList.add('launching');
      setTimeout(() => node.classList.remove('launching'), 700);
      Y.apps.launch(id);
      return;
    }
    if (wins.length === 1) {
      const w = wins[0];
      if (Y.wm.focused() === w && !w.minimized) w.minimize(); else w.focus();
      return;
    }
    // plusieurs fenêtres : petite liste
    const r = node.getBoundingClientRect();
    popup = el('div.tb-popup');
    wins.forEach(w => {
      const b = el('button', { class: Y.wm.focused() === w ? 'focused' : null, html: Y.icons.tile(Y.apps.get(id).icon, Y.apps.get(id).color, 20) }, el('span', w.title));
      b.addEventListener('click', () => { closePopup(); w.focus(); });
      popup.appendChild(b);
    });
    document.body.appendChild(popup);
    popup.style.left = U.clamp(r.left + r.width / 2 - popup.offsetWidth / 2, 6, innerWidth - popup.offsetWidth - 6) + 'px';
    popup.style.bottom = (innerHeight - r.top + 8) + 'px';
    setTimeout(() => document.addEventListener('pointerdown', closePopupOutside, true), 0);
  }
  function closePopupOutside(e) { if (popup && !popup.contains(e.target)) closePopup(); }
  function closePopup() { if (popup) { popup.remove(); popup = null; } document.removeEventListener('pointerdown', closePopupOutside, true); }

  function itemMenu(id, node) {
    const app = Y.apps.get(id);
    const wins = Y.wm.byApp(id).filter(w => !w.parent);
    const pinned = Y.settings.get('pinned').includes(id);
    const r = node.getBoundingClientRect();
    Y.menu.show(r.left, r.top - 10, [
      { title: app.name },
      { label: 'Nouvelle fenêtre', icon: 'plus', disabled: app.single && wins.length > 0, action: () => Y.apps.launch(id) },
      { label: pinned ? 'Détacher de la barre des tâches' : 'Épingler à la barre des tâches', icon: 'pin', action: () => togglePin(id) },
      wins.length ? '-' : null,
      wins.length ? { label: wins.length > 1 ? 'Fermer toutes les fenêtres' : 'Fermer la fenêtre', icon: 'x', action: () => wins.forEach(w => w.close()) } : null
    ]);
    // remonter le menu au-dessus de la barre
    const m = document.querySelector('.ctx-menu');
    if (m) m.style.top = Math.max(4, r.top - m.offsetHeight - 8) + 'px';
  }

  function togglePin(id) {
    const p = Y.settings.get('pinned').slice();
    const i = p.indexOf(id);
    if (i >= 0) p.splice(i, 1); else p.push(id);
    Y.settings.set('pinned', p);
  }

  /* ---------- Panneaux ---------- */
  function togglePanel(which) {
    const map = { start: startMenu, cc, cal };
    const target = map[which];
    const wasOpen = !target.classList.contains('hidden');
    closePanels();
    if (wasOpen) return;
    if (which === 'start') renderStart();
    if (which === 'cc') renderCC();
    if (which === 'cal') { calMonth = new Date(); calMonth.setDate(1); renderCal(); }
    target.classList.remove('hidden');
    bar.querySelector('.tb-start').classList.toggle('open', which === 'start');
    if (which === 'start') setTimeout(() => { const i = startMenu.querySelector('input'); i && i.focus(); }, 30);
  }
  function closePanels() {
    [startMenu, cc, cal].forEach(p => p && p.classList.add('hidden'));
    bar && bar.querySelector('.tb-start').classList.remove('open');
  }

  /* Menu Démarrer */
  function renderStart() {
    const user = Y.settings.get('username');
    const input = el('input.input', { placeholder: 'Rechercher une application ou un fichier…', spellcheck: 'false' });
    const body = el('div.sm-body');
    let kbIndex = -1;
    const draw = () => {
      const q = input.value.trim().toLowerCase();
      body.innerHTML = '';
      kbIndex = -1;
      const appsList = Y.apps.list().filter(a => !q || a.name.toLowerCase().includes(q) || (a.keywords || '').toLowerCase().includes(q) || (a.description || '').toLowerCase().includes(q));
      if (!q) {
        body.appendChild(el('div.sm-section-title', el('span', 'Applications'), el('span.faint', `${appsList.length} installées`)));
        const grid = el('div.sm-grid');
        appsList.forEach(a => grid.appendChild(appButton(a)));
        body.appendChild(grid);
        const rec = Y.recent.list().filter(p => Y.fs.exists(p)).slice(0, 4);
        if (rec.length) {
          body.appendChild(el('div.sm-section-title', el('span', 'Fichiers récents')));
          const l = el('div.sm-list');
          rec.forEach(p => l.appendChild(fileRow(p)));
          body.appendChild(l);
        }
      } else {
        if (appsList.length) {
          body.appendChild(el('div.sm-section-title', 'Applications'));
          const grid = el('div.sm-grid');
          appsList.forEach(a => grid.appendChild(appButton(a)));
          body.appendChild(grid);
        }
        const files = Y.fs.find('/home', name => name.toLowerCase().includes(q) && !name.startsWith('.'), 8);
        if (files.length) {
          body.appendChild(el('div.sm-section-title', 'Fichiers'));
          const l = el('div.sm-list');
          files.forEach(p => l.appendChild(fileRow(p)));
          body.appendChild(l);
        }
        if (!appsList.length && !files.length) body.appendChild(el('div.empty-state', { style: { height: 'auto' } }, `Aucun résultat pour « ${input.value} »`));
      }
    };
    const appButton = a => {
      const b = el('button.sm-app', { html: Y.icons.tile(a.icon, a.color, 40) }, el('span', a.name));
      b.addEventListener('click', () => { closePanels(); Y.apps.launch(a.id); });
      b.addEventListener('contextmenu', e => {
        e.preventDefault();
        Y.menu.show(e.clientX, e.clientY, [
          { label: 'Ouvrir', icon: 'arrowRight', action: () => { closePanels(); Y.apps.launch(a.id); } },
          { label: Y.settings.get('pinned').includes(a.id) ? 'Détacher de la barre des tâches' : 'Épingler à la barre des tâches', icon: 'pin', action: () => togglePin(a.id) }
        ]);
      });
      if (a.description) U.tooltip(b, a.description);
      return b;
    };
    const fileRow = p => {
      const st = Y.fs.stat(p);
      const b = el('button.sm-row', { html: Y.icons.fileIcon(st.name, st.isDir, 28) }, el('div', el('div', st.name), el('div.meta', Y.fs.pretty(Y.fs.dirname(p)))));
      b.addEventListener('click', () => { closePanels(); Y.apps.openFile(p); });
      return b;
    };
    input.addEventListener('input', draw);
    input.addEventListener('keydown', e => {
      const items = U.$$('.sm-app, .sm-row', body);
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') { e.preventDefault(); kbIndex = Math.min(items.length - 1, kbIndex + 1); }
      else if (e.key === 'ArrowUp' || e.key === 'ArrowLeft') { e.preventDefault(); kbIndex = Math.max(0, kbIndex - 1); }
      else if (e.key === 'Enter') { e.preventDefault(); (items[kbIndex >= 0 ? kbIndex : 0] || { click() {} }).click(); return; }
      else return;
      items.forEach((n, i) => n.classList.toggle('kb', i === kbIndex));
      items[kbIndex] && items[kbIndex].scrollIntoView({ block: 'nearest' });
    });

    const userBtn = el('button.sm-user', el('span.sm-avatar', user.charAt(0).toUpperCase()), el('span', user));
    userBtn.addEventListener('click', () => { closePanels(); Y.apps.launch('about'); });
    const pw = (icon, label, fn) => { const b = el('button.btn.ghost.icon', { title: label, html: Y.icons.svg(icon, 18) }); b.addEventListener('click', () => { closePanels(); fn(); }); return b; };
    startMenu.innerHTML = '';
    startMenu.append(
      el('div.sm-search', el('div.wrap', { html: Y.icons.svg('search', 16) }, input)),
      body,
      el('div.sm-footer', userBtn, el('div.sm-power',
        pw('settings', 'Paramètres', () => Y.apps.launch('settings')),
        pw('lock', 'Verrouiller', () => Y.boot.lock()),
        pw('restart', 'Redémarrer', () => Y.boot.restart()),
        pw('power', 'Éteindre', () => Y.boot.shutdown())))
    );
    draw();
  }

  /* Centre de contrôle */
  function renderCC() {
    const S = Y.settings;
    const toggle = (icon, label, on, fn) => {
      const b = el('button.cc-toggle', { class: on ? 'on' : null, html: Y.icons.svg(icon, 18) }, el('span', label));
      b.addEventListener('click', () => { fn(); renderCC(); });
      return b;
    };
    const quick = el('div.cc-quick',
      toggle(S.effectiveTheme() === 'dark' ? 'moon' : 'sun', 'Mode sombre', S.effectiveTheme() === 'dark', () => S.set('theme', S.effectiveTheme() === 'dark' ? 'light' : 'dark')),
      toggle(S.get('sound') ? 'volume' : 'volumeX', 'Son', S.get('sound'), () => S.set('sound', !S.get('sound'))),
      toggle('bellOff', 'Ne pas déranger', S.get('dnd'), () => S.set('dnd', !S.get('dnd'))),
      toggle('sparkle', 'Animations', S.get('animations'), () => S.set('animations', !S.get('animations'))),
      toggle('eye', 'Transparence', S.get('transparency'), () => S.set('transparency', !S.get('transparency'))),
      toggle('image', 'Fond suivant', false, () => Y.wallpaper.next())
    );
    const vol = el('input.range', { type: 'range', min: 0, max: 100, value: Math.round(S.get('volume') * 100) });
    vol.addEventListener('input', () => { S.set('volume', vol.value / 100); if (!S.get('sound')) S.set('sound', true); });
    vol.addEventListener('change', () => Y.sound.play('pop'));
    const accents = el('div.cc-accents');
    S.ACCENTS.forEach(c => {
      const sw = el('span.swatch', { class: S.get('accent') === c ? 'on' : null, style: { background: c }, title: c });
      sw.addEventListener('click', () => { S.set('accent', c); renderCC(); });
      accents.appendChild(sw);
    });
    const list = el('div.cc-notifs-list');
    const notifs = Y.notifications.list();
    if (!notifs.length) list.appendChild(el('div.empty-state', { style: { padding: '18px' } }, 'Aucune notification'));
    notifs.forEach(n => {
      const app = n.app && Y.apps.get(n.app);
      const row = el('div.cc-notif', { html: app ? Y.icons.tile(app.icon, app.color, 28) : Y.icons.tile(n.icon, null, 28) },
        el('div.grow', el('b', n.title), n.body ? el('div.dim', n.body) : null, el('div.time', U.timeAgo(n.time))));
      row.addEventListener('click', () => { if (n.onClick) { closePanels(); n.onClick(); } });
      list.appendChild(row);
    });
    const clear = el('button.btn.sm.ghost', 'Tout effacer');
    clear.addEventListener('click', () => Y.notifications.clear());
    cc.innerHTML = '';
    cc.append(quick,
      el('div.cc-slider', { html: Y.icons.svg('volumeLow', 16) }, vol, el('span', { style: { width: '34px', textAlign: 'right', fontSize: '12px' } }, `${vol.value}%`)),
      accents,
      el('div.cc-notifs', el('div.cc-notifs-head', el('span', 'Notifications'), notifs.length ? clear : null), list));
    vol.addEventListener('input', () => { vol.nextSibling.textContent = vol.value + '%'; });
  }

  /* Calendrier */
  function renderCal() {
    const now = new Date();
    const y = calMonth.getFullYear(), m = calMonth.getMonth();
    const first = new Date(y, m, 1);
    const offset = (first.getDay() + 6) % 7; // lundi = 0
    const days = new Date(y, m + 1, 0).getDate();
    const prevDays = new Date(y, m, 0).getDate();
    const grid = el('div.cal-grid');
    ['L', 'M', 'M', 'J', 'V', 'S', 'D'].forEach(d => grid.appendChild(el('div.dow', d)));
    for (let i = 0; i < 42; i++) {
      const dnum = i - offset + 1;
      let label, cls = 'day';
      if (dnum < 1) { label = prevDays + dnum; cls += ' other'; }
      else if (dnum > days) { label = dnum - days; cls += ' other'; }
      else { label = dnum; if (dnum === now.getDate() && m === now.getMonth() && y === now.getFullYear()) cls += ' today'; }
      grid.appendChild(el('div', { class: cls }, label));
    }
    const prev = el('button.btn.ghost.sm.icon', { html: Y.icons.svg('chevronLeft', 16) });
    const next = el('button.btn.ghost.sm.icon', { html: Y.icons.svg('chevronRight', 16) });
    prev.onclick = () => { calMonth.setMonth(m - 1); renderCal(); };
    next.onclick = () => { calMonth.setMonth(m + 1); renderCal(); };
    const title = el('span', U.capitalize(first.toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' })));
    title.style.cursor = 'pointer';
    title.onclick = () => { calMonth = new Date(); calMonth.setDate(1); renderCal(); };
    cal.innerHTML = '';
    cal.append(
      el('div.cal-now', now.toLocaleTimeString('fr-FR')),
      el('div.cal-today', U.capitalize(now.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }))),
      el('div.cal-head', title, el('div', prev, next)),
      grid
    );
  }

  Y.taskbar = {
    init: build,
    togglePin,
    closePanels,
    togglePanel,
    itemRect(app) {
      const n = appsBox && app && appsBox.querySelector(`.tb-item[data-app="${app}"]`);
      return n ? n.getBoundingClientRect() : null;
    }
  };
})(window.YOS);
