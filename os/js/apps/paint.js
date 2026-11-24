/* YohannOS — Paint (dessin bitmap) */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const FS = Y.fs;
  const PALETTE = ['#000000', '#434343', '#7f7f7f', '#c3c3c3', '#ffffff', '#880015', '#ed1c24', '#ff7f27', '#fff200', '#22b14c', '#00a2e8', '#3f48cc', '#a349a4', '#b97a57', '#ffaec9', '#ffc90e', '#efe4b0', '#b5e61d', '#99d9ea', '#7092be', '#c8bfe7', '#7c6cff'];
  const TOOLS = [
    ['brush', 'brush', 'Pinceau (B)', 'b'], ['eraser', 'eraser', 'Gomme (E)', 'e'], ['spray', 'spray', 'Aérosol (A)', 'a'],
    ['line', 'line', 'Ligne (L)', 'l'], ['rect', 'rect', 'Rectangle (R)', 'r'], ['ellipse', 'circle', 'Ellipse (O)', 'o'],
    ['fill', 'bucket', 'Pot de peinture (F)', 'f'], ['picker', 'pipette', 'Pipette (I)', 'i'], ['text', 'type', 'Texte (T)', 't']
  ];

  function launch(args) {
    let tool = 'brush', color = '#000000', size = 6, alpha = 1, filled = false, zoom = 1;
    let path = null, dirty = false;
    const undo = [], redo = [];

    const cv = el('canvas.pt-canvas');
    const pv = el('canvas.pt-preview');
    const ctx = cv.getContext('2d', { willReadFrequently: true });
    const pctx = pv.getContext('2d');
    const stage = el('div.pt-stage', cv, pv);
    const scroller = el('div.pt-scroll', stage);

    const toolBtns = {};
    const toolBox = el('div.pt-tools');
    TOOLS.forEach(([id, icon, title]) => {
      toolBtns[id] = el('button.btn.ghost.icon', { title, html: Y.icons.svg(icon, 18), onclick: () => setTool(id) });
      toolBox.appendChild(toolBtns[id]);
    });
    const fillBtn = el('button.btn.ghost.icon', { title: 'Formes pleines', onclick: () => { filled = !filled; fillBtn.classList.toggle('active', filled); updateFillIcon(); } });
    const updateFillIcon = () => { fillBtn.innerHTML = `<svg class="ico" width="18" height="18" viewBox="0 0 24 24" fill="${filled ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2"><rect x="4" y="6" width="16" height="12" rx="1"/></svg>`; };
    updateFillIcon();
    toolBox.append(el('div.pt-sep'), fillBtn);

    const swatchCur = el('div.pt-current', { title: 'Couleur actuelle' });
    const colorInput = el('input', { type: 'color', value: color, title: 'Couleur personnalisée' });
    colorInput.addEventListener('input', () => setColor(colorInput.value));
    const pal = el('div.pt-palette');
    PALETTE.forEach(c => { const s = el('button.pt-swatch', { style: { background: c }, title: c, onclick: () => setColor(c) }); pal.appendChild(s); });
    const sizeIn = el('input.range', { type: 'range', min: 1, max: 80, value: size });
    const sizeLbl = el('span.pt-lbl', size + ' px');
    sizeIn.addEventListener('input', () => { size = +sizeIn.value; sizeLbl.textContent = size + ' px'; });
    const alphaIn = el('input.range', { type: 'range', min: 5, max: 100, value: 100 });
    const alphaLbl = el('span.pt-lbl', '100 %');
    alphaIn.addEventListener('input', () => { alpha = alphaIn.value / 100; alphaLbl.textContent = alphaIn.value + ' %'; });

    const tb = (icon, title, fn) => el('button.btn.ghost.sm.icon', { title, html: Y.icons.svg(icon, 16), onclick: fn });
    const zoomLbl = el('span.pt-lbl', '100 %');
    const toolbar = el('div.toolbar',
      tb('file', 'Nouveau', () => newImage()), tb('folderOpen', 'Ouvrir une image', () => openImage()), tb('save', 'Enregistrer (Ctrl+S)', () => save()),
      tb('download', 'Télécharger en PNG', () => U.download((path ? FS.stem(path) : 'dessin') + '.png', cv.toDataURL('image/png'))),
      el('div.sep'),
      tb('undo', 'Annuler (Ctrl+Z)', () => doUndo()), tb('redo', 'Rétablir (Ctrl+Y)', () => doRedo()),
      tb('trash', 'Tout effacer', () => { snapshot(); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, cv.width, cv.height); markDirty(); }),
      el('div.sep'),
      tb('zoomOut', 'Zoom arrière', () => setZoom(zoom / 1.25)), zoomLbl, tb('zoomIn', 'Zoom avant', () => setZoom(zoom * 1.25)), tb('expand', 'Ajuster', () => fit()),
      el('div.sep'),
      el('span.pt-lbl', 'Taille'), sizeIn, sizeLbl,
      el('span.pt-lbl', 'Opacité'), alphaIn, alphaLbl);
    const colors = el('div.pt-colors', swatchCur, colorInput, pal);
    const status = el('div.statusbar');
    const posLbl = el('span', '');
    const sizeInfo = el('span', '');
    status.append(posLbl, sizeInfo, el('span.grow'), el('span.dim', 'Astuce : [ et ] changent la taille'));
    const content = el('div.pt', toolbar, el('div.pt-body', toolBox, el('div.pt-center', scroller, colors)), status);
    const win = Y.apps.window('paint', { content, width: 960, height: 640, minWidth: 520, minHeight: 360 });

    /* ---------- Canvas ---------- */
    function resize(w, h, keep) {
      const old = keep ? ctx.getImageData(0, 0, cv.width, cv.height) : null;
      cv.width = pv.width = w; cv.height = pv.height = h;
      ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, w, h);
      if (old) ctx.putImageData(old, 0, 0);
      applyZoom();
      sizeInfo.textContent = `${w} × ${h} px`;
    }
    function applyZoom() {
      const w = cv.width * zoom, h = cv.height * zoom;
      [cv, pv].forEach(c => { c.style.width = w + 'px'; c.style.height = h + 'px'; });
      stage.style.width = w + 'px'; stage.style.height = h + 'px';
      zoomLbl.textContent = Math.round(zoom * 100) + ' %';
      cv.style.imageRendering = zoom >= 2 ? 'pixelated' : 'auto';
    }
    function setZoom(z) { zoom = U.clamp(z, 0.1, 8); applyZoom(); }
    function fit() { const r = scroller.getBoundingClientRect(); setZoom(Math.min((r.width - 40) / cv.width, (r.height - 40) / cv.height, 4)); }

    function setTool(t) {
      tool = t;
      Object.entries(toolBtns).forEach(([k, b]) => b.classList.toggle('active', k === t));
      stage.dataset.tool = t;
    }
    function setColor(c) {
      color = c;
      swatchCur.style.background = c;
      if (/^#[0-9a-f]{6}$/i.test(c)) colorInput.value = c;
    }
    function snapshot() {
      undo.push(ctx.getImageData(0, 0, cv.width, cv.height));
      if (undo.length > 30) undo.shift();
      redo.length = 0;
    }
    function doUndo() { if (!undo.length) return; redo.push(ctx.getImageData(0, 0, cv.width, cv.height)); restore(undo.pop()); markDirty(); }
    function doRedo() { if (!redo.length) return; undo.push(ctx.getImageData(0, 0, cv.width, cv.height)); restore(redo.pop()); markDirty(); }
    function restore(img) { if (img.width !== cv.width || img.height !== cv.height) { cv.width = pv.width = img.width; cv.height = pv.height = img.height; applyZoom(); sizeInfo.textContent = `${img.width} × ${img.height} px`; } ctx.putImageData(img, 0, 0); }
    function markDirty() { dirty = true; updateTitle(); }
    function updateTitle() { win.setTitle(`${dirty ? '● ' : ''}${path ? FS.basename(path) : 'Sans titre'} — Paint`); }

    const pos = e => { const r = cv.getBoundingClientRect(); return { x: (e.clientX - r.left) / zoom, y: (e.clientY - r.top) / zoom }; };

    /* ---------- Dessin ---------- */
    let drawing = false, start = null, last = null, sprayT = 0, sprayPos = null;
    stage.addEventListener('pointerdown', e => {
      if (e.button !== 0 && e.button !== 2) return;
      const p = pos(e);
      const col = e.button === 2 ? '#ffffff' : color;
      if (tool === 'picker') { const d = ctx.getImageData(Math.floor(p.x), Math.floor(p.y), 1, 1).data; setColor('#' + [d[0], d[1], d[2]].map(v => v.toString(16).padStart(2, '0')).join('')); setTool('brush'); return; }
      if (tool === 'fill') { snapshot(); floodFill(Math.floor(p.x), Math.floor(p.y), col); markDirty(); return; }
      if (tool === 'text') { addText(p, col); return; }
      snapshot();
      drawing = true; start = last = p;
      stage.setPointerCapture(e.pointerId);
      pctx.clearRect(0, 0, pv.width, pv.height);
      pv.style.opacity = tool === 'eraser' ? 1 : alpha;
      const target = (tool === 'brush' || tool === 'eraser') ? pctx : null;
      if (target) {
        target.strokeStyle = target.fillStyle = tool === 'eraser' ? '#ffffff' : col;
        target.lineWidth = size; target.lineCap = 'round'; target.lineJoin = 'round';
        target.beginPath(); target.arc(p.x, p.y, size / 2, 0, Math.PI * 2); target.fill();
      }
      if (tool === 'spray') { sprayPos = p; ctx.globalAlpha = alpha; ctx.fillStyle = col; spray(); sprayT = setInterval(spray, 30); }
      stage._col = col;
    });
    stage.addEventListener('pointermove', e => {
      const p = pos(e);
      posLbl.textContent = `${Math.max(0, Math.floor(p.x))}, ${Math.max(0, Math.floor(p.y))} px`;
      if (!drawing) return;
      const col = stage._col;
      if (tool === 'brush' || tool === 'eraser') {
        pctx.beginPath(); pctx.moveTo(last.x, last.y);
        const mid = { x: (last.x + p.x) / 2, y: (last.y + p.y) / 2 };
        pctx.quadraticCurveTo(last.x, last.y, mid.x, mid.y);
        pctx.lineTo(p.x, p.y);
        pctx.stroke();
        last = p;
      } else if (tool === 'spray') sprayPos = p;
      else {
        pctx.clearRect(0, 0, pv.width, pv.height);
        drawShape(pctx, tool, start, constrain(start, p, e.shiftKey), col);
      }
    });
    const end = e => {
      if (!drawing) return;
      drawing = false;
      clearInterval(sprayT);
      ctx.globalAlpha = 1;
      if (tool === 'brush' || tool === 'eraser') {
        ctx.globalAlpha = tool === 'eraser' ? 1 : alpha;
        ctx.drawImage(pv, 0, 0);
        ctx.globalAlpha = 1;
      } else if (tool !== 'spray') {
        ctx.globalAlpha = alpha;
        drawShape(ctx, tool, start, constrain(start, pos(e), e.shiftKey), stage._col);
        ctx.globalAlpha = 1;
      }
      pctx.clearRect(0, 0, pv.width, pv.height);
      markDirty();
    };
    stage.addEventListener('pointerup', end);
    stage.addEventListener('pointercancel', end);
    stage.addEventListener('contextmenu', e => e.preventDefault());
    scroller.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); setZoom(zoom * (e.deltaY < 0 ? 1.1 : 0.9)); } }, { passive: false });

    function constrain(a, b, shift) {
      if (!shift) return b;
      if (tool === 'line') {
        const dx = b.x - a.x, dy = b.y - a.y, ang = Math.round(Math.atan2(dy, dx) / (Math.PI / 4)) * (Math.PI / 4), len = Math.hypot(dx, dy);
        return { x: a.x + Math.cos(ang) * len, y: a.y + Math.sin(ang) * len };
      }
      const s = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y));
      return { x: a.x + Math.sign(b.x - a.x) * s, y: a.y + Math.sign(b.y - a.y) * s };
    }
    function drawShape(c, t, a, b, col) {
      c.save();
      c.strokeStyle = c.fillStyle = col; c.lineWidth = size; c.lineCap = 'round'; c.lineJoin = 'round';
      c.beginPath();
      if (t === 'line') { c.moveTo(a.x, a.y); c.lineTo(b.x, b.y); c.stroke(); }
      else if (t === 'rect') { c.rect(Math.min(a.x, b.x), Math.min(a.y, b.y), Math.abs(b.x - a.x), Math.abs(b.y - a.y)); filled ? c.fill() : c.stroke(); }
      else if (t === 'ellipse') { c.ellipse((a.x + b.x) / 2, (a.y + b.y) / 2, Math.abs(b.x - a.x) / 2, Math.abs(b.y - a.y) / 2, 0, 0, Math.PI * 2); filled ? c.fill() : c.stroke(); }
      c.restore();
    }
    function spray() {
      const r = size * 1.5;
      for (let i = 0; i < size * 1.5; i++) {
        const ang = Math.random() * Math.PI * 2, d = Math.random() * r;
        ctx.fillRect(sprayPos.x + Math.cos(ang) * d, sprayPos.y + Math.sin(ang) * d, 1.2, 1.2);
      }
    }
    async function addText(p, col) {
      const txt = await Y.dialog.prompt('Texte à insérer :', { title: 'Outil texte', placeholder: 'Bonjour !', parent: win });
      if (!txt) return;
      snapshot();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = col;
      ctx.font = `${Math.max(10, size * 3)}px system-ui, sans-serif`;
      ctx.textBaseline = 'top';
      txt.split('\n').forEach((l, i) => ctx.fillText(l, p.x, p.y + i * size * 3.4));
      ctx.globalAlpha = 1;
      markDirty();
    }
    function floodFill(x, y, hex) {
      const W = cv.width, H = cv.height;
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const img = ctx.getImageData(0, 0, W, H), d = img.data;
      const rgb = Y.settings.hexToRgb(hex);
      const fr = Math.round(rgb[0] * alpha + 255 * (1 - alpha)), fg = Math.round(rgb[1] * alpha + 255 * (1 - alpha)), fb = Math.round(rgb[2] * alpha + 255 * (1 - alpha));
      const i0 = (y * W + x) * 4;
      const tr = d[i0], tg = d[i0 + 1], tb = d[i0 + 2];
      if (tr === fr && tg === fg && tb === fb) return;
      const tol = 32;
      const match = i => Math.abs(d[i] - tr) <= tol && Math.abs(d[i + 1] - tg) <= tol && Math.abs(d[i + 2] - tb) <= tol;
      const seen = new Uint8Array(W * H);
      const stack = [[x, y]];
      while (stack.length) {
        let [cx, cy] = stack.pop();
        while (cy >= 0 && match((cy * W + cx) * 4) && !seen[cy * W + cx]) cy--;
        cy++;
        let left = false, right = false;
        while (cy < H && match((cy * W + cx) * 4) && !seen[cy * W + cx]) {
          const i = (cy * W + cx) * 4;
          d[i] = fr; d[i + 1] = fg; d[i + 2] = fb; d[i + 3] = 255;
          seen[cy * W + cx] = 1;
          if (cx > 0) { const m = match(i - 4) && !seen[cy * W + cx - 1]; if (m && !left) { stack.push([cx - 1, cy]); left = true; } else if (!m) left = false; }
          if (cx < W - 1) { const m = match(i + 4) && !seen[cy * W + cx + 1]; if (m && !right) { stack.push([cx + 1, cy]); right = true; } else if (!m) right = false; }
          cy++;
        }
      }
      ctx.putImageData(img, 0, 0);
    }

    /* ---------- Fichiers ---------- */
    async function confirmDiscard() {
      if (!dirty) return true;
      const r = await Y.dialog.ask3('Voulez-vous enregistrer votre dessin ?', { title: 'Paint', parent: win });
      if (r === 'yes') return await save();
      return r === 'no';
    }
    async function newImage() {
      if (!(await confirmDiscard())) return;
      const v = await Y.dialog.prompt('Dimensions (largeur × hauteur) :', { title: 'Nouvelle image', value: `${cv.width}x${cv.height}`, parent: win });
      if (!v) return;
      const m = v.match(/(\d+)\s*[x×*,\s]\s*(\d+)/i);
      if (!m) return;
      undo.length = redo.length = 0;
      resize(U.clamp(+m[1], 16, 3000), U.clamp(+m[2], 16, 3000));
      path = null; dirty = false; updateTitle(); fit();
    }
    async function openImage() {
      if (!(await confirmDiscard())) return;
      const p = await Y.dialog.openFile({ dir: FS.HOME + '/Images', exts: ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'], parent: win });
      if (p) loadImage(p);
    }
    function loadImage(p) {
      const src = FS.getUrl(p);
      if (!src) { Y.dialog.alert('Impossible de lire cette image.', { icon: 'err', parent: win }); return; }
      const img = new Image();
      img.onload = () => {
        undo.length = redo.length = 0;
        resize(img.naturalWidth || 800, img.naturalHeight || 500);
        ctx.drawImage(img, 0, 0);
        path = FS.ext(p) === 'png' ? FS.normalize(p) : null;
        dirty = false; updateTitle(); fit();
        Y.recent.add(FS.normalize(p));
      };
      img.onerror = () => Y.dialog.alert('Image illisible.', { icon: 'err', parent: win });
      img.src = src;
    }
    async function save(as) {
      let p = path;
      if (!p || as || FS.stat(p)?.url) {
        p = await Y.dialog.saveFile({ dir: FS.HOME + '/Images', name: path ? FS.basename(path) : 'dessin.png', ext: 'png', parent: win });
        if (!p) return false;
        if (FS.ext(p) !== 'png') p += '.png';
      }
      try {
        FS.writeFile(p, cv.toDataURL('image/png'));
        path = FS.normalize(p); dirty = false; updateTitle();
        Y.notify({ title: 'Image enregistrée', body: FS.pretty(path), app: 'paint' });
        return true;
      } catch (e) { Y.dialog.alert(e.message, { icon: 'err', parent: win }); return false; }
    }

    win.el.addEventListener('keydown', e => {
      if (e.target.tagName === 'INPUT') return;
      const ctrl = e.ctrlKey || e.metaKey, k = e.key.toLowerCase();
      if (ctrl && k === 'z') { e.preventDefault(); e.shiftKey ? doRedo() : doUndo(); }
      else if (ctrl && k === 'y') { e.preventDefault(); doRedo(); }
      else if (ctrl && k === 's') { e.preventDefault(); save(e.shiftKey); }
      else if (ctrl && k === 'o') { e.preventDefault(); openImage(); }
      else if (!ctrl && k === '[') { size = Math.max(1, size - 2); sizeIn.value = size; sizeLbl.textContent = size + ' px'; }
      else if (!ctrl && k === ']') { size = Math.min(80, size + 2); sizeIn.value = size; sizeLbl.textContent = size + ' px'; }
      else if (!ctrl) { const t = TOOLS.find(x => x[3] === k); if (t) setTool(t[0]); }
    });
    win.on('beforeclose', confirmDiscard);

    setTool('brush'); setColor(color);
    resize(900, 560);
    requestAnimationFrame(fit);
    if (args.path) loadImage(args.path);
    updateTitle();
    return win;
  }

  Y.apps.register({
    id: 'paint', name: 'Paint', icon: 'palette', color: ['#ff6b9a', '#ff3d6e'], category: 'Création',
    description: 'Dessiner et retoucher des images', keywords: 'dessin peinture image draw',
    exts: ['png', 'jpg', 'jpeg', 'gif', 'webp'], launch
  });
})(window.YOS);
