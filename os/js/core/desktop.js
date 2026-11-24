/* =========================================================
   YohannOS — bureau : icônes, sélection, glisser-déposer,
   menu contextuel, import de fichiers
   ========================================================= */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const CW = 92, CH = 102, PAD = 10;
  let host, selRect;
  let selected = new Set();
  let positions = {};

  Y.clipboard = { mode: null, paths: [] };

  const DESK = () => Y.fs.HOME + '/Bureau';

  /* Positions mémorisées (synchronisées avec les renommages) */
  Y.desktopPositions = {
    forget(path) { if (positions['file:' + path]) { delete positions['file:' + path]; save(); } },
    rename(a, b) { if (positions['file:' + a]) { positions['file:' + b] = positions['file:' + a]; delete positions['file:' + a]; save(); } }
  };
  const save = U.debounce(() => U.store.set('desktop-pos', positions), 200);

  function items() {
    const list = Y.apps.all().filter(a => a.desktop).sort((a, b) => (a.desktopOrder || 50) - (b.desktopOrder || 50))
      .map(a => ({ key: 'app:' + a.id, kind: 'app', app: a, name: a.desktopName || a.name }));
    let files = [];
    try { files = Y.fs.readdir(DESK()); } catch (e) { /* ignore */ }
    files.forEach(f => list.push({ key: 'file:' + f.path, kind: 'file', path: f.path, name: f.name, isDir: f.isDir, url: f.url }));
    return list;
  }

  function grid() {
    const h = host.clientHeight || (innerHeight - 52);
    const w = host.clientWidth || innerWidth;
    return { rows: Math.max(1, Math.floor((h - PAD) / CH)), cols: Math.max(1, Math.floor((w - PAD) / CW)) };
  }
  const cellXY = (c, r) => ({ x: PAD + c * CW, y: PAD + r * CH });

  function iconHtml(it) {
    if (it.kind === 'app') {
      if (it.app.id === 'trash') return Y.icons.tile(Y.fs.trashCount() ? 'trashFull' : 'trash', it.app.color, 48);
      return Y.icons.tile(it.app.icon, it.app.color, 48);
    }
    const ext = Y.fs.ext(it.name);
    if (['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'].includes(ext)) {
      const src = Y.fs.getUrl(it.path);
      if (src) return `<img src="${U.escape(src)}" alt="">`;
    }
    if (ext === 'url') return Y.icons.tile('globe', ['#43cea2', '#185a9d'], 48);
    return Y.icons.fileIcon(it.name, it.isDir, 48);
  }

  function render() {
    if (!host) return;
    const list = items();
    const { rows, cols } = grid();
    const used = new Set();
    const keyOf = (c, r) => c + ':' + r;
    const valid = new Set(list.map(i => i.key));
    // nettoyer les positions orphelines
    for (const k of Object.keys(positions)) if (!valid.has(k)) delete positions[k];
    const placed = [];
    list.forEach(it => {
      const p = positions[it.key];
      if (p && p[0] < cols && p[1] < rows && !used.has(keyOf(p[0], p[1]))) { used.add(keyOf(p[0], p[1])); placed.push([it, p[0], p[1]]); }
      else placed.push([it, -1, -1]);
    });
    placed.forEach(pl => {
      if (pl[1] >= 0) return;
      outer: for (let c = 0; c < cols; c++) for (let r = 0; r < rows; r++) {
        if (!used.has(keyOf(c, r))) { used.add(keyOf(c, r)); pl[1] = c; pl[2] = r; positions[pl[0].key] = [c, r]; break outer; }
      }
      if (pl[1] < 0) { pl[1] = cols - 1; pl[2] = rows - 1; }
    });
    save();

    host.innerHTML = '';
    placed.forEach(([it, c, r]) => {
      const { x, y } = cellXY(c, r);
      const node = el('div.d-icon', { tabindex: '-1', dataset: { key: it.key }, style: { left: x + 'px', top: y + 'px' }, title: it.kind === 'file' ? Y.fs.pretty(it.path) : (it.app.description || it.name) },
        el('div.d-img', { html: iconHtml(it) }),
        el('div.d-label', it.name));
      if (it.kind === 'file' && it.isDir) node.dataset.dropPath = it.path;
      if (it.kind === 'app' && it.app.id === 'trash') node.dataset.dropTrash = '1';
      if (selected.has(it.key)) node.classList.add('selected');
      node._item = it;
      bindIcon(node);
      host.appendChild(node);
    });
  }

  function setSelection(keys) {
    selected = new Set(keys);
    U.$$('.d-icon', host).forEach(n => n.classList.toggle('selected', selected.has(n.dataset.key)));
  }
  const selectedItems = () => U.$$('.d-icon', host).filter(n => selected.has(n.dataset.key)).map(n => n._item);

  function open(it) {
    if (it.kind === 'app') Y.apps.launch(it.app.id);
    else Y.apps.openFile(it.path);
  }

  function bindIcon(node) {
    const it = node._item;
    node.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      e.stopPropagation();
      Y.wm.focused() && document.activeElement && document.activeElement.blur();
      if (e.ctrlKey || e.metaKey) {
        const s = new Set(selected);
        s.has(it.key) ? s.delete(it.key) : s.add(it.key);
        setSelection(s);
      } else if (!selected.has(it.key)) setSelection([it.key]);
      startIconDrag(e, node);
    });
    node.addEventListener('dblclick', () => open(it));
    node.addEventListener('contextmenu', e => {
      e.preventDefault(); e.stopPropagation();
      if (!selected.has(it.key)) setSelection([it.key]);
      iconMenu(e.clientX, e.clientY, it);
    });
  }

  function startIconDrag(e, node) {
    const sx = e.clientX, sy = e.clientY;
    const nodes = U.$$('.d-icon', host).filter(n => selected.has(n.dataset.key));
    const starts = nodes.map(n => ({ n, x: n.offsetLeft, y: n.offsetTop }));
    let dragging = false, target = null;
    try { node.setPointerCapture(e.pointerId); } catch (err) { /* ignore */ }
    const move = ev => {
      const dx = ev.clientX - sx, dy = ev.clientY - sy;
      if (!dragging && Math.abs(dx) + Math.abs(dy) > 5) { dragging = true; nodes.forEach(n => n.classList.add('dragging')); document.body.classList.add('dragging'); host.style.zIndex = 999999; }
      if (!dragging) return;
      starts.forEach(s => { s.n.style.left = s.x + dx + 'px'; s.n.style.top = s.y + dy + 'px'; });
      // cible de dépôt
      const under = document.elementsFromPoint(ev.clientX, ev.clientY);
      let t = under.find(x => x.classList && x.classList.contains('d-icon') && !nodes.includes(x) && (x.dataset.dropPath || x.dataset.dropTrash));
      if (!t) t = under.find(x => x.dataset && x.dataset.dropPath && !x.classList.contains('d-icon') && x.closest('.win'));
      if (target !== t) { target && target.classList.remove('drop-target'); target = t; target && target.classList.add('drop-target'); }
    };
    const up = ev => {
      node.removeEventListener('pointermove', move);
      node.removeEventListener('pointerup', up);
      node.removeEventListener('pointercancel', up);
      document.body.classList.remove('dragging');
      host.style.zIndex = '';
      nodes.forEach(n => n.classList.remove('dragging'));
      if (!dragging) {
        if (ev.pointerType === 'touch' && ev.type === 'pointerup') open(node._item);
        return;
      }
      target && target.classList.remove('drop-target');
      const files = nodes.map(n => n._item).filter(i => i.kind === 'file');
      if (target && files.length) {
        try {
          if (target.dataset.dropTrash) { files.forEach(f => Y.fs.trash(f.path)); Y.sound.play('trash'); }
          else files.forEach(f => { if (f.path !== target.dataset.dropPath) Y.fs.move(f.path, target.dataset.dropPath); });
        } catch (err) { Y.dialog.alert(err.message, { icon: 'err', title: 'Erreur' }); }
        render();
        return;
      }
      // repositionner sur la grille
      const { rows, cols } = grid();
      const others = new Set(U.$$('.d-icon', host).filter(n => !nodes.includes(n)).map(n => positions[n.dataset.key] && positions[n.dataset.key].join(':')));
      starts.forEach(s => {
        const x = parseFloat(s.n.style.left), y = parseFloat(s.n.style.top);
        let c = U.clamp(Math.round((x - PAD) / CW), 0, cols - 1), r = U.clamp(Math.round((y - PAD) / CH), 0, rows - 1);
        // chercher la cellule libre la plus proche
        if (others.has(c + ':' + r)) {
          let best = null, bd = Infinity;
          for (let cc = 0; cc < cols; cc++) for (let rr = 0; rr < rows; rr++) {
            if (others.has(cc + ':' + rr)) continue;
            const d = (cc - c) ** 2 + (rr - r) ** 2;
            if (d < bd) { bd = d; best = [cc, rr]; }
          }
          if (best) [c, r] = best;
        }
        others.add(c + ':' + r);
        positions[s.n.dataset.key] = [c, r];
        const p = cellXY(c, r);
        s.n.style.left = p.x + 'px'; s.n.style.top = p.y + 'px';
      });
      save();
    };
    node.addEventListener('pointermove', move);
    node.addEventListener('pointerup', up);
    node.addEventListener('pointercancel', up);
  }

  /* ---------- Sélection rectangulaire ---------- */
  function startRubber(e) {
    if (e.button !== 0) return;
    if (!(e.ctrlKey || e.metaKey)) setSelection([]);
    const base = new Set(selected);
    const r0 = host.getBoundingClientRect();
    const sx = e.clientX - r0.left, sy = e.clientY - r0.top;
    const target = e.currentTarget;
    let active = false;
    U.drag(e, {
      bodyClass: false,
      move(dx, dy) {
        if (!active && Math.abs(dx) + Math.abs(dy) < 4) return;
        active = true;
        const x = Math.min(sx, sx + dx), y = Math.min(sy, sy + dy), w = Math.abs(dx), h = Math.abs(dy);
        Object.assign(selRect.style, { display: 'block', left: x + 'px', top: y + 'px', width: w + 'px', height: h + 'px' });
        const keys = new Set(base);
        U.$$('.d-icon', host).forEach(n => {
          const ix = n.offsetLeft, iy = n.offsetTop, iw = n.offsetWidth, ih = n.offsetHeight;
          if (ix < x + w && ix + iw > x && iy < y + h && iy + ih > y) keys.add(n.dataset.key);
        });
        setSelection(keys);
      },
      end() { selRect.style.display = 'none'; }
    });
    void target;
  }

  /* ---------- Menus ---------- */
  function newItem(kind) {
    const dir = DESK();
    let path;
    try {
      if (kind === 'folder') path = Y.fs.mkdir(Y.fs.uniqueName(dir, 'Nouveau dossier'));
      else if (kind === 'txt') path = Y.fs.writeFile(Y.fs.uniqueName(dir, 'Nouveau document.txt'), '');
      else if (kind === 'md') path = Y.fs.writeFile(Y.fs.uniqueName(dir, 'Nouvelle note.md'), '# Titre\n\nÉcris ici en **Markdown**.\n');
      else if (kind === 'html') path = Y.fs.writeFile(Y.fs.uniqueName(dir, 'page.html'), '<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8">\n  <title>Ma page</title>\n</head>\n<body>\n  <h1>Bonjour !</h1>\n</body>\n</html>\n');
    } catch (e) { Y.dialog.alert(e.message, { icon: 'err' }); return; }
    render();
    setSelection(['file:' + path]);
    const n = U.$$('.d-icon', host).find(x => x.dataset.key === 'file:' + path);
    if (n) startRename(n);
  }

  function paste(dir) {
    const cb = Y.clipboard;
    if (!cb.paths.length) return;
    try {
      cb.paths.forEach(p => {
        if (!Y.fs.exists(p)) return;
        if (cb.mode === 'cut') Y.fs.move(p, Y.fs.uniqueName(dir, Y.fs.basename(p)));
        else Y.fs.copy(p, dir);
      });
      if (cb.mode === 'cut') { cb.paths = []; cb.mode = null; }
    } catch (e) { Y.dialog.alert(e.message, { icon: 'err' }); }
  }
  Y.pasteInto = paste;

  function desktopMenu(x, y) {
    Y.menu.show(x, y, [
      { label: 'Nouveau', icon: 'plus', submenu: [
        { label: 'Dossier', icon: 'folder', action: () => newItem('folder') },
        '-',
        { label: 'Document texte', icon: 'fileText', action: () => newItem('txt') },
        { label: 'Note Markdown', icon: 'fileText', action: () => newItem('md') },
        { label: 'Page HTML', icon: 'code', action: () => newItem('html') }
      ] },
      { label: 'Coller', icon: 'clipboard', shortcut: 'Ctrl+V', disabled: !Y.clipboard.paths.length, action: () => paste(DESK()) },
      '-',
      { label: 'Actualiser', icon: 'refresh', action: () => { host.style.opacity = '0'; setTimeout(() => { render(); host.style.opacity = ''; }, 120); } },
      { label: 'Réorganiser les icônes', icon: 'gridView', action: () => { positions = {}; render(); } },
      { label: 'Fenêtres', icon: 'monitor', submenu: [
        { label: 'Cascade', action: () => Y.wm.cascade() },
        { label: 'Mosaïque', action: () => Y.wm.tile() },
        { label: 'Afficher le bureau', shortcut: 'Ctrl+Alt+D', action: () => Y.wm.showDesktop() },
        '-',
        { label: 'Fermer toutes les fenêtres', danger: true, action: () => Y.wm.closeAll() }
      ] },
      '-',
      { label: 'Ouvrir le terminal ici', icon: 'terminal', action: () => Y.apps.launch('terminal', { cwd: DESK() }) },
      { label: 'Fond d\'écran suivant', icon: 'image', action: () => Y.wallpaper.next() },
      { label: 'Personnaliser…', icon: 'palette', action: () => Y.apps.launch('settings', { section: 'perso' }) },
      '-',
      { label: 'À propos de YohannOS', icon: 'info', action: () => Y.apps.launch('settings', { section: 'about' }) }
    ]);
  }

  function iconMenu(x, y, it) {
    const sel = selectedItems();
    const files = sel.filter(i => i.kind === 'file');
    if (it.kind === 'app') {
      const pinned = Y.settings.get('pinned');
      const items = [
        { label: 'Ouvrir', icon: 'arrowRight', action: () => open(it) },
        it.app.id !== 'trash' && { label: pinned.includes(it.app.id) ? 'Détacher de la barre des tâches' : 'Épingler à la barre des tâches', icon: 'pin', action: () => Y.taskbar.togglePin(it.app.id) }
      ];
      if (it.app.id === 'trash') items.push('-', { label: 'Vider la corbeille', icon: 'trash', danger: true, disabled: !Y.fs.trashCount(), action: () => emptyTrash() });
      Y.menu.show(x, y, items);
      return;
    }
    Y.menu.show(x, y, [
      { label: 'Ouvrir', icon: 'arrowRight', action: () => sel.forEach(open) },
      !it.isDir && { label: 'Ouvrir avec', icon: 'apps', submenu: () => Y.apps.openWithMenu(it.path) },
      '-',
      { label: 'Couper', icon: 'scissors', shortcut: 'Ctrl+X', action: () => { Y.clipboard = { mode: 'cut', paths: files.map(f => f.path) }; } },
      { label: 'Copier', icon: 'copy', shortcut: 'Ctrl+C', action: () => { Y.clipboard = { mode: 'copy', paths: files.map(f => f.path) }; } },
      { label: 'Renommer', icon: 'edit', shortcut: 'F2', disabled: sel.length !== 1, action: () => { const n = U.$$('.d-icon', host).find(n => n.dataset.key === it.key); n && startRename(n); } },
      !it.isDir && { label: 'Télécharger sur mon ordinateur', icon: 'download', action: () => downloadFile(it.path) },
      '-',
      { label: 'Mettre à la corbeille', icon: 'trash', shortcut: 'Suppr', danger: true, action: () => deleteSelected() },
      '-',
      { label: 'Propriétés', icon: 'info', action: () => Y.dialog.properties(it.path) }
    ]);
  }

  function downloadFile(path) {
    const st = Y.fs.stat(path);
    if (st.url) { const a = el('a', { href: st.url, download: st.name }); document.body.appendChild(a); a.click(); a.remove(); return; }
    U.download(st.name, Y.fs.readFile(path));
  }
  Y.downloadFile = downloadFile;

  async function emptyTrash() {
    const n = Y.fs.trashCount();
    if (!n) return;
    const ok = await Y.dialog.confirm(`Supprimer définitivement ${n} élément(s) de la corbeille ?`, { title: 'Vider la corbeille', icon: 'warn', okText: 'Vider', danger: true });
    if (ok) { Y.fs.emptyTrash(); Y.sound.play('trash'); }
  }
  Y.emptyTrash = emptyTrash;

  function deleteSelected() {
    const files = selectedItems().filter(i => i.kind === 'file');
    if (!files.length) return;
    try { files.forEach(f => Y.fs.trash(f.path)); Y.sound.play('trash'); }
    catch (e) { Y.dialog.alert(e.message, { icon: 'err' }); }
    setSelection([]);
  }

  function startRename(node) {
    const it = node._item;
    if (it.kind !== 'file') return;
    const label = node.querySelector('.d-label');
    const input = el('input.rename', { value: it.name, spellcheck: 'false' });
    label.replaceWith(input);
    input.focus();
    const dot = it.isDir ? -1 : it.name.lastIndexOf('.');
    input.setSelectionRange(0, dot > 0 ? dot : it.name.length);
    let done = false;
    const finish = ok => {
      if (done) return; done = true;
      const v = input.value.trim();
      if (ok && v && v !== it.name) {
        try { const np = Y.fs.rename(it.path, v); setSelection(['file:' + np]); }
        catch (e) { Y.dialog.alert(e.message, { icon: 'err', title: 'Renommer' }); render(); }
      } else render();
    };
    input.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') finish(true); if (e.key === 'Escape') finish(false); });
    input.addEventListener('blur', () => finish(true));
    input.addEventListener('pointerdown', e => e.stopPropagation());
  }

  /* ---------- Import de fichiers réels ---------- */
  const TEXT_EXT = ['txt', 'md', 'html', 'htm', 'css', 'js', 'json', 'py', 'php', 'csv', 'xml', 'svg', 'sh', 'c', 'cpp', 'h', 'java', 'ts', 'log', 'ini', 'yml', 'yaml', 'seq', 'url'];
  async function importFiles(fileList, dir) {
    let n = 0;
    for (const f of Array.from(fileList)) {
      const ext = (f.name.split('.').pop() || '').toLowerCase();
      try {
        if (f.size > 3 * 1024 * 1024) { Y.notify({ title: 'Fichier trop volumineux', body: `${f.name} dépasse 3 Mo et n'a pas été importé.`, type: 'error', icon: 'alert' }); continue; }
        const isText = f.type.startsWith('text/') || TEXT_EXT.includes(ext);
        const content = await U.readFileAs(f, isText && ext !== 'svg' ? 'text' : 'dataurl');
        Y.fs.writeFile(Y.fs.uniqueName(dir, f.name), content);
        n++;
      } catch (e) { console.error(e); }
    }
    if (n) Y.notify({ title: 'Import terminé', body: `${n} fichier(s) importé(s) dans ${Y.fs.pretty(dir)}.`, icon: 'upload', type: 'success' });
  }
  Y.importFiles = importFiles;

  Y.desktop = {
    init() {
      host = document.getElementById('desktop-icons');
      selRect = document.getElementById('selection-rect');
      positions = U.store.get('desktop-pos', {});
      const desk = document.getElementById('desktop');
      host.addEventListener('pointerdown', e => { if (e.target === host) startRubber(e); });
      host.addEventListener('contextmenu', e => { if (e.target === host) { e.preventDefault(); setSelection([]); desktopMenu(e.clientX, e.clientY); } });
      document.getElementById('wallpaper').addEventListener('contextmenu', e => { e.preventDefault(); desktopMenu(e.clientX, e.clientY); });

      // glisser-déposer depuis l'ordinateur
      let depth = 0;
      desk.addEventListener('dragenter', e => { if (e.dataTransfer && Array.from(e.dataTransfer.types).includes('Files') && !e.target.closest('.win')) { depth++; desk.classList.add('file-drop'); } });
      desk.addEventListener('dragleave', () => { depth = Math.max(0, depth - 1); if (!depth) desk.classList.remove('file-drop'); });
      desk.addEventListener('dragover', e => { if (!e.target.closest('.win')) e.preventDefault(); });
      desk.addEventListener('drop', e => {
        depth = 0; desk.classList.remove('file-drop');
        if (e.target.closest('.win')) return;
        e.preventDefault();
        if (e.dataTransfer.files.length) importFiles(e.dataTransfer.files, DESK());
      });

      // clavier quand le bureau a le focus
      document.addEventListener('keydown', e => {
        if (Y.boot.isLocked()) return;
        if (document.activeElement && document.activeElement !== document.body && !document.activeElement.classList.contains('d-icon')) return;
        if (Y.menu.isOpen()) return;
        const sel = selectedItems();
        if (e.key === 'Delete') deleteSelected();
        else if (e.key === 'Enter' && sel.length) sel.forEach(open);
        else if (e.key === 'F2' && sel.length === 1) { e.preventDefault(); const n = U.$$('.d-icon', host).find(n => n.dataset.key === sel[0].key); n && startRename(n); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'a') { e.preventDefault(); setSelection(items().map(i => i.key)); }
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'c' && sel.length) Y.clipboard = { mode: 'copy', paths: sel.filter(i => i.kind === 'file').map(i => i.path) };
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'x' && sel.length) Y.clipboard = { mode: 'cut', paths: sel.filter(i => i.kind === 'file').map(i => i.path) };
        else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'v') paste(DESK());
      });

      Y.bus.on('fs:change', p => { if (p === DESK() || p === '/' || p === Y.fs.TRASH || p === Y.fs.HOME) render(); });
      Y.bus.on('trash:change', render);
      window.addEventListener('resize', U.debounce(render, 150));
      render();
    },
    render,
    newItem
  };
})(window.YOS);
