/* =========================================================
   YohannOS — palette de commandes / recherche (Ctrl+K)
   ========================================================= */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  let root, input, results, items = [], kb = 0;

  function commands() {
    const S = Y.settings;
    return [
      { label: 'Basculer le thème clair / sombre', icon: 'moon', run: () => S.set('theme', S.effectiveTheme() === 'dark' ? 'light' : 'dark'), kw: 'theme dark light sombre clair' },
      { label: 'Fond d\'écran suivant', icon: 'image', run: () => Y.wallpaper.next(), kw: 'wallpaper fond' },
      { label: 'Afficher le bureau', icon: 'monitor', run: () => Y.wm.showDesktop(), kw: 'desktop bureau' },
      { label: 'Fenêtres en mosaïque', icon: 'gridView', run: () => Y.wm.tile(), kw: 'tile mosaique' },
      { label: 'Fenêtres en cascade', icon: 'copy', run: () => Y.wm.cascade(), kw: 'cascade' },
      { label: 'Fermer toutes les fenêtres', icon: 'x', run: () => Y.wm.closeAll(), kw: 'close fermer' },
      { label: (S.get('sound') ? 'Couper' : 'Activer') + ' le son', icon: 'volume', run: () => S.set('sound', !S.get('sound')), kw: 'son sound mute' },
      { label: 'Mode « Ne pas déranger »', icon: 'bellOff', run: () => S.set('dnd', !S.get('dnd')), kw: 'dnd notifications' },
      { label: 'Vider la corbeille', icon: 'trash', run: () => Y.emptyTrash(), kw: 'trash corbeille' },
      { label: 'Verrouiller la session', icon: 'lock', run: () => Y.boot.lock(), kw: 'lock verrouiller' },
      { label: 'Redémarrer', icon: 'restart', run: () => Y.boot.restart(), kw: 'restart reboot redemarrer' },
      { label: 'Éteindre', icon: 'power', run: () => Y.boot.shutdown(), kw: 'shutdown eteindre' },
      { label: 'Lancer l\'économiseur d\'écran', icon: 'sparkle', run: () => Y.boot.screensaver(true), kw: 'screensaver matrix' }
    ];
  }

  function open(initial = '') {
    if (!root) {
      root = document.getElementById('palette');
      root.addEventListener('pointerdown', e => { if (e.target === root) close(); });
    }
    Y.taskbar.closePanels();
    root.innerHTML = '';
    input = el('input', { placeholder: 'Rechercher des applis, fichiers, commandes… ou calculer (ex : 2^10)', spellcheck: 'false', value: initial });
    results = el('div.pal-results');
    root.appendChild(el('div.pal-box',
      el('div.pal-input', { html: Y.icons.svg('search', 20) }, input),
      results,
      el('div.pal-foot', el('span', { html: '<span class="kbd">↑</span> <span class="kbd">↓</span> naviguer' }), el('span', { html: '<span class="kbd">Entrée</span> ouvrir' }), el('span', { html: '<span class="kbd">Échap</span> fermer' }))
    ));
    root.classList.remove('hidden');
    input.addEventListener('input', render);
    input.addEventListener('keydown', onKey);
    render();
    setTimeout(() => input.focus(), 10);
  }

  function close() { root && root.classList.add('hidden'); }

  function render() {
    const q = input.value.trim();
    const ql = q.toLowerCase();
    items = [];
    results.innerHTML = '';
    // calcul
    if (q && /^[\d\s+\-*/^().,%!πe]+$|^(sqrt|sin|cos|tan|ln|log|pi|abs)/i.test(q) && /\d|pi|π/.test(q)) {
      try {
        const v = U.evalMath(q);
        if (isFinite(v)) {
          const res = U.formatNumber(v);
          group('Calcul');
          add({ html: `<div class="pal-calc">= ${U.escape(res)}</div>`, sub: 'Entrée pour copier le résultat', icon: 'calculator', run: () => navigator.clipboard && navigator.clipboard.writeText(res).catch(() => {}) });
        }
      } catch (e) { /* pas un calcul */ }
    }
    const apps = Y.apps.list().filter(a => !ql || a.name.toLowerCase().includes(ql) || (a.keywords || '').toLowerCase().includes(ql) || (a.description || '').toLowerCase().includes(ql));
    if (apps.length) {
      group('Applications');
      apps.slice(0, ql ? 6 : 8).forEach(a => add({ label: a.name, sub: a.description || a.category, tile: Y.icons.tile(a.icon, a.color, 30), run: () => Y.apps.launch(a.id) }));
    }
    if (ql) {
      const files = Y.fs.find('/', name => name.toLowerCase().includes(ql) && !name.startsWith('.'), 8);
      if (files.length) {
        group('Fichiers');
        files.forEach(p => { const st = Y.fs.stat(p); add({ label: st.name, sub: Y.fs.pretty(p), tile: Y.icons.fileIcon(st.name, st.isDir, 28), run: () => Y.apps.openFile(p) }); });
      }
    }
    const cmds = commands().filter(c => !ql || c.label.toLowerCase().includes(ql) || c.kw.includes(ql));
    if (cmds.length) {
      group('Commandes');
      cmds.slice(0, ql ? 8 : 5).forEach(c => add({ label: c.label, sub: 'Commande système', icon: c.icon, run: c.run }));
    }
    if (ql && /^https?:\/\//.test(q)) { group('Web'); add({ label: `Ouvrir ${q}`, sub: 'Navigateur', icon: 'globe', run: () => Y.apps.launch('browser', { url: q }) }); }
    if (ql && !items.length) { group('Web'); add({ label: `Rechercher « ${q} » sur Wikipédia`, sub: 'Navigateur', icon: 'globe', run: () => Y.apps.launch('browser', { url: 'https://fr.wikipedia.org/w/index.php?search=' + encodeURIComponent(q) }) }); }
    kb = 0;
    highlight();
  }

  function group(t) { results.appendChild(el('div.pal-group', t)); }
  function add(it) {
    const row = el('div.pal-item', { html: it.tile || (it.icon ? `<span class="app-tile" style="width:30px;height:30px;--c1:var(--bg-active);--c2:var(--bg-hover);color:var(--fg)">${Y.icons.svg(it.icon, 16)}</span>` : '') },
      el('div.main', it.html ? el('div', { html: it.html }) : el('div', it.label), it.sub ? el('div.sub', it.sub) : null));
    const idx = items.length;
    row.addEventListener('click', () => exec(idx));
    row.addEventListener('pointermove', () => { if (kb !== idx) { kb = idx; highlight(); } });
    items.push({ row, run: it.run });
    results.appendChild(row);
  }
  function highlight() { items.forEach((it, i) => it.row.classList.toggle('kb', i === kb)); items[kb] && items[kb].row.scrollIntoView({ block: 'nearest' }); }
  function exec(i) { const it = items[i]; if (!it) return; close(); setTimeout(() => it.run(), 10); }
  function onKey(e) {
    if (e.key === 'Escape') { e.preventDefault(); close(); }
    else if (e.key === 'ArrowDown') { e.preventDefault(); kb = Math.min(items.length - 1, kb + 1); highlight(); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); kb = Math.max(0, kb - 1); highlight(); }
    else if (e.key === 'Enter') { e.preventDefault(); exec(kb); }
  }

  Y.palette = { open, close, isOpen: () => root && !root.classList.contains('hidden') };
})(window.YOS);
