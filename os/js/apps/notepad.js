/* YohannOS — Bloc-notes (éditeur de texte + aperçu Markdown) */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const FS = Y.fs;

  function launch(args) {
    let path = null, saved = '', wrap = U.store.get('np-wrap', true), fontSize = U.store.get('np-font', 14), preview = false;
    let matchCase = false;

    const ta = el('textarea.np-text', { spellcheck: 'false', wrap: wrap ? 'soft' : 'off' });
    const gutter = el('div.np-gutter');
    const pv = el('div.np-preview.md.selectable.hidden');
    const findInput = el('input.input', { placeholder: 'Rechercher', spellcheck: 'false' });
    const replInput = el('input.input', { placeholder: 'Remplacer par', spellcheck: 'false' });
    const findInfo = el('span.dim', { style: { fontSize: '12px', minWidth: '70px' } });
    const caseBtn = el('button.btn.sm', { title: 'Respecter la casse' }, 'Aa');
    const findBar = el('div.np-find.hidden', findInput,
      el('button.btn.sm.icon', { title: 'Précédent', html: Y.icons.svg('chevronUp', 14), onclick: () => find(-1) }),
      el('button.btn.sm.icon', { title: 'Suivant', html: Y.icons.svg('chevronDown', 14), onclick: () => find(1) }),
      caseBtn, findInfo, replInput,
      el('button.btn.sm', { onclick: () => replace() }, 'Remplacer'),
      el('button.btn.sm', { onclick: () => replaceAll() }, 'Tout'),
      el('button.btn.sm.icon.ghost', { title: 'Fermer', html: Y.icons.svg('x', 14), onclick: () => toggleFind(false) }));
    caseBtn.addEventListener('click', () => { matchCase = !matchCase; caseBtn.classList.toggle('active', matchCase); });

    const tb = (icon, title, fn, extra) => { const b = el('button.btn.ghost.sm.icon', Object.assign({ title, html: Y.icons.svg(icon, 16) }, extra || {})); b.addEventListener('click', fn); return b; };
    const pvBtn = tb('eye', 'Aperçu Markdown', () => togglePreview());
    const wrapBtn = tb('wave', 'Retour automatique à la ligne', () => { wrap = !wrap; U.store.set('np-wrap', wrap); ta.wrap = wrap ? 'soft' : 'off'; wrapBtn.classList.toggle('active', wrap); updateGutter(); });
    wrapBtn.classList.toggle('active', wrap);
    const toolbar = el('div.toolbar',
      tb('file', 'Nouveau (Ctrl+N)', () => newDoc()),
      tb('folderOpen', 'Ouvrir (Ctrl+O)', () => openDoc()),
      tb('save', 'Enregistrer (Ctrl+S)', () => save()),
      el('button.btn.ghost.sm', { title: 'Enregistrer sous (Ctrl+Maj+S)', onclick: () => save(true) }, 'Enregistrer sous'),
      el('div.sep'),
      tb('undo', 'Annuler (Ctrl+Z)', () => { ta.focus(); document.execCommand('undo'); }),
      tb('redo', 'Rétablir (Ctrl+Y)', () => { ta.focus(); document.execCommand('redo'); }),
      tb('search', 'Rechercher / remplacer (Ctrl+F)', () => toggleFind(true)),
      el('div.sep'),
      tb('zoomOut', 'Réduire la police', () => setFont(fontSize - 1)),
      tb('zoomIn', 'Agrandir la police', () => setFont(fontSize + 1)),
      wrapBtn, pvBtn,
      el('span.grow'),
      tb('download', 'Télécharger sur mon ordinateur', () => U.download(path ? FS.basename(path) : 'document.txt', ta.value)));
    const status = el('div.statusbar');
    const editor = el('div.np-editor', gutter, ta);
    const content = el('div.np', toolbar, findBar, el('div.np-body', editor, pv), status);
    const win = Y.apps.window('notepad', { content, width: 760, height: 520, minWidth: 380, minHeight: 240 });

    function setFont(s) { fontSize = U.clamp(s, 9, 32); U.store.set('np-font', fontSize); ta.style.fontSize = gutter.style.fontSize = fontSize + 'px'; updateGutter(); }
    const dirty = () => ta.value !== saved;
    function updateTitle() {
      const name = path ? FS.basename(path) : 'Sans titre';
      win.setTitle(`${dirty() ? '● ' : ''}${name} — Bloc-notes`);
    }
    function updateGutter() {
      if (wrap) { gutter.classList.add('hidden'); return; }
      gutter.classList.remove('hidden');
      const n = ta.value.split('\n').length;
      if (gutter._n !== n) {
        gutter._n = n;
        gutter.textContent = Array.from({ length: n }, (_, i) => i + 1).join('\n');
      }
      gutter.scrollTop = ta.scrollTop;
    }
    function updateStatus() {
      const pos = ta.selectionStart;
      const before = ta.value.slice(0, pos);
      const ln = before.split('\n').length, col = pos - before.lastIndexOf('\n');
      const words = (ta.value.match(/\S+/g) || []).length;
      const ext = path ? FS.ext(path) : 'txt';
      status.innerHTML = '';
      status.append(el('span', `Ln ${ln}, Col ${col}`), el('span', `${ta.value.length} caractères`), el('span', `${words} mots`), el('span.grow'), el('span', (ext || 'txt').toUpperCase()), el('span', 'UTF-8'));
    }
    function updatePreview() { if (preview) pv.innerHTML = Y.markdown.render(ta.value); }
    function togglePreview(force) {
      preview = force != null ? force : !preview;
      pv.classList.toggle('hidden', !preview);
      pvBtn.classList.toggle('active', preview);
      updatePreview();
    }
    function load(p) {
      try {
        const st = FS.stat(p);
        if (st.url || FS.readFile(p).startsWith('data:')) { Y.dialog.alert('Ce fichier est binaire (image…) et ne peut pas être édité ici.', { parent: win, icon: 'warn' }); return false; }
        path = FS.normalize(p);
        saved = FS.readFile(p);
        ta.value = saved;
        Y.recent.add(path);
        togglePreview(FS.ext(path) === 'md');
        refresh();
        ta.setSelectionRange(0, 0);
        ta.scrollTop = 0;
        return true;
      } catch (e) { Y.dialog.alert(e.message, { icon: 'err', parent: win }); return false; }
    }
    function refresh() { updateTitle(); updateGutter(); updateStatus(); updatePreview(); }

    async function confirmDiscard() {
      if (!dirty()) return true;
      const r = await Y.dialog.ask3(`Voulez-vous enregistrer les modifications apportées à « ${path ? FS.basename(path) : 'Sans titre'} » ?`, { title: 'Bloc-notes', parent: win });
      if (r === 'yes') return await save();
      return r === 'no';
    }
    async function newDoc() { if (!(await confirmDiscard())) return; path = null; saved = ''; ta.value = ''; togglePreview(false); refresh(); ta.focus(); }
    async function openDoc() {
      if (!(await confirmDiscard())) return;
      const p = await Y.dialog.openFile({ dir: path ? FS.dirname(path) : FS.HOME + '/Documents', parent: win });
      if (p) load(p);
    }
    async function save(as) {
      let p = path;
      if (!p || as) {
        p = await Y.dialog.saveFile({ dir: path ? FS.dirname(path) : FS.HOME + '/Documents', name: path ? FS.basename(path) : 'Sans titre.txt', ext: 'txt', parent: win });
        if (!p) return false;
      }
      try {
        FS.writeFile(p, ta.value);
        path = FS.normalize(p); saved = ta.value;
        Y.recent.add(path);
        refresh();
        return true;
      } catch (e) { Y.dialog.alert(e.message, { icon: 'err', parent: win }); return false; }
    }

    /* Recherche */
    function toggleFind(show) {
      findBar.classList.toggle('hidden', !show);
      if (show) { const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd); if (sel && !sel.includes('\n')) findInput.value = sel; findInput.focus(); findInput.select(); }
      else ta.focus();
    }
    function find(dir) {
      const q = findInput.value;
      if (!q) return false;
      const hay = matchCase ? ta.value : ta.value.toLowerCase();
      const needle = matchCase ? q : q.toLowerCase();
      let i;
      if (dir > 0) { i = hay.indexOf(needle, ta.selectionEnd); if (i < 0) i = hay.indexOf(needle); }
      else { i = hay.lastIndexOf(needle, Math.max(0, ta.selectionStart - 1)); if (i < 0 || i >= ta.selectionStart) i = hay.lastIndexOf(needle); }
      const total = hay.split(needle).length - 1;
      if (i < 0) { findInfo.textContent = 'Aucun résultat'; return false; }
      ta.focus();
      ta.setSelectionRange(i, i + q.length);
      const line = ta.value.slice(0, i).split('\n').length;
      ta.scrollTop = Math.max(0, (line - 5) * fontSize * 1.5);
      findInfo.textContent = `${hay.slice(0, i).split(needle).length} sur ${total}`;
      findInput.focus();
      return true;
    }
    function replace() {
      const q = findInput.value;
      const sel = ta.value.slice(ta.selectionStart, ta.selectionEnd);
      if (q && (matchCase ? sel === q : sel.toLowerCase() === q.toLowerCase())) {
        ta.focus();
        document.execCommand('insertText', false, replInput.value) || ta.setRangeText(replInput.value, ta.selectionStart, ta.selectionEnd, 'end');
      }
      find(1);
      refresh();
    }
    function replaceAll() {
      const q = findInput.value;
      if (!q) return;
      const re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), matchCase ? 'g' : 'gi');
      const n = (ta.value.match(re) || []).length;
      ta.focus();
      ta.select();
      const nv = ta.value.replace(re, () => replInput.value);
      document.execCommand('insertText', false, nv) || (ta.value = nv);
      findInfo.textContent = `${n} remplacé(s)`;
      refresh();
    }
    findInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); find(e.shiftKey ? -1 : 1); } if (e.key === 'Escape') toggleFind(false); });
    replInput.addEventListener('keydown', e => { if (e.key === 'Enter') { e.preventDefault(); replace(); } if (e.key === 'Escape') toggleFind(false); });

    ta.addEventListener('input', () => { refresh(); });
    ta.addEventListener('scroll', () => { gutter.scrollTop = ta.scrollTop; });
    ['keyup', 'click', 'select'].forEach(ev => ta.addEventListener(ev, updateStatus));
    ta.addEventListener('keydown', e => {
      if (e.key === 'Tab') { e.preventDefault(); document.execCommand('insertText', false, '  ') || ta.setRangeText('  ', ta.selectionStart, ta.selectionEnd, 'end'); }
    });
    win.el.addEventListener('keydown', e => {
      const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (!ctrl || e.altKey) return;
      if (k === 's') { e.preventDefault(); save(e.shiftKey); }
      else if (k === 'o') { e.preventDefault(); openDoc(); }
      else if (k === 'n') { e.preventDefault(); newDoc(); }
      else if (k === 'f' || k === 'h') { e.preventDefault(); toggleFind(true); if (k === 'h') replInput.focus(); }
      else if (k === 'p') { e.preventDefault(); togglePreview(); }
      else if (k === '+' || k === '=') { e.preventDefault(); setFont(fontSize + 1); }
      else if (k === '-') { e.preventDefault(); setFont(fontSize - 1); }
    });
    win.on('beforeclose', confirmDiscard);
    win.listen('fs:change', p => {
      if (path && p === FS.dirname(path) && FS.isFile(path) && !dirty()) {
        const v = FS.readFile(path);
        if (v !== saved) { const pos = ta.selectionStart; saved = v; ta.value = v; ta.setSelectionRange(pos, pos); refresh(); }
      }
    });

    setFont(fontSize);
    if (args.path && FS.exists(args.path)) load(args.path); else refresh();
    if (args.text) { ta.value = args.text; refresh(); }
    setTimeout(() => ta.focus(), 60);
    win.loadFile = p => confirmDiscard().then(ok => ok && load(p));
    return win;
  }

  Y.apps.register({
    id: 'notepad', name: 'Bloc-notes', icon: 'edit', color: ['#4fc3f7', '#1e88e5'], category: 'Productivité',
    description: 'Éditeur de texte et Markdown', keywords: 'texte editeur notes markdown txt',
    exts: ['txt', 'md', 'log', 'json', 'css', 'js', 'py', 'php', 'csv', 'sh', 'html', 'htm', 'xml', 'yml', 'yaml', 'ini', 'seq', 'url', 'c', 'cpp', 'java', 'ts', ''],
    launch
  });
})(window.YOS);
