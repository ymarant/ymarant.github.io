/* YohannOS — Visionneuse d'images */
(function (Y) {
  'use strict';
  const U = Y.U, { el } = U;
  const FS = Y.fs;
  const IMG = ['png', 'jpg', 'jpeg', 'gif', 'webp', 'svg'];

  function launch(args) {
    let path = null, list = [], idx = 0, scale = 1, fitScale = 1, rot = 0, tx = 0, ty = 0;
    const img = el('img.iv-img', { draggable: 'false', alt: '' });
    const stage = el('div.iv-stage', img);
    const info = el('span.grow');
    const zoomLbl = el('span.iv-zoom', '100 %');
    const tb = (icon, title, fn) => el('button.btn.ghost.sm.icon', { title, html: Y.icons.svg(icon, 16), onclick: fn });
    const bar = el('div.iv-bar',
      tb('chevronLeft', 'Précédente (←)', () => step(-1)), tb('chevronRight', 'Suivante (→)', () => step(1)),
      el('div.sep'),
      tb('zoomOut', 'Zoom arrière (-)', () => zoom(1 / 1.25)), zoomLbl, tb('zoomIn', 'Zoom avant (+)', () => zoom(1.25)),
      tb('expand', 'Ajuster (0)', () => fit()), tb('rotate', 'Pivoter (R)', () => { rot = (rot + 90) % 360; fit(); }),
      el('div.sep'),
      tb('palette', 'Modifier dans Paint', () => path && Y.apps.launch('paint', { path })),
      tb('monitor', 'Définir comme fond d\'écran', () => { if (!path) return; Y.settings.set('customWallpaper', FS.getUrl(path)); Y.settings.set('wallpaper', 'custom'); Y.notify({ title: 'Fond d\'écran modifié', body: FS.basename(path), app: 'imageviewer' }); }),
      tb('download', 'Télécharger', () => path && Y.downloadFile(path)),
      tb('folderOpen', 'Ouvrir…', () => pick()));
    const content = el('div.iv', stage, el('div.statusbar', info), bar);
    const win = Y.apps.window('imageviewer', { content, width: 820, height: 580, minWidth: 340, minHeight: 260 });

    function apply() {
      img.style.transform = `translate(${tx}px, ${ty}px) rotate(${rot}deg) scale(${scale})`;
      zoomLbl.textContent = Math.round(scale * 100) + ' %';
    }
    function fit() {
      if (!img.naturalWidth) return;
      const r = stage.getBoundingClientRect();
      const w = rot % 180 ? img.naturalHeight : img.naturalWidth, h = rot % 180 ? img.naturalWidth : img.naturalHeight;
      fitScale = Math.min((r.width - 40) / w, (r.height - 40) / h, 1);
      scale = fitScale; tx = ty = 0; apply();
    }
    function zoom(f) { scale = U.clamp(scale * f, 0.05, 20); apply(); }
    function show(p) {
      path = FS.normalize(p);
      const src = FS.getUrl(path);
      if (!src) { info.textContent = 'Image illisible'; return; }
      list = FS.readdir(FS.dirname(path)).filter(e => !e.isDir && IMG.includes(FS.ext(e.name))).map(e => e.path);
      idx = Math.max(0, list.indexOf(path));
      rot = 0;
      img.onload = () => {
        fit();
        info.textContent = `${FS.basename(path)} — ${img.naturalWidth} × ${img.naturalHeight} px — ${idx + 1}/${list.length}`;
      };
      img.src = src;
      win.setTitle(`${FS.basename(path)} — Visionneuse`);
      Y.recent.add(path);
    }
    function step(d) { if (list.length > 1) show(list[(idx + d + list.length) % list.length]); }
    async function pick() { const p = await Y.dialog.openFile({ dir: path ? FS.dirname(path) : FS.HOME + '/Images', exts: IMG, parent: win }); if (p) show(p); }

    stage.addEventListener('wheel', e => { e.preventDefault(); zoom(e.deltaY < 0 ? 1.12 : 1 / 1.12); }, { passive: false });
    stage.addEventListener('pointerdown', e => {
      const ox = tx, oy = ty;
      U.drag(e, { move(dx, dy) { tx = ox + dx; ty = oy + dy; apply(); } });
    });
    stage.addEventListener('dblclick', () => { if (Math.abs(scale - fitScale) < 0.01) { scale = 1; tx = ty = 0; apply(); } else fit(); });
    win.el.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') step(-1);
      else if (e.key === 'ArrowRight') step(1);
      else if (e.key === '+' || e.key === '=') zoom(1.25);
      else if (e.key === '-') zoom(0.8);
      else if (e.key === '0') fit();
      else if (e.key.toLowerCase() === 'r') { rot = (rot + 90) % 360; fit(); }
    });
    win.on('resize', U.debounce(fit, 100));
    if (args.path) show(args.path);
    else { const imgs = FS.readdir(FS.HOME + '/Images').filter(e => IMG.includes(FS.ext(e.name))); if (imgs.length) show(imgs[0].path); }
    return win;
  }

  Y.apps.register({
    id: 'imageviewer', name: 'Visionneuse', icon: 'image', color: ['#00c6ff', '#0072ff'], category: 'Multimédia',
    description: 'Afficher vos images', keywords: 'photos images viewer',
    exts: IMG, extPriority: { png: 10, jpg: 10, jpeg: 10, gif: 10, webp: 10, svg: 10 }, launch
  });
})(window.YOS);
