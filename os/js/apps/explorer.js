/* YohannOS — Explorateur de fichiers (+ Corbeille) */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const FS = Y.fs;
  const IMG = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];
  const TYPE_NAMES = { txt: 'Texte', md: 'Markdown', html: 'Page HTML', css: 'Feuille CSS', js: 'JavaScript', json: 'JSON', py: 'Python', php: 'PHP', png: 'Image PNG', jpg: 'Image JPEG', jpeg: 'Image JPEG', gif: 'Image GIF', webp: 'Image WebP', svg: 'Image SVG', seq: 'Rythme', url: 'Raccourci web', csv: 'Tableau CSV' };

  function launch(args) {
    let cwd = FS.isDir(args.path || '') ? FS.normalize(args.path) : FS.HOME;
    let back = [], fwd = [];
    let view = U.store.get('explorer-view', 'grid');
    let sort = U.store.get('explorer-sort', 'name');
    let selection = new Set();
    let anchor = null;
    let filter = '';
    let entries = [];

    /* ---------- Interface ---------- */
    const btn = (icon, title, fn) => { const b = el('button.btn.ghost.icon', { title, html: Y.icons.svg(icon, 17) }); b.addEventListener('click', fn); return b; };
    const bBack = btn('arrowLeft', 'Précédent (Alt+←)', () => goBack());
    const bFwd = btn('arrowRight', 'Suivant (Alt+→)', () => goFwd());
    const bUp = btn('arrowUp', 'Dossier parent (Retour arrière)', () => navigate(FS.dirname(cwd)));
    const crumbs = el('div.ex-crumbs');
    const pathInput = el('input.input.ex-path-input.hidden', { spellcheck: 'false' });
    const pathBox = el('div.ex-path', crumbs, pathInput);
    const search = el('input.input.ex-search', { placeholder: 'Rechercher…', spellcheck: 'false' });
    const bView = btn(view === 'grid' ? 'listView' : 'gridView', 'Changer l\'affichage', () => { view = view === 'grid' ? 'list' : 'grid'; U.store.set('explorer-view', view); bView.innerHTML = Y.icons.svg(view === 'grid' ? 'listView' : 'gridView', 17); render(); });
    const bNew = el('button.btn.sm', { html: Y.icons.svg('plus', 15) + ' Nouveau' });
    bNew.addEventListener('click', () => Y.menu.showFor(bNew, newMenu()));
    const bSort = btn('sort', 'Trier', () => Y.menu.showFor(bSort, [
      { label: 'Nom', checked: sort === 'name', action: () => setSort('name') },
      { label: 'Taille', checked: sort === 'size', action: () => setSort('size') },
      { label: 'Date de modification', checked: sort === 'date', action: () => setSort('date') },
      { label: 'Type', checked: sort === 'type', action: () => setSort('type') }
    ]));
    const trashBar = el('div.ex-trashbar.hidden',
      el('span', { html: Y.icons.svg('trash', 16) + ' Corbeille — les éléments sont conservés jusqu\'à ce que vous la vidiez.' }),
      el('span.grow'),
      el('button.btn.sm', { onclick: () => restoreSelected() }, 'Restaurer la sélection'),
      el('button.btn.sm.danger', { onclick: () => Y.emptyTrash() }, 'Vider la corbeille'));
    const toolbar = el('div.toolbar.ex-toolbar', bBack, bFwd, bUp, pathBox, search, el('div.sep'), bNew, bSort, bView);

    const side = el('div.ex-side');
    const places = [
      ['Dossier perso', FS.HOME, 'home'], ['Bureau', FS.HOME + '/Bureau', 'monitor'], ['Documents', FS.HOME + '/Documents', 'fileText'],
      ['Images', FS.HOME + '/Images', 'image'], ['Musique', FS.HOME + '/Musique', 'music'], ['Téléchargements', FS.HOME + '/Téléchargements', 'download']
    ];
    function renderSide() {
      side.innerHTML = '';
      side.appendChild(el('div.ex-side-title', 'Favoris'));
      places.forEach(([n, p, ic]) => side.appendChild(placeBtn(n, p, ic)));
      side.appendChild(el('div.ex-side-title', 'Système'));
      side.appendChild(placeBtn('Racine /', '/', 'drive'));
      side.appendChild(placeBtn('Corbeille', FS.TRASH, FS.trashCount() ? 'trashFull' : 'trash'));
      const used = FS.usage(), quota = 5 * 1024 * 1024;
      side.appendChild(el('div.ex-storage',
        el('div.row', { html: Y.icons.svg('drive', 15) + '<span>Stockage local</span>' }),
        el('div.ex-storage-bar', el('i', { style: { width: Math.min(100, used / quota * 100) + '%' } })),
        el('div.faint', `${U.formatBytes(used)} utilisés sur ≈ 5 Mo`)));
    }
    function placeBtn(n, p, ic) {
      const b = el('button.ex-place', { class: cwd === p ? 'active' : null, html: Y.icons.svg(ic, 16) + `<span>${n}</span>`, dataset: { dropPath: p } });
      b.addEventListener('click', () => navigate(p));
      setupDrop(b, () => p);
      return b;
    }

    const main = el('div.ex-main', { tabindex: '0' });
    const status = el('div.statusbar');
    const content = el('div.ex', toolbar, trashBar, el('div.ex-body', side, main), status);
    const win = Y.apps.window('explorer', { content, width: 820, height: 520, minWidth: 420, minHeight: 280 });

    /* ---------- Navigation ---------- */
    function navigate(p, noHistory) {
      p = FS.normalize(p, cwd);
      if (!FS.isDir(p)) { Y.dialog.alert(`Le dossier « ${FS.pretty(p)} » est introuvable.`, { icon: 'err', parent: win }); return; }
      if (p !== cwd && !noHistory) { back.push(cwd); fwd = []; }
      cwd = p;
      selection.clear();
      anchor = null;
      filter = '';
      search.value = '';
      render();
    }
    function goBack() { if (back.length) { fwd.push(cwd); navigate(back.pop(), true); } }
    function goFwd() { if (fwd.length) { back.push(cwd); navigate(fwd.pop(), true); } }
    function setSort(s) { sort = s; U.store.set('explorer-sort', s); render(); }

    function renderCrumbs() {
      crumbs.innerHTML = '';
      const parts = cwd === '/' ? [] : cwd.slice(1).split('/');
      const root = el('button.ex-crumb', { html: Y.icons.svg('drive', 14) });
      root.addEventListener('click', e => { e.stopPropagation(); navigate('/'); });
      crumbs.appendChild(root);
      let acc = '';
      parts.forEach((seg, i) => {
        acc += '/' + seg;
        const target = acc;
        crumbs.appendChild(el('span.ex-crumb-sep', { html: Y.icons.svg('chevronRight', 12) }));
        const label = target === FS.HOME ? 'yohann' : target === FS.TRASH ? 'Corbeille' : seg;
        const b = el('button.ex-crumb', { class: i === parts.length - 1 ? 'last' : null }, label);
        b.addEventListener('click', e => { e.stopPropagation(); navigate(target); });
        crumbs.appendChild(b);
      });
      crumbs.scrollLeft = crumbs.scrollWidth;
    }
    pathBox.addEventListener('click', () => {
      crumbs.classList.add('hidden'); pathInput.classList.remove('hidden');
      pathInput.value = cwd; pathInput.focus(); pathInput.select();
    });
    const closePathInput = () => { pathInput.classList.add('hidden'); crumbs.classList.remove('hidden'); };
    pathInput.addEventListener('keydown', e => {
      e.stopPropagation();
      if (e.key === 'Enter') { const v = pathInput.value.trim(); closePathInput(); if (FS.isFile(FS.normalize(v, cwd))) Y.apps.openFile(FS.normalize(v, cwd)); else navigate(v); }
      if (e.key === 'Escape') closePathInput();
    });
    pathInput.addEventListener('blur', closePathInput);
    search.addEventListener('input', () => { filter = search.value.trim().toLowerCase(); render(); });
    search.addEventListener('keydown', e => e.stopPropagation());

    /* ---------- Rendu ---------- */
    function load() {
      try { entries = FS.readdir(cwd, { all: cwd === FS.TRASH ? false : !!U.store.get('explorer-hidden', false) }); }
      catch (e) { entries = []; }
      if (filter) {
        entries = FS.find(cwd, name => name.toLowerCase().includes(filter) && !name.startsWith('.'), 200).map(p => {
          const st = FS.stat(p);
          return { name: st.name, path: p, isDir: st.isDir, size: st.size, mtime: st.mtime, meta: st.meta, url: st.url };
        });
      }
      const cmp = {
        name: (a, b) => a.name.localeCompare(b.name, 'fr', { numeric: true, sensitivity: 'base' }),
        size: (a, b) => b.size - a.size,
        date: (a, b) => b.mtime - a.mtime,
        type: (a, b) => FS.ext(a.name).localeCompare(FS.ext(b.name)) || a.name.localeCompare(b.name)
      }[sort];
      entries.sort((a, b) => (b.isDir - a.isDir) || cmp(a, b));
    }

    function render() {
      load();
      const inTrash = cwd === FS.TRASH;
      trashBar.classList.toggle('hidden', !inTrash);
      bNew.disabled = inTrash;
      bBack.disabled = !back.length; bFwd.disabled = !fwd.length; bUp.disabled = cwd === '/';
      win.setTitle(cwd === FS.TRASH ? 'Corbeille' : cwd === '/' ? 'Racine' : (cwd === FS.HOME ? 'Dossier perso' : FS.basename(cwd)));
      main.dataset.dropPath = cwd;
      main.className = 'ex-main ' + (view === 'grid' ? 'grid' : 'list');
      renderCrumbs();
      renderSide();
      main.innerHTML = '';
      if (view === 'list') {
        main.appendChild(el('div.ex-row.ex-head',
          el('span.c-name', 'Nom'), el('span.c-date', inTrash ? 'Emplacement d\'origine' : 'Modifié le'), el('span.c-type', 'Type'), el('span.c-size', 'Taille')));
      }
      if (!entries.length) {
        main.appendChild(el('div.empty-state', { html: Y.icons.svg(filter ? 'search' : inTrash ? 'trash' : 'folderOpen', 42) }, el('div', filter ? `Aucun résultat pour « ${filter} »` : inTrash ? 'La corbeille est vide' : 'Ce dossier est vide')));
      }
      entries.forEach(e => main.appendChild(itemNode(e, inTrash)));
      updateStatus();
    }

    function iconFor(e, size) {
      if (!e.isDir && IMG.includes(FS.ext(e.name)) && view === 'grid') {
        const src = FS.getUrl(e.path);
        if (src) return `<img class="ex-thumb" src="${U.escape(src)}" alt="" loading="lazy">`;
      }
      if (!e.isDir && FS.ext(e.name) === 'url') return Y.icons.tile('globe', ['#43cea2', '#185a9d'], size * 0.85);
      return Y.icons.fileIcon(e.name, e.isDir, size);
    }

    function itemNode(e, inTrash) {
      const ext = FS.ext(e.name);
      const typeName = e.isDir ? 'Dossier' : (TYPE_NAMES[ext] || (ext ? `Fichier ${ext.toUpperCase()}` : 'Fichier'));
      let n;
      if (view === 'grid') {
        n = el('div.ex-item', { title: e.name }, el('div.ex-ico', { html: iconFor(e, 52) }), el('div.ex-name', { html: e.isDir ? U.escape(e.name) : U.fileLabel(e.name) }));
      } else {
        n = el('div.ex-row',
          el('span.c-name', { html: iconFor(e, 20) }, el('span', e.name)),
          el('span.c-date', inTrash ? FS.pretty((e.meta && e.meta.origin) || '?') : U.formatDate(e.mtime)),
          el('span.c-type', typeName),
          el('span.c-size', e.isDir ? `${e.size} élément${e.size > 1 ? 's' : ''}` : U.formatBytes(e.size)));
      }
      n.dataset.path = e.path;
      n._entry = e;
      if (e.isDir) n.dataset.dropPath = e.path;
      if (selection.has(e.path)) n.classList.add('selected');
      if (Y.clipboard.mode === 'cut' && Y.clipboard.paths.includes(e.path)) n.classList.add('cut');
      n.draggable = true;
      n.addEventListener('click', ev => select(e.path, ev));
      n.addEventListener('dblclick', () => openEntry(e));
      n.addEventListener('contextmenu', ev => {
        ev.preventDefault(); ev.stopPropagation();
        if (!selection.has(e.path)) select(e.path, {});
        itemMenu(ev.clientX, ev.clientY, e, inTrash);
      });
      n.addEventListener('dragstart', ev => {
        if (!selection.has(e.path)) select(e.path, {});
        ev.dataTransfer.setData('application/x-yos-paths', JSON.stringify(Array.from(selection)));
        ev.dataTransfer.setData('text/plain', Array.from(selection).join('\n'));
        ev.dataTransfer.effectAllowed = 'copyMove';
      });
      if (e.isDir) setupDrop(n, () => e.path);
      return n;
    }

    function setupDrop(node, getPath) {
      node.addEventListener('dragover', ev => {
        const types = Array.from(ev.dataTransfer.types);
        if (!types.includes('application/x-yos-paths') && !types.includes('Files')) return;
        ev.preventDefault(); ev.stopPropagation();
        ev.dataTransfer.dropEffect = ev.ctrlKey ? 'copy' : 'move';
        node.classList.add('drop-target');
      });
      node.addEventListener('dragleave', () => node.classList.remove('drop-target'));
      node.addEventListener('drop', ev => {
        ev.preventDefault(); ev.stopPropagation();
        node.classList.remove('drop-target');
        handleDrop(ev, getPath());
      });
    }
    setupDrop(main, () => cwd);

    function handleDrop(ev, dest) {
      if (ev.dataTransfer.files && ev.dataTransfer.files.length) { Y.importFiles(ev.dataTransfer.files, dest); return; }
      let paths = [];
      try { paths = JSON.parse(ev.dataTransfer.getData('application/x-yos-paths') || '[]'); } catch (e) { /* ignore */ }
      try {
        paths.forEach(p => {
          if (p === dest || FS.dirname(p) === dest && !ev.ctrlKey) return;
          if (dest === FS.TRASH) FS.trash(p);
          else if (ev.ctrlKey) FS.copy(p, dest);
          else FS.move(p, dest);
        });
      } catch (e) { Y.dialog.alert(e.message, { icon: 'err', parent: win }); }
    }

    /* ---------- Sélection & actions ---------- */
    function select(path, ev) {
      const paths = entries.map(e => e.path);
      if (ev.shiftKey && anchor) {
        const a = paths.indexOf(anchor), b = paths.indexOf(path);
        selection = new Set(paths.slice(Math.min(a, b), Math.max(a, b) + 1));
      } else if (ev.ctrlKey || ev.metaKey) {
        selection.has(path) ? selection.delete(path) : selection.add(path);
        anchor = path;
      } else { selection = new Set([path]); anchor = path; }
      main.querySelectorAll('[data-path]').forEach(n => n.classList.toggle('selected', selection.has(n.dataset.path)));
      updateStatus();
    }
    main.addEventListener('click', e => { if (e.target === main || e.target.classList.contains('empty-state')) { selection.clear(); render(); } });
    main.addEventListener('contextmenu', e => {
      if (e.target.closest('[data-path]')) return;
      e.preventDefault();
      if (cwd === FS.TRASH) { Y.menu.show(e.clientX, e.clientY, [{ label: 'Vider la corbeille', icon: 'trash', danger: true, disabled: !FS.trashCount(), action: () => Y.emptyTrash() }]); return; }
      Y.menu.show(e.clientX, e.clientY, [
        { label: 'Nouveau', icon: 'plus', submenu: newMenu() },
        { label: 'Coller', icon: 'clipboard', shortcut: 'Ctrl+V', disabled: !Y.clipboard.paths.length, action: () => Y.pasteInto(cwd) },
        '-',
        { label: 'Affichage', icon: 'gridView', submenu: [
          { label: 'Grandes icônes', checked: view === 'grid', action: () => { view = 'grid'; U.store.set('explorer-view', view); render(); } },
          { label: 'Détails', checked: view === 'list', action: () => { view = 'list'; U.store.set('explorer-view', view); render(); } },
          '-',
          { label: 'Afficher les fichiers cachés', checked: !!U.store.get('explorer-hidden', false), action: () => { U.store.set('explorer-hidden', !U.store.get('explorer-hidden', false)); render(); } }
        ] },
        { label: 'Actualiser', icon: 'refresh', action: render },
        '-',
        { label: 'Ouvrir un terminal ici', icon: 'terminal', action: () => Y.apps.launch('terminal', { cwd }) },
        { label: 'Importer des fichiers…', icon: 'upload', action: () => pickImport() },
        { label: 'Propriétés', icon: 'info', action: () => Y.dialog.properties(cwd, win) }
      ]);
    });

    function newMenu() {
      return [
        { label: 'Dossier', icon: 'folder', action: () => create('folder') },
        '-',
        { label: 'Document texte', icon: 'fileText', action: () => create('txt') },
        { label: 'Note Markdown', icon: 'fileText', action: () => create('md') },
        { label: 'Page HTML', icon: 'code', action: () => create('html') },
        { label: 'Script JavaScript', icon: 'code', action: () => create('js') },
        '-',
        { label: 'Importer depuis mon ordinateur…', icon: 'upload', action: () => pickImport() }
      ];
    }
    function create(kind) {
      const defs = { folder: ['Nouveau dossier'], txt: ['Nouveau document.txt', ''], md: ['Nouvelle note.md', '# Nouvelle note\n\n'], html: ['index.html', '<!DOCTYPE html>\n<html lang="fr">\n<head>\n  <meta charset="UTF-8">\n  <title>Page</title>\n</head>\n<body>\n  <h1>Bonjour !</h1>\n</body>\n</html>\n'], js: ['script.js', '// Mon script\nconsole.log("Bonjour !");\n'] };
      const [name, body] = defs[kind];
      try {
        const p = FS.uniqueName(cwd, name);
        if (kind === 'folder') FS.mkdir(p); else FS.writeFile(p, body);
        selection = new Set([p]);
        render();
        const node = main.querySelector(`[data-path="${CSS.escape(p)}"]`);
        if (node) startRename(node);
      } catch (e) { Y.dialog.alert(e.message, { icon: 'err', parent: win }); }
    }
    function pickImport() {
      const inp = el('input', { type: 'file', multiple: true });
      inp.addEventListener('change', () => Y.importFiles(inp.files, cwd));
      inp.click();
    }

    function openEntry(e) {
      if (e.isDir) navigate(e.path);
      else if (cwd === FS.TRASH) Y.dialog.alert('Restaurez cet élément pour pouvoir l\'ouvrir.', { parent: win });
      else Y.apps.openFile(e.path);
    }
    const selEntries = () => entries.filter(e => selection.has(e.path));

    function itemMenu(x, y, e, inTrash) {
      const sel = selEntries();
      if (inTrash) {
        Y.menu.show(x, y, [
          { label: 'Restaurer', icon: 'undo', action: restoreSelected },
          { label: 'Supprimer définitivement', icon: 'x', danger: true, action: deleteSelected },
          '-',
          { label: 'Propriétés', icon: 'info', disabled: sel.length !== 1, action: () => Y.dialog.properties(e.path, win) }
        ]);
        return;
      }
      Y.menu.show(x, y, [
        { label: 'Ouvrir', icon: 'arrowRight', action: () => sel.forEach(openEntry) },
        !e.isDir && { label: 'Ouvrir avec', icon: 'apps', submenu: () => Y.apps.openWithMenu(e.path) },
        e.isDir && { label: 'Ouvrir dans une nouvelle fenêtre', icon: 'external', action: () => Y.apps.launch('explorer', { path: e.path }) },
        '-',
        { label: 'Couper', icon: 'scissors', shortcut: 'Ctrl+X', action: () => cut() },
        { label: 'Copier', icon: 'copy', shortcut: 'Ctrl+C', action: () => copy() },
        e.isDir && { label: 'Coller dans ce dossier', icon: 'clipboard', disabled: !Y.clipboard.paths.length, action: () => Y.pasteInto(e.path) },
        { label: 'Dupliquer', icon: 'copy', action: () => sel.forEach(s => FS.copy(s.path, cwd)) },
        { label: 'Renommer', icon: 'edit', shortcut: 'F2', disabled: sel.length !== 1, action: () => { const n = main.querySelector(`[data-path="${CSS.escape(e.path)}"]`); n && startRename(n); } },
        '-',
        !e.isDir && IMG.includes(FS.ext(e.name)) && { label: 'Définir comme fond d\'écran', icon: 'image', action: () => { Y.settings.set('customWallpaper', FS.getUrl(e.path)); Y.settings.set('wallpaper', 'custom'); } },
        !e.isDir && { label: 'Télécharger sur mon ordinateur', icon: 'download', action: () => Y.downloadFile(e.path) },
        { label: 'Copier le chemin', icon: 'link', action: () => navigator.clipboard && navigator.clipboard.writeText(e.path).catch(() => {}) },
        '-',
        { label: 'Mettre à la corbeille', icon: 'trash', shortcut: 'Suppr', danger: true, action: trashSelected },
        { label: 'Propriétés', icon: 'info', action: () => Y.dialog.properties(e.path, win) }
      ]);
    }

    const cut = () => { Y.clipboard = { mode: 'cut', paths: Array.from(selection) }; render(); };
    const copy = () => { Y.clipboard = { mode: 'copy', paths: Array.from(selection) }; };
    function trashSelected() {
      if (!selection.size) return;
      try { Array.from(selection).forEach(p => FS.trash(p)); Y.sound.play('trash'); }
      catch (e) { Y.dialog.alert(e.message, { icon: 'err', parent: win }); }
      selection.clear();
    }
    async function deleteSelected() {
      if (!selection.size) return;
      const ok = await Y.dialog.confirm(`Supprimer définitivement ${selection.size} élément(s) ? Cette action est irréversible.`, { icon: 'warn', okText: 'Supprimer', danger: true, parent: win });
      if (!ok) return;
      try { Array.from(selection).forEach(p => FS.rm(p, { recursive: true })); Y.bus.emit('trash:change'); }
      catch (e) { Y.dialog.alert(e.message, { icon: 'err', parent: win }); }
      selection.clear();
    }
    function restoreSelected() {
      if (!selection.size) return;
      try { Array.from(selection).forEach(p => FS.restore(p)); Y.notify({ title: 'Éléments restaurés', body: `${selection.size} élément(s) remis à leur emplacement d'origine.`, app: 'explorer' }); }
      catch (e) { Y.dialog.alert(e.message, { icon: 'err', parent: win }); }
      selection.clear();
    }

    function startRename(node) {
      const e = node._entry;
      const nameEl = node.querySelector('.ex-name') || node.querySelector('.c-name span');
      const input = el('input.ex-rename', { value: e.name, spellcheck: 'false' });
      nameEl.replaceWith(input);
      input.focus();
      const dot = e.isDir ? -1 : e.name.lastIndexOf('.');
      input.setSelectionRange(0, dot > 0 ? dot : e.name.length);
      let done = false;
      const finish = ok => {
        if (done) return; done = true;
        const v = input.value.trim();
        if (ok && v && v !== e.name) {
          try { const np = FS.rename(e.path, v); selection = new Set([np]); }
          catch (err) { Y.dialog.alert(err.message, { icon: 'err', parent: win }); }
        }
        render();
      };
      input.addEventListener('keydown', ev => { ev.stopPropagation(); if (ev.key === 'Enter') finish(true); if (ev.key === 'Escape') finish(false); });
      input.addEventListener('blur', () => finish(true));
      input.addEventListener('click', ev => ev.stopPropagation());
      input.addEventListener('dblclick', ev => ev.stopPropagation());
    }

    function updateStatus() {
      const sel = selEntries();
      const size = sel.filter(e => !e.isDir).reduce((s, e) => s + e.size, 0);
      status.innerHTML = '';
      status.append(...[
        el('span', `${entries.length} élément${entries.length > 1 ? 's' : ''}`),
        sel.length ? el('span', `${sel.length} sélectionné${sel.length > 1 ? 's' : ''}${size ? ' — ' + U.formatBytes(size) : ''}`) : null,
        el('span.grow'),
        el('span.mono', FS.pretty(cwd))].filter(Boolean));
    }

    /* ---------- Clavier ---------- */
    win.el.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      const ctrl = e.ctrlKey || e.metaKey;
      const k = e.key;
      if (k === 'Delete') { cwd === FS.TRASH ? deleteSelected() : trashSelected(); }
      else if (k === 'Enter') selEntries().forEach(openEntry);
      else if (k === 'Backspace' || (e.altKey && k === 'ArrowUp')) { e.preventDefault(); navigate(FS.dirname(cwd)); }
      else if (e.altKey && k === 'ArrowLeft') goBack();
      else if (e.altKey && k === 'ArrowRight') goFwd();
      else if (k === 'F2') { e.preventDefault(); const p = Array.from(selection)[0]; const n = p && main.querySelector(`[data-path="${CSS.escape(p)}"]`); n && startRename(n); }
      else if (k === 'F5') { e.preventDefault(); render(); }
      else if (ctrl && k.toLowerCase() === 'a') { e.preventDefault(); selection = new Set(entries.map(x => x.path)); render(); }
      else if (ctrl && k.toLowerCase() === 'c') copy();
      else if (ctrl && k.toLowerCase() === 'x') cut();
      else if (ctrl && k.toLowerCase() === 'v') Y.pasteInto(cwd);
      else if (ctrl && k.toLowerCase() === 'f') { e.preventDefault(); search.focus(); }
      else if (['ArrowDown', 'ArrowUp', 'ArrowLeft', 'ArrowRight'].includes(k) && entries.length) {
        e.preventDefault();
        const paths = entries.map(x => x.path);
        let i = anchor ? paths.indexOf(anchor) : -1;
        const perRow = view === 'grid' ? Math.max(1, Math.floor(main.clientWidth / 104)) : 1;
        const delta = { ArrowDown: perRow, ArrowUp: -perRow, ArrowLeft: -1, ArrowRight: 1 }[k];
        i = U.clamp(i + delta, 0, paths.length - 1);
        select(paths[i], {});
        const n = main.querySelector(`[data-path="${CSS.escape(paths[i])}"]`);
        n && n.scrollIntoView({ block: 'nearest' });
      }
    });

    win.listen('fs:change', p => {
      if (p === cwd || p === '/' || cwd.startsWith(p + '/') || p === FS.TRASH) {
        if (!FS.isDir(cwd)) { cwd = FS.HOME; }
        render();
      }
    });
    win.listen('trash:change', renderSide);
    render();
    setTimeout(() => main.focus(), 50);

    win.navigate = navigate;
    return win;
  }

  Y.apps.register({
    id: 'explorer', name: 'Fichiers', icon: 'folder', color: ['#ffb547', '#ff8a00'], category: 'Système',
    description: 'Explorer et gérer vos fichiers', keywords: 'explorateur dossier finder files',
    desktop: true, desktopOrder: 2, launch,
    onReopen(win, args) { if (args.path && win.navigate) win.navigate(args.path); }
  });

  Y.apps.register({
    id: 'trash', name: 'Corbeille', icon: 'trash', color: ['#a7b1c2', '#6b7688'], category: 'Système',
    description: 'Éléments supprimés', keywords: 'trash poubelle',
    desktop: true, desktopOrder: 99,
    launch() {
      const existing = Y.wm.byApp('explorer').find(w => w.title === 'Corbeille');
      if (existing) { existing.focus(); return existing; }
      return launch({ path: Y.fs.TRASH });
    }
  });
})(window.YOS);
