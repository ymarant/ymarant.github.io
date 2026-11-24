/* =========================================================
   YohannOS — boîtes de dialogue (alert, confirm, prompt,
   ouvrir/enregistrer un fichier, propriétés)
   ========================================================= */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;

  function base({ title, icon = 'info', message, buttons, input, parent, width = 420 }) {
    return new Promise(resolve => {
      let result;
      const icoCls = icon === 'warn' ? 'warn' : icon === 'err' ? 'err' : '';
      const icoName = icon === 'warn' ? 'alert' : icon === 'err' ? 'alert' : icon === 'question' ? 'help' : icon;
      const text = el('div.dlg-text', message);
      let inp = null;
      if (input) {
        inp = el('input.input', { value: input.value || '', placeholder: input.placeholder || '', spellcheck: 'false' });
        text.appendChild(inp);
      }
      const btns = el('div.dlg-buttons');
      const root = el('div.dlg', el('div.dlg-main', el('div.dlg-ico', { class: icoCls, html: Y.icons.svg(icoName, 22) }), text), btns);
      const win = Y.wm.create({
        title: title || 'YohannOS', content: root, width, height: input ? 210 : 190,
        resizable: false, minimizable: false, parent: parent || null, modal: !!parent,
        iconHtml: Y.icons.svg(icoName, 16), className: 'dialog-win'
      });
      buttons.forEach(b => {
        const btn = el('button.btn', { class: b.primary ? 'primary' : b.danger ? 'danger' : null }, b.label);
        btn.addEventListener('click', () => { result = b.value === '__input' ? inp.value : b.value; win.close(true); });
        btns.appendChild(btn);
      });
      win.on('close', () => resolve(result === undefined ? (buttons.find(b => b.cancel) || {}).value ?? null : result));
      win.el.addEventListener('keydown', e => {
        if (e.key === 'Enter') { e.preventDefault(); const p = buttons.find(b => b.primary) || buttons[0]; result = p.value === '__input' ? inp.value : p.value; win.close(true); }
        else if (e.key === 'Escape') { e.preventDefault(); win.close(true); }
      });
      // ajuster la hauteur au contenu
      requestAnimationFrame(() => {
        const need = root.querySelector('.dlg-main').scrollHeight + btns.offsetHeight + win.titlebar.offsetHeight + 4;
        win.setSize(width, Math.min(Math.max(need, 150), window.innerHeight - 80));
        if (win.parent) {
          const pr = win.parent.rect(), r = win.inlineRect();
          win.setRect(pr.x + (pr.w - r.w) / 2, pr.y + Math.max(30, (pr.h - r.h) / 3), r.w, r.h);
          win.clampIntoView();
        } else win.center();
        if (inp) { inp.focus(); inp.select(); } else { const p = btns.querySelector('.primary') || btns.lastChild; p && p.focus(); }
      });
      Y.sound.play(icon === 'err' ? 'error' : 'pop');
    });
  }

  const dialog = {
    alert(message, o = {}) {
      return base({ title: o.title || 'Information', icon: o.icon || 'info', message, parent: o.parent, buttons: [{ label: 'OK', value: true, primary: true, cancel: true }] });
    },
    confirm(message, o = {}) {
      return base({
        title: o.title || 'Confirmation', icon: o.icon || 'question', message, parent: o.parent,
        buttons: [{ label: o.cancelText || 'Annuler', value: false, cancel: true }, { label: o.okText || 'OK', value: true, primary: !o.danger, danger: !!o.danger }]
      });
    },
    /** Trois choix : renvoie 'yes' | 'no' | null (annuler) */
    ask3(message, o = {}) {
      return base({
        title: o.title || 'Confirmation', icon: o.icon || 'warn', message, parent: o.parent, width: 460,
        buttons: [{ label: o.cancelText || 'Annuler', value: null, cancel: true }, { label: o.noText || 'Ne pas enregistrer', value: 'no' }, { label: o.yesText || 'Enregistrer', value: 'yes', primary: true }]
      });
    },
    prompt(message, o = {}) {
      return base({
        title: o.title || 'Saisie', icon: o.icon || 'edit', message, parent: o.parent, input: { value: o.value, placeholder: o.placeholder },
        buttons: [{ label: 'Annuler', value: null, cancel: true }, { label: o.okText || 'OK', value: '__input', primary: true }]
      });
    },

    /* ---------- Sélecteur de fichiers ---------- */
    openFile(o = {}) { return filePicker(Object.assign({ mode: 'open' }, o)); },
    saveFile(o = {}) { return filePicker(Object.assign({ mode: 'save' }, o)); },
    pickFolder(o = {}) { return filePicker(Object.assign({ mode: 'folder' }, o)); },

    properties(path, parent) {
      const st = Y.fs.stat(path);
      if (!st) return;
      const rows = [
        ['Type', st.isDir ? 'Dossier' : (Y.fs.ext(path) ? `Fichier ${Y.fs.ext(path).toUpperCase()}` : 'Fichier')],
        ['Emplacement', Y.fs.pretty(Y.fs.dirname(path))],
        ['Taille', st.isDir ? `${st.size} élément(s) — ${U.formatBytes(Y.fs.sizeOf(Y.fs._root() && nodeAt(path)))}` : U.formatBytes(st.size)],
        ['Créé le', U.formatDate(st.ctime, { dateStyle: 'long', timeStyle: 'short' })],
        ['Modifié le', U.formatDate(st.mtime, { dateStyle: 'long', timeStyle: 'short' })],
        ['Ouvrir avec', st.isDir ? 'Fichiers' : ((Y.apps.forFile(path)[0] || {}).name || '—')]
      ];
      if (st.meta && st.meta.origin) rows.push(['Origine', Y.fs.pretty(st.meta.origin)]);
      const box = el('div.props.selectable',
        el('div.head', { html: Y.icons.fileIcon(st.name, st.isDir, 40) }, el('span', st.name)),
        rows.map(([k, v]) => [el('div.k', k), el('div.v', v)])
      );
      const w = Y.wm.create({ title: `Propriétés — ${st.name}`, content: box, width: 420, height: 330, resizable: false, iconHtml: Y.icons.svg('info', 16), parent: parent || null });
      return w;
    }
  };

  function nodeAt(path) {
    let cur = Y.fs._root();
    for (const seg of Y.fs.normalize(path).slice(1).split('/').filter(Boolean)) cur = cur && cur.children && cur.children[seg];
    return cur || { type: 'file', content: '' };
  }

  function filePicker(o) {
    return new Promise(resolve => {
      let cwd = Y.fs.isDir(o.dir || '') ? Y.fs.normalize(o.dir) : Y.fs.HOME + '/Documents';
      let selected = null, result = null;
      const exts = o.exts ? o.exts.map(e => e.toLowerCase()) : null;
      const pathInput = el('input.input', { spellcheck: 'false' });
      const list = el('div.fpick-list');
      const nameInput = el('input.input', { value: o.name || '', placeholder: o.mode === 'save' ? 'Nom du fichier' : 'Sélectionnez un fichier', spellcheck: 'false' });
      const okBtn = el('button.btn.primary', o.mode === 'save' ? 'Enregistrer' : o.mode === 'folder' ? 'Choisir ce dossier' : 'Ouvrir');
      const cancelBtn = el('button.btn', 'Annuler');
      const upBtn = el('button.btn.icon', { title: 'Dossier parent', html: Y.icons.svg('arrowUp', 16) });
      const newBtn = el('button.btn.icon', { title: 'Nouveau dossier', html: Y.icons.svg('plus', 16) });
      const side = el('div.fpick-side');
      [['Bureau', 'monitor'], ['Documents', 'fileText'], ['Images', 'image'], ['Musique', 'music'], ['Téléchargements', 'download']].forEach(([n, ic]) => {
        side.appendChild(el('button', { html: Y.icons.svg(ic, 15) + ' ' + n, onclick: () => go(Y.fs.HOME + '/' + n) }));
      });
      side.appendChild(el('button', { html: Y.icons.svg('home', 15) + ' Dossier perso', onclick: () => go(Y.fs.HOME) }));
      side.appendChild(el('button', { html: Y.icons.svg('drive', 15) + ' Racine /', onclick: () => go('/') }));

      const foot = el('div.fpick-foot', o.mode === 'folder' ? el('span.grow.dim', '') : nameInput, cancelBtn, okBtn);
      const root = el('div.fpick', el('div.fpick-bar', upBtn, pathInput, newBtn), el('div.fpick-main', side, list), foot);
      const parent = o.parent || null;
      const win = Y.wm.create({
        title: o.title || (o.mode === 'save' ? 'Enregistrer sous' : o.mode === 'folder' ? 'Choisir un dossier' : 'Ouvrir un fichier'),
        content: root, width: 640, height: 440, minWidth: 420, minHeight: 300, parent, modal: !!parent,
        iconHtml: Y.icons.svg(o.mode === 'save' ? 'save' : 'folderOpen', 16)
      });

      function go(p) {
        if (!Y.fs.isDir(p)) return;
        cwd = Y.fs.normalize(p);
        selected = null;
        render();
      }
      function render() {
        pathInput.value = cwd;
        if (o.mode === 'folder') foot.firstChild.textContent = Y.fs.pretty(cwd);
        list.innerHTML = '';
        let entries = [];
        try { entries = Y.fs.readdir(cwd); } catch (e) { /* ignore */ }
        entries = entries.filter(e => e.isDir || (o.mode !== 'folder' && (!exts || exts.includes(Y.fs.ext(e.name)))));
        if (!entries.length) list.appendChild(el('div.empty-state', 'Dossier vide'));
        entries.forEach(e => {
          const row = el('div.fpick-item', { html: Y.icons.fileIcon(e.name, e.isDir, 22) }, el('span', e.name), el('span.meta', e.isDir ? '' : U.formatBytes(e.size)));
          row.addEventListener('click', () => {
            list.querySelectorAll('.sel').forEach(x => x.classList.remove('sel'));
            row.classList.add('sel');
            selected = e;
            if (!e.isDir && o.mode !== 'folder') nameInput.value = e.name;
          });
          row.addEventListener('dblclick', () => { if (e.isDir) go(e.path); else confirmChoice(); });
          list.appendChild(row);
        });
      }
      async function confirmChoice() {
        if (o.mode === 'folder') { result = selected && selected.isDir ? selected.path : cwd; win.close(true); return; }
        let name = nameInput.value.trim();
        if (!name) { if (selected && selected.isDir) go(selected.path); return; }
        if (o.mode === 'save' && o.ext && !name.includes('.')) name += '.' + o.ext;
        const full = Y.fs.normalize(name, cwd);
        if (Y.fs.isDir(full)) { go(full); nameInput.value = ''; return; }
        if (o.mode === 'open') {
          if (!Y.fs.exists(full)) { Y.dialog.alert(`Le fichier « ${name} » est introuvable.`, { icon: 'err', parent: win }); return; }
          result = full; win.close(true);
        } else {
          if (Y.fs.exists(full)) {
            const ok = await Y.dialog.confirm(`« ${Y.fs.basename(full)} » existe déjà.\nVoulez-vous le remplacer ?`, { title: 'Confirmer l\'enregistrement', icon: 'warn', okText: 'Remplacer', parent: win });
            if (!ok) return;
          }
          result = full; win.close(true);
        }
      }
      upBtn.onclick = () => go(Y.fs.dirname(cwd));
      newBtn.onclick = async () => {
        const n = await Y.dialog.prompt('Nom du nouveau dossier :', { title: 'Nouveau dossier', value: 'Nouveau dossier', parent: win });
        if (!n) return;
        try { Y.fs.mkdir(Y.fs.join(cwd, n)); render(); } catch (e) { Y.dialog.alert(e.message, { icon: 'err', parent: win }); }
      };
      pathInput.addEventListener('keydown', e => { if (e.key === 'Enter') go(pathInput.value); });
      nameInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.stopPropagation(); confirmChoice(); } });
      okBtn.onclick = confirmChoice;
      cancelBtn.onclick = () => win.close(true);
      win.el.addEventListener('keydown', e => { if (e.key === 'Escape') win.close(true); });
      win.on('close', () => resolve(result));
      render();
      setTimeout(() => { nameInput.focus(); const dot = nameInput.value.lastIndexOf('.'); nameInput.setSelectionRange(0, dot > 0 ? dot : nameInput.value.length); }, 50);
    });
  }

  Y.dialog = dialog;
})(window.YOS);
